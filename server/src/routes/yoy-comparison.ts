/**
 * CSCX.AI Year-over-Year Comparison Routes
 * PRD-177: Year-over-Year Comparison Report
 *
 * API endpoints for YoY metric comparisons.
 *
 * Endpoints:
 * - GET /api/reports/yoy              - Get YoY comparison for all default metrics
 * - GET /api/reports/yoy/:metric      - Get YoY comparison for specific metric
 * - GET /api/reports/yoy/metrics      - Get list of available metrics
 */

import { Router, Request, Response } from 'express';
import { yoyComparisonService, MetricType } from '../services/reports/yoyComparison.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// Validate metric type
const VALID_METRICS: MetricType[] = [
  'retention',
  'nrr',
  'grr',
  'health_score',
  'arr',
  'customer_count',
  'expansion',
  'churn'
];

function isValidMetric(metric: string): metric is MetricType {
  return VALID_METRICS.includes(metric as MetricType);
}

/**
 * GET /api/reports/yoy/metrics
 *
 * Get list of available metrics for YoY comparison.
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await yoyComparisonService.getAvailableMetrics();

    res.json({
      success: true,
      data: {
        metrics
      }
    });
  } catch (error) {
    console.error('[YoY] Error fetching available metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'YOY_METRICS_ERROR',
        message: (error as Error).message || 'Failed to fetch available metrics'
      }
    });
  }
});

/**
 * GET /api/reports/yoy
 *
 * Get YoY comparison for multiple metrics.
 *
 * Query params:
 *   - metrics: Comma-separated list of metrics (default: retention,nrr,health_score)
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { metrics: metricsParam } = req.query;

    // Parse metrics from query or use defaults
    let metrics: MetricType[] = ['retention', 'nrr', 'health_score'];

    if (metricsParam && typeof metricsParam === 'string') {
      const requestedMetrics = metricsParam.split(',').map(m => m.trim());
      const validMetrics = requestedMetrics.filter(isValidMetric);

      if (validMetrics.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_METRICS',
            message: `Invalid metrics provided. Valid options: ${VALID_METRICS.join(', ')}`
          }
        });
      }

      metrics = validMetrics;
    }

    // Fetch YoY comparisons for all requested metrics
    const reports = await yoyComparisonService.getMultiMetricComparison(metrics);

    const responseTime = Date.now() - startTime;

    console.log(`[YoY] Generated comparison for ${metrics.length} metrics in ${responseTime}ms`);

    res.json({
      success: true,
      data: {
        reports,
        summary: {
          metricsAnalyzed: metrics.length,
          generatedAt: new Date().toISOString()
        }
      },
      meta: {
        responseTimeMs: responseTime
      }
    });
  } catch (error) {
    console.error('[YoY] Error generating comparison:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'YOY_COMPARISON_ERROR',
        message: (error as Error).message || 'Failed to generate YoY comparison'
      }
    });
  }
});

/**
 * GET /api/reports/yoy/:metric
 *
 * Get YoY comparison for a specific metric.
 *
 * Path params:
 *   - metric: One of retention, nrr, grr, health_score, arr, customer_count, expansion, churn
 */
router.get('/:metric', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { metric } = req.params;

    // Validate metric
    if (!isValidMetric(metric)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_METRIC',
          message: `Invalid metric '${metric}'. Valid options: ${VALID_METRICS.join(', ')}`
        }
      });
    }

    // Fetch YoY comparison for the specified metric
    const report = await yoyComparisonService.getYoYComparison(metric);

    const responseTime = Date.now() - startTime;

    console.log(`[YoY] Generated ${metric} comparison in ${responseTime}ms`);

    res.json({
      success: true,
      data: report,
      meta: {
        responseTimeMs: responseTime
      }
    });
  } catch (error) {
    console.error('[YoY] Error generating metric comparison:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'YOY_METRIC_ERROR',
        message: (error as Error).message || 'Failed to generate metric comparison'
      }
    });
  }
});

export default router;
