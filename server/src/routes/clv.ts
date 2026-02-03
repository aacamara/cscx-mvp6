/**
 * CSCX.AI Customer Lifetime Value Routes
 * PRD-173: Customer Lifetime Value Report
 *
 * API endpoints for CLV analytics, trends, and customer detail.
 */

import { Router, Request, Response } from 'express';
import { clvService } from '../services/clv.js';

const router = Router();

/**
 * GET /api/reports/clv
 * Get comprehensive CLV report
 *
 * Query params:
 *   - segment: enterprise | mid-market | smb
 *   - tier: platinum | gold | silver | bronze
 *   - min_clv: Minimum CLV threshold
 *   - sort_by: clv | arr | name | tier
 *   - sort_order: asc | desc
 *   - search: Search by customer name
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { segment, tier, min_clv, sort_by, sort_order, search } = req.query;

    const report = await clvService.getCLVReport({
      segment: segment as string | undefined,
      tier: tier as string | undefined,
      min_clv: min_clv ? parseInt(min_clv as string) : undefined,
      sort_by: sort_by as string | undefined,
      sort_order: sort_order as string | undefined,
      search: search as string | undefined
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('CLV report error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLV_REPORT_ERROR',
        message: (error as Error).message || 'Failed to fetch CLV report'
      }
    });
  }
});

/**
 * GET /api/reports/clv/summary
 * Get just the CLV summary metrics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { segment, tier } = req.query;

    const report = await clvService.getCLVReport({
      segment: segment as string | undefined,
      tier: tier as string | undefined
    });

    res.json({
      success: true,
      data: report.summary
    });
  } catch (error) {
    console.error('CLV summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLV_SUMMARY_ERROR',
        message: (error as Error).message || 'Failed to fetch CLV summary'
      }
    });
  }
});

/**
 * GET /api/reports/clv/distribution
 * Get CLV distribution analysis
 */
router.get('/distribution', async (req: Request, res: Response) => {
  try {
    const { segment } = req.query;

    const report = await clvService.getCLVReport({
      segment: segment as string | undefined
    });

    res.json({
      success: true,
      data: report.distribution
    });
  } catch (error) {
    console.error('CLV distribution error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLV_DISTRIBUTION_ERROR',
        message: (error as Error).message || 'Failed to fetch CLV distribution'
      }
    });
  }
});

/**
 * GET /api/reports/clv/trends
 * Get CLV trends over time
 *
 * Query params:
 *   - periods: Number of periods (default: 12)
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const report = await clvService.getCLVReport({});

    res.json({
      success: true,
      data: {
        trends: report.trends
      }
    });
  } catch (error) {
    console.error('CLV trends error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLV_TRENDS_ERROR',
        message: (error as Error).message || 'Failed to fetch CLV trends'
      }
    });
  }
});

/**
 * GET /api/reports/clv/drivers
 * Get top CLV drivers across the portfolio
 */
router.get('/drivers', async (req: Request, res: Response) => {
  try {
    const report = await clvService.getCLVReport({});

    res.json({
      success: true,
      data: {
        drivers: report.top_drivers
      }
    });
  } catch (error) {
    console.error('CLV drivers error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLV_DRIVERS_ERROR',
        message: (error as Error).message || 'Failed to fetch CLV drivers'
      }
    });
  }
});

/**
 * GET /api/reports/clv/tiers
 * Get CLV tier breakdown
 */
router.get('/tiers', async (req: Request, res: Response) => {
  try {
    const { segment } = req.query;

    const report = await clvService.getCLVReport({
      segment: segment as string | undefined
    });

    res.json({
      success: true,
      data: {
        tiers: report.summary.tiers,
        total_clv: report.summary.total_clv,
        total_customers: report.summary.total_customers
      }
    });
  } catch (error) {
    console.error('CLV tiers error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLV_TIERS_ERROR',
        message: (error as Error).message || 'Failed to fetch CLV tiers'
      }
    });
  }
});

/**
 * GET /api/reports/clv/cohorts
 * Get CLV cohort analysis
 *
 * Query params:
 *   - dimension: signup_quarter | segment | industry (default: signup_quarter)
 */
router.get('/cohorts', async (req: Request, res: Response) => {
  try {
    const dimension = (req.query.dimension as string) || 'signup_quarter';

    const analysis = await clvService.getCLVCohortAnalysis(dimension);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('CLV cohorts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLV_COHORTS_ERROR',
        message: (error as Error).message || 'Failed to fetch CLV cohorts'
      }
    });
  }
});

/**
 * GET /api/reports/clv/top
 * Get top CLV customers
 *
 * Query params:
 *   - limit: Number of customers to return (default: 10)
 *   - segment: Filter by segment
 */
router.get('/top', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const { segment } = req.query;

    const report = await clvService.getCLVReport({
      segment: segment as string | undefined,
      sort_by: 'clv',
      sort_order: 'desc'
    });

    res.json({
      success: true,
      data: {
        customers: report.customers.slice(0, limit),
        total_clv: report.summary.total_clv
      }
    });
  } catch (error) {
    console.error('Top CLV error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOP_CLV_ERROR',
        message: (error as Error).message || 'Failed to fetch top CLV customers'
      }
    });
  }
});

/**
 * GET /api/reports/clv/:customerId
 * Get detailed CLV for a specific customer
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const detail = await clvService.getCustomerCLVDetail(customerId);

    if (!detail) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Customer ${customerId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: detail
    });
  } catch (error) {
    console.error('Customer CLV detail error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLV_DETAIL_ERROR',
        message: (error as Error).message || 'Failed to fetch customer CLV detail'
      }
    });
  }
});

export default router;
