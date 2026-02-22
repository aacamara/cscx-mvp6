/**
 * Activity Feed Analysis API Routes
 * PRD-172: Endpoints for activity tracking and analysis
 */

import { Router, Request, Response } from 'express';
import {
  activityFeedAnalysisService,
  ActivityFeedFilters,
  ActivityType,
} from '../services/activityFeedAnalysis.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// PORTFOLIO ACTIVITY FEED
// ============================================

/**
 * GET /api/reports/activity-feed
 * Get activity feed analysis for portfolio
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';
    const {
      period,
      start_date,
      end_date,
      activity_types,
      csm_id,
      gap_threshold_days,
    } = req.query;

    const filters: ActivityFeedFilters = {
      period: (period as string) as ActivityFeedFilters['period'] || 'this_week',
      start_date: start_date as string,
      end_date: end_date as string,
      activity_types: activity_types ? (activity_types as string).split(',') as ActivityType[] : undefined,
      csm_id: csm_id as string,
      gap_threshold_days: gap_threshold_days ? parseInt(gap_threshold_days as string, 10) : 7,
    };

    // Fetch all data in parallel
    const [metrics, gaps, recentActivities, trends, csmProductivity, effectiveness] = await Promise.all([
      activityFeedAnalysisService.getActivityMetrics(userId, filters),
      activityFeedAnalysisService.getActivityGaps(userId, filters.gap_threshold_days || 7),
      activityFeedAnalysisService.getRecentActivities(userId, 20, filters),
      activityFeedAnalysisService.getActivityTrends(userId, 30),
      activityFeedAnalysisService.getCSMProductivity(userId),
      activityFeedAnalysisService.getActivityEffectiveness(userId),
    ]);

    // Calculate summary
    const totalActivities = metrics.total_activities;
    const avgPerCustomer = metrics.avg_per_customer;
    const customersWithGaps = gaps.length;
    const coverageRate = metrics.total_customers > 0
      ? Math.round((metrics.customers_with_activity / metrics.total_customers) * 100)
      : 0;

    // Calculate by_type with percentages
    const byType = Object.entries(metrics.by_type)
      .map(([type, count]) => ({
        type: type as ActivityType,
        count,
        percentage: totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: {
        summary: {
          total_activities: totalActivities,
          avg_per_customer: avgPerCustomer,
          customers_with_gaps: customersWithGaps,
          coverage_rate: coverageRate,
        },
        metrics,
        by_type: byType,
        gaps,
        recent_activities: recentActivities,
        trends,
        csm_productivity: csmProductivity,
        effectiveness,
      },
    });
  } catch (error) {
    console.error('Activity feed error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// ACTIVITY METRICS
// ============================================

/**
 * GET /api/reports/activity-feed/metrics
 * Get activity metrics for a period
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';
    const { period, start_date, end_date } = req.query;

    const filters: ActivityFeedFilters = {
      period: (period as string) as ActivityFeedFilters['period'] || 'this_week',
      start_date: start_date as string,
      end_date: end_date as string,
    };

    const metrics = await activityFeedAnalysisService.getActivityMetrics(userId, filters);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Activity metrics error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// ACTIVITY GAPS
// ============================================

/**
 * GET /api/reports/activity-feed/gaps
 * Get customers with activity gaps
 */
