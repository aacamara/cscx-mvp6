/**
 * Health Score Calculator
 *
 * Calculates customer health scores based on:
 * - Usage metrics (40% weight)
 * - Engagement (30% weight)
 * - Support/Risk signals (20% weight)
 * - Contract/Business factors (10% weight)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export interface HealthScoreComponents {
  usage: number;        // 0-100 based on DAU/WAU/MAU trends
  engagement: number;   // 0-100 based on feature adoption
  risk: number;         // 0-100 based on support tickets, NPS
  business: number;     // 0-100 based on contract value, renewal proximity
}

export interface HealthScoreResult {
  score: number;
  previousScore: number | null;
  components: HealthScoreComponents;
  trend: 'improving' | 'stable' | 'declining';
  riskSignals: string[];
}

// Weights for each component
const WEIGHTS = {
  usage: 0.40,
  engagement: 0.30,
  risk: 0.20,
  business: 0.10,
};

/**
 * Recalculate health score for a customer based on all available data
 */
export async function recalculateHealthScore(
  customerId: string,
  reason: string = 'event_trigger'
): Promise<HealthScoreResult | null> {
  try {
    // Get usage component score
    const usageScore = await calculateUsageScore(customerId);

    // Get engagement component score
    const engagementScore = await calculateEngagementScore(customerId);

    // Get risk component score
    const riskScore = await calculateRiskScore(customerId);

    // Get business component score
    const businessScore = await calculateBusinessScore(customerId);

    const components: HealthScoreComponents = {
      usage: usageScore,
      engagement: engagementScore,
      risk: riskScore,
      business: businessScore,
    };

    // Calculate weighted score
    const score = Math.round(
      components.usage * WEIGHTS.usage +
      components.engagement * WEIGHTS.engagement +
      components.risk * WEIGHTS.risk +
      components.business * WEIGHTS.business
    );

    // Get previous score for comparison
    const previousScore = await getPreviousHealthScore(customerId);

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (previousScore !== null) {
      const diff = score - previousScore;
      if (diff > 5) trend = 'improving';
      else if (diff < -5) trend = 'declining';
    }

    // Identify risk signals
    const riskSignals = identifyRiskSignals(components, score);

    // Save to history
    await saveHealthScore(customerId, score, previousScore, components, reason);

    // Update customer's current health score
    await updateCustomerHealthScore(customerId, score);

    return {
      score,
      previousScore,
      components,
      trend,
      riskSignals,
    };
  } catch (err) {
    console.error('Error calculating health score:', err);
    return null;
  }
}

/**
 * Calculate usage component score (0-100)
 */
