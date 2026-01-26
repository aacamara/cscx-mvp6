/**
 * Google OAuth Routes
 * Handles Google Workspace authentication flow
 */

import { Router, Request, Response } from 'express';
import { googleOAuth, GOOGLE_SCOPES } from '../../services/google/index.js';
import { config } from '../../config/index.js';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Supabase client for auth
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

/**
 * GET /api/google/auth/connect
 * Initiates Google OAuth flow
 */
router.get('/connect', async (req: Request, res: Response) => {
  try {
    // Check if Google OAuth is configured
    if (!googleOAuth.isConfigured()) {
      return res.status(503).json({
        error: 'Google OAuth not configured',
        message: 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables',
      });
    }

    // Get user ID from session/auth header (if authenticated)
    const userId = req.headers['x-user-id'] as string || req.query.userId as string;

    // Generate state with user ID for callback
    const state = userId ? Buffer.from(JSON.stringify({ userId })).toString('base64') : undefined;

    // Generate authorization URL
    const authUrl = googleOAuth.getAuthorizationUrl(state);

    res.json({
      url: authUrl,
      scopes: GOOGLE_SCOPES,
    });
  } catch (error) {
    console.error('Error initiating Google OAuth:', error);
    res.status(500).json({
      error: 'Failed to initiate Google OAuth',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/google/auth/callback
 * Handles OAuth callback from Google
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      console.error('Google OAuth error:', oauthError);
      return res.redirect(`${config.frontendUrl}/settings?error=google_oauth_denied`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${config.frontendUrl}/settings?error=missing_code`);
    }

    // Exchange code for tokens
    const tokens = await googleOAuth.exchangeCodeForTokens(code);

    // Parse state to get user ID
    let userId: string | null = null;
    if (state && typeof state === 'string') {
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = parsed.userId;
      } catch {
        // State parsing failed, will try to get user from session
      }
    }

    // If no user ID in state, try to create/get user from Google info
    if (!userId && supabase) {
      // Check if user exists with this Google email
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', tokens.google_email)
        .single();

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // This is a new user - they need to sign up first
        // For now, redirect with the Google email to pre-fill signup
        return res.redirect(
          `${config.frontendUrl}/signup?email=${encodeURIComponent(tokens.google_email)}&google_connected=pending`
        );
      }
    }

    if (!userId) {
      return res.redirect(`${config.frontendUrl}/settings?error=no_user`);
    }

    // Save tokens
    await googleOAuth.saveTokens(userId, tokens);

    // Redirect to success page
    res.redirect(`${config.frontendUrl}/settings?google_connected=true&email=${encodeURIComponent(tokens.google_email)}`);
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    res.redirect(`${config.frontendUrl}/settings?error=oauth_failed&message=${encodeURIComponent((error as Error).message)}`);
  }
});

/**
 * GET /api/google/auth/status
 * Check Google connection status for current user
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const status = await googleOAuth.getConnectionStatus(userId);

    res.json(status);
  } catch (error) {
    console.error('Error getting Google status:', error);
    res.status(500).json({
      error: 'Failed to get Google status',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/google/auth/refresh
 * Force refresh of Google access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Get valid token (will refresh if needed)
    await googleOAuth.getValidAccessToken(userId);

    res.json({ success: true, message: 'Token refreshed' });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({
      error: 'Failed to refresh token',
      message: (error as Error).message,
    });
  }
});

/**
 * DELETE /api/google/auth/disconnect
 * Disconnect Google account
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    await googleOAuth.deleteTokens(userId);

    res.json({ success: true, message: 'Google account disconnected' });
  } catch (error) {
    console.error('Error disconnecting Google:', error);
    res.status(500).json({
      error: 'Failed to disconnect Google',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/google/auth/sync-tokens
 * Sync tokens from Supabase Auth to backend
 * Called by frontend after Supabase OAuth completes
 */
router.post('/sync-tokens', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { accessToken, refreshToken, expiresAt, grantedScopes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token required' });
    }

    // Get user info from Google using the access token
    let googleEmail = '';
    let googleUserId = '';
    let googlePictureUrl = '';

    try {
      const userInfo = await googleOAuth.getUserInfo(accessToken);
      googleEmail = userInfo.email;
      googleUserId = userInfo.id;
      googlePictureUrl = userInfo.picture || '';
    } catch (error) {
      console.warn('Failed to get Google user info:', error);
      // Continue without Google info - tokens might still be valid
    }

    // Save tokens to database
    const tokens = {
      access_token: accessToken,
      refresh_token: refreshToken || '',
      token_expires_at: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 3600 * 1000),
      granted_scopes: grantedScopes || GOOGLE_SCOPES,
      google_email: googleEmail,
      google_user_id: googleUserId,
      google_picture_url: googlePictureUrl,
    };

    await googleOAuth.saveTokens(userId, tokens);

    res.json({
      success: true,
      message: 'Tokens synced successfully',
      email: googleEmail,
    });
  } catch (error) {
    console.error('Error syncing tokens:', error);
    res.status(500).json({
      error: 'Failed to sync tokens',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/google/auth/scopes
 * Get list of OAuth scopes used
 */
router.get('/scopes', (req: Request, res: Response) => {
  res.json({
    scopes: GOOGLE_SCOPES,
    categories: {
      gmail: GOOGLE_SCOPES.filter(s => s.includes('gmail')),
      calendar: GOOGLE_SCOPES.filter(s => s.includes('calendar')),
      drive: GOOGLE_SCOPES.filter(s => s.includes('drive')),
      docs: GOOGLE_SCOPES.filter(s => s.includes('documents')),
      sheets: GOOGLE_SCOPES.filter(s => s.includes('spreadsheets')),
      slides: GOOGLE_SCOPES.filter(s => s.includes('presentations')),
      tasks: GOOGLE_SCOPES.filter(s => s.includes('tasks')),
      contacts: GOOGLE_SCOPES.filter(s => s.includes('contacts') || s.includes('directory')),
    },
  });
});

export default router;
