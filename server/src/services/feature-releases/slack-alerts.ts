/**
 * PRD-099: High-Value Feature Released Alert
 * Slack Alert Service for Feature Releases
 *
 * Formats and sends rich Slack alerts to CSMs when
 * high-value features match their customers.
 */

import { SlackService, SendMessageOptions } from '../slack/index.js';
import { FeatureReleaseAlertData, MatchReason } from './types.js';

// ============================================
// Slack Alert Service Class
// ============================================

export class FeatureReleaseSlackAlerts {
  private slackService: SlackService;

  constructor() {
    this.slackService = new SlackService();
  }

  // ============================================
  // CSM Alert (FR-2.1 - FR-2.5)
  // ============================================

  /**
   * Send feature release alert to CSM (FR-2.1)
   */
  async sendCsmAlert(
    userId: string,
    channelId: string,
    alertData: FeatureReleaseAlertData
  ): Promise<void> {
    const blocks = this.buildCsmAlertBlocks(alertData);

    const options: SendMessageOptions = {
      channel: channelId,
      text: `:sparkles: New Feature Match: ${alertData.customerName}`,
      blocks,
    };

    await this.slackService.sendMessage(userId, options);
  }

  /**
   * Send feature release DM to CSM
   */
  async sendCsmDm(
    userId: string,
    csmSlackUserId: string,
    alertData: FeatureReleaseAlertData
  ): Promise<void> {
    const blocks = this.buildCsmAlertBlocks(alertData);

    const options: SendMessageOptions = {
      channel: csmSlackUserId,
      text: `:sparkles: New Feature Match: ${alertData.customerName}`,
      blocks,
    };

    await this.slackService.sendMessage(userId, options);
  }

  // ============================================
  // Alert Block Builder
  // ============================================

