/**
 * CSCX.AI Invoice Payment Analysis Types
 * PRD-015: Invoice History Upload -> Payment Pattern Analysis
 *
 * Types for invoice data parsing, payment pattern detection,
 * DSO calculation, and financial risk assessment.
 */

// ============================================
// Invoice Types
// ============================================

export type InvoiceStatus =
  | 'paid'
  | 'pending'
  | 'overdue'
  | 'partial'
  | 'disputed'
  | 'voided';

export interface Invoice {
  id: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string;

  // Amounts
  amount: number;
  amount_paid: number;
  currency: string;

  // Dates
  invoice_date: string;
  due_date: string;
  paid_date?: string;

  // Status
  status: InvoiceStatus;
  days_to_pay?: number;
  days_overdue?: number;

  // Metadata
  description?: string;
  source_row?: number;
}

// ============================================
// File Upload Types
// ============================================

export interface InvoiceColumnMapping {
  invoice_id?: string;
  customer_id?: string;
  customer_name?: string;
  amount?: string;
  amount_paid?: string;
  invoice_date?: string;
  due_date?: string;
  paid_date?: string;
  status?: string;
  currency?: string;
  description?: string;
}

export interface InvoiceUploadResult {
  file_id: string;
  file_name: string;
  file_type: 'csv' | 'xlsx';

  // Statistics
  total_invoices: number;
  customer_count: number;
  date_range: {
    start: string;
    end: string;
    months: number;
  };
  total_invoiced: number;
  total_collected: number;

  // Column mapping
  column_mapping: InvoiceColumnMapping;
  suggested_mappings: SuggestedInvoiceMapping[];
  unmapped_columns: string[];

  // Preview
  preview_data: Invoice[];

  // Validation
  validation_errors: InvoiceValidationError[];
  warnings: string[];
}

export interface SuggestedInvoiceMapping {
  column: string;
  suggested_field: keyof InvoiceColumnMapping;
  confidence: number;
}

export interface InvoiceValidationError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

// ============================================
// Payment Metrics Types
// ============================================

export interface CustomerPaymentMetrics {
  customer_id: string;
  customer_name: string;
  arr: number;
  segment?: string;

  // Payment metrics
  on_time_rate: number; // Percentage of invoices paid by due date
  average_days_to_pay: number; // Mean time from invoice to payment
  dso: number; // Days Sales Outstanding
  outstanding_balance: number; // Current unpaid amount
  dispute_rate: number; // Percentage of invoices disputed

  // Invoice counts
  total_invoices: number;
  paid_invoices: number;
  late_invoices: number;
  disputed_invoices: number;
  outstanding_invoices: number;

  // Trend
  trend: 'improving' | 'stable' | 'worsening';
  trend_data: QuarterlyPaymentTrend[];

  // Risk assessment
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  risk_score: number;
  risk_signals: string[];
}

export interface QuarterlyPaymentTrend {
  quarter: string;
  quarter_label: string;
  on_time_rate: number;
  average_days_to_pay: number;
  outstanding: number;
  invoice_count: number;
}

// ============================================
// Portfolio Analysis Types
// ============================================

export interface PaymentPortfolioOverview {
  // Portfolio metrics
  total_invoices: number;
  total_customers: number;
  date_range: {
    start: string;
    end: string;
    months: number;
  };
  total_invoiced: number;
  total_collected: number;
  total_outstanding: number;

  // Aggregate payment metrics
  average_on_time_rate: number;
  average_days_to_pay: number;
  portfolio_dso: number;
  outstanding_percentage: number;

  // Segment breakdown
  segment_breakdown: SegmentPaymentSummary[];

  // Distribution
  payment_distribution: {
    on_time: number;
    late_1_30: number;
    late_31_60: number;
    late_60_plus: number;
    disputed: number;
  };
}

export interface SegmentPaymentSummary {
  segment: string;
  customer_count: number;
  on_time_rate: number;
  average_days_to_pay: number;
  dso: number;
  outstanding: number;
  arr_at_risk: number;
}

// ============================================
// Risk Assessment Types
// ============================================

export interface PaymentRiskAccount {
  customer_id: string;
  customer_name: string;
  arr: number;
  segment?: string;

  // Risk details
  risk_level: 'critical' | 'high' | 'medium';
  on_time_rate: number;
  average_days_to_pay: number;
  outstanding_balance: number;
  outstanding_percentage: number; // Outstanding as % of ARR

  // Pattern
  pattern_description: string;
  quarterly_trend: QuarterlyPaymentTrend[];

  // Recommended actions
  recommended_actions: string[];
}

export interface EarlyWarningSignal {
  customer_id: string;
  customer_name: string;
  arr: number;

  signal_type: 'trend_worsening' | 'first_late' | 'payment_delay_increase';
  description: string;
  evidence: string;

  previous_behavior: string;
  current_behavior: string;
  severity: 'high' | 'medium' | 'low';

  recommended_action: string;
}

export interface PaymentImprover {
  customer_id: string;
  customer_name: string;
  arr: number;

  previous_on_time_rate: number;
  current_on_time_rate: number;
  improvement_percentage: number;
}

// ============================================
// Payment Analysis Response Types
// ============================================

export interface PaymentPatternAnalysis {
  file_id: string;
  analysis_date: string;

  // Overview
  portfolio_overview: PaymentPortfolioOverview;

