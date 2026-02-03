/**
 * Cohort Analysis Types
 * PRD-169: Customer Cohort Analysis
 *
 * Provides types for cohort-based customer analysis including:
 * - Cohort definitions by multiple dimensions
 * - Retention tracking over time
 * - Metric comparisons across cohorts
 * - Outcome predictions
 */

// ============================================
// Cohort Dimension Types
// ============================================

export type CohortDimension =
  | 'start_date'
  | 'segment'
  | 'industry'
  | 'arr_range'
  | 'source'
  | 'custom';

export type CohortPeriod = 'monthly' | 'quarterly' | 'yearly';

export type ARRRange =
  | 'under_50k'
  | '50k_100k'
  | '100k_250k'
  | '250k_500k'
  | 'over_500k';

// ============================================
// Cohort Definition
// ============================================

export interface CohortCriteria {
  dimension: CohortDimension;
  period?: CohortPeriod;
  start_date?: string;
  end_date?: string;
  segment?: string;
  industry?: string;
  arr_range?: ARRRange;
  source?: string;
  custom_filter?: Record<string, unknown>;
}

export interface CohortDefinition {
  id: string;
  name: string;
  dimension: CohortDimension;
  criteria: CohortCriteria;
  customer_count: number;
  created_at: string;
}

// ============================================
// Retention Data
// ============================================

export interface RetentionPeriod {
  period: number; // Month or quarter number since cohort start
  retained: number; // Number of customers still active
  retention_rate: number; // Percentage 0-100
  arr_retained: number; // ARR from retained customers
  churned: number; // Number churned this period
}

export interface RetentionHeatmapCell {
  cohort_name: string;
  period: number;
  retention_rate: number;
  customer_count: number;
}

// ============================================
// Metrics by Period
// ============================================

export interface CohortMetricsByPeriod {
  period: number;
  avg_health_score: number;
  avg_adoption_score: number;
  nps_score: number | null;
  expansion_rate: number;
  support_tickets_avg: number;
}

// ============================================
// Cohort Summary
// ============================================

export interface CohortSummary {
  total_customers: number;
  total_arr: number;
  current_active: number;
  final_retention_rate: number;
  avg_lifetime_months: number;
  ltv_estimate: number;
  avg_health_score: number;
  expansion_rate: number;
  churn_rate: number;
}

// ============================================
// Cohort Analysis
// ============================================

export interface CohortAnalysis {
  cohort: CohortDefinition;
  period_count: number;
  retention: RetentionPeriod[];
  metrics_by_period: CohortMetricsByPeriod[];
  summary: CohortSummary;
}

// ============================================
// Cohort Comparison
// ============================================

export interface CohortComparison {
  cohorts: CohortAnalysis[];
  best_performer: {
    cohort_id: string;
    cohort_name: string;
    metric: string;
    value: number;
  };
  worst_performer: {
    cohort_id: string;
    cohort_name: string;
    metric: string;
    value: number;
  };
  key_differences: string[];
}

// ============================================
// Cohort Insights
// ============================================

export interface CohortInsight {
  type: 'trend' | 'comparison' | 'anomaly' | 'recommendation';
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  description: string;
  cohort_ids?: string[];
  metric?: string;
  value?: number;
}

// ============================================
// API Response Types
// ============================================

export interface CohortAnalysisResponse {
  dimension: CohortDimension;
  period_type: CohortPeriod;
  cohorts: CohortAnalysis[];
  heatmap: RetentionHeatmapCell[];
  comparison: CohortComparison | null;
  insights: CohortInsight[];
  generated_at: string;
}

export interface CohortMembersResponse {
  cohort: CohortDefinition;
  members: {
    customer_id: string;
    customer_name: string;
    joined_date: string;
    current_status: 'active' | 'churned' | 'at_risk';
    tenure_months: number;
    arr: number;
    health_score: number;
    churned_at?: string;
  }[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

// ============================================
// Filter Types
// ============================================

export interface CohortAnalysisFilters {
  dimension: CohortDimension;
  period_type?: CohortPeriod;
  period_start?: string;
  period_end?: string;
  periods?: number;
  segment?: string;
  industry?: string;
  arr_range?: ARRRange;
  cohort_ids?: string[];
}

// ============================================
// Chart Data Types
// ============================================

export interface RetentionCurveData {
  cohort_name: string;
  color: string;
  data: Array<{
    period: number;
    retention_rate: number;
  }>;
}

export interface CohortBarData {
  cohort_name: string;
  value: number;
  color: string;
}

// ============================================
// Constants
// ============================================

export const COHORT_COLORS: Record<string, string> = {
  default: '#e63946',
  enterprise: '#22c55e',
  mid_market: '#3b82f6',
  smb: '#eab308',
  technology: '#a855f7',
  healthcare: '#06b6d4',
  finance: '#f97316',
  manufacturing: '#ec4899'
};

export const ARR_RANGE_LABELS: Record<ARRRange, string> = {
  under_50k: 'Under $50K',
  '50k_100k': '$50K - $100K',
  '100k_250k': '$100K - $250K',
  '250k_500k': '$250K - $500K',
  over_500k: 'Over $500K'
};

export const DIMENSION_LABELS: Record<CohortDimension, string> = {
  start_date: 'Start Date',
  segment: 'Customer Segment',
  industry: 'Industry',
  arr_range: 'ARR Range',
  source: 'Acquisition Source',
  custom: 'Custom'
};
