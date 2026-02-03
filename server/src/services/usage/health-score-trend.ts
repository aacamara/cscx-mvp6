/**
 * Health Score Trend Analysis Service
 *
 * PRD-060 (interpreted as Health Score Trend Analysis)
 * Combined insights from PRD-153 (Health Score Portfolio View) and PRD-170 (Trend Analysis Report)
 *
 * Provides:
 * - Historical trend analysis with forecasting
 * - Component-level breakdown trending
 * - Anomaly detection for health score changes
 * - Portfolio-level health aggregation
 * - Period-over-period comparisons
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { HealthScoreComponents } from './health-score.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ===== Type Definitions =====

export interface HealthScoreDataPoint {
  date: string;
  score: number;
  previousScore?: number;
  change: number;
  changePercent: number;
  components?: HealthScoreComponents;
}

export interface TrendDirection {
  direction: 'up' | 'down' | 'stable';
  strength: 'strong' | 'moderate' | 'weak';
  slope: number;
  description: string;
}

export interface Forecast {
  nextPeriod: number;
  confidenceLow: number;
  confidenceHigh: number;
  methodology: string;
}

export interface Anomaly {
  date: string;
  expected: number;
  actual: number;
  deviation: number;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

export interface CustomerHealthTrend {
  customerId: string;
  customerName: string;
  currentScore: number;
  category: 'healthy' | 'warning' | 'critical';
  trend: TrendDirection;
  dataPoints: HealthScoreDataPoint[];
  forecast?: Forecast;
  anomalies: Anomaly[];
  lowestComponent?: string;
  arr?: number;
  renewalDate?: string;
  daysToRenewal?: number;
}

export interface PortfolioHealthOverview {
  totalCustomers: number;
  totalArr: number;
  avgHealthScore: number;
  scoreChangeWoW: number;
  distribution: {
    healthy: { count: number; arr: number; percentage: number };
    warning: { count: number; arr: number; percentage: number };
    critical: { count: number; arr: number; percentage: number };
  };
  changes: {
    improved: number;
    declined: number;
    stable: number;
  };
  trendDirection: TrendDirection;
}

export interface PortfolioTrendData {
  date: string;
  avgScore: number;
  healthyPct: number;
  warningPct: number;
  criticalPct: number;
  totalCustomers: number;
}

export interface HealthScoreTrendAnalysis {
  overview: PortfolioHealthOverview;
  customers: CustomerHealthTrend[];
  portfolioTrend: PortfolioTrendData[];
  alerts: {
    newCritical: CustomerHealthTrend[];
    steepDeclines: CustomerHealthTrend[];
    renewalsAtRisk: CustomerHealthTrend[];
  };
  insights: TrendInsight[];
  generatedAt: string;
}

export interface TrendInsight {
  type: 'improvement' | 'decline' | 'anomaly' | 'forecast' | 'risk';
  metric: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  customerId?: string;
  customerName?: string;
}

// ===== Health Score Thresholds =====

const HEALTH_THRESHOLDS = {
  healthy: { min: 70, max: 100 },
  warning: { min: 40, max: 69 },
  critical: { min: 0, max: 39 }
};

const TREND_THRESHOLDS = {
  significantChange: 5,      // Points to consider a change significant
  steepDecline: 15,          // Points to consider a steep decline
  rapidChangeWindow: 7,      // Days for rapid change detection
  anomalyDeviation: 15       // Points deviation to flag as anomaly
};

// ===== Helper Functions =====

function categorizeHealthScore(score: number): 'healthy' | 'warning' | 'critical' {
  if (score >= HEALTH_THRESHOLDS.healthy.min) return 'healthy';
  if (score >= HEALTH_THRESHOLDS.warning.min) return 'warning';
  return 'critical';
}

function calculateTrendDirection(dataPoints: HealthScoreDataPoint[]): TrendDirection {
  if (dataPoints.length < 2) {
    return { direction: 'stable', strength: 'weak', slope: 0, description: 'Insufficient data for trend analysis' };
  }

  // Calculate simple linear regression slope
  const n = dataPoints.length;
  const xValues = dataPoints.map((_, i) => i);
  const yValues = dataPoints.map(d => d.score);

  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  // Determine direction and strength
  let direction: 'up' | 'down' | 'stable';
  let strength: 'strong' | 'moderate' | 'weak';

  if (Math.abs(slope) < 0.5) {
    direction = 'stable';
    strength = 'weak';
  } else if (slope > 0) {
    direction = 'up';
    strength = slope > 2 ? 'strong' : slope > 1 ? 'moderate' : 'weak';
  } else {
    direction = 'down';
    strength = slope < -2 ? 'strong' : slope < -1 ? 'moderate' : 'weak';
  }

  const description = direction === 'stable'
    ? 'Health score is stable'
    : `Health score is ${direction === 'up' ? 'improving' : 'declining'} (${strength} trend, ${slope > 0 ? '+' : ''}${slope.toFixed(1)} points/period)`;

  return { direction, strength, slope: Math.round(slope * 100) / 100, description };
}

function calculateForecast(dataPoints: HealthScoreDataPoint[]): Forecast | undefined {
  if (dataPoints.length < 4) return undefined;

  // Simple linear forecast
  const recentPoints = dataPoints.slice(-6);
  const avgChange = recentPoints.reduce((sum, p) => sum + p.change, 0) / recentPoints.length;
  const currentScore = dataPoints[dataPoints.length - 1].score;

  const nextPeriod = Math.max(0, Math.min(100, Math.round(currentScore + avgChange)));
  const variance = Math.sqrt(
    recentPoints.reduce((sum, p) => sum + Math.pow(p.change - avgChange, 2), 0) / recentPoints.length
  );

  return {
    nextPeriod,
    confidenceLow: Math.max(0, Math.round(nextPeriod - variance * 1.96)),
    confidenceHigh: Math.min(100, Math.round(nextPeriod + variance * 1.96)),
    methodology: 'Linear extrapolation with confidence interval'
  };
}

function detectAnomalies(dataPoints: HealthScoreDataPoint[]): Anomaly[] {
  if (dataPoints.length < 3) return [];

  const anomalies: Anomaly[] = [];

  // Calculate moving average for expected values
  for (let i = 2; i < dataPoints.length; i++) {
    const prevAvg = (dataPoints[i - 1].score + dataPoints[i - 2].score) / 2;
    const actual = dataPoints[i].score;
    const deviation = actual - prevAvg;

    if (Math.abs(deviation) >= TREND_THRESHOLDS.anomalyDeviation) {
      const severity = Math.abs(deviation) >= 25 ? 'critical' : Math.abs(deviation) >= 20 ? 'warning' : 'info';
      anomalies.push({
        date: dataPoints[i].date,
        expected: Math.round(prevAvg),
        actual,
        deviation: Math.round(deviation),
        severity,
        description: deviation > 0
          ? `Unexpected improvement of ${Math.abs(Math.round(deviation))} points`
          : `Unexpected decline of ${Math.abs(Math.round(deviation))} points`
      });
    }
  }

  return anomalies;
}

function findLowestComponent(components?: HealthScoreComponents): string | undefined {
  if (!components) return undefined;

  const entries = Object.entries(components);
  if (entries.length === 0) return undefined;

  const lowest = entries.reduce((min, [key, value]) =>
    value < min.value ? { key, value } : min
  , { key: entries[0][0], value: entries[0][1] });

  return lowest.key;
}

// ===== Main Service Functions =====

/**
 * Get health score trend for a single customer
 */
