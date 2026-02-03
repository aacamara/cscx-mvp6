/**
 * Multi-Account Pattern Slack Alerts (PRD-105)
 *
 * Formats and sends Slack notifications for multi-account patterns:
 * - Risk contagion alerts
 * - Replication opportunity notifications
 * - Synchronized change alerts
 * - Cross-expansion opportunities
 */

import { KnownBlock } from '@slack/web-api';
import {
  MultiAccountPattern,
  PatternAlertPayload,
  PatternType,
  PatternSeverity,
  RiskContagionDetails,
  ReplicationOpportunityDetails,
  SynchronizedChangeDetails,
  CrossExpansionDetails,
  CustomerFamily,
} from './types.js';
import { slackNotificationService } from '../slack/notifications.js';
import { config } from '../../config/index.js';

// ============================================
// Emoji and Color Mappings
// ============================================

const PATTERN_EMOJIS: Record<PatternType, string> = {
  risk_contagion: ':warning:',
  replication_opportunity: ':star2:',
  synchronized_change: ':link:',
  cross_expansion: ':chart_with_upwards_trend:',
};

const SEVERITY_EMOJIS: Record<PatternSeverity, string> = {
  low: ':large_blue_circle:',
  medium: ':large_yellow_circle:',
  high: ':large_orange_circle:',
  critical: ':red_circle:',
};

const PATTERN_TITLES: Record<PatternType, string> = {
  risk_contagion: 'Risk Contagion Alert',
  replication_opportunity: 'Replication Opportunity',
  synchronized_change: 'Synchronized Change Detected',
  cross_expansion: 'Cross-Expansion Opportunity',
};

// ============================================
// Block Kit Builders
// ============================================

/**
 * Build Slack blocks for risk contagion alert
 */
function buildRiskContagionBlocks(
  payload: PatternAlertPayload,
  details: RiskContagionDetails
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${PATTERN_EMOJIS.risk_contagion} ${PATTERN_TITLES.risk_contagion}: ${payload.parentCustomerName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Pattern Detected:* Risk Contagion\n\n*Source Account:* ${details.sourceCustomerName}\n*Risk Type:* ${details.riskType.replace('_', ' ').toUpperCase()}\n*Spread Risk:* ${details.spreadRisk}%`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*At-Risk Accounts (consider monitoring):*`,
      },
    },
  ];

  // Add affected accounts
  for (const account of details.affectedAccounts.slice(0, 5)) {
    const exposureEmoji = account.riskExposure === 'high' ? ':rotating_light:' : ':warning:';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${exposureEmoji} *${account.name}* - Health: ${account.currentHealth} - ${account.riskExposure.toUpperCase()} exposure`,
      },
    });
  }

  // Add root cause if available
  if (details.rootCause) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Root Cause:* ${details.rootCause}`,
      },
    });
  }

  // Add recommendation
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Recommendation:*\n${payload.recommendation}`,
    },
  });

  // Add action buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Parent Dashboard', emoji: true },
        url: `${config.frontendUrl || 'https://app.cscx.ai'}/customers/${payload.patternId.split('-')[0]}/family`,
        style: 'primary',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Create Save Play', emoji: true },
        action_id: `create_save_play_${payload.patternId}`,
        style: 'danger',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Acknowledge', emoji: true },
        action_id: `acknowledge_pattern_${payload.patternId}`,
      },
    ],
  });

  // Add footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${SEVERITY_EMOJIS[payload.severity]} Severity: ${payload.severity.toUpperCase()} | Confidence: ${Math.round(details.spreadRisk)}% | Sent via CSCX.AI`,
      },
    ],
  });

  return blocks;
}

/**
 * Build Slack blocks for replication opportunity
 */
