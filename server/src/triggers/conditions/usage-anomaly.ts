/**
 * Usage Anomaly Condition Processor
 * Fires when product usage patterns deviate significantly from normal
 */

import { ConditionProcessor, TriggerCondition, CustomerEvent } from '../index.js';

export const usageAnomalyProcessor: ConditionProcessor = {
  type: 'usage_anomaly',

  evaluate: async (condition: TriggerCondition, event: CustomerEvent): Promise<boolean> => {
    // Process usage metric events or product usage events
    if (event.type !== 'usage_metric_updated' && event.type !== 'product_usage') {
      return false;
    }

    const anomalyType = condition.params.anomalyType;  // 'drop' | 'spike' | 'both'
    const threshold = condition.params.threshold || 30;  // Percentage change
    const metric = condition.params.metric;  // Specific metric to track
    const period = condition.params.period || 'week';  // Comparison period

    // Get current and previous values
    const currentValue = event.data.currentValue || event.data.value;
    const previousValue = event.data.previousValue || event.data.baseline;
    const metricName = event.data.metricName || event.data.metric;

    // Validate we have the data we need
    if (currentValue === undefined || previousValue === undefined) {
      return false;
    }

    // Skip if not the metric we're looking for
    if (metric && metricName !== metric) {
      return false;
    }

    // Avoid division by zero
    if (previousValue === 0) {
      // If previous was 0 and current is > 0, that's a spike
      return currentValue > 0 && (anomalyType === 'spike' || anomalyType === 'both');
    }

    // Calculate percentage change
    const percentChange = ((currentValue - previousValue) / previousValue) * 100;
    const absoluteChange = Math.abs(percentChange);

    // Check if change meets threshold
    if (absoluteChange < threshold) {
      return false;
    }

    // Check anomaly type
    switch (anomalyType) {
      case 'drop':
        // Negative change = usage dropped
        if (percentChange >= 0) return false;
        break;

      case 'spike':
        // Positive change = usage spiked
        if (percentChange <= 0) return false;
        break;

      case 'both':
        // Either direction is fine, threshold already checked
        break;

      default:
        // Default to drop detection (concerning pattern)
        if (percentChange >= 0) return false;
    }

    // Check minimum baseline (don't alert on tiny numbers)
    if (condition.params.minimumBaseline !== undefined) {
      if (previousValue < condition.params.minimumBaseline) {
        return false;
      }
    }

    // Check for sustained anomaly (requires multiple data points)
    if (condition.params.sustainedPeriods !== undefined) {
      const consecutiveAnomalies = event.data.consecutiveAnomalies || 0;
      if (consecutiveAnomalies < condition.params.sustainedPeriods) {
        return false;
      }
    }

    return true;
  },

  getDescription: (condition: TriggerCondition): string => {
    const { anomalyType, threshold, metric, period } = condition.params;
    const pct = threshold || 30;
    const type = anomalyType || 'drop';

    let description = '';

    switch (type) {
      case 'drop':
        description = `Usage drops by ${pct}%+`;
        break;
      case 'spike':
        description = `Usage spikes by ${pct}%+`;
        break;
      case 'both':
        description = `Usage changes by ${pct}%+`;
        break;
    }

    if (metric) {
      description += ` for ${metric}`;
    }

    if (period) {
      description += ` (${period}-over-${period})`;
    }

    return description;
  },

  validate: (condition: TriggerCondition): { valid: boolean; error?: string } => {
    const { anomalyType, threshold, minimumBaseline, sustainedPeriods } = condition.params;

    if (anomalyType !== undefined && !['drop', 'spike', 'both'].includes(anomalyType)) {
      return { valid: false, error: 'anomalyType must be drop, spike, or both' };
    }

    if (threshold !== undefined && (typeof threshold !== 'number' || threshold <= 0 || threshold > 100)) {
      return { valid: false, error: 'threshold must be between 0 and 100' };
    }

    if (minimumBaseline !== undefined && (typeof minimumBaseline !== 'number' || minimumBaseline < 0)) {
      return { valid: false, error: 'minimumBaseline must be a non-negative number' };
    }

    if (sustainedPeriods !== undefined && (typeof sustainedPeriods !== 'number' || sustainedPeriods < 1)) {
      return { valid: false, error: 'sustainedPeriods must be at least 1' };
    }

    return { valid: true };
  },
};