export async function getCustomerHealthTrend(
  customerId: string,
  days: number = 90
): Promise<CustomerHealthTrend | null> {
  try {
    if (!supabase) {
      // Return mock data for demo
      return generateMockCustomerTrend(customerId, days);
    }

    // Get customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, health_score, arr, renewal_date')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      return null;
    }

    // Get health score history
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { data: history, error: historyError } = await supabase
      .from('health_score_history')
      .select('calculated_at, score, previous_score, score_components')
      .eq('customer_id', customerId)
      .gte('calculated_at', cutoffDate.toISOString())
      .order('calculated_at', { ascending: true });

    if (historyError) {
      console.error('Error fetching health history:', historyError);
    }

    // Transform to data points
    const dataPoints: HealthScoreDataPoint[] = (history || []).map(h => ({
      date: h.calculated_at.split('T')[0],
      score: h.score,
      previousScore: h.previous_score,
      change: h.score - (h.previous_score || h.score),
      changePercent: h.previous_score
        ? Math.round(((h.score - h.previous_score) / h.previous_score) * 100)
        : 0,
      components: h.score_components
    }));

    // If no history, add current score as a single point
    if (dataPoints.length === 0) {
      dataPoints.push({
        date: new Date().toISOString().split('T')[0],
        score: customer.health_score || 70,
        change: 0,
        changePercent: 0
      });
    }

    const currentScore = customer.health_score || dataPoints[dataPoints.length - 1]?.score || 70;
    const trend = calculateTrendDirection(dataPoints);
    const forecast = calculateForecast(dataPoints);
    const anomalies = detectAnomalies(dataPoints);
    const lowestComponent = findLowestComponent(dataPoints[dataPoints.length - 1]?.components);

    // Calculate days to renewal
    let daysToRenewal: number | undefined;
    if (customer.renewal_date) {
      const renewal = new Date(customer.renewal_date);
      const now = new Date();
      daysToRenewal = Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      customerId: customer.id,
      customerName: customer.name,
      currentScore,
      category: categorizeHealthScore(currentScore),
      trend,
      dataPoints,
      forecast,
      anomalies,
      lowestComponent,
      arr: customer.arr,
      renewalDate: customer.renewal_date,
      daysToRenewal
    };
  } catch (error) {
    console.error('Error getting customer health trend:', error);
    return null;
  }
}

