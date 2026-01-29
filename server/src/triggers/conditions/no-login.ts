/**
 * No Login Condition Processor
 * Fires when a customer hasn't logged in for a specified number of days
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';

export const noLoginProcessor: ConditionProcessor = {
  type: 'no_login',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // This can be triggered by login_activity events or periodic checks
    if (event.type !== 'login_activity') {
      return false;
    }

    const daysThreshold = condition.params.days || 7;
    const userTypes = condition.params.userTypes;  // Optional: specific user roles

    const lastLoginDate = event.data.lastLoginDate
      ? new Date(event.data.lastLoginDate)
      : null;

    // If user just logged in, don't fire
    if (event.data.action === 'login') {
      return false;
    }

    // Check if no login data (never logged in)
    if (!lastLoginDate) {
      // Check if account is old enough
      const createdDate = event.data.accountCreatedDate
        ? new Date(event.data.accountCreatedDate)
        : null;

      if (!createdDate) return false;

      const daysSinceCreation = Math.floor(
        (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return daysSinceCreation >= daysThreshold;
    }

    // Calculate days since last login
    const daysSinceLogin = Math.floor(
      (Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check threshold
    if (daysSinceLogin < daysThreshold) {
      return false;
    }

    // Check user types if specified
    if (userTypes && Array.isArray(userTypes) && userTypes.length > 0) {
      const userType = event.data.userType;
      if (!userTypes.includes(userType)) {
        return false;
      }
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const days = condition.params.days || 7;
    let description = `No login for ${days}+ days`;

    if (condition.params.userTypes?.length) {
      description += ` (${condition.params.userTypes.join(', ')} users)`;
    }

    return description;
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const { days, userTypes } = condition.params;

    if (days !== undefined && (typeof days !== 'number' || days <= 0)) {
      return { valid: false, error: 'Days must be a positive number' };
    }

    if (userTypes !== undefined && !Array.isArray(userTypes)) {
      return { valid: false, error: 'userTypes must be an array' };
    }

    return { valid: true };
  },
};
