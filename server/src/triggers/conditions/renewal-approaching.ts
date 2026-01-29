/**
 * Renewal Approaching Condition Processor
 * Fires when a customer's renewal date is within a specified number of days
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';

export const renewalApproachingProcessor: ConditionProcessor = {
  type: 'renewal_approaching',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Triggered by renewal_date_approaching or contract_updated events
    if (event.type !== 'renewal_date_approaching' && event.type !== 'contract_updated') {
      return false;
    }

    const daysThreshold = condition.params.days || 90;
    const minARR = condition.params.minARR;  // Optional: only fire for accounts above this ARR
    const riskLevels = condition.params.riskLevels;  // Optional: specific risk levels

    const renewalDate = event.data.renewalDate
      ? new Date(event.data.renewalDate)
      : null;

    if (!renewalDate) {
      return false;
    }

    // Calculate days until renewal
    const daysUntilRenewal = Math.floor(
      (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    // Check if within threshold (and in the future)
    if (daysUntilRenewal < 0 || daysUntilRenewal > daysThreshold) {
      return false;
    }

    // Check optional exact days (for specific day triggers like 90, 60, 30)
    if (condition.params.exactDays) {
      const exactDays = Array.isArray(condition.params.exactDays)
        ? condition.params.exactDays
        : [condition.params.exactDays];

      if (!exactDays.includes(daysUntilRenewal)) {
        return false;
      }
    }

    // Check minimum ARR
    if (minARR !== undefined) {
      const arr = event.data.arr || 0;
      if (arr < minARR) {
        return false;
      }
    }

    // Check risk levels
    if (riskLevels && Array.isArray(riskLevels) && riskLevels.length > 0) {
      const riskLevel = event.data.riskLevel || event.data.healthStatus;
      if (!riskLevels.includes(riskLevel)) {
        return false;
      }
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const days = condition.params.days || 90;

    if (condition.params.exactDays) {
      const exactDays = Array.isArray(condition.params.exactDays)
        ? condition.params.exactDays.join(', ')
        : condition.params.exactDays;
      return `Renewal in exactly ${exactDays} days`;
    }

    let description = `Renewal within ${days} days`;

    if (condition.params.minARR) {
      description += ` (ARR > $${condition.params.minARR.toLocaleString()})`;
    }

    if (condition.params.riskLevels?.length) {
      description += ` and ${condition.params.riskLevels.join('/')} risk`;
    }

    return description;
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const { days, exactDays, minARR, riskLevels } = condition.params;

    if (days !== undefined && (typeof days !== 'number' || days <= 0)) {
      return { valid: false, error: 'Days must be a positive number' };
    }

    if (exactDays !== undefined) {
      const exact = Array.isArray(exactDays) ? exactDays : [exactDays];
      if (!exact.every((d: any) => typeof d === 'number' && d > 0)) {
        return { valid: false, error: 'exactDays must be positive numbers' };
      }
    }

    if (minARR !== undefined && (typeof minARR !== 'number' || minARR < 0)) {
      return { valid: false, error: 'minARR must be a non-negative number' };
    }

    if (riskLevels !== undefined && !Array.isArray(riskLevels)) {
      return { valid: false, error: 'riskLevels must be an array' };
    }

    return { valid: true };
  },
};
