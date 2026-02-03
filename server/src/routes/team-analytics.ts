/**
 * Team Analytics API Routes
 *
 * PRD-260: Team Goal Tracking
 *
 * API endpoints for goal periods, goals, progress tracking, check-ins,
 * contributions, achievements, and dashboards.
 */

import { Router, Request, Response } from 'express';
import {
  teamAnalyticsService,
  type PeriodStatus,
  type OwnerType,
  type GoalStatus,
  type GoalType,
} from '../services/collaboration/index.js';

const router = Router();

// ============================================
// GOAL PERIODS
// ============================================

/**
 * POST /api/goals/periods
 * Create a new goal period
 */
router.post('/periods', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { name, period_type, start_date, end_date, status } = req.body;

    if (!name || !period_type || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, period_type, start_date, end_date',
      });
    }

    if (!['monthly', 'quarterly', 'annual'].includes(period_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period_type. Must be: monthly, quarterly, or annual',
      });
    }

    const period = await teamAnalyticsService.createGoalPeriod({
      name,
      period_type,
      start_date,
      end_date,
      status,
      created_by_user_id: userId,
    });

    if (!period) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create goal period',
      });
    }

    res.status(201).json({
      success: true,
      data: period,
    });
  } catch (error) {
    console.error('Create goal period error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/goals/periods
 * Get all goal periods
 */
router.get('/periods', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const periods = await teamAnalyticsService.getGoalPeriods(
      status as PeriodStatus | undefined
    );

    res.json({
      success: true,
      data: periods,
    });
  } catch (error) {
    console.error('Get goal periods error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/goals/periods/:periodId
 * Get a single goal period
 */
router.get('/periods/:periodId', async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;

    const period = await teamAnalyticsService.getGoalPeriod(periodId);

    if (!period) {
      return res.status(404).json({
        success: false,
        error: 'Goal period not found',
      });
    }

    res.json({
      success: true,
      data: period,
    });
  } catch (error) {
    console.error('Get goal period error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * PATCH /api/goals/periods/:periodId
 * Update a goal period
 */
router.patch('/periods/:periodId', async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const { name, status } = req.body;

    if (status && !['planning', 'active', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: planning, active, or completed',
      });
    }

    const period = await teamAnalyticsService.updateGoalPeriod(periodId, { name, status });

    if (!period) {
      return res.status(404).json({
        success: false,
        error: 'Goal period not found',
      });
    }

    res.json({
      success: true,
      data: period,
    });
  } catch (error) {
    console.error('Update goal period error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// GOALS
// ============================================

/**
 * POST /api/goals
 * Create a new goal
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const {
      period_id,
      parent_goal_id,
      owner_type,
      team_id,
      user_id,
      name,
      description,
      goal_type,
      metric_name,
      metric_calculation,
      baseline_value,
      target_value,
      stretch_target_value,
      target_direction,
      task_count_target,
      milestones,
      is_public,
      show_in_leaderboard,
    } = req.body;

    if (!period_id || !owner_type || !name || !goal_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: period_id, owner_type, name, goal_type',
      });
    }

    if (!['team', 'individual'].includes(owner_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid owner_type. Must be: team or individual',
      });
    }

    if (!['metric', 'task', 'milestone'].includes(goal_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid goal_type. Must be: metric, task, or milestone',
      });
    }

    const goal = await teamAnalyticsService.createGoal({
      period_id,
      parent_goal_id,
      owner_type,
      team_id,
      user_id: user_id || (owner_type === 'individual' ? userId : undefined),
      name,
      description,
      goal_type,
      metric_name,
      metric_calculation,
      baseline_value,
      target_value,
      stretch_target_value,
      target_direction,
      task_count_target,
      milestones,
      is_public,
      show_in_leaderboard,
      created_by_user_id: userId,
    });

    if (!goal) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create goal',
      });
    }

    res.status(201).json({
      success: true,
      data: goal,
    });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/goals
 * Get goals with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { period_id, owner_type, user_id, team_id, status, parent_goal_id } = req.query;

    const goals = await teamAnalyticsService.getGoals({
      period_id: period_id as string | undefined,
      owner_type: owner_type as OwnerType | undefined,
      user_id: user_id as string | undefined,
      team_id: team_id as string | undefined,
      status: status as GoalStatus | undefined,
      parent_goal_id: parent_goal_id as string | undefined,
    });

    res.json({
      success: true,
      data: goals,
    });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/goals/:goalId
 * Get a single goal with related data
 */
router.get('/:goalId', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    const goal = await teamAnalyticsService.getGoal(goalId);

    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found',
      });
    }

    res.json({
      success: true,
      data: goal,
    });
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * PATCH /api/goals/:goalId
 * Update a goal
 */
router.patch('/:goalId', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const {
      name,
      description,
      target_value,
      stretch_target_value,
      current_value,
      progress_percentage,
      status,
      milestones,
      is_public,
      show_in_leaderboard,
    } = req.body;

    if (status && !['on_track', 'at_risk', 'behind', 'achieved', 'exceeded'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    const goal = await teamAnalyticsService.updateGoal(goalId, {
      name,
      description,
      target_value,
      stretch_target_value,
      current_value,
      progress_percentage,
      status,
      milestones,
      is_public,
      show_in_leaderboard,
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found',
      });
    }

    res.json({
      success: true,
      data: goal,
    });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * DELETE /api/goals/:goalId
 * Delete a goal
 */
router.delete('/:goalId', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    const success = await teamAnalyticsService.deleteGoal(goalId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found or could not be deleted',
      });
    }

    res.json({
      success: true,
      message: 'Goal deleted successfully',
    });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// PROGRESS
// ============================================

/**
 * GET /api/goals/:goalId/progress
 * Get progress history for a goal
 */
router.get('/:goalId/progress', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { limit } = req.query;

    const history = await teamAnalyticsService.getGoalProgressHistory(
      goalId,
      limit ? parseInt(limit as string, 10) : 30
    );

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get goal progress error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/goals/:goalId/refresh
 * Refresh goal progress calculation
 */
router.post('/:goalId/refresh', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    const goal = await teamAnalyticsService.updateGoalProgress(goalId);

    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found',
      });
    }

    res.json({
      success: true,
      data: goal,
    });
  } catch (error) {
    console.error('Refresh goal progress error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// CHECK-INS
// ============================================

/**
 * POST /api/goals/:goalId/check-ins
 * Create a goal check-in
 */
router.post('/:goalId/check-ins', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { goalId } = req.params;
    const { progress_notes, blockers, support_needed, confidence_level } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID required',
      });
    }

    const checkIn = await teamAnalyticsService.createCheckIn({
      goal_id: goalId,
      user_id: userId,
      progress_notes,
      blockers,
      support_needed,
      confidence_level,
    });

    if (!checkIn) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create check-in',
      });
    }

    res.status(201).json({
      success: true,
      data: checkIn,
    });
  } catch (error) {
    console.error('Create check-in error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/goals/:goalId/check-ins
 * Get check-ins for a goal
 */
router.get('/:goalId/check-ins', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    const checkIns = await teamAnalyticsService.getGoalCheckIns(goalId);

    res.json({
      success: true,
      data: checkIns,
    });
  } catch (error) {
    console.error('Get check-ins error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// CONTRIBUTIONS
// ============================================

/**
 * GET /api/goals/:goalId/contributions
 * Get contributions to a team goal
 */
router.get('/:goalId/contributions', async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;

    const contributions = await teamAnalyticsService.calculateContributions(goalId);

    res.json({
      success: true,
      data: contributions,
    });
  } catch (error) {
    console.error('Get contributions error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/users/:userId/contributions
 * Get a user's contributions to team goals
 */
router.get('/users/:userId/contributions', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const contributions = await teamAnalyticsService.getUserContributions(userId);

    res.json({
      success: true,
      data: contributions,
    });
  } catch (error) {
    console.error('Get user contributions error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// ACHIEVEMENTS
// ============================================

/**
 * GET /api/goals/achievements
 * Get achievements
 */
router.get('/achievements', async (req: Request, res: Response) => {
  try {
    const { goal_id, user_id, acknowledged } = req.query;

    const achievements = await teamAnalyticsService.getAchievements({
      goal_id: goal_id as string | undefined,
      user_id: user_id as string | undefined,
      acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
    });

    res.json({
      success: true,
      data: achievements,
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/goals/achievements/:achievementId/acknowledge
 * Acknowledge an achievement
 */
router.post('/achievements/:achievementId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { achievementId } = req.params;

    const success = await teamAnalyticsService.acknowledgeAchievement(achievementId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Achievement not found',
      });
    }

    res.json({
      success: true,
      message: 'Achievement acknowledged',
    });
  } catch (error) {
    console.error('Acknowledge achievement error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/goals/achievements/:achievementId/celebrate
 * Celebrate an achievement
 */
router.post('/achievements/:achievementId/celebrate', async (req: Request, res: Response) => {
  try {
    const { achievementId } = req.params;

    const success = await teamAnalyticsService.celebrateAchievement(achievementId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Achievement not found',
      });
    }

    res.json({
      success: true,
      message: 'Achievement celebrated',
    });
  } catch (error) {
    console.error('Celebrate achievement error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// DASHBOARDS
// ============================================

/**
 * GET /api/goals/dashboard/team
 * Get team dashboard
 */
router.get('/dashboard/team', async (req: Request, res: Response) => {
  try {
    const { period_id, team_id } = req.query;

    if (!period_id) {
      return res.status(400).json({
        success: false,
        error: 'period_id is required',
      });
    }

    const dashboard = await teamAnalyticsService.getTeamDashboard(
      period_id as string,
      team_id as string | undefined
    );

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: 'Period not found',
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Get team dashboard error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/goals/dashboard/individual
 * Get individual dashboard
 */
router.get('/dashboard/individual', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { period_id, user_id } = req.query;

    if (!period_id) {
      return res.status(400).json({
        success: false,
        error: 'period_id is required',
      });
    }

    const targetUserId = (user_id as string) || userId;
    if (!targetUserId) {
      return res.status(401).json({
        success: false,
        error: 'User ID required',
      });
    }

    const dashboard = await teamAnalyticsService.getIndividualDashboard(
      period_id as string,
      targetUserId
    );

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: 'Period not found',
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Get individual dashboard error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/goals/leaderboard
 * Get leaderboard for a period
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const { period_id } = req.query;

    if (!period_id) {
      return res.status(400).json({
        success: false,
        error: 'period_id is required',
      });
    }

    const leaderboard = await teamAnalyticsService.getLeaderboard(period_id as string);

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export default router;
