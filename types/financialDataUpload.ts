/**
 * CSCX.AI Financial Data Upload Types
 * PRD-007: Financial Data Upload -> Revenue Analysis
 *
 * Types for financial data parsing, transactions, reconciliation,
 * and revenue analysis from uploaded billing data.
 */

// ============================================
// Transaction Types
// ============================================

export type TransactionType =
  | 'invoice'
  | 'payment'
  | 'credit_memo'
  | 'refund'
  | 'adjustment';

export type TransactionStatus =
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'disputed'
  | 'voided'
  | 'partial';

export interface FinancialTransaction {
  id: string;
  customer_id: string;
  customer_name: string;

  // Transaction details
  transaction_type: TransactionType;
  transaction_date: string;
  due_date?: string;

  // Amounts
  amount: number;
  currency: string;
  amount_paid?: number;

  // Status
  status: TransactionStatus;
  days_overdue?: number;

  // Reference
  invoice_number?: string;
  reference?: string;
  description?: string;

  // Metadata
  source_row?: number;
  raw_data?: Record<string, unknown>;
  created_at: string;
}

// ============================================
// File Upload Types
// ============================================

export type FinancialDataType =
  | 'billing_history'
  | 'invoices'
  | 'payments'
  | 'combined';

export interface FinancialFileParseResult {
  file_id: string;
  file_name: string;
  file_type: 'csv' | 'xlsx';

  // Detection
  data_type: FinancialDataType;
  detected_currency: string;

  // Stats
  total_transactions: number;
  customer_count: number;
  date_range: {
    start: string;
    end: string;
    months: number;
  };
  total_revenue: number;

  // Column mapping
  column_mapping: FinancialColumnMapping;
  suggested_mappings: SuggestedColumnMapping[];
  unmapped_columns: string[];

  // Preview
  preview_data: FinancialTransaction[];

  // Validation
  validation_errors: ValidationError[];
  warnings: string[];
}

export interface FinancialColumnMapping {
  customer_id?: string;
  customer_name?: string;
  amount?: string;
  date?: string;
  due_date?: string;
  type?: string;
  status?: string;
  invoice_number?: string;
  currency?: string;
  description?: string;
}

export interface SuggestedColumnMapping {
  column: string;
  suggested_field: keyof FinancialColumnMapping;
  confidence: number;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

// ============================================
// Reconciliation Types
// ============================================

export interface ARRDiscrepancy {
  customer_id: string;
  customer_name: string;
  recorded_arr: number;
  calculated_arr: number;
  difference: number;
  difference_percent: number;
  reason?: string;
  action_needed: 'update' | 'review' | 'ignore';
}

export interface ReconciliationResult {
  file_id: string;
  total_customers: number;
  matched_customers: number;
  unmatched_customers: number;

  // Discrepancies
  discrepancies: ARRDiscrepancy[];
  total_discrepancy_amount: number;

  // Unmatched
  unmatched_from_file: Array<{
    customer_name: string;
    calculated_arr: number;
    transaction_count: number;
  }>;

  // Summary
  reconciliation_rate: number;
}

// ============================================
// Revenue Analysis Types
// ============================================

export interface CustomerRevenueAnalysis {
  customer_id: string;
  customer_name: string;

  // Current state
  current_arr: number;
  currency: string;

  // Trend
  arr_trend: RevenueTrendPoint[];
  growth_rate: number; // percentage
  expansion_velocity: number;

  // Events
  expansion_events: ExpansionEvent[];
  contraction_events: ContractionEvent[];

  // Payment health
  payment_health: PaymentHealth;

  // Classification
  revenue_risk: 'low' | 'medium' | 'high';
  growth_classification: 'expanding' | 'stable' | 'contracting' | 'churning';
}

export interface RevenueTrendPoint {
  period: string;
  period_label: string;
  arr: number;
  mrr: number;
  change_amount: number;
  change_percent: number;
}

export interface ExpansionEvent {
  date: string;
  previous_arr: number;
  new_arr: number;
  change_amount: number;
  change_percent: number;
  type: 'upsell' | 'cross_sell' | 'price_increase' | 'seats';
  description?: string;
}

export interface ContractionEvent {
  date: string;
  previous_arr: number;
  new_arr: number;
  change_amount: number;
  change_percent: number;
  type: 'downsell' | 'seat_reduction' | 'price_decrease' | 'partial_churn';
  description?: string;
}

// ============================================
// Payment Health Types
// ============================================

export interface PaymentHealth {
  on_time_rate: number;
  average_days_to_pay: number;
  late_payment_count: number;
  dispute_count: number;
  outstanding_amount: number;
  payment_behavior: 'excellent' | 'good' | 'fair' | 'poor';
  risk_level: 'low' | 'medium' | 'high';
}

export interface PaymentRiskSignal {
  customer_id: string;
  customer_name: string;
  current_arr: number;

