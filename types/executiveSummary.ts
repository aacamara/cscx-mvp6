/**
 * Executive Summary Report Types
 * PRD-179: Executive Summary Report
 *
 * Types for executive-level CS performance reporting,
 * including metrics, narratives, and scheduled reports.
 */

// ============================================
// Core Metric Types
// ============================================

export interface KeyMetric {
  name: string;
  value: number;
  target: number;
  status: 'on_track' | 'at_risk' | 'behind';
  change: number;
  change_period: string;
  unit: 'percent' | 'currency' | 'days' | 'count' | 'score';
}

export interface PortfolioSummary {
  total_arr: number;
  arr_change: number;
  arr_change_percent: number;
  customer_count: number;
  net_new_customers: number;
  churned_customers: number;
  churned_arr: number;
  expansion_arr: number;
}

export interface RetentionMetrics {
  gross_retention: number;
  gross_retention_target: number;
  net_retention: number;
  net_retention_target: number;
  logo_retention: number;
  logo_retention_target: number;
}

export interface HealthMetrics {
  avg_health_score: number;
  health_score_target: number;
  healthy_count: number;
  warning_count: number;
  critical_count: number;
  health_trend: 'improving' | 'stable' | 'declining';
}

export interface EngagementMetrics {
  time_to_value_days: number;
  time_to_value_target: number;
  nps_score: number;
  nps_target: number;
  csat_score: number;
  csat_target: number;
}

// ============================================
// Highlights & Risks
// ============================================

export interface ExecutiveWin {
  id: string;
  customer_name: string;
  description: string;
  impact_arr: number;
  category: 'renewal' | 'expansion' | 'onboarding' | 'save' | 'advocacy';
  date: string;
}

export interface ExecutiveRisk {
  id: string;
  customer_name: string;
  arr_at_risk: number;
  risk_type: 'churn' | 'contraction' | 'support' | 'engagement' | 'champion';
  description: string;
  severity: 'high' | 'medium' | 'low';
  days_to_renewal: number | null;
}

export interface ExecutiveRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'retention' | 'expansion' | 'engagement' | 'support' | 'team';
  title: string;
  description: string;
  expected_impact: string;
}

// ============================================
// Trend Data
// ============================================

export interface MetricTrend {
  period: string;
  period_label: string;
  value: number;
}

export interface ExecutiveTrends {
  arr: MetricTrend[];
  nrr: MetricTrend[];
  health_score: MetricTrend[];
  nps: MetricTrend[];
}

// ============================================
// Team Performance
// ============================================

export interface CSMPerformance {
  csm_id: string;
  csm_name: string;
  arr_managed: number;
  customer_count: number;
  nrr: number;
  health_avg: number;
  at_risk_count: number;
  expansion_this_period: number;
}

export interface TeamSummary {
  total_csms: number;
  avg_arr_per_csm: number;
  avg_customers_per_csm: number;
  top_performers: CSMPerformance[];
  needs_attention: CSMPerformance[];
}

// ============================================
// Complete Executive Summary
// ============================================

export interface ExecutiveSummaryData {
  // Metadata
  report_id: string;
  period: string;
  period_label: string;
  period_start: string;
  period_end: string;
  generated_at: string;

  // Key Metrics At-a-Glance
  key_metrics: KeyMetric[];

  // Detailed Sections
  portfolio: PortfolioSummary;
  retention: RetentionMetrics;
  health: HealthMetrics;
  engagement: EngagementMetrics;

  // Highlights
  top_wins: ExecutiveWin[];
  key_risks: ExecutiveRisk[];
  recommendations: ExecutiveRecommendation[];

  // Trends
  trends: ExecutiveTrends;

  // Team
  team: TeamSummary;

  // AI-Generated Narrative
  narrative: {
    overview: string;
    wins_summary: string;
    risks_summary: string;
    outlook: string;
  };
}

// ============================================
// Scheduled Report Types
// ============================================

export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly';
export type ReportFormat = 'dashboard' | 'pdf' | 'email';

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: ReportFrequency;
  format: ReportFormat;
  recipients: string[];
  next_run: string;
  last_run: string | null;
  enabled: boolean;
  created_at: string;
  created_by: string;
}

export interface ScheduleReportRequest {
  name: string;
  frequency: ReportFrequency;
  format: ReportFormat;
  recipients: string[];
  day_of_week?: number; // 0-6 for weekly
  day_of_month?: number; // 1-31 for monthly
}

// ============================================
// API Request/Response Types
// ============================================

export interface ExecutiveSummaryRequest {
  period?: string;
  compare_to?: string;
  sections?: string[];
}

export interface ExecutiveSummaryResponse {
  success: boolean;
  data: ExecutiveSummaryData;
}

export interface ScheduledReportsResponse {
  success: boolean;
  data: {
    schedules: ScheduledReport[];
    count: number;
  };
}

// ============================================
// Filter Types
// ============================================

export interface ExecutiveSummaryFilters {
  period: 'current_month' | 'last_month' | 'current_quarter' | 'last_quarter' | 'ytd' | 'custom';
  start_date?: string;
  end_date?: string;
  segment?: 'all' | 'enterprise' | 'mid-market' | 'smb';
  region?: string;
}

// ============================================
// Stored Report (Database)
// ============================================

export interface StoredExecutiveReport {
  id: string;
  period_start: string;
  period_end: string;
  metrics: object; // JSON blob of ExecutiveSummaryData
  narrative: string;
  generated_at: string;
  generated_by: string;
}
