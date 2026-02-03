/**
 * Expansion Signal Slack Alerts
 * PRD-103: Expansion Signal Detected
 *
 * Formats and sends Slack alerts for expansion signals
 */

import { SlackService, SendMessageOptions } from '../slack/index.js';
import { ExpansionAlertData } from './types.js';

// ============================================
// Slack Alert Service
// ============================================

export class ExpansionSlackAlerts {
  private slackService: SlackService;

  constructor() {
    this.slackService = new SlackService();
  }

  // ============================================
  // CSM Alert (FR-2.3)
  // ============================================

  /**
   * Send expansion signal alert to CSM
   */
  async sendCsmAlert(
    userId: string,
    channelId: string,
    alertData: ExpansionAlertData
  ): Promise<void> {
    const blocks = this.buildCsmAlertBlocks(alertData);

    const options: SendMessageOptions = {
      channel: channelId,
      text: `:chart_with_upwards_trend: Expansion Signal: ${alertData.customerName}`,
      blocks,
    };

    await this.slackService.sendMessage(userId, options);
  }

  /**
   * Send expansion signal DM to CSM
   */
  async sendCsmDm(
    userId: string,
    csmSlackUserId: string,
    alertData: ExpansionAlertData
  ): Promise<void> {
    const blocks = this.buildCsmAlertBlocks(alertData);

    // DM to CSM user
    const options: SendMessageOptions = {
      channel: csmSlackUserId,
      text: `:chart_with_upwards_trend: Expansion Signal: ${alertData.customerName}`,
      blocks,
    };

    await this.slackService.sendMessage(userId, options);
  }

  // ============================================
  // Sales Alert (FR-3.1)
  // ============================================

  /**
   * Send expansion signal alert to Sales rep
   */
  async sendSalesAlert(
    userId: string,
    salesSlackUserId: string,
    alertData: ExpansionAlertData,
    csmName: string
  ): Promise<void> {
    const blocks = this.buildSalesAlertBlocks(alertData, csmName);

    const options: SendMessageOptions = {
      channel: salesSlackUserId,
      text: `:moneybag: CSM-Qualified Expansion: ${alertData.customerName}`,
      blocks,
    };

    await this.slackService.sendMessage(userId, options);
  }

  // ============================================
  // Alert Block Builders
  // ============================================

  /**
   * Build Slack blocks for CSM alert
   */
  private buildCsmAlertBlocks(alertData: ExpansionAlertData): any[] {
    const blocks: any[] = [];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:chart_with_upwards_trend: Expansion Signal: ${alertData.customerName}`,
        emoji: true,
      },
    });

    // Signal strength and estimated value
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Signal Strength:* ${alertData.signalStrength} (Score: ${alertData.compositeScore.toFixed(2)})`,
        },
        {
          type: 'mrkdwn',
          text: `*Estimated Expansion:* $${alertData.estimatedExpansionArr.toLocaleString()}+ ARR`,
        },
      ],
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Signals section header
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Signals Detected:*',
      },
    });

    // Individual signals
    alertData.signals.forEach((signal, index) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${index + 1}. ${signal.emoji} *${signal.title}*\n   ${signal.description}`,
        },
      });
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Current state
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Current State:*',
      },
    });

    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*ARR:* $${alertData.currentState.arr.toLocaleString()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Plan:* ${alertData.currentState.plan}`,
        },
        {
          type: 'mrkdwn',
          text: `*Contract End:* ${alertData.currentState.contractEnd}`,
        },
      ],
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Recommended expansion
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Recommended Expansion:*',
      },
    });

    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Products:* ${alertData.recommendedExpansion.products.join(', ')}`,
        },
        {
          type: 'mrkdwn',
          text: `*Estimated Value:* $${alertData.recommendedExpansion.estimatedValue.toLocaleString()}/year`,
        },
      ],
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Approach:* ${alertData.recommendedExpansion.approach}`,
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
            text: 'Create Expansion Opportunity',
            emoji: true,
          },
          style: 'primary',
          action_id: 'create_expansion_opportunity',
          value: JSON.stringify({
            opportunityId: alertData.opportunityId,
            customerId: alertData.customerId,
          }),
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Draft Outreach',
            emoji: true,
          },
          action_id: 'draft_expansion_outreach',
          value: alertData.customerId,
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

  /**
   * Build Slack blocks for Sales alert
   */
  private buildSalesAlertBlocks(alertData: ExpansionAlertData, csmName: string): any[] {
    const blocks: any[] = [];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:moneybag: CSM-Qualified Expansion: ${alertData.customerName}`,
        emoji: true,
      },
    });

    // Context
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Qualified by: *${csmName}* | Signal Strength: *${alertData.signalStrength}*`,
        },
      ],
    });

    // Key info section
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Current ARR:* $${alertData.currentState.arr.toLocaleString()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Expansion Potential:* $${alertData.estimatedExpansionArr.toLocaleString()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Products:* ${alertData.recommendedExpansion.products.join(', ')}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Plan:* ${alertData.currentState.plan}`,
        },
      ],
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Signal summary
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Why This Opportunity:*\n${alertData.signals.map(s => `${s.emoji} ${s.description}`).join('\n')}`,
      },
    });

    // Recommended approach
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*CSM Recommendation:*\n${alertData.recommendedExpansion.approach}`,
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
            text: 'Accept & Create CRM Opp',
            emoji: true,
          },
          style: 'primary',
          action_id: 'accept_expansion_sales',
          value: alertData.opportunityId,
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
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Contact CSM',
            emoji: true,
          },
          action_id: 'contact_csm_expansion',
          value: alertData.opportunityId,
        },
      ],
    });

    return blocks;
  }
}

// Singleton instance
export const expansionSlackAlerts = new ExpansionSlackAlerts();
