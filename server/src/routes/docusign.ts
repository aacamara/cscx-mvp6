/**
 * DocuSign Contract Management Routes - PRD-205
 *
 * Handles OAuth flows, envelope operations, and webhook processing for DocuSign.
 * Implements all endpoints specified in the PRD:
 * - POST /api/integrations/docusign/connect - Initiate OAuth
 * - GET  /api/integrations/docusign/callback - OAuth callback
 * - POST /api/integrations/docusign/webhook - Process webhooks
 * - GET  /api/docusign/envelopes/:customerId - List customer envelopes
 * - GET  /api/docusign/envelope/:envelopeId - Get envelope details
 * - GET  /api/docusign/document/:envelopeId/:documentId - Download document
 * - POST /api/docusign/remind/:envelopeId - Send reminder
 */

import { Router, Request, Response } from 'express';
import {
  docusignService,
  DocuSignWebhookEvent,
  SyncConfig,
} from '../services/integrations/docusign.js';

const router = Router();

// ============================================
// OAUTH ROUTES
// ============================================

/**
 * POST /api/integrations/docusign/connect
 *
 * Initiate DocuSign OAuth flow (FR-1)
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { userId, isDemo = false } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!docusignService.isConfigured()) {
      return res.status(503).json({
        error: 'DocuSign integration not configured. Set DOCUSIGN_CLIENT_ID and DOCUSIGN_CLIENT_SECRET.',
      });
    }

    const authUrl = docusignService.getAuthUrl(userId, isDemo);
    res.json({ authUrl, isDemo });
  } catch (error) {
    console.error('DocuSign connect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/integrations/docusign/callback
 *
 * Handle DocuSign OAuth callback (FR-1)
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (oauthError) {
      return res.redirect(`${frontendUrl}/settings/integrations?error=${encodeURIComponent(oauthError as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/settings/integrations?error=missing_params`);
    }

    // Decode state to get userId and demo flag
    let stateData: { userId: string; isDemo: boolean };
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch {
      return res.redirect(`${frontendUrl}/settings/integrations?error=invalid_state`);
    }

    // Exchange code for tokens
    const connection = await docusignService.connect(code as string, stateData.isDemo);

    // Save connection
    await docusignService.saveConnection(stateData.userId, connection);

    // Redirect to success page
    res.redirect(`${frontendUrl}/settings/integrations?success=docusign_connected`);
  } catch (error) {
    console.error('DocuSign callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings/integrations?error=${encodeURIComponent((error as Error).message)}`);
  }
});

/**
 * DELETE /api/integrations/docusign/disconnect
 *
 * Disconnect DocuSign integration
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await docusignService.disconnect(userId);

    res.json({
      success: true,
      message: 'DocuSign disconnected successfully',
    });
  } catch (error) {
    console.error('DocuSign disconnect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// STATUS AND CONFIG ROUTES
// ============================================

/**
 * GET /api/integrations/docusign/status
 *
 * Get DocuSign integration status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if service is configured
    if (!docusignService.isConfigured()) {
      return res.json({
        configured: false,
        connected: false,
        message: 'DocuSign integration not configured. Set DOCUSIGN_CLIENT_ID and DOCUSIGN_CLIENT_SECRET.',
      });
    }

    // Get sync status
    const status = await docusignService.getSyncStatus(userId);

    // Get connection details if connected
    let connectionDetails = null;
    if (status.connected) {
      const connection = await docusignService.getConnection(userId);
      if (connection) {
        connectionDetails = {
          baseUri: connection.baseUri,
          accountId: connection.accountId,
          isDemo: connection.isDemo,
          tokenValid: connection.tokenExpiresAt > new Date(),
          config: connection.config,
        };
      }
    }

    // Get circuit breaker status
    const circuitBreakerStatus = docusignService.getCircuitBreakerStatus();

    res.json({
      configured: true,
      ...status,
      connection: connectionDetails,
      circuitBreaker: circuitBreakerStatus,
    });
  } catch (error) {
    console.error('DocuSign status error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/integrations/docusign/config
 *
 * Update sync configuration
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const { userId, config } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Validate config
    const validSchedules = ['realtime', 'hourly', 'daily', 'manual'];
    if (config.syncSchedule && !validSchedules.includes(config.syncSchedule)) {
      return res.status(400).json({ error: `Invalid syncSchedule: ${config.syncSchedule}` });
    }

    await docusignService.updateSyncConfig(userId, config as Partial<SyncConfig>);

    res.json({
      success: true,
      message: 'Sync configuration updated successfully',
      config,
    });
  } catch (error) {
    console.error('DocuSign config error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/integrations/docusign/history
 *
 * Get sync history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const history = await docusignService.getSyncHistory(userId, { limit, offset });

    res.json(history);
  } catch (error) {
    console.error('DocuSign history error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// SYNC ROUTES
// ============================================

/**
 * POST /api/integrations/docusign/sync
 *
 * Trigger manual sync (FR-2)
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { userId, incremental = false } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await docusignService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({
        error: 'DocuSign not connected. Please authenticate first.',
      });
    }

    const result = await docusignService.syncEnvelopes(connection, userId, {
      incremental,
      syncConfig: connection.config,
    });

    res.json({
      success: true,
      incremental,
      result,
    });
  } catch (error) {
    console.error('DocuSign sync error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// ENVELOPE ROUTES
// ============================================

/**
 * GET /api/docusign/envelopes/:customerId
 *
 * Get envelopes for a specific customer (FR-2)
 */
