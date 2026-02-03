/**
 * Invoice Overdue Slack Alerts
 * PRD-092: Invoice Overdue - Collections Alert
 *
 * Formats and sends Slack alerts for overdue invoices
 */

import { SlackService, SendMessageOptions } from '../slack/index.js';
import {
  InvoiceOverdueSlackAlert,
  AlertSeverity,
  InvoiceOverdueAlert,
  PaymentHistory,
} from './types.js';

// ============================================
// Severity Emoji Mapping
// ============================================

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  low: ':large_yellow_circle:',
  medium: ':warning:',
  high: ':rotating_light:',
  critical: ':fire:',
};

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  low: '#FCD34D', // Yellow
  medium: '#F59E0B', // Orange
  high: '#EF4444', // Red
  critical: '#DC2626', // Dark Red
};

// ============================================
// Slack Alert Service
// ============================================

export class InvoiceOverdueSlackAlerts {
  private slackService: SlackService;

  constructor() {
    this.slackService = new SlackService();
  }

  // ============================================
  // CSM Alert (FR-3.1)
  // ============================================

  /**
   * Send overdue invoice alert to CSM
   */
  async sendCsmAlert(
    userId: string,
    channelOrUserId: string,
    alertData: InvoiceOverdueSlackAlert
  ): Promise<string | undefined> {
    const blocks = this.buildCsmAlertBlocks(alertData);

    const options: SendMessageOptions = {
      channel: channelOrUserId,
      text: `${SEVERITY_EMOJI[alertData.severity]} Invoice Overdue: ${alertData.customerName}`,
      blocks,
    };

    try {
      const result = await this.slackService.sendMessage(userId, options);
      return result.ts;
    } catch (error) {
      console.error('[InvoiceOverdueSlackAlerts] Failed to send CSM alert:', error);
      return undefined;
    }
  }

  /**
   * Send DM to CSM
   */
  async sendCsmDm(
    userId: string,
    csmSlackUserId: string,
    alertData: InvoiceOverdueSlackAlert
  ): Promise<string | undefined> {
    const blocks = this.buildCsmAlertBlocks(alertData);

    try {
      const result = await this.slackService.sendDM(
        userId,
        csmSlackUserId,
        `${SEVERITY_EMOJI[alertData.severity]} Invoice Overdue: ${alertData.customerName}`,
        blocks
      );
      return result.ts;
    } catch (error) {
      console.error('[InvoiceOverdueSlackAlerts] Failed to send CSM DM:', error);
      return undefined;
    }
  }

  // ============================================
  // Finance Team Alert (FR-3.2)
  // ============================================

  /**
   * Send escalation alert to Finance team (for 30+ day overdue)
   */
  async sendFinanceAlert(
    userId: string,
    financeChannelId: string,
    alertData: InvoiceOverdueSlackAlert,
    csmName: string
  ): Promise<void> {
    const blocks = this.buildFinanceAlertBlocks(alertData, csmName);

    const options: SendMessageOptions = {
      channel: financeChannelId,
      text: `:money_with_wings: Collections Alert: ${alertData.customerName} - $${alertData.amount.toLocaleString()} (${alertData.daysOverdue} days overdue)`,
      blocks,
    };

    try {
      await this.slackService.sendMessage(userId, options);
    } catch (error) {
      console.error('[InvoiceOverdueSlackAlerts] Failed to send finance alert:', error);
    }
  }

  // ============================================
  // Block Builders
  // ============================================

