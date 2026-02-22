/**
 * Zapier Webhook Integration Routes - PRD-210
 *
 * Handles webhook configuration and delivery for Zapier integration.
 * Implements all endpoints for:
 * - Outbound webhooks (CSCX.AI -> Zapier) (FR-1)
 * - Inbound webhooks (Zapier -> CSCX.AI) (FR-2)
 * - Zapier app configuration (FR-3)
 * - Webhook management and monitoring (FR-4)
 */

import { Router, Request, Response } from 'express';
import { zapierService, WebhookEventType, InboundActionType } from '../services/integrations/zapier.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// OUTBOUND WEBHOOK ROUTES
// ============================================

/**
 * POST /api/zapier/webhooks/outbound
 *
 * Create a new outbound webhook (FR-1)
 */
router.post('/webhooks/outbound', async (req: Request, res: Response) => {
  try {
    const { userId, name, url, events, headers } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!name || !url || !events) {
      return res.status(400).json({ error: 'name, url, and events are required' });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events must be a non-empty array' });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const webhook = await zapierService.createOutboundWebhook(
      userId,
      name,
      url,
      events as WebhookEventType[],
      headers
    );

    res.status(201).json({
      success: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        secret: webhook.secret,
        createdAt: webhook.createdAt,
      },
    });
  } catch (error) {
    console.error('Create outbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zapier/webhooks/outbound
 *
 * List all outbound webhooks for a user (FR-4)
 */
router.get('/webhooks/outbound', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const webhooks = await zapierService.getOutboundWebhooks(userId);

    res.json({
      success: true,
      webhooks: webhooks.map((w) => ({
        id: w.id,
        name: w.name,
        url: w.url,
        events: w.events,
        active: w.active,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Get outbound webhooks error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/zapier/webhooks/outbound/:id
 *
 * Update an outbound webhook (FR-4)
 */
router.put('/webhooks/outbound/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, url, events, headers, active } = req.body;

    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }

    const webhook = await zapierService.updateOutboundWebhook(id, {
      name,
      url,
      events: events as WebhookEventType[],
      headers,
      active,
    });

    res.json({
      success: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        updatedAt: webhook.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update outbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/zapier/webhooks/outbound/:id
 *
 * Delete an outbound webhook (FR-4)
 */
router.delete('/webhooks/outbound/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await zapierService.deleteOutboundWebhook(id);

    res.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error) {
    console.error('Delete outbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/zapier/webhooks/outbound/:id/test
 *
 * Send a test webhook delivery (FR-4)
 */
router.post('/webhooks/outbound/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await zapierService.testWebhook(id);

    res.json({
      success: result.success,
      deliveryId: result.deliveryId,
      error: result.error,
      responseStatus: result.responseStatus,
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zapier/webhooks/outbound/:id/logs
 *
 * Get delivery logs for a webhook (FR-4)
 */
router.get('/webhooks/outbound/:id/logs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset, status } = req.query;

    const result = await zapierService.getDeliveryLogs(id, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      status: status as string,
    });

    res.json({
      success: true,
      logs: result.logs,
      total: result.total,
    });
  } catch (error) {
    console.error('Get delivery logs error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zapier/webhooks/outbound/:id/stats
 *
 * Get statistics for a webhook (FR-4)
 */
router.get('/webhooks/outbound/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stats = await zapierService.getWebhookStats(id);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Get webhook stats error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/zapier/webhooks/outbound/:id/regenerate-secret
 *
 * Regenerate the webhook signing secret (NFR-3)
 */
router.post('/webhooks/outbound/:id/regenerate-secret', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const newSecret = await zapierService.regenerateSecret(id);

    res.json({
      success: true,
      secret: newSecret,
      message: 'Webhook secret regenerated. Update your Zapier configuration.',
    });
  } catch (error) {
    console.error('Regenerate secret error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/zapier/webhooks/outbound/:id/retry/:deliveryId
 *
 * Retry a failed delivery (FR-4)
 */
router.post('/webhooks/outbound/:id/retry/:deliveryId', async (req: Request, res: Response) => {
  try {
    const { deliveryId } = req.params;

    const result = await zapierService.retryDelivery(deliveryId);

    res.json({
      success: result.success,
      deliveryId: result.deliveryId,
      error: result.error,
    });
  } catch (error) {
    console.error('Retry delivery error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// INBOUND WEBHOOK ROUTES
// ============================================

/**
 * POST /api/zapier/webhooks/inbound
 *
 * Create a new inbound webhook token (FR-2)
 */
router.post('/webhooks/inbound', async (req: Request, res: Response) => {
  try {
    const { userId, name, actionType, fieldMapping } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!name || !actionType) {
      return res.status(400).json({ error: 'name and actionType are required' });
    }

    const validActionTypes: InboundActionType[] = [
      'create_customer',
      'update_customer',
      'add_stakeholder',
      'log_activity',
      'create_task',
      'create_risk_signal',
      'update_health_score',
    ];

    if (!validActionTypes.includes(actionType)) {
      return res.status(400).json({
        error: `Invalid actionType. Must be one of: ${validActionTypes.join(', ')}`,
      });
    }

    const webhook = await zapierService.createInboundWebhook(
      userId,
      name,
      actionType as InboundActionType,
      fieldMapping
    );

    const baseUrl = process.env.API_URL || 'http://localhost:3001';

    res.status(201).json({
      success: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        token: webhook.token,
        actionType: webhook.actionType,
        fieldMapping: webhook.fieldMapping,
        webhookUrl: `${baseUrl}/api/webhooks/inbound/${webhook.token}`,
        active: webhook.active,
        createdAt: webhook.createdAt,
      },
    });
  } catch (error) {
    console.error('Create inbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zapier/webhooks/inbound
 *
 * List all inbound webhook tokens for a user (FR-4)
 */
router.get('/webhooks/inbound', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const webhooks = await zapierService.getInboundWebhooks(userId);
    const baseUrl = process.env.API_URL || 'http://localhost:3001';

    res.json({
      success: true,
      webhooks: webhooks.map((w) => ({
        id: w.id,
        name: w.name,
        actionType: w.actionType,
        fieldMapping: w.fieldMapping,
        webhookUrl: `${baseUrl}/api/webhooks/inbound/${w.token}`,
        active: w.active,
        createdAt: w.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get inbound webhooks error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/zapier/webhooks/inbound/:id
 *
 * Update an inbound webhook (FR-4)
 */
router.put('/webhooks/inbound/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, actionType, fieldMapping, active } = req.body;

    await zapierService.updateInboundWebhook(id, {
      name,
      actionType: actionType as InboundActionType,
      fieldMapping,
      active,
    });

    res.json({
      success: true,
      message: 'Inbound webhook updated successfully',
    });
  } catch (error) {
    console.error('Update inbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/zapier/webhooks/inbound/:id
 *
 * Delete an inbound webhook (FR-4)
 */
router.delete('/webhooks/inbound/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await zapierService.deleteInboundWebhook(id);

    res.json({
      success: true,
      message: 'Inbound webhook deleted successfully',
    });
  } catch (error) {
    console.error('Delete inbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zapier/webhooks/inbound/:id/logs
 *
 * Get logs for an inbound webhook (FR-4)
 */
router.get('/webhooks/inbound/:id/logs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset } = req.query;

    const result = await zapierService.getInboundLogs(id, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      logs: result.logs,
      total: result.total,
    });
  } catch (error) {
    console.error('Get inbound logs error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// INBOUND WEBHOOK HANDLER
// ============================================

/**
 * POST /api/webhooks/inbound/:token
 *
 * Handle incoming webhook from Zapier (FR-2, FR-7)
 */
router.post('/inbound/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const result = await zapierService.processInboundWebhook(token, payload);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        actionType: result.actionType,
        error: result.error,
      });
    }

    res.json({
      success: true,
      actionType: result.actionType,
      recordId: result.recordId,
    });
  } catch (error) {
    console.error('Process inbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// ZAPIER APP ENDPOINTS
// ============================================

/**
 * POST /api/zapier/customers
 *
 * Create or update customer from Zapier (FR-2)
 */
router.post('/customers', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const payload = req.body;

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const webhook = await zapierService.getInboundWebhookByToken(apiKey);
    if (!webhook) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const actionType = payload.customer_id ? 'update_customer' : 'create_customer';
    const result = await zapierService.processInboundWebhook(apiKey, { ...payload, _actionType: actionType });

    res.json({
      success: result.success,
      customerId: result.recordId,
      error: result.error,
    });
  } catch (error) {
    console.error('Zapier customer endpoint error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/zapier/activities
 *
 * Log activity from Zapier (FR-2)
 */
router.post('/activities', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const payload = req.body;

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const webhook = await zapierService.getInboundWebhookByToken(apiKey);
    if (!webhook) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await zapierService.processInboundWebhook(apiKey, { ...payload, _actionType: 'log_activity' });

    res.json({
      success: result.success,
      activityId: result.recordId,
      error: result.error,
    });
  } catch (error) {
    console.error('Zapier activities endpoint error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/zapier/tasks
 *
 * Create task from Zapier (FR-2)
 */
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const payload = req.body;

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const webhook = await zapierService.getInboundWebhookByToken(apiKey);
    if (!webhook) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await zapierService.processInboundWebhook(apiKey, { ...payload, _actionType: 'create_task' });

    res.json({
      success: result.success,
      taskId: result.recordId,
      error: result.error,
    });
  } catch (error) {
    console.error('Zapier tasks endpoint error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/zapier/signals
 *
 * Create risk signal from Zapier (FR-2)
 */
router.post('/signals', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const payload = req.body;

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const webhook = await zapierService.getInboundWebhookByToken(apiKey);
    if (!webhook) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await zapierService.processInboundWebhook(apiKey, { ...payload, _actionType: 'create_risk_signal' });

    res.json({
      success: result.success,
      signalId: result.recordId,
      error: result.error,
    });
  } catch (error) {
    console.error('Zapier signals endpoint error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zapier/triggers
 *
 * List available trigger events for Zapier app (FR-3)
 */
router.get('/triggers', async (_req: Request, res: Response) => {
  try {
    const triggers = [
      { id: 'health_score.changed', name: 'Health Score Changed', description: 'Triggers when a customer health score changes' },
      { id: 'health_score.critical', name: 'Health Score Critical', description: 'Triggers when health score drops below critical threshold' },
      { id: 'customer.created', name: 'Customer Created', description: 'Triggers when a new customer is added' },
      { id: 'customer.updated', name: 'Customer Updated', description: 'Triggers when customer data is modified' },
      { id: 'risk_signal.created', name: 'Risk Signal Detected', description: 'Triggers when a new risk signal is detected' },
      { id: 'risk_signal.resolved', name: 'Risk Signal Resolved', description: 'Triggers when a risk signal is resolved' },
      { id: 'renewal.approaching', name: 'Renewal Approaching', description: 'Triggers when a renewal date is approaching' },
      { id: 'renewal.at_risk', name: 'Renewal At Risk', description: 'Triggers when a renewal is flagged as at-risk' },
      { id: 'task.created', name: 'Task Created', description: 'Triggers when a new task is created' },
      { id: 'task.completed', name: 'Task Completed', description: 'Triggers when a task is completed' },
      { id: 'approval.requested', name: 'Approval Requested', description: 'Triggers when an approval is requested' },
      { id: 'approval.completed', name: 'Approval Completed', description: 'Triggers when an approval is granted or denied' },
      { id: 'nps.received', name: 'NPS Response Received', description: 'Triggers when an NPS response is received' },
      { id: 'support_ticket.created', name: 'Support Ticket Created', description: 'Triggers when a support ticket is logged' },
      { id: 'support_ticket.escalated', name: 'Support Ticket Escalated', description: 'Triggers when a ticket is escalated' },
      { id: 'meeting.scheduled', name: 'Meeting Scheduled', description: 'Triggers when a meeting is scheduled' },
      { id: 'meeting.completed', name: 'Meeting Completed', description: 'Triggers when a meeting is completed' },
    ];

    res.json({ success: true, triggers });
  } catch (error) {
    console.error('Get triggers error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zapier/actions
 *
 * List available actions for Zapier app (FR-3)
 */
router.get('/actions', async (_req: Request, res: Response) => {
  try {
    const actions = [
      { id: 'create_customer', name: 'Create Customer', description: 'Create a new customer in CSCX.AI' },
      { id: 'update_customer', name: 'Update Customer', description: 'Update an existing customer' },
      { id: 'add_stakeholder', name: 'Add Stakeholder', description: 'Add a stakeholder to a customer' },
      { id: 'log_activity', name: 'Log Activity', description: 'Log an activity for a customer' },
      { id: 'create_task', name: 'Create Task', description: 'Create a task for a customer' },
      { id: 'create_risk_signal', name: 'Create Risk Signal', description: 'Create a risk signal for a customer' },
      { id: 'update_health_score', name: 'Update Health Score', description: 'Update a customer health score component' },
    ];

    res.json({ success: true, actions });
  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/zapier/subscribe
 *
 * Subscribe to webhook events (for Zapier app integration) (FR-3)
 */
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { userId, hookUrl, event } = req.body;

    if (!userId || !hookUrl || !event) {
      return res.status(400).json({ error: 'userId, hookUrl, and event are required' });
    }

    const webhook = await zapierService.createOutboundWebhook(
      userId,
      `Zapier - ${event}`,
      hookUrl,
      [event as WebhookEventType]
    );

    res.json({
      success: true,
      subscriptionId: webhook.id,
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/zapier/unsubscribe/:id
 *
 * Unsubscribe from webhook events (for Zapier app integration) (FR-3)
 */
router.delete('/unsubscribe/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await zapierService.deleteOutboundWebhook(id);

    res.json({
      success: true,
      message: 'Unsubscribed successfully',
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zapier/status
 *
 * Get Zapier integration status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const outboundWebhooks = await zapierService.getOutboundWebhooks(userId);
    const inboundWebhooks = await zapierService.getInboundWebhooks(userId);
    const circuitBreaker = zapierService.getCircuitBreakerStatus();

    res.json({
      success: true,
      configured: zapierService.isConfigured(),
      outbound: {
        count: outboundWebhooks.length,
        active: outboundWebhooks.filter((w) => w.active).length,
      },
      inbound: {
        count: inboundWebhooks.length,
        active: inboundWebhooks.filter((w) => w.active).length,
      },
      circuitBreaker,
    });
  } catch (error) {
    console.error('Get Zapier status error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zapier/dlq
 *
 * Get dead letter queue entries (FR-4)
 */
router.get('/dlq', async (req: Request, res: Response) => {
  try {
    const { limit, offset } = req.query;

    const result = await zapierService.getDeadLetterQueue({
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      entries: result.entries,
      total: result.total,
    });
  } catch (error) {
    console.error('Get DLQ error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
