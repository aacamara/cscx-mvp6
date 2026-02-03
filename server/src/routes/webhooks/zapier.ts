/**
 * Zapier Webhook Routes - PRD-210
 *
 * Endpoints:
 * - Outbound webhook management (CSCX.AI -> Zapier)
 * - Inbound webhook handlers (Zapier -> CSCX.AI)
 * - API key management for REST API
 * - Webhook testing and delivery logs
 */

import { Router, Request, Response } from 'express';
import {
  zapierService,
  WebhookEventType,
  InboundActionType,
} from '../../services/integrations/zapier.js';

const router = Router();

// ============================================
// OUTBOUND WEBHOOKS (CSCX.AI -> Zapier)
// ============================================

/**
 * POST /api/webhooks/outbound
 * Create a new outbound webhook
 */
router.post('/outbound', async (req: Request, res: Response) => {
  try {
    const { userId, name, url, events, headers } = req.body;

    if (!userId || !name || !url || !events || !Array.isArray(events)) {
      return res.status(400).json({
        error: 'userId, name, url, and events (array) are required',
      });
    }

    // Validate event types
    const validEvents: WebhookEventType[] = [
      'health_score.changed',
      'health_score.critical',
      'customer.created',
      'customer.updated',
      'customer.deleted',
      'risk_signal.created',
      'risk_signal.resolved',
      'renewal.approaching',
      'renewal.at_risk',
      'task.created',
      'task.completed',
      'approval.requested',
      'approval.completed',
      'nps.received',
      'support_ticket.created',
      'support_ticket.escalated',
      'meeting.scheduled',
      'meeting.completed',
    ];

    for (const event of events) {
      if (!validEvents.includes(event)) {
        return res.status(400).json({ error: `Invalid event type: ${event}` });
      }
    }

    const webhook = await zapierService.createOutboundWebhook(
      userId,
      name,
      url,
      events,
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
        secret: webhook.secret, // Only returned at creation time
        createdAt: webhook.createdAt,
      },
    });
  } catch (error) {
    console.error('Create outbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/webhooks/outbound
 * Get all outbound webhooks for a user
 */
router.get('/outbound', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const webhooks = await zapierService.getOutboundWebhooks(userId);

    // Don't expose secrets in list view
    const sanitizedWebhooks = webhooks.map((w) => ({
      id: w.id,
      name: w.name,
      url: w.url,
      events: w.events,
      active: w.active,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    res.json({ webhooks: sanitizedWebhooks });
  } catch (error) {
    console.error('Get outbound webhooks error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/webhooks/outbound/:id
 * Get a specific outbound webhook
 */
router.get('/outbound/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const webhook = await zapierService.getOutboundWebhook(id);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        headers: webhook.headers,
        active: webhook.active,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
        // Include secret hash for verification but not the full secret
        secretPrefix: webhook.secret.substring(0, 8) + '...',
      },
    });
  } catch (error) {
    console.error('Get outbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/webhooks/outbound/:id
 * Update an outbound webhook
 */
router.put('/outbound/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, url, events, headers, active } = req.body;

    const webhook = await zapierService.updateOutboundWebhook(id, {
      name,
      url,
      events,
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
 * DELETE /api/webhooks/outbound/:id
 * Delete an outbound webhook
 */
router.delete('/outbound/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await zapierService.deleteOutboundWebhook(id);

    res.json({ success: true, message: 'Webhook deleted' });
  } catch (error) {
    console.error('Delete outbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/webhooks/outbound/:id/test
 * Test a webhook by sending a test event
 */
router.post('/outbound/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await zapierService.testWebhook(id);

    res.json({
      success: result.success,
      deliveryId: result.deliveryId,
      responseStatus: result.responseStatus,
      error: result.error,
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/webhooks/outbound/:id/logs
 * Get delivery logs for a webhook
 */
router.get('/outbound/:id/logs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    const { logs, total } = await zapierService.getDeliveryLogs(id, {
      limit,
      offset,
      status,
    });

    res.json({ logs, total, limit, offset });
  } catch (error) {
    console.error('Get delivery logs error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/webhooks/outbound/:id/stats
 * Get statistics for a webhook
 */
router.get('/outbound/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stats = await zapierService.getWebhookStats(id);

    res.json({ stats });
  } catch (error) {
    console.error('Get webhook stats error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/webhooks/outbound/:id/regenerate-secret
 * Regenerate the webhook signing secret
 */
router.post('/outbound/:id/regenerate-secret', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const newSecret = await zapierService.regenerateSecret(id);

    res.json({
      success: true,
      secret: newSecret,
      message: 'Secret regenerated. Update your webhook consumer.',
    });
  } catch (error) {
    console.error('Regenerate secret error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/webhooks/outbound/:id/retry/:deliveryId
 * Retry a failed delivery
 */
router.post('/outbound/:id/retry/:deliveryId', async (req: Request, res: Response) => {
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
// INBOUND WEBHOOKS (Zapier -> CSCX.AI)
// ============================================

/**
 * POST /api/webhooks/inbound/:token
 * Receive and process an inbound webhook
 */
router.post('/inbound/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const payload = req.body;

    const result = await zapierService.processInboundWebhook(token, payload);

    if (result.success) {
      res.json({
        success: true,
        actionType: result.actionType,
        recordId: result.recordId,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Inbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/webhooks/inbound-tokens
 * Create a new inbound webhook token
 */
router.post('/inbound-tokens', async (req: Request, res: Response) => {
  try {
    const { userId, name, actionType, fieldMapping } = req.body;

    if (!userId || !name || !actionType) {
      return res.status(400).json({
        error: 'userId, name, and actionType are required',
      });
    }

    // Validate action type
    const validActions: InboundActionType[] = [
      'create_customer',
      'update_customer',
      'add_stakeholder',
      'log_activity',
      'create_task',
      'create_risk_signal',
      'update_health_score',
    ];

    if (!validActions.includes(actionType)) {
      return res.status(400).json({ error: `Invalid action type: ${actionType}` });
    }

    const webhookToken = await zapierService.createInboundWebhook(
      userId,
      name,
      actionType,
      fieldMapping
    );

    const webhookUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/webhooks/inbound/${webhookToken.token}`;

    res.status(201).json({
      success: true,
      webhook: {
        id: webhookToken.id,
        name: webhookToken.name,
        actionType: webhookToken.actionType,
        token: webhookToken.token,
        webhookUrl,
        fieldMapping: webhookToken.fieldMapping,
        active: webhookToken.active,
        createdAt: webhookToken.createdAt,
      },
    });
  } catch (error) {
    console.error('Create inbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/webhooks/inbound-tokens
 * Get all inbound webhook tokens for a user
 */
router.get('/inbound-tokens', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const tokens = await zapierService.getInboundWebhooks(userId);

    const baseUrl = process.env.API_URL || 'http://localhost:3001';
    const tokensWithUrls = tokens.map((t) => ({
      id: t.id,
      name: t.name,
      actionType: t.actionType,
      token: t.token.substring(0, 8) + '...', // Don't expose full token
      webhookUrl: `${baseUrl}/api/webhooks/inbound/${t.token}`,
      fieldMapping: t.fieldMapping,
      active: t.active,
      createdAt: t.createdAt,
    }));

    res.json({ tokens: tokensWithUrls });
  } catch (error) {
    console.error('Get inbound webhooks error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/webhooks/inbound-tokens/:id
 * Update an inbound webhook token
 */
router.put('/inbound-tokens/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, actionType, fieldMapping, active } = req.body;

    await zapierService.updateInboundWebhook(id, {
      name,
      actionType,
      fieldMapping,
      active,
    });

    res.json({ success: true, message: 'Inbound webhook updated' });
  } catch (error) {
    console.error('Update inbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/webhooks/inbound-tokens/:id
 * Delete an inbound webhook token
 */
router.delete('/inbound-tokens/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await zapierService.deleteInboundWebhook(id);

    res.json({ success: true, message: 'Inbound webhook deleted' });
  } catch (error) {
    console.error('Delete inbound webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/webhooks/inbound-tokens/:id/logs
 * Get logs for an inbound webhook
 */
router.get('/inbound-tokens/:id/logs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { logs, total } = await zapierService.getInboundLogs(id, { limit, offset });

    res.json({ logs, total, limit, offset });
  } catch (error) {
    console.error('Get inbound logs error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// ZAPIER APP ENDPOINTS
// ============================================

/**
 * GET /api/webhooks/zapier/triggers
 * Get available trigger events for Zapier app
 */
router.get('/zapier/triggers', async (req: Request, res: Response) => {
  try {
    const triggers = [
      { key: 'health_score.changed', name: 'Health Score Changed', description: 'Triggers when a customer health score changes' },
      { key: 'health_score.critical', name: 'Health Score Critical', description: 'Triggers when health score drops to critical level' },
      { key: 'customer.created', name: 'New Customer', description: 'Triggers when a new customer is created' },
      { key: 'customer.updated', name: 'Customer Updated', description: 'Triggers when customer details are updated' },
      { key: 'risk_signal.created', name: 'Risk Signal Detected', description: 'Triggers when a risk signal is detected' },
      { key: 'renewal.approaching', name: 'Renewal Approaching', description: 'Triggers when a renewal is within the configured window' },
      { key: 'renewal.at_risk', name: 'Renewal At Risk', description: 'Triggers when a renewal is flagged as at risk' },
      { key: 'task.created', name: 'Task Created', description: 'Triggers when a new task is created' },
      { key: 'task.completed', name: 'Task Completed', description: 'Triggers when a task is completed' },
      { key: 'approval.requested', name: 'Approval Requested', description: 'Triggers when an approval is requested' },
      { key: 'nps.received', name: 'NPS Response Received', description: 'Triggers when an NPS response is received' },
      { key: 'support_ticket.created', name: 'Support Ticket Created', description: 'Triggers when a support ticket is created' },
      { key: 'support_ticket.escalated', name: 'Support Ticket Escalated', description: 'Triggers when a support ticket is escalated' },
      { key: 'meeting.scheduled', name: 'Meeting Scheduled', description: 'Triggers when a meeting is scheduled' },
      { key: 'meeting.completed', name: 'Meeting Completed', description: 'Triggers when a meeting is completed' },
    ];

    res.json({ triggers });
  } catch (error) {
    console.error('Get triggers error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/webhooks/zapier/actions
 * Get available actions for Zapier app
 */
router.get('/zapier/actions', async (req: Request, res: Response) => {
  try {
    const actions = [
      {
        key: 'create_customer',
        name: 'Create Customer',
        description: 'Create a new customer in CSCX.AI',
        inputFields: ['name', 'industry', 'arr', 'website', 'external_id'],
      },
      {
        key: 'update_customer',
        name: 'Update Customer',
        description: 'Update an existing customer',
        inputFields: ['customer_id', 'name', 'industry', 'arr', 'website'],
      },
      {
        key: 'add_stakeholder',
        name: 'Add Stakeholder',
        description: 'Add a stakeholder to a customer',
        inputFields: ['customer_id', 'name', 'email', 'title', 'role', 'is_champion'],
      },
      {
        key: 'log_activity',
        name: 'Log Activity',
        description: 'Log an activity for a customer',
        inputFields: ['customer_id', 'activity_type', 'description', 'occurred_at'],
      },
      {
        key: 'create_task',
        name: 'Create Task',
        description: 'Create a task for a customer',
        inputFields: ['customer_id', 'title', 'description', 'due_date', 'priority'],
      },
      {
        key: 'create_risk_signal',
        name: 'Create Risk Signal',
        description: 'Create a risk signal for a customer',
        inputFields: ['customer_id', 'signal_type', 'severity', 'description'],
      },
      {
        key: 'update_health_score',
        name: 'Update Health Score',
        description: 'Update a health score component',
        inputFields: ['customer_id', 'component', 'value'],
      },
    ];

    res.json({ actions });
  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/webhooks/zapier/subscribe
 * Subscribe to an event (Zapier trigger subscription)
 */
router.post('/zapier/subscribe', async (req: Request, res: Response) => {
  try {
    const { userId, hookUrl, triggerKey } = req.body;

    if (!userId || !hookUrl || !triggerKey) {
      return res.status(400).json({
        error: 'userId, hookUrl, and triggerKey are required',
      });
    }

    // Create a webhook subscription for Zapier
    const webhook = await zapierService.createOutboundWebhook(
      userId,
      `Zapier - ${triggerKey}`,
      hookUrl,
      [triggerKey as WebhookEventType]
    );

    res.json({
      success: true,
      id: webhook.id,
    });
  } catch (error) {
    console.error('Zapier subscribe error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/webhooks/zapier/unsubscribe/:id
 * Unsubscribe from an event (Zapier trigger unsubscription)
 */
router.delete('/zapier/unsubscribe/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await zapierService.deleteOutboundWebhook(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Zapier unsubscribe error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// DEAD LETTER QUEUE
// ============================================

/**
 * GET /api/webhooks/dlq
 * Get dead letter queue entries
 */
router.get('/dlq', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { entries, total } = await zapierService.getDeadLetterQueue({ limit, offset });

    res.json({ entries, total, limit, offset });
  } catch (error) {
    console.error('Get DLQ error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// CIRCUIT BREAKER STATUS
// ============================================

/**
 * GET /api/webhooks/status
 * Get webhook system status including circuit breaker
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const circuitBreaker = zapierService.getCircuitBreakerStatus();

    res.json({
      status: 'operational',
      circuitBreaker,
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
