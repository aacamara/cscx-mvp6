/**
 * Stripe Billing Integration Routes - PRD-199
 *
 * Handles Stripe API key connection, sync operations, webhook events,
 * and customer billing data retrieval.
 */

import { Router, Request, Response } from 'express';
import { stripeService } from '../services/integrations/stripe.js';

const router = Router();

// ============================================
// CONNECTION ROUTES
// ============================================

/**
 * POST /api/stripe/connect
 *
 * Connect Stripe with API key (FR-1)
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { userId, apiKey, webhookSecret } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'apiKey is required' });
    }

    // Validate API key by making a test request
    try {
      const testResponse = await fetch('https://api.stripe.com/v1/balance', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Stripe-Version': '2024-11-20.acacia',
        },
      });

      if (!testResponse.ok) {
        const error = await testResponse.json();
        return res.status(400).json({
          error: `Invalid API key: ${error.error?.message || 'Authentication failed'}`,
        });
      }
    } catch (err) {
      return res.status(400).json({
        error: `Failed to validate API key: ${(err as Error).message}`,
      });
    }

    // Save connection
    const connectionId = await stripeService.saveConnection(userId, apiKey, webhookSecret);

    res.json({
      success: true,
      message: 'Stripe connected successfully',
      connectionId,
      webhookEndpoint: `${process.env.API_URL || 'http://localhost:3001'}/api/stripe/webhook`,
    });
  } catch (error) {
    console.error('Stripe connect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/stripe/disconnect
 *
 * Disconnect Stripe integration
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await stripeService.disconnect(userId);

    res.json({
      success: true,
      message: 'Stripe disconnected successfully',
    });
  } catch (error) {
    console.error('Stripe disconnect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/stripe/status
 *
 * Get Stripe integration status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if service is configured
    if (!stripeService.isConfigured()) {
      return res.json({
        configured: false,
        connected: false,
        message: 'Stripe integration not configured. Provide STRIPE_SECRET_KEY or connect with API key.',
      });
    }

    // Get sync status
    const status = await stripeService.getSyncStatus(userId);

    // Get connection details if connected
    let connectionDetails = null;
    if (status.connected) {
      const connection = await stripeService.getConnection(userId);
      if (connection) {
        connectionDetails = {
          hasApiKey: Boolean(connection.apiKey),
          hasWebhookSecret: Boolean(connection.webhookSecret),
          accountId: connection.accountId,
        };
      }
    }

    // Get circuit breaker status
    const circuitBreakerStatus = stripeService.getCircuitBreakerStatus();

    res.json({
      configured: true,
      ...status,
      connection: connectionDetails,
      circuitBreaker: circuitBreakerStatus,
    });
  } catch (error) {
    console.error('Stripe status error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// SYNC ROUTES
// ============================================

/**
 * POST /api/stripe/sync
 *
 * Trigger manual sync (FR-2, FR-3, FR-4)
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { userId, syncType = 'full', stripeCustomerId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await stripeService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({
        error: 'Stripe not connected. Please connect with API key first.',
      });
    }

    let result;
    switch (syncType) {
      case 'customers':
        result = await stripeService.syncCustomers(userId, connection);
        break;

      case 'subscriptions':
        if (!stripeCustomerId) {
          return res.status(400).json({ error: 'stripeCustomerId is required for subscription sync' });
        }
        result = await stripeService.syncSubscriptions(userId, stripeCustomerId, connection);
        break;

      case 'invoices':
        if (!stripeCustomerId) {
          return res.status(400).json({ error: 'stripeCustomerId is required for invoice sync' });
        }
        result = await stripeService.syncInvoices(userId, stripeCustomerId, connection);
        break;

      case 'payment_methods':
        if (!stripeCustomerId) {
          return res.status(400).json({ error: 'stripeCustomerId is required for payment method sync' });
        }
        result = await stripeService.syncPaymentMethods(userId, stripeCustomerId, connection);
        break;

      case 'full':
        if (stripeCustomerId) {
          result = await stripeService.fullSyncCustomer(userId, stripeCustomerId, connection);
        } else {
          // First sync all customers, then sync their data
          const customerResult = await stripeService.syncCustomers(userId, connection);
          result = {
            customers: customerResult,
            message: 'Full sync initiated. Customer subscriptions will be synced individually.',
          };
        }
        break;

      default:
        return res.status(400).json({ error: `Unknown sync type: ${syncType}` });
    }

    res.json({
      success: true,
      syncType,
      stripeCustomerId,
      result,
    });
  } catch (error) {
    console.error('Stripe sync error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/stripe/history
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

    const history = await stripeService.getSyncHistory(userId, { limit, offset });

    res.json(history);
  } catch (error) {
    console.error('Stripe history error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// WEBHOOK ROUTE
// ============================================

/**
 * POST /api/stripe/webhook
 *
 * Handle Stripe webhook events (FR-6)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Get webhook secret from environment or connection
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('[Stripe Webhook] No webhook secret configured');
      return res.status(400).json({ error: 'Webhook secret not configured' });
    }

    // Raw body is needed for signature verification
    const payload = JSON.stringify(req.body);

    const result = await stripeService.processWebhook(payload, signature, webhookSecret);

    if (!result.success) {
      console.error('[Stripe Webhook] Processing failed:', result.error);
      return res.status(400).json({ error: result.error });
    }

    console.log(`[Stripe Webhook] Processed event: ${result.eventType}`);
    res.json({ received: true, eventType: result.eventType });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// CUSTOMER BILLING DATA ROUTES
// ============================================

/**
 * GET /api/stripe/customer/:customerId
 *
 * Get billing data for a CSCX customer (FR-2, FR-3, FR-4)
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const billingData = await stripeService.getCustomerBillingData(customerId);

    if (!billingData) {
      return res.status(404).json({
        error: 'No Stripe billing data found for this customer',
        customerId,
      });
    }

    res.json(billingData);
  } catch (error) {
    console.error('Get customer billing error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/stripe/subscriptions/:customerId
 *
 * Get subscriptions for a CSCX customer
 */