/**
 * Get portfolio-wide health score trend analysis
 */
export async function getPortfolioHealthTrendAnalysis(
  options: {
    csmId?: string;
    segment?: string;
    days?: number;
  } = {}
): Promise<HealthScoreTrendAnalysis> {
  const { days = 90 } = options;

  try {
    if (!supabase) {
      return generateMockPortfolioAnalysis(days);
    }

    // Get all customers
    let customerQuery = supabase
      .from('customers')
      .select('id, name, health_score, arr, renewal_date, stage, industry');

    if (options.segment) {
      customerQuery = customerQuery.eq('industry', options.segment);
    }

    const { data: customers, error: customersError } = await customerQuery;

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return generateMockPortfolioAnalysis(days);
    }

    if (!customers || customers.length === 0) {
      return generateMockPortfolioAnalysis(days);
    }

    // Get trends for all customers
    const customerTrends: CustomerHealthTrend[] = [];
    for (const customer of customers) {
      const trend = await getCustomerHealthTrend(customer.id, days);
      if (trend) {
        customerTrends.push(trend);
      }
    }

    // Calculate portfolio overview
    const totalCustomers = customerTrends.length;
    const totalArr = customerTrends.reduce((sum, c) => sum + (c.arr || 0), 0);
    const avgHealthScore = totalCustomers > 0
      ? Math.round(customerTrends.reduce((sum, c) => sum + c.currentScore, 0) / totalCustomers)
      : 0;

    // Calculate distribution
    const healthy = customerTrends.filter(c => c.category === 'healthy');
    const warning = customerTrends.filter(c => c.category === 'warning');
    const critical = customerTrends.filter(c => c.category === 'critical');

    // Calculate changes
    const improved = customerTrends.filter(c => c.trend.direction === 'up').length;
    const declined = customerTrends.filter(c => c.trend.direction === 'down').length;
    const stable = customerTrends.filter(c => c.trend.direction === 'stable').length;

    // Calculate week-over-week change for portfolio
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentScores = customerTrends.map(c => c.currentScore);
    const weekAgoScores = customerTrends.map(c => {
      const weekAgoPoint = c.dataPoints.find(p => p.date <= oneWeekAgo);
      return weekAgoPoint?.score || c.currentScore;
    });

    const avgCurrentScore = currentScores.reduce((a, b) => a + b, 0) / currentScores.length;
    const avgWeekAgoScore = weekAgoScores.reduce((a, b) => a + b, 0) / weekAgoScores.length;
    const scoreChangeWoW = Math.round((avgCurrentScore - avgWeekAgoScore) * 10) / 10;

    // Aggregate portfolio trend data points
    const portfolioTrend = aggregatePortfolioTrend(customerTrends, days);

    // Identify alerts
    const alerts = {
      newCritical: customerTrends.filter(c =>
        c.category === 'critical' &&
        c.dataPoints.length > 1 &&
        categorizeHealthScore(c.dataPoints[c.dataPoints.length - 2]?.score || 100) !== 'critical'
      ),
      steepDeclines: customerTrends.filter(c =>
        c.trend.direction === 'down' &&
        Math.abs(c.trend.slope) >= TREND_THRESHOLDS.steepDecline / 7
      ),
      renewalsAtRisk: customerTrends.filter(c =>
        c.daysToRenewal !== undefined &&
        c.daysToRenewal <= 90 &&
        c.category !== 'healthy'
      )
    };

    // Generate insights
    const insights = generateInsights(customerTrends, avgHealthScore, scoreChangeWoW);

    // Calculate portfolio trend direction
    const portfolioDataPoints = portfolioTrend.map(p => ({
      date: p.date,
      score: p.avgScore,
      change: 0,
      changePercent: 0
    }));
    const portfolioTrendDirection = calculateTrendDirection(portfolioDataPoints);

    const overview: PortfolioHealthOverview = {
      totalCustomers,
      totalArr,
      avgHealthScore,
      scoreChangeWoW,
      distribution: {
        healthy: {
          count: healthy.length,
          arr: healthy.reduce((sum, c) => sum + (c.arr || 0), 0),
          percentage: totalCustomers > 0 ? Math.round((healthy.length / totalCustomers) * 100) : 0
        },
        warning: {
          count: warning.length,
          arr: warning.reduce((sum, c) => sum + (c.arr || 0), 0),
          percentage: totalCustomers > 0 ? Math.round((warning.length / totalCustomers) * 100) : 0
        },
        critical: {
          count: critical.length,
          arr: critical.reduce((sum, c) => sum + (c.arr || 0), 0),
          percentage: totalCustomers > 0 ? Math.round((critical.length / totalCustomers) * 100) : 0
        }
      },
      changes: { improved, declined, stable },
      trendDirection: portfolioTrendDirection
    };

    return {
      overview,
      customers: customerTrends.sort((a, b) => a.currentScore - b.currentScore), // Sort by score ascending (worst first)
      portfolioTrend,
      alerts,
      insights,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting portfolio health trend analysis:', error);
    return generateMockPortfolioAnalysis(days);
  }
}

