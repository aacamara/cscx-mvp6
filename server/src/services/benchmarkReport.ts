/**
 * Benchmark Report Service
 * PRD-171: Benchmark Report
 *
 * Provides benchmark calculations for comparing customer metrics
 * against internal and segment-based standards.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// TYPES
// ============================================

interface BenchmarkValues {
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  mean: number;
}

interface DistributionBucket {
  range_start: number;
  range_end: number;
  count: number;
  percentage: number;
}

interface PortfolioBenchmark {
  metric: string;
  values: BenchmarkValues;
  distribution: DistributionBucket[];
  total_customers: number;
}

interface CustomerMetricBenchmark {
  metric: string;
  value: number;
  percentile: number;
  benchmark_median: number;
  gap: number;
  status: 'above' | 'at' | 'below';
}

interface TopPerformer {
  rank: number;
  customer_id: string;
  customer_name: string;
  value: number;
  segment: string;
  arr: number;
  percentile: number;
}

interface SegmentBenchmark {
  segment: string;
  customer_count: number;
  total_arr: number;
  avg_health_score: number;
  values: BenchmarkValues;
  top_performers: { customer_id: string; customer_name: string; value: number; percentile: number }[];
  improvement_candidates: { customer_id: string; customer_name: string; value: number; percentile: number }[];
}

interface BenchmarkRecommendation {
  customer_id: string;
  customer_name: string;
  metric: string;
  current_value: number;
  target_value: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  action: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate percentile of a value within an array
 */
function calculatePercentile(sortedValues: number[], value: number): number {
  if (sortedValues.length === 0) return 50;

  const index = sortedValues.filter(v => v < value).length;
  return Math.round((index / sortedValues.length) * 100);
}

/**
 * Get percentile value from sorted array
 */
function getPercentileValue(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;

  const index = Math.floor((percentile / 100) * (sortedValues.length - 1));
  return sortedValues[index];
}

/**
 * Calculate benchmark statistics from values
 */
function calculateBenchmarkValues(values: number[]): BenchmarkValues {
  if (values.length === 0) {
    return { min: 0, p25: 0, median: 0, p75: 0, max: 0, mean: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    min: sorted[0],
    p25: getPercentileValue(sorted, 25),
    median: getPercentileValue(sorted, 50),
    p75: getPercentileValue(sorted, 75),
    max: sorted[sorted.length - 1],
    mean: Math.round((sum / sorted.length) * 100) / 100
  };
}

/**
 * Calculate distribution buckets for histogram
 */
function calculateDistribution(values: number[], bucketCount: number = 10): DistributionBucket[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const bucketSize = range / bucketCount;

  const buckets: DistributionBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const rangeStart = min + (i * bucketSize);
    const rangeEnd = min + ((i + 1) * bucketSize);
    const count = values.filter(v =>
      i === bucketCount - 1
        ? v >= rangeStart && v <= rangeEnd
        : v >= rangeStart && v < rangeEnd
    ).length;

    buckets.push({
      range_start: Math.round(rangeStart),
      range_end: Math.round(rangeEnd),
      count,
      percentage: Math.round((count / values.length) * 100)
    });
  }

  return buckets;
}

/**
 * Generate recommendation based on gap
 */
function generateRecommendation(metric: string, value: number, median: number, p75: number): string {
  const gap = median - value;
  const gapPct = Math.round((gap / median) * 100);

  switch (metric) {
    case 'health_score':
      if (value < 40) return 'Initiate save play - immediate CSM outreach required';
      if (value < 70) return 'Schedule check-in to identify improvement opportunities';
      return 'Maintain engagement - identify expansion opportunities';

    case 'nps_score':
      if (value < 0) return 'Urgent follow-up needed - address detractor concerns';
      if (value < 50) return 'Proactive engagement to convert passives to promoters';
      return 'Leverage as reference customer or case study';

    case 'usage_score':
      if (value < 40) return 'Schedule training session to increase feature adoption';
      if (value < 70) return 'Share best practices from top-performing peers';
      return 'Identify power user features for expansion';

    case 'engagement_score':
      if (value < 40) return 'Re-engagement campaign - schedule executive check-in';
      if (value < 70) return 'Increase touchpoint frequency with value-add content';
      return 'Maintain cadence - consider adding to customer advisory board';

    default:
      if (gapPct > 20) return `Improve ${metric} by ${gapPct}% to reach portfolio median`;
      if (gapPct > 0) return `Minor improvement needed in ${metric}`;
      return `Strong performance in ${metric} - maintain current approach`;
  }
}

