/**
 * Support Satisfaction Drop Condition Processor
 *
 * PRD-102: Support Satisfaction Drop Alert
 *
 * Fires when a customer's support CSAT drops:
 * - Individual poor ratings (1-2 on 5-point scale)
 * - Declining trends (average drops >20%)
 * - Repeat dissatisfaction patterns
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';

export const supportSatisfactionDropProcessor: ConditionProcessor = {
  type: 'support_satisfaction_drop' as any,

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process support CSAT events
    if (event.type !== 'support_csat_received') {
      return false;
    }

    const {
      rating,
      previousAvgCsat,
      trendDirection,
      trendPercentage,
      poorRatingsLast30Days,
      ticketCategory,
      wasEscalated,
      resolutionTimeHours,
      slaBreach,
    } = event.data;

    // Validate rating exists
    if (rating === undefined || rating === null || typeof rating !== 'number') {
      return false;
    }

    // Get condition params
    const {
      maxRating,                    // Maximum rating to trigger (e.g., 2 for poor ratings)
      minTrendDrop,                 // Minimum percentage decline in trend
      minPoorRatingsInPeriod,       // Minimum poor ratings in last 30 days
      targetTrendDirection,         // Specific trend direction to match
      requireEscalated,             // Only trigger for escalated tickets
      requireSlaBreach,             // Only trigger for SLA breaches
      excludeCategories,            // Categories to exclude
      minResolutionTimeHours,       // Minimum resolution time to trigger
    } = condition.params;

    // Check maximum rating threshold
    if (maxRating !== undefined && typeof maxRating === 'number') {
      if (rating > maxRating) {
        return false;
      }
    } else {
      // Default: trigger on poor ratings (1-2)
      if (rating > 2) {
        return false;
      }
    }

    // Check category exclusions
    if (excludeCategories && Array.isArray(excludeCategories) && ticketCategory) {
      if (excludeCategories.includes(ticketCategory)) {
        return false;
      }
    }

    // Check escalation requirement
    if (requireEscalated && !wasEscalated) {
      return false;
    }

    // Check SLA breach requirement
    if (requireSlaBreach && !slaBreach) {
      return false;
    }

    // Check minimum resolution time
    if (minResolutionTimeHours !== undefined && typeof minResolutionTimeHours === 'number') {
      if (!resolutionTimeHours || resolutionTimeHours < minResolutionTimeHours) {
        return false;
      }
    }

    // Check trend direction
    if (targetTrendDirection && trendDirection !== targetTrendDirection) {
      return false;
    }

    // Check trend drop percentage
    if (minTrendDrop !== undefined && typeof minTrendDrop === 'number') {
      if (!trendPercentage || Math.abs(trendPercentage) < minTrendDrop) {
        // Only trigger if the trend is actually declining
        if (trendPercentage > 0) {
          return false;
        }
      }
    }

    // Check poor ratings count in period
    if (minPoorRatingsInPeriod !== undefined && typeof minPoorRatingsInPeriod === 'number') {
      if (!poorRatingsLast30Days || poorRatingsLast30Days < minPoorRatingsInPeriod) {
        return false;
      }
    }

    // If we reach here, the condition matches
    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const {
      maxRating,
      minTrendDrop,
      minPoorRatingsInPeriod,
      targetTrendDirection,
      requireEscalated,
      requireSlaBreach,
    } = condition.params;

    const parts: string[] = [];

    if (maxRating !== undefined) {
      parts.push(`CSAT rating <= ${maxRating}`);
    } else {
      parts.push('Poor CSAT rating (1-2)');
    }

    if (minTrendDrop !== undefined) {
      parts.push(`trend drops >=${minTrendDrop}%`);
    }

    if (targetTrendDirection) {
      parts.push(`trend is ${targetTrendDirection}`);
    }

    if (minPoorRatingsInPeriod !== undefined) {
      parts.push(`>=${minPoorRatingsInPeriod} poor ratings in 30 days`);
    }

    if (requireEscalated) {
      parts.push('ticket was escalated');
    }

    if (requireSlaBreach) {
      parts.push('SLA was breached');
    }

    return parts.length > 0 ? parts.join(', ') : 'Support satisfaction drops below threshold';
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const {
      maxRating,
      minTrendDrop,
      minPoorRatingsInPeriod,
      targetTrendDirection,
      minResolutionTimeHours,
    } = condition.params;

    const validTrendDirections = ['improving', 'stable', 'declining', 'critical'];

    if (maxRating !== undefined && (typeof maxRating !== 'number' || maxRating < 1 || maxRating > 5)) {
      return { valid: false, error: 'maxRating must be a number between 1 and 5' };
    }

    if (minTrendDrop !== undefined && (typeof minTrendDrop !== 'number' || minTrendDrop <= 0)) {
      return { valid: false, error: 'minTrendDrop must be a positive number' };
    }

    if (minPoorRatingsInPeriod !== undefined && (typeof minPoorRatingsInPeriod !== 'number' || minPoorRatingsInPeriod <= 0)) {
      return { valid: false, error: 'minPoorRatingsInPeriod must be a positive number' };
    }

    if (targetTrendDirection !== undefined && !validTrendDirections.includes(targetTrendDirection)) {
      return { valid: false, error: `targetTrendDirection must be one of: ${validTrendDirections.join(', ')}` };
    }

    if (minResolutionTimeHours !== undefined && (typeof minResolutionTimeHours !== 'number' || minResolutionTimeHours < 0)) {
      return { valid: false, error: 'minResolutionTimeHours must be a non-negative number' };
    }

    return { valid: true };
  },
};

/**
 * Determine alert severity based on rating and context
 */
export function determineSeverity(
  rating: number,
  customerArr: number,
  poorRatingsLast30Days: number,
  trendDirection: string | undefined
): 'low' | 'medium' | 'high' | 'critical' {
  // Critical: Very low rating on high-value customer or repeat issues
  if (rating === 1 && customerArr >= 100000) {
    return 'critical';
  }

  if (poorRatingsLast30Days >= 3) {
    return 'critical';
  }

  if (trendDirection === 'critical') {
    return 'critical';
  }

  // High: Low rating or declining trend on valuable customer
  if (rating <= 2 && customerArr >= 50000) {
    return 'high';
  }

  if (rating === 1) {
    return 'high';
  }

  if (trendDirection === 'declining' && customerArr >= 100000) {
    return 'high';
  }

  // Medium: Standard poor rating
  if (rating <= 2) {
    return 'medium';
  }

  if (trendDirection === 'declining') {
    return 'medium';
  }

  // Low: Borderline cases
  return 'low';
}

export default supportSatisfactionDropProcessor;
