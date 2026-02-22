/**
 * Leaderboard Routes
 * PRD-260: Team Goal Tracking - Leaderboard API endpoints
 *
 * Endpoints:
 * - GET  /api/leaderboard                    - Get leaderboard data
 * - GET  /api/leaderboard/dashboard          - Get goal dashboard for current user
 * - GET  /api/leaderboard/periods            - Get all goal periods
 * - GET  /api/leaderboard/periods/:id        - Get a specific period
 * - POST /api/leaderboard/periods            - Create a new period
 * - PATCH /api/leaderboard/periods/:id       - Update a period
 * - GET  /api/leaderboard/goals              - Get goals for a period
 * - GET  /api/leaderboard/goals/:id          - Get a specific goal
 * - POST /api/leaderboard/goals              - Create a new goal
 * - PATCH /api/leaderboard/goals/:id         - Update a goal
 * - POST /api/leaderboard/goals/:id/progress - Update goal progress
 * - GET  /api/leaderboard/goals/:id/history  - Get goal progress history
 * - POST /api/leaderboard/goals/:id/check-in - Submit a check-in
 * - GET  /api/leaderboard/goals/:id/check-ins - Get check-ins for a goal
 * - GET  /api/leaderboard/achievements       - Get user achievements
 * - POST /api/leaderboard/achievements/:id/acknowledge - Acknowledge achievement
 */

import { Router, Request, Response } from 'express';
import { leaderboardService } from '../services/collaboration/leaderboard.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// LEADERBOARD
// ============================================

/**
 * GET /api/leaderboard
 *
 * Get the leaderboard data.
 *
 * Query Parameters:
 * - config_id (optional): Specific leaderboard config to use
 * - period_id (optional): Specific period to show
 * - limit (optional): Max entries to return (default: 10)
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const configId = req.query.config_id as string | undefined;
    const periodId = req.query.period_id as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;

    const leaderboard = await leaderboardService.getLeaderboard(configId, periodId, limit);

    if (!leaderboard) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LEADERBOARD_NOT_FOUND',
          message: 'Could not generate leaderboard data'
        }
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(
      `[Leaderboard] Fetched leaderboard with ${leaderboard.entries.length} entries in ${responseTime}ms`
    );

    return res.json({
      success: true,
      data: leaderboard,
      meta: {
        responseTimeMs: responseTime,
        entriesCount: leaderboard.entries.length
      }
    });
  } catch (error) {
    console.error('[Leaderboard] Error fetching leaderboard:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch leaderboard'
      }
    });
  }
});

/**
 * GET /api/leaderboard/dashboard
 *
 * Get the goal dashboard for the current user.
 *
 * Query Parameters:
 * - user_id (required): User ID to get dashboard for
 * - period_id (optional): Specific period to show
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const userId = req.query.user_id as string;
    const periodId = req.query.period_id as string | undefined;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required'
        }
      });
    }

    const dashboard = await leaderboardService.getGoalDashboard(userId, periodId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DASHBOARD_NOT_FOUND',
          message: 'Could not generate dashboard data'
        }
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(
      `[Leaderboard] Fetched dashboard for user ${userId} in ${responseTime}ms`
    );

    return res.json({
      success: true,
      data: dashboard,
      meta: {
        responseTimeMs: responseTime
      }
    });
  } catch (error) {
    console.error('[Leaderboard] Error fetching dashboard:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch dashboard'
      }
    });
  }
});

// ============================================
// GOAL PERIODS
// ============================================

/**
 * GET /api/leaderboard/periods
 *
 * Get all goal periods.
 *
 * Query Parameters:
 * - status (optional): Filter by status (planning, active, completed, archived)
 */
router.get('/periods', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as 'planning' | 'active' | 'completed' | 'archived' | undefined;
    const periods = await leaderboardService.getGoalPeriods(status);

    return res.json({
      success: true,
      data: periods,
      meta: {
        count: periods.length
      }
    });
  } catch (error) {
    console.error('[Leaderboard] Error fetching periods:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch periods'
      }
    });
  }
});

/**
 * GET /api/leaderboard/periods/current
 *
 * Get the current active period.
 */
router.get('/periods/current', async (req: Request, res: Response) => {
  try {
    const period = await leaderboardService.getCurrentPeriod();

    if (!period) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PERIOD_NOT_FOUND',
          message: 'No active period found'
        }
      });
    }

    return res.json({
      success: true,
      data: period
    });
  } catch (error) {
    console.error('[Leaderboard] Error fetching current period:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch current period'
      }
    });
  }
});

/**
 * GET /api/leaderboard/periods/:id
 *
 * Get a specific goal period.
 */
router.get('/periods/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const period = await leaderboardService.getGoalPeriod(id);

    if (!period) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PERIOD_NOT_FOUND',
          message: `Could not find period with ID '${id}'`
        }
      });
    }

    return res.json({
      success: true,
      data: period
    });
  } catch (error) {
    console.error('[Leaderboard] Error fetching period:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch period'
      }
    });
  }
});

