/**
 * Slack Notification Service - PRD-186
 *
 * Implements Slack notification integration:
 * - Block Kit formatted notifications
 * - Health score change alerts
 * - Renewal approaching alerts
 * - Escalation notifications
 * - Daily digest summaries
 * - Interactive message buttons
 * - Notification preferences per user
 * - Message queue with retry
 */

import { WebClient, KnownBlock, Block } from '@slack/web-api';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';
import { withRetry, retryStrategies } from '../retry.js';
import crypto from 'crypto';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Circuit breaker for Slack API calls
const slackNotificationCircuitBreaker = new CircuitBreaker('slack-notifications', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000,
});

// ============================================
// Types
// ============================================

export type NotificationType =
  | 'health_drop'
  | 'health_recovery'
  | 'renewal_approaching'
  | 'escalation_created'
  | 'escalation_resolved'
  | 'task_due'
  | 'approval_request'
  | 'churn_risk'
  | 'daily_digest'
  | 'weekly_summary';

export type DeliveryMethod = 'dm' | 'channel';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export interface NotificationPreferences {
  id?: string;
  userId: string;
  slackUserId?: string;
  channelId?: string;
  enabledTypes: NotificationType[];
  deliveryMethod: DeliveryMethod;
  quietStart?: string; // HH:MM format
  quietEnd?: string;   // HH:MM format
  timezone: string;
  urgencyThreshold: UrgencyLevel;
  digestTime?: string; // HH:MM format for daily digest
  weeklyDigestDay?: number; // 0-6 (Sunday-Saturday)
  enabled: boolean;
}

export interface HealthScoreChangePayload {
  customerId: string;
  customerName: string;
  previousScore: number;
  currentScore: number;
  trend: 'up' | 'down' | 'stable';
  factors?: string[];
  accountUrl: string;
}

export interface RenewalPayload {
  customerId: string;
  customerName: string;
  renewalDate: Date;
  daysUntilRenewal: number;
  arr: number;
  riskLevel: UrgencyLevel;
  accountUrl: string;
}

export interface EscalationPayload {
  escalationId: string;
  customerId: string;
  customerName: string;
  title: string;
  severity: UrgencyLevel;
  assigneeId?: string;
  description: string;
  escalationUrl: string;
}

export interface TaskPayload {
  taskId: string;
  customerId?: string;
  customerName?: string;
  title: string;
  dueDate: Date;
  priority: UrgencyLevel;
  taskUrl: string;
}

export interface ApprovalPayload {
  approvalId: string;
  requestType: string;
  customerId?: string;
  customerName?: string;
  description: string;
  requestedBy: string;
  approvalUrl: string;
}

export interface DigestPayload {
  portfolioHealth: {
    healthy: number;
    atRisk: number;
    critical: number;
  };
  tasksDueToday: Array<{
    id: string;
    title: string;
    customerName?: string;
  }>;
  upcomingRenewals: Array<{
    customerName: string;
    daysUntil: number;
    arr: number;
  }>;
  atRiskAccounts: Array<{
    customerName: string;
    healthScore: number;
    trend: string;
  }>;
  pendingApprovals: number;
}

export interface NotificationResult {
  success: boolean;
  messageTs?: string;
  channelId?: string;
  error?: string;
}

export interface QueuedNotification {
  id: string;
  userId: string;
  notificationType: NotificationType;
  payload: unknown;
  urgency: UrgencyLevel;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  retryCount: number;
  scheduledFor?: Date;
  sentAt?: Date;
  error?: string;
}

// ============================================
// Block Kit Templates
// ============================================

const EMOJI_MAP: Record<UrgencyLevel, string> = {
  low: ':information_source:',
  medium: ':warning:',
  high: ':rotating_light:',
  critical: ':fire:',
};

const HEALTH_EMOJI_MAP: Record<string, string> = {
  up: ':chart_with_upwards_trend:',
  down: ':chart_with_downwards_trend:',
  stable: ':heavy_minus_sign:',
};

