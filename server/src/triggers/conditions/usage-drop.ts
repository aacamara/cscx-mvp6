/**
 * Usage Drop Condition Processor (PRD-086)
 * Fires when product usage drops significantly from baseline
 *
 * Detects:
 * - DAU/WAU/MAU drops > 30% compared to rolling 7-day average
 * - Feature usage drops > 50% compared to customer baseline
 * - Login frequency drops (daily user becomes weekly user)
 *
 * Severity calculation:
 * - >30% drop = medium
 * - >50% drop = high
 * - >70% drop = critical
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';

export type UsageDropMetricType = 'dau' | 'wau' | 'mau' | 'feature_usage' | 'login_frequency' | 'total_events';

export interface UsageDropParams {
  metricType: UsageDropMetricType;
  threshold: number;  // Percentage drop to trigger (e.g., 30 = 30% drop)
  comparisonPeriod: number;  // Days to compare against (default: 7)
  severity?: 'medium' | 'high' | 'critical';
  excludeWeekends?: boolean;
  minimumBaseline?: number;  // Minimum baseline value to trigger (avoid alerts on tiny numbers)
  cooldownDays?: number;  // Cooldown period between alerts (default: 7)
}

export interface UsageDropEventData {
  metricType: UsageDropMetricType;
  previousValue: number;
  currentValue: number;
  percentDrop: number;
  comparisonPeriod: string;  // e.g., "2026-01-22 to 2026-01-28"
  severity: 'medium' | 'high' | 'critical';
  affectedFeatures?: string[];  // For feature_usage type
  loginPattern?: {
    previous: 'daily' | 'weekly' | 'monthly' | 'sporadic';
    current: 'daily' | 'weekly' | 'monthly' | 'sporadic';
  };
}

/**
 * Calculate severity based on drop percentage
 */
export function calculateSeverity(percentDrop: number): 'medium' | 'high' | 'critical' {
  if (percentDrop >= 70) return 'critical';
  if (percentDrop >= 50) return 'high';
  return 'medium';
}

/**
 * Get due date offset in hours based on severity
 * - critical: 4 hours
 * - high: 12 hours
 * - medium: 24 hours
 */
export function getDueDateOffsetHours(severity: 'medium' | 'high' | 'critical'): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 12;
    case 'medium':
    default:
      return 24;
  }
}

export const usageDropProcessor: ConditionProcessor = {
  type: 'usage_drop',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Only process usage metric events
    if (event.type !== 'usage_metric_updated' && event.type !== 'product_usage') {
      return false;
    }

    const params = condition.params as UsageDropParams;
    const metricType = params.metricType;
    const threshold = params.threshold || 30;  // Default 30% drop
    const minimumBaseline = params.minimumBaseline;

    // Get current and previous values from event
    const currentValue = event.data.currentValue ?? event.data.value;
    const previousValue = event.data.previousValue ?? event.data.baseline;
    const eventMetricType = event.data.metricType ?? event.data.metric;

    // Skip if not the metric we're looking for
    if (metricType && eventMetricType !== metricType) {
      return false;
    }

    // Validate we have the data we need
    if (currentValue === undefined || previousValue === undefined) {
      return false;
    }

    // Check minimum baseline (don't alert on tiny numbers)
    if (minimumBaseline !== undefined && previousValue < minimumBaseline) {
      return false;
    }

    // Avoid division by zero
    if (previousValue === 0) {
      return false;
    }

    // Calculate percentage drop (negative percentChange means a drop)
    const percentChange = ((currentValue - previousValue) / previousValue) * 100;
    const percentDrop = Math.abs(percentChange);

    // Only trigger on drops (negative change)
    if (percentChange >= 0) {
      return false;
    }

    // Check if drop meets threshold
    if (percentDrop < threshold) {
      return false;
    }

    // Check severity filter if specified
    const calculatedSeverity = calculateSeverity(percentDrop);
    if (params.severity && calculatedSeverity !== params.severity) {
      // Only fire for the specified severity or higher
      const severityOrder = { medium: 1, high: 2, critical: 3 };
      if (severityOrder[calculatedSeverity] < severityOrder[params.severity]) {
        return false;
      }
    }

    // Weekend exclusion
    if (params.excludeWeekends) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Log that we're excluding weekend
        console.log(`[UsageDropProcessor] Excluding weekend detection for customer ${event.customerId}`);
        return false;
      }
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const params = condition.params as UsageDropParams;
    const threshold = params.threshold || 30;
    const metricType = params.metricType || 'usage';
    const comparisonPeriod = params.comparisonPeriod || 7;

    let description = `${metricType.toUpperCase()} drops by ${threshold}%+ over ${comparisonPeriod} days`;

    if (params.severity) {
      description += ` (${params.severity} severity)`;
    }

    if (params.excludeWeekends) {
      description += ' (excluding weekends)';
    }

    return description;
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const params = condition.params as UsageDropParams;

    // Validate metric type
    const validMetricTypes: UsageDropMetricType[] = ['dau', 'wau', 'mau', 'feature_usage', 'login_frequency', 'total_events'];
    if (params.metricType && !validMetricTypes.includes(params.metricType)) {
      return { valid: false, error: `metricType must be one of: ${validMetricTypes.join(', ')}` };
    }

    // Validate threshold
    if (params.threshold !== undefined) {
      if (typeof params.threshold !== 'number' || params.threshold <= 0 || params.threshold > 100) {
        return { valid: false, error: 'threshold must be between 0 and 100' };
      }
    }

    // Validate comparison period
    if (params.comparisonPeriod !== undefined) {
      if (typeof params.comparisonPeriod !== 'number' || params.comparisonPeriod < 1 || params.comparisonPeriod > 90) {
        return { valid: false, error: 'comparisonPeriod must be between 1 and 90 days' };
      }
    }

    // Validate severity
    if (params.severity !== undefined) {
      if (!['medium', 'high', 'critical'].includes(params.severity)) {
        return { valid: false, error: 'severity must be medium, high, or critical' };
      }
    }

    // Validate minimum baseline
    if (params.minimumBaseline !== undefined) {
      if (typeof params.minimumBaseline !== 'number' || params.minimumBaseline < 0) {
        return { valid: false, error: 'minimumBaseline must be a non-negative number' };
      }
    }

    // Validate cooldown
    if (params.cooldownDays !== undefined) {
      if (typeof params.cooldownDays !== 'number' || params.cooldownDays < 1) {
        return { valid: false, error: 'cooldownDays must be at least 1' };
      }
    }

    return { valid: true };
  },
};
