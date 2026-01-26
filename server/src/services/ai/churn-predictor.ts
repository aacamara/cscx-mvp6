/**
 * Churn Prediction Service
 *
 * Predicts customer churn risk using multiple signals:
 * - Usage metrics and trends
 * - Engagement patterns
 * - Stakeholder health
 * - Support interactions
 * - Business factors
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RiskSignal {
  type: string;
  severity: RiskSeverity;
  detail: string;
  weight: number;
  recommendation?: string;
}

export interface ChurnPrediction {
  probability: number; // 0-100
  confidence: 'low' | 'medium' | 'high';
  riskLevel: RiskSeverity;
  signals: RiskSignal[];
  recommendedActions: string[];
  arrAtRisk: number;
  daysToRenewal?: number;
  scoreBreakdown: {
    usage: number;
    engagement: number;
    stakeholder: number;
    business: number;
    support: number;
  };
}

// Weights for risk calculation
const RISK_WEIGHTS = {
  usage: 0.30,       // Usage patterns
  engagement: 0.25,  // Engagement frequency
  stakeholder: 0.20, // Stakeholder health
  business: 0.15,    // Business factors
  support: 0.10,     // Support interactions
};

/**
 * Predict churn risk for a customer
 */
export async function predictChurnRisk(customerId: string): Promise<ChurnPrediction> {
  const customer = await getCustomerData(customerId);
  const arr = customer?.arr || 0;

  // Calculate component scores (higher = healthier, lower = more risk)
  const usageScore = await calculateUsageScore(customerId);
  const engagementScore = await calculateEngagementScore(customerId);
  const stakeholderScore = await assessStakeholderHealth(customerId);
  const businessScore = await calculateBusinessScore(customerId, customer);
  const supportScore = await calculateSupportScore(customerId);

  const scores = {
    usage: usageScore,
    engagement: engagementScore,
    stakeholder: stakeholderScore,
    business: businessScore,
    support: supportScore,
  };

  // Collect risk signals
  const signals = collectRiskSignals(scores, customer);

  // Calculate overall health score (inverse of risk)
  const healthScore =
    scores.usage * RISK_WEIGHTS.usage +
    scores.engagement * RISK_WEIGHTS.engagement +
    scores.stakeholder * RISK_WEIGHTS.stakeholder +
    scores.business * RISK_WEIGHTS.business +
    scores.support * RISK_WEIGHTS.support;

  // Convert to churn probability (inverse relationship)
  const churnProbability = Math.max(5, Math.min(95, Math.round(100 - healthScore)));

  // Determine risk level
  const riskLevel = determineRiskLevel(churnProbability);

  // Calculate confidence based on data availability
  const confidence = calculateConfidence(scores, signals);

  // Generate recommendations
  const recommendedActions = generateRecommendations(signals, riskLevel, customer);

  // Calculate days to renewal
  let daysToRenewal: number | undefined;
  if (customer?.renewal_date) {
    daysToRenewal = Math.ceil(
      (new Date(customer.renewal_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
  }

  return {
    probability: churnProbability,
    confidence,
    riskLevel,
    signals,
    recommendedActions,
    arrAtRisk: riskLevel === 'high' || riskLevel === 'critical' ? arr : 0,
    daysToRenewal,
    scoreBreakdown: scores,
  };
}

/**
 * Calculate usage-based risk score (0-100, higher = healthier)
 */
async function calculateUsageScore(customerId: string): Promise<number> {
  if (!supabase) {
    return 65; // Default moderate score
  }

  try {
    // Get usage metrics
    const { data: metrics } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('calculated_at', { ascending: false })
      .limit(2);

    if (!metrics || metrics.length === 0) {
      return 50; // No data, neutral score
    }

    const current = metrics[0];
    const previous = metrics[1];

    let score = 60; // Base score

    // DAU/MAU ratio (stickiness)
    const dauMauRatio = current.mau > 0 ? current.dau / current.mau : 0;
    if (dauMauRatio >= 0.25) score += 20;
    else if (dauMauRatio >= 0.15) score += 10;
    else if (dauMauRatio < 0.05) score -= 15;

    // Usage trend
    if (previous) {
      const eventTrend = (current.total_events - previous.total_events) / Math.max(previous.total_events, 1);
      if (eventTrend > 0.1) score += 15;
      else if (eventTrend < -0.2) score -= 20;
      else if (eventTrend < -0.1) score -= 10;
    }

    // Feature diversity
    if (current.unique_features_used >= 8) score += 10;
    else if (current.unique_features_used <= 2) score -= 10;

    return Math.max(0, Math.min(100, score));
  } catch (error) {
    console.error('Error calculating usage score:', error);
    return 50;
  }
}

/**
 * Calculate engagement-based risk score (0-100, higher = healthier)
 */
async function calculateEngagementScore(customerId: string): Promise<number> {
  if (!supabase) {
    return 60;
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Count active days
    const { data: events } = await supabase
      .from('usage_events')
      .select('timestamp')
      .eq('customer_id', customerId)
      .gte('timestamp', thirtyDaysAgo.toISOString());

    if (!events || events.length === 0) {
      return 20; // No recent engagement
    }

    // Calculate active days
    const activeDays = new Set(events.map(e => e.timestamp.split('T')[0])).size;
    const activityRatio = activeDays / 30;

    let score = Math.round(activityRatio * 70); // Max 70 from activity

    // Check for consistent engagement (low variance between weeks)
    const weeklyActivity = [0, 0, 0, 0];
    events.forEach(e => {
      const daysSince = Math.floor(
        (Date.now() - new Date(e.timestamp).getTime()) / (24 * 60 * 60 * 1000)
      );
      const weekIndex = Math.min(3, Math.floor(daysSince / 7));
      weeklyActivity[weekIndex]++;
    });

    const avgWeekly = weeklyActivity.reduce((a, b) => a + b, 0) / 4;
    const variance = weeklyActivity.reduce((sum, w) => sum + Math.pow(w - avgWeekly, 2), 0) / 4;

    // Consistency bonus (up to 30 points)
    const consistencyBonus = Math.max(0, 30 - Math.sqrt(variance));
    score += consistencyBonus;

    return Math.max(0, Math.min(100, Math.round(score)));
  } catch (error) {
    console.error('Error calculating engagement score:', error);
    return 50;
  }
}

/**
 * Assess stakeholder health (0-100, higher = healthier)
 */
async function assessStakeholderHealth(customerId: string): Promise<number> {
  if (!supabase) {
    return 70;
  }

  let score = 70; // Base score

  try {
    // Check for champion
    const { data: contract } = await supabase
      .from('contracts')
      .select('extracted_data')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (contract?.extracted_data) {
      const data = contract.extracted_data as { stakeholders?: Array<{ role?: string; name?: string }> };
      const stakeholders = data.stakeholders || [];

      // Has identified stakeholders
      if (stakeholders.length > 0) {
        score += 10;
      }

      // Has executive sponsor
      const hasExec = stakeholders.some(s =>
        s.role?.toLowerCase().includes('exec') ||
        s.role?.toLowerCase().includes('vp') ||
        s.role?.toLowerCase().includes('director')
      );
      if (hasExec) score += 10;

      // Has technical champion
      const hasTech = stakeholders.some(s =>
        s.role?.toLowerCase().includes('tech') ||
        s.role?.toLowerCase().includes('admin')
      );
      if (hasTech) score += 5;
    } else {
      // No stakeholder data is a risk
      score -= 15;
    }
  } catch (error) {
    console.error('Error assessing stakeholder health:', error);
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate business-based risk score (0-100, higher = healthier)
 */
async function calculateBusinessScore(
  customerId: string,
  customer: Record<string, unknown> | null
): Promise<number> {
  let score = 70; // Base score

  if (!customer) return score;

  // ARR impact (higher ARR = more stable typically)
  const arr = (customer.arr as number) || 0;
  if (arr >= 100000) score += 10;
  else if (arr >= 50000) score += 5;
  else if (arr < 10000) score -= 10;

  // Health score impact
  const healthScore = (customer.health_score as number) || 70;
  if (healthScore >= 80) score += 10;
  else if (healthScore < 50) score -= 20;
  else if (healthScore < 65) score -= 10;

  // Stage impact
  const stage = customer.stage as string;
  if (stage === 'at_risk') score -= 20;
  else if (stage === 'churning') score -= 40;
  else if (stage === 'active') score += 5;

  // Renewal proximity
  if (customer.renewal_date) {
    const daysToRenewal = Math.ceil(
      (new Date(customer.renewal_date as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    if (daysToRenewal <= 30) {
      // High scrutiny period
      score -= 5;
    } else if (daysToRenewal > 180) {
      // Plenty of time
      score += 5;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate support-based risk score (0-100, higher = healthier)
 */
async function calculateSupportScore(customerId: string): Promise<number> {
  // For now, return a neutral score
  // In a full implementation, this would query support ticket data
  return 75;
}

/**
 * Collect specific risk signals from the scores
 */
function collectRiskSignals(
  scores: Record<string, number>,
  customer: Record<string, unknown> | null
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Usage signals
  if (scores.usage < 40) {
    signals.push({
      type: 'usage_decline',
      severity: 'high',
      detail: 'Significant decrease in product usage detected',
      weight: 25,
      recommendation: 'Schedule urgent check-in to understand blockers',
    });
  } else if (scores.usage < 60) {
    signals.push({
      type: 'usage_low',
      severity: 'medium',
      detail: 'Below-average product usage patterns',
      weight: 15,
      recommendation: 'Offer targeted training on underutilized features',
    });
  }

  // Engagement signals
  if (scores.engagement < 30) {
    signals.push({
      type: 'disengagement',
      severity: 'critical',
      detail: 'Very low engagement - customer may be inactive',
      weight: 30,
      recommendation: 'Escalate immediately - executive outreach recommended',
    });
  } else if (scores.engagement < 50) {
    signals.push({
      type: 'low_engagement',
      severity: 'medium',
      detail: 'Inconsistent engagement patterns detected',
      weight: 15,
      recommendation: 'Increase touchpoint frequency',
    });
  }

  // Stakeholder signals
  if (scores.stakeholder < 50) {
    signals.push({
      type: 'stakeholder_risk',
      severity: 'high',
      detail: 'No identified champion or weak stakeholder relationships',
      weight: 20,
      recommendation: 'Prioritize relationship building with key contacts',
    });
  }

  // Business signals
  if (customer?.stage === 'at_risk') {
    signals.push({
      type: 'at_risk_stage',
      severity: 'high',
      detail: 'Customer marked as at-risk',
      weight: 25,
      recommendation: 'Execute save play immediately',
    });
  }

  const healthScore = (customer?.health_score as number) || 70;
  if (healthScore < 50) {
    signals.push({
      type: 'low_health',
      severity: 'critical',
      detail: `Health score critically low: ${healthScore}/100`,
      weight: 30,
      recommendation: 'Immediate intervention required',
    });
  }

  // Renewal proximity
  if (customer?.renewal_date) {
    const daysToRenewal = Math.ceil(
      (new Date(customer.renewal_date as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    if (daysToRenewal <= 30 && healthScore < 70) {
      signals.push({
        type: 'renewal_at_risk',
        severity: 'critical',
        detail: `Renewal in ${daysToRenewal} days with below-average health`,
        weight: 35,
        recommendation: 'Urgent renewal discussion needed',
      });
    } else if (daysToRenewal <= 60 && healthScore < 60) {
      signals.push({
        type: 'renewal_warning',
        severity: 'high',
        detail: `Renewal in ${daysToRenewal} days with poor health`,
        weight: 25,
        recommendation: 'Start renewal playbook immediately',
      });
    }
  }

  return signals.sort((a, b) => b.weight - a.weight);
}

/**
 * Determine overall risk level from probability
 */
function determineRiskLevel(probability: number): RiskSeverity {
  if (probability >= 75) return 'critical';
  if (probability >= 50) return 'high';
  if (probability >= 25) return 'medium';
  return 'low';
}

/**
 * Calculate confidence in the prediction
 */
function calculateConfidence(
  scores: Record<string, number>,
  signals: RiskSignal[]
): 'low' | 'medium' | 'high' {
  // More signals = higher confidence
  if (signals.length >= 3) return 'high';
  if (signals.length >= 1) return 'medium';

  // Check if we have good data coverage
  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / 5;
  if (avgScore > 40 && avgScore < 60) return 'low'; // Uncertain middle ground

  return 'medium';
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  signals: RiskSignal[],
  riskLevel: RiskSeverity,
  customer: Record<string, unknown> | null
): string[] {
  const recommendations: string[] = [];

  // Add signal-specific recommendations
  signals.slice(0, 3).forEach(signal => {
    if (signal.recommendation) {
      recommendations.push(signal.recommendation);
    }
  });

  // Add level-based recommendations
  switch (riskLevel) {
    case 'critical':
      recommendations.push('Schedule executive escalation meeting within 48 hours');
      recommendations.push('Prepare value summary for immediate delivery');
      break;
    case 'high':
      recommendations.push('Increase meeting cadence to weekly');
      recommendations.push('Create save play document');
      break;
    case 'medium':
      recommendations.push('Schedule proactive check-in call');
      recommendations.push('Review success plan and update goals');
      break;
    case 'low':
      recommendations.push('Continue regular touchpoint cadence');
      recommendations.push('Look for expansion opportunities');
      break;
  }

  // Deduplicate and limit
  return [...new Set(recommendations)].slice(0, 5);
}

/**
 * Get customer data from database
 */
async function getCustomerData(customerId: string): Promise<Record<string, unknown> | null> {
  if (!supabase) {
    return {
      health_score: 65,
      arr: 75000,
      stage: 'active',
      renewal_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  return data;
}

/**
 * Get batch predictions for multiple customers
 */
export async function predictChurnBatch(
  customerIds: string[]
): Promise<Map<string, ChurnPrediction>> {
  const results = new Map<string, ChurnPrediction>();

  // Process in parallel with concurrency limit
  const batchSize = 5;
  for (let i = 0; i < customerIds.length; i += batchSize) {
    const batch = customerIds.slice(i, i + batchSize);
    const predictions = await Promise.all(
      batch.map(id => predictChurnRisk(id).then(pred => ({ id, pred })))
    );

    predictions.forEach(({ id, pred }) => results.set(id, pred));
  }

  return results;
}

/**
 * Get customers sorted by churn risk
 */
export async function getHighRiskCustomers(limit: number = 10): Promise<
  Array<{
    customerId: string;
    customerName: string;
    prediction: ChurnPrediction;
  }>
> {
  if (!supabase) {
    return [];
  }

  // Get customers with low health scores
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, health_score')
    .order('health_score', { ascending: true })
    .limit(limit * 2);

  if (!customers) return [];

  // Get predictions for each
  const results = await Promise.all(
    customers.map(async c => ({
      customerId: c.id,
      customerName: c.name,
      prediction: await predictChurnRisk(c.id),
    }))
  );

  // Sort by churn probability and return top N
  return results
    .sort((a, b) => b.prediction.probability - a.prediction.probability)
    .slice(0, limit);
}

export default {
  predictChurnRisk,
  predictChurnBatch,
  getHighRiskCustomers,
};