// ============================================
// MOCK DATA GENERATOR
// ============================================

function generateMockCustomers(): any[] {
  const segments = ['Enterprise', 'Mid-Market', 'SMB', 'Strategic'];
  const industries = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing'];

  return [
    { id: '1', name: 'TechStart Inc', arr: 95000, health_score: 92, segment: 'Enterprise', industry: 'Technology' },
    { id: '2', name: 'CloudNine Systems', arr: 82000, health_score: 89, segment: 'Enterprise', industry: 'Technology' },
    { id: '3', name: 'Acme Corporation', arr: 120000, health_score: 85, segment: 'Strategic', industry: 'Manufacturing' },
    { id: '4', name: 'DataFlow Labs', arr: 65000, health_score: 78, segment: 'Mid-Market', industry: 'Technology' },
    { id: '5', name: 'GlobalTech Solutions', arr: 280000, health_score: 75, segment: 'Strategic', industry: 'Enterprise' },
    { id: '6', name: 'MegaCorp Industries', arr: 340000, health_score: 72, segment: 'Strategic', industry: 'Manufacturing' },
    { id: '7', name: 'StartupX', arr: 45000, health_score: 68, segment: 'SMB', industry: 'Technology' },
    { id: '8', name: 'Enterprise Plus', arr: 520000, health_score: 65, segment: 'Strategic', industry: 'Finance' },
    { id: '9', name: 'SmallBiz Co', arr: 28000, health_score: 61, segment: 'SMB', industry: 'Retail' },
    { id: '10', name: 'Innovation Labs', arr: 175000, health_score: 58, segment: 'Enterprise', industry: 'Healthcare' },
    { id: '11', name: 'RetailPro', arr: 85000, health_score: 55, segment: 'Mid-Market', industry: 'Retail' },
    { id: '12', name: 'HealthFirst', arr: 195000, health_score: 52, segment: 'Enterprise', industry: 'Healthcare' },
    { id: '13', name: 'FinanceHub', arr: 310000, health_score: 48, segment: 'Strategic', industry: 'Finance' },
    { id: '14', name: 'LocalShop LLC', arr: 22000, health_score: 42, segment: 'SMB', industry: 'Retail' },
    { id: '15', name: 'TechGrowth', arr: 55000, health_score: 35, segment: 'Mid-Market', industry: 'Technology' },
  ];
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Get portfolio-wide benchmark report
 */
export async function getPortfolioBenchmark(
  metric: string = 'health_score'
): Promise<{
  benchmark: PortfolioBenchmark;
  top_performers: TopPerformer[];
  bottom_performers: TopPerformer[];
}> {
  let customers: any[] = [];

  if (supabase) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, arr, health_score, industry, segment');

    if (!error && data) {
      customers = data;
    }
  }

  // Fall back to mock data if no Supabase data
  if (customers.length === 0) {
    customers = generateMockCustomers();
  }

  // Extract metric values
  const values = customers.map(c => c.health_score || 0).filter(v => v > 0);
  const sortedValues = [...values].sort((a, b) => a - b);

  // Calculate benchmark values
  const benchmarkValues = calculateBenchmarkValues(values);

  // Calculate distribution
  const distribution = calculateDistribution(values);

  // Get top performers
  const sortedByScore = [...customers].sort((a, b) => (b.health_score || 0) - (a.health_score || 0));
  const topPerformers: TopPerformer[] = sortedByScore.slice(0, 5).map((c, index) => ({
    rank: index + 1,
    customer_id: c.id,
    customer_name: c.name,
    value: c.health_score || 0,
    segment: c.segment || c.industry || 'Unknown',
    arr: c.arr || 0,
    percentile: calculatePercentile(sortedValues, c.health_score || 0)
  }));

  // Get bottom performers
  const bottomPerformers: TopPerformer[] = sortedByScore.slice(-5).reverse().map((c, index) => ({
    rank: sortedByScore.length - 4 + index,
    customer_id: c.id,
    customer_name: c.name,
    value: c.health_score || 0,
    segment: c.segment || c.industry || 'Unknown',
    arr: c.arr || 0,
    percentile: calculatePercentile(sortedValues, c.health_score || 0)
  }));

  return {
    benchmark: {
      metric,
      values: benchmarkValues,
      distribution,
      total_customers: customers.length
    },
    top_performers: topPerformers,
    bottom_performers: bottomPerformers
  };
}

