/**
 * Quiet Account Condition Processor (PRD-106)
 *
 * Fires when accounts have been quiet (no meaningful interaction) for too long:
 * - Enterprise: 21+ days of silence
 * - Mid-Market: 30+ days of silence
 * - SMB/Startup: 45+ days of silence
 * - Escalation at 60+ days for all segments
 *
 * Severity levels:
 * - warning: Just passed threshold
 * - elevated: 1.5x threshold
 * - critical: 60+ days (escalation threshold)
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';
import {
  QuietAccountEventData,
  QuietSeverity,
  CustomerSegment,
  DEFAULT_QUIET_THRESHOLDS,
} from '../../../../types/quietAccount.js';

export interface QuietAccountParams {
  // Filter parameters
  minQuietDays?: number;           // Minimum days of silence to trigger
  maxQuietDays?: number;           // Maximum days (for targeting specific windows)
  minSeverity?: QuietSeverity;     // Minimum severity to trigger
  segments?: CustomerSegment[];    // Filter by segment(s)

  // Value-based filters
  minArr?: number;                 // Minimum ARR to trigger
  maxHealthScore?: number;         // Only trigger below this health score

  // Renewal-based filters
  maxDaysToRenewal?: number;       // Only trigger if renewal within X days

  // Alert behavior
  cooldownDays?: number;           // Days between alerts for same account
  escalateOnly?: boolean;          // Only trigger for escalation-level (60+ days)
}

const SEVERITY_ORDER: Record<QuietSeverity, number> = {
  warning: 1,
  elevated: 2,
  critical: 3,
};

/**
 * Quiet Account Condition Processor
 */
export const quietAccountProcessor: ConditionProcessor = {
  type: 'quiet_account',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process quiet account events
    if (event.type !== 'quiet_account_detected' && event.type !== 'engagement_check') {
      return false;
    }

    const params = condition.params as QuietAccountParams;
    const eventData = event.data as QuietAccountEventData;

    // Check minimum quiet days
    if (params.minQuietDays !== undefined) {
      if (eventData.quietDays < params.minQuietDays) {
        return false;
      }
    }

    // Check maximum quiet days
    if (params.maxQuietDays !== undefined) {
      if (eventData.quietDays > params.maxQuietDays) {
        return false;
      }
    }

    // Check minimum severity
    if (params.minSeverity) {
      const eventSeverityLevel = SEVERITY_ORDER[eventData.severity];
      const minSeverityLevel = SEVERITY_ORDER[params.minSeverity];
      if (eventSeverityLevel < minSeverityLevel) {
        return false;
      }
    }

    // Check escalation-only mode
    if (params.escalateOnly) {
      if (eventData.quietDays < DEFAULT_QUIET_THRESHOLDS.escalation) {
        return false;
      }
    }

    // Check segment filter
    if (params.segments && params.segments.length > 0) {
      if (!params.segments.includes(eventData.segment)) {
        return false;
      }
    }

    // Check minimum ARR
    if (params.minArr !== undefined) {
      if (eventData.arr < params.minArr) {
        return false;
      }
    }

    // Check maximum health score (only trigger for lower health accounts)
    if (params.maxHealthScore !== undefined) {
      if (eventData.healthScore > params.maxHealthScore) {
        return false;
      }
    }

    // Check days to renewal
    if (params.maxDaysToRenewal !== undefined && eventData.daysToRenewal !== null) {
      if (eventData.daysToRenewal > params.maxDaysToRenewal) {
        return false;
      }
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const params = condition.params as QuietAccountParams;
    const parts: string[] = ['Quiet account detected'];

    if (params.minQuietDays) {
      parts.push(`(${params.minQuietDays}+ days silent)`);
    }

    if (params.minSeverity) {
      parts.push(`with ${params.minSeverity}+ severity`);
    }

    if (params.segments?.length) {
      parts.push(`for ${params.segments.join('/')} segment(s)`);
    }

    if (params.minArr) {
      parts.push(`with ARR >= $${params.minArr.toLocaleString()}`);
    }

    if (params.maxDaysToRenewal) {
      parts.push(`renewing within ${params.maxDaysToRenewal} days`);
    }

    if (params.escalateOnly) {
      parts.push('(escalation threshold only)');
    }

    return parts.join(' ');
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const params = condition.params as QuietAccountParams;

    // Validate quiet days range
    if (params.minQuietDays !== undefined) {
      if (typeof params.minQuietDays !== 'number' || params.minQuietDays < 1) {
        return { valid: false, error: 'minQuietDays must be at least 1' };
      }
    }

    if (params.maxQuietDays !== undefined) {
      if (typeof params.maxQuietDays !== 'number' || params.maxQuietDays < 1) {
        return { valid: false, error: 'maxQuietDays must be at least 1' };
      }
    }

    if (params.minQuietDays && params.maxQuietDays && params.minQuietDays > params.maxQuietDays) {
      return { valid: false, error: 'minQuietDays cannot be greater than maxQuietDays' };
    }

    // Validate severity
    if (params.minSeverity) {
      if (!['warning', 'elevated', 'critical'].includes(params.minSeverity)) {
        return { valid: false, error: 'minSeverity must be warning, elevated, or critical' };
      }
    }

    // Validate segments
    if (params.segments) {
      const validSegments: CustomerSegment[] = ['enterprise', 'mid-market', 'smb', 'startup'];
      for (const segment of params.segments) {
        if (!validSegments.includes(segment)) {
          return {
            valid: false,
            error: `Invalid segment: ${segment}. Must be one of: ${validSegments.join(', ')}`,
          };
        }
      }
    }

    // Validate ARR
    if (params.minArr !== undefined) {
      if (typeof params.minArr !== 'number' || params.minArr < 0) {
        return { valid: false, error: 'minArr must be a non-negative number' };
      }
    }

    // Validate health score
    if (params.maxHealthScore !== undefined) {
      if (
        typeof params.maxHealthScore !== 'number' ||
        params.maxHealthScore < 0 ||
        params.maxHealthScore > 100
      ) {
        return { valid: false, error: 'maxHealthScore must be between 0 and 100' };
      }
    }

    // Validate days to renewal
    if (params.maxDaysToRenewal !== undefined) {
      if (typeof params.maxDaysToRenewal !== 'number' || params.maxDaysToRenewal < 1) {
        return { valid: false, error: 'maxDaysToRenewal must be at least 1' };
      }
    }

    // Validate cooldown
    if (params.cooldownDays !== undefined) {
      if (typeof params.cooldownDays !== 'number' || params.cooldownDays < 1) {
        return { valid: false, error: 'cooldownDays must be at least 1' };
      }
    }

    return { valid: true };
  },
};

