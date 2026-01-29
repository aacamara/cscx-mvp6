/**
 * Trigger Routes
 * API endpoints for trigger management and event processing
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { triggerEngine } from '../triggers/engine.js';
import type { CustomerEvent } from '../triggers/index.js';

const router = Router();
const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// Trigger Templates
// ============================================

/**
 * GET /api/triggers
 * List all triggers
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { enabled, type, customerId } = req.query;

    let query = supabase
      .from('triggers')
      .select('*')
      .order('name');

    if (enabled !== undefined) {
      query = query.eq('enabled', enabled === 'true');
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (customerId) {
      query = query.or(`customer_id.eq.${customerId},customer_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ triggers: data });
  } catch (error) {
    console.error('Error listing triggers:', error);
    res.status(500).json({ error: 'Failed to list triggers' });
  }
});

/**
 * GET /api/triggers/:triggerId
 * Get trigger details
 */
router.get('/:triggerId', async (req: Request, res: Response) => {
  try {
    const { triggerId } = req.params;

    const { data, error } = await supabase
      .from('triggers')
      .select('*')
      .eq('id', triggerId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    res.json({ trigger: data });
  } catch (error) {
    console.error('Error getting trigger:', error);
    res.status(500).json({ error: 'Failed to get trigger' });
  }
});

/**
 * POST /api/triggers
 * Create a new trigger
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'system';
    const {
      name,
      description,
      type,
      conditions,
      actions,
      customerId,
      priority,
      cooldownMinutes,
      dailyLimit,
      metadata,
    } = req.body;

    if (!name || !type || !conditions || !actions) {
      return res.status(400).json({
        error: 'name, type, conditions, and actions are required',
      });
    }

    // Validate conditions using the trigger engine
    for (const condition of conditions) {
      const validation = await triggerEngine.validateCondition(condition);
      if (!validation.valid) {
        return res.status(400).json({
          error: `Invalid condition: ${validation.error}`,
        });
      }
    }

    const { data, error } = await supabase
      .from('triggers')
      .insert({
        name,
        description,
        type,
        conditions: JSON.stringify(conditions),
        actions: JSON.stringify(actions),
        customer_id: customerId || null,
        priority: priority || 0,
        cooldown_minutes: cooldownMinutes || 60,
        daily_limit: dailyLimit || 10,
        enabled: true,
        created_by: userId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ trigger: data });
  } catch (error) {
    console.error('Error creating trigger:', error);
    res.status(500).json({ error: 'Failed to create trigger' });
  }
});

/**
 * PUT /api/triggers/:triggerId
 * Update a trigger
 */
router.put('/:triggerId', async (req: Request, res: Response) => {
  try {
    const { triggerId } = req.params;
    const updates = req.body;

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      'name', 'description', 'type', 'conditions', 'actions',
      'customer_id', 'priority', 'cooldown_minutes', 'daily_limit',
      'enabled', 'metadata'
    ];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        updateData[dbKey] = ['conditions', 'actions', 'metadata'].includes(dbKey)
          ? JSON.stringify(value)
          : value;
      }
    }

    const { data, error } = await supabase
      .from('triggers')
      .update(updateData)
      .eq('id', triggerId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    res.json({ trigger: data });
  } catch (error) {
    console.error('Error updating trigger:', error);
    res.status(500).json({ error: 'Failed to update trigger' });
  }
});

/**
 * DELETE /api/triggers/:triggerId
 * Delete a trigger
 */
