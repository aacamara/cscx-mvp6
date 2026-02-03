/**
 * Multi-Account Pattern Condition Processor (PRD-105)
 *
 * Triggers when patterns are detected across related accounts:
 * - Risk contagion: Issues spreading from one account to others
 * - Replication opportunity: Successful playbook that could be replicated
 * - Synchronized change: Multiple accounts changing in sync
 * - Cross-expansion: Expansion opportunity across accounts
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';
import { PatternType, PatternSeverity } from '../../services/multiAccountPatterns/types.js';

// ============================================
// Types
// ============================================

export interface MultiAccountPatternParams {
  patternType?: PatternType | PatternType[];  // Specific patterns to trigger on
  minimumSeverity?: PatternSeverity;  // Minimum severity to trigger
  minimumConfidence?: number;  // 0-100, minimum confidence score
  parentCustomerId?: string;  // Only trigger for specific parent
  minAffectedAccounts?: number;  // Minimum accounts affected
  cooldownDays?: number;  // Cooldown between alerts for same pattern type
}

export interface MultiAccountPatternEventData {
  patternId: string;
  patternType: PatternType;
  parentCustomerId: string;
  parentCustomerName: string;
  severity: PatternSeverity;
  confidenceScore: number;
  affectedCustomers: string[];
  affectedCustomerCount: number;
  recommendation: string;
  details: Record<string, any>;
}

// ============================================
// Severity Ordering
// ============================================

const SEVERITY_ORDER: Record<PatternSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function meetsMinimumSeverity(actual: PatternSeverity, minimum: PatternSeverity): boolean {
  return SEVERITY_ORDER[actual] >= SEVERITY_ORDER[minimum];
}

// ============================================
// Condition Processor
// ============================================

export const multiAccountPatternProcessor: ConditionProcessor = {
  type: 'custom' as any, // Will be registered as 'multi_account_pattern'

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process multi-account pattern events
    if (event.type !== 'custom' || event.data.eventType !== 'multi_account_pattern_detected') {
      return false;
    }

    const params = condition.params as MultiAccountPatternParams;
    const eventData = event.data as MultiAccountPatternEventData;

    // Check pattern type filter
    if (params.patternType) {
      const allowedTypes = Array.isArray(params.patternType) ? params.patternType : [params.patternType];
      if (!allowedTypes.includes(eventData.patternType)) {
        return false;
      }
    }

    // Check minimum severity
    if (params.minimumSeverity) {
      if (!meetsMinimumSeverity(eventData.severity, params.minimumSeverity)) {
        return false;
      }
    }

    // Check minimum confidence
    if (params.minimumConfidence !== undefined) {
      if (eventData.confidenceScore < params.minimumConfidence) {
        return false;
      }
    }

    // Check parent customer filter
    if (params.parentCustomerId) {
      if (eventData.parentCustomerId !== params.parentCustomerId) {
        return false;
      }
    }

    // Check minimum affected accounts
    if (params.minAffectedAccounts !== undefined) {
      if (eventData.affectedCustomerCount < params.minAffectedAccounts) {
        return false;
      }
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const params = condition.params as MultiAccountPatternParams;
    const parts: string[] = ['Multi-account pattern detected'];

    if (params.patternType) {
      const types = Array.isArray(params.patternType) ? params.patternType : [params.patternType];
      parts.push(`(${types.join(', ')})`);
    }

    if (params.minimumSeverity) {
      parts.push(`with ${params.minimumSeverity}+ severity`);
    }

    if (params.minimumConfidence !== undefined) {
      parts.push(`and ${params.minimumConfidence}%+ confidence`);
    }

    if (params.minAffectedAccounts !== undefined) {
      parts.push(`affecting ${params.minAffectedAccounts}+ accounts`);
    }

    return parts.join(' ');
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const params = condition.params as MultiAccountPatternParams;

    // Validate pattern type
    const validPatternTypes: PatternType[] = ['risk_contagion', 'replication_opportunity', 'synchronized_change', 'cross_expansion'];
    if (params.patternType) {
      const types = Array.isArray(params.patternType) ? params.patternType : [params.patternType];
      for (const type of types) {
        if (!validPatternTypes.includes(type)) {
          return { valid: false, error: `Invalid pattern type: ${type}. Must be one of: ${validPatternTypes.join(', ')}` };
        }
      }
    }

    // Validate minimum severity
    const validSeverities: PatternSeverity[] = ['low', 'medium', 'high', 'critical'];
    if (params.minimumSeverity && !validSeverities.includes(params.minimumSeverity)) {
      return { valid: false, error: `Invalid severity: ${params.minimumSeverity}. Must be one of: ${validSeverities.join(', ')}` };
    }

    // Validate minimum confidence
    if (params.minimumConfidence !== undefined) {
      if (typeof params.minimumConfidence !== 'number' || params.minimumConfidence < 0 || params.minimumConfidence > 100) {
        return { valid: false, error: 'minimumConfidence must be a number between 0 and 100' };
      }
    }

    // Validate min affected accounts
    if (params.minAffectedAccounts !== undefined) {
      if (typeof params.minAffectedAccounts !== 'number' || params.minAffectedAccounts < 1) {
        return { valid: false, error: 'minAffectedAccounts must be a positive number' };
      }
    }

    // Validate cooldown
    if (params.cooldownDays !== undefined) {
      if (typeof params.cooldownDays !== 'number' || params.cooldownDays < 0) {
        return { valid: false, error: 'cooldownDays must be a non-negative number' };
      }
    }

    return { valid: true };
  },
};

// ============================================
// Event Generator
// ============================================

/**
 * Create a customer event for a detected pattern
 * This is called by the pattern detection service when patterns are found
 */