function buildHealthScoreBlocks(payload: HealthScoreChangePayload): KnownBlock[] {
  const emoji = payload.trend === 'down' ? ':warning:' : ':white_check_mark:';
  const changeText = payload.trend === 'down'
    ? `dropped from ${payload.previousScore} to ${payload.currentScore}`
    : `improved from ${payload.previousScore} to ${payload.currentScore}`;

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *Health Score Alert*\n*${payload.customerName}* ${changeText}`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Previous Score:*\n${payload.previousScore}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Score:*\n${payload.currentScore}`,
        },
        {
          type: 'mrkdwn',
          text: `*Trend:*\n${HEALTH_EMOJI_MAP[payload.trend]} ${payload.trend.charAt(0).toUpperCase() + payload.trend.slice(1)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Change:*\n${payload.currentScore - payload.previousScore > 0 ? '+' : ''}${payload.currentScore - payload.previousScore}`,
        },
      ],
    },
  ];

  if (payload.factors && payload.factors.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Contributing Factors:*\n${payload.factors.map(f => `- ${f}`).join('\n')}`,
      },
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Account', emoji: true },
        url: payload.accountUrl,
        style: 'primary',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Acknowledge', emoji: true },
        action_id: `acknowledge_health_alert_${payload.customerId}`,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Snooze 24h', emoji: true },
        action_id: `snooze_health_alert_${payload.customerId}`,
      },
    ],
  });

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Sent via CSCX.AI | ${new Date().toLocaleString()}`,
      },
    ],
  });

  return blocks;
}

function buildRenewalBlocks(payload: RenewalPayload): KnownBlock[] {
  const urgencyEmoji = EMOJI_MAP[payload.riskLevel];

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${urgencyEmoji} *Renewal Approaching*\n*${payload.customerName}* renews in *${payload.daysUntilRenewal} days*`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Renewal Date:*\n${payload.renewalDate.toLocaleDateString()}`,
        },
        {
          type: 'mrkdwn',
          text: `*ARR:*\n$${payload.arr.toLocaleString()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Days Until:*\n${payload.daysUntilRenewal}`,
        },
        {
          type: 'mrkdwn',
          text: `*Risk Level:*\n${payload.riskLevel.toUpperCase()}`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Account', emoji: true },
          url: payload.accountUrl,
          style: 'primary',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Schedule Meeting', emoji: true },
          action_id: `schedule_renewal_meeting_${payload.customerId}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent via CSCX.AI | ${new Date().toLocaleString()}`,
        },
      ],
    },
  ];

  return blocks;
}

function buildEscalationBlocks(payload: EscalationPayload): KnownBlock[] {
  const urgencyEmoji = EMOJI_MAP[payload.severity];

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${urgencyEmoji} *Escalation Created*\n*${payload.title}*`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Customer:*\n${payload.customerName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Severity:*\n${payload.severity.toUpperCase()}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Description:*\n${payload.description.substring(0, 500)}${payload.description.length > 500 ? '...' : ''}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Escalation', emoji: true },
          url: payload.escalationUrl,
          style: 'danger',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Acknowledge', emoji: true },
          action_id: `acknowledge_escalation_${payload.escalationId}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent via CSCX.AI | ${new Date().toLocaleString()}`,
        },
      ],
    },
  ];

  return blocks;
}

function buildTaskDueBlocks(payload: TaskPayload): KnownBlock[] {
  const urgencyEmoji = EMOJI_MAP[payload.priority];

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${urgencyEmoji} *Task Due*\n*${payload.title}*`,
      },
    },
    {
      type: 'section',
      fields: [
        ...(payload.customerName
          ? [
              {
                type: 'mrkdwn' as const,
                text: `*Customer:*\n${payload.customerName}`,
              },
            ]
          : []),
        {
          type: 'mrkdwn' as const,
          text: `*Due Date:*\n${payload.dueDate.toLocaleDateString()}`,
        },
        {
          type: 'mrkdwn' as const,
          text: `*Priority:*\n${payload.priority.toUpperCase()}`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Task', emoji: true },
          url: payload.taskUrl,
          style: 'primary',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Mark Complete', emoji: true },
          action_id: `complete_task_${payload.taskId}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Snooze', emoji: true },
          action_id: `snooze_task_${payload.taskId}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent via CSCX.AI | ${new Date().toLocaleString()}`,
        },
      ],
    },
  ];

  return blocks;
}

function buildApprovalBlocks(payload: ApprovalPayload): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:clipboard: *Approval Request*\n*${payload.requestType}*`,
      },
    },
    {
      type: 'section',
      fields: [
        ...(payload.customerName
          ? [
              {
                type: 'mrkdwn' as const,
                text: `*Customer:*\n${payload.customerName}`,
              },
            ]
          : []),
        {
          type: 'mrkdwn' as const,
          text: `*Requested By:*\n${payload.requestedBy}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Details:*\n${payload.description}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve', emoji: true },
          action_id: `approve_request_${payload.approvalId}`,
          style: 'primary',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject', emoji: true },
          action_id: `reject_request_${payload.approvalId}`,
          style: 'danger',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Details', emoji: true },
          url: payload.approvalUrl,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent via CSCX.AI | ${new Date().toLocaleString()}`,
        },
      ],
    },
  ];

  return blocks;
}

