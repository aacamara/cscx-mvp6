/**
 * Calendly Scheduling Integration Routes - PRD-208
 *
 * Endpoints:
 * - POST   /api/integrations/calendly/connect - Initiate OAuth flow
 * - GET    /api/integrations/calendly/callback - Handle OAuth callback
 * - POST   /api/integrations/calendly/webhook - Process webhook events
 * - GET    /api/calendly/status - Get connection status
 * - POST   /api/calendly/disconnect - Disconnect integration
 * - GET    /api/calendly/events/:customerId - Get events for a customer
 * - GET    /api/calendly/event-types - List event types
 * - POST   /api/calendly/scheduling-link - Generate scheduling link
 * - GET    /api/calendly/metrics/:customerId - Get engagement metrics
 * - POST   /api/calendly/sync - Trigger manual sync
 */

import { Router, Request, Response } from 'express';
import { calendlyService } from '../services/integrations/calendly.js';
import { config } from '../config/index.js';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// OAuth Routes
// ============================================

/**
 * POST /api/integrations/calendly/connect
 * Initiate Calendly OAuth flow
 */
router.post('/integrations/calendly/connect', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!calendlyService.isConfigured()) {
      return res.status(503).json({
        error: 'Calendly integration not configured',
        message: 'Please set CALENDLY_CLIENT_ID and CALENDLY_CLIENT_SECRET environment variables',
      });
    }

    // Create state with user ID for callback
    const state = Buffer.from(JSON.stringify({
      userId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
    })).toString('base64');

    const authUrl = calendlyService.getAuthorizationUrl(state);

    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error initiating Calendly OAuth:', error);
    res.status(500).json({ error: 'Failed to initiate Calendly connection' });
  }
});

/**
 * GET /api/integrations/calendly/callback
 * Handle Calendly OAuth callback
 */