function aggregatePortfolioTrend(customerTrends: CustomerHealthTrend[], days: number): PortfolioTrendData[] {
  // Create a map of dates to aggregate data
  const dateMap = new Map<string, { scores: number[]; categories: string[] }>();

  customerTrends.forEach(customer => {
    customer.dataPoints.forEach(point => {
      const existing = dateMap.get(point.date) || { scores: [], categories: [] };
      existing.scores.push(point.score);
      existing.categories.push(categorizeHealthScore(point.score));
      dateMap.set(point.date, existing);
    });
  });

  // Convert to array and calculate aggregates
  const trendData: PortfolioTrendData[] = Array.from(dateMap.entries())
    .map(([date, data]) => {
      const total = data.scores.length;
      const avgScore = Math.round(data.scores.reduce((a, b) => a + b, 0) / total);
      const healthyCount = data.categories.filter(c => c === 'healthy').length;
      const warningCount = data.categories.filter(c => c === 'warning').length;
      const criticalCount = data.categories.filter(c => c === 'critical').length;

      return {
        date,
        avgScore,
        healthyPct: Math.round((healthyCount / total) * 100),
        warningPct: Math.round((warningCount / total) * 100),
        criticalPct: Math.round((criticalCount / total) * 100),
        totalCustomers: total
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return trendData;
}

function generateInsights(
  customerTrends: CustomerHealthTrend[],
  avgHealthScore: number,
  scoreChangeWoW: number
): TrendInsight[] {
  const insights: TrendInsight[] = [];

  // Portfolio-level insights
  if (scoreChangeWoW > 5) {
    insights.push({
      type: 'improvement',
      metric: 'Portfolio Health',
      description: `Portfolio health improved by ${scoreChangeWoW} points this week - strongest growth in recent period`,
      severity: 'info'
    });
  } else if (scoreChangeWoW < -5) {
    insights.push({
      type: 'decline',
      metric: 'Portfolio Health',
      description: `Portfolio health declined by ${Math.abs(scoreChangeWoW)} points this week - investigate root causes`,
      severity: 'warning'
    });
  }

  // Customer-specific insights
  const steepDeclines = customerTrends.filter(c =>
    c.trend.direction === 'down' && c.trend.strength === 'strong'
  );

  steepDeclines.forEach(customer => {
    insights.push({
      type: 'decline',
      metric: 'Customer Health',
      description: `${customer.customerName} showing steep decline (${customer.trend.slope} points/period)`,
      severity: customer.category === 'critical' ? 'critical' : 'warning',
      customerId: customer.customerId,
      customerName: customer.customerName
    });
  });

  // Anomaly insights
  customerTrends.forEach(customer => {
    customer.anomalies.filter(a => a.severity === 'critical').forEach(anomaly => {
      insights.push({
        type: 'anomaly',
        metric: 'Health Score',
        description: `${customer.customerName}: ${anomaly.description} on ${anomaly.date}`,
        severity: 'warning',
        customerId: customer.customerId,
        customerName: customer.customerName
      });
    });
  });

  // Renewal risk insights
  const renewalRisks = customerTrends.filter(c =>
    c.daysToRenewal !== undefined &&
    c.daysToRenewal <= 60 &&
    c.category !== 'healthy'
  );

  renewalRisks.forEach(customer => {
    insights.push({
      type: 'risk',
      metric: 'Renewal Risk',
      description: `${customer.customerName} renewal in ${customer.daysToRenewal} days with ${customer.category} health status`,
      severity: customer.category === 'critical' ? 'critical' : 'warning',
      customerId: customer.customerId,
      customerName: customer.customerName
    });
  });

  return insights.slice(0, 10); // Limit to top 10 insights
}

// ===== Mock Data Generators =====

function generateMockCustomerTrend(customerId: string, days: number): CustomerHealthTrend {
  const mockCustomers: Record<string, { name: string; arr: number; baseScore: number }> = {
    'demo-1': { name: 'Acme Corporation', arr: 120000, baseScore: 85 },
    'demo-2': { name: 'TechStart Inc', arr: 65000, baseScore: 45 },
    'demo-3': { name: 'GlobalTech', arr: 280000, baseScore: 78 },
    'demo-4': { name: 'DataFlow Inc', arr: 95000, baseScore: 38 },
    'demo-5': { name: 'CloudNine', arr: 150000, baseScore: 92 }
  };

  const customer = mockCustomers[customerId] || { name: 'Demo Customer', arr: 50000, baseScore: 70 };

  // Generate mock data points
  const dataPoints: HealthScoreDataPoint[] = [];
  let currentScore = customer.baseScore - 10;

  for (let i = days; i >= 0; i -= 7) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const variation = (Math.random() - 0.3) * 5;
    currentScore = Math.max(0, Math.min(100, currentScore + variation));
    const score = Math.round(currentScore);
    const previousScore = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].score : score;

    dataPoints.push({
      date,
      score,
      previousScore,
      change: score - previousScore,
      changePercent: previousScore !== 0 ? Math.round(((score - previousScore) / previousScore) * 100) : 0,
      components: {
        usage: Math.round(score + (Math.random() - 0.5) * 15),
        engagement: Math.round(score + (Math.random() - 0.5) * 20),
        risk: Math.round(100 - score + (Math.random() - 0.5) * 10),
        business: Math.round(score + (Math.random() - 0.5) * 10)
      }
    });
  }

  const finalScore = dataPoints[dataPoints.length - 1]?.score || customer.baseScore;
  const trend = calculateTrendDirection(dataPoints);
  const forecast = calculateForecast(dataPoints);
  const anomalies = detectAnomalies(dataPoints);

  return {
    customerId,
    customerName: customer.name,
    currentScore: finalScore,
    category: categorizeHealthScore(finalScore),
    trend,
    dataPoints,
    forecast,
    anomalies,
    lowestComponent: 'engagement',
    arr: customer.arr,
    renewalDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    daysToRenewal: 90
  };
}

function generateMockPortfolioAnalysis(days: number): HealthScoreTrendAnalysis {
  const customerIds = ['demo-1', 'demo-2', 'demo-3', 'demo-4', 'demo-5'];
  const customers = customerIds.map(id => generateMockCustomerTrend(id, days));

  const totalCustomers = customers.length;
  const totalArr = customers.reduce((sum, c) => sum + (c.arr || 0), 0);
  const avgHealthScore = Math.round(customers.reduce((sum, c) => sum + c.currentScore, 0) / totalCustomers);

  const healthy = customers.filter(c => c.category === 'healthy');
  const warning = customers.filter(c => c.category === 'warning');
  const critical = customers.filter(c => c.category === 'critical');

  const portfolioTrend: PortfolioTrendData[] = [];
  for (let i = days; i >= 0; i -= 7) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const avgScore = avgHealthScore + Math.round((Math.random() - 0.5) * 10);
    portfolioTrend.push({
      date,
      avgScore,
      healthyPct: 60 + Math.round((Math.random() - 0.5) * 20),
      warningPct: 25 + Math.round((Math.random() - 0.5) * 10),
      criticalPct: 15 + Math.round((Math.random() - 0.5) * 10),
      totalCustomers
    });
  }

  const portfolioDataPoints = portfolioTrend.map(p => ({
    date: p.date,
    score: p.avgScore,
    change: 0,
    changePercent: 0
  }));

  return {
    overview: {
      totalCustomers,
      totalArr,
      avgHealthScore,
      scoreChangeWoW: 3,
      distribution: {
        healthy: {
          count: healthy.length,
          arr: healthy.reduce((sum, c) => sum + (c.arr || 0), 0),
          percentage: Math.round((healthy.length / totalCustomers) * 100)
        },
        warning: {
          count: warning.length,
          arr: warning.reduce((sum, c) => sum + (c.arr || 0), 0),
          percentage: Math.round((warning.length / totalCustomers) * 100)
        },
        critical: {
          count: critical.length,
          arr: critical.reduce((sum, c) => sum + (c.arr || 0), 0),
          percentage: Math.round((critical.length / totalCustomers) * 100)
        }
      },
      changes: {
        improved: 2,
        declined: 1,
        stable: 2
      },
      trendDirection: calculateTrendDirection(portfolioDataPoints)
    },
    customers: customers.sort((a, b) => a.currentScore - b.currentScore),
    portfolioTrend,
    alerts: {
      newCritical: customers.filter(c => c.category === 'critical').slice(0, 1),
      steepDeclines: customers.filter(c => c.trend.direction === 'down' && c.trend.strength !== 'weak').slice(0, 2),
      renewalsAtRisk: customers.filter(c => c.category !== 'healthy').slice(0, 2)
    },
    insights: generateInsights(customers, avgHealthScore, 3),
    generatedAt: new Date().toISOString()
  };
}

// ===== Exports =====

export default {
  getCustomerHealthTrend,
  getPortfolioHealthTrendAnalysis
};
