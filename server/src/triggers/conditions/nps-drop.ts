/**
 * NPS Drop Condition Processor
 *
 * PRD-091: NPS Score Drop - Recovery Workflow
 *
 * Fires when an NPS score drops significantly, especially category drops.
 * Separate from nps-submitted to handle drop-specific logic.
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';

export const npsDropProcessor: ConditionProcessor = {
  type: 'nps_drop' as any, // Add to TriggerType

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process NPS response events with drop data
    if (event.type !== 'nps_response') {
      return false;
    }

    const {
      score,
      previousScore,
      previousCategory,
      category,
      pointDrop,
      severity,
    } = event.data;

    // Validate score exists
    if (score === undefined || score === null || typeof score !== 'number') {
      return false;
    }

    // Get condition params
    const {
      minPointDrop,          // Minimum point drop to trigger (e.g., 3)
      categoryDrop,          // Require specific category drop
      targetCategory,        // Filter by resulting category (e.g., 'detractor')
      fromCategory,          // Filter by source category (e.g., 'promoter')
      minSeverity,           // Minimum severity level
      excludeFirstTime,      // Don't trigger on first-time detractors with no previous score
    } = condition.params;

    // Check if this is a first-time submission (no previous score)
    const isFirstTime = previousScore === null || previousScore === undefined;
    if (excludeFirstTime && isFirstTime) {
      return false;
    }

    // Check target category filter
    if (targetCategory && category !== targetCategory) {
      return false;
    }

    // Check source category filter
    if (fromCategory && previousCategory !== fromCategory) {
      return false;
    }

    // Check minimum point drop
    if (minPointDrop !== undefined && typeof minPointDrop === 'number') {
      if (!pointDrop || pointDrop < minPointDrop) {
        return false;
      }
    }

    // Check for category drop requirement
    if (categoryDrop) {
      const validCategoryDrop = checkCategoryDrop(previousCategory, category, categoryDrop);
      if (!validCategoryDrop) {
        return false;
      }
    }

    // Check minimum severity
    if (minSeverity) {
      const severityLevels = ['low', 'medium', 'high', 'critical'];
      const minSeverityIndex = severityLevels.indexOf(minSeverity);
      const actualSeverityIndex = severityLevels.indexOf(severity || 'low');

      if (actualSeverityIndex < minSeverityIndex) {
        return false;
      }
    }

    // If we reach here with any drop signal, the condition matches
    // At minimum, require either a category drop OR significant point drop OR detractor
    const hasSignificantDrop =
      category === 'detractor' ||
      (previousCategory && previousCategory !== category) ||
      (pointDrop && pointDrop >= 3);

    return hasSignificantDrop;
  },

  getDescription: (condition: TriggerCondition): string => {
    const {
      minPointDrop,
      categoryDrop,
      targetCategory,
      fromCategory,
      minSeverity,
    } = condition.params;

    const parts: string[] = [];

    if (fromCategory && targetCategory) {
      parts.push(`NPS drops from ${fromCategory} to ${targetCategory}`);
    } else if (targetCategory) {
      parts.push(`NPS becomes ${targetCategory}`);
    } else if (fromCategory) {
      parts.push(`NPS drops from ${fromCategory}`);
    } else if (categoryDrop) {
      parts.push(`NPS category drops (${categoryDrop})`);
    }

    if (minPointDrop) {
      parts.push(`drops by ${minPointDrop}+ points`);
    }

    if (minSeverity) {
      parts.push(`${minSeverity} severity or higher`);
    }

    return parts.length > 0 ? parts.join(', ') : 'NPS score drops significantly';
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const {
      minPointDrop,
      targetCategory,
      fromCategory,
      minSeverity,
      categoryDrop,
    } = condition.params;

    const validCategories = ['promoter', 'passive', 'detractor'];
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    const validCategoryDrops = ['any', 'to_detractor', 'to_passive', 'from_promoter'];

    if (minPointDrop !== undefined && (typeof minPointDrop !== 'number' || minPointDrop <= 0)) {
      return { valid: false, error: 'minPointDrop must be a positive number' };
    }

    if (targetCategory !== undefined && !validCategories.includes(targetCategory)) {
      return { valid: false, error: `targetCategory must be one of: ${validCategories.join(', ')}` };
    }

    if (fromCategory !== undefined && !validCategories.includes(fromCategory)) {
      return { valid: false, error: `fromCategory must be one of: ${validCategories.join(', ')}` };
    }

    if (minSeverity !== undefined && !validSeverities.includes(minSeverity)) {
      return { valid: false, error: `minSeverity must be one of: ${validSeverities.join(', ')}` };
    }

    if (categoryDrop !== undefined && !validCategoryDrops.includes(categoryDrop)) {
      return { valid: false, error: `categoryDrop must be one of: ${validCategoryDrops.join(', ')}` };
    }

    return { valid: true };
  },
};

/**
 * Check if the category transition matches the required drop type
 */
function checkCategoryDrop(
  fromCategory: string | null | undefined,
  toCategory: string,
  dropType: string
): boolean {
  if (!fromCategory) return false;

  switch (dropType) {
    case 'any':
      // Any category drop
      return (
        (fromCategory === 'promoter' && toCategory !== 'promoter') ||
        (fromCategory === 'passive' && toCategory === 'detractor')
      );

    case 'to_detractor':
      // Specifically dropping to detractor
      return toCategory === 'detractor' && fromCategory !== 'detractor';

    case 'to_passive':
      // Specifically dropping to passive from promoter
      return toCategory === 'passive' && fromCategory === 'promoter';

    case 'from_promoter':
      // Dropping from promoter to anything else
      return fromCategory === 'promoter' && toCategory !== 'promoter';

    default:
      return false;
  }
}

export default npsDropProcessor;
