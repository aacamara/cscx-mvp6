/**
 * Benchmark Data Types
 * PRD-023: Benchmark Data Upload -> Peer Comparison
 *
 * Type definitions for benchmark data processing, peer grouping,
 * and comparative analysis features.
 */

// ============================================
// BENCHMARK CATEGORIES & METRICS
// ============================================

export type BenchmarkCategory =
  | 'engagement'
  | 'value'
  | 'satisfaction'
  | 'growth'
  | 'efficiency';

export interface BenchmarkMetric {
  id: string;
  name: string;
  category: BenchmarkCategory;
  description: string;
  unit: 'ratio' | 'percentage' | 'score' | 'days' | 'count' | 'currency';
  higherIsBetter: boolean;
}

// Standard benchmark metrics mapped to categories
export const BENCHMARK_METRICS: BenchmarkMetric[] = [
  // Engagement
  { id: 'dau_mau_ratio', name: 'DAU/MAU Ratio', category: 'engagement', description: 'Daily active users / Monthly active users', unit: 'ratio', higherIsBetter: true },
  { id: 'session_length', name: 'Average Session Length', category: 'engagement', description: 'Average session duration in minutes', unit: 'count', higherIsBetter: true },
  { id: 'feature_adoption', name: 'Feature Adoption', category: 'engagement', description: 'Percentage of features used', unit: 'percentage', higherIsBetter: true },

  // Value
  { id: 'roi', name: 'ROI', category: 'value', description: 'Return on investment', unit: 'percentage', higherIsBetter: true },
  { id: 'time_to_value', name: 'Time-to-Value', category: 'value', description: 'Days until customer sees first value', unit: 'days', higherIsBetter: false },
  { id: 'outcomes_achieved', name: 'Outcomes Achieved', category: 'value', description: 'Percentage of target outcomes met', unit: 'percentage', higherIsBetter: true },

  // Satisfaction
  { id: 'nps_score', name: 'NPS Score', category: 'satisfaction', description: 'Net Promoter Score (-100 to +100)', unit: 'score', higherIsBetter: true },
  { id: 'csat', name: 'CSAT', category: 'satisfaction', description: 'Customer satisfaction score', unit: 'percentage', higherIsBetter: true },
  { id: 'health_score', name: 'Health Score', category: 'satisfaction', description: 'Customer health score', unit: 'score', higherIsBetter: true },

  // Growth
  { id: 'expansion_rate', name: 'Expansion Rate', category: 'growth', description: 'Revenue expansion percentage', unit: 'percentage', higherIsBetter: true },
  { id: 'seat_growth', name: 'Seat Growth', category: 'growth', description: 'User seat growth rate', unit: 'percentage', higherIsBetter: true },
  { id: 'upsell_rate', name: 'Upsell Rate', category: 'growth', description: 'Percentage of customers with upsells', unit: 'percentage', higherIsBetter: true },

  // Efficiency
  { id: 'tickets_per_user', name: 'Support Tickets per User', category: 'efficiency', description: 'Average support tickets per user', unit: 'ratio', higherIsBetter: false },
  { id: 'self_service_rate', name: 'Self-Service Rate', category: 'efficiency', description: 'Percentage of issues resolved via self-service', unit: 'percentage', higherIsBetter: true },
  { id: 'resolution_time', name: 'Resolution Time', category: 'efficiency', description: 'Average ticket resolution time in hours', unit: 'count', higherIsBetter: false },
];

// ============================================
// BENCHMARK DATA STRUCTURES
// ============================================

export interface BenchmarkValue {
  metricId: string;
  p10: number;  // 10th percentile
  p25: number;  // 25th percentile
  p50: number;  // 50th percentile (median)
  p75: number;  // 75th percentile
  p90: number;  // 90th percentile
  mean: number;
  sampleSize: number;
}

export interface BenchmarkDataset {
  id: string;
  name: string;
  source: string;
  industry: string | null;
  segment: string | null;  // Enterprise, Mid-Market, SMB
  createdAt: string;
  updatedAt: string;
  uploadedBy: string;
  fileName: string;
  sampleSize: number;
  metrics: BenchmarkValue[];
  metadata: {
    year: number;
    region?: string;
    notes?: string;
  };
}

// ============================================
// PEER GROUP TYPES
// ============================================

export type PeerGroupDimension = 'segment' | 'industry' | 'size' | 'custom';

export interface PeerGroup {
  id: string;
  name: string;
  dimension: PeerGroupDimension;
  criteria: {
    segments?: string[];
    industries?: string[];
    arrMin?: number;
    arrMax?: number;
    customerIds?: string[];
  };
  customerCount: number;
  customerIds: string[];
}

export interface PeerGroupSummary {
  id: string;
  name: string;
  customerCount: number;
  avgHealthScore: number;
  totalArr: number;
}

// ============================================
// COMPARISON RESULTS
// ============================================

export type PerformanceStatus = 'above' | 'at' | 'below';

export interface MetricComparison {
  metricId: string;
  metricName: string;
  category: BenchmarkCategory;
  customerValue: number;
  benchmarkValue: number;  // p50/median by default
  percentile: number;
  status: PerformanceStatus;
  gap: number;
  unit: string;
}

