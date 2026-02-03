/**
 * PRD-123: Salesforce Webhook Handler
 * Processes opportunity closed-won events from Salesforce
 *
 * Endpoints:
 * - POST /api/webhooks/salesforce/opportunity - Opportunity stage change webhook
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  implementationService,
  type SalesforceOpportunityWebhook,
} from '../../services/implementation/index.js';

const router = Router();

// ============================================
// Salesforce Webhook Configuration
// ============================================

function getSalesforceConfig(): { webhookSecret: string } | null {
  return {
    webhookSecret: process.env.SALESFORCE_WEBHOOK_SECRET || '',
  };
}

// ============================================
// Webhook Verification
// ============================================

/**
 * Verify Salesforce Platform Events / Outbound Message signature
 */
function verifySalesforceSignature(req: Request): boolean {
  const signature = req.headers['x-salesforce-signature'] as string;

  if (!signature) {
    // Salesforce may not always send signature depending on configuration
    const config = getSalesforceConfig();
    if (!config?.webhookSecret) {
      console.warn('[Salesforce] No signature header and no secret configured');
      return true; // Allow in development
    }
    return false;
  }

  const config = getSalesforceConfig();
  if (!config?.webhookSecret) {
    console.warn('[Salesforce] Webhook secret not configured');
    return true;
  }

  const payload = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(payload)
    .digest('hex');

  return signature === hash;
}

// ============================================
// POST /api/webhooks/salesforce/opportunity
// Salesforce opportunity stage change webhook
// ============================================

router.post('/opportunity', async (req: Request, res: Response) => {
  try {
    // Log receipt immediately
    console.log('[Salesforce] Webhook received:', req.body?.event);

    // Verify signature
    if (!verifySalesforceSignature(req)) {
      console.warn('[Salesforce] Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhook = req.body as SalesforceOpportunityWebhook;

    // Validate webhook structure
    if (!webhook.event || !webhook.data?.opportunityId) {
      console.warn('[Salesforce] Invalid webhook payload');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Log event type
    console.log(
      `[Salesforce] Processing event: ${webhook.event} for opportunity ${webhook.data.opportunityId}`
    );

    // Handle different event types
    switch (webhook.event) {
      case 'opportunity_closed_won':
        // Opportunity closed-won - trigger implementation
        const result = await implementationService.processSalesforceWebhook(webhook);

        if (result.processed) {
          console.log(`[Salesforce] Implementation initiated: ${result.projectId}`);
          return res.status(200).json({
            received: true,
            processed: true,
            projectId: result.projectId,
          });
        } else {
          console.log(`[Salesforce] Not processed: ${result.error}`);
          return res.status(200).json({
            received: true,
            processed: false,
            reason: result.error,
          });
        }

      case 'opportunity_stage_change':
        // Track stage changes
        if (webhook.data.stage === 'Closed Won') {
          // Should be handled by closed_won event, but handle here as fallback
          const stageResult = await implementationService.processSalesforceWebhook({
            ...webhook,
            event: 'opportunity_closed_won',
          });

          return res.status(200).json({
            received: true,
            processed: stageResult.processed,
            projectId: stageResult.projectId,
          });
        }

        // Track other stage changes
        console.log(`[Salesforce] Tracking stage: ${webhook.data.stage}`);
        return res.status(200).json({
          received: true,
          tracked: true,
        });

      default:
        console.log(`[Salesforce] Ignoring event type: ${webhook.event}`);
        return res.status(200).json({
          received: true,
          ignored: true,
        });
    }
  } catch (error) {
    console.error('[Salesforce] Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// POST /api/webhooks/salesforce/contract
// Salesforce contract activated webhook
// ============================================

router.post('/contract', async (req: Request, res: Response) => {
  try {
    console.log('[Salesforce] Contract webhook received');

    if (!verifySalesforceSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { contractId, accountId, status } = req.body;

    if (status !== 'Activated') {
      return res.status(200).json({ received: true, ignored: true });
    }

    // Handle activated contract - may trigger implementation
    console.log(`[Salesforce] Contract activated: ${contractId} for account ${accountId}`);

    // Would integrate with implementation service here
    return res.status(200).json({
      received: true,
      tracked: true,
    });
  } catch (error) {
    console.error('[Salesforce] Contract webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// GET /api/webhooks/salesforce/status
// Health check endpoint
// ============================================

router.get('/status', (req: Request, res: Response) => {
  const config = getSalesforceConfig();

  res.json({
    configured: !!config?.webhookSecret,
    timestamp: new Date().toISOString(),
  });
});

export default router;
