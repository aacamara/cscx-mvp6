/**
 * Engagement Metrics API Routes
 * PRD-157: Endpoints for engagement tracking and analytics
 */

import { Router, Request, Response } from 'express';
import {
  engagementMetricsService,
  EngagementActivity,
  EngagementMetrics,
} from '../services/engagementMetrics.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// PORTFOLIO ENGAGEMENT
// ============================================

/**
 * GET /api/reports/engagement-metrics
 * Get engagement metrics for portfolio
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { period, segment, min_score, max_score } = req.query;

    const minScore = min_score ? parseInt(min_score as string, 10) : undefined;
    const maxScore = max_score ? parseInt(max_score as string, 10) : undefined;

    const result = await engagementMetricsService.getPortfolioEngagementMetrics(
      userId,
      (period as string) || 'quarter',
      segment as string,
      minScore,
      maxScore
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Portfolio engagement metrics error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// CUSTOMER ENGAGEMENT
// ============================================

/**
 * GET /api/reports/engagement-metrics/:customerId
 * Get engagement metrics for a specific customer
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { customerId } = req.params;
    const { period } = req.query;

    const metrics = await engagementMetricsService.calculateCustomerEngagementMetrics(
      customerId,
      (period as string) || 'quarter',
      userId
    );

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found or no engagement data available',
      });
    }

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Customer engagement metrics error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/reports/engagement-metrics/:customerId/trends
 * Get engagement trends for a customer
 */
router.get('/:customerId/trends', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { periods } = req.query;

    const numPeriods = periods ? parseInt(periods as string, 10) : 6;

    const trends = await engagementMetricsService.getEngagementTrends(
      customerId,
      numPeriods
    );

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('Engagement trends error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/reports/engagement-metrics/:customerId/activities
 * Get engagement activities for a customer
 */
router.get('/:customerId/activities', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { start_date, end_date } = req.query;

    const endDate = end_date ? new Date(end_date as string) : new Date();
    const startDate = start_date
      ? new Date(start_date as string)
      : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    const activities = await engagementMetricsService.getCustomerActivities(
      customerId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error('Engagement activities error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// CORRELATION ANALYSIS
// ============================================

/**
 * GET /api/reports/engagement-metrics/correlation/:outcome
 * Get engagement correlation analysis
 */
router.get('/correlation/:outcome', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { outcome } = req.params;

    if (!['health', 'renewal', 'churn'].includes(outcome)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid outcome type. Must be: health, renewal, or churn',
      });
    }

    const correlations = await engagementMetricsService.getEngagementCorrelation(
      outcome as 'health' | 'renewal' | 'churn',
      userId
    );

    res.json({
      success: true,
      data: correlations,
    });
  } catch (error) {
    console.error('Engagement correlation error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// ACTIVITY LOGGING
// ============================================

/**
 * POST /api/reports/engagement-metrics/activities
 * Log a new engagement activity
 */
router.post('/activities', async (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      type,
      direction,
      date,
      duration_minutes,
      participants,
      stakeholder_level,
      response_received,
      source,
      subject,
      notes,
    } = req.body;

    if (!customer_id || !type || !direction || !date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customer_id, type, direction, date',
      });
    }

    const activity = await engagementMetricsService.logEngagementActivity({
      customer_id,
      type,
      direction,
      date,
      duration_minutes,
      participants: participants || [],
      stakeholder_level,
      response_received,
      source: source || 'manual',
      subject,
      notes,
    });

    if (!activity) {
      return res.status(500).json({
        success: false,
        error: 'Failed to log activity',
      });
    }

    res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error('Log activity error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/reports/engagement-metrics/activities/bulk
 * Log multiple engagement activities (for sync from external systems)
 */
router.post('/activities/bulk', async (req: Request, res: Response) => {
  try {
    const { activities } = req.body;

    if (!Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Activities array is required',
      });
    }

    const results = await Promise.all(
      activities.map((activity: Omit<EngagementActivity, 'id' | 'created_at'>) =>
        engagementMetricsService.logEngagementActivity(activity)
      )
    );

    const successCount = results.filter(r => r !== null).length;

    res.status(201).json({
      success: true,
      data: {
        total: activities.length,
        success: successCount,
        failed: activities.length - successCount,
      },
    });
  } catch (error) {
    console.error('Bulk log activities error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// BENCHMARKS
// ============================================

/**
 * GET /api/reports/engagement-metrics/benchmarks
 * Get engagement benchmarks by segment
 */
router.get('/benchmarks', async (_req: Request, res: Response) => {
  try {
    const benchmarks = {
      enterprise: {
        healthy_score: { min: 70, max: 85 },
        expected_meetings_per_quarter: { min: 6, max: 8 },
        expected_emails_per_month: { min: 15, max: 20 },
        qbrs_per_year: 4,
      },
      mid_market: {
        healthy_score: { min: 60, max: 75 },
        expected_meetings_per_quarter: { min: 3, max: 4 },
        expected_emails_per_month: { min: 8, max: 12 },
        qbrs_per_year: 4,
      },
      smb: {
        healthy_score: { min: 50, max: 65 },
        expected_meetings_per_quarter: { min: 1, max: 2 },
        expected_emails_per_month: { min: 4, max: 6 },
        qbrs_per_year: 2,
      },
    };

    res.json({
      success: true,
      data: benchmarks,
    });
  } catch (error) {
    console.error('Benchmarks error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export { router as engagementMetricsRoutes };
