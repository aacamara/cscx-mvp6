/**
 * Contract Amendment Needed Condition Processor
 * PRD-108: Contract Amendment Needed
 *
 * Fires when contract amendment needs are detected for a customer account.
 * Detects usage overages, seat overages, and other situations requiring amendments.
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';
import { contractAmendmentAlertDetector, AmendmentAlertTriggerType } from '../../services/contractAmendmentAlert/index.js';

// Valid trigger types for contract amendments
const VALID_TRIGGER_TYPES: AmendmentAlertTriggerType[] = [
  'usage_overage',
  'seat_overage',
  'storage_overage',
  'api_overage',
  'out_of_scope_request',
  'use_case_change',
  'early_renewal_request',
  'term_extension_request',
  'feature_upgrade_request',
];

export const contractAmendmentNeededProcessor: ConditionProcessor = {
  type: 'contract_amendment_needed' as any, // Will be added to TriggerType

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Process relevant event types that might indicate amendment needs
    const relevantEvents = [
      'usage_metric_updated',
      'product_usage',
      'contract_updated',
      'support_ticket_created',
      'custom',
    ];

    if (!relevantEvents.includes(event.type)) {
      return false;
    }

    // Get condition parameters
    const minOveragePercent = condition.params.minOveragePercent ?? 10;
    const triggerTypes = condition.params.triggerTypes as AmendmentAlertTriggerType[] | undefined;
    const minEstimatedValue = condition.params.minEstimatedValue ?? 0;
    const excludeLowPriority = condition.params.excludeLowPriority ?? false;

    // Run amendment detection for this customer
    const detectedNeeds = await contractAmendmentAlertDetector.detectForCustomer(event.customerId);

    if (!detectedNeeds || detectedNeeds.length === 0) {
      return false;
    }

    // Filter detected needs based on condition parameters
    let filteredNeeds = detectedNeeds;

    // Filter by trigger types if specified
    if (triggerTypes && triggerTypes.length > 0) {
      filteredNeeds = filteredNeeds.filter(need => triggerTypes.includes(need.triggerType));
    }

    // Filter by minimum overage percent
    if (minOveragePercent > 0) {
      filteredNeeds = filteredNeeds.filter(need => {
        const overagePercent = need.details.overagePercent ?? 0;
        return overagePercent >= minOveragePercent;
      });
    }

    // Filter by minimum estimated value
    if (minEstimatedValue > 0) {
      filteredNeeds = filteredNeeds.filter(need => need.estimatedMonthlyValue >= minEstimatedValue);
    }

    // Filter out low priority if requested
    if (excludeLowPriority) {
      filteredNeeds = filteredNeeds.filter(need => need.priority !== 'low');
    }

    if (filteredNeeds.length === 0) {
      return false;
    }

    // Attach detection data to event for use in actions
    event.data.amendmentNeeds = filteredNeeds;
    event.data.primaryAmendmentNeed = filteredNeeds[0];
    event.data.totalEstimatedValue = filteredNeeds.reduce((sum, need) => sum + need.estimatedMonthlyValue, 0);
    event.data.amendmentCount = filteredNeeds.length;
    event.data.highestPriority = filteredNeeds[0].priority;

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const {
      minOveragePercent,
      triggerTypes,
      minEstimatedValue,
      excludeLowPriority,
    } = condition.params;

    const parts: string[] = ['Contract amendment needed'];

    if (triggerTypes && triggerTypes.length > 0) {
      parts.push(`for ${triggerTypes.join(' or ')}`);
    }

    if (minOveragePercent !== undefined && minOveragePercent > 0) {
      parts.push(`with overage >= ${minOveragePercent}%`);
    }

    if (minEstimatedValue) {
      parts.push(`with value >= $${minEstimatedValue.toLocaleString()}/month`);
    }

    if (excludeLowPriority) {
      parts.push('(excluding low priority)');
    }

    return parts.join(' ');
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const {
      minOveragePercent,
      triggerTypes,
      minEstimatedValue,
    } = condition.params;

    // Validate minOveragePercent
    if (minOveragePercent !== undefined) {
      if (typeof minOveragePercent !== 'number' || minOveragePercent < 0 || minOveragePercent > 100) {
        return { valid: false, error: 'minOveragePercent must be between 0 and 100' };
      }
    }

    // Validate triggerTypes
    if (triggerTypes !== undefined) {
      if (!Array.isArray(triggerTypes)) {
        return { valid: false, error: 'triggerTypes must be an array' };
      }

      for (const type of triggerTypes) {
        if (!VALID_TRIGGER_TYPES.includes(type)) {
          return { valid: false, error: `Invalid trigger type: ${type}` };
        }
      }
    }

    // Validate minEstimatedValue
    if (minEstimatedValue !== undefined) {
      if (typeof minEstimatedValue !== 'number' || minEstimatedValue < 0) {
        return { valid: false, error: 'minEstimatedValue must be a non-negative number' };
      }
    }

    return { valid: true };
  },
};

export default contractAmendmentNeededProcessor;
