/**
 * Slack Integration Service
 *
 * Send rich notifications to Slack channels via incoming webhooks.
 * Supports various alert types with appropriate formatting.
 */

export type SlackAlertType =
  | 'health_drop'
  | 'renewal_soon'
  | 'risk_signal'
  | 'churn_risk'
  | 'escalation'
  | 'action_required'
  | 'info'
  | 'success';

export interface SlackAlertParams {
  type: SlackAlertType;
  title: string;
  message: string;
  customer?: {
    id: string;
    name: string;
    arr?: number;
    healthScore?: number;
  };
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string;
  fields?: Record<string, unknown>;
}

// Alert type configurations
const ALERT_CONFIG: Record<
  SlackAlertType,
  { emoji: string; color: string }
> = {
  health_drop: { emoji: '🚨', color: '#FF4444' },
  renewal_soon: { emoji: '📅', color: '#FF9900' },
  risk_signal: { emoji: '⚠️', color: '#FFCC00' },
  churn_risk: { emoji: '💔', color: '#FF0000' },
  escalation: { emoji: '🔥', color: '#CC0000' },
  action_required: { emoji: '✋', color: '#3366FF' },
  info: { emoji: 'ℹ️', color: '#888888' },
  success: { emoji: '✅', color: '#00CC00' },
};

/**
 * Send an alert to a Slack webhook
 */
export async function sendSlackAlert(
  webhookUrl: string,
  params: SlackAlertParams
): Promise<boolean> {
  const { type, title, message, customer, priority, actionUrl, fields } = params;
  const config = ALERT_CONFIG[type];

  // Build the Slack message payload
  const payload = buildSlackPayload({
    emoji: config.emoji,
    color: config.color,
    title,
    message,
    customer,
    priority,
    actionUrl,
    fields,
    type,
  });

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Slack webhook failed: ${response.status} ${response.statusText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Slack webhook error:', error);
    return false;
  }
}

/**
 * Build the Slack Block Kit payload
 */
function buildSlackPayload(params: {
  emoji: string;
  color: string;
  title: string;
  message: string;
  customer?: {
    id: string;
    name: string;
    arr?: number;
    healthScore?: number;
  };
  priority?: string;
  actionUrl?: string;
  fields?: Record<string, unknown>;
  type: SlackAlertType;
}): object {
  const { emoji, color, title, message, customer, priority, actionUrl, fields, type } = params;

  const blocks: object[] = [];

  // Header block
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${emoji} ${title}`,
      emoji: true,
    },
  });

  // Main message
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: message,
    },
  });

  // Customer info if provided
  if (customer) {
    const customerFields = [
      {
        type: 'mrkdwn',
        text: `*Customer:*\n${customer.name}`,
      },
    ];

    if (customer.arr !== undefined) {
      customerFields.push({
        type: 'mrkdwn',
        text: `*ARR:*\n$${customer.arr.toLocaleString()}`,
      });
    }

    if (customer.healthScore !== undefined) {
      const healthEmoji =
        customer.healthScore >= 80 ? '🟢' :
        customer.healthScore >= 60 ? '🟡' :
        customer.healthScore >= 40 ? '🟠' : '🔴';

      customerFields.push({
        type: 'mrkdwn',
        text: `*Health:*\n${healthEmoji} ${customer.healthScore}/100`,
      });
    }

    blocks.push({
      type: 'section',
      fields: customerFields,
    });
  }

  // Additional fields if provided
  if (fields && Object.keys(fields).length > 0) {
    const additionalFields = Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null)
      .slice(0, 6) // Slack limits fields
      .map(([key, value]) => ({
        type: 'mrkdwn',
        text: `*${formatFieldKey(key)}:*\n${formatFieldValue(value)}`,
      }));

    if (additionalFields.length > 0) {
      blocks.push({
        type: 'section',
        fields: additionalFields,
      });
    }
  }

  // Priority badge
  if (priority && priority !== 'low') {
    const priorityEmoji =
      priority === 'urgent' ? '🔴' :
      priority === 'high' ? '🟠' : '🟡';

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${priorityEmoji} *Priority:* ${priority.toUpperCase()}`,
        },
      ],
    });
  }

  // Action button if URL provided
  if (actionUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View in CSCX',
            emoji: true,
          },
          url: actionUrl.startsWith('http') ? actionUrl : `https://app.cscx.ai${actionUrl}`,
          style: type === 'escalation' || type === 'churn_risk' ? 'danger' : 'primary',
        },
      ],
    });
  }

  // Divider
  blocks.push({ type: 'divider' });

  // Footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `📣 _Sent from CSCX.AI • ${new Date().toLocaleString()}_`,
      },
    ],
  });

  return {
    text: `${emoji} ${title}`, // Fallback for notifications
    attachments: [
      {
        color,
        blocks,
      },
    ],
  };
}

