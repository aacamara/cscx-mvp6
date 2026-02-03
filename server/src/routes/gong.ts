/**
 * Gong Routes (PRD-193)
 *
 * API endpoints for Gong Call Intelligence integration:
 * - OAuth connection
 * - Call data retrieval
 * - Transcript access
 * - Insight queries
 * - Risk signal management
 * - Webhook handling
 */

import { Router, Request, Response } from 'express';
import { gongOAuth } from '../services/gong/oauth.js';
import { gongService } from '../services/gong/index.js';

const router = Router();

// ============================================================================
// OAuth Routes
// ============================================================================

/**
 * POST /api/gong/connect
 * Initiate Gong OAuth flow
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!gongOAuth.isConfigured()) {
      return res.status(503).json({
        error: 'Gong integration not configured',
        message: 'GONG_CLIENT_ID and GONG_CLIENT_SECRET must be set',
      });
    }

    const redirectUri = req.body.redirect_uri as string | undefined;
    const authUrl = gongOAuth.getAuthorizationUrl(userId, redirectUri);

    res.json({ authUrl });
  } catch (error) {
    console.error('[Gong Routes] Connect error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/gong/callback
 * Handle Gong OAuth callback
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('[Gong Routes] OAuth error:', error);
      return res.redirect(`/integrations?gong_error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect('/integrations?gong_error=missing_params');
    }

    const result = await gongOAuth.completeOAuth(code as string, state as string);

    if (result.success) {
      res.redirect(`/integrations?gong_connected=true&workspace=${encodeURIComponent(result.workspaceName || '')}`);
    } else {
      res.redirect(`/integrations?gong_error=${encodeURIComponent(result.error || 'unknown')}`);
    }
  } catch (error) {
    console.error('[Gong Routes] Callback error:', error);
    res.redirect('/integrations?gong_error=callback_failed');
  }
});

/**
 * GET /api/gong/status
 * Get Gong connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const connected = await gongOAuth.isConnected(userId);

    if (!connected) {
      return res.json({
        connected: false,
        configured: gongOAuth.isConfigured(),
      });
    }

    const connection = await gongOAuth.getConnection(userId);
    const healthy = await gongOAuth.validateConnection(userId);

    res.json({
      connected: true,
      healthy,
      workspaceName: connection?.workspaceName,
      scopes: connection?.scopes,
      connectedAt: connection?.connectedAt,
    });
  } catch (error) {
    console.error('[Gong Routes] Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * DELETE /api/gong/disconnect
 * Disconnect Gong
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    await gongOAuth.disconnect(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('[Gong Routes] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ============================================================================
// Call Routes
// ============================================================================

/**
 * GET /api/gong/calls
 * List calls with optional filters
 */
router.get('/calls', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const customerId = req.query.customer_id as string | undefined;
    const fromDate = req.query.from_date as string | undefined;
    const toDate = req.query.to_date as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!customerId) {
      return res.status(400).json({ error: 'customer_id is required' });
    }

    const { calls, total } = await gongService.getCustomerCalls(customerId, {
      limit,
      offset,
      fromDate,
      toDate,
    });

    res.json({
      calls,
      total,
      hasMore: offset + calls.length < total,
    });
  } catch (error) {
    console.error('[Gong Routes] List calls error:', error);
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

/**
 * GET /api/gong/calls/:id
 * Get call details
 */
router.get('/calls/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const call = await gongService.getCall(req.params.id);

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Get insights for this call
    const insights = await gongService.getCallInsights(req.params.id);

    res.json({
      call,
      insights,
    });
  } catch (error) {
    console.error('[Gong Routes] Get call error:', error);
    res.status(500).json({ error: 'Failed to fetch call' });
  }
});

/**
 * GET /api/gong/calls/:id/transcript
 * Get call transcript
 */
router.get('/calls/:id/transcript', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const transcript = await gongService.getTranscript(req.params.id);

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    res.json({ transcript });
  } catch (error) {
    console.error('[Gong Routes] Get transcript error:', error);
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
});

// ============================================================================
// Customer Routes
// ============================================================================

/**
 * GET /api/gong/customer/:customerId/calls
 * Get all calls for a customer
 */
router.get('/customer/:customerId/calls', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const fromDate = req.query.from_date as string | undefined;
    const toDate = req.query.to_date as string | undefined;

    const { calls, total } = await gongService.getCustomerCalls(customerId, {
      limit,
      offset,
      fromDate,
      toDate,
    });

    // Get sentiment trend
    const sentimentTrend = await gongService.getCustomerSentimentTrend(customerId);

    res.json({
      customerId,
      calls,
      total,
      hasMore: offset + calls.length < total,
      sentimentTrend,
    });
  } catch (error) {
    console.error('[Gong Routes] Get customer calls error:', error);
    res.status(500).json({ error: 'Failed to fetch customer calls' });
  }
});

/**
 * GET /api/gong/insights/:customerId
 * Get insights for a customer
 */
