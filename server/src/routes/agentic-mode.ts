/**
 * Agentic Mode API Routes
 * Endpoints for managing user agentic mode settings
 */

import { Router, Request, Response, NextFunction } from 'express';
import { agenticModeService, AGENTIC_PRESETS } from '../services/agentic-mode.js';
import { AgenticModeConfig } from '../agents/engine/agentic-loop.js';

const router = Router();

// Helper to get user ID from request
function getUserId(req: Request): string {
  return (req.headers['x-user-id'] as string) ||
         (req.query.userId as string) ||
         'demo-user';
}

/**
 * GET /api/agentic-mode/settings
 * Get current agentic mode settings for the user
 */
router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const settings = await agenticModeService.getSettings(userId);

    res.json({
      success: true,
      data: {
        enabled: settings.config.enabled,
        preset: settings.preset,
        config: settings.config,
        schedule: settings.schedule,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agentic-mode/toggle
 * Toggle agentic mode on/off
 */
router.post('/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean',
      });
    }

    const settings = await agenticModeService.toggleMode(userId, enabled);

    res.json({
      success: true,
      message: enabled ? 'Agentic mode enabled' : 'Agentic mode disabled',
      data: {
        enabled: settings.config.enabled,
        preset: settings.preset,
        config: settings.config,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agentic-mode/preset
 * Apply a preset configuration
 */
router.post('/preset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { preset } = req.body;

    const validPresets = ['manual', 'vacation', 'supervised', 'autonomous'];
    if (!validPresets.includes(preset)) {
      return res.status(400).json({
        success: false,
        error: `Invalid preset. Must be one of: ${validPresets.join(', ')}`,
      });
    }

    const settings = await agenticModeService.applyPreset(userId, preset);

    res.json({
      success: true,
      message: `Applied "${preset}" preset`,
      data: {
        enabled: settings.config.enabled,
        preset: settings.preset,
        config: settings.config,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/agentic-mode/config
 * Update agentic mode configuration
 */
router.put('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const configUpdates: Partial<AgenticModeConfig> = req.body;

    // Validate config updates
    const validKeys = ['enabled', 'maxSteps', 'autoApproveLevel', 'pauseOnHighRisk', 'notifyOnCompletion'];
    const invalidKeys = Object.keys(configUpdates).filter(k => !validKeys.includes(k));

    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid config keys: ${invalidKeys.join(', ')}`,
      });
    }

    // Validate autoApproveLevel
    if (configUpdates.autoApproveLevel &&
        !['none', 'low_risk', 'all'].includes(configUpdates.autoApproveLevel)) {
      return res.status(400).json({
        success: false,
        error: 'autoApproveLevel must be one of: none, low_risk, all',
      });
    }

    // Validate maxSteps
    if (configUpdates.maxSteps !== undefined) {
      if (typeof configUpdates.maxSteps !== 'number' ||
          configUpdates.maxSteps < 1 ||
          configUpdates.maxSteps > 100) {
        return res.status(400).json({
          success: false,
          error: 'maxSteps must be a number between 1 and 100',
        });
      }
    }

    const settings = await agenticModeService.updateSettings(userId, {
      config: configUpdates as AgenticModeConfig,
      preset: 'custom',
    });

    res.json({
      success: true,
      message: 'Configuration updated',
      data: {
        enabled: settings.config.enabled,
        preset: settings.preset,
        config: settings.config,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/agentic-mode/schedule
 * Set up an automatic schedule for agentic mode
 */
router.put('/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { schedule } = req.body;

    // Validate schedule structure
    if (schedule && schedule.enabled) {
      if (!schedule.timezone || typeof schedule.timezone !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'schedule.timezone is required when schedule is enabled',
        });
      }

      if (!Array.isArray(schedule.rules)) {
        return res.status(400).json({
          success: false,
          error: 'schedule.rules must be an array',
        });
      }
    }

    const settings = await agenticModeService.setSchedule(userId, schedule);

    res.json({
      success: true,
      message: schedule?.enabled ? 'Schedule enabled' : 'Schedule disabled',
      data: {
        schedule: settings.schedule,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agentic-mode/effective
 * Get the effective configuration (respects schedules)
 */
router.get('/effective', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const effectiveConfig = await agenticModeService.getEffectiveConfig(userId);

    res.json({
      success: true,
      data: effectiveConfig,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agentic-mode/presets
 * Get all available presets
 */
router.get('/presets', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      presets: Object.entries(AGENTIC_PRESETS).map(([name, config]) => ({
        name,
        description: getPresetDescription(name),
        config,
      })),
    },
  });
});

function getPresetDescription(preset: string): string {
  const descriptions: Record<string, string> = {
    manual: 'AI suggests actions, you approve everything. Full control.',
    vacation: 'AI handles routine tasks while you\'re away. Pauses for important decisions.',
    supervised: 'AI executes low-risk actions automatically. Asks approval for emails/meetings.',
    autonomous: 'AI runs independently with minimal interruption. Only pauses for critical actions.',
  };
  return descriptions[preset] || 'Custom configuration';
}

export default router;
