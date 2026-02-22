/**
 * Slack Routes
 * Handles Slack OAuth, webhooks, and integration endpoints
 */

import { Router, Request, Response } from 'express';
import { slackOAuth } from '../services/slack/oauth.js';
import { slackService } from '../services/slack/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// OAuth Routes
// ============================================

/**
 * GET /api/slack/auth
 * Initiate Slack OAuth flow
 */
router.get('/auth', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const redirectUri = req.query.redirect_uri as string | undefined;
    const authUrl = slackOAuth.getAuthorizationUrl(userId, redirectUri);

    res.json({ authUrl });
  } catch (error) {
    console.error('[Slack Routes] Auth error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/slack/callback
 * Handle Slack OAuth callback
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('[Slack Routes] OAuth error:', error);
      return res.redirect(`/integrations?slack_error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect('/integrations?slack_error=missing_params');
    }

    const result = await slackOAuth.completeOAuth(code as string, state as string);

    if (result.success) {
      res.redirect(`/integrations?slack_connected=true&team=${encodeURIComponent(result.teamName || '')}`);
    } else {
      res.redirect(`/integrations?slack_error=${encodeURIComponent(result.error || 'unknown')}`);
    }
  } catch (error) {
    console.error('[Slack Routes] Callback error:', error);
    res.redirect('/integrations?slack_error=callback_failed');
  }
});

// ============================================
// Connection Status Routes
// ============================================

/**
 * GET /api/slack/status
 * Get Slack connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const connected = await slackOAuth.isConnected(userId);

    if (!connected) {
      return res.json({
        connected: false,
        team: null,
      });
    }

    const connection = await slackOAuth.getConnection(userId);
    const healthy = await slackOAuth.validateConnection(userId);

    res.json({
      connected: true,
      healthy,
      team: connection?.teamName,
      scopes: connection?.scopes,
    });
  } catch (error) {
    console.error('[Slack Routes] Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * DELETE /api/slack/disconnect
 * Disconnect Slack
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    await slackOAuth.disconnect(userId);
    await slackService.deleteConnection(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('[Slack Routes] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ============================================
// Channel Routes
// ============================================

/**
 * GET /api/slack/channels
 * List available channels
 */
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const types = req.query.types
      ? (req.query.types as string).split(',')
      : undefined;

    const channels = await slackService.listChannels(userId, {
      types,
      excludeArchived: req.query.exclude_archived !== 'false',
      limit: parseInt(req.query.limit as string) || 200,
    });

    res.json({ channels });
  } catch (error) {
    console.error('[Slack Routes] List channels error:', error);
    res.status(500).json({ error: 'Failed to list channels' });
  }
});

/**
 * GET /api/slack/channels/:channelId
 * Get channel info
 */
router.get('/channels/:channelId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const channel = await slackService.getChannel(userId, req.params.channelId);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({ channel });
  } catch (error) {
    console.error('[Slack Routes] Get channel error:', error);
    res.status(500).json({ error: 'Failed to get channel' });
  }
});

// ============================================
// User Routes
// ============================================

/**
 * GET /api/slack/users
 * List users
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const users = await slackService.listUsers(userId, limit);

    res.json({ users });
  } catch (error) {
    console.error('[Slack Routes] List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * GET /api/slack/users/:slackUserId
 * Get user info
 */
router.get('/users/:slackUserId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const user = await slackService.getUser(userId, req.params.slackUserId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('[Slack Routes] Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * GET /api/slack/users/by-email/:email
 * Find user by email
 */
router.get('/users/by-email/:email', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const user = await slackService.findUserByEmail(userId, req.params.email);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('[Slack Routes] Find user error:', error);
    res.status(500).json({ error: 'Failed to find user' });
  }
});

// ============================================
// Messaging Routes
// ============================================

/**
 * POST /api/slack/messages
 * Send a message
 */
router.post('/messages', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { channel, text, blocks, threadTs } = req.body;

    if (!channel || !text) {
      return res.status(400).json({ error: 'Channel and text required' });
    }

    const message = await slackService.sendMessage(userId, {
      channel,
      text,
      blocks,
      threadTs,
    });

    res.json({ message });
  } catch (error) {
    console.error('[Slack Routes] Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * POST /api/slack/dm
 * Send a direct message
 */
router.post('/dm', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { slackUserId, text, blocks } = req.body;

    if (!slackUserId || !text) {
      return res.status(400).json({ error: 'Slack user ID and text required' });
    }

    const message = await slackService.sendDM(userId, slackUserId, text, blocks);

    res.json({ message });
  } catch (error) {
    console.error('[Slack Routes] Send DM error:', error);
    res.status(500).json({ error: 'Failed to send DM' });
  }
});

// ============================================
// Webhook Handler (for Events API)
// ============================================

/**
 * POST /api/slack/webhooks/events
 * Handle Slack Events API
 */
router.post('/webhooks/events', async (req: Request, res: Response) => {
  try {
    const { type, challenge, event } = req.body;

    // URL verification challenge
    if (type === 'url_verification') {
      return res.json({ challenge });
    }

    // Handle events
    if (type === 'event_callback' && event) {
      console.log('[Slack Events] Received event:', event.type);

      // Handle different event types
      switch (event.type) {
        case 'message':
          // Handle incoming messages if needed
          break;
        case 'app_mention':
          // Handle @mentions of the bot
          break;
        case 'reaction_added':
          // Handle reactions
          break;
        default:
          console.log('[Slack Events] Unhandled event type:', event.type);
      }
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).send();
  } catch (error) {
    console.error('[Slack Routes] Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// Health Check
// ============================================

/**
 * GET /api/slack/health
 * Health check for Slack integration
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.json({
        status: 'unknown',
        message: 'User ID required for health check',
      });
    }

    const connected = await slackOAuth.isConnected(userId);

    if (!connected) {
      return res.json({
        status: 'disconnected',
        message: 'Slack not connected',
      });
    }

    const healthy = await slackService.healthCheck(userId);
    const circuitBreaker = slackService.getCircuitBreakerStats();

    res.json({
      status: healthy ? 'healthy' : 'unhealthy',
      circuitBreaker: {
        state: circuitBreaker.state,
        failures: circuitBreaker.failures,
      },
    });
  } catch (error) {
    console.error('[Slack Routes] Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: (error as Error).message,
    });
  }
});

export default router;
