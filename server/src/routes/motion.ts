/**
 * Motion Preferences API
 * PRD-275: Reduced Motion Option
 *
 * Endpoints for persisting user motion/animation preferences.
 * Uses the existing accessibility_preferences JSONB column.
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// Initialize Supabase client if configured
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// In-memory store for preferences (fallback)
const motionPreferencesStore: Map<string, MotionPreference> = new Map();

// Motion preference type
type MotionPreference = 'full' | 'partial' | 'reduced' | 'none' | 'system';

// Valid motion preferences
const VALID_PREFERENCES: MotionPreference[] = ['full', 'partial', 'reduced', 'none', 'system'];

/**
 * GET /api/users/preferences/motion
 * Get user's motion preference
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    // Try Supabase first
    if (supabase) {
      try {
        // Check user_preferences table
        const { data, error } = await supabase
          .from('user_preferences')
          .select('accessibility_preferences')
          .eq('user_id', userId)
          .single();

        if (!error && data?.accessibility_preferences?.reducedMotion) {
          return res.json({
            success: true,
            preference: data.accessibility_preferences.reducedMotion,
            source: 'database'
          });
        }

        // Try users table directly
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('accessibility_preferences')
          .eq('id', userId)
          .single();

        if (!userError && userData?.accessibility_preferences?.reducedMotion) {
          return res.json({
            success: true,
            preference: userData.accessibility_preferences.reducedMotion,
            source: 'database'
          });
        }
      } catch (supabaseError) {
        console.error('Supabase query error:', supabaseError);
        // Fall through to in-memory
      }
    }

    // Fallback to in-memory store
    const preference = motionPreferencesStore.get(userId) || 'system';

    res.json({
      success: true,
      preference,
      source: 'memory'
    });
  } catch (error) {
    console.error('Get motion preference error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get motion preference' }
    });
  }
});

/**
 * PUT /api/users/preferences/motion
 * Update user's motion preference
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    const { preference } = req.body;

    // Validate preference
    if (!preference || !VALID_PREFERENCES.includes(preference)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid motion preference. Must be one of: ${VALID_PREFERENCES.join(', ')}`
        }
      });
    }

    const updatedAt = new Date().toISOString();

    // Try Supabase first
    if (supabase) {
      try {
        // Get existing preferences
        const { data: existingData } = await supabase
          .from('user_preferences')
          .select('accessibility_preferences')
          .eq('user_id', userId)
          .single();

        const existingPrefs = existingData?.accessibility_preferences || {};

        // Merge with existing accessibility preferences
        const updatedPrefs = {
          ...existingPrefs,
          reducedMotion: preference,
          updatedAt
        };

        // Upsert into user_preferences table
        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: userId,
            accessibility_preferences: updatedPrefs,
            updated_at: updatedAt
          }, {
            onConflict: 'user_id'
          });

        if (!error) {
          return res.json({
            success: true,
            preference,
            message: 'Motion preference updated'
          });
        }

        // If user_preferences doesn't exist, try users table
        const { data: userData } = await supabase
          .from('users')
          .select('accessibility_preferences')
          .eq('id', userId)
          .single();

        const userExistingPrefs = userData?.accessibility_preferences || {};

        const { error: updateError } = await supabase
          .from('users')
          .update({
            accessibility_preferences: {
              ...userExistingPrefs,
              reducedMotion: preference,
              updatedAt
            }
          })
          .eq('id', userId);

        if (!updateError) {
          return res.json({
            success: true,
            preference,
            message: 'Motion preference updated'
          });
        }

        console.error('Supabase update error:', updateError);
      } catch (supabaseError) {
        console.error('Supabase error:', supabaseError);
        // Fall through to in-memory
      }
    }

    // Fallback to in-memory store
    motionPreferencesStore.set(userId, preference);

    res.json({
      success: true,
      preference,
      message: 'Motion preference updated',
      source: 'memory'
    });
  } catch (error) {
    console.error('Update motion preference error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update motion preference' }
    });
  }
});

/**
 * DELETE /api/users/preferences/motion
 * Reset motion preference to system default
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    const defaultPreference: MotionPreference = 'system';
    const updatedAt = new Date().toISOString();

    // Try Supabase first
    if (supabase) {
      try {
        // Get existing preferences
        const { data: existingData } = await supabase
          .from('user_preferences')
          .select('accessibility_preferences')
          .eq('user_id', userId)
          .single();

        const existingPrefs = existingData?.accessibility_preferences || {};

        // Update with system preference
        const updatedPrefs = {
          ...existingPrefs,
          reducedMotion: defaultPreference,
          updatedAt
        };

        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: userId,
            accessibility_preferences: updatedPrefs,
            updated_at: updatedAt
          }, {
            onConflict: 'user_id'
          });

        if (!error) {
          return res.json({
            success: true,
            preference: defaultPreference,
            message: 'Motion preference reset to system default'
          });
        }
      } catch (supabaseError) {
        console.error('Supabase error:', supabaseError);
      }
    }

    // Fallback to in-memory
    motionPreferencesStore.set(userId, defaultPreference);

    res.json({
      success: true,
      preference: defaultPreference,
      message: 'Motion preference reset to system default'
    });
  } catch (error) {
    console.error('Reset motion preference error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to reset motion preference' }
    });
  }
});

export { router as motionRoutes };
export default router;