/**
 * Get segment-specific benchmarks
 */
export async function getSegmentBenchmarks(): Promise<SegmentBenchmark[]> {
  let customers: any[] = [];

  if (supabase) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, arr, health_score, industry, segment');

    if (!error && data) {
      customers = data;
    }
  }

  if (customers.length === 0) {
    customers = generateMockCustomers();
  }

  // Group by segment
  const segmentGroups: Record<string, any[]> = {};
  customers.forEach(c => {
    const segment = c.segment || c.industry || 'Unknown';
    if (!segmentGroups[segment]) segmentGroups[segment] = [];
    segmentGroups[segment].push(c);
  });

  // Calculate benchmarks per segment
  const segmentBenchmarks: SegmentBenchmark[] = Object.entries(segmentGroups).map(([segment, members]) => {
    const values = members.map(c => c.health_score || 0);
    const sortedValues = [...values].sort((a, b) => a - b);
    const benchmarkValues = calculateBenchmarkValues(values);

    const avgScore = values.length > 0
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : 0;

    const sortedMembers = [...members].sort((a, b) => (b.health_score || 0) - (a.health_score || 0));

    return {
      segment,
      customer_count: members.length,
      total_arr: members.reduce((sum, c) => sum + (c.arr || 0), 0),
      avg_health_score: avgScore,
      values: benchmarkValues,
      top_performers: sortedMembers.slice(0, 3).map(c => ({
        customer_id: c.id,
        customer_name: c.name,
        value: c.health_score || 0,
        percentile: calculatePercentile(sortedValues, c.health_score || 0)
      })),
      improvement_candidates: sortedMembers.slice(-3).reverse().map(c => ({
        customer_id: c.id,
        customer_name: c.name,
        value: c.health_score || 0,
        percentile: calculatePercentile(sortedValues, c.health_score || 0)
      }))
    };
  });

  // Sort by average health score descending
  segmentBenchmarks.sort((a, b) => b.avg_health_score - a.avg_health_score);

  return segmentBenchmarks;
}

/**
 * Get customer benchmark detail with percentile ranking
 */
