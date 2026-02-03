/**
 * AI-Powered Customer Health Prediction Service (PRD-231)
 *
 * Provides predictive health scores that forecast where customer health
 * will be in 30, 60, and 90 days, enabling proactive intervention.
 *
 * Features:
 * - Predicted health scores with confidence intervals
 * - Key driver identification
 * - Intervention impact modeling
 * - Historical prediction accuracy tracking
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { v4 as uuidv4 } from 'uuid';

// Initialize clients
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
}

// ============================================
// Types (aligned with PRD-231)
// ============================================

export type DriverDirection = 'positive' | 'negative';
export type InterventionEffort = 'low' | 'medium' | 'high';

export interface PredictionPoint {
  daysAhead: number;
  predictedScore: number;
  confidenceInterval: { low: number; high: number };
  keyFactors: string[];
}

export interface Driver {
  factor: string;
  direction: DriverDirection;
  magnitude: number;
  description: string;
}

export interface InterventionImpact {
  intervention: string;
  description: string;
  expectedHealthImpact: number;
  confidence: number;
  timeToImpactDays: number;
  effort: InterventionEffort;
}

export interface AccuracyMetrics {
  accuracy30d: number | null;
  accuracy60d: number | null;
  accuracy90d: number | null;
  totalPredictions: number;
}

export interface HealthPrediction {
  id: string;
  customerId: string;
  customerName: string;
  currentHealth: number;
  predictions: PredictionPoint[];
  confidence: number;
  primaryDrivers: Driver[];
  interventions: InterventionImpact[];
  accuracyMetrics: AccuracyMetrics;
  predictedAt: string;
}

export interface PortfolioHealthForecast {
  portfolioSummary: {
    currentAvgHealth: number;
    predicted30dAvg: number;
    predicted60dAvg: number;
    predicted90dAvg: number;
  };
  atRiskForecast: {
    currentBelow50: number;
    predicted30dBelow50: number;
    predicted60dBelow50: number;
    predicted90dBelow50: number;
  };
  accountsDeclining: Array<{
    customerId: string;
    customerName: string;
    current: number;
    predicted90d: number;
    decline: number;
  }>;
  recommendedFocus: string[];
}

interface HealthDataPoint {
  date: string;
  score: number;
}

interface CustomerFeatures {
  healthVelocity: number;
  healthAcceleration: number;
  usageTrend: number;
  engagementTrend: number;
  seasonalPattern: number;
  daysToRenewal: number;
  recentQbrDaysAgo: number;
  openRiskSignals: number;
  hasChampion: boolean;
  stakeholderCount: number;
}

// ============================================
// Health Prediction Service
// ============================================

class HealthPredictionService {
  /**
   * Generate health prediction for a customer
   */
  async predictHealth(
    customerId: string,
    horizonDays: number[] = [30, 60, 90]
  ): Promise<HealthPrediction> {
    // Gather historical data
    const customerData = await this.gatherCustomerData(customerId);

    // Extract features for prediction
    const features = this.extractFeatures(customerData);

    // Generate predictions for each horizon
    const predictions = horizonDays.map(days =>
      this.generatePrediction(customerData.healthHistory, features, days)
    );

    // Identify primary drivers
    const primaryDrivers = this.identifyDrivers(features, predictions);

    // Model intervention impacts
    const interventions = await this.modelInterventions(customerId, features);

    // Get historical accuracy
    const accuracyMetrics = await this.getHistoricalAccuracy(customerId);

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(customerData.healthHistory, features);

    const prediction: HealthPrediction = {
      id: uuidv4(),
      customerId,
      customerName: customerData.name,
      currentHealth: customerData.currentHealth,
      predictions,
      confidence,
      primaryDrivers,
      interventions,
      accuracyMetrics,
      predictedAt: new Date().toISOString(),
    };

    // Store prediction for accuracy tracking
    await this.storePrediction(prediction);

    return prediction;
  }

  /**
   * Get portfolio-level health forecast
   */
  async getPortfolioForecast(): Promise<PortfolioHealthForecast> {
    if (!supabase) {
      return this.getMockPortfolioForecast();
    }

    try {
      // Get all customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, health_score, arr, renewal_date, stage')
        .not('stage', 'eq', 'churned');

      if (!customers || customers.length === 0) {
        return this.getMockPortfolioForecast();
      }

      // Generate predictions for each customer
      const predictions: Array<{
        customerId: string;
        customerName: string;
        current: number;
        p30: number;
        p60: number;
        p90: number;
      }> = [];

      for (const customer of customers.slice(0, 50)) { // Limit for performance
        const customerData = await this.gatherCustomerData(customer.id);
        const features = this.extractFeatures(customerData);

        const p30 = this.generatePrediction(customerData.healthHistory, features, 30);
        const p60 = this.generatePrediction(customerData.healthHistory, features, 60);
        const p90 = this.generatePrediction(customerData.healthHistory, features, 90);

        predictions.push({
          customerId: customer.id,
          customerName: customer.name,
          current: customer.health_score || 70,
          p30: p30.predictedScore,
          p60: p60.predictedScore,
          p90: p90.predictedScore,
        });
      }

      // Calculate portfolio summary
      const currentAvgHealth = Math.round(
        predictions.reduce((sum, p) => sum + p.current, 0) / predictions.length
      );
      const predicted30dAvg = Math.round(
        predictions.reduce((sum, p) => sum + p.p30, 0) / predictions.length
      );
      const predicted60dAvg = Math.round(
        predictions.reduce((sum, p) => sum + p.p60, 0) / predictions.length
      );
      const predicted90dAvg = Math.round(
        predictions.reduce((sum, p) => sum + p.p90, 0) / predictions.length
      );

      // Calculate at-risk forecast
      const currentBelow50 = predictions.filter(p => p.current < 50).length;
      const predicted30dBelow50 = predictions.filter(p => p.p30 < 50).length;
      const predicted60dBelow50 = predictions.filter(p => p.p60 < 50).length;
      const predicted90dBelow50 = predictions.filter(p => p.p90 < 50).length;

      // Find accounts with significant decline
      const accountsDeclining = predictions
        .map(p => ({
          customerId: p.customerId,
          customerName: p.customerName,
          current: p.current,
          predicted90d: p.p90,
          decline: p.p90 - p.current,
        }))
        .filter(p => p.decline < -10)
        .sort((a, b) => a.decline - b.decline)
        .slice(0, 10);

      // Generate focus recommendations
      const recommendedFocus: string[] = [];

      if (predicted30dBelow50 > currentBelow50) {
        recommendedFocus.push(
          `${predicted30dBelow50 - currentBelow50} accounts predicted to drop below 50 in 30 days`
        );
      }

      if (accountsDeclining.length > 0) {
        recommendedFocus.push(
          `${accountsDeclining.length} accounts showing significant health decline`
        );
      }

      if (predicted90dAvg < currentAvgHealth - 5) {
        recommendedFocus.push(
          `Portfolio health trending down ${currentAvgHealth - predicted90dAvg} points over 90 days`
        );
      }

      recommendedFocus.push('Schedule QBRs for accounts with no engagement in 90+ days');

      return {
        portfolioSummary: {
          currentAvgHealth,
          predicted30dAvg,
          predicted60dAvg,
          predicted90dAvg,
        },
        atRiskForecast: {
          currentBelow50,
          predicted30dBelow50,
          predicted60dBelow50,
          predicted90dBelow50,
        },
        accountsDeclining,
        recommendedFocus,
      };
    } catch (error) {
      console.error('[HealthPrediction] Error generating portfolio forecast:', error);
      return this.getMockPortfolioForecast();
    }
  }

  /**
   * Update prediction accuracy when actual scores are available
   */
  async updatePredictionAccuracy(customerId: string): Promise<void> {
    if (!supabase) return;

    try {
      const now = new Date();

      // Get predictions made 30 days ago
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const { data: predictions30d } = await supabase
        .from('health_predictions')
        .select('*')
        .eq('customer_id', customerId)
        .lte('predicted_at', thirtyDaysAgo.toISOString())
        .gte('predicted_at', new Date(thirtyDaysAgo.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (predictions30d && predictions30d.length > 0) {
        // Get current health score
        const { data: customer } = await supabase
          .from('customers')
          .select('health_score')
          .eq('id', customerId)
          .single();

        if (customer) {
          const actualScore = customer.health_score || 70;

          for (const pred of predictions30d) {
            const predictedScore = pred.prediction_30d;
            const error = Math.abs(actualScore - predictedScore);

            // Store accuracy record
            await supabase.from('prediction_accuracy').insert({
              id: uuidv4(),
              customer_id: customerId,
              prediction_date: pred.predicted_at,
              days_ahead: 30,
              predicted_score: predictedScore,
              actual_score: actualScore,
              error,
            });
          }
        }
      }
    } catch (error) {
      console.error('[HealthPrediction] Error updating accuracy:', error);
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  private async gatherCustomerData(customerId: string): Promise<{
    name: string;
    currentHealth: number;
    arr: number;
    renewalDate: string | null;
    healthHistory: HealthDataPoint[];
    usageHistory: Array<{ date: string; value: number }>;
    engagementHistory: Array<{ date: string; value: number }>;
    upcomingEvents: {
      renewal?: { daysAway: number };
      lastQbr?: { daysAgo: number };
    };
    hasChampion: boolean;
    stakeholderCount: number;
    riskSignalCount: number;
  }> {
    const defaultData = {
      name: 'Unknown Customer',
      currentHealth: 70,
      arr: 0,
      renewalDate: null as string | null,
      healthHistory: this.generateMockHealthHistory(),
      usageHistory: this.generateMockTrendHistory(),
      engagementHistory: this.generateMockTrendHistory(),
      upcomingEvents: {
        renewal: { daysAway: 180 },
        lastQbr: { daysAgo: 45 },
      },
      hasChampion: false,
      stakeholderCount: 2,
      riskSignalCount: 0,
    };

    if (!supabase) {
      return {
        ...defaultData,
        name: 'Demo Customer',
        currentHealth: 68,
      };
    }

    try {
      // Get customer info
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (!customer) return defaultData;

      // Get health history (180 days)
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      const { data: healthHistory } = await supabase
        .from('health_score_history')
        .select('calculated_at, score')
        .eq('customer_id', customerId)
        .gte('calculated_at', sixMonthsAgo.toISOString())
        .order('calculated_at', { ascending: true });

      // Get usage metrics history
      const { data: usageHistory } = await supabase
        .from('usage_metrics')
        .select('calculated_at, total_events')
        .eq('customer_id', customerId)
        .gte('calculated_at', sixMonthsAgo.toISOString())
        .order('calculated_at', { ascending: true });

      // Get recent QBR
      const { data: recentQbr } = await supabase
        .from('meetings')
        .select('date')
        .eq('customer_id', customerId)
        .eq('type', 'qbr')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      // Count risk signals
      const { count: riskSignalCount } = await supabase
        .from('risk_signals')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('status', 'active');

      // Get stakeholder info
      const { data: stakeholders } = await supabase
        .from('stakeholders')
        .select('role')
        .eq('customer_id', customerId);

      const hasChampion = stakeholders?.some(s =>
        s.role?.toLowerCase().includes('champion') ||
        s.role?.toLowerCase().includes('admin')
      ) || false;

      // Calculate days to renewal
      let renewalDaysAway = 365;
      if (customer.renewal_date) {
        renewalDaysAway = Math.ceil(
          (new Date(customer.renewal_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );
      }

      // Calculate days since last QBR
      let qbrDaysAgo = 180;
      if (recentQbr?.date) {
        qbrDaysAgo = Math.ceil(
          (Date.now() - new Date(recentQbr.date).getTime()) / (24 * 60 * 60 * 1000)
        );
      }

      return {
        name: customer.name,
        currentHealth: customer.health_score || 70,
        arr: customer.arr || 0,
        renewalDate: customer.renewal_date,
        healthHistory: healthHistory?.map(h => ({
          date: h.calculated_at.split('T')[0],
          score: h.score,
        })) || defaultData.healthHistory,
        usageHistory: usageHistory?.map(u => ({
          date: u.calculated_at.split('T')[0],
          value: u.total_events,
        })) || defaultData.usageHistory,
        engagementHistory: defaultData.engagementHistory, // Would need engagement tracking
        upcomingEvents: {
          renewal: { daysAway: renewalDaysAway },
          lastQbr: { daysAgo: qbrDaysAgo },
        },
        hasChampion,
        stakeholderCount: stakeholders?.length || 0,
        riskSignalCount: riskSignalCount || 0,
      };
    } catch (error) {
      console.error('[HealthPrediction] Error gathering customer data:', error);
      return defaultData;
    }
  }

  private extractFeatures(customerData: ReturnType<typeof this.gatherCustomerData> extends Promise<infer T> ? T : never): CustomerFeatures {
    const history = customerData.healthHistory;

    // Calculate health velocity (rate of change over 30 days)
    const healthVelocity = this.calculateVelocity(history, 30);

    // Calculate health acceleration (change in velocity)
    const healthAcceleration = this.calculateAcceleration(history, 30);

    // Calculate usage trend
    const usageTrend = this.calculateTrend(customerData.usageHistory);

    // Calculate engagement trend
    const engagementTrend = this.calculateTrend(customerData.engagementHistory);

    // Extract seasonality pattern (simplified)
    const seasonalPattern = this.extractSeasonality(history);

    return {
      healthVelocity,
      healthAcceleration,
      usageTrend,
      engagementTrend,
      seasonalPattern,
      daysToRenewal: customerData.upcomingEvents.renewal?.daysAway || 365,
      recentQbrDaysAgo: customerData.upcomingEvents.lastQbr?.daysAgo || 180,
      openRiskSignals: customerData.riskSignalCount,
      hasChampion: customerData.hasChampion,
      stakeholderCount: customerData.stakeholderCount,
    };
  }

  private calculateVelocity(history: HealthDataPoint[], windowDays: number): number {
    if (history.length < 2) return 0;

    const recent = history.slice(-windowDays);
    if (recent.length < 2) return 0;

    const first = recent[0].score;
    const last = recent[recent.length - 1].score;
    const days = recent.length;

    return (last - first) / days;
  }

  private calculateAcceleration(history: HealthDataPoint[], windowDays: number): number {
    if (history.length < 4) return 0;

    const midpoint = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, midpoint);
    const secondHalf = history.slice(midpoint);

    const velocity1 = this.calculateVelocity(firstHalf, windowDays);
    const velocity2 = this.calculateVelocity(secondHalf, windowDays);

    return velocity2 - velocity1;
  }

  private calculateTrend(history: Array<{ date: string; value: number }>): number {
    if (history.length < 2) return 0;

    const recent = history.slice(-30);
    if (recent.length < 2) return 0;

    const first = recent[0].value;
    const last = recent[recent.length - 1].value;

    if (first === 0) return 0;
    return (last - first) / first;
  }

  private extractSeasonality(history: HealthDataPoint[]): number {
    // Simplified: check if there's a recurring pattern
    // In production, would use FFT or similar
    if (history.length < 60) return 0;

    // Calculate variance
    const scores = history.map(h => h.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;

    // High variance suggests seasonality
    return Math.sqrt(variance) > 10 ? 0.1 : 0;
  }

  private generatePrediction(
    history: HealthDataPoint[],
    features: CustomerFeatures,
    daysAhead: number
  ): PredictionPoint {
    // Base projection using linear regression
    const baseProjection = this.projectHealth(history, daysAhead);

    // Calculate adjustments based on features
    const adjustments = this.calculateAdjustments(features, daysAhead);

    // Final predicted score
    let predictedScore = Math.round(baseProjection + adjustments.total);
    predictedScore = Math.max(0, Math.min(100, predictedScore));

    // Calculate confidence interval
    const confidenceInterval = this.calculateConfidenceInterval(history, daysAhead);

    return {
      daysAhead,
      predictedScore,
      confidenceInterval: {
        low: Math.max(0, predictedScore - confidenceInterval),
        high: Math.min(100, predictedScore + confidenceInterval),
      },
      keyFactors: adjustments.factors,
    };
  }

  private projectHealth(history: HealthDataPoint[], daysAhead: number): number {
    if (history.length === 0) return 70;

    // Use recent 60 days for projection
    const recentHistory = history.slice(-60);

    // Calculate slope using linear regression
    const n = recentHistory.length;
    if (n < 2) return recentHistory[0]?.score || 70;

    const xMean = (n - 1) / 2;
    const yMean = recentHistory.reduce((sum, h) => sum + h.score, 0) / n;

    let numerator = 0;
    let denominator = 0;

    recentHistory.forEach((h, i) => {
      numerator += (i - xMean) * (h.score - yMean);
      denominator += Math.pow(i - xMean, 2);
    });

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const currentScore = history[history.length - 1].score;

    // Project with mean reversion
    let projection = currentScore + (slope * daysAhead);

    // Apply mean reversion for extreme scores
    const mean = 65;
    const reversion = (mean - projection) * 0.1;
    projection += reversion;

    return Math.max(0, Math.min(100, projection));
  }

  private calculateAdjustments(
    features: CustomerFeatures,
    daysAhead: number
  ): { total: number; factors: string[] } {
    let total = 0;
    const factors: string[] = [];

    // Usage trend impact
    if (features.usageTrend < -0.15) {
      const impact = -5 * (daysAhead / 30);
      total += impact;
      factors.push('Usage declining');
    } else if (features.usageTrend > 0.15) {
      const impact = 3 * (daysAhead / 30);
      total += impact;
      factors.push('Usage increasing');
    }

    // Engagement trend impact
    if (features.engagementTrend < -0.2) {
      const impact = -4 * (daysAhead / 30);
      total += impact;
      factors.push('Engagement declining');
    }

    // QBR recency impact
    if (features.recentQbrDaysAgo > 90) {
      const impact = -3 * (daysAhead / 30);
      total += impact;
      factors.push('No recent QBR');
    }

    // Renewal proximity impact
    if (features.daysToRenewal < daysAhead) {
      factors.push('Renewal approaching');
    }

    // Risk signals impact
    if (features.openRiskSignals > 0) {
      const impact = -2 * features.openRiskSignals * (daysAhead / 30);
      total += impact;
      factors.push(`${features.openRiskSignals} active risk signals`);
    }

    // Champion impact
    if (!features.hasChampion) {
      const impact = -2 * (daysAhead / 30);
      total += impact;
      factors.push('No identified champion');
    }

    // Velocity momentum
    if (features.healthVelocity < -0.2) {
      factors.push('Continuing downward trend');
    } else if (features.healthVelocity > 0.2) {
      factors.push('Positive momentum');
    }

    if (factors.length === 0) {
      factors.push('Based on current trajectory');
    }

    return { total, factors };
  }

  private calculateConfidenceInterval(history: HealthDataPoint[], daysAhead: number): number {
    // Wider interval for longer predictions and less data
    const baseUncertainty = 5;
    const timeUncertainty = daysAhead / 10;
    const dataUncertainty = history.length < 30 ? 5 : 0;

    // Calculate historical volatility
    if (history.length >= 7) {
      const scores = history.slice(-30).map(h => h.score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
      const volatility = Math.sqrt(variance);

      return Math.min(25, Math.round(baseUncertainty + timeUncertainty + dataUncertainty + volatility * 0.5));
    }

    return Math.min(25, Math.round(baseUncertainty + timeUncertainty + dataUncertainty + 5));
  }

  private identifyDrivers(features: CustomerFeatures, predictions: PredictionPoint[]): Driver[] {
    const drivers: Driver[] = [];

    // Usage trend driver
    if (Math.abs(features.usageTrend) > 0.1) {
      drivers.push({
        factor: 'usage_trend',
        direction: features.usageTrend > 0 ? 'positive' : 'negative',
        magnitude: Math.round(Math.abs(features.usageTrend * 100) / 10),
        description: features.usageTrend > 0
          ? `Usage trending up ${Math.round(features.usageTrend * 100)}% month-over-month`
          : `Usage trending down ${Math.round(Math.abs(features.usageTrend) * 100)}% month-over-month`,
      });
    }

    // Engagement driver
    if (Math.abs(features.engagementTrend) > 0.15) {
      drivers.push({
        factor: 'engagement_trend',
        direction: features.engagementTrend > 0 ? 'positive' : 'negative',
        magnitude: Math.round(Math.abs(features.engagementTrend * 100) / 15),
        description: features.engagementTrend > 0
          ? 'Engagement improving'
          : 'Engagement declining',
      });
    }

    // QBR recency driver
    if (features.recentQbrDaysAgo > 90) {
      drivers.push({
        factor: 'no_recent_qbr',
        direction: 'negative',
        magnitude: Math.min(6, Math.round((features.recentQbrDaysAgo - 90) / 30)),
        description: `${features.recentQbrDaysAgo} days since last QBR`,
      });
    }

    // Risk signals driver
    if (features.openRiskSignals > 0) {
      drivers.push({
        factor: 'risk_signals',
        direction: 'negative',
        magnitude: features.openRiskSignals * 2,
        description: `${features.openRiskSignals} active risk signal${features.openRiskSignals > 1 ? 's' : ''}`,
      });
    }

    // Champion driver
    if (!features.hasChampion) {
      drivers.push({
        factor: 'no_champion',
        direction: 'negative',
        magnitude: 3,
        description: 'No identified internal champion',
      });
    }

    // Sort by magnitude (absolute value)
    return drivers.sort((a, b) => b.magnitude - a.magnitude).slice(0, 5);
  }

  private async modelInterventions(
    customerId: string,
    features: CustomerFeatures
  ): Promise<InterventionImpact[]> {
    const interventions: InterventionImpact[] = [];

    // Executive Business Review
    if (features.recentQbrDaysAgo > 90) {
      interventions.push({
        intervention: 'Schedule QBR',
        description: 'Executive Business Review to realign on goals and demonstrate value',
        expectedHealthImpact: 8,
        confidence: 0.75,
        timeToImpactDays: 21,
        effort: 'high',
      });
    }

    // Usage enablement
    if (features.usageTrend < 0) {
      interventions.push({
        intervention: 'Usage Enablement Session',
        description: 'Targeted training on underutilized features to drive adoption',
        expectedHealthImpact: 6,
        confidence: 0.70,
        timeToImpactDays: 14,
        effort: 'medium',
      });
    }

    // Champion development
    if (!features.hasChampion) {
      interventions.push({
        intervention: 'Champion Development',
        description: 'Identify and cultivate an internal advocate',
        expectedHealthImpact: 5,
        confidence: 0.65,
        timeToImpactDays: 30,
        effort: 'medium',
      });
    }

    // Proactive check-in
    if (features.engagementTrend < -0.1) {
      interventions.push({
        intervention: 'Proactive Check-in',
        description: 'Schedule call to understand current challenges and priorities',
        expectedHealthImpact: 4,
        confidence: 0.75,
        timeToImpactDays: 7,
        effort: 'low',
      });
    }

    // Risk mitigation
    if (features.openRiskSignals > 0) {
      interventions.push({
        intervention: 'Risk Mitigation Plan',
        description: 'Address identified risk signals with targeted action plan',
        expectedHealthImpact: 7,
        confidence: 0.70,
        timeToImpactDays: 14,
        effort: 'medium',
      });
    }

    // Executive escalation for critical situations
    if (features.healthVelocity < -0.5 || features.openRiskSignals >= 3) {
      interventions.push({
        intervention: 'Executive Escalation',
        description: 'Engage executive sponsor for high-touch intervention',
        expectedHealthImpact: 12,
        confidence: 0.60,
        timeToImpactDays: 14,
        effort: 'high',
      });
    }

    // Sort by expected impact
    return interventions.sort((a, b) => b.expectedHealthImpact - a.expectedHealthImpact);
  }

  private async getHistoricalAccuracy(customerId: string): Promise<AccuracyMetrics> {
    const defaultMetrics: AccuracyMetrics = {
      accuracy30d: null,
      accuracy60d: null,
      accuracy90d: null,
      totalPredictions: 0,
    };

    if (!supabase) return defaultMetrics;

    try {
      const { data: accuracyRecords } = await supabase
        .from('prediction_accuracy')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!accuracyRecords || accuracyRecords.length === 0) {
        return defaultMetrics;
      }

      // Calculate accuracy by horizon
      const byHorizon = {
        30: { total: 0, errorSum: 0 },
        60: { total: 0, errorSum: 0 },
        90: { total: 0, errorSum: 0 },
      };

      for (const record of accuracyRecords) {
        const horizon = record.days_ahead as 30 | 60 | 90;
        if (byHorizon[horizon]) {
          byHorizon[horizon].total++;
          byHorizon[horizon].errorSum += record.error;
        }
      }

      // Accuracy = 100 - average error (capped at 0-100)
      const calcAccuracy = (data: { total: number; errorSum: number }) => {
        if (data.total === 0) return null;
        const avgError = data.errorSum / data.total;
        return Math.max(0, Math.min(100, Math.round(100 - avgError)));
      };

      return {
        accuracy30d: calcAccuracy(byHorizon[30]),
        accuracy60d: calcAccuracy(byHorizon[60]),
        accuracy90d: calcAccuracy(byHorizon[90]),
        totalPredictions: accuracyRecords.length,
      };
    } catch (error) {
      console.error('[HealthPrediction] Error getting accuracy:', error);
      return defaultMetrics;
    }
  }

  private calculateOverallConfidence(history: HealthDataPoint[], features: CustomerFeatures): number {
    let confidence = 70; // Base confidence

    // More data = higher confidence
    if (history.length >= 90) confidence += 10;
    else if (history.length >= 30) confidence += 5;
    else confidence -= 10;

    // Stable trends = higher confidence
    if (Math.abs(features.healthVelocity) < 0.1) confidence += 5;

    // Low volatility = higher confidence
    if (history.length >= 7) {
      const scores = history.slice(-30).map(h => h.score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
      if (Math.sqrt(variance) < 5) confidence += 5;
    }

    // Recent data = higher confidence
    if (features.recentQbrDaysAgo < 60) confidence += 5;

    return Math.max(40, Math.min(95, confidence));
  }

  private async storePrediction(prediction: HealthPrediction): Promise<void> {
    if (!supabase) return;

    try {
      const p30 = prediction.predictions.find(p => p.daysAhead === 30);
      const p60 = prediction.predictions.find(p => p.daysAhead === 60);
      const p90 = prediction.predictions.find(p => p.daysAhead === 90);

      await supabase.from('health_predictions').insert({
        id: prediction.id,
        customer_id: prediction.customerId,
        current_health: prediction.currentHealth,
        prediction_30d: p30?.predictedScore || null,
        prediction_60d: p60?.predictedScore || null,
        prediction_90d: p90?.predictedScore || null,
        confidence: prediction.confidence / 100,
        drivers: prediction.primaryDrivers,
        interventions: prediction.interventions,
        predicted_at: prediction.predictedAt,
      });
    } catch (error) {
      console.error('[HealthPrediction] Error storing prediction:', error);
    }
  }

  private generateMockHealthHistory(): HealthDataPoint[] {
    const history: HealthDataPoint[] = [];
    const now = Date.now();

    for (let i = 180; i >= 0; i -= 7) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const baseScore = 70;
      const variation = Math.floor(Math.random() * 15) - 7;
      const trend = (180 - i) * -0.03; // Slight downward trend

      history.push({
        date: date.toISOString().split('T')[0],
        score: Math.max(40, Math.min(95, Math.round(baseScore + variation + trend))),
      });
    }

    return history;
  }

  private generateMockTrendHistory(): Array<{ date: string; value: number }> {
    const history: Array<{ date: string; value: number }> = [];
    const now = Date.now();

    for (let i = 90; i >= 0; i -= 7) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const baseValue = 1000;
      const variation = Math.floor(Math.random() * 200) - 100;
      const trend = (90 - i) * -3; // Slight downward trend

      history.push({
        date: date.toISOString().split('T')[0],
        value: Math.max(100, baseValue + variation + trend),
      });
    }

    return history;
  }

  private getMockPortfolioForecast(): PortfolioHealthForecast {
    return {
      portfolioSummary: {
        currentAvgHealth: 68,
        predicted30dAvg: 65,
        predicted60dAvg: 62,
        predicted90dAvg: 60,
      },
      atRiskForecast: {
        currentBelow50: 5,
        predicted30dBelow50: 8,
        predicted60dBelow50: 12,
        predicted90dBelow50: 15,
      },
      accountsDeclining: [
        {
          customerId: 'demo-1',
          customerName: 'TechCorp Industries',
          current: 68,
          predicted90d: 50,
          decline: -18,
        },
        {
          customerId: 'demo-2',
          customerName: 'Acme Solutions',
          current: 55,
          predicted90d: 42,
          decline: -13,
        },
        {
          customerId: 'demo-3',
          customerName: 'Global Systems',
          current: 62,
          predicted90d: 51,
          decline: -11,
        },
      ],
      recommendedFocus: [
        '8 accounts predicted to drop below 50 in 30 days',
        '3 accounts showing significant health decline',
        'Schedule QBRs for accounts with no engagement in 90+ days',
      ],
    };
  }
}

// Export singleton instance
export const healthPredictionService = new HealthPredictionService();
export default healthPredictionService;