router.get('/envelopes/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { status, limit, offset } = req.query;

    const result = await docusignService.getCustomerEnvelopes(customerId, {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(result);
  } catch (error) {
    console.error('Get envelopes error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/docusign/envelope/:envelopeId
 *
 * Get envelope details
 */
router.get('/envelope/:envelopeId', async (req: Request, res: Response) => {
  try {
    const { envelopeId } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await docusignService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'DocuSign not connected' });
    }

    const envelope = await docusignService.getEnvelope(connection, envelopeId);

    res.json({
      success: true,
      envelope,
    });
  } catch (error) {
    console.error('Get envelope error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/docusign/document/:envelopeId/:documentId
 *
 * Download document from envelope (FR-5)
 */
router.get('/document/:envelopeId/:documentId', async (req: Request, res: Response) => {
  try {
    const { envelopeId, documentId } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await docusignService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'DocuSign not connected' });
    }

    const document = await docusignService.downloadDocument(connection, envelopeId, documentId);

    res.setHeader('Content-Type', document.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    res.send(document.content);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/docusign/remind/:envelopeId
 *
 * Send signature reminder (FR-6)
 */
router.post('/remind/:envelopeId', async (req: Request, res: Response) => {
  try {
    const { envelopeId } = req.params;
    const { userId, recipientId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await docusignService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'DocuSign not connected' });
    }

    const result = await docusignService.sendReminder(connection, envelopeId, recipientId);

    res.json(result);
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/docusign/stalled
 *
 * Get stalled contracts awaiting signature
 */
router.get('/stalled', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const thresholdDays = parseInt(req.query.thresholdDays as string) || 3;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const stalledContracts = await docusignService.getStalledContracts(userId, thresholdDays);

    res.json({
      success: true,
      stalledContracts,
      thresholdDays,
    });
  } catch (error) {
    console.error('Get stalled contracts error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// WEBHOOK ROUTES
// ============================================

/**
 * POST /api/integrations/docusign/webhook
 *
 * Handle DocuSign webhook for real-time updates (FR-4)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-docusign-signature-1'] as string;
    const payload = JSON.stringify(req.body);

    // Get the user ID from query params or request body
    const userId = (req.query.userId as string) || req.body.userId;

    if (!userId) {
      // For Connect webhooks, we may need to look up the user by account ID
      const accountId = req.body.data?.accountId;
      if (!accountId) {
        console.warn('[DocuSign Webhook] No userId or accountId provided');
        return res.status(200).json({ received: true, warning: 'No user context' });
      }
      // TODO: Look up user by DocuSign account ID
      console.warn('[DocuSign Webhook] Received webhook without userId');
    }

    // Validate signature if we have a connection
    if (userId) {
      const connection = await docusignService.getConnection(userId);
      if (connection && signature) {
        // Signature validation would use the webhook secret from the connection
        // For now, log a warning
        console.warn('[DocuSign Webhook] Signature validation not yet implemented');
      }
    }

    console.log(`[DocuSign Webhook] Received event: ${req.body.event}`);

    // Process the webhook
    const event = req.body as DocuSignWebhookEvent;
    const result = await docusignService.processWebhook(userId || '', event);

    // If there are alerts, log them (could emit via WebSocket)
    if (result.alerts.length > 0) {
      console.log('[DocuSign Webhook] Alerts triggered:', result.alerts);
      // TODO: Send alerts via WebSocket or notification service
    }

    res.json({
      success: result.processed,
      alerts: result.alerts.length,
    });
  } catch (error) {
    console.error('DocuSign webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/integrations/docusign/webhook/status
 *
 * Health check for webhook endpoint
 */
router.get('/webhook/status', (req: Request, res: Response) => {
  res.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    configured: docusignService.isConfigured(),
  });
});

export default router;
