/**
 * Usage Ingest API Routes
 *
 * Endpoints for customers to send their product usage data.
 * This enables real-time health score calculation from actual usage.
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { config } from '../config/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';
import {
  ingestUsageEvents,
  getUsageMetrics,
  getUsageTrend,
  type UsageEvent,
} from '../services/usage/index.js';
import { recalculateHealthScore, getHealthScoreHistory } from '../services/usage/health-score.js';

const router = Router();

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

/**
 * POST /api/v1/usage/events
 *
 * Ingest usage events from a customer's product.
 * Requires API key authentication.
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { customer_id, api_key, events } = req.body as {
      customer_id?: string;
      api_key?: string;
      events?: UsageEvent[];
    };

    // Validate required fields
    if (!customer_id) {
      return res.status(400).json({
        error: 'customer_id is required',
      });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'events array is required and must not be empty',
      });
    }

    // Validate API key if provided (optional for now, can be enforced later)
    if (api_key && supabase) {
      const { data: keyData } = await supabase
        .from('usage_api_keys')
        .select('*')
        .eq('api_key', api_key)
        .eq('customer_id', customer_id)
        .eq('is_active', true)
        .single();

      if (!keyData) {
        return res.status(401).json({
          error: 'Invalid or inactive API key',
        });
      }

      // Update last_used_at
      await supabase
        .from('usage_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyData.id);
    }

    // Validate events structure
    const validEvents = events.filter(e =>
      e && typeof e.event_type === 'string' && e.event_type.length > 0
    );

    if (validEvents.length === 0) {
      return res.status(400).json({
        error: 'No valid events found. Each event must have an event_type.',
      });
    }

    // Ingest events
    const result = await ingestUsageEvents(customer_id, validEvents);

    res.status(201).json({
      success: true,
      ingested: result.ingested,
      customer_id: result.customerId,
      metrics_updated: result.metricsUpdated,
      health_score_updated: result.healthScoreUpdated,
      new_health_score: result.newHealthScore,
    });
  } catch (error) {
    console.error('Usage ingest error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to ingest usage events',
    });
  }
});

/**
 * GET /api/v1/usage/metrics/:customerId
 *
 * Get current usage metrics for a customer.
 */
router.get('/metrics/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const metrics = await getUsageMetrics(customerId);

    if (!metrics) {
      return res.status(404).json({
        error: 'No metrics found for this customer',
        hint: 'Send usage events first using POST /api/v1/usage/events',
      });
    }

    res.json({
      success: true,
      customer_id: customerId,
      metrics,
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to get usage metrics',
    });
  }
});

/**
 * GET /api/v1/usage/trend/:customerId
 *
 * Get usage trend (current vs previous period).
 */
router.get('/trend/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { days = '30' } = req.query;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const trend = await getUsageTrend(customerId, parseInt(days as string));

    res.json({
      success: true,
      customer_id: customerId,
      days: parseInt(days as string),
      current_metrics: trend.current,
      percent_change: trend.percentChange,
      trend_direction: trend.percentChange > 5 ? 'up' : trend.percentChange < -5 ? 'down' : 'stable',
    });
  } catch (error) {
    console.error('Get trend error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to get usage trend',
    });
  }
});

/**
 * GET /api/v1/usage/health/:customerId
 *
 * Get current health score and history.
 */
router.get('/health/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { days = '90' } = req.query;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    // Get health score history
    const history = await getHealthScoreHistory(customerId, parseInt(days as string));

    // Get current score from customer record
    let currentScore = 70; // Default
    if (supabase) {
      let custQuery = supabase
        .from('customers')
        .select('health_score');
      custQuery = applyOrgFilter(custQuery, req);
      const { data: customer } = await custQuery
        .eq('id', customerId)
        .single();

      if (customer) {
        currentScore = customer.health_score || 70;
      }
    }

    res.json({
      success: true,
      customer_id: customerId,
      current_score: currentScore,
      history,
      trend: history.length >= 2
        ? (history[history.length - 1].score > history[0].score ? 'improving' : 'declining')
        : 'stable',
    });
  } catch (error) {
    console.error('Get health error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to get health score',
    });
  }
});

/**
 * POST /api/v1/usage/health/:customerId/recalculate
 *
 * Force recalculation of health score.
 */
router.post('/health/:customerId/recalculate', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const result = await recalculateHealthScore(customerId, 'manual');

    if (!result) {
      return res.status(500).json({
        error: 'Failed to recalculate health score',
      });
    }

    res.json({
      success: true,
      customer_id: customerId,
      score: result.score,
      previous_score: result.previousScore,
      trend: result.trend,
      components: result.components,
      risk_signals: result.riskSignals,
    });
  } catch (error) {
    console.error('Recalculate health error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to recalculate health score',
    });
  }
});

/**
 * POST /api/v1/usage/api-keys
 *
 * Generate a new API key for a customer.
 */
router.post('/api-keys', async (req: Request, res: Response) => {
  try {
    const { customer_id, name } = req.body as {
      customer_id?: string;
      name?: string;
    };

    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }

    // Generate a secure API key
    const apiKey = `cscx_${randomBytes(24).toString('hex')}`;

    if (supabase) {
      const { data, error } = await supabase
        .from('usage_api_keys')
        .insert({
          customer_id,
          api_key: apiKey,
          name: name || 'Default Key',
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return res.status(201).json({
        success: true,
        api_key: apiKey,
        id: data.id,
        name: data.name,
        customer_id: data.customer_id,
        created_at: data.created_at,
        warning: 'Store this API key securely. It will not be shown again.',
      });
    }

    // Fallback without database
    res.status(201).json({
      success: true,
      api_key: apiKey,
      customer_id,
      name: name || 'Default Key',
      warning: 'Store this API key securely. It will not be shown again.',
      note: 'Database not configured - key not persisted.',
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to create API key',
    });
  }
});

/**
 * GET /api/v1/usage/api-keys/:customerId
 *
 * List API keys for a customer (keys are masked).
 */
router.get('/api-keys/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    if (!supabase) {
      return res.json({
        success: true,
        customer_id: customerId,
        keys: [],
        note: 'Database not configured',
      });
    }

    const { data, error } = await supabase
      .from('usage_api_keys')
      .select('id, name, is_active, last_used_at, created_at, api_key')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Mask API keys
    const maskedKeys = (data || []).map(k => ({
      id: k.id,
      name: k.name,
      is_active: k.is_active,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
      api_key_preview: k.api_key.substring(0, 10) + '...',
    }));

    res.json({
      success: true,
      customer_id: customerId,
      keys: maskedKeys,
    });
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to list API keys',
    });
  }
});

/**
 * DELETE /api/v1/usage/api-keys/:keyId
 *
 * Revoke (deactivate) an API key.
 */
router.delete('/api-keys/:keyId', async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;

    if (!keyId) {
      return res.status(400).json({ error: 'keyId is required' });
    }

    if (!supabase) {
      return res.status(501).json({
        error: 'Database not configured',
      });
    }

    const { error } = await supabase
      .from('usage_api_keys')
      .update({ is_active: false })
      .eq('id', keyId);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to revoke API key',
    });
  }
});

export default router;
