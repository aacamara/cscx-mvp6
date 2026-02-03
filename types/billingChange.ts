/**
 * Billing Change Types (PRD-110)
 *
 * Types for billing change detection and alerting
 */

// ============================================
// Billing Change Types
// ============================================

export type BillingChangeType =
  | 'payment_method_added'
  | 'payment_method_removed'
  | 'payment_method_updated'
  | 'billing_contact_changed'
  | 'failed_charge'
  | 'charge_succeeded_after_failure'
  | 'invoice_adjustment'
  | 'credit_applied'
  | 'payment_plan_created'
  | 'payment_plan_modified'
  | 'subscription_payment_method_changed';

export type BillingChangeAlertSeverity = 'info' | 'low' | 'medium' | 'high';

export type PaymentMethodType = 'card' | 'ach' | 'wire' | 'check' | 'other';

// ============================================
// Payment Method Details
// ============================================

export interface PaymentMethodDetails {
  type: PaymentMethodType;
  // Card details
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  // ACH details
  bankName?: string;
  accountLast4?: string;
  accountType?: 'checking' | 'savings';
  // Generic
  displayName: string;
}

// ============================================
// Billing Contact
// ============================================

export interface BillingContact {
  email: string;
  name?: string;
  phone?: string;
}

// ============================================
// Billing Change Event
// ============================================

export interface BillingChangeEvent {
  id: string;
  customerId: string;
  changeType: BillingChangeType;
  severity: BillingChangeAlertSeverity;

  // Change details
  previousValue?: PaymentMethodDetails | BillingContact | number | string;
  newValue?: PaymentMethodDetails | BillingContact | number | string;
  changedBy?: string;

  // For failed charges
  failedAmount?: number;
  failureReason?: string;
  failureCode?: string;
  attemptCount?: number;

  // For invoice adjustments
  invoiceId?: string;
  invoiceNumber?: string;
  adjustmentAmount?: number;
  adjustmentReason?: string;

  // For credits
  creditAmount?: number;
  creditReason?: string;

  // Metadata
  stripeEventId?: string;
  source: 'stripe' | 'manual' | 'salesforce' | 'system';
  metadata?: Record<string, unknown>;

  createdAt: Date;
}

// ============================================
// Billing Change Alert
// ============================================

export interface BillingChangeAlert {
  id: string;
  customerId: string;
  customerName: string;

  // Change information
  changeType: BillingChangeType;
  changeTitle: string;
  changeDescription: string;
  severity: BillingChangeAlertSeverity;

  // Details based on change type
  previousPaymentMethod?: PaymentMethodDetails;
  newPaymentMethod?: PaymentMethodDetails;
  previousBillingContact?: BillingContact;
  newBillingContact?: BillingContact;
  failedChargeDetails?: {
    amount: number;
    reason: string;
    code?: string;
    attemptCount: number;
    nextRetryDate?: Date;
  };
  invoiceAdjustment?: {
    invoiceId: string;
    invoiceNumber: string;
    originalAmount: number;
    adjustedAmount: number;
    adjustmentAmount: number;
    reason: string;
  };
  creditDetails?: {
    amount: number;
    reason: string;
    remainingBalance: number;
  };

  // Customer context
  context: {
    arr: number;
    paymentHistory: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
    onTimePaymentRate?: number;
    nextInvoiceDate?: Date;
    healthScore?: number;
    daysToRenewal?: number;
  };

  // AI-generated insight
  insight: string;
  recommendedAction?: string;

  // Status
  status: 'new' | 'acknowledged' | 'dismissed';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;

  // Notifications
  slackNotified: boolean;
  slackMessageTs?: string;
  emailNotified: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API Types
// ============================================

export interface BillingChangeAlertResponse {
  alert: BillingChangeAlert;
  customer: {
    id: string;
    name: string;
    arr: number;
  };
}

export interface GetBillingChangeAlertsRequest {
  customerId?: string;
  changeTypes?: BillingChangeType[];
  severity?: BillingChangeAlertSeverity[];
  status?: 'new' | 'acknowledged' | 'dismissed';
  limit?: number;
  offset?: number;
}

export interface GetBillingChangeAlertsResponse {
  alerts: BillingChangeAlert[];
  total: number;
  hasMore: boolean;
}

export interface BillingChangeSlackAlertData {
  customerId: string;
  customerName: string;
  alertId: string;

  changeType: BillingChangeType;
  changeTitle: string;
  changeEmoji: string;

  details: {
    previous: string;
    new: string;
    changedBy?: string;
  };

  context: {
    arr: number;
    paymentHistory: string;
    nextInvoice: string;
  };

  insight: string;
  isInformational: boolean;
}

// ============================================
// Helpers
// ============================================

export function getChangeSeverity(changeType: BillingChangeType): BillingChangeAlertSeverity {
  switch (changeType) {
    case 'failed_charge':
      return 'high';
    case 'billing_contact_changed':
    case 'payment_plan_modified':
      return 'medium';
    case 'payment_method_removed':
    case 'invoice_adjustment':
      return 'low';
    case 'payment_method_added':
    case 'payment_method_updated':
    case 'subscription_payment_method_changed':
    case 'credit_applied':
    case 'payment_plan_created':
    case 'charge_succeeded_after_failure':
      return 'info';
    default:
      return 'info';
  }
}

export function getChangeEmoji(changeType: BillingChangeType): string {
  switch (changeType) {
    case 'payment_method_added':
      return ':credit_card:';
    case 'payment_method_removed':
      return ':wastebasket:';
    case 'payment_method_updated':
    case 'subscription_payment_method_changed':
      return ':arrows_counterclockwise:';
    case 'billing_contact_changed':
      return ':bust_in_silhouette:';
    case 'failed_charge':
      return ':warning:';
    case 'charge_succeeded_after_failure':
      return ':white_check_mark:';
    case 'invoice_adjustment':
      return ':receipt:';
    case 'credit_applied':
      return ':moneybag:';
    case 'payment_plan_created':
    case 'payment_plan_modified':
      return ':calendar:';
    default:
      return ':credit_card:';
  }
}

export function getChangeTitle(changeType: BillingChangeType): string {
  switch (changeType) {
    case 'payment_method_added':
      return 'Payment Method Added';
    case 'payment_method_removed':
      return 'Payment Method Removed';
    case 'payment_method_updated':
      return 'Payment Method Updated';
    case 'subscription_payment_method_changed':
      return 'Subscription Payment Method Changed';
    case 'billing_contact_changed':
      return 'Billing Contact Changed';
    case 'failed_charge':
      return 'Failed Charge';
    case 'charge_succeeded_after_failure':
      return 'Payment Recovered';
    case 'invoice_adjustment':
      return 'Invoice Adjusted';
    case 'credit_applied':
      return 'Credit Applied';
    case 'payment_plan_created':
      return 'Payment Plan Created';
    case 'payment_plan_modified':
      return 'Payment Plan Modified';
    default:
      return 'Billing Change';
  }
}

export function formatPaymentMethod(pm: PaymentMethodDetails): string {
  switch (pm.type) {
    case 'card':
      return `${pm.cardBrand || 'Card'} ending ${pm.cardLast4}`;
    case 'ach':
      return `${pm.bankName || 'Bank'} ${pm.accountType || 'account'} ending ${pm.accountLast4}`;
    case 'wire':
      return 'Wire Transfer';
    case 'check':
      return 'Check';
    default:
      return pm.displayName || 'Other';
  }
}