export interface CustomerBenchmarkComparison {
  customerId: string;
  customerName: string;
  arr: number;
  segment: string;
  peerGroup: string;
  overallPercentile: number;
  overallStatus: PerformanceStatus;
  metrics: MetricComparison[];
  strengths: MetricComparison[];
  gaps: MetricComparison[];
  recommendations: BenchmarkRecommendation[];
}

export interface BenchmarkRecommendation {
  metricId: string;
  metricName: string;
  currentValue: number;
  targetValue: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  action: string;
  timeline: string;
  bestPractice?: string;
  exemplarCustomer?: {
    id: string;
    name: string;
    value: number;
    percentile: number;
  };
}

// ============================================
// TOP PERFORMERS & BEST PRACTICES
// ============================================

export interface TopPerformer {
  customerId: string;
  customerName: string;
  metricId: string;
  metricName: string;
  value: number;
  percentile: number;
  bestPractice: string | null;
}

export interface BestPractice {
  metricId: string;
  metricName: string;
  customerId: string;
  customerName: string;
  value: number;
  percentile: number;
  description: string;
  keySuccessFactors: string[];
}

// ============================================
// PORTFOLIO BENCHMARK ANALYSIS
// ============================================

export interface PortfolioMetricSummary {
  metricId: string;
  metricName: string;
  category: BenchmarkCategory;
  portfolioAvg: number;
  benchmarkMedian: number;
  portfolioPercentile: number;
  status: PerformanceStatus;
  aboveCount: number;
  atCount: number;
  belowCount: number;
}

export interface PortfolioBenchmarkAnalysis {
  datasetId: string;
  datasetName: string;
  analyzedAt: string;
  totalCustomers: number;
  totalArr: number;
  metrics: PortfolioMetricSummary[];
  summary: {
    aboveBenchmark: number;
    atBenchmark: number;
    belowBenchmark: number;
  };
  topPerformers: TopPerformer[];
  underperformers: CustomerBenchmarkComparison[];
  bestPractices: BestPractice[];
}

// ============================================
// PEER GROUP COMPARISON
// ============================================

export interface PeerGroupMetricComparison {
  metricId: string;
  metricName: string;
  groupAvg: number;
  portfolioAvg: number;
  benchmarkMedian: number;
}

export interface PeerGroupComparison {
  peerGroup: PeerGroup;
  customers: CustomerBenchmarkComparison[];
  metrics: PeerGroupMetricComparison[];
  summary: {
    aboveMedian: number;
    belowMedian: number;
    lowestPerformer: {
      customerId: string;
      customerName: string;
      percentile: number;
    } | null;
    highestPerformer: {
      customerId: string;
      customerName: string;
      percentile: number;
    } | null;
  };
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface BenchmarkUploadResponse {
  success: boolean;
  dataset: BenchmarkDataset;
  summary: {
    metricsLoaded: number;
    categories: BenchmarkCategory[];
    segments: string[];
    sampleSize: number;
  };
}

export interface PeerGroupRequest {
  dimension: PeerGroupDimension;
  criteria?: {
    segments?: string[];
    industries?: string[];
    arrMin?: number;
    arrMax?: number;
    customerIds?: string[];
  };
  name?: string;
}

export interface PeerGroupResponse {
  success: boolean;
  peerGroups: PeerGroup[];
}

export interface BenchmarkComparisonRequest {
  datasetId: string;
  customerId?: string;
  peerGroupId?: string;
}

export interface BenchmarkLeadersRequest {
  datasetId: string;
  metricId?: string;
  limit?: number;
}

export interface BenchmarkLeadersResponse {
  success: boolean;
  leaders: TopPerformer[];
  bestPractices: BestPractice[];
}

// ============================================
// CUSTOMER BENCHMARK REPORT
// ============================================

export interface CustomerBenchmarkReport {
  customer: {
    id: string;
    name: string;
    arr: number;
    segment: string;
    industry: string | null;
  };
  peerGroup: string;
  preparedBy: string;
  preparedDate: string;
  overallPercentile: number;
  metrics: MetricComparison[];
  strengths: {
    metric: string;
    value: number;
    percentile: number;
    description: string;
  }[];
  opportunities: {
    metric: string;
    currentValue: number;
    targetValue: number;
    gap: number;
    recommendation: string;
  }[];
  peerComparison: {
    rank: number;
    total: number;
    position: string;  // e.g., "55th percentile"
  };
  nextSteps: string[];
}

// ============================================
// UI FILTER TYPES
// ============================================

export interface BenchmarkFilters {
  datasetId?: string;
  category?: BenchmarkCategory;
  segment?: string;
  industry?: string;
  status?: PerformanceStatus;
  search?: string;
  sortBy?: 'percentile' | 'gap' | 'arr' | 'name';
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// CHART DATA TYPES
// ============================================

export interface PercentileChartData {
  metricId: string;
  metricName: string;
  category: BenchmarkCategory;
  customerValue: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  percentile: number;
}

export interface CategorySummaryChart {
  category: BenchmarkCategory;
  avgPercentile: number;
  metricCount: number;
  aboveCount: number;
  belowCount: number;
}
