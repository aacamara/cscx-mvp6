/**
 * Executive Change Condition Processor
 * PRD-095: Fires when an executive change is detected at a customer organization
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';

export const executiveChangeProcessor: ConditionProcessor = {
  type: 'executive_change',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process executive change events
    if (event.type !== 'executive_change_detected' && event.type !== 'stakeholder_changed') {
      return false;
    }

    const {
      changeTypes,          // Optional: filter by change type (new_hire, departure, promotion, title_change)
      titlePatterns,        // Optional: filter by title patterns (e.g., CTO, VP)
      sources,              // Optional: filter by detection source
      minConfidence,        // Optional: minimum confidence threshold
    } = condition.params;

    const eventChangeType = event.data.changeType;
    const eventTitle = event.data.newTitle || event.data.stakeholderRole || '';
    const eventSource = event.data.source;
    const eventConfidence = event.data.confidence;

    // Check change type filter
    if (changeTypes && changeTypes.length > 0) {
      if (!changeTypes.includes(eventChangeType)) {
        return false;
      }
    }

    // Check title pattern filter
    if (titlePatterns && titlePatterns.length > 0) {
      const titleLower = eventTitle.toLowerCase();
      const matchesPattern = titlePatterns.some((pattern: string) => {
        const patternLower = pattern.toLowerCase();
        return titleLower.includes(patternLower) ||
               new RegExp(patternLower, 'i').test(titleLower);
      });
      if (!matchesPattern) {
        return false;
      }
    }

    // Check source filter
    if (sources && sources.length > 0) {
      if (!sources.includes(eventSource)) {
        return false;
      }
    }

    // Check confidence threshold
    if (minConfidence !== undefined && eventConfidence !== undefined) {
      if (eventConfidence < minConfidence) {
        return false;
      }
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const parts: string[] = ['Executive change detected'];

    const { changeTypes, titlePatterns, sources, minConfidence } = condition.params;

    if (changeTypes && changeTypes.length > 0) {
      parts.push(`(${changeTypes.join(' or ')})`);
    }

    if (titlePatterns && titlePatterns.length > 0) {
      parts.push(`matching titles: ${titlePatterns.join(', ')}`);
    }

    if (sources && sources.length > 0) {
      parts.push(`via ${sources.join(' or ')}`);
    }

    if (minConfidence !== undefined) {
      parts.push(`with ${minConfidence}%+ confidence`);
    }

    return parts.join(' ');
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const { changeTypes, titlePatterns, sources, minConfidence } = condition.params;

    const validChangeTypes = ['new_hire', 'departure', 'promotion', 'title_change'];
    if (changeTypes && changeTypes.length > 0) {
      for (const ct of changeTypes) {
        if (!validChangeTypes.includes(ct)) {
          return {
            valid: false,
            error: `Invalid changeType: ${ct}. Must be one of: ${validChangeTypes.join(', ')}`,
          };
        }
      }
    }

    const validSources = ['linkedin', 'press_release', 'company_announcement', 'email_signature', 'manual', 'api_enrichment'];
    if (sources && sources.length > 0) {
      for (const source of sources) {
        if (!validSources.includes(source)) {
          return {
            valid: false,
            error: `Invalid source: ${source}. Must be one of: ${validSources.join(', ')}`,
          };
        }
      }
    }

    if (minConfidence !== undefined) {
      if (typeof minConfidence !== 'number' || minConfidence < 0 || minConfidence > 100) {
        return { valid: false, error: 'minConfidence must be a number between 0 and 100' };
      }
    }

    if (titlePatterns && !Array.isArray(titlePatterns)) {
      return { valid: false, error: 'titlePatterns must be an array of strings' };
    }

    return { valid: true };
  },
};
