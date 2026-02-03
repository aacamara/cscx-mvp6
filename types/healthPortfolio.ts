/**
 * Health Score Portfolio Types
 * PRD-153: Portfolio-wide health score visualization
 */

// ============================================
// Health Score Calculation Types
// ============================================

export interface HealthScoreComponents {
  usage_score: number;      // 0-100, weight: 40%
  engagement_score: number; // 0-100, weight: 35%
  sentiment_score: number;  // 0-100, weight: 25%
}

export const COMPONENT_WEIGHTS = {
  usage: 0.40,
  engagement: 0.35,
  sentiment: 0.25
};

// Health score thresholds
export const HEALTH_THRESHOLDS = {
  healthy: { min: 70, max: 100 },
  warning: { min: 40, max: 69 },
  critical: { min: 0, max: 39 }
};

export type HealthCategory = 'healthy' | 'warning' | 'critical';
export type HealthTrend = 'improving' | 'stable' | 'declining';

// ============================================
// Customer Health Summary
// ============================================

export interface CustomerHealthSummary {
  customer_id: string;
  customer_name: string;
  health_score: number;
  category: HealthCategory;
  trend: HealthTrend;
  score_change: number;
  change_period: string;
  arr: number;
  segment: string;
  renewal_date: string | null;
  days_to_renewal: number | null;
  lowest_component: string | null;
  active_risks: number;
  last_contact: string | null;
}

// ============================================
// Portfolio Overview
// ============================================

export interface HealthBucket {
  count: number;
  arr: number;
  pct: number;
}

export interface PortfolioOverview {
  total_customers: number;
  total_arr: number;
  avg_health_score: number;
  score_change_wow: number;
  healthy: HealthBucket;
  warning: HealthBucket;
  critical: HealthBucket;
  changes: {
    improved: number;
    declined: number;
    stable: number;
  };
}

// ============================================
// Trend Data
// ============================================

export interface PortfolioTrend {
  date: string;
  avg_score: number;
  healthy_pct: number;
  warning_pct: number;
  critical_pct: number;
}

// ============================================
// Alerts
// ============================================

export interface PortfolioAlerts {
  new_critical: CustomerHealthSummary[];
  steep_declines: CustomerHealthSummary[];
  renewals_at_risk: CustomerHealthSummary[];
}

// ============================================
// API Response Types
// ============================================

export interface HealthPortfolioResponse {
  overview: PortfolioOverview;
  customers: CustomerHealthSummary[];
  trends: PortfolioTrend[];
  alerts: PortfolioAlerts;
}

// ============================================
// Customer Health Detail
// ============================================

export interface HealthRisk {
  severity: 'high' | 'medium' | 'low';
  type: string;
  description: string;
}

export interface HealthScoreHistory {
  date: string;
  score: number;
  components: HealthScoreComponents;
}

export interface CustomerHealthDetail {
  customer: {
    id: string;
    name: string;
    arr: number;
    industry: string | null;
    renewal_date: string | null;
    days_to_renewal: number | null;
    status: string;
  };
  current_score: number;
  category: HealthCategory;
  trend: HealthTrend;
  components: HealthScoreComponents;
  component_weights: typeof COMPONENT_WEIGHTS;
  lowest_component: string | null;
  history: HealthScoreHistory[];
  risks: HealthRisk[];
  recommendations: string[];
}

// ============================================
// Cohort Comparison
// ============================================

export interface CohortData {
  name: string;
  customer_count: number;
  avg_health_score: number;
  total_arr: number;
  healthy_pct: number;
  at_risk_count: number;
}

export interface CohortComparisonResponse {
  dimension: string;
  cohorts: CohortData[];
}

// ============================================
// Filter Types
// ============================================

export interface HealthPortfolioFilters {
  health_filter?: 'all' | HealthCategory;
  segment?: string;
  search?: string;
  sort_by?: 'score' | 'arr' | 'renewal' | 'name' | 'change';
  sort_order?: 'asc' | 'desc';
}
