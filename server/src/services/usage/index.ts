/**
 * Usage Services
 *
 * Export all usage-related services for tracking and analytics.
 */

export {
  ingestUsageEvents,
  recalculateMetrics,
  getUsageMetrics,
  getUsageTrend,
  countUniqueUsers,
  type UsageEvent,
  type UsageMetrics,
  type IngestResult,
} from './calculator.js';

export {
  recalculateHealthScore,
  getHealthScoreHistory,
  type HealthScoreComponents,
  type HealthScoreResult,
} from './health-score.js';
