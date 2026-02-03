/**
 * Invoice Notification Types (Server)
 * PRD-125: Invoice Generated -> CSM Notification
 *
 * Re-exports shared types and adds server-specific types
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
  | 'first_invoice'
  | 'significant_amount_change'
  | 'declining_health'
  | 'late_payment_history'
  | 'contract_dispute'
  | 'high_value'
  | 'renewal_approaching'
  | 'support_issues';

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
  riskScore: number;
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
  amount_due: number;
  currency: string;
  due_date: number;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  number?: string;
  metadata?: Record<string, string>;
}

export interface ChargebeeInvoiceWebhook {
  id: string;
  customer_id: string;
  total: number;
  currency_code: string;
  due_date: number;
  status: 'pending' | 'paid' | 'payment_due' | 'not_paid' | 'voided' | 'posted';
  invoice_number?: string;
}

export interface ManualInvoiceUpload {
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  dueDate: string;
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
    minAmountForSlack: number;
    minAmountForImmediate: number;
  };
  digestSchedule: 'daily' | 'weekly';
  digestTime: string;
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

// ============================================
// Notification Event (for WebSocket)
// ============================================

export interface InvoiceNotificationEvent {
  type: 'invoice:created' | 'invoice:updated' | 'invoice:overdue' | 'invoice:paid';
  notification: InvoiceNotification;
  timestamp: string;
}
