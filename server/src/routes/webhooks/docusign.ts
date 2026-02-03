/**
 * PRD-123: DocuSign Webhook Handler
 * Processes contract signature events from DocuSign
 *
 * Endpoints:
 * - POST /api/webhooks/docusign/envelope - Envelope status change webhook
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../../config/index.js';
import {
  implementationService,
  type DocuSignEnvelopeCompletedWebhook,
} from '../../services/implementation/index.js';

const router = Router();

// ============================================
// DocuSign Webhook Configuration
// ============================================

interface DocuSignConfig {
  integrationKey: string;
  secretKey: string;
  hmacKey: string;
}

function getDocuSignConfig(): DocuSignConfig | null {
  // Would come from config/environment
  return {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || '',
    secretKey: process.env.DOCUSIGN_SECRET_KEY || '',
    hmacKey: process.env.DOCUSIGN_HMAC_KEY || '',
  };
}

// ============================================
// Webhook Verification
// ============================================

/**
 * Verify DocuSign webhook HMAC signature
 * See: https://developers.docusign.com/platform/webhooks/connect/hmac/
 */
function verifyDocuSignSignature(req: Request): boolean {
  const signature = req.headers['x-docusign-signature-1'] as string;

  if (!signature) {
    console.warn('[DocuSign] No signature header');
    return false;
  }

  const docuSignConfig = getDocuSignConfig();
  if (!docuSignConfig?.hmacKey) {
    console.warn('[DocuSign] HMAC key not configured, skipping verification');
    return true; // Allow in development
  }

  const payload = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', docuSignConfig.hmacKey)
    .update(payload)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hash)
  );
}

// ============================================
// POST /api/webhooks/docusign/envelope
// DocuSign Connect envelope status webhook
// ============================================

router.post('/envelope', async (req: Request, res: Response) => {
  try {
    // Log receipt immediately
    console.log('[DocuSign] Webhook received:', req.body?.event);

    // Verify signature
    if (!verifyDocuSignSignature(req)) {
      console.warn('[DocuSign] Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhook = req.body as DocuSignEnvelopeCompletedWebhook;

    // Validate webhook structure
    if (!webhook.event || !webhook.data?.envelopeId) {
      console.warn('[DocuSign] Invalid webhook payload');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Log event type
    console.log(`[DocuSign] Processing event: ${webhook.event} for envelope ${webhook.data.envelopeId}`);

    // Handle different event types
    switch (webhook.event) {
      case 'envelope-completed':
        // All parties have signed - trigger implementation
        const result = await implementationService.processDocuSignWebhook(webhook);

        if (result.processed) {
          console.log(`[DocuSign] Implementation initiated: ${result.projectId}`);
          return res.status(200).json({
            received: true,
            processed: true,
            projectId: result.projectId,
          });
        } else {
          console.log(`[DocuSign] Not processed: ${result.error}`);
          return res.status(200).json({
            received: true,
            processed: false,
            reason: result.error,
          });
        }

      case 'envelope-sent':
      case 'envelope-delivered':
      case 'envelope-signed':
        // Track but don't initiate implementation yet
        console.log(`[DocuSign] Tracking event: ${webhook.event}`);
        return res.status(200).json({
          received: true,
          tracked: true,
        });

      case 'envelope-declined':
      case 'envelope-voided':
        // Handle rejection/cancellation
        console.log(`[DocuSign] Contract declined/voided: ${webhook.data.envelopeId}`);
        return res.status(200).json({
          received: true,
          handled: true,
        });

      default:
        console.log(`[DocuSign] Ignoring event type: ${webhook.event}`);
        return res.status(200).json({
          received: true,
          ignored: true,
        });
    }
  } catch (error) {
    console.error('[DocuSign] Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// GET /api/webhooks/docusign/status
// Health check endpoint
// ============================================

router.get('/status', (req: Request, res: Response) => {
  const docuSignConfig = getDocuSignConfig();

  res.json({
    configured: !!docuSignConfig?.integrationKey,
    hmacEnabled: !!docuSignConfig?.hmacKey,
    timestamp: new Date().toISOString(),
  });
});

export default router;