  /**
   * Build Slack blocks for CSM alert
   * Matches the UI/UX spec from PRD-092
   */
  private buildCsmAlertBlocks(alertData: InvoiceOverdueSlackAlert): any[] {
    const blocks: any[] = [];
    const severity = alertData.severity;
    const emoji = SEVERITY_EMOJI[severity];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} Invoice Overdue: ${alertData.customerName}`,
        emoji: true,
      },
    });

    // Invoice details section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Invoice *#${alertData.invoiceNumber}* is *${alertData.daysOverdue} days past due*`,
      },
    });

    // Amount and status
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Amount:* $${alertData.amount.toLocaleString()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Due Date:* ${alertData.dueDate}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Status:* ${alertData.daysOverdue} days overdue`,
        },
        {
          type: 'mrkdwn',
          text: `*Total Outstanding:* $${alertData.totalOutstanding.toLocaleString()}`,
        },
      ],
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Payment History
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Payment History:*',
      },
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `- ${alertData.paymentHistory.previousInvoices}\n- ${alertData.paymentHistory.isFirstOverdue ? 'This is first overdue occurrence' : 'Has had previous overdue invoices'}`,
      },
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Context Check
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Context Check:*',
      },
    });

    const contextItems: string[] = [];
    contextItems.push(`- ${alertData.contextCheck.openTickets === 0 ? 'No open support tickets' : `${alertData.contextCheck.openTickets} open support ticket(s)`}`);
    contextItems.push(`- Health Score: ${alertData.contextCheck.healthScore} ${this.getHealthTrend(alertData.contextCheck.healthScore)}`);

    if (alertData.contextCheck.lastMeeting) {
      contextItems.push(`- Last meeting: ${alertData.contextCheck.lastMeeting}`);
    }

    if (alertData.contextCheck.recentNps !== undefined) {
      contextItems.push(`- Recent NPS: ${alertData.contextCheck.recentNps}`);
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: contextItems.join('\n'),
      },
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Recommended Approach
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Recommended Approach:*\n${alertData.recommendedApproach}`,
      },
    });

    // Action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Send Soft Check-In',
            emoji: true,
          },
          style: 'primary',
          action_id: 'send_overdue_checkin',
          value: JSON.stringify({
            alertId: alertData.alertId,
            customerId: alertData.customerId,
            invoiceId: alertData.invoiceId,
          }),
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Invoice',
            emoji: true,
          },
          action_id: 'view_invoice',
          value: alertData.invoiceId,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Customer',
            emoji: true,
          },
          url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customers/${alertData.customerId}`,
        },
      ],
    });

    // Add escalation button for high severity
    if (severity === 'high' || severity === 'critical') {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Escalate to Finance',
              emoji: true,
            },
            style: 'danger',
            action_id: 'escalate_to_finance',
            value: alertData.alertId,
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Schedule Call',
              emoji: true,
            },
            action_id: 'schedule_collections_call',
            value: alertData.customerId,
          },
        ],
      });
    }

    return blocks;
  }

  /**
   * Build Slack blocks for Finance team alert
   */
  private buildFinanceAlertBlocks(alertData: InvoiceOverdueSlackAlert, csmName: string): any[] {
    const blocks: any[] = [];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:money_with_wings: Collections Escalation: ${alertData.customerName}`,
        emoji: true,
      },
    });

    // Context
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `CSM: *${csmName}* | Severity: *${alertData.severity.toUpperCase()}*`,
        },
      ],
    });

    // Key details
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Invoice:* #${alertData.invoiceNumber}`,
        },
        {
          type: 'mrkdwn',
          text: `*Amount:* $${alertData.amount.toLocaleString()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Days Overdue:* ${alertData.daysOverdue}`,
        },
        {
          type: 'mrkdwn',
          text: `*Total Outstanding:* $${alertData.totalOutstanding.toLocaleString()}`,
        },
      ],
    });

    // Payment history context
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Payment History:*\n${alertData.paymentHistory.previousInvoices}`,
      },
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Start Collections Process',
            emoji: true,
          },
          style: 'primary',
          action_id: 'start_collections',
          value: alertData.alertId,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Contact CSM',
            emoji: true,
          },
          action_id: 'contact_csm_collections',
          value: alertData.alertId,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Account',
            emoji: true,
          },
          url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customers/${alertData.customerId}`,
        },
      ],
    });

    return blocks;
  }

  // ============================================
  // Helpers
  // ============================================

  private getHealthTrend(score: number): string {
    if (score >= 80) return '(healthy)';
    if (score >= 60) return '(stable)';
    if (score >= 40) return '(at risk)';
    return '(critical)';
  }

  /**
   * Format alert data from database model
   */
  formatAlertData(
    alert: InvoiceOverdueAlert,
    invoice: { invoice_number: string; amount: number; due_date: string },
    customer: { name: string; id: string }
  ): InvoiceOverdueSlackAlert {
    const paymentHistory = alert.payment_history as PaymentHistory;

    return {
      customerId: alert.customer_id,
      customerName: customer.name,
      invoiceId: alert.invoice_id,
      invoiceNumber: invoice.invoice_number,
      amount: invoice.amount,
      dueDate: new Date(invoice.due_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      daysOverdue: alert.days_overdue,
      severity: alert.severity,
      totalOutstanding: alert.total_outstanding,
      paymentHistory: {
        previousInvoices: paymentHistory.on_time > 0
          ? `Previous ${paymentHistory.on_time + paymentHistory.late} invoices: ${paymentHistory.on_time} paid on time`
          : 'No previous payment history',
        isFirstOverdue: alert.is_first_time_overdue,
      },
      contextCheck: {
        openTickets: alert.open_support_tickets,
        healthScore: alert.health_score || 0,
        lastMeeting: alert.last_meeting_date
          ? new Date(alert.last_meeting_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : undefined,
        recentNps: alert.recent_nps,
      },
      recommendedApproach: alert.recommended_action,
      alertId: alert.id,
    };
  }
}

// Singleton instance
export const invoiceOverdueSlackAlerts = new InvoiceOverdueSlackAlerts();
