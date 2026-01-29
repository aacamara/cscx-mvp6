/**
 * Health Score Drop Condition Processor
 * Fires when a customer's health score drops by a specified threshold
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';

export const healthScoreDropProcessor: ConditionProcessor = {
  type: 'health_score_drop',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process health score update events
    if (event.type !== 'health_score_updated') {
      return false;
    }

    const threshold = condition.params.threshold || 10;
    const minScore = condition.params.minScore;  // Optional: only fire if score is below this
    const maxScore = condition.params.maxScore;  // Optional: only fire if score was above this

    const previousScore = event.data.previousScore;
    const currentScore = event.data.currentScore;

    // Validate we have the data we need
    if (previousScore === undefined || currentScore === undefined) {
      return false;
    }

    // Calculate drop
    const drop = previousScore - currentScore;

    // Check if drop meets threshold
    if (drop < threshold) {
      return false;
    }

    // Check optional minScore (current score must be below this)
    if (minScore !== undefined && currentScore >= minScore) {
      return false;
    }

    // Check optional maxScore (previous score must have been above this)
    if (maxScore !== undefined && previousScore <= maxScore) {
      return false;
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const threshold = condition.params.threshold || 10;
    let description = `Health score drops by ${threshold}+ points`;

    if (condition.params.minScore) {
      description += ` and falls below ${condition.params.minScore}`;
    }

    return description;
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const { threshold, minScore, maxScore } = condition.params;

    if (threshold !== undefined && (typeof threshold !== 'number' || threshold <= 0)) {
      return { valid: false, error: 'Threshold must be a positive number' };
    }

    if (minScore !== undefined && (typeof minScore !== 'number' || minScore < 0 || minScore > 100)) {
      return { valid: false, error: 'minScore must be between 0 and 100' };
    }

    if (maxScore !== undefined && (typeof maxScore !== 'number' || maxScore < 0 || maxScore > 100)) {
      return { valid: false, error: 'maxScore must be between 0 and 100' };
    }

    return { valid: true };
  },
};