router.get('/integrations/calendly/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      console.error('Calendly OAuth error:', oauthError);
      return res.redirect(
        `${config.frontendUrl}/settings?calendly_error=${encodeURIComponent(oauthError as string)}`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${config.frontendUrl}/settings?calendly_error=missing_params`
      );
    }

    // Decode state to get user ID
    let stateData: { userId: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch {
      return res.redirect(
        `${config.frontendUrl}/settings?calendly_error=invalid_state`
      );
    }

    const userId = stateData.userId;

    // Check state timestamp (valid for 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return res.redirect(
        `${config.frontendUrl}/settings?calendly_error=expired_state`
      );
    }

    // Exchange code for tokens
    const tokens = await calendlyService.exchangeCodeForTokens(
      code as string,
      `${config.frontendUrl}/api/integrations/calendly/callback`
    );

    // Get user info from Calendly
    const userInfo = await calendlyService.getCurrentUser(tokens.accessToken);

    // Save connection to database
    await calendlyService.saveConnection({
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      calendlyUserId: calendlyService['extractUuidFromUri'](userInfo.uri),
      calendlyUserUri: userInfo.uri,
      organizationUri: userInfo.currentOrganization,
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.avatarUrl,
      timezone: userInfo.timezone,
    });

    // Trigger initial sync in background
    calendlyService.syncEvents(userId).catch((err) => {
      console.error('Initial Calendly sync failed:', err);
    });

    res.redirect(
      `${config.frontendUrl}/settings?calendly_connected=true&email=${encodeURIComponent(userInfo.email)}`
    );
  } catch (error) {
    console.error('Calendly OAuth callback error:', error);
    res.redirect(
      `${config.frontendUrl}/settings?calendly_error=${encodeURIComponent((error as Error).message)}`
    );
  }
});

/**
 * POST /api/integrations/calendly/webhook
 * Handle Calendly webhook events
 */
router.post('/integrations/calendly/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['calendly-webhook-signature'] as string;
    const webhookSecret = process.env.CALENDLY_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      const payload = JSON.stringify(req.body);
      const isValid = calendlyService.verifyWebhookSignature(payload, signature, webhookSecret);

      if (!isValid) {
        console.warn('Invalid Calendly webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body;
    console.log('Calendly webhook received:', event.event);

    // Find user by Calendly user URI in event
    // For now, process for all users (webhook should be org-wide)
    const userId = await findUserByCalendlyEvent(event);

    if (userId) {
      const result = await calendlyService.processWebhook(userId, event);

      if (!result.success) {
        console.error('Webhook processing error:', result.error);
      }
    } else {
      console.warn('Could not find user for Calendly webhook event');
    }

    // Always return 200 to acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing Calendly webhook:', error);
    // Return 200 to prevent retries for unrecoverable errors
    res.json({ received: true, error: (error as Error).message });
  }
});

// ============================================
// Connection Status Routes
// ============================================

/**
 * GET /api/calendly/status
 * Get Calendly connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const status = await calendlyService.getConnectionStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('Error getting Calendly status:', error);
    res.status(500).json({ error: 'Failed to get Calendly status' });
  }
});

/**
 * POST /api/calendly/disconnect
 * Disconnect Calendly integration
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await calendlyService.disconnect(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Calendly:', error);
    res.status(500).json({ error: 'Failed to disconnect Calendly' });
  }
});

// ============================================
// Event Routes
// ============================================

/**
 * GET /api/calendly/events/:customerId
 * Get Calendly events for a customer
 */
router.get('/events/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { customerId } = req.params;
    const { status, limit, offset } = req.query;

    const result = await calendlyService.getCustomerEvents(customerId, {
      status: status as 'active' | 'canceled' | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(result);
  } catch (error) {
    console.error('Error getting customer Calendly events:', error);
    res.status(500).json({ error: 'Failed to get Calendly events' });
  }
});

/**
 * GET /api/calendly/event-types
 * List available event types
 */
router.get('/event-types', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const connection = await calendlyService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Calendly not connected' });
    }

    const accessToken = await calendlyService.getValidAccessToken(userId);
    const { collection } = await calendlyService.listEventTypes(
      accessToken,
      connection.calendlyUserUri,
      { active: true }
    );

    res.json({
      eventTypes: collection.map((et) => ({
        uri: et.uri,
        name: et.name,
        duration: et.duration,
        schedulingUrl: et.schedulingUrl,
        description: et.descriptionPlain,
        color: et.color,
      })),
    });
  } catch (error) {
    console.error('Error getting Calendly event types:', error);
    res.status(500).json({ error: 'Failed to get event types' });
  }
});

// ============================================
// Scheduling Link Routes
// ============================================

/**
 * POST /api/calendly/scheduling-link
 * Generate a one-time scheduling link
 */
router.post('/scheduling-link', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { customerId, eventTypeUri } = req.body;

    if (!customerId || !eventTypeUri) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'customerId and eventTypeUri are required',
      });
    }

    const connection = await calendlyService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Calendly not connected' });
    }

    const result = await calendlyService.generateSchedulingLink(
      userId,
      customerId,
      eventTypeUri
    );

    res.json(result);
  } catch (error) {
    console.error('Error generating scheduling link:', error);
    res.status(500).json({ error: 'Failed to generate scheduling link' });
  }
});

// ============================================
// Metrics Routes
// ============================================

/**
 * GET /api/calendly/metrics/:customerId
 * Get engagement metrics for a customer
 */
router.get('/metrics/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { customerId } = req.params;

    const metrics = await calendlyService.getCustomerMetrics(customerId);

    if (!metrics) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(metrics);
  } catch (error) {
    console.error('Error getting Calendly metrics:', error);
    res.status(500).json({ error: 'Failed to get engagement metrics' });
  }
});

// ============================================
// Sync Routes
// ============================================

/**
 * POST /api/calendly/sync
 * Trigger manual sync of Calendly events
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const connection = await calendlyService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Calendly not connected' });
    }

    const { startDate, endDate } = req.body;

    const result = await calendlyService.syncEvents(userId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.json(result);
  } catch (error) {
    console.error('Error syncing Calendly events:', error);
    res.status(500).json({ error: 'Failed to sync Calendly events' });
  }
});

// ============================================
// Helper Functions
// ============================================

/**
 * Find user ID from Calendly webhook event
 */
async function findUserByCalendlyEvent(event: any): Promise<string | null> {
  // Try to find user by event membership (user URI)
  const scheduledEvent = event.payload?.scheduled_event || event.payload?.scheduledEvent;

  if (scheduledEvent?.event_memberships) {
    for (const membership of scheduledEvent.event_memberships) {
      const userUri = membership.user;
      if (userUri) {
        // Query database for connection with this user URI
        const { createClient } = await import('@supabase/supabase-js');

        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          const { data } = await supabase
            .from('calendly_connections')
            .select('user_id')
            .eq('calendly_user_uri', userUri)
            .single();

          if (data) {
            return data.user_id;
          }
        }
      }
    }
  }

  return null;
}

export default router;
