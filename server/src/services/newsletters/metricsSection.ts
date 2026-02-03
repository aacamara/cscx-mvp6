/**
 * Newsletter Metrics Section Generator
 * PRD-045: Quarterly Newsletter Personalization
 *
 * Generates customer-specific metrics sections for newsletters
 * by aggregating data from usage metrics, health scores, and activity logs
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import type { NewsletterCustomerMetrics, NewsletterMetricsSection } from '../../../../types/newsletter.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export interface MetricsSectionConfig {
  includeTimeSaved?: boolean;
  includeNps?: boolean;
  includeCustomMetrics?: boolean;
  customMetricNames?: string[];
  comparisonPeriod?: 'quarter' | 'month' | 'year';
}

/**
 * Generate customer metrics for newsletter
 * Fetches and calculates metrics from the database
 */
export async function generateCustomerMetrics(
  customerId: string,
  quarter: string,
  year: number,
  config?: MetricsSectionConfig
): Promise<NewsletterCustomerMetrics> {
  if (!supabase) {
    // Return mock data if database not configured
    return getMockMetrics();
  }

  try {
    // Get current quarter date range
    const { startDate, endDate } = getQuarterDateRange(quarter, year);
    const { startDate: prevStartDate, endDate: prevEndDate } = getPreviousQuarterDateRange(
      quarter,
      year
    );

    // Fetch current quarter metrics
    const currentMetrics = await fetchQuarterMetrics(customerId, startDate, endDate);

    // Fetch previous quarter metrics for comparison
    const previousMetrics = await fetchQuarterMetrics(customerId, prevStartDate, prevEndDate);

    // Get current customer data
    const { data: customer } = await supabase
      .from('customers')
      .select('health_score, nps_score')
      .eq('id', customerId)
      .single();

    // Calculate changes
    const healthScore = customer?.health_score || currentMetrics.avgHealthScore || 70;
    const healthScoreChange = healthScore - (previousMetrics.avgHealthScore || healthScore);

    const activeUsers = currentMetrics.activeUsers || 0;
    const prevActiveUsers = previousMetrics.activeUsers || activeUsers;
    const activeUsersChange =
      prevActiveUsers > 0 ? Math.round(((activeUsers - prevActiveUsers) / prevActiveUsers) * 100) : 0;

    const featureAdoption = currentMetrics.featureAdoption || 50;
    const prevFeatureAdoption = previousMetrics.featureAdoption || featureAdoption;
    const featureAdoptionChange = featureAdoption - prevFeatureAdoption;

    // Determine health trend
    let healthTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (healthScoreChange > 5) healthTrend = 'improving';
    else if (healthScoreChange < -5) healthTrend = 'declining';

    const metrics: NewsletterCustomerMetrics = {
      healthScore,
      healthScoreChange,
      healthTrend,
      activeUsers,
      activeUsersChange,
      featureAdoption,
      featureAdoptionChange,
    };

    // Add optional metrics
    if (config?.includeTimeSaved && currentMetrics.timeSaved) {
      metrics.timeSaved = currentMetrics.timeSaved;
      const prevTimeSaved = previousMetrics.timeSaved || currentMetrics.timeSaved;
      metrics.timeSavedChange =
        prevTimeSaved > 0
          ? Math.round(((currentMetrics.timeSaved - prevTimeSaved) / prevTimeSaved) * 100)
          : 0;
    }

    if (config?.includeNps && customer?.nps_score !== null) {
      metrics.npsScore = customer.nps_score;
    }

    return metrics;
  } catch (error) {
    console.error('Error generating customer metrics:', error);
    return getMockMetrics();
  }
}

/**
 * Format metrics into a displayable section
 */
