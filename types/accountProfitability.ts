/**
 * CSCX.AI Account Profitability Types
 * PRD-078: Account Profitability View
 *
 * Types for account-level profitability analysis including revenue components,
 * cost-to-serve breakdown, margin calculations, and optimization opportunities.
 */

// ============================================
// Core Profitability Types
// ============================================

export type ProfitabilityTier = 'high' | 'medium' | 'low' | 'negative';
export type ProfitabilityTrend = 'improving' | 'stable' | 'declining';
export type TimePeriod = 'qtd' | 'ytd' | '12m' | 'contract' | 'month' | 'quarter' | 'year';

export interface DateRange {
  start: string;
  end: string;
  label: string;
}

// ============================================
// Revenue Components
// ============================================

export interface RevenueBreakdown {
  total: number;
  subscription: number;
  expansion: number;
  services: number;
  support: number;
}

export interface RevenueComponentDetail {
  category: 'subscription' | 'expansion' | 'services' | 'support';
  amount: number;
  percent_of_total: number;
  trend: ProfitabilityTrend;
  yoy_change?: number;
}

// ============================================
// Cost Components
// ============================================

export interface CSMCost {
  hours: number;
  hourly_rate: number;
  total: number;
  activities: ActivityCost[];
}

export interface ActivityCost {
  activity: string;
  hours: number;
  percent: number;
  cost: number;
}

export interface SupportCost {
  tickets: number;
  escalations: number;
  avg_resolution_hours: number;
  cost_per_ticket: number;
  total: number;
}

export interface InfrastructureCost {
  compute: number;
  storage: number;
  api_calls: number;
  total: number;
}

export interface CostBreakdown {
  total: number;
  csm: CSMCost;
  support: SupportCost;
  infrastructure: InfrastructureCost;
  onboarding: number;
  training: number;
  sales: number;
  other: number;
}

export interface CostComponentDetail {
  category: string;
  amount: number;
  percent_of_revenue: number;
  details: string;
  benchmark_comparison?: 'above' | 'at' | 'below';
}

// ============================================
// Profitability Metrics
// ============================================

export interface AccountProfitability {
  customer_id: string;
  customer_name: string;
  period: DateRange;

  // Revenue
  revenue: RevenueBreakdown;

  // Costs
  costs: CostBreakdown;

  // Profitability
  gross_margin: number;
  gross_margin_percent: number;
  contribution_margin: number;
  contribution_margin_percent: number;

  // Benchmarks
  vs_segment_avg: number;
  profitability_tier: ProfitabilityTier;

  // Projections
  ltv: number;
  projected_margin_12m: number;
}

// ============================================
// Segment Benchmarks
// ============================================

export interface SegmentBenchmark {
  segment: string;
  segment_label: string;
  avg_margin_percent: number;
  avg_cost_to_serve_percent: number;
  avg_csm_hours_per_quarter: number;
  avg_support_cost: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
  };
}

export interface AccountBenchmarkComparison {
  metric: string;
  account_value: number;
  segment_p25: number;
  segment_median: number;
  segment_p75: number;
  account_percentile: number;
  status: 'above' | 'at' | 'below';
}

// ============================================
// Profitability Trend
// ============================================

export interface ProfitabilityTrendPoint {
  period: string;
  period_label: string;
  revenue: number;
  costs: number;
  margin: number;
  margin_percent: number;
}

// ============================================
// CSM Time Allocation
// ============================================

export interface CSMTimeAllocation {
  total_hours: number;
  breakdown: ActivityCost[];
  efficiency_notes: string[];
}

// ============================================
// Support Cost Details
// ============================================

export interface SupportCostDetails {
  tickets_submitted: number;
  tickets_benchmark: number;
  escalations: number;
  escalations_benchmark: number;
  avg_resolution_time: number;
  avg_resolution_benchmark: number;
  cost_per_ticket: number;
  cost_per_ticket_benchmark: number;
  total_cost: number;
  analysis: string;
  recommendations: string[];
}

// ============================================
// Lifetime Value Analysis
// ============================================

export interface LTVAnalysis {
  customer_age_months: number;
  total_revenue_ltd: number;
  total_costs_ltd: number;
  net_margin_ltd: number;
  projected_annual_margin: number;
  estimated_lifetime_years: number;
  projected_ltv: number;
}

// ============================================
// Optimization Opportunities
// ============================================

