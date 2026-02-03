/**
 * Customer Lifetime Value (CLV) Types
 * PRD-173: Customer Lifetime Value Report
 */

// ============================================
// CLV Calculation Types
// ============================================

export interface CLVComponents {
  current_arr: number;
  estimated_lifetime_months: number;
  expansion_rate: number;
  gross_margin: number;
  discount_rate: number;
}

export interface CustomerCLV {
  customer_id: string;
  customer_name: string;

  historical: {
    total_revenue: number;
    months_as_customer: number;
  };

  current: {
    arr: number;
    monthly_revenue: number;
  };

  predicted: {
    remaining_lifetime_months: number;
    churn_probability: number;
    expansion_probability: number;
    predicted_clv: number;
    clv_range: { low: number; high: number };
  };

  total_clv: number;
  clv_tier: CLVTier;
  clv_percentile: number;
  segment: string;
}

export type CLVTier = 'platinum' | 'gold' | 'silver' | 'bronze';

// Tier thresholds in USD
export const CLV_TIER_THRESHOLDS = {
  platinum: 500000,
  gold: 200000,
  silver: 50000,
  bronze: 0
};

// ============================================
// CLV Summary
// ============================================

export interface CLVTierSummary {
  tier: CLVTier;
  customer_count: number;
  total_clv: number;
  avg_clv: number;
  total_arr: number;
  pct_of_portfolio: number;
}

export interface CLVSummary {
  total_clv: number;
  total_customers: number;
  avg_clv: number;
  median_clv: number;
  clv_cac_ratio: number;
  clv_change_yoy: number;
  clv_change_percent: number;
  tiers: CLVTierSummary[];
}

// ============================================
// CLV Distribution
// ============================================

export interface CLVDistributionBucket {
  range_label: string;
  min: number;
  max: number;
  count: number;
  total_clv: number;
  pct_of_total: number;
}

export interface CLVDistribution {
  buckets: CLVDistributionBucket[];
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

// ============================================
// CLV Trends
// ============================================

export interface CLVTrend {
  period: string;
  period_label: string;
  avg_clv: number;
  total_clv: number;
  customer_count: number;
  new_customers_clv: number;
  churned_customers_clv: number;
}

// ============================================
// CLV Drivers
// ============================================

export interface CLVDriver {
  factor: string;
  impact: number;
  description: string;
  direction: 'positive' | 'negative';
}

// ============================================
// Customer CLV Detail
// ============================================

export interface CLVHistory {
  date: string;
  clv: number;
  arr: number;
  churn_probability: number;
}

export interface CustomerCLVDetail {
  clv: CustomerCLV;
  drivers: CLVDriver[];
  history: CLVHistory[];
  recommendations: string[];
  comparison: {
    segment_avg: number;
    portfolio_avg: number;
    vs_segment: number;
    vs_portfolio: number;
  };
}

// ============================================
// API Response Types
// ============================================

export interface CLVReportResponse {
  summary: CLVSummary;
  customers: CustomerCLV[];
  distribution: CLVDistribution;
  trends: CLVTrend[];
  top_drivers: CLVDriver[];
}

// ============================================
// Filter Types
// ============================================

export interface CLVFilters {
  segment?: string;
  tier?: CLVTier;
  min_clv?: number;
  max_clv?: number;
  sort_by?: 'clv' | 'arr' | 'name' | 'tier' | 'change';
  sort_order?: 'asc' | 'desc';
  search?: string;
}

// ============================================
// Cohort Analysis Types
// ============================================

export interface CLVCohort {
  cohort_name: string;
  cohort_period: string;
  customer_count: number;
  avg_clv: number;
  total_clv: number;
  avg_lifetime_months: number;
  retention_rate: number;
}

export interface CLVCohortAnalysis {
  dimension: string;
  cohorts: CLVCohort[];
}
