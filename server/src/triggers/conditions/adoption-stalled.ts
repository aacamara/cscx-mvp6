/**
 * PRD-090: Adoption Stalled Condition Processor
 *
 * Fires when feature adoption has stalled for a customer.
 *
 * Detection criteria:
 * - Feature activated but <20% usage for 14+ days past expected adoption date
 * - Feature importance considered for prioritization
 *
 * Severity calculation:
 * - High importance feature + long stall = critical
 * - Important feature + moderate stall = high
 * - Otherwise = medium
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';
import { calculateSeverity, getDueDateOffsetHours } from '../../services/adoption/stall-detector.js';
import type { AdoptionStallEventData, AdoptionStage } from '../../services/adoption/types.js';

export interface AdoptionStalledParams {
  minUsageScore?: number;           // Default: 20 - usage score below this is stalled
  minDaysStalled?: number;          // Default: 14 - minimum days to trigger
  minFeatureImportance?: number;    // Default: 50 - only track important features
  severity?: 'medium' | 'high' | 'critical';  // Filter by severity
  featureIds?: string[];            // Only trigger for specific features
  excludeFeatureIds?: string[];     // Exclude specific features
  stages?: AdoptionStage[];         // Only trigger for specific stages
  cooldownDays?: number;            // Default: 30 - cooldown between triggers
}

export const adoptionStalledProcessor: ConditionProcessor = {
  type: 'adoption_stalled' as any, // Will be added to TriggerType

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process product_usage events from adoption stall detector
    if (event.type !== 'product_usage' || event.source !== 'adoption_stall_detector') {
      return false;
    }

    const params = condition.params as AdoptionStalledParams;
    const data = event.data as AdoptionStallEventData;

    // Validate we have the required data
    if (!data.featureId || data.usageScore === undefined) {
      return false;
    }

    // Check usage score threshold
    const minUsageScore = params.minUsageScore ?? 20;
    if (data.usageScore >= minUsageScore) {
      return false;
    }

    // Check days stalled threshold
    const minDaysStalled = params.minDaysStalled ?? 14;
    if (data.daysInCurrentStage < minDaysStalled) {
      return false;
    }

    // Check feature importance threshold
    const minFeatureImportance = params.minFeatureImportance ?? 50;
    if (data.featureImportance < minFeatureImportance) {
      return false;
    }

    // Check feature ID filters
    if (params.featureIds && params.featureIds.length > 0) {
      if (!params.featureIds.includes(data.featureId)) {
        return false;
      }
    }

    // Check feature exclusions
    if (params.excludeFeatureIds && params.excludeFeatureIds.length > 0) {
      if (params.excludeFeatureIds.includes(data.featureId)) {
        return false;
      }
    }

    // Check stage filter
    if (params.stages && params.stages.length > 0) {
      if (!params.stages.includes(data.currentStage)) {
        return false;
      }
    }

    // Check severity filter
    if (params.severity) {
      const calculatedSeverity = data.severity || calculateSeverity(
        data.featureImportance,
        data.daysInCurrentStage,
        data.usageScore
      );

      const severityOrder = { medium: 1, high: 2, critical: 3 };
      if (severityOrder[calculatedSeverity] < severityOrder[params.severity]) {
        return false;
      }
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const params = condition.params as AdoptionStalledParams;

    let description = 'Feature adoption stalled';

    const minUsageScore = params.minUsageScore ?? 20;
    const minDaysStalled = params.minDaysStalled ?? 14;

    description += ` (usage < ${minUsageScore}% for ${minDaysStalled}+ days)`;

    if (params.minFeatureImportance && params.minFeatureImportance > 50) {
      description += ` for features with importance >= ${params.minFeatureImportance}`;
    }

    if (params.severity) {
      description += ` [${params.severity} severity]`;
    }

    if (params.featureIds && params.featureIds.length > 0) {
      description += ` [features: ${params.featureIds.join(', ')}]`;
    }

    if (params.stages && params.stages.length > 0) {
      description += ` [stages: ${params.stages.join(', ')}]`;
    }

    return description;
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const params = condition.params as AdoptionStalledParams;

    // Validate minUsageScore
    if (params.minUsageScore !== undefined) {
      if (typeof params.minUsageScore !== 'number' || params.minUsageScore < 0 || params.minUsageScore > 100) {
        return { valid: false, error: 'minUsageScore must be between 0 and 100' };
      }
    }

    // Validate minDaysStalled
    if (params.minDaysStalled !== undefined) {
      if (typeof params.minDaysStalled !== 'number' || params.minDaysStalled < 1 || params.minDaysStalled > 365) {
        return { valid: false, error: 'minDaysStalled must be between 1 and 365' };
      }
    }

    // Validate minFeatureImportance
    if (params.minFeatureImportance !== undefined) {
      if (typeof params.minFeatureImportance !== 'number' || params.minFeatureImportance < 0 || params.minFeatureImportance > 100) {
        return { valid: false, error: 'minFeatureImportance must be between 0 and 100' };
      }
    }

    // Validate severity
    if (params.severity !== undefined) {
      if (!['medium', 'high', 'critical'].includes(params.severity)) {
        return { valid: false, error: 'severity must be medium, high, or critical' };
      }
    }

    // Validate stages
    if (params.stages !== undefined) {
      const validStages: AdoptionStage[] = ['not_started', 'started', 'engaged', 'adopted', 'churned'];
      for (const stage of params.stages) {
        if (!validStages.includes(stage)) {
          return { valid: false, error: `Invalid stage: ${stage}. Must be one of: ${validStages.join(', ')}` };
        }
      }
    }

    // Validate featureIds (must be strings)
    if (params.featureIds !== undefined) {
      if (!Array.isArray(params.featureIds)) {
        return { valid: false, error: 'featureIds must be an array' };
      }
    }

    // Validate excludeFeatureIds (must be strings)
    if (params.excludeFeatureIds !== undefined) {
      if (!Array.isArray(params.excludeFeatureIds)) {
        return { valid: false, error: 'excludeFeatureIds must be an array' };
      }
    }

    // Validate cooldownDays
    if (params.cooldownDays !== undefined) {
      if (typeof params.cooldownDays !== 'number' || params.cooldownDays < 1) {
        return { valid: false, error: 'cooldownDays must be at least 1' };
      }
    }

    return { valid: true };
  },
};

export { getDueDateOffsetHours };
