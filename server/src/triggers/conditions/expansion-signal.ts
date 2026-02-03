/**
 * Expansion Signal Condition Processor
 * PRD-103: Expansion Signal Detected
 *
 * Fires when expansion signals are detected for a customer account.
 * Integrates with the ExpansionSignalDetector for comprehensive signal analysis.
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';
import { expansionDetector } from '../../services/expansion/detector.js';
import { ExpansionSignalType } from '../../services/expansion/types.js';

export const expansionSignalProcessor: ConditionProcessor = {
  type: 'expansion_signal',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Process relevant event types that might contain expansion signals
    const relevantEvents = [
      'usage_metric_updated',
      'product_usage',
      'stakeholder_changed',
      'login_activity',
    ];

    if (!relevantEvents.includes(event.type)) {
      return false;
    }

    const minCompositeScore = condition.params.minCompositeScore || 0.6;
    const signalTypes = condition.params.signalTypes as ExpansionSignalType[] | undefined;
    const minEstimatedArr = condition.params.minEstimatedArr || 0;

    // Run expansion signal detection for this customer
    const detection = await expansionDetector.detectSignals(event.customerId);

    if (!detection) {
      return false;
    }

    // Check composite score threshold
    if (detection.compositeScore < minCompositeScore) {
      return false;
    }

    // Check estimated ARR threshold
    if (detection.estimatedExpansionArr < minEstimatedArr) {
      return false;
    }

    // If specific signal types required, check for them
    if (signalTypes && signalTypes.length > 0) {
      const detectedTypes = detection.signals.map(s => s.type);
      const hasRequiredSignal = signalTypes.some(t => detectedTypes.includes(t));
      if (!hasRequiredSignal) {
        return false;
      }
    }

    // Attach detection data to event for use in actions
    event.data.expansionDetection = detection;
    event.data.expansionSignals = detection.signals;
    event.data.expansionScore = detection.compositeScore;
    event.data.estimatedExpansionArr = detection.estimatedExpansionArr;

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const { minCompositeScore, signalTypes, minEstimatedArr } = condition.params;
    const parts: string[] = ['Expansion signals detected'];

    if (minCompositeScore !== undefined && minCompositeScore !== 0.6) {
      parts.push(`with score >= ${(minCompositeScore * 100).toFixed(0)}%`);
    }

    if (signalTypes && signalTypes.length > 0) {
      parts.push(`including ${signalTypes.join(' or ')}`);
    }

    if (minEstimatedArr) {
      parts.push(`with potential ARR >= $${minEstimatedArr.toLocaleString()}`);
    }

    return parts.join(' ');
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const { minCompositeScore, signalTypes, minEstimatedArr } = condition.params;

    if (minCompositeScore !== undefined) {
      if (typeof minCompositeScore !== 'number' || minCompositeScore < 0 || minCompositeScore > 1) {
        return { valid: false, error: 'minCompositeScore must be between 0 and 1' };
      }
    }

    if (signalTypes !== undefined) {
      if (!Array.isArray(signalTypes)) {
        return { valid: false, error: 'signalTypes must be an array' };
      }

      const validTypes: ExpansionSignalType[] = [
        'usage_limit_approaching',
        'seat_overage',
        'feature_interest',
        'expansion_mention',
        'new_team_onboarding',
        'api_usage_growth',
        'competitor_displacement',
      ];

      for (const type of signalTypes) {
        if (!validTypes.includes(type)) {
          return { valid: false, error: `Invalid signal type: ${type}` };
        }
      }
    }

    if (minEstimatedArr !== undefined) {
      if (typeof minEstimatedArr !== 'number' || minEstimatedArr < 0) {
        return { valid: false, error: 'minEstimatedArr must be a non-negative number' };
      }
    }

    return { valid: true };
  },
};