router.get('/gaps', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';
    const { threshold_days } = req.query;

    const thresholdDays = threshold_days ? parseInt(threshold_days as string, 10) : 7;

    const gaps = await activityFeedAnalysisService.getActivityGaps(userId, thresholdDays);

    res.json({
      success: true,
      data: {
        threshold_days: thresholdDays,
        total_gaps: gaps.length,
        gaps,
        by_risk_level: {
          high: gaps.filter(g => g.risk_level === 'high').length,
          medium: gaps.filter(g => g.risk_level === 'medium').length,
          low: gaps.filter(g => g.risk_level === 'low').length,
        },
      },
    });
  } catch (error) {
    console.error('Activity gaps error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// CSM PRODUCTIVITY
// ============================================

/**
 * GET /api/reports/activity-feed/productivity
 * Get CSM productivity metrics
 */
router.get('/productivity', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const productivity = await activityFeedAnalysisService.getCSMProductivity(userId);

    // Calculate team totals
    const teamTotals = productivity.reduce(
      (acc, csm) => ({
        total_activities: acc.total_activities + csm.total_activities,
        total_customers: acc.total_customers + csm.total_customers,
        customers_touched: acc.customers_touched + csm.customers_touched,
      }),
      { total_activities: 0, total_customers: 0, customers_touched: 0 }
    );

    res.json({
      success: true,
      data: {
        team_summary: {
          total_activities: teamTotals.total_activities,
          total_customers: teamTotals.total_customers,
          customers_touched: teamTotals.customers_touched,
          coverage_rate: teamTotals.total_customers > 0
            ? Math.round((teamTotals.customers_touched / teamTotals.total_customers) * 100)
            : 0,
          avg_activities_per_csm: productivity.length > 0
            ? Math.round(teamTotals.total_activities / productivity.length)
            : 0,
        },
        csm_productivity: productivity,
      },
    });
  } catch (error) {
    console.error('CSM productivity error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// ACTIVITY TRENDS
// ============================================

/**
 * GET /api/reports/activity-feed/trends
 * Get activity trends over time
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';
    const { days } = req.query;

    const numDays = days ? parseInt(days as string, 10) : 30;

    const trends = await activityFeedAnalysisService.getActivityTrends(userId, numDays);

    // Calculate week-over-week change
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekTotal = trends
      .filter(t => new Date(t.date) >= thisWeekStart)
      .reduce((sum, t) => sum + t.total, 0);

    const lastWeekTotal = trends
      .filter(t => {
        const date = new Date(t.date);
        return date >= lastWeekStart && date < thisWeekStart;
      })
      .reduce((sum, t) => sum + t.total, 0);

    const weekOverWeekChange = lastWeekTotal > 0
      ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100)
      : thisWeekTotal > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        days: numDays,
        trends,
        summary: {
          this_week_total: thisWeekTotal,
          last_week_total: lastWeekTotal,
          week_over_week_change: weekOverWeekChange,
          daily_average: Math.round(trends.reduce((sum, t) => sum + t.total, 0) / trends.length),
        },
      },
    });
  } catch (error) {
    console.error('Activity trends error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// RECENT ACTIVITIES
// ============================================

/**
 * GET /api/reports/activity-feed/recent
 * Get recent activities
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';
    const { limit, activity_types, csm_id, customer_id } = req.query;

    const filters: ActivityFeedFilters = {
      activity_types: activity_types ? (activity_types as string).split(',') as ActivityType[] : undefined,
      csm_id: csm_id as string,
      customer_id: customer_id as string,
    };

    const numLimit = limit ? parseInt(limit as string, 10) : 50;

    const activities = await activityFeedAnalysisService.getRecentActivities(userId, numLimit, filters);

    res.json({
      success: true,
      data: {
        total: activities.length,
        activities,
      },
    });
  } catch (error) {
    console.error('Recent activities error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// ACTIVITY EFFECTIVENESS
// ============================================

/**
 * GET /api/reports/activity-feed/effectiveness
 * Get activity effectiveness analysis
 */
router.get('/effectiveness', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const effectiveness = await activityFeedAnalysisService.getActivityEffectiveness(userId);

    res.json({
      success: true,
      data: effectiveness,
    });
  } catch (error) {
    console.error('Activity effectiveness error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// CUSTOMER ACTIVITIES
// ============================================

/**
 * GET /api/reports/activity-feed/customer/:customerId
 * Get activities for a specific customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';
    const { customerId } = req.params;
    const { limit } = req.query;

    const numLimit = limit ? parseInt(limit as string, 10) : 50;

    const activities = await activityFeedAnalysisService.getRecentActivities(userId, numLimit, {
      customer_id: customerId,
    });

    // Calculate summary
    const byType: Record<ActivityType, number> = {
      email: 0,
      meeting: 0,
      call: 0,
      note: 0,
      task: 0,
      document: 0,
    };

    activities.forEach(activity => {
      if (byType.hasOwnProperty(activity.type)) {
        byType[activity.type]++;
      }
    });

    const lastActivity = activities[0];

    res.json({
      success: true,
      data: {
        customer_id: customerId,
        total_activities: activities.length,
        last_activity_date: lastActivity?.timestamp || null,
        by_type: byType,
        activities,
      },
    });
  } catch (error) {
    console.error('Customer activities error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// LOG ACTIVITY
// ============================================

/**
 * POST /api/reports/activity-feed/log
 * Log a new activity
 */
router.post('/log', async (req: Request, res: Response) => {
  try {
    const {
      type,
      customer_id,
      csm_id,
      timestamp,
      description,
      outcome,
      duration_minutes,
      participants,
      metadata,
    } = req.body;

    if (!type || !customer_id || !csm_id || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, customer_id, csm_id, description',
      });
    }

    const validTypes: ActivityType[] = ['email', 'meeting', 'call', 'note', 'task', 'document'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid activity type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const activity = await activityFeedAnalysisService.logActivity({
      type,
      customer_id,
      csm_id,
      timestamp: timestamp || new Date().toISOString(),
      description,
      outcome,
      duration_minutes,
      participants: participants || [],
      metadata: metadata || {},
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

export { router as activityFeedRoutes };
export default router;