/**
 * POST /api/leaderboard/periods
 *
 * Create a new goal period.
 *
 * Request Body:
 * - name (required): Period name (e.g., "Q1 2026")
 * - period_type (required): weekly, monthly, quarterly, annual
 * - start_date (required): Start date (YYYY-MM-DD)
 * - end_date (required): End date (YYYY-MM-DD)
 * - description (optional): Period description
 * - status (optional): Period status (default: planning)
 */
router.post('/periods', async (req: Request, res: Response) => {
  try {
    const { name, period_type, start_date, end_date, description, status } = req.body;

    if (!name || !period_type || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'name, period_type, start_date, and end_date are required'
        }
      });
    }

    const validTypes = ['weekly', 'monthly', 'quarterly', 'annual'];
    if (!validTypes.includes(period_type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PERIOD_TYPE',
          message: `period_type must be one of: ${validTypes.join(', ')}`
        }
      });
    }

    const period = await leaderboardService.createGoalPeriod({
      name,
      period_type,
      start_date,
      end_date,
      description,
      status: status || 'planning'
    });

    if (!period) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create period'
        }
      });
    }

    console.log(`[Leaderboard] Created period: ${period.name}`);

    return res.status(201).json({
      success: true,
      data: period
    });
  } catch (error) {
    console.error('[Leaderboard] Error creating period:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create period'
      }
    });
  }
});

/**
 * PATCH /api/leaderboard/periods/:id
 *
 * Update a goal period.
 */
router.patch('/periods/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const period = await leaderboardService.updateGoalPeriod(id, updates);

    if (!period) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PERIOD_NOT_FOUND',
          message: `Could not find period with ID '${id}'`
        }
      });
    }

    console.log(`[Leaderboard] Updated period: ${period.name}`);

    return res.json({
      success: true,
      data: period
    });
  } catch (error) {
    console.error('[Leaderboard] Error updating period:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update period'
      }
    });
  }
});

// ============================================
// GOALS
// ============================================

/**
 * GET /api/leaderboard/goals
 *
 * Get goals for a period.
 *
 * Query Parameters:
 * - period_id (required): Period to get goals for
 * - user_id (optional): Filter by user
 */
router.get('/goals', async (req: Request, res: Response) => {
  try {
    const periodId = req.query.period_id as string;
    const userId = req.query.user_id as string | undefined;

    if (!periodId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PERIOD_ID',
          message: 'period_id is required'
        }
      });
    }

    const goals = await leaderboardService.getGoals(periodId, userId);

    return res.json({
      success: true,
      data: goals,
      meta: {
        count: goals.length
      }
    });
  } catch (error) {
    console.error('[Leaderboard] Error fetching goals:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch goals'
      }
    });
  }
});

/**
 * GET /api/leaderboard/goals/:id
 *
 * Get a specific goal.
 */
router.get('/goals/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const goal = await leaderboardService.getGoal(id);

    if (!goal) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'GOAL_NOT_FOUND',
          message: `Could not find goal with ID '${id}'`
        }
      });
    }

    return res.json({
      success: true,
      data: goal
    });
  } catch (error) {
    console.error('[Leaderboard] Error fetching goal:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch goal'
      }
    });
  }
});

/**
 * POST /api/leaderboard/goals
 *
 * Create a new goal.
 *
 * Request Body:
 * - period_id (required): Period this goal belongs to
 * - owner_type (required): 'team' or 'individual'
 * - team_id (required if owner_type is 'team')
 * - user_id (required if owner_type is 'individual')
 * - name (required): Goal name
 * - goal_type (required): 'metric', 'task', or 'milestone'
 * - target_value (required): Target value
 * - description (optional): Goal description
 * - metric_name (optional): Name of metric to track
 * - baseline_value (optional): Starting value
 * - stretch_target_value (optional): Stretch target
 * - target_direction (optional): 'increase', 'decrease', or 'maintain'
 */
router.post('/goals', async (req: Request, res: Response) => {
  try {
    const {
      period_id,
      owner_type,
      team_id,
      user_id,
      name,
      goal_type,
      target_value,
      description,
      metric_name,
      baseline_value,
      stretch_target_value,
      target_direction,
      is_public,
      show_in_leaderboard,
      weight
    } = req.body;

    // Validate required fields
    if (!period_id || !owner_type || !name || !goal_type || target_value === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'period_id, owner_type, name, goal_type, and target_value are required'
        }
      });
    }

    // Validate owner
    if (owner_type === 'team' && !team_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TEAM_ID',
          message: 'team_id is required for team goals'
        }
      });
    }

    if (owner_type === 'individual' && !user_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'user_id is required for individual goals'
        }
      });
    }

    const goal = await leaderboardService.createGoal({
      period_id,
      owner_type,
      team_id,
      user_id,
      name,
      goal_type,
      target_value,
      description,
      metric_name,
      baseline_value,
      stretch_target_value,
      target_direction: target_direction || 'increase',
      is_public: is_public !== false,
      show_in_leaderboard: show_in_leaderboard !== false,
      weight: weight || 1.0
    });

    if (!goal) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create goal'
        }
      });
    }

    console.log(`[Leaderboard] Created goal: ${goal.name}`);

    return res.status(201).json({
      success: true,
      data: goal
    });
  } catch (error) {
    console.error('[Leaderboard] Error creating goal:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create goal'
      }
    });
  }
});

