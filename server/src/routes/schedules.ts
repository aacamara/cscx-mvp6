/**
 * Agent Schedules API Routes
 * CRUD operations for scheduled agent runs
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  schedulerService,
  CreateScheduleInput,
  ScheduleFrequency,
} from '../services/scheduler.js';

const router = Router();

// Helper to get user ID from request
function getUserId(req: Request): string {
  return (req.headers['x-user-id'] as string) ||
         (req.query.userId as string) ||
         'demo-user';
}

/**
 * POST /api/schedules
 * Create a new scheduled agent run
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const {
      name,
      description,
      goal,
      customerId,
      frequency,
      cronExpression,
      timezone,
      enabled,
    } = req.body;

    // Validate required fields
    if (!name || !goal) {
      return res.status(400).json({
        success: false,
        error: 'name and goal are required',
      });
    }

    // Validate frequency
    const validFrequencies: ScheduleFrequency[] = ['daily', 'weekly', 'monthly', 'custom'];
    if (frequency && !validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`,
      });
    }

    // Custom frequency requires cronExpression
    if (frequency === 'custom' && !cronExpression) {
      return res.status(400).json({
        success: false,
        error: 'cronExpression is required for custom frequency',
      });
    }

    const input: CreateScheduleInput = {
      userId,
      customerId,
      name,
      description,
      goal,
      frequency: frequency || 'daily',
      cronExpression,
      timezone,
      enabled,
    };

    const schedule = await schedulerService.createSchedule(input);

    res.status(201).json({
      success: true,
      schedule: {
        id: schedule.id,
        name: schedule.name,
        description: schedule.description,
        goal: schedule.goal,
        customerId: schedule.customerId,
        frequency: schedule.frequency,
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
        enabled: schedule.enabled,
        nextRunAt: schedule.nextRunAt,
        createdAt: schedule.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/schedules
 * List all schedules for the current user
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const schedules = await schedulerService.getUserSchedules(userId);

    res.json({
      success: true,
      schedules: schedules.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        goal: s.goal.substring(0, 100) + (s.goal.length > 100 ? '...' : ''),
        customerId: s.customerId,
        frequency: s.frequency,
        cronExpression: s.cronExpression,
        timezone: s.timezone,
        enabled: s.enabled,
        lastRunAt: s.lastRunAt,
        lastRunStatus: s.lastRunStatus,
        nextRunAt: s.nextRunAt,
        runCount: s.runCount,
        createdAt: s.createdAt,
      })),
      total: schedules.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/schedules/:id
 * Get a specific schedule
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const schedule = await schedulerService.getSchedule(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
      });
    }

    res.json({
      success: true,
      schedule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/schedules/:id
 * Update a schedule
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      goal,
      customerId,
      frequency,
      cronExpression,
      timezone,
      enabled,
    } = req.body;

    const schedule = await schedulerService.updateSchedule(id, {
      name,
      description,
      goal,
      customerId,
      frequency,
      cronExpression,
      timezone,
      enabled,
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
      });
    }

    res.json({
      success: true,
      schedule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/schedules/:id/toggle
 * Enable or disable a schedule
 */
router.put('/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean',
      });
    }

    const schedule = await schedulerService.toggleSchedule(id, enabled);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
      });
    }

    res.json({
      success: true,
      schedule: {
        id: schedule.id,
        name: schedule.name,
        enabled: schedule.enabled,
        nextRunAt: schedule.nextRunAt,
      },
      message: `Schedule ${enabled ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await schedulerService.deleteSchedule(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found or could not be deleted',
      });
    }

    res.json({
      success: true,
      message: 'Schedule deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/schedules/:id/trigger
 * Manually trigger a scheduled run
 */
router.post('/:id/trigger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const runLog = await schedulerService.triggerSchedule(id);

    res.json({
      success: true,
      run: {
        id: runLog.id,
        scheduleId: runLog.scheduleId,
        status: runLog.status,
        startedAt: runLog.startedAt,
        completedAt: runLog.completedAt,
        result: runLog.result,
        error: runLog.error,
        stepsExecuted: runLog.stepsExecuted,
      },
    });
  } catch (error) {
    if ((error as Error).message === 'Schedule not found') {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
      });
    }
    next(error);
  }
});

/**
 * GET /api/schedules/:id/runs
 * Get run history for a schedule
 */
router.get('/:id/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const runLogs = await schedulerService.getRunLogs(id, limit);

    res.json({
      success: true,
      runs: runLogs,
      total: runLogs.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/schedules/presets
 * Get available schedule presets (common cron patterns)
 */
router.get('/meta/presets', async (req: Request, res: Response) => {
  res.json({
    success: true,
    presets: [
      {
        name: 'Every morning at 9 AM',
        frequency: 'daily',
        cronExpression: '0 9 * * *',
      },
      {
        name: 'Every Monday at 9 AM',
        frequency: 'weekly',
        cronExpression: '0 9 * * 1',
      },
      {
        name: 'Every Friday at 4 PM',
        frequency: 'weekly',
        cronExpression: '0 16 * * 5',
      },
      {
        name: 'First of every month at 10 AM',
        frequency: 'monthly',
        cronExpression: '0 10 1 * *',
      },
      {
        name: 'Every 4 hours',
        frequency: 'custom',
        cronExpression: '0 */4 * * *',
      },
      {
        name: 'Twice daily (9 AM and 5 PM)',
        frequency: 'custom',
        cronExpression: '0 9,17 * * *',
      },
    ],
    timezones: [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Asia/Singapore',
      'Australia/Sydney',
      'UTC',
    ],
  });
});

export default router;
