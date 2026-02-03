/**
 * PRD-123, PRD-206: PandaDoc Webhook Handler
 * Processes contract signature events from PandaDoc
 *
 * Endpoints:
 * - POST /api/webhooks/pandadoc/document - Document status change webhook
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  implementationService,
  type PandaDocDocumentCompletedWebhook,
} from '../../services/implementation/index.js';
import { pandadocService } from '../../services/integrations/pandadoc.js';

const router = Router();

// ============================================
// PandaDoc Webhook Configuration
// ============================================

function getPandaDocConfig(): { sharedKey: string } | null {
  return {
    sharedKey: process.env.PANDADOC_WEBHOOK_KEY || '',
  };
}

// ============================================
// Webhook Verification
// ============================================

/**
 * Verify PandaDoc webhook signature
 * See: https://developers.pandadoc.com/docs/webhooks
 */
function verifyPandaDocSignature(req: Request): boolean {
  const signature = req.headers['x-pandadoc-signature'] as string;

  if (!signature) {
    console.warn('[PandaDoc] No signature header');
    return false;
  }

  const config = getPandaDocConfig();
  if (!config?.sharedKey) {
    console.warn('[PandaDoc] Shared key not configured, skipping verification');
    return true; // Allow in development
  }

  const payload = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', config.sharedKey)
    .update(payload)
    .digest('hex');

  return signature === hash;
}

// ============================================
// POST /api/webhooks/pandadoc/document
// PandaDoc document status webhook
// ============================================

router.post('/document', async (req: Request, res: Response) => {
  try {
    // Log receipt immediately
    console.log('[PandaDoc] Webhook received:', req.body?.event);

    // Verify signature
    if (!verifyPandaDocSignature(req)) {
      console.warn('[PandaDoc] Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhook = req.body as PandaDocDocumentCompletedWebhook;

    // Validate webhook structure
    if (!webhook.event || !webhook.data?.id) {
      console.warn('[PandaDoc] Invalid webhook payload');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Log event type
    console.log(`[PandaDoc] Processing event: ${webhook.event} for document ${webhook.data.id}`);

    // Process webhook with pandadocService for sync tracking (PRD-206)
    const userId = webhook.data?.metadata?.userId || 'system';
    const syncResult = await pandadocService.processWebhook(userId, {
      event: webhook.event,
      data: webhook.data,
    });

    // Log sync result
    if (syncResult.processed) {
      console.log(`[PandaDoc] Sync processed, notifications: ${syncResult.notifications.length}`);
    }

    // Handle different event types for implementation service
    switch (webhook.event) {
      case 'document_state_changed':
        if (webhook.data.status === 'document.completed') {
          // All parties have signed - trigger implementation
          const result = await implementationService.processPandaDocWebhook(webhook);

          if (result.processed) {
            console.log(`[PandaDoc] Implementation initiated: ${result.projectId}`);
            return res.status(200).json({
              received: true,
              processed: true,
              projectId: result.projectId,
              syncTracked: syncResult.processed,
            });
          } else {
            console.log(`[PandaDoc] Not processed: ${result.error}`);
            return res.status(200).json({
              received: true,
              processed: false,
              reason: result.error,
              syncTracked: syncResult.processed,
            });
          }
        }

        // Track other status changes
        console.log(`[PandaDoc] Tracking status: ${webhook.data.status}`);
        return res.status(200).json({
          received: true,
          tracked: true,
          syncTracked: syncResult.processed,
        });

      case 'recipient_completed':
        // Individual recipient completed - track but don't initiate
        console.log(`[PandaDoc] Recipient completed for document ${webhook.data.id}`);
        return res.status(200).json({
          received: true,
          tracked: true,
          syncTracked: syncResult.processed,
        });

      case 'document_deleted':
      case 'document_declined':
        // Handle rejection/deletion
        console.log(`[PandaDoc] Document declined/deleted: ${webhook.data.id}`);
        return res.status(200).json({
          received: true,
          handled: true,
          syncTracked: syncResult.processed,
        });

      default:
        console.log(`[PandaDoc] Ignoring event type: ${webhook.event}`);
        return res.status(200).json({
          received: true,
          ignored: true,
          syncTracked: syncResult.processed,
        });
    }
  } catch (error) {
    console.error('[PandaDoc] Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// GET /api/webhooks/pandadoc/status
// Health check endpoint
// ============================================

router.get('/status', (req: Request, res: Response) => {
  const config = getPandaDocConfig();

  res.json({
    configured: !!config?.sharedKey,
    timestamp: new Date().toISOString(),
  });
});

export default router;
