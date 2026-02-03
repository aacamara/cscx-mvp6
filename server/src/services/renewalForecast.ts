/**
 * Renewal Pipeline Forecast Service (PRD-059)
 *
 * Provides intelligent renewal pipeline forecasts with:
 * - Predicted renewal outcomes (renew, churn, downgrade, expand)
 * - Probability scores based on multiple factors
 * - Risk level categorization
 * - Recommended actions for at-risk accounts
 * - Portfolio-wide aggregate metrics
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { ClaudeService } from './claude.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// TYPES
// ============================================

export type RenewalOutcome = 'renew' | 'churn' | 'downgrade' | 'expand';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RenewalFactor {
  name: string;
  displayName: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  value: number;
  threshold: number;
  description: string;
}

export interface RenewalPrediction {
  customerId: string;
  customerName: string;
  renewalDate: string;
  currentArr: number;
  predictedOutcome: RenewalOutcome;
  probability: number;
  riskLevel: RiskLevel;
  expectedArr: number;
  confidenceInterval: {
    low: number;
    high: number;
  };
  factors: RenewalFactor[];
  recommendedActions: string[];
  csmName: string | null;
  daysUntilRenewal: number;
  lastContactDate: string | null;
}

export interface ForecastSummary {
  totalRenewals: number;
  totalArrUpForRenewal: number;
  predictedRetentionRate: number;
  expectedRenewedArr: number;
  atRiskArr: number;
  expansionOpportunity: number;
}

export interface OutcomeBreakdown {
  outcome: string;
  accounts: number;
  arr: number;
  percentage: number;
}

export interface MonthlyBreakdown {
  month: string;
  renewals: number;
  arr: number;
  predictedRetention: number;
}

export interface RenewalPipelineForecast {
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  summary: ForecastSummary;
  byOutcome: OutcomeBreakdown[];
  predictions: RenewalPrediction[];
  monthlyBreakdown: MonthlyBreakdown[];
  criticalActions: Array<{
    customerId: string;
    customerName: string;
    arr: number;
    daysUntilRenewal: number;
    actions: string[];
  }>;
}

export interface ForecastParams {
  csmId?: string;
  horizon?: string; // '30d', '60d', '90d', 'quarter', 'year'
  segment?: string;
  riskFilter?: 'all' | 'at-risk' | 'healthy';
}

// Default factor weights from PRD
const DEFAULT_FACTOR_WEIGHTS = {
  health_score: 0.25,
  usage_trend: 0.20,
  stakeholder_engagement: 0.15,
  champion_status: 0.15,
  nps_score: 0.10,
  support_ticket_trend: 0.10,
  historical_renewal: 0.05,
};

// ============================================
// SERVICE CLASS
// ============================================

class RenewalForecastService {
  private claude: ClaudeService;

  constructor() {
    this.claude = new ClaudeService();
  }

  /**
   * Generate a comprehensive renewal pipeline forecast
   */
  async generateForecast(params: ForecastParams = {}): Promise<RenewalPipelineForecast> {
    const horizon = this.parseHorizon(params.horizon || '90d');
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + horizon * 24 * 60 * 60 * 1000);

    // Fetch all relevant data
    const [renewals, factors] = await Promise.all([
      this.fetchRenewals(startDate, endDate, params),
      this.fetchFactorWeights(),
    ]);

    // Calculate predictions for each renewal
    const predictions: RenewalPrediction[] = await Promise.all(
      renewals.map(r => this.calculatePrediction(r, factors))
    );

    // Sort by risk (critical first) then by date
    predictions.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      }
      return a.daysUntilRenewal - b.daysUntilRenewal;
    });

    // Filter by risk if specified
    let filteredPredictions = predictions;
    if (params.riskFilter === 'at-risk') {
      filteredPredictions = predictions.filter(p =>
        p.riskLevel === 'critical' || p.riskLevel === 'high'
      );
    } else if (params.riskFilter === 'healthy') {
      filteredPredictions = predictions.filter(p =>
        p.riskLevel === 'low' || p.riskLevel === 'medium'
      );
    }

    // Calculate summary metrics
    const summary = this.calculateSummary(predictions);
    const byOutcome = this.calculateOutcomeBreakdown(predictions);
    const monthlyBreakdown = this.calculateMonthlyBreakdown(predictions);
    const criticalActions = this.extractCriticalActions(predictions);

    return {
      generatedAt: new Date().toISOString(),
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      summary,
      byOutcome,
      predictions: filteredPredictions,
      monthlyBreakdown,
      criticalActions,
    };
  }

  /**
   * Get forecast for a single customer
   */
  async getCustomerForecast(customerId: string): Promise<RenewalPrediction | null> {
    if (!supabase) {
      return this.getMockPrediction(customerId);
    }

    // Fetch customer and renewal data
    const { data: customer } = await supabase
      .from('customers')
      .select('*, stakeholders(*)')
      .eq('id', customerId)
      .single();

    if (!customer) return null;

    // Fetch renewal pipeline entry
    let { data: renewal } = await supabase
      .from('renewal_pipeline')
      .select('*')
      .eq('customer_id', customerId)
      .order('renewal_date', { ascending: true })
      .limit(1)
      .single();

    // If no renewal entry, create one from customer data
    if (!renewal) {
      renewal = {
        customer_id: customerId,
        renewal_date: customer.renewal_date || customer.contract_end ||
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        current_arr: customer.arr || 0,
      };
    }

    const factors = await this.fetchFactorWeights();
    return this.calculatePrediction({ ...renewal, customer }, factors);
  }

  /**
   * Parse horizon string to days
   */
  private parseHorizon(horizon: string): number {
    const lower = horizon.toLowerCase();
    if (lower === '30d') return 30;
    if (lower === '60d') return 60;
    if (lower === '90d') return 90;
    if (lower === 'quarter') return 90;
    if (lower === 'year') return 365;
    // Try to parse number
    const match = lower.match(/(\d+)d?/);
    return match ? parseInt(match[1]) : 90;
  }

  /**
   * Fetch renewals within date range
   */
  private async fetchRenewals(
    startDate: Date,
    endDate: Date,
    params: ForecastParams
  ): Promise<any[]> {
    if (!supabase) {
      return this.getMockRenewals();
    }

    let query = supabase
      .from('customers')
      .select(`
        id,
        name,
        arr,
        health_score,
        stage,
        industry,
        renewal_date,
        contract_end,
        nps_score,
        champion_id,
        csm_id,
        stakeholders(id, name, role, email)
      `)
      .gte('renewal_date', startDate.toISOString().split('T')[0])
      .lte('renewal_date', endDate.toISOString().split('T')[0])
      .order('renewal_date', { ascending: true });

    if (params.csmId) {
      query = query.eq('csm_id', params.csmId);
    }

    if (params.segment) {
      query = query.eq('industry', params.segment);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching renewals:', error);
      return this.getMockRenewals();
    }

    // Also try to get from renewal_pipeline table for enhanced data
    const customerIds = (data || []).map(c => c.id);
    if (customerIds.length > 0) {
      const { data: pipelineData } = await supabase
        .from('renewal_pipeline')
        .select('*')
        .in('customer_id', customerIds);

      // Merge pipeline data with customer data
      const pipelineMap = new Map((pipelineData || []).map(p => [p.customer_id, p]));
      return (data || []).map(c => ({
        ...c,
        pipeline: pipelineMap.get(c.id) || null,
      }));
    }

    return data || [];
  }

  /**
   * Fetch configurable factor weights
   */
  private async fetchFactorWeights(): Promise<Map<string, { weight: number; positive: number; negative: number }>> {
    if (!supabase) {
      return new Map(Object.entries(DEFAULT_FACTOR_WEIGHTS).map(([k, v]) => [
        k,
        { weight: v, positive: 70, negative: 40 }
      ]));
    }

    const { data } = await supabase
      .from('renewal_factors')
      .select('*')
      .eq('is_active', true);

    if (!data || data.length === 0) {
      return new Map(Object.entries(DEFAULT_FACTOR_WEIGHTS).map(([k, v]) => [
        k,
        { weight: v, positive: 70, negative: 40 }
      ]));
    }

    return new Map(data.map(f => [
      f.name,
      {
        weight: f.weight,
        positive: f.positive_threshold || 70,
        negative: f.negative_threshold || 40,
      }
    ]));
  }

  /**
   * Calculate prediction for a single renewal
   */
  private async calculatePrediction(
    renewal: any,
    factorWeights: Map<string, { weight: number; positive: number; negative: number }>
  ): Promise<RenewalPrediction> {
    const customer = renewal.customer || renewal;
    const customerId = customer.id || renewal.customer_id;
    const customerName = customer.name || 'Unknown';
    const currentArr = customer.arr || renewal.current_arr || 0;
    const renewalDate = renewal.renewal_date || customer.renewal_date || customer.contract_end;
    const healthScore = customer.health_score || 70;
    const npsScore = customer.nps_score || 7;
    const hasChampion = !!customer.champion_id || (customer.stakeholders?.length > 0);

    // Calculate days until renewal
    const renewalDateObj = new Date(renewalDate);
    const daysUntilRenewal = Math.ceil(
      (renewalDateObj.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    // Calculate factor scores
    const factors = this.calculateFactorScores(
      {
        healthScore,
        usageTrend: await this.getUsageTrend(customerId),
        daysSinceContact: await this.getDaysSinceContact(customerId),
        hasChampion,
        npsScore,
        supportTicketTrend: await this.getSupportTrend(customerId),
        hasRenewedBefore: await this.hasRenewedBefore(customerId),
      },
      factorWeights
    );

    // Calculate weighted probability
    let probability = 50; // Base probability
    let positiveImpact = 0;
    let negativeImpact = 0;

    factors.forEach(factor => {
      const weighted = factor.weight * 100;
      if (factor.impact === 'positive') {
        positiveImpact += weighted;
      } else if (factor.impact === 'negative') {
        negativeImpact += weighted;
      }
    });

    probability = Math.max(5, Math.min(95, 50 + positiveImpact - negativeImpact));

    // Determine outcome and risk level
    const { outcome, riskLevel } = this.determineOutcomeAndRisk(probability, healthScore, daysUntilRenewal);

    // Calculate expected ARR
    const expectedArr = this.calculateExpectedArr(currentArr, outcome, probability);

    // Generate recommended actions
    const recommendedActions = await this.generateRecommendations(
      customerName,
      outcome,
      riskLevel,
      factors,
      daysUntilRenewal
    );

    return {
      customerId,
      customerName,
      renewalDate: renewalDateObj.toISOString().split('T')[0],
      currentArr,
      predictedOutcome: outcome,
      probability: Math.round(probability),
      riskLevel,
      expectedArr,
      confidenceInterval: {
        low: expectedArr * 0.85,
        high: expectedArr * 1.15,
      },
      factors,
      recommendedActions,
      csmName: customer.csm_name || null,
      daysUntilRenewal,
      lastContactDate: renewal.last_contact_date || null,
    };
  }

  /**
   * Calculate individual factor scores
   */
  private calculateFactorScores(
    metrics: {
      healthScore: number;
      usageTrend: number;
      daysSinceContact: number;
      hasChampion: boolean;
      npsScore: number;
      supportTicketTrend: number;
      hasRenewedBefore: boolean;
    },
    factorWeights: Map<string, { weight: number; positive: number; negative: number }>
  ): RenewalFactor[] {
    const factors: RenewalFactor[] = [];

    // Health Score
    const healthWeight = factorWeights.get('health_score') || { weight: 0.25, positive: 70, negative: 50 };
    factors.push({
      name: 'health_score',
      displayName: 'Health Score',
      value: metrics.healthScore,
      threshold: healthWeight.positive,
      weight: healthWeight.weight,
      impact: metrics.healthScore >= healthWeight.positive ? 'positive' :
              metrics.healthScore < healthWeight.negative ? 'negative' : 'neutral',
      description: metrics.healthScore >= healthWeight.positive
        ? `Strong health score of ${metrics.healthScore}/100`
        : metrics.healthScore < healthWeight.negative
        ? `Low health score of ${metrics.healthScore}/100 - needs attention`
        : `Moderate health score of ${metrics.healthScore}/100`,
    });

    // Usage Trend
    const usageWeight = factorWeights.get('usage_trend') || { weight: 0.20, positive: 0.1, negative: -0.1 };
    const usageTrendPercent = Math.round(metrics.usageTrend * 100);
    factors.push({
      name: 'usage_trend',
      displayName: 'Usage Trend',
      value: metrics.usageTrend,
      threshold: usageWeight.positive,
      weight: usageWeight.weight,
      impact: metrics.usageTrend > usageWeight.positive ? 'positive' :
              metrics.usageTrend < usageWeight.negative ? 'negative' : 'neutral',
      description: metrics.usageTrend > usageWeight.positive
        ? `Usage growing by ${usageTrendPercent}%`
        : metrics.usageTrend < usageWeight.negative
        ? `Usage declining by ${Math.abs(usageTrendPercent)}%`
        : 'Stable usage patterns',
    });

    // Stakeholder Engagement
    const engagementWeight = factorWeights.get('stakeholder_engagement') || { weight: 0.15, positive: 14, negative: 30 };
    factors.push({
      name: 'stakeholder_engagement',
      displayName: 'Stakeholder Engagement',
      value: metrics.daysSinceContact,
      threshold: engagementWeight.positive,
      weight: engagementWeight.weight,
      impact: metrics.daysSinceContact <= engagementWeight.positive ? 'positive' :
              metrics.daysSinceContact > engagementWeight.negative ? 'negative' : 'neutral',
      description: metrics.daysSinceContact <= engagementWeight.positive
        ? `Recent contact ${metrics.daysSinceContact} days ago`
        : metrics.daysSinceContact > engagementWeight.negative
        ? `No contact in ${metrics.daysSinceContact} days - reach out needed`
        : `Last contact ${metrics.daysSinceContact} days ago`,
    });

    // Champion Status
    const championWeight = factorWeights.get('champion_status') || { weight: 0.15, positive: 1, negative: 0 };
    factors.push({
      name: 'champion_status',
      displayName: 'Champion Status',
      value: metrics.hasChampion ? 1 : 0,
      threshold: 1,
      weight: championWeight.weight,
      impact: metrics.hasChampion ? 'positive' : 'negative',
      description: metrics.hasChampion
        ? 'Active champion identified'
        : 'No champion identified - risk factor',
    });

    // NPS Score
    const npsWeight = factorWeights.get('nps_score') || { weight: 0.10, positive: 8, negative: 6 };
    factors.push({
      name: 'nps_score',
      displayName: 'NPS Score',
      value: metrics.npsScore,
      threshold: npsWeight.positive,
      weight: npsWeight.weight,
      impact: metrics.npsScore >= npsWeight.positive ? 'positive' :
              metrics.npsScore < npsWeight.negative ? 'negative' : 'neutral',
      description: metrics.npsScore >= npsWeight.positive
        ? `Promoter (NPS ${metrics.npsScore})`
        : metrics.npsScore < npsWeight.negative
        ? `Detractor (NPS ${metrics.npsScore}) - immediate attention needed`
        : `Passive (NPS ${metrics.npsScore})`,
    });

    // Support Ticket Trend
    const supportWeight = factorWeights.get('support_ticket_trend') || { weight: 0.10, positive: -0.1, negative: 0.2 };
    factors.push({
      name: 'support_ticket_trend',
      displayName: 'Support Ticket Trend',
      value: metrics.supportTicketTrend,
      threshold: supportWeight.positive,
      weight: supportWeight.weight,
      impact: metrics.supportTicketTrend <= supportWeight.positive ? 'positive' :
              metrics.supportTicketTrend > supportWeight.negative ? 'negative' : 'neutral',
      description: metrics.supportTicketTrend <= supportWeight.positive
        ? 'Support tickets declining - good sign'
        : metrics.supportTicketTrend > supportWeight.negative
        ? 'Support tickets increasing - potential issues'
        : 'Stable support volume',
    });

    // Historical Renewal
    const historyWeight = factorWeights.get('historical_renewal') || { weight: 0.05, positive: 1, negative: 0 };
    factors.push({
      name: 'historical_renewal',
      displayName: 'Historical Renewal',
      value: metrics.hasRenewedBefore ? 1 : 0,
      threshold: 1,
      weight: historyWeight.weight,
      impact: metrics.hasRenewedBefore ? 'positive' : 'neutral',
      description: metrics.hasRenewedBefore
        ? 'Previously renewed - positive history'
        : 'First renewal cycle',
    });

    return factors;
  }

  /**
   * Determine outcome and risk level from probability
   */
  private determineOutcomeAndRisk(
    probability: number,
    healthScore: number,
    daysUntilRenewal: number
  ): { outcome: RenewalOutcome; riskLevel: RiskLevel } {
    // Adjust for time pressure
    const urgencyFactor = daysUntilRenewal < 30 ? 0.9 : daysUntilRenewal < 60 ? 0.95 : 1;
    const adjustedProb = probability * urgencyFactor;

    // Determine outcome
    let outcome: RenewalOutcome;
    if (adjustedProb >= 80 && healthScore >= 80) {
      outcome = 'expand';
    } else if (adjustedProb >= 50) {
      outcome = 'renew';
    } else if (adjustedProb >= 25) {
      outcome = 'downgrade';
    } else {
      outcome = 'churn';
    }

    // Determine risk level
    let riskLevel: RiskLevel;
    if (adjustedProb >= 80) {
      riskLevel = 'low';
    } else if (adjustedProb >= 50) {
      riskLevel = 'medium';
    } else if (adjustedProb >= 25) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    return { outcome, riskLevel };
  }

  /**
   * Calculate expected ARR based on outcome
   */
  private calculateExpectedArr(
    currentArr: number,
    outcome: RenewalOutcome,
    probability: number
  ): number {
    const probFactor = probability / 100;
    switch (outcome) {
      case 'expand':
        return Math.round(currentArr * 1.2 * probFactor);
      case 'renew':
        return Math.round(currentArr * probFactor);
      case 'downgrade':
        return Math.round(currentArr * 0.7 * probFactor);
      case 'churn':
        return 0;
      default:
        return Math.round(currentArr * probFactor);
    }
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateRecommendations(
    customerName: string,
    outcome: RenewalOutcome,
    riskLevel: RiskLevel,
    factors: RenewalFactor[],
    daysUntilRenewal: number
  ): Promise<string[]> {
    // Start with rule-based recommendations
    const recommendations: string[] = [];

    // Time-based urgency
    if (daysUntilRenewal <= 14) {
      recommendations.push('[URGENT] Schedule exec alignment call this week');
    } else if (daysUntilRenewal <= 30) {
      recommendations.push('Initiate renewal conversation immediately');
    } else if (daysUntilRenewal <= 60) {
      recommendations.push('Begin renewal planning and stakeholder alignment');
    }

    // Factor-based recommendations
    const negativeFactors = factors.filter(f => f.impact === 'negative');
    for (const factor of negativeFactors) {
      switch (factor.name) {
        case 'health_score':
          recommendations.push('Schedule health score deep-dive and create recovery plan');
          break;
        case 'usage_trend':
          recommendations.push('Propose usage workshop to re-engage team');
          break;
        case 'stakeholder_engagement':
          recommendations.push('Schedule check-in call with key stakeholders');
          break;
        case 'champion_status':
          recommendations.push('Identify and cultivate replacement champion from user base');
          break;
        case 'nps_score':
          recommendations.push('Address NPS feedback with focused follow-up');
          break;
        case 'support_ticket_trend':
          recommendations.push('Review open tickets and coordinate with support team');
          break;
      }
    }

    // Risk level recommendations
    if (riskLevel === 'critical') {
      recommendations.push('Escalate to CS leadership for executive intervention');
      recommendations.push('Prepare value summary document for renewal discussion');
    } else if (riskLevel === 'high') {
      recommendations.push('Increase meeting cadence to weekly');
      recommendations.push('Create save play document');
    }

    // Expansion recommendations
    if (outcome === 'expand') {
      recommendations.push('Prepare expansion proposal based on usage patterns');
      recommendations.push('Identify additional use cases for upsell discussion');
    }

    // Deduplicate and limit
    return [...new Set(recommendations)].slice(0, 5);
  }

  /**
   * Calculate summary metrics
   */
  private calculateSummary(predictions: RenewalPrediction[]): ForecastSummary {
    const totalRenewals = predictions.length;
    const totalArrUpForRenewal = predictions.reduce((sum, p) => sum + p.currentArr, 0);
    const expectedRenewedArr = predictions.reduce((sum, p) => sum + p.expectedArr, 0);
    const atRiskArr = predictions
      .filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical')
      .reduce((sum, p) => sum + p.currentArr, 0);
    const expansionOpportunity = predictions
      .filter(p => p.predictedOutcome === 'expand')
      .reduce((sum, p) => sum + (p.expectedArr - p.currentArr), 0);

    const predictedRetentionRate = totalArrUpForRenewal > 0
      ? Math.round((expectedRenewedArr / totalArrUpForRenewal) * 100)
      : 0;

    return {
      totalRenewals,
      totalArrUpForRenewal,
      predictedRetentionRate,
      expectedRenewedArr,
      atRiskArr,
      expansionOpportunity,
    };
  }

  /**
   * Calculate breakdown by outcome
   */
  private calculateOutcomeBreakdown(predictions: RenewalPrediction[]): OutcomeBreakdown[] {
    const totalArr = predictions.reduce((sum, p) => sum + p.currentArr, 0);

    const outcomes: Record<string, { accounts: number; arr: number }> = {
      'Likely Renew (>80%)': { accounts: 0, arr: 0 },
      'Possible Renew (50-80%)': { accounts: 0, arr: 0 },
      'At Risk (<50%)': { accounts: 0, arr: 0 },
    };

    predictions.forEach(p => {
      if (p.probability >= 80) {
        outcomes['Likely Renew (>80%)'].accounts++;
        outcomes['Likely Renew (>80%)'].arr += p.currentArr;
      } else if (p.probability >= 50) {
        outcomes['Possible Renew (50-80%)'].accounts++;
        outcomes['Possible Renew (50-80%)'].arr += p.currentArr;
      } else {
        outcomes['At Risk (<50%)'].accounts++;
        outcomes['At Risk (<50%)'].arr += p.currentArr;
      }
    });

    return Object.entries(outcomes).map(([outcome, data]) => ({
      outcome,
      accounts: data.accounts,
      arr: data.arr,
      percentage: totalArr > 0 ? Math.round((data.arr / totalArr) * 100) : 0,
    }));
  }

  /**
   * Calculate monthly breakdown
   */
  private calculateMonthlyBreakdown(predictions: RenewalPrediction[]): MonthlyBreakdown[] {
    const monthlyData: Record<string, { renewals: number; arr: number; expectedArr: number }> = {};

    predictions.forEach(p => {
      const date = new Date(p.renewalDate);
      const monthKey = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { renewals: 0, arr: 0, expectedArr: 0 };
      }

      monthlyData[monthKey].renewals++;
      monthlyData[monthKey].arr += p.currentArr;
      monthlyData[monthKey].expectedArr += p.expectedArr;
    });

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      renewals: data.renewals,
      arr: data.arr,
      predictedRetention: data.arr > 0 ? Math.round((data.expectedArr / data.arr) * 100) : 0,
    }));
  }

  /**
   * Extract critical actions for at-risk accounts
   */
  private extractCriticalActions(
    predictions: RenewalPrediction[]
  ): Array<{
    customerId: string;
    customerName: string;
    arr: number;
    daysUntilRenewal: number;
    actions: string[];
  }> {
    return predictions
      .filter(p => p.riskLevel === 'critical' || p.riskLevel === 'high')
      .slice(0, 10)
      .map(p => ({
        customerId: p.customerId,
        customerName: p.customerName,
        arr: p.currentArr,
        daysUntilRenewal: p.daysUntilRenewal,
        actions: p.recommendedActions,
      }));
  }

  // ============================================
  // DATA FETCHING HELPERS
  // ============================================

  private async getUsageTrend(customerId: string): Promise<number> {
    if (!supabase) return 0.05; // Slightly positive default

    try {
      const { data } = await supabase
        .from('usage_metrics')
        .select('total_events, calculated_at')
        .eq('customer_id', customerId)
        .order('calculated_at', { ascending: false })
        .limit(2);

      if (!data || data.length < 2) return 0;

      const current = data[0].total_events || 0;
      const previous = data[1].total_events || 1;
      return (current - previous) / Math.max(previous, 1);
    } catch {
      return 0;
    }
  }

  private async getDaysSinceContact(customerId: string): Promise<number> {
    if (!supabase) return 7; // Default to recent contact

    try {
      const { data } = await supabase
        .from('meetings')
        .select('scheduled_at')
        .eq('customer_id', customerId)
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .single();

      if (!data) return 60; // No meetings = 60 days

      const lastMeeting = new Date(data.scheduled_at);
      return Math.ceil((Date.now() - lastMeeting.getTime()) / (24 * 60 * 60 * 1000));
    } catch {
      return 30;
    }
  }

  private async getSupportTrend(customerId: string): Promise<number> {
    // Would integrate with support system
    // For now, return neutral
    return 0;
  }

  private async hasRenewedBefore(customerId: string): Promise<boolean> {
    if (!supabase) return true;

    try {
      const { data } = await supabase
        .from('renewal_forecast_history')
        .select('id')
        .eq('customer_id', customerId)
        .eq('actual_outcome', 'renew')
        .limit(1);

      return (data?.length || 0) > 0;
    } catch {
      return false;
    }
  }

  // ============================================
  // MOCK DATA FOR DEVELOPMENT
  // ============================================

  private getMockRenewals(): any[] {
    return [
      {
        id: 'mock-1',
        name: 'Acme Corporation',
        arr: 150000,
        health_score: 85,
        renewal_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        nps_score: 9,
        stakeholders: [{ id: '1', name: 'John Smith', role: 'VP Engineering' }],
      },
      {
        id: 'mock-2',
        name: 'Beta Inc',
        arr: 85000,
        health_score: 42,
        renewal_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        nps_score: 5,
        stakeholders: [],
      },
      {
        id: 'mock-3',
        name: 'Gamma Ltd',
        arr: 45000,
        health_score: 55,
        renewal_date: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        nps_score: 6,
        stakeholders: [{ id: '2', name: 'Jane Doe', role: 'CTO' }],
      },
      {
        id: 'mock-4',
        name: 'Delta Co',
        arr: 120000,
        health_score: 68,
        renewal_date: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        nps_score: 7,
        stakeholders: [{ id: '3', name: 'Bob Wilson', role: 'Director' }],
      },
      {
        id: 'mock-5',
        name: 'Alpha Inc',
        arr: 200000,
        health_score: 92,
        renewal_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        nps_score: 10,
        stakeholders: [{ id: '4', name: 'Sarah Chen', role: 'CEO' }],
      },
      {
        id: 'mock-6',
        name: 'Epsilon Corp',
        arr: 180000,
        health_score: 78,
        renewal_date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        nps_score: 8,
        stakeholders: [{ id: '5', name: 'Mike Johnson', role: 'VP Operations' }],
      },
    ];
  }

  private getMockPrediction(customerId: string): RenewalPrediction {
    return {
      customerId,
      customerName: 'Demo Account',
      renewalDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currentArr: 100000,
      predictedOutcome: 'renew',
      probability: 75,
      riskLevel: 'medium',
      expectedArr: 100000,
      confidenceInterval: { low: 85000, high: 115000 },
      factors: [
        {
          name: 'health_score',
          displayName: 'Health Score',
          value: 72,
          threshold: 70,
          weight: 0.25,
          impact: 'positive',
          description: 'Strong health score of 72/100',
        },
      ],
      recommendedActions: ['Begin renewal planning', 'Schedule QBR'],
      csmName: 'Demo CSM',
      daysUntilRenewal: 45,
      lastContactDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
  }
}

export const renewalForecastService = new RenewalForecastService();