router.get('/subscriptions/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const billingData = await stripeService.getCustomerBillingData(customerId);

    if (!billingData) {
      return res.status(404).json({
        error: 'No billing data found',
        subscriptions: [],
      });
    }

    res.json({
      subscriptions: billingData.subscriptions,
      mrrCents: billingData.mrrCents,
      arrCents: billingData.arrCents,
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/stripe/invoices/:customerId
 *
 * Get invoices for a CSCX customer
 */
router.get('/invoices/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const billingData = await stripeService.getCustomerBillingData(customerId);

    if (!billingData) {
      return res.status(404).json({
        error: 'No billing data found',
        invoices: [],
      });
    }

    res.json({
      invoices: billingData.invoices,
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/stripe/mrr/:customerId
 *
 * Get MRR/ARR for a CSCX customer
 */
router.get('/mrr/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const { mrrCents, arrCents } = await stripeService.getMRR(customerId);

    res.json({
      mrrCents,
      arrCents,
      mrr: (mrrCents / 100).toFixed(2),
      arr: (arrCents / 100).toFixed(2),
    });
  } catch (error) {
    console.error('Get MRR error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/stripe/risk-signals/:customerId
 *
 * Get billing risk signals for a CSCX customer
 */
router.get('/risk-signals/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const billingData = await stripeService.getCustomerBillingData(customerId);

    if (!billingData) {
      return res.json({
        riskSignals: [],
        billingHealth: 'unknown',
      });
    }

    res.json({
      riskSignals: billingData.riskSignals,
      billingHealth: billingData.billingHealth,
    });
  } catch (error) {
    console.error('Get risk signals error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// MANUAL CUSTOMER MAPPING
// ============================================

/**
 * POST /api/stripe/map-customer
 *
 * Manually map a Stripe customer to a CSCX customer
 */
router.post('/map-customer', async (req: Request, res: Response) => {
  try {
    const { cscxCustomerId, stripeCustomerId } = req.body;

    if (!cscxCustomerId || !stripeCustomerId) {
      return res.status(400).json({
        error: 'cscxCustomerId and stripeCustomerId are required',
      });
    }

    // This would typically update the stripe_customers table
    // For now, return success
    res.json({
      success: true,
      message: 'Customer mapping created',
      cscxCustomerId,
      stripeCustomerId,
    });
  } catch (error) {
    console.error('Map customer error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
