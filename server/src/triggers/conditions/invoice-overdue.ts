/**
 * Invoice Overdue Condition Processor (PRD-092)
 * Fires when invoices reach overdue milestones (7, 14, 30, 60 days)
 *
 * Detects:
 * - Invoice passes overdue milestone threshold
 * - Multiple invoices overdue for same customer
 * - Payment pattern degradation
 *
 * Severity calculation:
 * - 7 days = low
 * - 14 days = medium
 * - 30 days = high
 * - 60+ days = critical
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';
import {
  getSeverityFromDays,
  getAlertTypeFromDays,
  getMilestoneFromDays,
  AlertSeverity,
  OverdueAlertType,
} from '../../services/billing/types.js';

export interface InvoiceOverdueParams {
  milestone?: number;                     // Specific milestone to trigger on (7, 14, 30, 60)
  minAmount?: number;                     // Minimum invoice amount to trigger
  minTotalOutstanding?: number;           // Minimum total outstanding to trigger
  severity?: AlertSeverity;               // Filter by severity
  includeRepeatOffenders?: boolean;       // Only trigger for repeat late payers
  excludeFirstTimeOverdue?: boolean;      // Don't trigger for first-time overdue
  escalateToFinance?: boolean;            // Should this trigger finance notification
  cooldownDays?: number;                  // Cooldown period between alerts
}

export interface InvoiceOverdueEventData {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  milestone: number;
  severity: AlertSeverity;
  totalOutstanding: number;
  overdueInvoiceCount: number;
  isFirstTimeOverdue: boolean;
  paymentHistory?: {
    onTime: number;
    late: number;
    avgDaysToPay: number;
  };
}

export const invoiceOverdueProcessor: ConditionProcessor = {
  type: 'invoice_overdue' as any, // Will add to TriggerType

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process invoice overdue events
    if (event.type !== 'invoice_overdue' as any) {
      return false;
    }

    const params = condition.params as InvoiceOverdueParams;
    const eventData = event.data as InvoiceOverdueEventData;

    // Check milestone filter
    if (params.milestone !== undefined) {
      const eventMilestone = getMilestoneFromDays(eventData.daysOverdue);
      if (eventMilestone !== params.milestone) {
        return false;
      }
    }

    // Check minimum amount
    if (params.minAmount !== undefined && eventData.amount < params.minAmount) {
      return false;
    }

    // Check minimum total outstanding
    if (params.minTotalOutstanding !== undefined && eventData.totalOutstanding < params.minTotalOutstanding) {
      return false;
    }

    // Check severity filter
    if (params.severity !== undefined) {
      const eventSeverity = getSeverityFromDays(eventData.daysOverdue);
      const severityOrder: Record<AlertSeverity, number> = {
        low: 1,
        medium: 2,
        high: 3,
        critical: 4,
      };

      // Only fire for specified severity or higher
      if (severityOrder[eventSeverity] < severityOrder[params.severity]) {
        return false;
      }
    }

    // Check repeat offender filter
    if (params.includeRepeatOffenders && eventData.isFirstTimeOverdue) {
      return false;
    }

    // Check first-time overdue exclusion
    if (params.excludeFirstTimeOverdue && eventData.isFirstTimeOverdue) {
      return false;
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const params = condition.params as InvoiceOverdueParams;
    const parts: string[] = [];

    if (params.milestone !== undefined) {
      parts.push(`at ${params.milestone}-day milestone`);
    } else {
      parts.push('at any milestone (7, 14, 30, 60 days)');
    }

    if (params.severity !== undefined) {
      parts.push(`severity ${params.severity} or higher`);
    }

    if (params.minAmount !== undefined) {
      parts.push(`amount >= $${params.minAmount.toLocaleString()}`);
    }

    if (params.minTotalOutstanding !== undefined) {
      parts.push(`total outstanding >= $${params.minTotalOutstanding.toLocaleString()}`);
    }

    if (params.includeRepeatOffenders) {
      parts.push('repeat offenders only');
    }

    if (params.excludeFirstTimeOverdue) {
      parts.push('excluding first-time overdue');
    }

    if (params.escalateToFinance) {
      parts.push('with finance escalation');
    }

    return `Invoice overdue ${parts.join(', ')}`;
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const params = condition.params as InvoiceOverdueParams;

    // Validate milestone
    if (params.milestone !== undefined) {
      const validMilestones = [7, 14, 30, 60];
      if (!validMilestones.includes(params.milestone)) {
        return { valid: false, error: `milestone must be one of: ${validMilestones.join(', ')}` };
      }
    }

    // Validate minimum amount
    if (params.minAmount !== undefined) {
      if (typeof params.minAmount !== 'number' || params.minAmount < 0) {
        return { valid: false, error: 'minAmount must be a non-negative number' };
      }
    }

    // Validate minimum total outstanding
    if (params.minTotalOutstanding !== undefined) {
      if (typeof params.minTotalOutstanding !== 'number' || params.minTotalOutstanding < 0) {
        return { valid: false, error: 'minTotalOutstanding must be a non-negative number' };
      }
    }

    // Validate severity
    if (params.severity !== undefined) {
      const validSeverities: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
      if (!validSeverities.includes(params.severity)) {
        return { valid: false, error: `severity must be one of: ${validSeverities.join(', ')}` };
      }
    }

    // Validate cooldown
    if (params.cooldownDays !== undefined) {
      if (typeof params.cooldownDays !== 'number' || params.cooldownDays < 1) {
        return { valid: false, error: 'cooldownDays must be at least 1' };
      }
    }

    // Check conflicting options
    if (params.includeRepeatOffenders && params.excludeFirstTimeOverdue) {
      return {
        valid: false,
        error: 'Cannot use both includeRepeatOffenders and excludeFirstTimeOverdue',
      };
    }

    return { valid: true };
  },
};

// ============================================
// Helper Functions for External Use
// ============================================

/**
 * Get due date offset in hours based on severity
 * Used for task creation
 */
export function getDueDateOffsetHours(severity: AlertSeverity): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 12;
    case 'medium':
      return 24;
    case 'low':
    default:
      return 48;
  }
}

/**
 * Determine if finance should be notified based on days overdue
 */
export function shouldNotifyFinance(daysOverdue: number): boolean {
  return daysOverdue >= 30;
}

/**
 * Determine if manager should be notified based on days overdue
 */
export function shouldNotifyManager(daysOverdue: number): boolean {
  return daysOverdue >= 60;
}

/**
 * Get escalation level based on days overdue
 */
export function getEscalationLevel(daysOverdue: number): 'none' | 'csm' | 'finance' | 'manager' {
  if (daysOverdue >= 60) return 'manager';
  if (daysOverdue >= 30) return 'finance';
  if (daysOverdue >= 7) return 'csm';
  return 'none';
}
