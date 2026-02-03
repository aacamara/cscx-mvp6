/**
 * Invoice Notification Types
 * PRD-125: Invoice Generated -> CSM Notification
 */

// ============================================
// Invoice Status
// ============================================

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'failed';

export type PaymentHistory = 'excellent' | 'good' | 'fair' | 'poor';

export type BillingSource = 'stripe' | 'chargebee' | 'salesforce' | 'manual';

// ============================================
// Risk Flags
// ============================================

export type InvoiceRiskFlag =
  | 'first_invoice'           // New customer, first invoice
  | 'significant_amount_change' // Amount changed significantly from last invoice
  | 'declining_health'        // Customer health score is declining
  | 'late_payment_history'    // Previous late payments
  | 'contract_dispute'        // History of contract disputes
  | 'high_value'              // High-value invoice (strategic account)
  | 'renewal_approaching'     // Renewal within 90 days
  | 'support_issues';         // Recent support escalations

// ============================================
// Customer Context
// ============================================

export interface InvoiceCustomerContext {
  healthScore: number;
  healthTrend: 'improving' | 'stable' | 'declining';
  paymentHistory: PaymentHistory;
  renewalDate: Date | null;
  daysToRenewal: number | null;
  recentIssues: boolean;
  recentIssueCount?: number;
  valueDelivered?: {
    summary: string;
    metrics?: Array<{
      name: string;
      value: string;
      change?: string;
    }>;
  };
  contractValue: number;
  segment: string;
  csmName: string;
  primaryContact?: {
    name: string;
    email: string;
    title?: string;
  };
}

// ============================================
// Invoice Notification
// ============================================

export interface InvoiceNotification {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  customerId: string;
  customerName: string;
  csmId: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: InvoiceStatus;
  billingSource: BillingSource;
  riskFlags: InvoiceRiskFlag[];
  riskScore: number; // 0-100, calculated from risk flags
  customerContext: InvoiceCustomerContext;
  recommendedActions: string[];
  notifiedAt: Date;
  acknowledgedAt: Date | null;
  actionTaken: string | null;
  paymentReceivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Webhook Payloads
// ============================================

export interface StripeInvoiceWebhook {
  id: string;
  object: 'invoice';
  customer: string;
  customer_email?: string;
  customer_name?: string;
  amount_due: number; // in cents
  currency: string;
  due_date: number; // Unix timestamp
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  number?: string;
  metadata?: Record<string, string>;
}

export interface ChargebeeInvoiceWebhook {
  id: string;
  customer_id: string;
  total: number; // in cents
  currency_code: string;
  due_date: number; // Unix timestamp
  status: 'pending' | 'paid' | 'payment_due' | 'not_paid' | 'voided' | 'posted';
  invoice_number?: string;
}

export interface ManualInvoiceUpload {
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  dueDate: string; // ISO date string
  invoiceNumber?: string;
  notes?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateInvoiceNotificationRequest {
  source: BillingSource;
  webhookData?: StripeInvoiceWebhook | ChargebeeInvoiceWebhook;
  manualData?: ManualInvoiceUpload;
}

export interface InvoiceNotificationFilters {
  status?: InvoiceStatus | 'all';
  csmId?: string;
  customerId?: string;
  minAmount?: number;
  maxAmount?: number;
  hasRiskFlags?: boolean;
  startDate?: string;
  endDate?: string;
  acknowledged?: boolean;
}

export interface InvoiceNotificationListResponse {
  success: boolean;
  notifications: InvoiceNotification[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalPending: number;
    totalOverdue: number;
    totalAtRisk: number;
    totalAmount: number;
  };
}

export interface InvoiceNotificationDetailResponse {
  success: boolean;
  notification: InvoiceNotification;
  relatedInvoices?: InvoiceNotification[];
  suggestedOutreach?: {
    type: 'email' | 'call' | 'meeting';
    subject?: string;
    template?: string;
    timing: string;
  };
}

// ============================================
// Value Reinforcement
// ============================================

export interface ValueReinforcementPrompt {
  customerId: string;
  customerName: string;
  invoiceId: string;
  invoiceAmount: number;
  actions: Array<{
    id: string;
    type: 'send_value_summary' | 'schedule_checkin' | 'share_metrics' | 'address_concerns';
    label: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    template?: string;
  }>;
  valueSummary?: {
    roi?: string;
    keyWins: string[];
    metrics: Array<{ name: string; value: string }>;
  };
}

// ============================================
// Notification Preferences
// ============================================

export interface InvoiceNotificationPreferences {
  csmId: string;
  channels: {
    inApp: boolean;
    slack: boolean;
    emailDigest: boolean;
  };
  thresholds: {
    minAmountForSlack: number;    // Only Slack notify for invoices above this amount
    minAmountForImmediate: number; // Immediate notification vs digest
  };
  digestSchedule: 'daily' | 'weekly';
  digestTime: string; // HH:MM format
}

// ============================================
// Dashboard Types
// ============================================

export interface InvoiceDashboard {
  csmId: string;
  summary: {
    pendingCount: number;
    pendingAmount: number;
    overdueCount: number;
    overdueAmount: number;
    atRiskCount: number;
    atRiskAmount: number;
    paidThisMonth: number;
    collectionRate: number;
  };
  recentNotifications: InvoiceNotification[];
  upcomingDueDates: Array<{
    notification: InvoiceNotification;
    daysUntilDue: number;
  }>;
  riskAlerts: Array<{
    notification: InvoiceNotification;
    primaryRisk: InvoiceRiskFlag;
    recommendedAction: string;
  }>;
  valueReinforcementQueue: ValueReinforcementPrompt[];
}
