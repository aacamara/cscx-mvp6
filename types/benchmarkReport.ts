/**
 * Benchmark Report Types
 * PRD-171: Benchmark Report
 *
 * Type definitions for benchmark reporting, percentile rankings,
 * and customer comparisons against internal and segment standards.
 */

// ============================================
// BENCHMARK VALUE TYPES
// ============================================

export interface BenchmarkValues {
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  mean: number;
}

export interface Benchmark {
  metric: string;
  segment?: string;
  values: BenchmarkValues;
  top_performers: string[]; // customer_ids
  bottom_performers: string[];
  sample_size: number;
}

// ============================================
// CUSTOMER BENCHMARK TYPES
// ============================================

export interface CustomerBenchmark {
  customer_id: string;
  customer_name: string;
  metric: string;
  value: number;
  percentile: number;
  gap_to_median: number;
  gap_to_top: number;
  recommendation: string;
}

export interface CustomerBenchmarkSummary {
  customer_id: string;
  customer_name: string;
  arr: number;
  segment: string;
  health_score: number;
  overall_percentile: number;
  metrics: CustomerMetricBenchmark[];
  strengths: string[];
  improvement_areas: string[];
}

export interface CustomerMetricBenchmark {
  metric: string;
  value: number;
  percentile: number;
  benchmark_median: number;
  gap: number;
  status: 'above' | 'at' | 'below';
}

// ============================================
// BENCHMARK METRIC CONFIGURATION
// ============================================

export type BenchmarkMetricType =
  | 'health_score'
  | 'nps_score'
  | 'arr'
  | 'usage_score'
  | 'engagement_score'
  | 'sentiment_score'
  | 'days_to_renewal'
  | 'ticket_count'
  | 'feature_adoption'
  | 'time_to_value';

export interface BenchmarkMetricConfig {
  id: BenchmarkMetricType;
  name: string;
  description: string;
  higher_is_better: boolean;
  unit: 'score' | 'percentage' | 'currency' | 'days' | 'count';
}

export const BENCHMARK_METRIC_CONFIGS: BenchmarkMetricConfig[] = [
  { id: 'health_score', name: 'Health Score', description: 'Overall health score', higher_is_better: true, unit: 'score' },
  { id: 'nps_score', name: 'NPS Score', description: 'Net Promoter Score', higher_is_better: true, unit: 'score' },
  { id: 'arr', name: 'ARR', description: 'Annual Recurring Revenue', higher_is_better: true, unit: 'currency' },
  { id: 'usage_score', name: 'Usage Score', description: 'Product usage intensity', higher_is_better: true, unit: 'score' },
  { id: 'engagement_score', name: 'Engagement Score', description: 'Customer engagement level', higher_is_better: true, unit: 'score' },
  { id: 'sentiment_score', name: 'Sentiment Score', description: 'Overall sentiment', higher_is_better: true, unit: 'score' },
  { id: 'days_to_renewal', name: 'Days to Renewal', description: 'Days until contract renewal', higher_is_better: false, unit: 'days' },
  { id: 'ticket_count', name: 'Support Tickets', description: 'Open support tickets', higher_is_better: false, unit: 'count' },
  { id: 'feature_adoption', name: 'Feature Adoption', description: 'Percentage of features used', higher_is_better: true, unit: 'percentage' },
  { id: 'time_to_value', name: 'Time to Value', description: 'Days to achieve value', higher_is_better: false, unit: 'days' },
];

// ============================================
// PORTFOLIO BENCHMARK TYPES
// ============================================

export interface PortfolioBenchmark {
  metric: string;
  values: BenchmarkValues;
  distribution: DistributionBucket[];
  total_customers: number;
}

export interface DistributionBucket {
  range_start: number;
  range_end: number;
  count: number;
  percentage: number;
}

// ============================================
// SEGMENT BENCHMARK TYPES
// ============================================

export interface SegmentBenchmark {
  segment: string;
  customer_count: number;
  total_arr: number;
  metrics: {
    [key in BenchmarkMetricType]?: BenchmarkValues;
  };
  top_performers: SegmentPerformer[];
  improvement_candidates: SegmentPerformer[];
}

export interface SegmentPerformer {
  customer_id: string;
  customer_name: string;
  value: number;
  percentile: number;
}

// ============================================
// TOP PERFORMERS TYPES
// ============================================

export interface TopPerformer {
  rank: number;
  customer_id: string;
  customer_name: string;
  value: number;
  segment: string;
  arr: number;
  percentile: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface BenchmarkReportResponse {
  portfolio: PortfolioBenchmarkSummary;
  segments: SegmentBenchmark[];
  top_performers: TopPerformer[];
  bottom_performers: TopPerformer[];
  recommendations: BenchmarkRecommendation[];
  generated_at: string;
}

export interface PortfolioBenchmarkSummary {
  total_customers: number;
  total_arr: number;
  metrics: {
    health_score: PortfolioBenchmark;
    nps_score?: PortfolioBenchmark;
    usage_score?: PortfolioBenchmark;
    engagement_score?: PortfolioBenchmark;
  };
}

export interface BenchmarkRecommendation {
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
// CUSTOMER BENCHMARK DETAIL
// ============================================

export interface CustomerBenchmarkDetail {
  customer: {
    id: string;
    name: string;
    arr: number;
    segment: string;
    industry: string | null;
  };
  overall_percentile: number;
  metrics: CustomerMetricBenchmark[];
  peer_comparison: {
    segment: string;
    total_peers: number;
    rank: number;
    above_average: boolean;
  };
  strengths: CustomerMetricBenchmark[];
  gaps: CustomerMetricBenchmark[];
  recommended_targets: RecommendedTarget[];
}

export interface RecommendedTarget {
  metric: string;
  current_value: number;
  target_value: number;
  target_percentile: number;
  improvement_needed: number;
  timeline: string;
  action: string;
}

// ============================================
// FILTER TYPES
// ============================================

export interface BenchmarkReportFilters {
  metric?: BenchmarkMetricType;
  segment?: string;
  percentile_range?: { min: number; max: number };
  search?: string;
  sort_by?: 'percentile' | 'value' | 'arr' | 'name' | 'gap';
  sort_order?: 'asc' | 'desc';
}

// ============================================
// COMPARISON TYPES
// ============================================

export interface SegmentComparison {
  segment: string;
  customer_count: number;
  avg_health_score: number;
  avg_percentile: number;
  total_arr: number;
  vs_portfolio_avg: number; // difference from portfolio average
}
