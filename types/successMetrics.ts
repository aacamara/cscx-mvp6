/**
 * Account Success Metrics Types
 * PRD-069: Account Success Metrics for Account Intelligence
 *
 * Provides comprehensive types for tracking customer success goals,
 * metrics, ROI calculations, and value delivery.
 */

// ============================================
// Metric Categories & Types
// ============================================

export type MetricCategory =
  | 'operational'   // Efficiency improvements (time saved, process speed)
  | 'financial'     // Cost/revenue impact (cost reduction, revenue increase)
  | 'quality'       // Error/quality improvements (error rate, accuracy)
  | 'adoption'      // Product utilization (feature adoption, engagement)
  | 'satisfaction'; // Sentiment measures (NPS, CSAT, engagement)

export type MetricDirection = 'higher_is_better' | 'lower_is_better';

export type MetricFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type MetricStatus = 'exceeding' | 'on_track' | 'at_risk' | 'not_met';

export type GoalStatus = 'not_started' | 'in_progress' | 'achieved' | 'at_risk';

// ============================================
// Success Metric Data Model
// ============================================

export interface SuccessMetric {
  id: string;
  customerId: string;
  goalId: string;
  category: MetricCategory;
  name: string;
  description: string;

  // Values
  baseline: number;
  target: number;
  current: number;
  unit: string; // "hours", "percent", "$", "count", etc.

  // Metadata
  direction: MetricDirection;
  dataSource: string;
  measuredAt: string;
  frequency: MetricFrequency;

  // Status
  status: MetricStatus;
  progressPercent: number;
}

// ============================================
// Success Goal Data Model
// ============================================

export interface SuccessGoal {
  id: string;
  customerId: string;
  title: string;
  description: string;
  metrics: SuccessMetric[];
  owner: string;
  ownerTitle?: string;
  targetDate: string;
  status: GoalStatus;
  weight: number; // Weight for success score calculation (0-1)
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Value Delivery
// ============================================

export interface ValueItem {
  category: string;
  description: string;
  annualValue: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface ROICalculation {
  investment: number;      // ARR
  valueDelivered: number;  // Total annual value
  roiPercent: number;
}

export interface ValueSummary {
  items: ValueItem[];
  totalAnnualValue: number;
  roi: ROICalculation;
}

// ============================================
// Trend Data
// ============================================

export interface MetricTrendPoint {
  date: string;
  value: number;
}

export interface GoalTrendPoint {
  date: string;
  progressPercent: number;
}

// ============================================
// Benchmark Data
// ============================================

export interface BenchmarkComparison {
  metric: string;
  customerValue: number;
  peerAverage: number;
  percentile: number;
}

// ============================================
// Milestone Tracking
// ============================================

export interface Milestone {
  id: string;
  title: string;
  targetDate: string;
  status: 'completed' | 'on_track' | 'at_risk' | 'overdue' | 'planned';
  goalId?: string;
}

// ============================================
// Recommended Actions
// ============================================

export interface RecommendedAction {
  priority: 'immediate' | 'this_week' | 'this_month';
  action: string;
  goalId: string;
}

// ============================================
// Customer Quote
// ============================================

export interface CustomerQuote {
  text: string;
  author: string;
  source: string;
  date: string;
  goalId?: string;
}

// ============================================
// API Response Types
// ============================================

export interface SuccessScoreOverview {
  score: number;
  label: 'exceptional' | 'strong' | 'on_track' | 'needs_attention' | 'at_risk';
  goalsOnTrack: number;
  goalsAtRisk: number;
  totalGoals: number;
  totalValueDelivered: number;
}

export interface SuccessMetricsResponse {
  customerId: string;
  customerName: string;
  contractStart: string;
  lastUpdated: string;

  // Overview
  overview: SuccessScoreOverview;

  // Goals & Metrics
  goals: SuccessGoal[];

  // Value
  valueSummary: ValueSummary;

  // Historical trends
  trends: {
    successScore: GoalTrendPoint[];
    goalProgress: Record<string, GoalTrendPoint[]>;
  };

  // Benchmarks
  benchmarks: BenchmarkComparison[];

  // Upcoming
  milestones: Milestone[];

  // Customer feedback
  quotes: CustomerQuote[];
}

// ============================================
// Goal Detail Response
// ============================================

export interface GoalDetailResponse {
  goal: SuccessGoal;
  valueDelivered: ValueItem[];
  metricTrends: Record<string, MetricTrendPoint[]>;
  recommendations: RecommendedAction[];
  rootCauseAnalysis?: string[];
  quotes: CustomerQuote[];
}

// ============================================
// Create/Update Goal Request
// ============================================

export interface CreateGoalRequest {
  title: string;
  description?: string;
  metrics: Omit<SuccessMetric, 'id' | 'customerId' | 'goalId' | 'status' | 'progressPercent' | 'measuredAt'>[];
  owner: string;
  ownerTitle?: string;
  targetDate: string;
  weight?: number;
}

export interface UpdateGoalRequest extends Partial<CreateGoalRequest> {
  status?: GoalStatus;
}

export interface UpdateMetricRequest {
  current?: number;
  baseline?: number;
  target?: number;
  measuredAt?: string;
}

// ============================================
// Filter Types
// ============================================

export interface SuccessMetricsFilters {
  period?: 'all' | 'ytd' | 'last_quarter' | 'last_month' | 'custom';
  startDate?: string;
  endDate?: string;
  includeBenchmarks?: boolean;
  goalStatus?: GoalStatus | 'all';
  category?: MetricCategory | 'all';
}

// ============================================
// Success Score Thresholds
// ============================================

export const SUCCESS_SCORE_THRESHOLDS = {
  exceptional: { min: 90, max: 100 },
  strong: { min: 75, max: 89 },
  on_track: { min: 60, max: 74 },
  needs_attention: { min: 40, max: 59 },
  at_risk: { min: 0, max: 39 }
} as const;

// ============================================
// Goal Status Thresholds
// ============================================

export const GOAL_PROGRESS_THRESHOLDS = {
  exceeding: { min: 100 },  // > 100% of target
  on_track: { min: 75 },    // 75-100% progress
  at_risk: { min: 50 },     // 50-74% progress
  not_met: { min: 0 }       // < 50% progress
} as const;

// ============================================
// Category Display Names
// ============================================

export const CATEGORY_LABELS: Record<MetricCategory, string> = {
  operational: 'Operational',
  financial: 'Financial',
  quality: 'Quality',
  adoption: 'Adoption',
  satisfaction: 'Satisfaction'
};

export const CATEGORY_ICONS: Record<MetricCategory, string> = {
  operational: 'clock',
  financial: 'currency-dollar',
  quality: 'check-badge',
  adoption: 'chart-bar',
  satisfaction: 'face-smile'
};