  // Customer metrics
  customer_metrics: CustomerPaymentMetrics[];

  // Risk accounts
  high_risk_accounts: PaymentRiskAccount[];

  // Signals
  early_warnings: EarlyWarningSignal[];
  payment_improvers: PaymentImprover[];

  // Summary insights
  insights: string[];
  action_items: ActionItem[];
}

export interface ActionItem {
  customer_id: string;
  customer_name: string;
  priority: 'critical' | 'high' | 'medium';
  action_type: 'finance_escalation' | 'payment_plan' | 'reminder' | 'review' | 'monitor';
  description: string;
  recommended_by: string;
}

// ============================================
// Risk Signal Types
// ============================================

export interface PaymentRiskSignal {
  id: string;
  customer_id: string;
  customer_name: string;

  type: 'payment_risk';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  details: string;

  // Metrics
  on_time_rate: number;
  outstanding_amount: number;
  outstanding_percentage: number;
  pattern_description: string;

  // Recommendations
  recommended_actions: string[];
  recommended_owner: 'csm' | 'finance' | 'executive';

  created_at: string;
}

// ============================================
// Renewal Briefing Types
// ============================================

export interface PaymentContextBriefing {
  customer_id: string;
  customer_name: string;
  arr: number;
  renewal_date?: string;
  days_to_renewal?: number;

  // Payment context
  payment_summary: {
    on_time_rate: number;
    average_days_to_pay: number;
    trend: 'improving' | 'stable' | 'worsening';
    outstanding_balance: number;
    outstanding_percentage: number;
  };

  // Historical pattern
  quarterly_history: QuarterlyPaymentTrend[];

  // Red flags
  red_flags: string[];

  // Risk assessment
  financial_risk: 'high' | 'moderate-high' | 'moderate' | 'low';
  renewal_probability?: number;
  churn_risk?: 'high' | 'moderate' | 'low';

  // Strategy recommendations
  renewal_strategy: string[];
  talking_points: string[];

  // Next steps
  recommended_next_steps: string[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface UploadInvoicesRequest {
  file: File;
  column_mapping?: InvoiceColumnMapping;
}

export interface UploadInvoicesResponse {
  success: boolean;
  data?: InvoiceUploadResult;
  error?: {
    code: string;
    message: string;
  };
}

export interface AnalyzePaymentsRequest {
  file_id: string;
}

export interface AnalyzePaymentsResponse {
  success: boolean;
  data?: PaymentPatternAnalysis;
  error?: {
    code: string;
    message: string;
  };
}

export interface CustomerPaymentPatternsResponse {
  success: boolean;
  data?: CustomerPaymentMetrics;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaymentRiskAccountsResponse {
  success: boolean;
  data?: {
    high_risk: PaymentRiskAccount[];
    early_warnings: EarlyWarningSignal[];
    total_arr_at_risk: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface CreateRiskSignalRequest {
  customer_id: string;
  severity: 'critical' | 'high' | 'medium';
  details: string;
  recommended_actions: string[];
}

export interface RenewalBriefingResponse {
  success: boolean;
  data?: PaymentContextBriefing;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate risk level based on payment metrics
 */
export function calculatePaymentRiskLevel(
  onTimeRate: number,
  averageDaysToPay: number,
  outstandingPercentage: number
): CustomerPaymentMetrics['risk_level'] {
  // Critical if very poor payment behavior
  if (onTimeRate < 50 || outstandingPercentage > 30 || averageDaysToPay > 60) {
    return 'critical';
  }
  // High if concerning patterns
  if (onTimeRate < 65 || outstandingPercentage > 20 || averageDaysToPay > 45) {
    return 'high';
  }
  // Medium if some issues
  if (onTimeRate < 80 || outstandingPercentage > 10 || averageDaysToPay > 35) {
    return 'medium';
  }
  return 'low';
}

/**
 * Calculate payment trend from quarterly data
 */
export function calculatePaymentTrend(
  quarterlyData: QuarterlyPaymentTrend[]
): 'improving' | 'stable' | 'worsening' {
  if (quarterlyData.length < 2) return 'stable';

  const recent = quarterlyData.slice(-2);
  const onTimeChange = recent[1].on_time_rate - recent[0].on_time_rate;
  const daysChange = recent[1].average_days_to_pay - recent[0].average_days_to_pay;

  // Improving if on-time rate increasing OR days to pay decreasing significantly
  if (onTimeChange > 10 || daysChange < -5) return 'improving';

  // Worsening if on-time rate decreasing OR days to pay increasing significantly
  if (onTimeChange < -10 || daysChange > 5) return 'worsening';

  return 'stable';
}

/**
 * Calculate DSO (Days Sales Outstanding)
 */
export function calculateDSO(
  outstandingReceivables: number,
  totalRevenue: number,
  periodDays: number = 365
): number {
  if (totalRevenue === 0) return 0;
  return Math.round((outstandingReceivables / totalRevenue) * periodDays);
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
  return `${Math.round(value)}%`;
}

/**
 * Get risk level color
 */
export function getRiskLevelColor(level: 'critical' | 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'critical': return 'text-red-500';
    case 'high': return 'text-orange-500';
    case 'medium': return 'text-yellow-500';
    case 'low': return 'text-green-500';
  }
}

/**
 * Get risk level badge class
 */
export function getRiskLevelBadge(level: 'critical' | 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
}
