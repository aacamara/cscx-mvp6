/**
 * Feature Flags API Routes
 * Endpoints for evaluating and managing feature flags
 */

import { Router, Request, Response } from 'express';
import { featureFlags, EvaluationContext, FeatureFlag } from '../services/featureFlags.js';

const router = Router();

/**
 * POST /api/flags/evaluate
 * Evaluate a single feature flag
 */
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { key, context } = req.body as { key: string; context?: EvaluationContext };

    if (!key) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Flag key is required' }
      });
    }

    const enabled = await featureFlags.isEnabled(key, context);
    const flag = await featureFlags.getFlag(key);

    res.json({
      key,
      enabled,
      flag: flag
        ? {
            name: flag.name,
            description: flag.description,
            rollout_percentage: flag.rollout_percentage
          }
        : null
    });
  } catch (error) {
    console.error('Flag evaluation error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to evaluate flag' }
    });
  }
});

/**
 * POST /api/flags/evaluate-batch
 * Evaluate multiple feature flags at once
 */
router.post('/evaluate-batch', async (req: Request, res: Response) => {
  try {
    const { keys, context } = req.body as { keys: string[]; context?: EvaluationContext };

    if (!keys || !Array.isArray(keys)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Keys array is required' }
      });
    }

    if (keys.length > 50) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Maximum 50 flags per batch' }
      });
    }

    const results = await featureFlags.getFlags(keys);

    res.json({ flags: results });
  } catch (error) {
    console.error('Batch flag evaluation error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to evaluate flags' }
    });
  }
});

/**
 * GET /api/flags
 * List all feature flags (admin)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const flags = await featureFlags.getAllFlags();
    res.json({
      flags,
      count: flags.length
    });
  } catch (error) {
    console.error('List flags error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list flags' }
    });
  }
});

/**
 * GET /api/flags/:key
 * Get a single feature flag by key (admin)
 */
router.get('/:key', async (req: Request, res: Response) => {
  try {
    const flag = await featureFlags.getFlag(req.params.key);

    if (!flag) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Flag not found' }
      });
    }

    res.json(flag);
  } catch (error) {
    console.error('Get flag error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get flag' }
    });
  }
});

/**
 * POST /api/flags
 * Create a new feature flag (admin)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      key,
      name,
      description,
      enabled,
      rollout_percentage,
      targeting_rules
    } = req.body;

    // Validation
    if (!key || !name) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Key and name are required' }
      });
    }

    if (key.length > 100) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Key must be 100 characters or less' }
      });
    }

    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Key must start with a letter and contain only lowercase letters, numbers, and underscores'
        }
      });
    }

    if (rollout_percentage !== undefined && (rollout_percentage < 0 || rollout_percentage > 100)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Rollout percentage must be between 0 and 100' }
      });
    }

    const flag = await featureFlags.createFlag({
      key,
      name,
      description,
      enabled: enabled ?? false,
      rollout_percentage: rollout_percentage ?? 100,
      targeting_rules
    });

    if (!flag) {
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create flag. Supabase may not be configured.' }
      });
    }

    res.status(201).json(flag);
  } catch (error) {
    console.error('Create flag error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create flag' }
    });
  }
});

/**
 * PATCH /api/flags/:key
 * Update a feature flag (admin)
 */
router.patch('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const updates: Partial<FeatureFlag> = {};

    // Only allow specific fields to be updated
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
    if (req.body.rollout_percentage !== undefined) {
      if (req.body.rollout_percentage < 0 || req.body.rollout_percentage > 100) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Rollout percentage must be between 0 and 100' }
        });
      }
      updates.rollout_percentage = req.body.rollout_percentage;
    }
    if (req.body.targeting_rules !== undefined) updates.targeting_rules = req.body.targeting_rules;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'No valid updates provided' }
      });
    }

    const success = await featureFlags.updateFlag(key, updates);

    if (!success) {
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update flag. It may not exist or Supabase may not be configured.' }
      });
    }

    // Fetch and return updated flag
    const updatedFlag = await featureFlags.getFlag(key);
    res.json(updatedFlag);
  } catch (error) {
    console.error('Update flag error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update flag' }
    });
  }
});

/**
 * POST /api/flags/:key/toggle
 * Quick toggle for enabling/disabling a flag (admin)
 */
router.post('/:key/toggle', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    // Get current state
    const flag = await featureFlags.getFlag(key);

    if (!flag) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Flag not found' }
      });
    }

    // Toggle
    const success = await featureFlags.updateFlag(key, { enabled: !flag.enabled });

    if (!success) {
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle flag' }
      });
    }

    res.json({
      key,
      enabled: !flag.enabled,
      message: `Flag ${key} is now ${!flag.enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Toggle flag error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle flag' }
    });
  }
});

/**
 * POST /api/flags/cache/clear
 * Clear the feature flag cache (admin)
 */
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    featureFlags.clearCache();
    res.json({ message: 'Feature flag cache cleared' });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to clear cache' }
    });
  }
});

export { router as featureFlagRoutes };