function buildDailyDigestBlocks(payload: DigestPayload): KnownBlock[] {
  const totalAccounts =
    payload.portfolioHealth.healthy +
    payload.portfolioHealth.atRisk +
    payload.portfolioHealth.critical;

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':sunrise: Daily Portfolio Summary',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Good morning! Here's your portfolio overview for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*:heart: Portfolio Health*',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `:white_check_mark: *Healthy:* ${payload.portfolioHealth.healthy}`,
        },
        {
          type: 'mrkdwn',
          text: `:warning: *At Risk:* ${payload.portfolioHealth.atRisk}`,
        },
        {
          type: 'mrkdwn',
          text: `:rotating_light: *Critical:* ${payload.portfolioHealth.critical}`,
        },
        {
          type: 'mrkdwn',
          text: `:bar_chart: *Total:* ${totalAccounts}`,
        },
      ],
    },
  ];

  // Tasks due today
  if (payload.tasksDueToday.length > 0) {
    blocks.push({
      type: 'divider',
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*:calendar: Tasks Due Today (${payload.tasksDueToday.length})*`,
      },
    });

    const taskList = payload.tasksDueToday
      .slice(0, 5)
      .map((t) => `- ${t.title}${t.customerName ? ` (${t.customerName})` : ''}`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: taskList + (payload.tasksDueToday.length > 5 ? `\n_...and ${payload.tasksDueToday.length - 5} more_` : ''),
      },
    });
  }

  // Upcoming renewals
  if (payload.upcomingRenewals.length > 0) {
    blocks.push({
      type: 'divider',
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*:rotating_light: Upcoming Renewals (${payload.upcomingRenewals.length})*`,
      },
    });

    const renewalList = payload.upcomingRenewals
      .slice(0, 5)
      .map((r) => `- *${r.customerName}* - ${r.daysUntil} days ($${r.arr.toLocaleString()})`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: renewalList,
      },
    });
  }

  // At-risk accounts
  if (payload.atRiskAccounts.length > 0) {
    blocks.push({
      type: 'divider',
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*:warning: At-Risk Accounts (${payload.atRiskAccounts.length})*`,
      },
    });

    const riskList = payload.atRiskAccounts
      .slice(0, 5)
      .map((a) => `- *${a.customerName}* - Score: ${a.healthScore} (${a.trend})`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: riskList,
      },
    });
  }

  // Pending approvals
  if (payload.pendingApprovals > 0) {
    blocks.push({
      type: 'divider',
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:clipboard: You have *${payload.pendingApprovals}* pending approval${payload.pendingApprovals > 1 ? 's' : ''}`,
      },
    });
  }

  blocks.push({
    type: 'divider',
  });

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Open CSCX.AI', emoji: true },
        url: `${config.frontendUrl || 'https://app.cscx.ai'}/customers`,
        style: 'primary',
      },
    ],
  });

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Sent via CSCX.AI | ${new Date().toLocaleString()}`,
      },
    ],
  });

  return blocks;
}

// ============================================
// Slack Notification Service Class
// ============================================

export class SlackNotificationService {
  private clients: Map<string, WebClient> = new Map();
  private frontendUrl: string;

  constructor() {
    this.frontendUrl = config.frontendUrl || 'https://app.cscx.ai';
  }

  // ============================================
  // Client Management
  // ============================================

  private async getClient(userId: string): Promise<WebClient> {
    // Check cache first
    if (this.clients.has(userId)) {
      return this.clients.get(userId)!;
    }

    if (!supabase) {
      throw new Error('Database not configured');
    }

    // Get connection from database
    const { data, error } = await supabase
      .from('slack_connections')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (error || !data?.access_token) {
      throw new Error('Slack not connected. Please connect your Slack workspace first.');
    }

    // Create new client
    const client = new WebClient(data.access_token);
    this.clients.set(userId, client);

    return client;
  }

  // ============================================
  // Notification Sending
  // ============================================

  /**
   * Send health score change notification
   */
  async sendHealthScoreAlert(
    userId: string,
    payload: HealthScoreChangePayload
  ): Promise<NotificationResult> {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.enabled || !prefs.enabledTypes.includes('health_drop') && !prefs.enabledTypes.includes('health_recovery')) {
      return { success: false, error: 'Notification type disabled' };
    }

    const type: NotificationType = payload.trend === 'down' ? 'health_drop' : 'health_recovery';
    const urgency = this.calculateHealthUrgency(payload);

    if (!this.meetsUrgencyThreshold(urgency, prefs.urgencyThreshold)) {
      return { success: false, error: 'Below urgency threshold' };
    }

    if (this.isInQuietHours(prefs)) {
      await this.queueNotification(userId, type, payload, urgency);
      return { success: true, error: 'Queued for quiet hours' };
    }

    const blocks = buildHealthScoreBlocks(payload);
    const text = `Health Score Alert: ${payload.customerName} ${payload.trend === 'down' ? 'dropped' : 'improved'} from ${payload.previousScore} to ${payload.currentScore}`;

    return this.sendNotification(userId, prefs, text, blocks, type);
  }

  /**
   * Send renewal approaching notification
   */
  async sendRenewalAlert(
    userId: string,
    payload: RenewalPayload
  ): Promise<NotificationResult> {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.enabled || !prefs.enabledTypes.includes('renewal_approaching')) {
      return { success: false, error: 'Notification type disabled' };
    }

    if (!this.meetsUrgencyThreshold(payload.riskLevel, prefs.urgencyThreshold)) {
      return { success: false, error: 'Below urgency threshold' };
    }

    if (this.isInQuietHours(prefs)) {
      await this.queueNotification(userId, 'renewal_approaching', payload, payload.riskLevel);
      return { success: true, error: 'Queued for quiet hours' };
    }

    const blocks = buildRenewalBlocks(payload);
    const text = `Renewal Approaching: ${payload.customerName} renews in ${payload.daysUntilRenewal} days ($${payload.arr.toLocaleString()})`;

    return this.sendNotification(userId, prefs, text, blocks, 'renewal_approaching');
  }

  /**
   * Send escalation notification
   */
  async sendEscalationAlert(
    userId: string,
    payload: EscalationPayload
  ): Promise<NotificationResult> {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.enabled || !prefs.enabledTypes.includes('escalation_created')) {
      return { success: false, error: 'Notification type disabled' };
    }

    // Escalations always bypass quiet hours for critical severity
    if (payload.severity !== 'critical' && this.isInQuietHours(prefs)) {
      await this.queueNotification(userId, 'escalation_created', payload, payload.severity);
      return { success: true, error: 'Queued for quiet hours' };
    }

    const blocks = buildEscalationBlocks(payload);
    const text = `Escalation Created: ${payload.title} for ${payload.customerName} (${payload.severity.toUpperCase()})`;

    return this.sendNotification(userId, prefs, text, blocks, 'escalation_created');
  }

  /**
   * Send task due notification
   */
  async sendTaskDueAlert(
    userId: string,
    payload: TaskPayload
  ): Promise<NotificationResult> {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.enabled || !prefs.enabledTypes.includes('task_due')) {
      return { success: false, error: 'Notification type disabled' };
    }

    if (!this.meetsUrgencyThreshold(payload.priority, prefs.urgencyThreshold)) {
      return { success: false, error: 'Below urgency threshold' };
    }

    if (this.isInQuietHours(prefs)) {
      await this.queueNotification(userId, 'task_due', payload, payload.priority);
      return { success: true, error: 'Queued for quiet hours' };
    }

    const blocks = buildTaskDueBlocks(payload);
    const text = `Task Due: ${payload.title}${payload.customerName ? ` for ${payload.customerName}` : ''}`;

    return this.sendNotification(userId, prefs, text, blocks, 'task_due');
  }

  /**
   * Send approval request notification
   */
  async sendApprovalRequest(
    userId: string,
    payload: ApprovalPayload
  ): Promise<NotificationResult> {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.enabled || !prefs.enabledTypes.includes('approval_request')) {
      return { success: false, error: 'Notification type disabled' };
    }

    // Approval requests always bypass quiet hours
    const blocks = buildApprovalBlocks(payload);
    const text = `Approval Request: ${payload.requestType} from ${payload.requestedBy}`;

    return this.sendNotification(userId, prefs, text, blocks, 'approval_request');
  }

  /**
   * Send daily digest
   */
  async sendDailyDigest(
    userId: string,
    payload: DigestPayload
  ): Promise<NotificationResult> {
    const prefs = await this.getPreferences(userId);
    if (!prefs?.enabled || !prefs.enabledTypes.includes('daily_digest')) {
      return { success: false, error: 'Notification type disabled' };
    }

    const blocks = buildDailyDigestBlocks(payload);
    const text = `Daily Portfolio Summary - ${new Date().toLocaleDateString()}`;

    return this.sendNotification(userId, prefs, text, blocks, 'daily_digest');
  }

  /**
   * Send notification to channel (for team broadcasts)
   */
  async sendChannelNotification(
    userId: string,
    channelId: string,
    text: string,
    blocks: KnownBlock[],
    notificationType: NotificationType
  ): Promise<NotificationResult> {
    try {
      const client = await this.getClient(userId);

      const response = await withRetry(
        async () => {
          return slackNotificationCircuitBreaker.execute(async () => {
            return client.chat.postMessage({
              channel: channelId,
              text,
              blocks,
            });
          });
        },
        {
          ...retryStrategies.aiService,
          maxRetries: 3,
          onRetry: (attempt, error) => {
            console.log(`[SlackNotifications] Retry attempt ${attempt}: ${error.message}`);
          },
        }
      );

      if (!response.ok || !response.ts) {
        throw new Error(response.error || 'Failed to send message');
      }

      // Log notification
      await this.logNotification(userId, notificationType, response.ts, channelId);

      return {
        success: true,
        messageTs: response.ts,
        channelId,
      };
    } catch (error) {
      console.error('[SlackNotifications] Error sending channel notification:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Core notification sending
   */
  private async sendNotification(
    userId: string,
    prefs: NotificationPreferences,
    text: string,
    blocks: KnownBlock[],
    notificationType: NotificationType
  ): Promise<NotificationResult> {
    try {
      const client = await this.getClient(userId);

      let channelId: string;

      if (prefs.deliveryMethod === 'dm' && prefs.slackUserId) {
        // Open DM channel
        const dmResponse = await client.conversations.open({
          users: prefs.slackUserId,
        });

        if (!dmResponse.ok || !dmResponse.channel?.id) {
          throw new Error('Failed to open DM channel');
        }

        channelId = dmResponse.channel.id;
      } else if (prefs.deliveryMethod === 'channel' && prefs.channelId) {
        channelId = prefs.channelId;
      } else {
        throw new Error('No valid delivery channel configured');
      }

      const response = await withRetry(
        async () => {
          return slackNotificationCircuitBreaker.execute(async () => {
            return client.chat.postMessage({
              channel: channelId,
              text,
              blocks,
            });
          });
        },
        {
          ...retryStrategies.aiService,
          maxRetries: 3,
          retryableErrors: ['rate_limited', 'service_unavailable', 'server_error'],
        }
      );

      if (!response.ok || !response.ts) {
        throw new Error(response.error || 'Failed to send message');
      }

      // Log notification
      await this.logNotification(userId, notificationType, response.ts, channelId);

      return {
        success: true,
        messageTs: response.ts,
        channelId,
      };
    } catch (error) {
      console.error('[SlackNotifications] Error sending notification:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // ============================================
  // Preferences Management
  // ============================================

  /**
   * Get notification preferences for user
   */
  async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('slack_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return default preferences if none exist
      return {
        userId,
        enabledTypes: ['health_drop', 'escalation_created', 'renewal_approaching', 'daily_digest'],
        deliveryMethod: 'dm',
        timezone: 'America/New_York',
        urgencyThreshold: 'low',
        digestTime: '08:00',
        enabled: true,
      };
    }

    return {
      id: data.id,
      userId: data.user_id,
      slackUserId: data.slack_user_id,
      channelId: data.channel_id,
      enabledTypes: data.notification_types || [],
      deliveryMethod: data.delivery_method || 'dm',
      quietStart: data.quiet_start,
      quietEnd: data.quiet_end,
      timezone: data.timezone || 'America/New_York',
      urgencyThreshold: data.urgency_threshold || 'low',
      digestTime: data.digest_time,
      weeklyDigestDay: data.weekly_digest_day,
      enabled: data.enabled !== false,
    };
  }

  /**
   * Save notification preferences
   */
  async savePreferences(
    userId: string,
    prefs: Partial<NotificationPreferences>
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const existing = await this.getPreferences(userId);

    await supabase.from('slack_notification_preferences').upsert(
      {
        user_id: userId,
        slack_user_id: prefs.slackUserId ?? existing?.slackUserId,
        channel_id: prefs.channelId ?? existing?.channelId,
        notification_types: prefs.enabledTypes ?? existing?.enabledTypes,
        delivery_method: prefs.deliveryMethod ?? existing?.deliveryMethod,
        quiet_start: prefs.quietStart ?? existing?.quietStart,
        quiet_end: prefs.quietEnd ?? existing?.quietEnd,
        timezone: prefs.timezone ?? existing?.timezone,
        urgency_threshold: prefs.urgencyThreshold ?? existing?.urgencyThreshold,
        digest_time: prefs.digestTime ?? existing?.digestTime,
        weekly_digest_day: prefs.weeklyDigestDay ?? existing?.weeklyDigestDay,
        enabled: prefs.enabled ?? existing?.enabled ?? true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );
  }

  /**
   * Delete notification preferences
   */
  async deletePreferences(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('slack_notification_preferences')
      .delete()
      .eq('user_id', userId);
  }

  // ============================================
  // Interactive Message Handlers
  // ============================================

  /**
   * Handle interactive message actions
   */
  async handleInteraction(
    payload: {
      type: string;
      user: { id: string };
      actions?: Array<{ action_id: string; value?: string }>;
      response_url?: string;
    },
    userId: string
  ): Promise<{ processed: boolean; action?: string; error?: string }> {
    if (payload.type !== 'block_actions' || !payload.actions?.length) {
      return { processed: false, error: 'Unsupported interaction type' };
    }

    const action = payload.actions[0];
    const actionId = action.action_id;

    // Parse action ID
    if (actionId.startsWith('acknowledge_health_alert_')) {
      const customerId = actionId.replace('acknowledge_health_alert_', '');
      await this.acknowledgeAlert(userId, 'health_alert', customerId);
      return { processed: true, action: 'acknowledged_health_alert' };
    }

    if (actionId.startsWith('snooze_health_alert_')) {
      const customerId = actionId.replace('snooze_health_alert_', '');
      await this.snoozeAlert(userId, 'health_alert', customerId, 24);
      return { processed: true, action: 'snoozed_health_alert' };
    }

    if (actionId.startsWith('acknowledge_escalation_')) {
      const escalationId = actionId.replace('acknowledge_escalation_', '');
      await this.acknowledgeAlert(userId, 'escalation', escalationId);
      return { processed: true, action: 'acknowledged_escalation' };
    }

    if (actionId.startsWith('complete_task_')) {
      const taskId = actionId.replace('complete_task_', '');
      // Would integrate with task service to mark complete
      return { processed: true, action: 'marked_task_complete' };
    }

    if (actionId.startsWith('snooze_task_')) {
      const taskId = actionId.replace('snooze_task_', '');
      await this.snoozeAlert(userId, 'task', taskId, 24);
      return { processed: true, action: 'snoozed_task' };
    }

    if (actionId.startsWith('approve_request_')) {
      const approvalId = actionId.replace('approve_request_', '');
      // Would integrate with approval service
      return { processed: true, action: 'approved_request' };
    }

    if (actionId.startsWith('reject_request_')) {
      const approvalId = actionId.replace('reject_request_', '');
      // Would integrate with approval service
      return { processed: true, action: 'rejected_request' };
    }

    return { processed: false, error: 'Unknown action' };
  }

  /**
   * Acknowledge an alert
   */
  private async acknowledgeAlert(
    userId: string,
    alertType: string,
    entityId: string
  ): Promise<void> {
    if (!supabase) return;

    await supabase.from('slack_notification_log').update({
      acknowledged_at: new Date().toISOString(),
    }).match({
      user_id: userId,
      notification_type: alertType,
    });
  }

  /**
   * Snooze an alert
   */
  private async snoozeAlert(
    userId: string,
    alertType: string,
    entityId: string,
    hours: number
  ): Promise<void> {
    if (!supabase) return;

    const snoozeUntil = new Date();
    snoozeUntil.setHours(snoozeUntil.getHours() + hours);

    await supabase.from('slack_snoozed_alerts').upsert({
      user_id: userId,
      alert_type: alertType,
      entity_id: entityId,
      snooze_until: snoozeUntil.toISOString(),
    });
  }

  // ============================================
  // Queue Management
  // ============================================

  /**
   * Queue notification for later delivery
   */
  private async queueNotification(
    userId: string,
    notificationType: NotificationType,
    payload: unknown,
    urgency: UrgencyLevel
  ): Promise<void> {
    if (!supabase) return;

    const prefs = await this.getPreferences(userId);
    let scheduledFor: Date | undefined;

    if (prefs?.quietEnd) {
      // Schedule for end of quiet hours
      const [hours, minutes] = prefs.quietEnd.split(':').map(Number);
      scheduledFor = new Date();
      scheduledFor.setHours(hours, minutes, 0, 0);

      // If time has passed today, schedule for tomorrow
      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }
    }

    await supabase.from('slack_notification_queue').insert({
      user_id: userId,
      notification_type: notificationType,
      payload,
      urgency,
      status: 'pending',
      retry_count: 0,
      scheduled_for: scheduledFor?.toISOString(),
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Process queued notifications
   */
  async processQueue(): Promise<{ processed: number; failed: number }> {
    if (!supabase) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    // Get pending notifications that are ready to send
    const { data: queued } = await supabase
      .from('slack_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(100);

    if (!queued || queued.length === 0) {
      return { processed: 0, failed: 0 };
    }

    for (const item of queued) {
      try {
        const prefs = await this.getPreferences(item.user_id);

        // Skip if still in quiet hours
        if (prefs && this.isInQuietHours(prefs)) {
          continue;
        }

        // Send based on notification type
        let result: NotificationResult;
        switch (item.notification_type) {
          case 'health_drop':
          case 'health_recovery':
            result = await this.sendHealthScoreAlert(item.user_id, item.payload as HealthScoreChangePayload);
            break;
          case 'renewal_approaching':
            result = await this.sendRenewalAlert(item.user_id, item.payload as RenewalPayload);
            break;
          case 'escalation_created':
            result = await this.sendEscalationAlert(item.user_id, item.payload as EscalationPayload);
            break;
          case 'task_due':
            result = await this.sendTaskDueAlert(item.user_id, item.payload as TaskPayload);
            break;
          default:
            result = { success: false, error: 'Unknown notification type' };
        }

        if (result.success) {
          await supabase
            .from('slack_notification_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          processed++;
        } else {
          const newRetryCount = (item.retry_count || 0) + 1;
          const maxRetries = 3;

          await supabase
            .from('slack_notification_queue')
            .update({
              status: newRetryCount >= maxRetries ? 'failed' : 'pending',
              retry_count: newRetryCount,
              error: result.error,
            })
            .eq('id', item.id);

          if (newRetryCount >= maxRetries) {
            failed++;
          }
        }
      } catch (error) {
        console.error('[SlackNotifications] Queue processing error:', error);
        failed++;
      }
    }

    return { processed, failed };
  }

  // ============================================
  // Daily Digest Scheduler
  // ============================================

  /**
   * Get users who should receive digest now
   */
  async getUsersForDigest(): Promise<string[]> {
    if (!supabase) return [];

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Get users with digest time matching current time (within 5 min window)
    const { data } = await supabase
      .from('slack_notification_preferences')
      .select('user_id, digest_time, timezone')
      .eq('enabled', true)
      .contains('notification_types', ['daily_digest']);

    if (!data) return [];

    return data
      .filter((user) => {
        if (!user.digest_time) return false;
        const [hours, minutes] = user.digest_time.split(':').map(Number);
        // Simple check - in production would account for timezone
        return currentHour === hours && Math.abs(currentMinute - minutes) < 5;
      })
      .map((user) => user.user_id);
  }

  /**
   * Generate digest payload for a user
   */
  async generateDigestPayload(userId: string): Promise<DigestPayload> {
    // In production, this would query actual data
    // For now, return placeholder structure
    const defaultPayload: DigestPayload = {
      portfolioHealth: { healthy: 0, atRisk: 0, critical: 0 },
      tasksDueToday: [],
      upcomingRenewals: [],
      atRiskAccounts: [],
      pendingApprovals: 0,
    };

    if (!supabase) return defaultPayload;

    try {
      // Get portfolio health
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, health_score, health_trend')
        .eq('csm_id', userId);

      if (customers) {
        defaultPayload.portfolioHealth.healthy = customers.filter((c) => (c.health_score || 0) >= 70).length;
        defaultPayload.portfolioHealth.atRisk = customers.filter((c) => (c.health_score || 0) >= 40 && (c.health_score || 0) < 70).length;
        defaultPayload.portfolioHealth.critical = customers.filter((c) => (c.health_score || 0) < 40).length;

        // At-risk accounts
        defaultPayload.atRiskAccounts = customers
          .filter((c) => (c.health_score || 0) < 70)
          .slice(0, 5)
          .map((c) => ({
            customerName: c.name,
            healthScore: c.health_score || 0,
            trend: c.health_trend || 'stable',
          }));
      }

      // Get tasks due today
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, customer_id, customers(name)')
        .eq('assigned_to', userId)
        .eq('status', 'pending')
        .lte('due_date', today.toISOString());

      if (tasks) {
        defaultPayload.tasksDueToday = tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          customerName: t.customers?.name,
        }));
      }

      // Get upcoming renewals
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data: renewals } = await supabase
        .from('customers')
        .select('name, renewal_date, arr')
        .eq('csm_id', userId)
        .lte('renewal_date', thirtyDaysFromNow.toISOString())
        .gte('renewal_date', new Date().toISOString())
        .order('renewal_date', { ascending: true })
        .limit(5);

      if (renewals) {
        defaultPayload.upcomingRenewals = renewals.map((r) => ({
          customerName: r.name,
          daysUntil: Math.ceil((new Date(r.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          arr: r.arr || 0,
        }));
      }

      // Get pending approvals
      const { count } = await supabase
        .from('pending_approvals')
        .select('id', { count: 'exact' })
        .eq('approver_id', userId)
        .eq('status', 'pending');

      defaultPayload.pendingApprovals = count || 0;
    } catch (error) {
      console.error('[SlackNotifications] Error generating digest:', error);
    }

    return defaultPayload;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Calculate urgency based on health score change
   */
  private calculateHealthUrgency(payload: HealthScoreChangePayload): UrgencyLevel {
    const change = Math.abs(payload.currentScore - payload.previousScore);

    if (payload.currentScore < 30) return 'critical';
    if (payload.currentScore < 50 || change >= 20) return 'high';
    if (payload.currentScore < 70 || change >= 10) return 'medium';
    return 'low';
  }

  /**
   * Check if urgency meets threshold
   */
  private meetsUrgencyThreshold(
    urgency: UrgencyLevel,
    threshold: UrgencyLevel
  ): boolean {
    const levels: UrgencyLevel[] = ['low', 'medium', 'high', 'critical'];
    return levels.indexOf(urgency) >= levels.indexOf(threshold);
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(prefs: NotificationPreferences): boolean {
    if (!prefs.quietStart || !prefs.quietEnd) return false;

    const now = new Date();
    const [startHour, startMin] = prefs.quietStart.split(':').map(Number);
    const [endHour, endMin] = prefs.quietEnd.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  /**
   * Log notification to database
   */
  private async logNotification(
    userId: string,
    notificationType: NotificationType,
    messageTs: string,
    channelId: string
  ): Promise<void> {
    if (!supabase) return;

    await supabase.from('slack_notification_log').insert({
      user_id: userId,
      notification_type: notificationType,
      message_ts: messageTs,
      channel_id: channelId,
      delivered_at: new Date().toISOString(),
    });
  }

  /**
   * Send test notification
   */
  async sendTestNotification(userId: string): Promise<NotificationResult> {
    const prefs = await this.getPreferences(userId);
    if (!prefs) {
      return { success: false, error: 'No preferences configured' };
    }

    const blocks: KnownBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':wave: *Test Notification from CSCX.AI*\nYour Slack notifications are working correctly!',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Delivery Method:*\n${prefs.deliveryMethod}`,
          },
          {
            type: 'mrkdwn',
            text: `*Enabled Types:*\n${prefs.enabledTypes.length} types`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Sent via CSCX.AI | ${new Date().toLocaleString()}`,
          },
        ],
      },
    ];

    return this.sendNotification(
      userId,
      prefs,
      'Test notification from CSCX.AI',
      blocks,
      'daily_digest'
    );
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats() {
    return slackNotificationCircuitBreaker.getStats();
  }

  /**
   * Map CSCX user to Slack user by email
   */
  async mapUserToSlackUser(userId: string, email: string): Promise<string | null> {
    try {
      const client = await this.getClient(userId);

      const response = await client.users.lookupByEmail({ email });

      if (response.ok && response.user?.id) {
        // Save mapping
        await this.savePreferences(userId, { slackUserId: response.user.id });
        return response.user.id;
      }

      return null;
    } catch (error) {
      console.error('[SlackNotifications] Error mapping user:', error);
      return null;
    }
  }
}

// Singleton instance
export const slackNotificationService = new SlackNotificationService();
export default slackNotificationService;