function buildReplicationOpportunityBlocks(
  payload: PatternAlertPayload,
  details: ReplicationOpportunityDetails
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${PATTERN_EMOJIS.replication_opportunity} ${PATTERN_TITLES.replication_opportunity}: ${payload.parentCustomerName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Pattern Detected:* Replication Opportunity`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Successful Account:* ${details.successfulCustomerName}\n- Completed ${details.playbook.name}\n- Health score: ${details.improvements.healthScoreDelta > 0 ? '+' : ''}${details.improvements.healthScoreDelta} points\n- Usage up ${details.improvements.usageDelta}%`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Similar Accounts (consider replicating):*`,
      },
    },
  ];

  // Add candidate accounts
  for (let i = 0; i < Math.min(details.candidateAccounts.length, 5); i++) {
    const candidate = details.candidateAccounts[i];
    const potentialGainText = candidate.potentialGain > 0 ? ` (+${candidate.potentialGain} potential)` : '';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${i + 1}. *${candidate.name}* - Health: ${candidate.currentHealth}${potentialGainText}\n   _${candidate.missingElements.slice(0, 2).join(', ')}_`,
      },
    });
  }

  // Add recommendation
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Recommendation:*\n${details.successStory}`,
    },
  });

  // Add action buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Parent Dashboard', emoji: true },
        url: `${config.frontendUrl || 'https://app.cscx.ai'}/customers/${payload.patternId.split('-')[0]}/family`,
        style: 'primary',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Draft Cross-Region Email', emoji: true },
        action_id: `draft_replication_email_${payload.patternId}`,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Create Playbook', emoji: true },
        action_id: `create_playbook_${payload.patternId}`,
      },
    ],
  });

  // Add footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${SEVERITY_EMOJIS[payload.severity]} Opportunity Score: ${details.candidateAccounts.reduce((sum, c) => sum + c.fitScore, 0) / details.candidateAccounts.length | 0}% | Sent via CSCX.AI`,
      },
    ],
  });

  return blocks;
}

/**
 * Build Slack blocks for synchronized change
 */
function buildSynchronizedChangeBlocks(
  payload: PatternAlertPayload,
  details: SynchronizedChangeDetails
): KnownBlock[] {
  const isPositive = details.changeType.includes('improvement') || details.changeType.includes('spike');
  const emoji = isPositive ? ':chart_with_upwards_trend:' : ':chart_with_downwards_trend:';

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${PATTERN_EMOJIS.synchronized_change} ${PATTERN_TITLES.synchronized_change}: ${payload.parentCustomerName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Pattern Detected:* ${details.changeType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Accounts Affected:*\n${details.accountsInvolved.length}`,
        },
        {
          type: 'mrkdwn',
          text: `*Average Change:*\n${emoji} ${details.changeMagnitude > 0 ? '+' : ''}${details.changeMagnitude}%`,
        },
        {
          type: 'mrkdwn',
          text: `*Correlation:*\n${details.correlationStrength}%`,
        },
        {
          type: 'mrkdwn',
          text: `*Timeframe:*\n${new Date(details.timeframe.start).toLocaleDateString()} - ${new Date(details.timeframe.end).toLocaleDateString()}`,
        },
      ],
    },
  ];

  // Add account breakdown
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Account Changes:*`,
    },
  });

  for (const account of details.accountsInvolved.slice(0, 5)) {
    const changeEmoji = account.changeValue > 0 ? ':arrow_up:' : ':arrow_down:';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${changeEmoji} *${account.name}*: ${account.changeValue > 0 ? '+' : ''}${account.changePercent}%`,
      },
    });
  }

  // Add possible cause if available
  if (details.possibleCause) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Possible Cause:*\n${details.possibleCause}`,
      },
    });
  }

  // Add recommendation
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Recommendation:*\n${payload.recommendation}`,
    },
  });

  // Add action buttons
  const actionStyle = isPositive ? 'primary' : 'danger';
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Parent Dashboard', emoji: true },
        url: `${config.frontendUrl || 'https://app.cscx.ai'}/customers/${payload.patternId.split('-')[0]}/family`,
        style: actionStyle,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Schedule Family Meeting', emoji: true },
        action_id: `schedule_family_meeting_${payload.patternId}`,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Acknowledge', emoji: true },
        action_id: `acknowledge_pattern_${payload.patternId}`,
      },
    ],
  });

  // Add footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${SEVERITY_EMOJIS[payload.severity]} Severity: ${payload.severity.toUpperCase()} | Sent via CSCX.AI`,
      },
    ],
  });

  return blocks;
}

/**
 * Build Slack blocks for cross-expansion opportunity
 */