/**
 * Get alert title for quiet account trigger
 */
export function getQuietAccountAlertTitle(
  customerName: string,
  quietDays: number,
  severity: QuietSeverity
): string {
  const emoji = severity === 'critical' ? '🚨' : severity === 'elevated' ? '⚠️' : '🔔';
  return `${emoji} Quiet Account Alert: ${customerName} (${quietDays} days)`;
}

/**
 * Format quiet account alert for Slack
 */
export function formatQuietAccountSlackMessage(eventData: QuietAccountEventData): string {
  const severityEmoji =
    eventData.severity === 'critical' ? '🚨' :
    eventData.severity === 'elevated' ? '⚠️' : '🔇';

  const lines = [
    `${severityEmoji} *Quiet Account Alert: ${eventData.customerName}*`,
    '',
    `*Days Since Last Interaction:* ${eventData.quietDays} days`,
    '',
    '*Last Activities:*',
  ];

  if (eventData.lastInteraction) {
    lines.push(`• ${eventData.lastInteraction.type}: ${eventData.lastInteraction.daysAgo} days ago`);
  } else {
    lines.push('• No recent interactions recorded');
  }

  lines.push('');
  lines.push('*Account Context:*');
  lines.push(`• ARR: $${eventData.arr.toLocaleString()}`);
  lines.push(`• Health Score: ${eventData.healthScore}`);
  if (eventData.daysToRenewal !== null) {
    lines.push(`• Renewal: ${eventData.daysToRenewal} days away`);
  }
  lines.push(`• Segment: ${eventData.segment}`);

  lines.push('');
  lines.push('*Recommended Action:*');
  if (eventData.severity === 'critical') {
    lines.push('Schedule urgent check-in call and review for churn risk.');
  } else if (eventData.severity === 'elevated') {
    lines.push('Send personalized check-in email with value summary.');
  } else {
    lines.push('Send friendly check-in email to re-establish contact.');
  }

  return lines.join('\n');
}

export default quietAccountProcessor;
