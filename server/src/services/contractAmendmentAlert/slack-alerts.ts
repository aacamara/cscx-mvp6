/**
 * Contract Amendment Alert Slack Service
 * PRD-108: Contract Amendment Needed
 *
 * Formats and sends Slack alerts when contract amendments are needed.
 */

import { SlackService, SendMessageOptions } from '../slack/index.js';
import { DetectedAmendmentNeed, AmendmentAlertTriggerType } from './detector.js';

// ============================================
// Alert Type Configuration
// ============================================

const ALERT_ICONS: Record<AmendmentAlertTriggerType, string> = {
  usage_overage: ':chart_with_upwards_trend:',
  seat_overage: ':busts_in_silhouette:',
  storage_overage: ':floppy_disk:',
  api_overage: ':zap:',
  out_of_scope_request: ':clipboard:',
  use_case_change: ':arrows_counterclockwise:',
  early_renewal_request: ':alarm_clock:',
  term_extension_request: ':calendar:',
  feature_upgrade_request: ':arrow_up:',
};

const ALERT_TYPE_LABELS: Record<AmendmentAlertTriggerType, string> = {
  usage_overage: 'Usage Overage',
  seat_overage: 'Seat Overage',
  storage_overage: 'Storage Overage',
  api_overage: 'API Overage',
  out_of_scope_request: 'Out of Scope Request',
  use_case_change: 'Use Case Change',
  early_renewal_request: 'Early Renewal Request',
  term_extension_request: 'Term Extension Request',
  feature_upgrade_request: 'Feature Upgrade Request',
};

// ============================================
// Contract Amendment Slack Alerts Service
// ============================================

export class ContractAmendmentSlackAlerts {
  private slackService: SlackService;
  private frontendUrl: string;

  constructor() {
    this.slackService = new SlackService();
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  }

  // ============================================
  // Send CSM Alert
  // ============================================

  /**
   * Send contract amendment needed alert to CSM via Slack
   */
  async sendCsmAlert(
    userId: string,
    channelId: string,
    alert: DetectedAmendmentNeed
  ): Promise<void> {
    const blocks = this.buildAlertBlocks(alert);

    const options: SendMessageOptions = {
      channel: channelId,
      text: `:memo: Contract Amendment Needed: ${alert.customerName}`,
      blocks,
    };

    await this.slackService.sendMessage(userId, options);
  }

  /**
   * Send contract amendment needed alert as DM to CSM
   */
  async sendCsmDm(
    userId: string,
    csmSlackUserId: string,
    alert: DetectedAmendmentNeed
  ): Promise<void> {
    const blocks = this.buildAlertBlocks(alert);

    const options: SendMessageOptions = {
      channel: csmSlackUserId,
      text: `:memo: Contract Amendment Needed: ${alert.customerName}`,
      blocks,
    };

    await this.slackService.sendMessage(userId, options);
  }

  // ============================================
  // Build Alert Blocks
  // ============================================

