/**
 * Billing & Invoice Types
 * PRD-092: Invoice Overdue - Collections Alert
 *
 * Types for invoice tracking, overdue detection, and collections workflow
 */

// ============================================
// Invoice Types
// ============================================

export type InvoiceStatus =
  | 'pending'
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'void'
  | 'disputed';

export type PaymentMethod =
  | 'ach'
  | 'wire'
  | 'credit_card'
  | 'check'
  | 'other';

export type InvoiceSource =
  | 'stripe'
  | 'salesforce'
  | 'manual'
  | 'csv_import';

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  customer_id: string;
  invoice_number: string;

  // Invoice details
  amount: number;
  currency: string;
  description?: string;
  line_items: LineItem[];

  // Dates
  issued_at: Date;
  due_date: Date;
  paid_at?: Date;

  // Status
  status: InvoiceStatus;
  days_overdue: number;

  // Payment
  amount_paid: number;
  payment_method?: PaymentMethod;
  payment_reference?: string;

  // External
  stripe_invoice_id?: string;
  external_invoice_id?: string;
  source: InvoiceSource;

  metadata?: Record<string, unknown>;
  notes?: string;

  created_at: Date;
  updated_at: Date;
}

// ============================================
// Overdue Alert Types
// ============================================

export type OverdueAlertType =
  | 'overdue_7d'
  | 'overdue_14d'
  | 'overdue_30d'
  | 'overdue_60d';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AlertStatus =
  | 'pending'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'escalated';

export type ResolutionType =
  | 'paid'
  | 'payment_plan'
  | 'disputed'
  | 'write_off'
  | 'admin_issue';

export type ActionUrgency = 'immediate' | 'urgent' | 'standard';

export interface RelatedTicket {
  id: string;
  subject: string;
  status: string;
  created_at: Date;
}

export interface PaymentHistory {
  on_time: number;
  late: number;
  avg_days_to_pay: number;
  last_payment_date?: Date;
  payment_behavior: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
}

export interface InvoiceOverdueAlert {
  id: string;
  customer_id: string;
  invoice_id: string;

  // Alert classification
  alert_type: OverdueAlertType;
  severity: AlertSeverity;
  days_overdue: number;

  // Financial context
  invoice_amount: number;
  total_outstanding: number;
  total_overdue_invoices: number;

  // Payment history
  payment_history: PaymentHistory;
  is_first_time_overdue: boolean;

  // Customer context
  health_score?: number;
  last_meeting_date?: Date;
  open_support_tickets: number;
  recent_nps?: number;

  // Correlation
  related_tickets: RelatedTicket[];
  potential_dispute: boolean;
  dispute_reason?: string;

  // Recommendation
  recommended_action: string;
  action_urgency: ActionUrgency;
  suggested_outreach_template?: string;

  // Status
  status: AlertStatus;
  acknowledged_at?: Date;
  acknowledged_by?: string;
  resolved_at?: Date;
  resolved_by?: string;
  resolution_notes?: string;
  resolution_type?: ResolutionType;

  // Notifications
  csm_notified: boolean;
  csm_notified_at?: Date;
  finance_notified: boolean;
  finance_notified_at?: Date;
  manager_notified: boolean;
  manager_notified_at?: Date;
  slack_message_ts?: string;
  email_sent: boolean;

  // Task
  task_created: boolean;
  task_id?: string;

  created_at: Date;
  updated_at: Date;
}

// ============================================
// Collections Action Types
// ============================================

export type CollectionsActionType =
  | 'email_sent'
  | 'call_made'
  | 'meeting_scheduled'
  | 'payment_plan'
  | 'escalated'
  | 'dispute_filed'
  | 'follow_up_scheduled';

export type ActionPerformedBy = 'csm' | 'finance' | 'system' | 'manager';

export type ActionOutcome =
  | 'success'
  | 'no_response'
  | 'promise_to_pay'
  | 'dispute'
  | 'escalate';