router.get('/insights/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;

    const { insights, aggregated } = await gongService.getCustomerInsights(customerId);
    const riskSignals = await gongService.getCustomerRiskSignals(customerId, true);

    res.json({
      customerId,
      insights,
      aggregated,
      riskSignals,
    });
  } catch (error) {
    console.error('[Gong Routes] Get insights error:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

/**
 * GET /api/gong/customer/:customerId/risk-signals
 * Get risk signals for a customer
 */
router.get('/customer/:customerId/risk-signals', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;
    const unacknowledgedOnly = req.query.unacknowledged !== 'false';

    const riskSignals = await gongService.getCustomerRiskSignals(customerId, unacknowledgedOnly);

    res.json({ riskSignals });
  } catch (error) {
    console.error('[Gong Routes] Get risk signals error:', error);
    res.status(500).json({ error: 'Failed to fetch risk signals' });
  }
});

/**
 * POST /api/gong/risk-signals/:id/acknowledge
 * Acknowledge a risk signal
 */
router.post('/risk-signals/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const success = await gongService.acknowledgeRiskSignal(req.params.id, userId);

    if (!success) {
      return res.status(404).json({ error: 'Risk signal not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Gong Routes] Acknowledge risk signal error:', error);
    res.status(500).json({ error: 'Failed to acknowledge risk signal' });
  }
});

// ============================================================================
// Search Routes
// ============================================================================

/**
 * POST /api/gong/search
 * Search across call transcripts
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { query, customer_id: customerId, limit = 20, offset = 0 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const { results, total } = await gongService.searchTranscripts(query, {
      customerId,
      limit,
      offset,
    });

    res.json({
      query,
      results,
      total,
      hasMore: offset + results.length < total,
    });
  } catch (error) {
    console.error('[Gong Routes] Search error:', error);
    res.status(500).json({ error: 'Failed to search transcripts' });
  }
});

// ============================================================================
// Sync Routes
// ============================================================================

/**
 * POST /api/gong/sync
 * Trigger call sync from Gong
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { from_date: fromDateTime, to_date: toDateTime } = req.body;

    // Default to last 30 days if not specified
    const fromDate = fromDateTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = toDateTime || new Date().toISOString();

    const result = await gongService.syncCalls(userId, {
      fromDateTime: fromDate,
      toDateTime: toDate,
    });

    res.json({
      success: result.errors.length === 0,
      ...result,
    });
  } catch (error) {
    console.error('[Gong Routes] Sync error:', error);
    res.status(500).json({ error: 'Failed to sync calls' });
  }
});

// ============================================================================
// Webhook Routes
// ============================================================================

/**
 * POST /api/gong/webhook
 * Handle Gong webhook events
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    console.log('[Gong Webhook] Received event:', event.eventType);

    // Handle different event types
    switch (event.eventType) {
      case 'call.completed':
        // A new call has been recorded and is ready for processing
        console.log(`[Gong Webhook] Call completed: ${event.callId}`);
        // Could trigger async sync for this specific call
        break;

      case 'call.analyzed':
        // Call analysis (transcription, insights) is complete
        console.log(`[Gong Webhook] Call analyzed: ${event.callId}`);
        break;

      case 'tracker.matched':
        // A tracker was matched in a call
        console.log(`[Gong Webhook] Tracker matched in call: ${event.callId}`);
        break;

      default:
        console.log(`[Gong Webhook] Unhandled event type: ${event.eventType}`);
    }

    // Always acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Gong Routes] Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================================================
// Sentiment Routes
// ============================================================================

/**
 * GET /api/gong/customer/:customerId/sentiment
 * Get sentiment trend for a customer
 */
router.get('/customer/:customerId/sentiment', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;

    const sentimentTrend = await gongService.getCustomerSentimentTrend(customerId);

    res.json({ customerId, ...sentimentTrend });
  } catch (error) {
    console.error('[Gong Routes] Get sentiment error:', error);
    res.status(500).json({ error: 'Failed to fetch sentiment' });
  }
});

/**
 * POST /api/gong/calls/:id/analyze-sentiment
 * Analyze sentiment for a specific call
 */
router.post('/calls/:id/analyze-sentiment', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const sentiment = await gongService.analyzeCallSentiment(userId, req.params.id);

    if (!sentiment) {
      return res.status(404).json({ error: 'Could not analyze sentiment (transcript may not be available)' });
    }

    // Update call with sentiment
    await gongService.updateCallSentiment(req.params.id, sentiment);

    res.json({ sentiment });
  } catch (error) {
    console.error('[Gong Routes] Analyze sentiment error:', error);
    res.status(500).json({ error: 'Failed to analyze sentiment' });
  }
});

// ============================================================================
// Health Routes
// ============================================================================

/**
 * GET /api/gong/health
 * Health check for Gong integration
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.json({
        status: 'unknown',
        configured: gongOAuth.isConfigured(),
        message: 'User ID required for health check',
      });
    }

    const connected = await gongOAuth.isConnected(userId);

    if (!connected) {
      return res.json({
        status: 'disconnected',
        configured: gongOAuth.isConfigured(),
        message: 'Gong not connected',
      });
    }

    const healthy = await gongService.healthCheck(userId);
    const circuitBreaker = gongService.getCircuitBreakerStats();

    res.json({
      status: healthy ? 'healthy' : 'unhealthy',
      configured: gongOAuth.isConfigured(),
      circuitBreaker: {
        state: circuitBreaker.state,
        failures: circuitBreaker.failures,
      },
    });
  } catch (error) {
    console.error('[Gong Routes] Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: (error as Error).message,
    });
  }
});

export default router;
