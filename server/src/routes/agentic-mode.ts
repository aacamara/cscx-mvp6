/**
 * Agentic Mode API Routes
 * Endpoints for managing user agentic mode settings
 * Enhanced with validation and audit logging
 */

import { Router, Request, Response, NextFunction } from 'express';
import { agenticModeService, AGENTIC_PRESETS } from '../services/agentic-mode.js';
import { AgenticModeConfig } from '../agents/engine/agentic-loop.js';
import { config } from '../config/index.js';

// Production readiness imports
import { agenticRateLimit } from '../middleware/agenticRateLimit.js';
import {
  validateToggleRequest,
  validatePresetRequest,
  validateConfigUpdate,
  validateScheduleRequest,
} from '../middleware/validation.js';
import { auditLog } from '../services/auditLog.js';

const router = Router();

// Apply rate limiting (use readonly limits for most endpoints)
router.use(agenticRateLimit);

// Demo user ID - ONLY used in development mode
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

/**
 * Get user ID from request.
 * SECURITY: Demo user fallback ONLY allowed in development mode.
 * Production mode requires authenticated user (set by authMiddleware).
 */
function getUserId(req: Request): string | null {
  // Prefer userId from auth middleware (set by JWT verification)
  if ((req as any).userId) {
    return (req as any).userId;
  }

  // Development only: allow demo user for local testing
  if (config.nodeEnv === 'development') {
    return DEMO_USER_ID;
  }

  // Production: no fallback - must be authenticated
  return null;
}

/**
 * Helper to require authentication.
 * Returns 401 if not authenticated in production.
 */
function requireAuth(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
    return null;
  }
  return userId;
}

/**
 * GET /api/agentic-mode/settings
 * Get current agentic mode settings for the user
 */
router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

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
router.post('/toggle', validateToggleRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { enabled } = req.body;

    const settings = await agenticModeService.toggleMode(userId, enabled);

    // Log mode toggle
    await auditLog.logModeToggle(userId, enabled);

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
router.post('/preset', validatePresetRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { preset } = req.body;

    // Get previous config for audit
    const previousSettings = await agenticModeService.getSettings(userId);

    const settings = await agenticModeService.applyPreset(userId, preset);

    // Log config change
    await auditLog.logConfigChange(
      userId,
      { preset, config: settings.config },
      { preset: previousSettings.preset, config: previousSettings.config }
    );

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
router.put('/config', validateConfigUpdate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const configUpdates: Partial<AgenticModeConfig> = req.body;

    // Get previous config for audit
    const previousSettings = await agenticModeService.getSettings(userId);

    const settings = await agenticModeService.updateSettings(userId, {
      config: configUpdates as AgenticModeConfig,
      preset: 'custom',
    });

    // Log config change
    await auditLog.logConfigChange(
      userId,
      configUpdates,
      previousSettings.config
    );

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
router.put('/schedule', validateScheduleRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { schedule } = req.body;

    // Get previous schedule for audit
    const previousSettings = await agenticModeService.getSettings(userId);

    const settings = await agenticModeService.setSchedule(userId, schedule);

    // Log schedule update
    await auditLog.log({
      userId,
      action: 'schedule_update',
      status: 'success',
      input: { schedule },
      metadata: { previousSchedule: previousSettings.schedule },
    });

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
    const userId = requireAuth(req, res);
    if (!userId) return;

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