export interface CollectionsAction {
  id: string;
  alert_id: string;
  customer_id: string;
  invoice_id: string;

  action_type: CollectionsActionType;
  action_by: ActionPerformedBy;
  performed_by?: string;

  description: string;
  outcome?: ActionOutcome;
  next_step?: string;
  next_action_date?: Date;

  metadata?: Record<string, unknown>;
  created_at: Date;
}

// ============================================
// Payment Record Types
// ============================================

export interface PaymentRecord {
  id: string;
  invoice_id: string;
  customer_id: string;

  amount: number;
  payment_date: Date;
  payment_method?: PaymentMethod;
  reference?: string;

  days_from_due: number;
  was_on_time: boolean;

  stripe_payment_id?: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
}

// ============================================
// API Response Types
// ============================================

export interface CustomerBillingOverview {
  customer_id: string;
  customer_name: string;

  // Summary
  total_outstanding: number;
  oldest_overdue_days: number;
  overdue_invoice_count: number;

  // Payment history
  payment_history: PaymentHistory;

  // Invoices
  invoices: Invoice[];
  overdue_invoices: Invoice[];

  // Context
  is_first_time_overdue: boolean;
  health_score?: number;
  open_support_tickets: number;
}

export interface OverdueCheckResult {
  customer_id: string;
  customer_name: string;
  invoice_id: string;
  invoice_number: string;
  amount: number;
  due_date: Date;
  days_overdue: number;
  milestone: OverdueAlertType;
  severity: AlertSeverity;
  is_new_alert: boolean;
  alert?: InvoiceOverdueAlert;
}

// ============================================
// Slack Alert Types
// ============================================

export interface InvoiceOverdueSlackAlert {
  customerId: string;
  customerName: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  severity: AlertSeverity;
  totalOutstanding: number;

  paymentHistory: {
    previousInvoices: string; // e.g., "Previous 4 invoices: Paid on time"
    isFirstOverdue: boolean;
  };

  contextCheck: {
    openTickets: number;
    healthScore: number;
    lastMeeting?: string;
    recentNps?: number;
  };

  recommendedApproach: string;
  alertId: string;
}

// ============================================
// Configuration Types
// ============================================

export interface OverdueAlertConfig {
  enabled: boolean;
  milestones: number[]; // [7, 14, 30, 60]
  auto_escalate_at: number; // Days to auto-escalate to finance
  finance_notify_at: number; // Days to notify finance
  manager_notify_at: number; // Days to notify manager
  slack_channel?: string;
  email_template_id?: string;
}

export const DEFAULT_OVERDUE_CONFIG: OverdueAlertConfig = {
  enabled: true,
  milestones: [7, 14, 30, 60],
  auto_escalate_at: 45,
  finance_notify_at: 30,
  manager_notify_at: 60,
};

// ============================================
// Severity/Alert Type Helpers
// ============================================

export function getSeverityFromDays(daysOverdue: number): AlertSeverity {
  if (daysOverdue >= 60) return 'critical';
  if (daysOverdue >= 30) return 'high';
  if (daysOverdue >= 14) return 'medium';
  return 'low';
}

export function getAlertTypeFromDays(daysOverdue: number): OverdueAlertType | null {
  if (daysOverdue >= 60) return 'overdue_60d';
  if (daysOverdue >= 30) return 'overdue_30d';
  if (daysOverdue >= 14) return 'overdue_14d';
  if (daysOverdue >= 7) return 'overdue_7d';
  return null;
}

export function getMilestoneFromDays(daysOverdue: number): number | null {
  if (daysOverdue >= 60) return 60;
  if (daysOverdue >= 30) return 30;
  if (daysOverdue >= 14) return 14;
  if (daysOverdue >= 7) return 7;
  return null;
}

export function getUrgencyFromSeverity(severity: AlertSeverity): ActionUrgency {
  switch (severity) {
    case 'critical':
      return 'immediate';
    case 'high':
      return 'urgent';
    default:
      return 'standard';
  }
}
