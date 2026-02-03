/**
 * CSCX.AI Revenue Analytics Types
 * PRD-158: Revenue Analytics Report
 *
 * Comprehensive types for revenue tracking, movements, retention metrics,
 * and concentration analysis.
 */

// ============================================
// Core Revenue Record
// ============================================

export interface RevenueRecord {
  id: string;
  customer_id: string;
  effective_date: string;

  // Revenue values
  arr: number;
  mrr: number;
  currency: string;

  // Categorization
  segment: 'enterprise' | 'mid-market' | 'smb';
  tier: string;
  csm_id?: string;

  created_at: string;
  updated_at: string;
}

// ============================================
// Revenue Movements
// ============================================

export type RevenueMovementType =
  | 'new'
  | 'expansion'
  | 'contraction'
  | 'churn'
  | 'reactivation';

export type RevenueMovementSource =
  | 'upsell'
  | 'downsell'
  | 'price_change'
  | 'churn'
  | 'new_business'
  | 'reactivation';

export interface RevenueMovement {
  id: string;
  customer_id: string;
  customer_name: string;
  movement_date: string;

  type: RevenueMovementType;
  previous_arr: number;
  new_arr: number;
  change_amount: number;

  reason?: string;
  source?: RevenueMovementSource;

  created_at: string;
}

// ============================================
// Revenue Metrics
// ============================================

export interface RevenueTotals {
  starting_arr: number;
  ending_arr: number;
  starting_mrr: number;
  ending_mrr: number;
  customer_count: number;
  arr_change: number;
  arr_change_percent: number;
}

export interface RevenueMovementTotals {
  new_business: number;
  expansion: number;
  contraction: number;
  churn: number;
  net_change: number;
}

export interface RetentionMetrics {
  gross_retention: number;
  net_retention: number;
  logo_retention: number;
  gross_retention_target: number;
  net_retention_target: number;
  logo_retention_target: number;
}

export interface RevenueAverages {
  arpa: number;
  arpa_change: number;
  arpa_change_percent: number;
  lifetime_value: number;
}

export interface RevenueMetrics {
  period: string;
  period_label: string;

  totals: RevenueTotals;
  movements: RevenueMovementTotals;
  retention: RetentionMetrics;
  averages: RevenueAverages;
}

// ============================================
// Segment Analysis
// ============================================

export interface SegmentBreakdown {
  segment: 'enterprise' | 'mid-market' | 'smb';
  segment_label: string;
  arr: number;
  arr_percent: number;
  customer_count: number;
  nrr: number;
  grr: number;
  change_amount: number;
  change_percent: number;
  avg_arr: number;
}

// ============================================
// CSM Attribution
// ============================================

export interface CSMBreakdown {
  csm_id: string;
  csm_name: string;
  arr: number;
  arr_percent: number;
  customer_count: number;
  nrr: number;
  grr: number;
  expansion: number;
  contraction: number;
  churn: number;
  net_change: number;
}

// ============================================
// Concentration Risk
// ============================================

export interface ConcentrationMetric {
  top_n: number;
  arr: number;
  percent_of_total: number;
  customers: Array<{
    id: string;
    name: string;
    arr: number;
    percent: number;
  }>;
}

export interface ConcentrationAnalysis {
  total_arr: number;
  top_10: ConcentrationMetric;
  top_25: ConcentrationMetric;
  largest_customer: {
    id: string;
    name: string;
    arr: number;
    percent: number;
  };
  concentration_risk: 'low' | 'medium' | 'high';
  risk_threshold: number;
  risk_message: string;
}

// ============================================
// Revenue Trend
// ============================================

export interface RevenueTrend {
  period: string;
  period_label: string;
  arr: number;
  mrr: number;
  customer_count: number;
  nrr: number;
  grr: number;
}

// ============================================
// API Response Types
// ============================================

export interface RevenueAnalyticsSummary {
  period: string;
  period_label: string;
  totals: RevenueTotals;
  movements: RevenueMovementTotals;
  retention: RetentionMetrics;
  averages: RevenueAverages;
}

export interface RevenueAnalyticsResponse {
  summary: RevenueAnalyticsSummary;
  movements: RevenueMovement[];
  trends: RevenueTrend[];
  by_segment: SegmentBreakdown[];
  by_csm: CSMBreakdown[];
}

export interface RevenueHistoryResponse {
  periods: number;
  trends: RevenueTrend[];
}

export interface RevenueConcentrationResponse {
  analysis: ConcentrationAnalysis;
}

// ============================================
// Query Parameters
// ============================================

export interface RevenueAnalyticsQuery {
  period?: 'current_month' | 'current_quarter' | 'current_year' | 'last_month' | 'last_quarter' | 'last_year';
  segment?: 'enterprise' | 'mid-market' | 'smb';
  csm_id?: string;
}

export interface RevenueHistoryQuery {
  periods?: number;
}

// ============================================
// Calculation Helpers
// ============================================

/**
 * Calculate Gross Revenue Retention (GRR)
 * Revenue retained excluding expansion
 */
export function calculateGRR(
  startingARR: number,
  contraction: number,
  churn: number
): number {
  if (startingARR === 0) return 0;
  return Math.round(((startingARR - contraction - churn) / startingARR) * 100);
}

/**
 * Calculate Net Revenue Retention (NRR)
 * Revenue retained including expansion
 */
export function calculateNRR(
  startingARR: number,
  expansion: number,
  contraction: number,
  churn: number
): number {
  if (startingARR === 0) return 0;
  return Math.round(
    ((startingARR + expansion - contraction - churn) / startingARR) * 100
  );
}

/**
 * Calculate Logo Retention
 */
export function calculateLogoRetention(
  startingCustomers: number,
  churned: number
): number {
  if (startingCustomers === 0) return 0;
  return Math.round(((startingCustomers - churned) / startingCustomers) * 100);
}

/**
 * Calculate Average Revenue Per Account (ARPA)
 */
export function calculateARPA(totalARR: number, customerCount: number): number {
  if (customerCount === 0) return 0;
  return Math.round(totalARR / customerCount);
}

/**
 * Determine concentration risk level
 */
export function getConcentrationRisk(
  largestCustomerPercent: number,
  threshold: number = 10
): 'low' | 'medium' | 'high' {
  if (largestCustomerPercent >= threshold * 1.5) return 'high';
  if (largestCustomerPercent >= threshold) return 'medium';
  return 'low';
}

/**
 * Get segment from ARR value
 */
export function getSegmentFromARR(arr: number): 'enterprise' | 'mid-market' | 'smb' {
  if (arr >= 100000) return 'enterprise';
  if (arr >= 25000) return 'mid-market';
  return 'smb';
}

/**
 * Format segment label
 */
export function formatSegmentLabel(segment: string): string {
  const labels: Record<string, string> = {
    enterprise: 'Enterprise',
    'mid-market': 'Mid-Market',
    smb: 'SMB'
  };
  return labels[segment] || segment;
}
