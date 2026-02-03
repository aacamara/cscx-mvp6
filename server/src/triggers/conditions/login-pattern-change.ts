/**
 * Login Pattern Change Condition Processor (PRD-100)
 *
 * Fires when user login patterns change significantly:
 * - Frequency downgrades (daily -> weekly, weekly -> monthly)
 * - Users who haven't logged in for 14+ days
 * - Account-level login declines (>30% reduction)
 * - Power user disengagement
 *
 * Severity calculation:
 * - Individual downgrade: low-medium
 * - Power user disengagement: high
 * - Account-level decline >30%: medium
 * - Account-level decline >50%: high
 * - Account-level decline >70%: critical
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';
import {
  LoginPatternAlertType,
  LoginPatternAlertSeverity,
  LoginPatternEventData,
} from '../../../../types/loginPattern.js';

export interface LoginPatternChangeParams {
  alertTypes?: LoginPatternAlertType[];     // Filter by alert type(s)
  minSeverity?: LoginPatternAlertSeverity;  // Minimum severity to trigger
  accountDeclineThreshold?: number;          // Percentage decline (default: 30)
  inactiveDaysThreshold?: number;            // Days without login (default: 14)
  powerUsersOnly?: boolean;                  // Only trigger for power users
  minAffectedUsers?: number;                 // Minimum affected users (default: 1)
  cooldownDays?: number;                     // Cooldown between alerts (default: 7)
}

const SEVERITY_ORDER: Record<LoginPatternAlertSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Calculate severity based on change percentage and context
 */
export function calculateLoginPatternSeverity(
  changePercent: number,
  isPowerUserAffected: boolean,
  affectedUserCount: number
): LoginPatternAlertSeverity {
  // Power user disengagement is always high severity
  if (isPowerUserAffected) {
    return 'high';
  }

  // Bulk user changes increase severity
  if (affectedUserCount >= 10) {
    if (changePercent >= 70) return 'critical';
    if (changePercent >= 50) return 'high';
    return 'medium';
  }

  // Standard severity calculation based on decline
  if (changePercent >= 70) return 'critical';
  if (changePercent >= 50) return 'high';
  if (changePercent >= 30) return 'medium';
  return 'low';
}

/**
 * Get alert title based on type and context
 */
export function getAlertTitle(
  alertType: LoginPatternAlertType,
  affectedCount: number,
  changePercent: number
): string {
  switch (alertType) {
    case 'individual_downgrade':
      return 'User Login Frequency Downgrade';
    case 'individual_stopped':
      return 'User Stopped Logging In';
    case 'power_user_disengagement':
      return 'Power User Disengagement Detected';
    case 'account_level_decline':
      return `Account Login Decline: ${Math.abs(changePercent)}%`;
    case 'bulk_downgrade':
      return `${affectedCount} Users Changed Login Patterns`;
    default:
      return 'Login Pattern Change Detected';
  }
}

export const loginPatternChangeProcessor: ConditionProcessor = {
  type: 'login_pattern_change',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process login pattern events
    if (event.type !== 'login_pattern_change' && event.type !== 'login_activity') {
      return false;
    }

    const params = condition.params as LoginPatternChangeParams;
    const eventData = event.data as LoginPatternEventData;

    // Check alert type filter
    if (params.alertTypes && params.alertTypes.length > 0) {
      if (!params.alertTypes.includes(eventData.alertType)) {
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

    // Check account decline threshold
    const declineThreshold = params.accountDeclineThreshold || 30;
    if (eventData.alertType === 'account_level_decline') {
      if (Math.abs(eventData.changePercent) < declineThreshold) {
        return false;
      }
    }

    // Check inactive days threshold
    const inactiveDaysThreshold = params.inactiveDaysThreshold || 14;
    if (eventData.alertType === 'individual_stopped') {
      // This would be checked in the detector, but we can add additional filtering here
      const hasLongInactiveUser = eventData.affectedUserDetails?.some(
        (user) => user.daysSinceLogin >= inactiveDaysThreshold
      );
      if (!hasLongInactiveUser) {
        return false;
      }
    }

    // Check power users only filter
    if (params.powerUsersOnly) {
      const hasPowerUser = eventData.affectedUserDetails?.some(
        (user) => user.isPowerUser
      );
      if (!hasPowerUser) {
        return false;
      }
    }

    // Check minimum affected users
    const minAffectedUsers = params.minAffectedUsers || 1;
    if (eventData.affectedUsers < minAffectedUsers) {
      return false;
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const params = condition.params as LoginPatternChangeParams;
    const parts: string[] = ['Login pattern change detected'];

    if (params.alertTypes?.length) {
      parts.push(`(${params.alertTypes.join(', ')})`);
    }

    if (params.minSeverity) {
      parts.push(`with ${params.minSeverity}+ severity`);
    }

    if (params.accountDeclineThreshold) {
      parts.push(`with >${params.accountDeclineThreshold}% decline`);
    }

    if (params.powerUsersOnly) {
      parts.push('for power users');
    }

    if (params.minAffectedUsers && params.minAffectedUsers > 1) {
      parts.push(`affecting ${params.minAffectedUsers}+ users`);
    }

    return parts.join(' ');
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const params = condition.params as LoginPatternChangeParams;

    // Validate alert types
    const validAlertTypes: LoginPatternAlertType[] = [
      'individual_downgrade',
      'individual_stopped',
      'power_user_disengagement',
      'account_level_decline',
      'bulk_downgrade',
    ];

    if (params.alertTypes) {
      for (const alertType of params.alertTypes) {
        if (!validAlertTypes.includes(alertType)) {
          return {
            valid: false,
            error: `Invalid alertType: ${alertType}. Must be one of: ${validAlertTypes.join(', ')}`,
          };
        }
      }
    }

    // Validate severity
    if (params.minSeverity) {
      if (!['low', 'medium', 'high', 'critical'].includes(params.minSeverity)) {
        return {
          valid: false,
          error: 'minSeverity must be low, medium, high, or critical',
        };
      }
    }

    // Validate thresholds
    if (params.accountDeclineThreshold !== undefined) {
      if (
        typeof params.accountDeclineThreshold !== 'number' ||
        params.accountDeclineThreshold <= 0 ||
        params.accountDeclineThreshold > 100
      ) {
        return { valid: false, error: 'accountDeclineThreshold must be between 0 and 100' };
      }
    }

    if (params.inactiveDaysThreshold !== undefined) {
      if (
        typeof params.inactiveDaysThreshold !== 'number' ||
        params.inactiveDaysThreshold < 1
      ) {
        return { valid: false, error: 'inactiveDaysThreshold must be at least 1' };
      }
    }

    if (params.minAffectedUsers !== undefined) {
      if (
        typeof params.minAffectedUsers !== 'number' ||
        params.minAffectedUsers < 1
      ) {
        return { valid: false, error: 'minAffectedUsers must be at least 1' };
      }
    }

    if (params.cooldownDays !== undefined) {
      if (typeof params.cooldownDays !== 'number' || params.cooldownDays < 1) {
        return { valid: false, error: 'cooldownDays must be at least 1' };
      }
    }

    return { valid: true };
  },
};

export default loginPatternChangeProcessor;
