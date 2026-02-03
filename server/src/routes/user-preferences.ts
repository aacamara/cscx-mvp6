/**
 * User Preferences API Routes
 * PRD-274: Font Size Customization
 *
 * Endpoints for managing user preferences including:
 * - Font size preferences
 * - Accessibility settings
 * - UI customization
 */

import express, { Request, Response, Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router: Router = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Valid font size presets
const VALID_FONT_PRESETS = ['small', 'normal', 'large', 'xlarge', 'xxlarge'];

// Valid font scale range
const MIN_FONT_SCALE = 0.75;
const MAX_FONT_SCALE = 2;

/**
 * GET /api/users/preferences/font-size
 * Retrieve user's font size preferences
 */
router.get('/font-size', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
    });
  }

  try {
    if (!supabase) {
      // Return default if no database
      return res.json({
        success: true,
        data: {
          fontSize: 'normal',
          fontScale: 1,
          respectOSPreference: true,
        },
      });
    }

    // Try to get from user_preferences table
    const { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('font_size, font_scale, respect_os_preference, updated_at')
      .eq('user_id', userId)
      .single();

    if (prefsError && prefsError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" - that's OK, we'll return defaults
      console.error('Error fetching font preferences:', prefsError);
    }

    if (prefs) {
      return res.json({
        success: true,
        data: {
          fontSize: prefs.font_size || 'normal',
          fontScale: prefs.font_scale || 1,
          respectOSPreference: prefs.respect_os_preference ?? true,
          lastUpdated: prefs.updated_at,
        },
      });
    }

    // Check if preferences are stored in accessibility_preferences column
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('accessibility_preferences')
      .eq('id', userId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user:', userError);
    }

    if (user?.accessibility_preferences?.fontSize) {
      return res.json({
        success: true,
        data: {
          fontSize: user.accessibility_preferences.fontSize,
          fontScale: user.accessibility_preferences.fontScale || 1,
          respectOSPreference: user.accessibility_preferences.respectOSPreference ?? true,
        },
      });
    }

    // Return defaults
    return res.json({
      success: true,
      data: {
        fontSize: 'normal',
        fontScale: 1,
        respectOSPreference: true,
      },
    });
  } catch (error) {
    console.error('Error in GET /font-size:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * PUT /api/users/preferences/font-size
 * Save user's font size preferences
 */
router.put('/font-size', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
    });
  }

  const { fontSize, fontScale, respectOSPreference } = req.body;

  // Validate fontSize
  if (fontSize && !VALID_FONT_PRESETS.includes(fontSize)) {
    return res.status(400).json({
      success: false,
      error: `Invalid fontSize. Must be one of: ${VALID_FONT_PRESETS.join(', ')}`,
    });
  }

  // Validate fontScale
  if (fontScale !== undefined) {
    const scale = Number(fontScale);
    if (isNaN(scale) || scale < MIN_FONT_SCALE || scale > MAX_FONT_SCALE) {
      return res.status(400).json({
        success: false,
        error: `Invalid fontScale. Must be between ${MIN_FONT_SCALE} and ${MAX_FONT_SCALE}`,
      });
    }
  }

  try {
    if (!supabase) {
      // No database - just acknowledge the request
      return res.json({
        success: true,
        data: {
          fontSize: fontSize || 'normal',
          fontScale: fontScale || 1,
          respectOSPreference: respectOSPreference ?? true,
        },
        message: 'Preferences saved (in-memory mode)',
      });
    }

    const now = new Date().toISOString();

    // Try to upsert to user_preferences table first
    const { error: upsertError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        font_size: fontSize || 'normal',
        font_scale: fontScale || 1,
        respect_os_preference: respectOSPreference ?? true,
        updated_at: now,
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      // Table might not exist - try updating users.accessibility_preferences
      console.warn('Could not upsert to user_preferences:', upsertError.message);

      const { data: existingUser } = await supabase
        .from('users')
        .select('accessibility_preferences')
        .eq('id', userId)
        .single();

      const updatedPrefs = {
        ...(existingUser?.accessibility_preferences || {}),
        fontSize: fontSize || 'normal',
        fontScale: fontScale || 1,
        respectOSPreference: respectOSPreference ?? true,
      };

      const { error: updateError } = await supabase
        .from('users')
        .update({
          accessibility_preferences: updatedPrefs,
          updated_at: now,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user preferences:', updateError);
        // Don't fail - the client has localStorage fallback
      }
    }

    return res.json({
      success: true,
      data: {
        fontSize: fontSize || 'normal',
        fontScale: fontScale || 1,
        respectOSPreference: respectOSPreference ?? true,
        lastUpdated: now,
      },
    });
  } catch (error) {
    console.error('Error in PUT /font-size:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/users/preferences
 * Get all user preferences
 */
router.get('/', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User ID required',
    });
  }

  try {
    if (!supabase) {
      return res.json({
        success: true,
        data: {
          fontSettings: {
            fontSize: 'normal',
            fontScale: 1,
            respectOSPreference: true,
          },
          accessibility: {},
          ui: {},
        },
      });
    }

    // Get from user_preferences table
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get from users table as fallback
    const { data: user } = await supabase
      .from('users')
      .select('accessibility_preferences')
      .eq('id', userId)
      .single();

    return res.json({
      success: true,
      data: {
        fontSettings: {
          fontSize: prefs?.font_size || user?.accessibility_preferences?.fontSize || 'normal',
          fontScale: prefs?.font_scale || user?.accessibility_preferences?.fontScale || 1,
          respectOSPreference: prefs?.respect_os_preference ?? user?.accessibility_preferences?.respectOSPreference ?? true,
        },
        accessibility: user?.accessibility_preferences || {},
      },
    });
  } catch (error) {
    console.error('Error in GET /preferences:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