/**
 * POST /api/leaderboard/goals/:id/progress
 *
 * Update goal progress.
 *
 * Request Body:
 * - current_value (required): New current value
 * - notes (optional): Progress notes
 */
router.post('/goals/:id/progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { current_value, notes } = req.body;

    if (current_value === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_VALUE',
          message: 'current_value is required'
        }
      });
    }

    const goal = await leaderboardService.updateGoalProgress(id, current_value, notes);

    if (!goal) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'GOAL_NOT_FOUND',
          message: `Could not find goal with ID '${id}'`
        }
      });
    }

    console.log(`[Leaderboard] Updated progress for goal: ${goal.name} to ${current_value}`);

    return res.json({
      success: true,
      data: goal
    });
  } catch (error) {
    console.error('[Leaderboard] Error updating goal progress:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update goal progress'
      }
    });
  }
});

/**
 * GET /api/leaderboard/goals/:id/history
 *
 * Get goal progress history.
 *
 * Query Parameters:
 * - limit (optional): Max entries to return (default: 30)
 */
router.get('/goals/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 30;

    const history = await leaderboardService.getGoalHistory(id, limit);

    return res.json({
      success: true,
      data: history,
      meta: {
        count: history.length
      }
    });
  } catch (error) {
    console.error('[Leaderboard] Error fetching goal history:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch goal history'
      }
    });
  }
});

/**
 * POST /api/leaderboard/goals/:id/check-in
 *
 * Submit a goal check-in.
 *
 * Request Body:
 * - user_id (required): User submitting the check-in
 * - progress_notes (optional): Notes on progress
 * - blockers (optional): Current blockers
 * - support_needed (optional): Support needed
 * - confidence_level (optional): Confidence level 1-5
 */
router.post('/goals/:id/check-in', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id, progress_notes, blockers, support_needed, confidence_level } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'user_id is required'
        }
      });
    }

    const checkIn = await leaderboardService.createCheckIn({
      goal_id: id,
      user_id,
      check_in_date: new Date().toISOString().split('T')[0],
      progress_notes,
      blockers,
      support_needed,
      confidence_level
    });

    if (!checkIn) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create check-in'
        }
      });
    }

    console.log(`[Leaderboard] Created check-in for goal ${id}`);

    return res.status(201).json({
      success: true,
      data: checkIn
    });
  } catch (error) {
    console.error('[Leaderboard] Error creating check-in:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create check-in'
      }
    });
  }
});

/**
 * GET /api/leaderboard/goals/:id/check-ins
 *
 * Get check-ins for a goal.
 */
router.get('/goals/:id/check-ins', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const checkIns = await leaderboardService.getCheckIns(id);

    return res.json({
      success: true,
      data: checkIns,
      meta: {
        count: checkIns.length
      }
    });
  } catch (error) {
    console.error('[Leaderboard] Error fetching check-ins:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch check-ins'
      }
    });
  }
});

// ============================================
// ACHIEVEMENTS
// ============================================

/**
 * GET /api/leaderboard/achievements
 *
 * Get achievements for a user.
 *
 * Query Parameters:
 * - user_id (required): User to get achievements for
 */
router.get('/achievements', async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'user_id is required'
        }
      });
    }

    const achievements = await leaderboardService.getUserAchievements(userId);

    return res.json({
      success: true,
      data: achievements,
      meta: {
        count: achievements.length
      }
    });
  } catch (error) {
    console.error('[Leaderboard] Error fetching achievements:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch achievements'
      }
    });
  }
});

/**
 * POST /api/leaderboard/achievements/:id/acknowledge
 *
 * Acknowledge an achievement.
 */
router.post('/achievements/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const achievement = await leaderboardService.acknowledgeAchievement(id);

    if (!achievement) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACHIEVEMENT_NOT_FOUND',
          message: `Could not find achievement with ID '${id}'`
        }
      });
    }

    console.log(`[Leaderboard] Acknowledged achievement ${id}`);

    return res.json({
      success: true,
      data: achievement
    });
  } catch (error) {
    console.error('[Leaderboard] Error acknowledging achievement:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to acknowledge achievement'
      }
    });
  }
});

export default router;