  private buildAlertBlocks(alert: DetectedAmendmentNeed): any[] {
    const blocks: any[] = [];
    const icon = ALERT_ICONS[alert.triggerType] || ':memo:';
    const typeLabel = ALERT_TYPE_LABELS[alert.triggerType] || 'Amendment Needed';

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${icon} Contract Amendment Needed: ${alert.customerName}`,
        emoji: true,
      },
    });

    // Amendment Type
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Amendment Type:* ${typeLabel}`,
      },
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Current Situation
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Current Situation:*',
      },
    });

    // Situation details based on trigger type
    const situationFields = this.buildSituationFields(alert);
    blocks.push({
      type: 'section',
      fields: situationFields,
    });

    // Persistence info
    if (alert.details.persistedMonths) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `This overage has persisted for ${alert.details.persistedMonths} month${alert.details.persistedMonths > 1 ? 's' : ''}.`,
          },
        ],
      });
    }

    // Divider
    blocks.push({ type: 'divider' });

    // Estimated Amendment Value
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Estimated Amendment Value:* $${alert.estimatedMonthlyValue.toLocaleString()}/month ($${alert.estimatedAnnualValue.toLocaleString()} annually)`,
      },
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Customer Context
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Customer Context:*',
      },
    });

    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Current ARR:* $${alert.contract.currentArr.toLocaleString()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Contract End:* ${this.formatDate(alert.contract.contractEnd)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Relationship Health:* ${this.getHealthEmoji(alert.customerContext.healthScore)} ${alert.customerContext.healthScore}`,
        },
        {
          type: 'mrkdwn',
          text: `*Days to Renewal:* ${alert.contract.daysUntilRenewal}`,
        },
      ],
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Options
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Options:*',
      },
    });

    alert.recommendedOptions.forEach((option, index) => {
      const recommendedTag = option.isRecommended ? ' :star:' : '';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${index + 1}. *${option.title}*${recommendedTag}\n   ${option.description}`,
        },
      });
    });

    // Action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Draft Amendment Discussion Email',
            emoji: true,
          },
          style: 'primary',
          action_id: 'draft_amendment_email',
          value: JSON.stringify({
            customerId: alert.customerId,
            alertType: alert.triggerType,
          }),
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Contract',
            emoji: true,
          },
          action_id: 'view_contract',
          url: `${this.frontendUrl}/customers/${alert.customerId}?tab=contract`,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Calculate Upgrade Options',
            emoji: true,
          },
          action_id: 'calculate_upgrade',
          value: alert.customerId,
        },
      ],
    });

    return blocks;
  }

  // ============================================
  // Build Situation Fields
  // ============================================

  private buildSituationFields(alert: DetectedAmendmentNeed): any[] {
    const fields: any[] = [];

    switch (alert.triggerType) {
      case 'usage_overage':
      case 'api_overage':
        fields.push(
          {
            type: 'mrkdwn',
            text: `*Contracted API Calls:* ${alert.details.contracted.toLocaleString()}/month`,
          },
          {
            type: 'mrkdwn',
            text: `*Actual Usage:* ${alert.details.actual.toLocaleString()}/month`,
          },
          {
            type: 'mrkdwn',
            text: `*Overage:* ${alert.details.overagePercent?.toFixed(1)}%`,
          }
        );
        break;

      case 'seat_overage':
        fields.push(
          {
            type: 'mrkdwn',
            text: `*Contracted Seats:* ${alert.details.contracted}`,
          },
          {
            type: 'mrkdwn',
            text: `*Active Users:* ${alert.details.actual}`,
          },
          {
            type: 'mrkdwn',
            text: `*Additional Seats Needed:* ${alert.details.additionalSeats}`,
          }
        );
        break;

      case 'storage_overage':
        fields.push(
          {
            type: 'mrkdwn',
            text: `*Contracted Storage:* ${(alert.details.contracted / 1024).toFixed(1)} GB`,
          },
          {
            type: 'mrkdwn',
            text: `*Actual Usage:* ${(alert.details.actual / 1024).toFixed(1)} GB`,
          },
          {
            type: 'mrkdwn',
            text: `*Overage:* ${alert.details.overagePercent?.toFixed(1)}%`,
          }
        );
        break;

      default:
        fields.push({
          type: 'mrkdwn',
          text: alert.details.description,
        });
    }

    return fields;
  }

  // ============================================
  // Helpers
  // ============================================

  private formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }

  private getHealthEmoji(score: number): string {
    if (score >= 80) return ':green_circle:';
    if (score >= 60) return ':large_yellow_circle:';
    if (score >= 40) return ':orange_circle:';
    return ':red_circle:';
  }
}

// Singleton instance
export const contractAmendmentSlackAlerts = new ContractAmendmentSlackAlerts();

export default contractAmendmentSlackAlerts;
