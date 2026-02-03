/**
 * Accessibility Preferences API - PRD-273 High Contrast Mode
 * Endpoints for persisting user accessibility preferences
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const router = Router();

// Initialize Supabase client if configured
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// In-memory store for preferences (fallback)
const preferencesStore: Map<string, AccessibilityPreferences> = new Map();

// Accessibility preferences interface
interface AccessibilityPreferences {
  contrastMode: 'normal' | 'high-light' | 'high-dark';
  reducedMotion: boolean;
  fontSize: 'normal' | 'large' | 'x-large';
  screenReaderOptimized: boolean;
  focusIndicatorEnhanced: boolean;
  updatedAt: string;
}

// Default preferences
const defaultPreferences: AccessibilityPreferences = {
  contrastMode: 'normal',
  reducedMotion: false,
  fontSize: 'normal',
  screenReaderOptimized: false,
  focusIndicatorEnhanced: false,
  updatedAt: new Date().toISOString(),
};

/**
 * GET /api/users/preferences/accessibility
 * Get user's accessibility preferences
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
        // Check if the column exists by querying user_preferences
        const { data, error } = await supabase
          .from('user_preferences')
          .select('accessibility_preferences')
          .eq('user_id', userId)
          .single();

        if (!error && data?.accessibility_preferences) {
          return res.json({
            success: true,
            preferences: data.accessibility_preferences as AccessibilityPreferences
          });
        }

        // If no preferences found, try the users table directly
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('accessibility_preferences')
          .eq('id', userId)
          .single();

        if (!userError && userData?.accessibility_preferences) {
          return res.json({
            success: true,
            preferences: userData.accessibility_preferences as AccessibilityPreferences
          });
        }
      } catch (supabaseError) {
        console.error('Supabase query error:', supabaseError);
        // Fall through to in-memory
      }
    }

    // Fallback to in-memory store
    const preferences = preferencesStore.get(userId) || defaultPreferences;

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Get accessibility preferences error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get accessibility preferences' }
    });
  }
});

/**
 * PUT /api/users/preferences/accessibility
 * Update user's accessibility preferences
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    const updates = req.body;

    // Validate contrast mode if provided
    if (updates.contrastMode !== undefined) {
      const validModes = ['normal', 'high-light', 'high-dark'];
      if (!validModes.includes(updates.contrastMode)) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid contrast mode' }
        });
      }
    }

    // Validate font size if provided
    if (updates.fontSize !== undefined) {
      const validSizes = ['normal', 'large', 'x-large'];
      if (!validSizes.includes(updates.fontSize)) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid font size' }
        });
      }
    }

    // Build updated preferences
    const existingPreferences = preferencesStore.get(userId) || defaultPreferences;
    const newPreferences: AccessibilityPreferences = {
      ...existingPreferences,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Try Supabase first
    if (supabase) {
      try {
        // Try to upsert into user_preferences table
        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: userId,
            accessibility_preferences: newPreferences,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (error) {
          // If user_preferences table doesn't exist, try users table
          const { error: updateError } = await supabase
            .from('users')
            .update({
              accessibility_preferences: newPreferences
            })
            .eq('id', userId);

          if (updateError) {
            console.error('Supabase update error:', updateError);
            // Fall through to in-memory
          } else {
            return res.json({
              success: true,
              preferences: newPreferences,
              message: 'Accessibility preferences updated'
            });
          }
        } else {
          return res.json({
            success: true,
            preferences: newPreferences,
            message: 'Accessibility preferences updated'
          });
        }
      } catch (supabaseError) {
        console.error('Supabase error:', supabaseError);
        // Fall through to in-memory
      }
    }

    // Fallback to in-memory store
    preferencesStore.set(userId, newPreferences);

    res.json({
      success: true,
      preferences: newPreferences,
      message: 'Accessibility preferences updated'
    });
  } catch (error) {
    console.error('Update accessibility preferences error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update accessibility preferences' }
    });
  }
});

/**
 * DELETE /api/users/preferences/accessibility
 * Reset user's accessibility preferences to defaults
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    const resetPreferences: AccessibilityPreferences = {
      ...defaultPreferences,
      updatedAt: new Date().toISOString(),
    };

    // Try Supabase first
    if (supabase) {
      try {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: userId,
            accessibility_preferences: resetPreferences,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (!error) {
          return res.json({
            success: true,
            preferences: resetPreferences,
            message: 'Accessibility preferences reset to defaults'
          });
        }
      } catch (supabaseError) {
        console.error('Supabase error:', supabaseError);
      }
    }

    // Fallback to in-memory
    preferencesStore.set(userId, resetPreferences);

    res.json({
      success: true,
      preferences: resetPreferences,
      message: 'Accessibility preferences reset to defaults'
    });
  } catch (error) {
    console.error('Reset accessibility preferences error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to reset accessibility preferences' }
    });
  }
});

export { router as accessibilityRoutes };
export default router;