export interface OptimizationOpportunity {
  id: string;
  title: string;
  category: 'cost_reduction' | 'revenue_expansion' | 'efficiency';
  current_value: number;
  target_value: number;
  potential_impact: number;
  margin_impact_percent: number;
  action: string;
  effort: 'low' | 'medium' | 'high';
  priority: number;
}

// ============================================
// Portfolio Profitability
// ============================================

export interface PortfolioProfitabilitySummary {
  total_customers: number;
  total_arr: number;
  total_costs: number;
  avg_margin_percent: number;

  distribution: {
    high: { count: number; arr: number; percent: number };
    medium: { count: number; arr: number; percent: number };
    low: { count: number; arr: number; percent: number };
    negative: { count: number; arr: number; percent: number };
  };

  top_profitable: Array<{
    customer_id: string;
    customer_name: string;
    arr: number;
    margin_percent: number;
  }>;

  bottom_profitable: Array<{
    customer_id: string;
    customer_name: string;
    arr: number;
    margin_percent: number;
  }>;
}

export interface CustomerProfitabilitySummary {
  customer_id: string;
  customer_name: string;
  segment: string;
  arr: number;
  total_costs: number;
  margin: number;
  margin_percent: number;
  profitability_tier: ProfitabilityTier;
  trend: ProfitabilityTrend;
  vs_segment_avg: number;
}

// ============================================
// API Response Types
// ============================================

export interface AccountProfitabilityResponse {
  profitability: AccountProfitability;
  trend: ProfitabilityTrendPoint[];
  benchmark: SegmentBenchmark;
  opportunities: OptimizationOpportunity[];
  csm_allocation: CSMTimeAllocation;
  support_details: SupportCostDetails;
  ltv_analysis: LTVAnalysis;
  generated_at: string;
}

export interface PortfolioProfitabilityResponse {
  summary: PortfolioProfitabilitySummary;
  customers: CustomerProfitabilitySummary[];
  generated_at: string;
}

// ============================================
// Query Parameters
// ============================================

export interface AccountProfitabilityQuery {
  period?: TimePeriod;
  include_projections?: boolean;
}

export interface PortfolioProfitabilityQuery {
  period?: TimePeriod;
  segment?: 'enterprise' | 'mid-market' | 'smb';
  min_arr?: number;
  max_arr?: number;
  tier?: ProfitabilityTier;
  sort_by?: 'margin' | 'margin_percent' | 'arr' | 'costs';
  sort_order?: 'asc' | 'desc';
}

// ============================================
// Calculation Helpers
// ============================================

/**
 * Calculate gross margin
 */
export function calculateGrossMargin(revenue: number, costs: number): number {
  return revenue - costs;
}

/**
 * Calculate gross margin percent
 */
export function calculateGrossMarginPercent(revenue: number, costs: number): number {
  if (revenue === 0) return 0;
  return Math.round(((revenue - costs) / revenue) * 100 * 10) / 10;
}

/**
 * Determine profitability tier based on margin percent
 */
export function getProfitabilityTier(marginPercent: number): ProfitabilityTier {
  if (marginPercent >= 70) return 'high';
  if (marginPercent >= 50) return 'medium';
  if (marginPercent >= 0) return 'low';
  return 'negative';
}

/**
 * Calculate LTV based on margin and retention
 */
export function calculateLTV(annualMargin: number, grr: number, years: number = 5): number {
  // Simple LTV calculation: annual margin * estimated lifetime
  // More sophisticated would use discounted cash flow
  return Math.round(annualMargin * years);
}

/**
 * Estimate CSM cost based on customer attributes
 */
export function estimateCSMCost(
  segment: string,
  healthScore: number,
  entitlementsCount: number,
  escalationsCount: number,
  hourlyRate: number = 60
): number {
  // Base hours by segment
  const baseHours: Record<string, number> = {
    enterprise: 120,
    'mid-market': 80,
    smb: 40
  };

  const base = baseHours[segment] || 60;

  // Modifiers
  const healthModifier = healthScore < 50 ? 1.3 : 1.0;
  const complexityModifier = entitlementsCount > 5 ? 1.2 : 1.0;
  const escalationHours = escalationsCount * 10;

  const totalHours = base * healthModifier * complexityModifier + escalationHours;

  return Math.round(totalHours * hourlyRate);
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
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`;
}
