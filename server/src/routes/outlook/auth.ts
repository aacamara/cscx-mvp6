/**
 * Microsoft OAuth Routes
 * Handles Microsoft/Azure AD authentication flow
 * PRD-189: Outlook Calendar Integration
 */

import { Router, Request, Response } from 'express';
import { microsoftOAuth, MICROSOFT_SCOPES } from '../../services/outlook/index.js';
import { config } from '../../config/index.js';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Supabase client for auth
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

/**
 * GET /api/outlook/auth/connect
 * Initiates Microsoft OAuth flow
 */
router.get('/connect', async (req: Request, res: Response) => {
  try {
    // Check if Microsoft OAuth is configured
    if (!microsoftOAuth.isConfigured()) {
      return res.status(503).json({
        error: 'Microsoft OAuth not configured',
        message: 'Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables',
      });
    }

    // Get user ID from session/auth header (if authenticated)
    const userId = req.headers['x-user-id'] as string || req.query.userId as string;

    // Generate state with user ID for callback
    const state = userId ? Buffer.from(JSON.stringify({ userId })).toString('base64') : undefined;

    // Generate authorization URL
    const authUrl = microsoftOAuth.getAuthorizationUrl(state);

    res.json({
      url: authUrl,
      scopes: MICROSOFT_SCOPES,
    });
  } catch (error) {
    console.error('Error initiating Microsoft OAuth:', error);
    res.status(500).json({
      error: 'Failed to initiate Microsoft OAuth',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/outlook/auth/callback
 * Handles OAuth callback from Microsoft
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      console.error('Microsoft OAuth error:', oauthError, error_description);
      return res.redirect(`${config.frontendUrl}/settings?error=microsoft_oauth_denied&message=${encodeURIComponent(error_description as string || '')}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${config.frontendUrl}/settings?error=missing_code`);
    }

    // Exchange code for tokens
    const tokens = await microsoftOAuth.exchangeCodeForTokens(code);

    // Parse state to get user ID
    let userId: string | null = null;
    if (state && typeof state === 'string') {
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = parsed.userId;
      } catch {
        // State parsing failed, will try to get user from email
      }
    }

    // If no user ID in state, try to find/create user from Microsoft info
    if (!userId && supabase) {
      // Check if user exists with this Microsoft email
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', tokens.microsoft_email)
        .single();

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // This is a new user - they need to sign up first
        return res.redirect(
          `${config.frontendUrl}/signup?email=${encodeURIComponent(tokens.microsoft_email)}&microsoft_connected=pending`
        );
      }
    }

    if (!userId) {
      return res.redirect(`${config.frontendUrl}/settings?error=no_user`);
    }

    // Save tokens
    await microsoftOAuth.saveTokens(userId, tokens);

    // Redirect to success page
    res.redirect(`${config.frontendUrl}/settings?microsoft_connected=true&email=${encodeURIComponent(tokens.microsoft_email)}`);
  } catch (error) {
    console.error('Error in Microsoft OAuth callback:', error);
    res.redirect(`${config.frontendUrl}/settings?error=oauth_failed&message=${encodeURIComponent((error as Error).message)}`);
  }
});

/**
 * GET /api/outlook/auth/status
 * Check Microsoft connection status for current user
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const status = await microsoftOAuth.getConnectionStatus(userId);

    res.json(status);
  } catch (error) {
    console.error('Error getting Microsoft status:', error);
    res.status(500).json({
      error: 'Failed to get Microsoft status',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/outlook/auth/refresh
 * Force refresh of Microsoft access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Get valid token (will refresh if needed)
    await microsoftOAuth.getValidAccessToken(userId);

    res.json({ success: true, message: 'Token refreshed' });
  } catch (error) {
    console.error('Error refreshing Microsoft token:', error);
    res.status(500).json({
      error: 'Failed to refresh token',
      message: (error as Error).message,
    });
  }
});

/**
 * DELETE /api/outlook/auth/disconnect
 * Disconnect Microsoft account
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    await microsoftOAuth.deleteTokens(userId);

    res.json({ success: true, message: 'Microsoft account disconnected' });
  } catch (error) {
    console.error('Error disconnecting Microsoft:', error);
    res.status(500).json({
      error: 'Failed to disconnect Microsoft',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/outlook/auth/scopes
 * Get list of OAuth scopes used
 */
router.get('/scopes', (req: Request, res: Response) => {
  res.json({
    scopes: MICROSOFT_SCOPES,
    categories: {
      calendar: MICROSOFT_SCOPES.filter(s => s.includes('Calendar')),
      mail: MICROSOFT_SCOPES.filter(s => s.includes('Mail')),
      user: MICROSOFT_SCOPES.filter(s => s.includes('User') || s.includes('profile') || s.includes('email')),
    },
  });
});

export default router;
