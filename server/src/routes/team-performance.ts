/**
 * Team Performance API Routes
 * PRD-178: Team Performance Dashboard for CS Leaders
 *
 * Provides endpoints for:
 * - Team performance overview
 * - Individual CSM metrics
 * - Goal setting and tracking
 * - Leaderboards
 */

import { Router, Request, Response } from 'express';
import { teamPerformanceService } from '../services/reports/teamPerformance.js';

const router = Router();

// ============================================
// TEAM PERFORMANCE OVERVIEW
// ============================================

/**
 * GET /api/reports/team-performance
 * Get team performance dashboard data
 *
 * Query params:
 * - period: 'month' | 'quarter' | 'year' (default: 'month')
 * - team_id: Filter by team (optional)
 * - sort_by: 'retention' | 'nrr' | 'health' | 'activity' | 'portfolio' | 'name'
 * - sort_order: 'asc' | 'desc' (default: 'desc')
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      period = 'month',
      team_id,
      sort_by = 'retention',
      sort_order = 'desc'
    } = req.query;

    const data = await teamPerformanceService.getTeamPerformance(
      period as 'month' | 'quarter' | 'year',
      team_id as string | undefined,
      sort_by as string,
      sort_order as 'asc' | 'desc'
    );

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Team performance error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: (error as Error).message }
    });
  }
});

// ============================================
// INDIVIDUAL CSM METRICS
// ============================================

/**
 * GET /api/reports/team-performance/:userId
 * Get detailed metrics for a specific CSM
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const data = await teamPerformanceService.getCSMDetail(userId);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('CSM detail error:', error);

    if ((error as Error).message === 'CSM not found') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'CSM not found' }
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: (error as Error).message }
    });
  }
});

// ============================================
// GOAL SETTING
// ============================================

/**
 * POST /api/reports/team-performance/goals
 * Create or update a team or individual goal
 *
 * Body:
 * - metric: 'retention' | 'nrr' | 'health' | 'activity'
 * - target_value: number
 * - period_start: string (ISO date)
 * - period_end: string (ISO date)
 * - user_id?: string (optional, if omitted applies to team)
 */
router.post('/goals', async (req: Request, res: Response) => {
  try {
    const { metric, target_value, period_start, period_end, user_id } = req.body;

    // Validation
    if (!metric || !['retention', 'nrr', 'health', 'activity'].includes(metric)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid metric type' }
      });
    }

    if (typeof target_value !== 'number' || target_value <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid target value' }
      });
    }

    if (!period_start || !period_end) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Period dates are required' }
      });
    }

    const result = await teamPerformanceService.setTeamGoal({
      metric,
      target_value,
      period_start,
      period_end,
      user_id
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Set goal error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: (error as Error).message }
    });
  }
});

// ============================================
// LEADERBOARD
// ============================================

/**
 * GET /api/reports/team-performance/leaderboard/:metric
 * Get leaderboard for a specific metric
 *
 * Params:
 * - metric: 'retention' | 'nrr' | 'health' | 'activity'
 *
 * Query:
 * - period: 'month' | 'quarter' | 'year'
 */
router.get('/leaderboard/:metric', async (req: Request, res: Response) => {
  try {
    const { metric } = req.params;
    const { period = 'month' } = req.query;

    if (!['retention', 'nrr', 'health', 'activity'].includes(metric)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid metric type' }
      });
    }

    const data = await teamPerformanceService.getLeaderboard(
      metric as 'retention' | 'nrr' | 'health' | 'activity',
      period as 'month' | 'quarter' | 'year'
    );

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: (error as Error).message }
    });
  }
});

// ============================================
// EXPORT REPORT
// ============================================

/**
 * GET /api/reports/team-performance/export
 * Export team performance report (CSV format)
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { period = 'month', format = 'csv' } = req.query;

    const data = await teamPerformanceService.getTeamPerformance(
      period as 'month' | 'quarter' | 'year'
    );

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'CSM Name',
        'Email',
        'Portfolio Value',
        'Customers',
        'Retention Rate',
        'NRR',
        'Health Score',
        'Activity Score',
        'Meetings',
        'Emails',
        'Tasks Completed'
      ].join(',');

      const rows = data.csm_metrics.map(csm =>
        [
          `"${csm.user_name}"`,
          `"${csm.email}"`,
          csm.portfolio_value,
          csm.customer_count,
          `${csm.retention_rate}%`,
          `${csm.net_revenue_retention}%`,
          csm.health_score_avg,
          csm.activity_score,
          csm.meetings_this_month,
          csm.emails_this_month,
          csm.tasks_completed
        ].join(',')
      );

      const csv = [headers, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="team-performance-${data.period.label.replace(/\s+/g, '-')}.csv"`
      );
      res.send(csv);
    } else {
      // Return JSON
      res.json({
        success: true,
        data
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: (error as Error).message }
    });
  }
});

export default router;