router.delete('/:triggerId', async (req: Request, res: Response) => {
  try {
    const { triggerId } = req.params;

    const { error } = await supabase
      .from('triggers')
      .delete()
      .eq('id', triggerId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting trigger:', error);
    res.status(500).json({ error: 'Failed to delete trigger' });
  }
});

/**
 * POST /api/triggers/:triggerId/enable
 * Enable a trigger
 */
router.post('/:triggerId/enable', async (req: Request, res: Response) => {
  try {
    const { triggerId } = req.params;

    const { data, error } = await supabase
      .from('triggers')
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq('id', triggerId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    res.json({ trigger: data });
  } catch (error) {
    console.error('Error enabling trigger:', error);
    res.status(500).json({ error: 'Failed to enable trigger' });
  }
});

/**
 * POST /api/triggers/:triggerId/disable
 * Disable a trigger
 */
router.post('/:triggerId/disable', async (req: Request, res: Response) => {
  try {
    const { triggerId } = req.params;

    const { data, error } = await supabase
      .from('triggers')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('id', triggerId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    res.json({ trigger: data });
  } catch (error) {
    console.error('Error disabling trigger:', error);
    res.status(500).json({ error: 'Failed to disable trigger' });
  }
});

// ============================================
// Event Processing
// ============================================

/**
 * POST /api/triggers/events
 * Process a customer event through the trigger engine
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const event: CustomerEvent = req.body;

    if (!event.type || !event.customerId) {
      return res.status(400).json({
        error: 'Event type and customerId are required',
      });
    }

    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    // Process through trigger engine
    const results = await triggerEngine.processEvent(event);

    res.json({
      processed: true,
      triggersMatched: results.length,
      results,
    });
  } catch (error) {
    console.error('Error processing event:', error);
    res.status(500).json({ error: 'Failed to process event' });
  }
});

/**
 * POST /api/triggers/events/batch
 * Process multiple events
 */
router.post('/events/batch', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const allResults = [];
    for (const event of events) {
      if (!event.type || !event.customerId) continue;

      if (!event.timestamp) {
        event.timestamp = new Date();
      }

      const results = await triggerEngine.processEvent(event);
      allResults.push({
        eventType: event.type,
        customerId: event.customerId,
        triggersMatched: results.length,
        results,
      });
    }

    res.json({
      processed: events.length,
      results: allResults,
    });
  } catch (error) {
    console.error('Error processing batch events:', error);
    res.status(500).json({ error: 'Failed to process batch events' });
  }
});

// ============================================
// Trigger Events History
// ============================================

/**
 * GET /api/triggers/events/history
 * Get trigger event history
 */
router.get('/events/history', async (req: Request, res: Response) => {
  try {
    const { triggerId, customerId, status, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('trigger_events')
      .select(`
        *,
        triggers (id, name, type),
        customers (id, name)
      `)
      .order('fired_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (triggerId) query = query.eq('trigger_id', triggerId);
    if (customerId) query = query.eq('customer_id', customerId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ events: data });
  } catch (error) {
    console.error('Error getting trigger events:', error);
    res.status(500).json({ error: 'Failed to get trigger events' });
  }
});

// ============================================
// Condition Types
// ============================================

/**
 * GET /api/triggers/conditions/types
 * Get available condition types and their descriptions
 */
router.get('/conditions/types', async (_req: Request, res: Response) => {
  try {
    const types = [
      {
        type: 'health_score_drop',
        name: 'Health Score Drop',
        description: 'Fires when a customer\'s health score drops below a threshold or by a percentage',
        params: {
          threshold: { type: 'number', description: 'Absolute score threshold (0-100)' },
          dropPercent: { type: 'number', description: 'Percentage drop to trigger' },
          window: { type: 'string', enum: ['day', 'week', 'month'], description: 'Time window for comparison' },
        },
        eventTypes: ['health_score_updated'],
      },
      {
        type: 'no_login',
        name: 'No Login',
        description: 'Fires when a customer hasn\'t logged in for a specified period',
        params: {
          days: { type: 'number', required: true, description: 'Days without login' },
          excludeWeekends: { type: 'boolean', description: 'Exclude weekends from count' },
        },
        eventTypes: ['customer_login', 'login_check'],
      },
      {
        type: 'renewal_approaching',
        name: 'Renewal Approaching',
        description: 'Fires when renewal date is within specified days',
        params: {
          daysOut: { type: 'number', required: true, description: 'Days before renewal' },
          minContractValue: { type: 'number', description: 'Minimum ARR to trigger' },
        },
        eventTypes: ['renewal_date_check', 'contract_updated'],
      },
      {
        type: 'ticket_escalated',
        name: 'Ticket Escalated',
        description: 'Fires when a support ticket is escalated',
        params: {
          minPriority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Minimum priority level' },
          category: { type: 'string', description: 'Specific ticket category' },
        },
        eventTypes: ['ticket_escalated', 'ticket_updated'],
      },
      {
        type: 'nps_submitted',
        name: 'NPS Submitted',
        description: 'Fires when a customer submits an NPS response',
        params: {
          category: { type: 'string', enum: ['detractor', 'passive', 'promoter'], description: 'NPS category filter' },
          minScore: { type: 'number', description: 'Minimum score (0-10)' },
          maxScore: { type: 'number', description: 'Maximum score (0-10)' },
          requiresComment: { type: 'boolean', description: 'Only trigger if comment included' },
        },
        eventTypes: ['nps_response'],
      },
      {
        type: 'usage_anomaly',
        name: 'Usage Anomaly',
        description: 'Fires when usage patterns deviate significantly from normal',
        params: {
          anomalyType: { type: 'string', enum: ['drop', 'spike', 'both'], description: 'Type of anomaly to detect' },
          threshold: { type: 'number', description: 'Percentage change threshold' },
          metric: { type: 'string', description: 'Specific metric to track' },
          period: { type: 'string', enum: ['day', 'week', 'month'], description: 'Comparison period' },
        },
        eventTypes: ['usage_metric_updated', 'product_usage'],
      },
    ];

    res.json({ types });
  } catch (error) {
    console.error('Error getting condition types:', error);
    res.status(500).json({ error: 'Failed to get condition types' });
  }
});

// ============================================
// Statistics
// ============================================

/**
 * GET /api/triggers/stats
 * Get trigger statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    // Get trigger counts
    const { data: triggers, error: triggersError } = await supabase
      .from('triggers')
      .select('id, enabled, type');

    if (triggersError) throw triggersError;

    // Get event counts
    const { data: events, error: eventsError } = await supabase
      .from('trigger_events')
      .select('trigger_id, status')
      .gte('fired_at', cutoffDate.toISOString());

    if (eventsError) throw eventsError;

    const stats = {
      totalTriggers: triggers?.length || 0,
      enabledTriggers: triggers?.filter(t => t.enabled).length || 0,
      disabledTriggers: triggers?.filter(t => !t.enabled).length || 0,
      triggersByType: triggers?.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      totalEventsFired: events?.length || 0,
      eventsByStatus: events?.reduce((acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      period: { days: daysNum, from: cutoffDate.toISOString() },
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting trigger stats:', error);
    res.status(500).json({ error: 'Failed to get trigger stats' });
  }
});

export { router as triggersRoutes };
