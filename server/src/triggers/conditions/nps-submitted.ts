/**
 * NPS Submitted Condition Processor
 * Fires when a customer submits an NPS response, with filtering by score range
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';

export const npsSubmittedProcessor: ConditionProcessor = {
  type: 'nps_submitted',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process NPS response events
    if (event.type !== 'nps_response') {
      return false;
    }

    const score = event.data.score;

    // Validate score exists and is valid
    if (score === undefined || score === null || typeof score !== 'number') {
      return false;
    }

    if (score < 0 || score > 10) {
      return false;
    }

    // Check score category
    const category = condition.params.category;  // 'detractor' | 'passive' | 'promoter'
    const minScore = condition.params.minScore;
    const maxScore = condition.params.maxScore;

    // Category-based filtering
    if (category) {
      const scoreCategory = getNPSCategory(score);
      if (category !== scoreCategory) {
        return false;
      }
    }

    // Range-based filtering
    if (minScore !== undefined && score < minScore) {
      return false;
    }

    if (maxScore !== undefined && score > maxScore) {
      return false;
    }

    // Check for comments
    if (condition.params.requiresComment) {
      const hasComment = event.data.comment && event.data.comment.trim().length > 0;
      if (!hasComment) {
        return false;
      }
    }

    // Check for negative sentiment keywords
    if (condition.params.negativeSentimentKeywords) {
      const comment = (event.data.comment || '').toLowerCase();
      const keywords = condition.params.negativeSentimentKeywords as string[];
      const hasNegativeKeyword = keywords.some((kw) => comment.includes(kw.toLowerCase()));

      if (condition.params.requireNegativeSentiment && !hasNegativeKeyword) {
        return false;
      }
    }

    // Check score change (if previous score available)
    if (condition.params.scoreDropThreshold !== undefined) {
      const previousScore = event.data.previousScore;
      if (previousScore !== undefined && typeof previousScore === 'number') {
        const drop = previousScore - score;
        if (drop < condition.params.scoreDropThreshold) {
          return false;
        }
      }
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const { category, minScore, maxScore, scoreDropThreshold } = condition.params;

    if (category) {
      return `NPS ${category} response received`;
    }

    if (minScore !== undefined && maxScore !== undefined) {
      return `NPS score between ${minScore} and ${maxScore}`;
    }

    if (minScore !== undefined) {
      return `NPS score ${minScore} or higher`;
    }

    if (maxScore !== undefined) {
      return `NPS score ${maxScore} or lower`;
    }

    if (scoreDropThreshold !== undefined) {
      return `NPS score dropped by ${scoreDropThreshold}+ points`;
    }

    return 'NPS response submitted';
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const { category, minScore, maxScore, scoreDropThreshold } = condition.params;

    if (category !== undefined && !['detractor', 'passive', 'promoter'].includes(category)) {
      return { valid: false, error: 'category must be detractor, passive, or promoter' };
    }

    if (minScore !== undefined && (typeof minScore !== 'number' || minScore < 0 || minScore > 10)) {
      return { valid: false, error: 'minScore must be between 0 and 10' };
    }

    if (maxScore !== undefined && (typeof maxScore !== 'number' || maxScore < 0 || maxScore > 10)) {
      return { valid: false, error: 'maxScore must be between 0 and 10' };
    }

    if (minScore !== undefined && maxScore !== undefined && minScore > maxScore) {
      return { valid: false, error: 'minScore cannot be greater than maxScore' };
    }

    if (scoreDropThreshold !== undefined && (typeof scoreDropThreshold !== 'number' || scoreDropThreshold <= 0)) {
      return { valid: false, error: 'scoreDropThreshold must be a positive number' };
    }

    return { valid: true };
  },
};

function getNPSCategory(score: number): 'detractor' | 'passive' | 'promoter' {
  if (score <= 6) return 'detractor';
  if (score <= 8) return 'passive';
  return 'promoter';
}
