/**
 * CSCX.AI Revenue Analytics Routes
 * PRD-158: Revenue Analytics Report
 *
 * API endpoints for revenue analytics, movements, trends, and concentration analysis.
 */

import { Router, Request, Response } from 'express';
import { revenueAnalyticsService } from '../services/revenueAnalytics.js';

const router = Router();

/**
 * GET /api/reports/revenue-analytics
 * Get comprehensive revenue analytics
 *
 * Query params:
 *   - period: current_month | current_quarter | current_year | last_month | last_quarter | last_year
 *   - segment: enterprise | mid-market | smb
 *   - csm_id: CSM identifier
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { period, segment, csm_id } = req.query;

    const analytics = await revenueAnalyticsService.getRevenueAnalytics({
      period: period as string | undefined,
      segment: segment as string | undefined,
      csm_id: csm_id as string | undefined
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REVENUE_ANALYTICS_ERROR',
        message: (error as Error).message || 'Failed to fetch revenue analytics'
      }
    });
  }
});

/**
 * GET /api/reports/revenue-analytics/history
 * Get revenue history/trends over time
 *
 * Query params:
 *   - periods: Number of periods to return (default: 12)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const periods = parseInt(req.query.periods as string) || 12;

    const trends = await revenueAnalyticsService.getRevenueTrends(periods);

    res.json({
      success: true,
      data: {
        periods,
        trends
      }
    });
  } catch (error) {
    console.error('Revenue history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REVENUE_HISTORY_ERROR',
        message: (error as Error).message || 'Failed to fetch revenue history'
      }
    });
  }
});

/**
 * GET /api/reports/revenue-analytics/concentration
 * Get revenue concentration analysis
 */
router.get('/concentration', async (req: Request, res: Response) => {
  try {
    const analysis = await revenueAnalyticsService.getConcentrationAnalysis();

    res.json({
      success: true,
      data: {
        analysis
      }
    });
  } catch (error) {
    console.error('Revenue concentration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REVENUE_CONCENTRATION_ERROR',
        message: (error as Error).message || 'Failed to fetch concentration analysis'
      }
    });
  }
});

/**
 * GET /api/reports/revenue-analytics/summary
 * Get a quick summary of key revenue metrics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { period } = req.query;

    const analytics = await revenueAnalyticsService.getRevenueAnalytics({
      period: period as string | undefined
    });

    // Return just the summary portion
    res.json({
      success: true,
      data: analytics.summary
    });
  } catch (error) {
    console.error('Revenue summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REVENUE_SUMMARY_ERROR',
        message: (error as Error).message || 'Failed to fetch revenue summary'
      }
    });
  }
});

/**
 * GET /api/reports/revenue-analytics/movements
 * Get recent revenue movements
 *
 * Query params:
 *   - type: new | expansion | contraction | churn | reactivation
 *   - limit: Number of movements to return (default: 20)
 */
router.get('/movements', async (req: Request, res: Response) => {
  try {
    const { type, limit: limitStr } = req.query;
    const limit = parseInt(limitStr as string) || 20;

    const analytics = await revenueAnalyticsService.getRevenueAnalytics({});
    let movements = analytics.movements;

    // Filter by type if specified
    if (type) {
      movements = movements.filter(m => m.type === type);
    }

    // Apply limit
    movements = movements.slice(0, limit);

    res.json({
      success: true,
      data: {
        movements,
        count: movements.length
      }
    });
  } catch (error) {
    console.error('Revenue movements error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REVENUE_MOVEMENTS_ERROR',
        message: (error as Error).message || 'Failed to fetch revenue movements'
      }
    });
  }
});

/**
 * GET /api/reports/revenue-analytics/segments
 * Get revenue breakdown by segment
 */
router.get('/segments', async (req: Request, res: Response) => {
  try {
    const analytics = await revenueAnalyticsService.getRevenueAnalytics({});

    res.json({
      success: true,
      data: {
        segments: analytics.by_segment,
        total_arr: analytics.summary.totals.ending_arr
      }
    });
  } catch (error) {
    console.error('Revenue segments error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REVENUE_SEGMENTS_ERROR',
        message: (error as Error).message || 'Failed to fetch segment breakdown'
      }
    });
  }
});

/**
 * GET /api/reports/revenue-analytics/csm
 * Get revenue breakdown by CSM
 */
router.get('/csm', async (req: Request, res: Response) => {
  try {
    const analytics = await revenueAnalyticsService.getRevenueAnalytics({});

    res.json({
      success: true,
      data: {
        csm_breakdown: analytics.by_csm,
        total_arr: analytics.summary.totals.ending_arr
      }
    });
  } catch (error) {
    console.error('CSM revenue error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CSM_REVENUE_ERROR',
        message: (error as Error).message || 'Failed to fetch CSM breakdown'
      }
    });
  }
});

/**
 * GET /api/reports/revenue-analytics/retention
 * Get retention metrics
 */
router.get('/retention', async (req: Request, res: Response) => {
  try {
    const { period } = req.query;

    const analytics = await revenueAnalyticsService.getRevenueAnalytics({
      period: period as string | undefined
    });

    res.json({
      success: true,
      data: {
        retention: analytics.summary.retention,
        period: analytics.summary.period,
        period_label: analytics.summary.period_label
      }
    });
  } catch (error) {
    console.error('Retention metrics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RETENTION_METRICS_ERROR',
        message: (error as Error).message || 'Failed to fetch retention metrics'
      }
    });
  }
});

export default router;