  /**
   * Build Slack blocks for CSM feature release alert
   *
   * Format from PRD:
   * :sparkles: New Feature Match: DataCorp
   *
   * Feature Released: Advanced Export Options
   * Release Date: Jan 29, 2026
   *
   * Why DataCorp Cares:
   * - :pushpin: They requested this! (Request #FR-2024-089, Oct 2024)
   * - :chart_with_upwards_trend: Heavy data export usage (200+ exports/month)
   *
   * Feature Highlights:
   * - Scheduled exports
   * - Custom format templates
   * - API export endpoint
   *
   * Customer Context:
   * - ARR: $95,000
   * - Tier: Professional (feature included)
   * - Champion: Sarah Johnson (Data Analyst)
   *
   * Enablement Resources:
   * - :video_camera: Feature Overview Video (5 min)
   * - :page_facing_up: Documentation
   * - :school: Live Training: Feb 3, 2026
   *
   * [Draft Announcement Email] [Close Feature Request] [View Customer]
   */
  private buildCsmAlertBlocks(alertData: FeatureReleaseAlertData): unknown[] {
    const blocks: unknown[] = [];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:sparkles: New Feature Match: ${alertData.customerName}`,
        emoji: true,
      },
    });

    // Feature info section
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Feature Released:* ${alertData.featureName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Release Date:* ${this.formatDate(alertData.releaseDate)}`,
        },
      ],
    });

    // Divider
    blocks.push({ type: 'divider' });

    // "Why Customer Cares" section (FR-2.3)
    const whyCaresText = this.buildWhyCaresText(alertData);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Why ${alertData.customerName} Cares:*\n${whyCaresText}`,
      },
    });

    // Feature Highlights section (FR-2.2)
    if (alertData.featureHighlights.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Feature Highlights:*\n${alertData.featureHighlights.map(h => `- ${h}`).join('\n')}`,
        },
      });
    }

    // Customer Context
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Customer Context:*',
      },
    });

    const contextFields = [
      {
        type: 'mrkdwn',
        text: `*ARR:* $${alertData.customerArr.toLocaleString()}`,
      },
      {
        type: 'mrkdwn',
        text: `*Tier:* ${alertData.customerTier} (feature included)`,
      },
    ];

    if (alertData.customerHealthScore !== null) {
      const healthEmoji = this.getHealthEmoji(alertData.customerHealthScore);
      contextFields.push({
        type: 'mrkdwn',
        text: `*Health:* ${healthEmoji} ${alertData.customerHealthScore}/100`,
      });
    }

    if (alertData.championName) {
      contextFields.push({
        type: 'mrkdwn',
        text: `*Champion:* ${alertData.championName}${alertData.championTitle ? ` (${alertData.championTitle})` : ''}`,
      });
    }

    blocks.push({
      type: 'section',
      fields: contextFields.slice(0, 4), // Slack limit
    });

    // Divider
    blocks.push({ type: 'divider' });

    // Enablement Resources section (FR-2.4)
    const resourcesText = this.buildResourcesText(alertData);
    if (resourcesText) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Enablement Resources:*\n${resourcesText}`,
        },
      });
    }

    // Match score context
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Match Score: ${alertData.matchScore}/100 | Reason: ${this.formatMatchReason(alertData.matchReason)}`,
        },
      ],
    });

    // Action buttons (FR-2.5)
    const actions = this.buildActionButtons(alertData);
    blocks.push({
      type: 'actions',
      elements: actions,
    });

    return blocks;
  }

  /**
   * Build "Why Customer Cares" text based on match reason
   */
  private buildWhyCaresText(alertData: FeatureReleaseAlertData): string {
    const reasons: string[] = [];

    // Feature request match
    if (alertData.featureRequest) {
      const requestDate = new Date(alertData.featureRequest.submittedAt);
      const monthYear = requestDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      reasons.push(
        `:pushpin: They requested this! (Request #${alertData.featureRequest.requestId}, ${monthYear})`
      );
    }

    // Usage pattern match
    if (alertData.matchDetails.usageMetrics) {
      const metrics = Object.entries(alertData.matchDetails.usageMetrics);
      for (const [metric, value] of metrics.slice(0, 2)) {
        const formattedMetric = this.formatMetricName(metric);
        reasons.push(`:chart_with_upwards_trend: High ${formattedMetric} (${value}+ per month)`);
      }
    }

    // Keyword/goal matches
    if (alertData.matchDetails.matchedKeywords && alertData.matchDetails.matchedKeywords.length > 0) {
      reasons.push(
        `:dart: Aligned with their goals: ${alertData.matchDetails.matchedKeywords.slice(0, 3).join(', ')}`
      );
    }

    // Customer goals
    if (alertData.matchDetails.customerGoals && alertData.matchDetails.customerGoals.length > 0) {
      reasons.push(
        `:bulb: Supports their use case: ${alertData.matchDetails.customerGoals.slice(0, 2).join(', ')}`
      );
    }

    // Fallback if no specific reasons
    if (reasons.length === 0 && alertData.matchDetails.relevanceExplanation) {
      reasons.push(`:star: ${alertData.matchDetails.relevanceExplanation}`);
    }

    return reasons.join('\n');
  }

  /**
   * Build enablement resources text
   */
  private buildResourcesText(alertData: FeatureReleaseAlertData): string {
    const resources: string[] = [];
    const enablement = alertData.enablementResources;

    // Videos
    if (enablement.videos && enablement.videos.length > 0) {
      for (const video of enablement.videos.slice(0, 2)) {
        const duration = video.durationMinutes ? ` (${video.durationMinutes} min)` : '';
        resources.push(`:video_camera: <${video.url}|${video.title}>${duration}`);
      }
    }

    // Documentation
    if (enablement.docs && enablement.docs.length > 0) {
      for (const doc of enablement.docs.slice(0, 2)) {
        resources.push(`:page_facing_up: <${doc.url}|${doc.title}>`);
      }
    }

    // Trainings
    if (enablement.trainings && enablement.trainings.length > 0) {
      for (const training of enablement.trainings.slice(0, 2)) {
        const date = this.formatDate(training.date);
        const link = training.registrationUrl
          ? ` - <${training.registrationUrl}|Register>`
          : '';
        resources.push(`:school: ${training.title}: ${date}${link}`);
      }
    }

    return resources.join('\n');
  }

  /**
   * Build action buttons
   */
  private buildActionButtons(alertData: FeatureReleaseAlertData): unknown[] {
    const buttons: unknown[] = [];
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Draft Announcement Email button (FR-2.5)
    buttons.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'Draft Announcement Email',
        emoji: true,
      },
      style: 'primary',
      action_id: 'draft_feature_announcement',
      value: JSON.stringify({
        matchId: alertData.matchId,
        customerId: alertData.customerId,
        releaseId: alertData.releaseId,
      }),
    });

    // Close Feature Request button (if applicable)
    if (alertData.featureRequest) {
      buttons.push({
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Close Feature Request',
          emoji: true,
        },
        action_id: 'close_feature_request',
        value: JSON.stringify({
          matchId: alertData.matchId,
          requestId: alertData.featureRequest.requestId,
        }),
      });
    }

    // View Customer button
    buttons.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'View Customer',
        emoji: true,
      },
      url: `${frontendUrl}/customers/${alertData.customerId}`,
    });

    return buttons.slice(0, 3); // Slack limit of 3 buttons per actions block
  }

  // ============================================
  // Helper Methods
  // ============================================

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private formatMatchReason(reason: MatchReason): string {
    const labels: Record<MatchReason, string> = {
      feature_request: 'Feature Request',
      use_case: 'Use Case Match',
      usage_pattern: 'Usage Pattern',
      keyword_match: 'Keyword Match',
    };
    return labels[reason] || reason;
  }

  private formatMetricName(metric: string): string {
    return metric
      .replace(/_/g, ' ')
      .replace(/count$/i, '')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  private getHealthEmoji(score: number): string {
    if (score >= 80) return ':large_green_circle:';
    if (score >= 60) return ':large_yellow_circle:';
    if (score >= 40) return ':large_orange_circle:';
    return ':red_circle:';
  }
}

// Singleton instance
export const featureReleaseSlackAlerts = new FeatureReleaseSlackAlerts();