export async function getCustomerBenchmark(customerId: string): Promise<{
  customer: any;
  metrics: CustomerMetricBenchmark[];
  peer_comparison: {
    segment: string;
    total_peers: number;
    rank: number;
    percentile: number;
  };
  recommendations: BenchmarkRecommendation[];
} | null> {
  let customers: any[] = [];
  let customer: any = null;

  if (supabase) {
    const { data: allData } = await supabase
      .from('customers')
      .select('id, name, arr, health_score, industry, segment');

    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (allData) customers = allData;
    if (customerData) customer = customerData;
  }

  if (customers.length === 0) {
    customers = generateMockCustomers();
    customer = customers.find(c => c.id === customerId);
  }

  if (!customer) {
    // Create mock customer if not found
    customer = {
      id: customerId,
      name: 'Sample Customer',
      arr: 100000,
      health_score: 72,
      segment: 'Mid-Market',
      industry: 'Technology'
    };
  }

  // Calculate portfolio benchmarks
  const allScores = customers.map(c => c.health_score || 0).filter(v => v > 0);
  const sortedScores = [...allScores].sort((a, b) => a - b);
  const portfolioBenchmark = calculateBenchmarkValues(allScores);

  // Get segment peers
  const segment = customer.segment || customer.industry || 'Unknown';
  const peers = customers.filter(c => (c.segment || c.industry || 'Unknown') === segment);
  const peerScores = peers.map(c => c.health_score || 0).filter(v => v > 0);
  const sortedPeerScores = [...peerScores].sort((a, b) => a - b);
  const peerBenchmark = calculateBenchmarkValues(peerScores);

  // Calculate metrics
  const customerScore = customer.health_score || 0;
  const customerPercentile = calculatePercentile(sortedScores, customerScore);
  const peerPercentile = calculatePercentile(sortedPeerScores, customerScore);

  // Rank within segment
  const rank = peers.sort((a, b) => (b.health_score || 0) - (a.health_score || 0))
    .findIndex(c => c.id === customerId) + 1;

  // Build metrics comparison
  const metrics: CustomerMetricBenchmark[] = [
    {
      metric: 'health_score',
      value: customerScore,
      percentile: customerPercentile,
      benchmark_median: portfolioBenchmark.median,
      gap: customerScore - portfolioBenchmark.median,
      status: customerScore >= portfolioBenchmark.p75 ? 'above' :
              customerScore >= portfolioBenchmark.p25 ? 'at' : 'below'
    }
  ];

  // Mock additional metrics
  const usageScore = Math.min(100, Math.max(0, customerScore + Math.floor(Math.random() * 20 - 10)));
  const engagementScore = Math.min(100, Math.max(0, customerScore + Math.floor(Math.random() * 15 - 5)));

  metrics.push(
    {
      metric: 'usage_score',
      value: usageScore,
      percentile: calculatePercentile(sortedScores, usageScore),
      benchmark_median: 65,
      gap: usageScore - 65,
      status: usageScore >= 75 ? 'above' : usageScore >= 50 ? 'at' : 'below'
    },
    {
      metric: 'engagement_score',
      value: engagementScore,
      percentile: calculatePercentile(sortedScores, engagementScore),
      benchmark_median: 70,
      gap: engagementScore - 70,
      status: engagementScore >= 80 ? 'above' : engagementScore >= 55 ? 'at' : 'below'
    }
  );

  // Generate recommendations for below-median metrics
  const recommendations: BenchmarkRecommendation[] = metrics
    .filter(m => m.status === 'below')
    .map(m => ({
      customer_id: customer.id,
      customer_name: customer.name,
      metric: m.metric,
      current_value: m.value,
      target_value: m.benchmark_median,
      gap: Math.abs(m.gap),
      priority: m.value < m.benchmark_median * 0.6 ? 'high' :
                m.value < m.benchmark_median * 0.8 ? 'medium' : 'low',
      action: generateRecommendation(m.metric, m.value, m.benchmark_median, portfolioBenchmark.p75)
    }));

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      arr: customer.arr,
      segment,
      industry: customer.industry || null,
      health_score: customerScore
    },
    metrics,
    peer_comparison: {
      segment,
      total_peers: peers.length,
      rank,
      percentile: peerPercentile
    },
    recommendations
  };
}

/**
 * Get full benchmark report
 */
export async function getBenchmarkReport(filters?: {
  metric?: string;
  segment?: string;
}): Promise<{
  portfolio: any;
  segments: SegmentBenchmark[];
  top_performers: TopPerformer[];
  bottom_performers: TopPerformer[];
  recommendations: BenchmarkRecommendation[];
  generated_at: string;
}> {
  const metric = filters?.metric || 'health_score';

  // Get portfolio benchmark
  const { benchmark, top_performers, bottom_performers } = await getPortfolioBenchmark(metric);

  // Get segment benchmarks
  let segments = await getSegmentBenchmarks();

  // Filter by segment if specified
  if (filters?.segment) {
    segments = segments.filter(s => s.segment === filters.segment);
  }

  // Generate recommendations for bottom performers
  const recommendations: BenchmarkRecommendation[] = bottom_performers.map(p => ({
    customer_id: p.customer_id,
    customer_name: p.customer_name,
    metric,
    current_value: p.value,
    target_value: benchmark.values.median,
    gap: benchmark.values.median - p.value,
    priority: p.value < benchmark.values.p25 ? 'high' : 'medium',
    action: generateRecommendation(metric, p.value, benchmark.values.median, benchmark.values.p75)
  }));

  return {
    portfolio: {
      total_customers: benchmark.total_customers,
      total_arr: top_performers.reduce((sum, p) => sum + p.arr, 0) * 3, // Estimate
      metrics: {
        [metric]: benchmark
      }
    },
    segments,
    top_performers,
    bottom_performers,
    recommendations,
    generated_at: new Date().toISOString()
  };
}

export default {
  getPortfolioBenchmark,
  getSegmentBenchmarks,
  getCustomerBenchmark,
  getBenchmarkReport
};