/**
 * Format field key to human-readable
 */
function formatFieldKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

/**
 * Format field value for display
 */
function formatFieldValue(value: unknown): string {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  if (Array.isArray(value)) {
    return value.slice(0, 3).join(', ') + (value.length > 3 ? '...' : '');
  }
  return String(value);
}

/**
 * Send a customer summary card to Slack
 */
export async function sendCustomerCard(
  webhookUrl: string,
  customer: {
    id: string;
    name: string;
    arr: number;
    healthScore: number;
    stage: string;
    renewalDate?: string;
    daysToRenewal?: number;
  }
): Promise<boolean> {
  const healthEmoji =
    customer.healthScore >= 80 ? '🟢' :
    customer.healthScore >= 60 ? '🟡' :
    customer.healthScore >= 40 ? '🟠' : '🔴';

  const stageEmoji =
    customer.stage === 'at_risk' ? '⚠️' :
    customer.stage === 'churning' ? '🚨' :
    customer.stage === 'active' ? '✅' : 'ℹ️';

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📋 ${customer.name}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Health:*\n${healthEmoji} ${customer.healthScore}/100`,
          },
          {
            type: 'mrkdwn',
            text: `*ARR:*\n$${customer.arr.toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Stage:*\n${stageEmoji} ${customer.stage}`,
          },
          {
            type: 'mrkdwn',
            text: `*Renewal:*\n${customer.renewalDate || 'N/A'}${customer.daysToRenewal ? ` (${customer.daysToRenewal}d)` : ''}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Customer',
              emoji: true,
            },
            url: `https://app.cscx.ai/customers/${customer.id}`,
            style: 'primary',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Run Health Check',
              emoji: true,
            },
            action_id: 'run_health_check',
            value: customer.id,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    console.error('Slack customer card error:', error);
    return false;
  }
}

/**
 * Send a list of at-risk customers to Slack
 */
export async function sendRiskReport(
  webhookUrl: string,
  customers: Array<{
    name: string;
    arr: number;
    healthScore: number;
    daysToRenewal?: number;
  }>
): Promise<boolean> {
  const totalARR = customers.reduce((sum, c) => sum + c.arr, 0);

  const customerList = customers
    .slice(0, 10)
    .map(c => {
      const healthEmoji = c.healthScore >= 60 ? '🟡' : '🔴';
      const renewal = c.daysToRenewal ? ` | ${c.daysToRenewal}d to renewal` : '';
      return `${healthEmoji} *${c.name}* - $${c.arr.toLocaleString()} | Health: ${c.healthScore}${renewal}`;
    })
    .join('\n');

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 At-Risk Customer Report',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${customers.length} customers* at risk\n*Total ARR at Risk:* $${totalARR.toLocaleString()}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: customerList || 'No customers currently at risk',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Full Report',
              emoji: true,
            },
            url: 'https://app.cscx.ai/customers?filter=at_risk',
            style: 'primary',
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    console.error('Slack risk report error:', error);
    return false;
  }
}

export default {
  sendSlackAlert,
  sendCustomerCard,
  sendRiskReport,
};
