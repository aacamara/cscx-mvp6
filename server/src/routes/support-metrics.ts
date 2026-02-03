/**
 * Support Metrics Routes
 * PRD-156: Support Metrics Dashboard / Support Ticket Analysis Report
 *
 * API endpoints for support ticket analytics, including:
 * - Portfolio-level support overview
 * - Customer-specific support metrics
 * - SLA performance tracking
 * - CSAT analysis
 * - Trend data for charts
 * - Support-health correlation
 */

import { Router, Request, Response } from 'express';
import { supportMetricsService } from '../services/support/metrics.js';

const router = Router();

// ============================================
// Portfolio Support Metrics
// ============================================

/**
 * GET /api/reports/support-metrics
 * Get portfolio-wide support overview and customer summaries
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      csm_id,
      period = 'month',
      start_date,
      end_date,
      min_tickets,
      max_csat,
    } = req.query;

    const result = await supportMetricsService.getPortfolioSupportMetrics({
      csmId: csm_id as string,
      period: period as string,
      startDate: start_date as string,
      endDate: end_date as string,
      minTickets: min_tickets ? parseInt(min_tickets as string) : undefined,
      maxCsat: max_csat ? parseFloat(max_csat as string) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[SupportMetrics] Error fetching portfolio metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch support metrics',
    });
  }
});

// ============================================
// Customer Support Metrics
// ============================================

/**
 * GET /api/reports/support-metrics/:customerId
 * Get comprehensive support metrics for a specific customer
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = 'month', start_date, end_date } = req.query;

    const metrics = await supportMetricsService.getCustomerSupportMetrics(customerId, {
      period: period as string,
      startDate: start_date as string,
      endDate: end_date as string,
    });

    // Also get tickets and alerts
    const { tickets, total } = await supportMetricsService.getCustomerTickets(customerId, {
      period: period as string,
      limit: 50,
    });

    const alerts = await supportMetricsService.getActiveAlerts({ customerId });

    res.json({
      success: true,
      data: {
        customer: metrics,
        tickets,
        totalTickets: total,
        alerts,
      },
    });
  } catch (error) {
    console.error('[SupportMetrics] Error fetching customer metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer support metrics',
    });
  }
});

/**
 * GET /api/reports/support-metrics/:customerId/tickets
 * Get paginated ticket list for a customer
 */
router.get('/:customerId/tickets', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      period,
      status,
      priority,
      category,
      limit = '50',
      offset = '0',
    } = req.query;

    const result = await supportMetricsService.getCustomerTickets(customerId, {
      period: period as string,
      status: status ? (status as string).split(',') : undefined,
      priority: priority ? (priority as string).split(',') : undefined,
      category: category ? (category as string).split(',') : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[SupportMetrics] Error fetching customer tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tickets',
    });
  }
});

// ============================================
// Trend Analysis
// ============================================

/**
 * GET /api/reports/support-metrics/trends
 * Get support trend data for charting (portfolio-level)
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const { period = 'month', granularity = 'day' } = req.query;

    const trends = await supportMetricsService.getSupportTrends(undefined, {
      period: period as string,
      granularity: granularity as 'day' | 'week' | 'month',
    });

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('[SupportMetrics] Error fetching trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch support trends',
    });
  }
});

/**
 * GET /api/reports/support-metrics/:customerId/trends
 * Get support trend data for a specific customer
 */
router.get('/:customerId/trends', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = 'month', granularity = 'day' } = req.query;

    const trends = await supportMetricsService.getSupportTrends(customerId, {
      period: period as string,
      granularity: granularity as 'day' | 'week' | 'month',
    });

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('[SupportMetrics] Error fetching customer trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer support trends',
    });
  }
});

// ============================================
// Correlation Analysis
// ============================================

/**
 * GET /api/reports/support-metrics/correlation
 * Get support-health correlation data
 */
router.get('/correlation', async (req: Request, res: Response) => {
  try {
    const { period = 'month', csm_id } = req.query;

    const correlationData = await supportMetricsService.getSupportHealthCorrelation({
      period: period as string,
      csmId: csm_id as string,
    });

    res.json({
      success: true,
      data: correlationData,
    });
  } catch (error) {
    console.error('[SupportMetrics] Error fetching correlation data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch correlation data',
    });
  }
});

// ============================================
// Alerts
// ============================================

/**
 * GET /api/reports/support-metrics/alerts
 * Get active support alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { customer_id, csm_id, types } = req.query;

    const alerts = await supportMetricsService.getActiveAlerts({
      customerId: customer_id as string,
      csmId: csm_id as string,
      alertTypes: types ? (types as string).split(',') : undefined,
    });

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error('[SupportMetrics] Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch support alerts',
    });
  }
});

export default router;