export function formatMetricsSection(
  metrics: NewsletterCustomerMetrics,
  customerName: string,
  quarter: string
): NewsletterMetricsSection {
  const formattedMetrics: NewsletterMetricsSection['metrics'] = [];

  // Health Score
  formattedMetrics.push({
    label: 'Health Score',
    value: metrics.healthScore,
    change: metrics.healthScoreChange,
    changeLabel: `${metrics.healthScoreChange > 0 ? '+' : ''}${metrics.healthScoreChange} points`,
    trend: metrics.healthScoreChange > 0 ? 'up' : metrics.healthScoreChange < 0 ? 'down' : 'stable',
  });

  // Active Users
  formattedMetrics.push({
    label: 'Active Users',
    value: metrics.activeUsers,
    change: metrics.activeUsersChange,
    changeLabel: `${metrics.activeUsersChange > 0 ? '+' : ''}${metrics.activeUsersChange}%`,
    trend: metrics.activeUsersChange > 0 ? 'up' : metrics.activeUsersChange < 0 ? 'down' : 'stable',
  });

  // Feature Adoption
  formattedMetrics.push({
    label: 'Feature Adoption',
    value: `${metrics.featureAdoption}%`,
    change: metrics.featureAdoptionChange,
    changeLabel: `${metrics.featureAdoptionChange > 0 ? '+' : ''}${metrics.featureAdoptionChange}%`,
    trend:
      metrics.featureAdoptionChange > 0
        ? 'up'
        : metrics.featureAdoptionChange < 0
        ? 'down'
        : 'stable',
  });

  // Time Saved (optional)
  if (metrics.timeSaved !== undefined) {
    formattedMetrics.push({
      label: 'Time Saved',
      value: `${metrics.timeSaved} hrs/month`,
      change: metrics.timeSavedChange,
      changeLabel: `${metrics.timeSavedChange && metrics.timeSavedChange > 0 ? '+' : ''}${metrics.timeSavedChange || 0}%`,
      trend:
        metrics.timeSavedChange && metrics.timeSavedChange > 0
          ? 'up'
          : metrics.timeSavedChange && metrics.timeSavedChange < 0
          ? 'down'
          : 'stable',
    });
  }

  // NPS Score (optional)
  if (metrics.npsScore !== undefined) {
    formattedMetrics.push({
      label: 'NPS Score',
      value: metrics.npsScore,
      trend: 'stable',
    });
  }

  // Custom metrics
  if (metrics.customMetrics) {
    for (const [key, data] of Object.entries(metrics.customMetrics)) {
      formattedMetrics.push({
        label: data.label,
        value: data.value,
        change: data.change,
        changeLabel: data.change
          ? `${data.change > 0 ? '+' : ''}${data.change}%`
          : undefined,
        trend: data.change ? (data.change > 0 ? 'up' : data.change < 0 ? 'down' : 'stable') : 'stable',
      });
    }
  }

  return {
    title: `Your ${quarter} ${customerName} Snapshot`,
    metrics: formattedMetrics,
  };
}

// ============================================
// Helper Functions
// ============================================

async function fetchQuarterMetrics(
  customerId: string,
  startDate: string,
  endDate: string
): Promise<{
  avgHealthScore: number;
  activeUsers: number;
  featureAdoption: number;
  timeSaved?: number;
}> {
  if (!supabase) {
    return { avgHealthScore: 70, activeUsers: 100, featureAdoption: 65 };
  }

  try {
    // Fetch usage metrics for the period
    const { data: usageMetrics } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .gte('metric_date', startDate)
      .lte('metric_date', endDate)
      .order('metric_date', { ascending: false });

    if (!usageMetrics || usageMetrics.length === 0) {
      return { avgHealthScore: 70, activeUsers: 100, featureAdoption: 65 };
    }

    // Calculate averages
    const healthScores = usageMetrics
      .map((m: any) => m.health_score)
      .filter((s: any) => s !== null && s !== undefined);
    const avgHealthScore =
      healthScores.length > 0
        ? Math.round(healthScores.reduce((a: number, b: number) => a + b, 0) / healthScores.length)
        : 70;

    // Get latest active users count
    const latestMetric = usageMetrics[0];
    const activeUsers = latestMetric.active_users || latestMetric.daily_active_users || 100;

    // Calculate feature adoption (example calculation)
    const featureAdoption = latestMetric.feature_adoption_rate || 65;

    // Calculate time saved if available
    const timeSaved = latestMetric.time_saved_hours;

    return {
      avgHealthScore,
      activeUsers,
      featureAdoption,
      timeSaved,
    };
  } catch (error) {
    console.error('Error fetching quarter metrics:', error);
    return { avgHealthScore: 70, activeUsers: 100, featureAdoption: 65 };
  }
}

function getQuarterDateRange(quarter: string, year: number): { startDate: string; endDate: string } {
  const quarterNum = parseInt(quarter.replace('Q', ''));
  const startMonth = (quarterNum - 1) * 3;
  const endMonth = startMonth + 2;

  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth + 1, 0); // Last day of end month

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

function getPreviousQuarterDateRange(
  quarter: string,
  year: number
): { startDate: string; endDate: string } {
  const quarterNum = parseInt(quarter.replace('Q', ''));
  let prevQuarter = quarterNum - 1;
  let prevYear = year;

  if (prevQuarter === 0) {
    prevQuarter = 4;
    prevYear = year - 1;
  }

  return getQuarterDateRange(`Q${prevQuarter}`, prevYear);
}

function getMockMetrics(): NewsletterCustomerMetrics {
  return {
    healthScore: 84,
    healthScoreChange: 6,
    healthTrend: 'improving',
    activeUsers: 127,
    activeUsersChange: 15,
    featureAdoption: 78,
    featureAdoptionChange: 8,
    timeSaved: 340,
    timeSavedChange: 12,
  };
}

export const metricsService = {
  generateCustomerMetrics,
  formatMetricsSection,
};

export default metricsService;
