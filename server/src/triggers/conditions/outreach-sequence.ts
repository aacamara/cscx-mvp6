/**
 * Outreach Sequence Trigger Condition Processor
 * PRD-191: Fires when conditions are met for auto-enrolling in Outreach sequences
 *
 * Supports triggers:
 * - new_customer: New customer onboarded
 * - renewal_approaching: Renewal within X days
 * - health_drop: Health score drops below threshold
 * - champion_left: Champion stakeholder departed
 * - onboarding_complete: Onboarding phase completed
 * - usage_drop: Usage drops significantly
 * - nps_detractor: NPS score is detractor (0-6)
 * - at_risk: Customer marked at risk
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';
import { OutreachTriggerType } from '../../services/outreach/types.js';

// Map of event types to Outreach trigger types
const EVENT_TO_TRIGGER_MAP: Record<string, OutreachTriggerType> = {
  'customer_created': 'new_customer',
  'customer_onboarded': 'new_customer',
  'renewal_approaching': 'renewal_approaching',
  'health_score_updated': 'health_drop',
  'stakeholder_changed': 'champion_left',
  'onboarding_completed': 'onboarding_complete',
  'usage_updated': 'usage_drop',
  'nps_submitted': 'nps_detractor',
  'risk_status_changed': 'at_risk',
  'upsell_opportunity': 'upsell_opportunity',
};

export const outreachSequenceProcessor: ConditionProcessor = {
  type: 'outreach_sequence',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    const triggerType = condition.params.triggerType as OutreachTriggerType;

    if (!triggerType) {
      return false;
    }

    // Map the event type to our trigger type
    const eventTriggerType = EVENT_TO_TRIGGER_MAP[event.type];

    // Check if this event matches the trigger type we're looking for
    if (eventTriggerType !== triggerType) {
      return false;
    }

    // Evaluate trigger-specific conditions
    switch (triggerType) {
      case 'new_customer':
        return evaluateNewCustomer(condition, event);

      case 'renewal_approaching':
        return evaluateRenewalApproaching(condition, event);

      case 'health_drop':
        return evaluateHealthDrop(condition, event);

      case 'champion_left':
        return evaluateChampionLeft(condition, event);

      case 'onboarding_complete':
        return evaluateOnboardingComplete(condition, event);

      case 'usage_drop':
        return evaluateUsageDrop(condition, event);

      case 'nps_detractor':
        return evaluateNPSDetractor(condition, event);

      case 'at_risk':
        return evaluateAtRisk(condition, event);

      case 'upsell_opportunity':
        return evaluateUpsellOpportunity(condition, event);

      default:
        return false;
    }
  },

  getDescription: (condition: TriggerCondition): string => {
    const triggerType = condition.params.triggerType as OutreachTriggerType;
    const descriptions: Record<OutreachTriggerType, string> = {
      new_customer: 'New customer is created or onboarded',
      renewal_approaching: `Renewal is within ${condition.params.daysBeforeRenewal || 90} days`,
      health_drop: `Health score drops below ${condition.params.healthThreshold || 50}`,
      champion_left: 'Champion stakeholder departs',
      onboarding_complete: 'Customer completes onboarding',
      usage_drop: `Usage drops by ${condition.params.usageDropPercent || 30}%+`,
      nps_detractor: 'Customer submits detractor NPS (0-6)',
      at_risk: 'Customer is marked at risk',
      upsell_opportunity: 'Upsell opportunity detected',
    };

    return descriptions[triggerType] || 'Unknown trigger';
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const { triggerType, sequenceId } = condition.params;

    if (!triggerType) {
      return { valid: false, error: 'triggerType is required' };
    }

    if (!sequenceId) {
      return { valid: false, error: 'sequenceId is required' };
    }

    const validTriggers: OutreachTriggerType[] = [
      'new_customer',
      'renewal_approaching',
      'health_drop',
      'champion_left',
      'onboarding_complete',
      'usage_drop',
      'nps_detractor',
      'at_risk',
      'upsell_opportunity',
    ];

    if (!validTriggers.includes(triggerType)) {
      return { valid: false, error: `Invalid trigger type: ${triggerType}` };
    }

    return { valid: true };
  },
};

// ============================================
// Trigger-Specific Evaluation Functions
// ============================================

function evaluateNewCustomer(condition: TriggerCondition, event: CustomerEvent): boolean {
  // Check segment filter if specified
  const segmentFilter = condition.params.segmentFilter;
  if (segmentFilter && event.data.segment !== segmentFilter) {
    return false;
  }

  // Check ARR threshold if specified
  const minARR = condition.params.minARR;
  if (minARR && event.data.arr < minARR) {
    return false;
  }

  return true;
}

function evaluateRenewalApproaching(condition: TriggerCondition, event: CustomerEvent): boolean {
  const daysBeforeRenewal = condition.params.daysBeforeRenewal || 90;
  const daysUntilRenewal = event.data.daysUntilRenewal;

  if (daysUntilRenewal === undefined) {
    return false;
  }

  // Only trigger at specific day thresholds (90, 60, 30, 7)
  const thresholds = [90, 60, 30, 7];
  const matchingThreshold = thresholds.find(t =>
    t <= daysBeforeRenewal && daysUntilRenewal === t
  );

  if (!matchingThreshold) {
    return false;
  }

  // Check segment filter
  const segmentFilter = condition.params.segmentFilter;
  if (segmentFilter && event.data.segment !== segmentFilter) {
    return false;
  }

  return true;
}

function evaluateHealthDrop(condition: TriggerCondition, event: CustomerEvent): boolean {
  const healthThreshold = condition.params.healthThreshold || 50;
  const previousScore = event.data.previousScore;
  const currentScore = event.data.currentScore;

  if (previousScore === undefined || currentScore === undefined) {
    return false;
  }

  // Score must have dropped and now be below threshold
  if (currentScore >= previousScore || currentScore >= healthThreshold) {
    return false;
  }

  // Optionally require a minimum drop amount
  const minDrop = condition.params.minDrop || 0;
  if (previousScore - currentScore < minDrop) {
    return false;
  }

  return true;
}

function evaluateChampionLeft(condition: TriggerCondition, event: CustomerEvent): boolean {
  // Must be a departure event for a champion
  if (event.data.changeType !== 'departed') {
    return false;
  }

  // Must have been a champion
  if (!event.data.wasChampion) {
    return false;
  }

  // Check segment filter
  const segmentFilter = condition.params.segmentFilter;
  if (segmentFilter && event.data.segment !== segmentFilter) {
    return false;
  }

  return true;
}

function evaluateOnboardingComplete(condition: TriggerCondition, event: CustomerEvent): boolean {
  // Must be onboarding completion
  if (event.data.phase !== 'completed' && event.data.status !== 'completed') {
    return false;
  }

  // Check segment filter
  const segmentFilter = condition.params.segmentFilter;
  if (segmentFilter && event.data.segment !== segmentFilter) {
    return false;
  }

  return true;
}

function evaluateUsageDrop(condition: TriggerCondition, event: CustomerEvent): boolean {
  const dropPercent = condition.params.usageDropPercent || 30;
  const previousUsage = event.data.previousUsage;
  const currentUsage = event.data.currentUsage;

  if (previousUsage === undefined || currentUsage === undefined || previousUsage === 0) {
    return false;
  }

  const actualDropPercent = ((previousUsage - currentUsage) / previousUsage) * 100;

  if (actualDropPercent < dropPercent) {
    return false;
  }

  // Check health threshold - only trigger if health is also concerning
  const healthThreshold = condition.params.healthThreshold;
  if (healthThreshold && event.data.healthScore >= healthThreshold) {
    return false;
  }

  return true;
}

function evaluateNPSDetractor(condition: TriggerCondition, event: CustomerEvent): boolean {
  const npsScore = event.data.score;

  if (npsScore === undefined) {
    return false;
  }

  // Detractor is 0-6
  if (npsScore > 6) {
    return false;
  }

  // Check segment filter
  const segmentFilter = condition.params.segmentFilter;
  if (segmentFilter && event.data.segment !== segmentFilter) {
    return false;
  }

  return true;
}

function evaluateAtRisk(condition: TriggerCondition, event: CustomerEvent): boolean {
  // Must be transitioning to at-risk status
  if (event.data.newStatus !== 'at_risk' && event.data.riskLevel !== 'high') {
    return false;
  }

  // Should not have been at risk before
  if (event.data.previousStatus === 'at_risk' || event.data.previousRiskLevel === 'high') {
    return false;
  }

  // Check health threshold
  const healthThreshold = condition.params.healthThreshold;
  if (healthThreshold && event.data.healthScore >= healthThreshold) {
    return false;
  }

  return true;
}

function evaluateUpsellOpportunity(condition: TriggerCondition, event: CustomerEvent): boolean {
  // Check signal strength
  const minSignalStrength = condition.params.minSignalStrength || 0.7;
  if (event.data.signalStrength < minSignalStrength) {
    return false;
  }

  // Check segment filter
  const segmentFilter = condition.params.segmentFilter;
  if (segmentFilter && event.data.segment !== segmentFilter) {
    return false;
  }

  return true;
}

export default outreachSequenceProcessor;