export function createPatternDetectedEvent(
  patternId: string,
  patternType: PatternType,
  parentCustomerId: string,
  parentCustomerName: string,
  severity: PatternSeverity,
  confidenceScore: number,
  affectedCustomers: string[],
  recommendation: string,
  details: Record<string, any>
): CustomerEvent {
  return {
    id: `pattern-event-${patternId}`,
    type: 'custom',
    customerId: parentCustomerId,
    customerName: parentCustomerName,
    data: {
      eventType: 'multi_account_pattern_detected',
      patternId,
      patternType,
      parentCustomerId,
      parentCustomerName,
      severity,
      confidenceScore,
      affectedCustomers,
      affectedCustomerCount: affectedCustomers.length,
      recommendation,
      details,
    } as MultiAccountPatternEventData,
    timestamp: new Date(),
    source: 'multi_account_pattern_service',
  };
}

// ============================================
// Pre-built Trigger Templates
// ============================================

/**
 * Template for risk contagion alert trigger
 */
export const riskContagionTriggerTemplate: TriggerCondition = {
  type: 'custom' as any, // multi_account_pattern
  params: {
    patternType: 'risk_contagion',
    minimumSeverity: 'medium',
    minimumConfidence: 60,
    cooldownDays: 1,
  } as MultiAccountPatternParams,
};

/**
 * Template for replication opportunity trigger
 */
export const replicationOpportunityTriggerTemplate: TriggerCondition = {
  type: 'custom' as any, // multi_account_pattern
  params: {
    patternType: 'replication_opportunity',
    minimumConfidence: 70,
    minAffectedAccounts: 2,
    cooldownDays: 7,
  } as MultiAccountPatternParams,
};

/**
 * Template for critical synchronized decline trigger
 */
export const synchronizedDeclineTriggerTemplate: TriggerCondition = {
  type: 'custom' as any, // multi_account_pattern
  params: {
    patternType: 'synchronized_change',
    minimumSeverity: 'high',
    minimumConfidence: 75,
    cooldownDays: 3,
  } as MultiAccountPatternParams,
};

/**
 * Template for cross-expansion opportunity trigger
 */
export const crossExpansionTriggerTemplate: TriggerCondition = {
  type: 'custom' as any, // multi_account_pattern
  params: {
    patternType: 'cross_expansion',
    minimumConfidence: 65,
    minAffectedAccounts: 2,
    cooldownDays: 14,
  } as MultiAccountPatternParams,
};

export default multiAccountPatternProcessor;