async function calculateUsageScore(customerId: string): Promise<number> {
  if (!supabase) {
    return 75; // Default mock score
  }

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

  // Base score from DAU/MAU ratio (healthy is 20%+)
  const dauMauRatio = current.mau > 0 ? (current.dau / current.mau) : 0;
  let score = Math.min(100, Math.round(dauMauRatio * 400)); // 25% ratio = 100 score

  // Adjust based on trend
  if (previous) {
    const eventTrend = (current.total_events - previous.total_events) / Math.max(previous.total_events, 1);
    if (eventTrend > 0.1) score = Math.min(100, score + 10);
    else if (eventTrend < -0.2) score = Math.max(0, score - 15);
  }

  // Bonus for feature diversity
  const featureCount = current.unique_features_used || 0;
  if (featureCount >= 10) score = Math.min(100, score + 5);
  else if (featureCount <= 3) score = Math.max(0, score - 5);

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate engagement component score (0-100)
 */
async function calculateEngagementScore(customerId: string): Promise<number> {
  if (!supabase) {
    return 70; // Default mock score
  }

  // Get recent events to measure engagement patterns
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data: events } = await supabase
    .from('usage_events')
    .select('timestamp, event_type, user_id')
    .eq('customer_id', customerId)
    .gte('timestamp', thirtyDaysAgo.toISOString())
    .order('timestamp', { ascending: true });

  if (!events || events.length === 0) {
    return 40; // No recent engagement
  }

  // Calculate days with activity in last 30 days
  const activeDays = new Set(events.map(e => e.timestamp.split('T')[0])).size;
  const activityRatio = activeDays / 30;

  // Base score from activity frequency
  let score = Math.round(activityRatio * 80); // 100% = 80 points

  // Bonus for consistent activity (low variance between weeks)
  const weeklyActivity = [0, 0, 0, 0];
  events.forEach(e => {
    const daysSince = Math.floor((Date.now() - new Date(e.timestamp).getTime()) / (24 * 60 * 60 * 1000));
    const weekIndex = Math.min(3, Math.floor(daysSince / 7));
    weeklyActivity[weekIndex]++;
  });

  const avgWeekly = weeklyActivity.reduce((a, b) => a + b, 0) / 4;
  const variance = weeklyActivity.reduce((sum, w) => sum + Math.pow(w - avgWeekly, 2), 0) / 4;
  const consistency = Math.max(0, 20 - Math.sqrt(variance) / 2);

  score += consistency;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate risk component score (0-100, higher = lower risk)
 */
async function calculateRiskScore(customerId: string): Promise<number> {
  if (!supabase) {
    return 80; // Default mock score (low risk)
  }

  let score = 100; // Start with no risk

  // Check for support tickets (if table exists)
  // For now, use usage decline as risk signal
  const { data: metrics } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('customer_id', customerId)
    .order('calculated_at', { ascending: false })
    .limit(2);

  if (metrics && metrics.length >= 2) {
    const current = metrics[0];
    const previous = metrics[1];

    // Usage decline is a risk signal
    const eventDecline = (previous.total_events - current.total_events) / Math.max(previous.total_events, 1);
    if (eventDecline > 0.3) score -= 30; // >30% decline
    else if (eventDecline > 0.15) score -= 15; // >15% decline

    // DAU decline is concerning
    const dauDecline = (previous.dau - current.dau) / Math.max(previous.dau, 1);
    if (dauDecline > 0.5) score -= 25;
    else if (dauDecline > 0.25) score -= 10;
  }

  // Check for long periods of no activity
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { count } = await supabase
    .from('usage_events')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .gte('timestamp', lastWeek.toISOString());

  if (count === 0) {
    score -= 20; // No activity in last week
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate business component score (0-100)
 */
async function calculateBusinessScore(customerId: string): Promise<number> {
  if (!supabase) {
    return 85; // Default mock score
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('arr, renewal_date, stage')
    .eq('id', customerId)
    .single();

  if (!customer) {
    return 50;
  }

  let score = 70; // Base score

  // ARR impact (higher ARR = more stable, but also more important)
  const arr = customer.arr || 0;
  if (arr >= 100000) score += 10;
  else if (arr >= 50000) score += 5;
  else if (arr < 10000) score -= 5;

  // Renewal proximity (closer = more attention needed but not necessarily bad)
  if (customer.renewal_date) {
    const daysToRenewal = Math.floor(
      (new Date(customer.renewal_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    if (daysToRenewal <= 30) score += 5; // Active renewal attention
    else if (daysToRenewal <= 60) score += 10;
    else if (daysToRenewal > 180) score += 15;
  }

  // Stage impact
  if (customer.stage === 'at_risk') score -= 15;
  else if (customer.stage === 'onboarding') score -= 5;
  else if (customer.stage === 'active') score += 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Get the previous health score for comparison
 */
async function getPreviousHealthScore(customerId: string): Promise<number | null> {
  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from('health_score_history')
    .select('score')
    .eq('customer_id', customerId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  return data?.score || null;
}

/**
 * Save health score to history
 */
async function saveHealthScore(
  customerId: string,
  score: number,
  previousScore: number | null,
  components: HealthScoreComponents,
  reason: string
): Promise<void> {
  if (!supabase) {
    return;
  }

  await supabase.from('health_score_history').insert({
    customer_id: customerId,
    score,
    previous_score: previousScore,
    score_components: components,
    calculation_reason: reason,
    calculated_at: new Date().toISOString(),
  });
}

/**
 * Update customer's current health score
 */
async function updateCustomerHealthScore(customerId: string, score: number): Promise<void> {
  if (!supabase) {
    return;
  }

  await supabase
    .from('customers')
    .update({ health_score: score, updated_at: new Date().toISOString() })
    .eq('id', customerId);
}

/**
 * Identify specific risk signals from the components
 */
function identifyRiskSignals(components: HealthScoreComponents, totalScore: number): string[] {
  const signals: string[] = [];

  if (components.usage < 40) {
    signals.push('Low product usage detected');
  }
  if (components.engagement < 40) {
    signals.push('Declining engagement patterns');
  }
  if (components.risk < 50) {
    signals.push('Multiple risk indicators present');
  }
  if (components.business < 40) {
    signals.push('Business factors require attention');
  }
  if (totalScore < 50) {
    signals.push('Overall health critical - immediate action needed');
  } else if (totalScore < 65) {
    signals.push('Health trending down - proactive outreach recommended');
  }

  return signals;
}

/**
 * Get health score history for trending
 */
export async function getHealthScoreHistory(
  customerId: string,
  days: number = 90
): Promise<Array<{ date: string; score: number }>> {
  if (!supabase) {
    // Return mock trend data
    const history = [];
    const now = Date.now();
    for (let i = days; i >= 0; i -= 7) {
      history.push({
        date: new Date(now - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        score: 70 + Math.floor(Math.random() * 20) - 10,
      });
    }
    return history;
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from('health_score_history')
    .select('calculated_at, score')
    .eq('customer_id', customerId)
    .gte('calculated_at', cutoff.toISOString())
    .order('calculated_at', { ascending: true });

  return (data || []).map(d => ({
    date: d.calculated_at.split('T')[0],
    score: d.score,
  }));
}

export default {
  recalculateHealthScore,
  getHealthScoreHistory,
};
