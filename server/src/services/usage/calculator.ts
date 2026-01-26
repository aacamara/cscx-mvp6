/**
 * Usage Metrics Calculator
 *
 * Calculates DAU, WAU, MAU and other usage metrics from raw events.
 * Triggers health score recalculation when significant changes detected.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { recalculateHealthScore } from './health-score.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export interface UsageEvent {
  event_type: string;
  event_name?: string;
  user_id?: string;
  user_email?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface UsageMetrics {
  dau: number;
  wau: number;
  mau: number;
  totalEvents: number;
  totalLogins: number;
  uniqueFeaturesUsed: number;
  featureBreakdown: Record<string, number>;
  apiCalls: number;
  periodStart: string;
  periodEnd: string;
}

export interface IngestResult {
  ingested: number;
  customerId: string;
  metricsUpdated: boolean;
  healthScoreUpdated: boolean;
  newHealthScore?: number;
}

/**
 * Ingest usage events for a customer
 */
export async function ingestUsageEvents(
  customerId: string,
  events: UsageEvent[]
): Promise<IngestResult> {
  if (!supabase) {
    console.warn('Supabase not configured, using mock ingestion');
    return {
      ingested: events.length,
      customerId,
      metricsUpdated: false,
      healthScoreUpdated: false,
    };
  }

  // Insert events into database
  const eventRecords = events.map(event => ({
    customer_id: customerId,
    event_type: event.event_type,
    event_name: event.event_name || event.event_type,
    user_id: event.user_id,
    user_email: event.user_email,
    metadata: event.metadata || {},
    timestamp: event.timestamp || new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('usage_events')
    .insert(eventRecords)
    .select();

  if (error) {
    console.error('Failed to ingest events:', error);
    throw new Error(`Failed to ingest events: ${error.message}`);
  }

  // Recalculate metrics
  const metricsUpdated = await recalculateMetrics(customerId);

  // Recalculate health score
  let healthScoreUpdated = false;
  let newHealthScore: number | undefined;

  if (metricsUpdated) {
    const healthResult = await recalculateHealthScore(customerId);
    if (healthResult) {
      healthScoreUpdated = true;
      newHealthScore = healthResult.score;
    }
  }

  return {
    ingested: data?.length || 0,
    customerId,
    metricsUpdated,
    healthScoreUpdated,
    newHealthScore,
  };
}

/**
 * Recalculate usage metrics for a customer based on their events
 */
export async function recalculateMetrics(customerId: string): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    // Fetch events for the last 30 days
    const { data: events, error } = await supabase
      .from('usage_events')
      .select('*')
      .eq('customer_id', customerId)
      .gte('timestamp', thirtyDaysAgo.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Failed to fetch events:', error);
      return false;
    }

    if (!events || events.length === 0) {
      return false;
    }

    // Calculate DAU (unique users today)
    const todayStr = today.toISOString().split('T')[0];
    const todayEvents = events.filter(e =>
      e.timestamp.split('T')[0] === todayStr
    );
    const dau = new Set(todayEvents.map(e => e.user_id || e.user_email || 'anonymous')).size;

    // Calculate WAU (unique users in last 7 days)
    const weekEvents = events.filter(e =>
      new Date(e.timestamp) >= oneWeekAgo
    );
    const wau = new Set(weekEvents.map(e => e.user_id || e.user_email || 'anonymous')).size;

    // Calculate MAU (unique users in last 30 days)
    const mau = new Set(events.map(e => e.user_id || e.user_email || 'anonymous')).size;

    // Count event types
    const totalEvents = events.length;
    const totalLogins = events.filter(e => e.event_type === 'login').length;
    const apiCalls = events.filter(e => e.event_type === 'api_call').length;

    // Feature breakdown
    const featureBreakdown: Record<string, number> = {};
    events.filter(e => e.event_type === 'feature_used').forEach(e => {
      const feature = e.event_name || e.metadata?.feature || 'unknown';
      featureBreakdown[feature] = (featureBreakdown[feature] || 0) + 1;
    });

    const uniqueFeaturesUsed = Object.keys(featureBreakdown).length;

    // Upsert metrics
    const periodStart = thirtyDaysAgo.toISOString().split('T')[0];
    const periodEnd = today.toISOString().split('T')[0];

    const { error: upsertError } = await supabase
      .from('usage_metrics')
      .upsert({
        customer_id: customerId,
        period_start: periodStart,
        period_end: periodEnd,
        dau,
        wau,
        mau,
        total_events: totalEvents,
        total_logins: totalLogins,
        unique_features_used: uniqueFeaturesUsed,
        feature_breakdown: featureBreakdown,
        api_calls: apiCalls,
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'customer_id,period_start,period_end',
      });

    if (upsertError) {
      console.error('Failed to upsert metrics:', upsertError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error calculating metrics:', err);
    return false;
  }
}

/**
 * Get current usage metrics for a customer
 */
export async function getUsageMetrics(customerId: string): Promise<UsageMetrics | null> {
  if (!supabase) {
    // Return mock data when Supabase not configured
    return {
      dau: 45,
      wau: 120,
      mau: 350,
      totalEvents: 5420,
      totalLogins: 890,
      uniqueFeaturesUsed: 12,
      featureBreakdown: {
        'dashboard': 1200,
        'reports': 850,
        'analytics': 720,
        'integrations': 340,
        'settings': 210,
      },
      apiCalls: 2100,
      periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      periodEnd: new Date().toISOString().split('T')[0],
    };
  }

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('customer_id', customerId)
    .gte('period_end', thirtyDaysAgo.toISOString().split('T')[0])
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    dau: data.dau,
    wau: data.wau,
    mau: data.mau,
    totalEvents: data.total_events,
    totalLogins: data.total_logins,
    uniqueFeaturesUsed: data.unique_features_used,
    featureBreakdown: data.feature_breakdown || {},
    apiCalls: data.api_calls,
    periodStart: data.period_start,
    periodEnd: data.period_end,
  };
}

/**
 * Get usage trend (compare current vs previous period)
 */
export async function getUsageTrend(
  customerId: string,
  days: number = 30
): Promise<{ current: UsageMetrics | null; percentChange: number }> {
  const current = await getUsageMetrics(customerId);

  if (!current || !supabase) {
    return { current, percentChange: 0 };
  }

  // Get previous period metrics
  const today = new Date();
  const periodStart = new Date(today.getTime() - (days * 2) * 24 * 60 * 60 * 1000);
  const periodEnd = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

  const { data: previousData } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('customer_id', customerId)
    .gte('period_start', periodStart.toISOString().split('T')[0])
    .lte('period_end', periodEnd.toISOString().split('T')[0])
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  if (!previousData) {
    return { current, percentChange: 0 };
  }

  // Calculate percentage change in total events
  const prevEvents = previousData.total_events || 1;
  const percentChange = Math.round(((current.totalEvents - prevEvents) / prevEvents) * 100);

  return { current, percentChange };
}

/**
 * Count unique users in a time range
 */
export function countUniqueUsers(
  events: Array<{ user_id?: string; user_email?: string; timestamp: string }>,
  range: 'today' | 'last7days' | 'last30days'
): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let cutoff: Date;
  switch (range) {
    case 'today':
      cutoff = today;
      break;
    case 'last7days':
      cutoff = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last30days':
    default:
      cutoff = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const filtered = events.filter(e => new Date(e.timestamp) >= cutoff);
  const uniqueUsers = new Set(filtered.map(e => e.user_id || e.user_email || 'anonymous'));

  return uniqueUsers.size;
}

export default {
  ingestUsageEvents,
  recalculateMetrics,
  getUsageMetrics,
  getUsageTrend,
  countUniqueUsers,
};