  // Risk details
  risk_type: 'late_payment' | 'dispute' | 'declining_payments' | 'churn_pattern';
  severity: 'high' | 'medium' | 'low';

  // Evidence
  late_payments_last_6m: number;
  disputed_amount: number;
  average_days_overdue: number;
  payment_pattern: string;

  // Recommendation
  recommended_action: string;
  urgency: 'immediate' | 'soon' | 'monitor';
}

// ============================================
// Portfolio Analysis Types
// ============================================

export interface PortfolioFinancialSummary {
  // Totals
  total_arr: number;
  total_mrr: number;
  total_customers: number;
  currency: string;

  // Retention
  net_revenue_retention: number;
  gross_revenue_retention: number;

  // Movements
  expansion_revenue: number;
  contraction_revenue: number;
  churn_revenue: number;
  new_business_revenue: number;
  net_change: number;

  // Trends by quarter
  quarterly_trends: QuarterlyTrend[];

  // Top accounts
  top_expansion_accounts: TopAccount[];
  top_contraction_accounts: TopAccount[];

  // Risks
  payment_risks: PaymentRiskSignal[];
  at_risk_arr: number;

  // Payment health
  portfolio_payment_health: {
    on_time_rate: number;
    benchmark: number;
    average_days_to_pay: number;
    benchmark_days: number;
    outstanding_invoices: number;
    disputed_amount: number;
  };
}

export interface QuarterlyTrend {
  quarter: string;
  quarter_label: string;
  arr: number;
  change_amount: number;
  change_percent: number;
  bar_width: number; // For visualization
}

export interface TopAccount {
  customer_id: string;
  customer_name: string;
  start_arr: number;
  current_arr: number;
  change_amount: number;
  change_percent: number;
  event_count: number;
  primary_event_type: string;
}

// ============================================
// Risk Signal Types
// ============================================

export interface FinancialRiskSignal {
  id: string;
  customer_id: string;
  customer_name: string;

  type: 'payment_risk' | 'contraction' | 'expansion_stall';
  severity: 'high' | 'medium' | 'low';

  details: string;
  evidence: string[];

  recommended_action: string;
  action_type: 'finance_escalation' | 'account_review' | 'value_discussion' | 'business_review';

  created_at: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface UploadFinancialDataRequest {
  file: File;
  column_mapping?: FinancialColumnMapping;
}

export interface UploadFinancialDataResponse {
  success: boolean;
  data?: FinancialFileParseResult;
  error?: {
    code: string;
    message: string;
  };
}

export interface ReconcileRequest {
  file_id: string;
  confirmed_mapping: FinancialColumnMapping;
}

export interface ReconcileResponse {
  success: boolean;
  data?: ReconciliationResult;
  error?: {
    code: string;
    message: string;
  };
}

export interface AnalyzeRevenueRequest {
  file_id: string;
  customer_id?: string;
}

export interface PortfolioAnalysisResponse {
  success: boolean;
  data?: PortfolioFinancialSummary;
  error?: {
    code: string;
    message: string;
  };
}

export interface CustomerRevenueResponse {
  success: boolean;
  data?: CustomerRevenueAnalysis;
  error?: {
    code: string;
    message: string;
  };
}

export interface UpdateARRRequest {
  updates: Array<{
    customer_id: string;
    new_arr: number;
    reason: string;
  }>;
}

export interface CreateRiskSignalsRequest {
  risks: Array<{
    customer_id: string;
    type: FinancialRiskSignal['type'];
    severity: FinancialRiskSignal['severity'];
    details: string;
  }>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate payment behavior from on-time rate
 */
export function getPaymentBehavior(onTimeRate: number): PaymentHealth['payment_behavior'] {
  if (onTimeRate >= 95) return 'excellent';
  if (onTimeRate >= 85) return 'good';
  if (onTimeRate >= 70) return 'fair';
  return 'poor';
}

/**
 * Calculate risk level from payment metrics
 */
export function calculatePaymentRiskLevel(
  onTimeRate: number,
  latePayments: number,
  disputes: number
): PaymentHealth['risk_level'] {
  if (onTimeRate < 70 || disputes > 0 || latePayments >= 3) return 'high';
  if (onTimeRate < 85 || latePayments >= 2) return 'medium';
  return 'low';
}

/**
 * Classify revenue growth
 */
export function classifyRevenueGrowth(
  growthRate: number
): CustomerRevenueAnalysis['growth_classification'] {
  if (growthRate >= 10) return 'expanding';
  if (growthRate >= -5) return 'stable';
  if (growthRate >= -50) return 'contracting';
  return 'churning';
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
}