function buildCrossExpansionBlocks(
  payload: PatternAlertPayload,
  details: CrossExpansionDetails
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${PATTERN_EMOJIS.cross_expansion} ${PATTERN_TITLES.cross_expansion}: ${payload.parentCustomerName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Pattern Detected:* Cross-Expansion Opportunity`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Source Account:* ${details.sourceCustomerName}\n*Expansion Type:* ${details.expansionType}\n*Details:* ${details.expansionDetails.feature || details.expansionDetails.product || `+${details.expansionDetails.seatsDelta} seats`}\n*Value:* $${details.expansionDetails.value.toLocaleString()}`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Expansion Candidates:*`,
      },
    },
  ];

  // Add candidate accounts
  for (const account of details.similarAccounts.slice(0, 5)) {
    const potentialEmoji = account.expansionPotential >= 80 ? ':star:' : ':seedling:';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${potentialEmoji} *${account.name}*\n   Expansion Potential: ${account.expansionPotential}%\n   _Readiness: ${account.readinessIndicators.slice(0, 2).join(', ')}_`,
      },
    });
  }

  // Add recommendation
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Recommendation:*\n${payload.recommendation}`,
    },
  });

  // Add action buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Parent Dashboard', emoji: true },
        url: `${config.frontendUrl || 'https://app.cscx.ai'}/customers/${payload.patternId.split('-')[0]}/family`,
        style: 'primary',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Create Expansion Plan', emoji: true },
        action_id: `create_expansion_plan_${payload.patternId}`,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Acknowledge', emoji: true },
        action_id: `acknowledge_pattern_${payload.patternId}`,
      },
    ],
  });

  // Add footer
  const totalPotentialValue = details.similarAccounts.length * details.expansionDetails.value;
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `${SEVERITY_EMOJIS[payload.severity]} Total Potential: $${totalPotentialValue.toLocaleString()} | Sent via CSCX.AI`,
      },
    ],
  });

  return blocks;
}

// ============================================
// Main Alert Functions
// ============================================

/**
 * Build Slack blocks for any pattern type
 */
export function buildPatternAlertBlocks(payload: PatternAlertPayload): KnownBlock[] {
  const { patternType, details } = payload;

  switch (patternType) {
    case 'risk_contagion':
      return buildRiskContagionBlocks(payload, details.data as RiskContagionDetails);
    case 'replication_opportunity':
      return buildReplicationOpportunityBlocks(payload, details.data as ReplicationOpportunityDetails);
    case 'synchronized_change':
      return buildSynchronizedChangeBlocks(payload, details.data as SynchronizedChangeDetails);
    case 'cross_expansion':
      return buildCrossExpansionBlocks(payload, details.data as CrossExpansionDetails);
    default:
      // Fallback generic blocks
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Multi-Account Pattern Detected*\n${payload.headline}`,
          },
        },
      ];
  }
}

/**
 * Send multi-account pattern alert to Slack
 */
export async function sendMultiAccountPatternAlert(
  userId: string,
  pattern: MultiAccountPattern,
  family: CustomerFamily
): Promise<{ success: boolean; messageTs?: string; error?: string }> {
  const { multiAccountPatternService } = await import('./index.js');

  // Generate alert payload
  const payload = multiAccountPatternService.generateAlertPayload(pattern, family);

  // Build Slack blocks
  const blocks = buildPatternAlertBlocks(payload);

  // Create fallback text
  const text = `Multi-Account Pattern Alert: ${payload.headline}`;

  // Send via Slack notification service
  try {
    const result = await slackNotificationService.sendChannelNotification(
      userId,
      '', // Will use user's configured channel
      text,
      blocks,
      'churn_risk' // Using existing notification type that supports custom blocks
    );

    return result;
  } catch (error) {
    console.error('[MultiAccountPatternAlerts] Error sending Slack alert:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Handle interactive message actions from pattern alerts
 */
export async function handlePatternAlertInteraction(
  actionId: string,
  userId: string
): Promise<{ processed: boolean; action?: string; error?: string }> {
  const { multiAccountPatternService } = await import('./index.js');

  // Parse action
  if (actionId.startsWith('acknowledge_pattern_')) {
    const patternId = actionId.replace('acknowledge_pattern_', '');
    const success = await multiAccountPatternService.updatePatternStatus(patternId, 'acknowledged', userId);
    return { processed: success, action: 'pattern_acknowledged' };
  }

  if (actionId.startsWith('create_save_play_')) {
    const patternId = actionId.replace('create_save_play_', '');
    // Would trigger save play creation workflow
    return { processed: true, action: 'save_play_initiated' };
  }

  if (actionId.startsWith('draft_replication_email_')) {
    const patternId = actionId.replace('draft_replication_email_', '');
    // Would trigger email draft workflow
    return { processed: true, action: 'email_draft_initiated' };
  }

  if (actionId.startsWith('create_playbook_')) {
    const patternId = actionId.replace('create_playbook_', '');
    // Would trigger playbook creation workflow
    return { processed: true, action: 'playbook_creation_initiated' };
  }

  if (actionId.startsWith('schedule_family_meeting_')) {
    const patternId = actionId.replace('schedule_family_meeting_', '');
    // Would trigger meeting scheduling workflow
    return { processed: true, action: 'meeting_scheduling_initiated' };
  }

  if (actionId.startsWith('create_expansion_plan_')) {
    const patternId = actionId.replace('create_expansion_plan_', '');
    // Would trigger expansion plan workflow
    return { processed: true, action: 'expansion_plan_initiated' };
  }

  return { processed: false, error: 'Unknown action' };
}

export default {
  buildPatternAlertBlocks,
  sendMultiAccountPatternAlert,
  handlePatternAlertInteraction,
};
