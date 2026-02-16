/**
 * Support Satisfaction Routes
 *
 * PRD-102: Support Satisfaction Drop Alert
 *
 * API endpoints for CSAT tracking, alerts, and CSM follow-ups
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import {
  supportSatisfactionService,
  type CSATWebhookPayload,
} from '../services/support/satisfaction.js';
import { sendSlackAlert } from '../services/notifications/slack.js';
import { sendNotification } from '../services/notifications/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Webhook Endpoints
// ============================================

/**
 * POST /api/support-satisfaction/webhook
 * Receive CSAT response from support system
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const payload: CSATWebhookPayload = req.body;

    // Validate required fields
    if (!payload.ticketId || !payload.customerId || payload.rating === undefined) {
      return res.status(400).json({
        error: 'ticketId, customerId, and rating are required',
      });
    }

    // Validate rating range
    if (payload.rating < 1 || payload.rating > 5) {
      return res.status(400).json({
        error: 'rating must be between 1 and 5',
      });
    }

    // Process the CSAT response
    const result = await supportSatisfactionService.processCSATWebhook(payload);

    // If alert was generated, send notifications
    if (result.alertGenerated && result.alert) {
      await sendAlertNotifications(result.alert, payload, req);
    }

    res.status(201).json({
      success: true,
      satisfaction: result.satisfaction,
      alertGenerated: result.alertGenerated,
      alert: result.alert,
    });
  } catch (error) {
    console.error('[SatisfactionRoutes] Webhook error:', error);
    res.status(500).json({ error: 'Failed to process CSAT webhook' });
  }
});

/**
 * POST /api/support-satisfaction/batch
 * Process multiple CSAT responses
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { responses } = req.body;

    if (!Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ error: 'responses array is required' });
    }

    const results = [];
    for (const payload of responses) {
      try {
        if (!payload.ticketId || !payload.customerId || payload.rating === undefined) {
          results.push({ success: false, error: 'Missing required fields', ticketId: payload.ticketId });
          continue;
        }

        const result = await supportSatisfactionService.processCSATWebhook(payload);

        if (result.alertGenerated && result.alert) {
          await sendAlertNotifications(result.alert, payload, req);
        }

        results.push({
          success: true,
          ticketId: payload.ticketId,
          alertGenerated: result.alertGenerated,
        });
      } catch (err) {
        results.push({
          success: false,
          ticketId: payload.ticketId,
          error: (err as Error).message,
        });
      }
    }

    res.json({
      processed: responses.length,
      results,
    });
  } catch (error) {
    console.error('[SatisfactionRoutes] Batch error:', error);
    res.status(500).json({ error: 'Failed to process batch CSAT responses' });
  }
});

// ============================================
// Satisfaction Data Endpoints
// ============================================

/**
 * GET /api/support-satisfaction/customer/:customerId
 * Get satisfaction summary for a customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const summary = await supportSatisfactionService.getSatisfactionSummary(customerId);

    if (!summary) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(summary);
  } catch (error) {
    console.error('[SatisfactionRoutes] Summary error:', error);
    res.status(500).json({ error: 'Failed to get satisfaction summary' });
  }
});

/**
 * GET /api/support-satisfaction/customer/:customerId/ratings
 * Get satisfaction ratings for a customer
 */
router.get('/customer/:customerId/ratings', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit = '20' } = req.query;

    const ratings = await supportSatisfactionService.getRecentRatings(
      customerId,
      parseInt(limit as string)
    );

    res.json({ ratings });
  } catch (error) {
    console.error('[SatisfactionRoutes] Ratings error:', error);
    res.status(500).json({ error: 'Failed to get satisfaction ratings' });
  }
});

/**
 * GET /api/support-satisfaction/customer/:customerId/trend
 * Get satisfaction trend for a customer
 */
router.get('/customer/:customerId/trend', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const trend = await supportSatisfactionService.getTrend(customerId);

    if (!trend) {
      return res.status(404).json({ error: 'No trend data available' });
    }

    res.json({ trend });
  } catch (error) {
    console.error('[SatisfactionRoutes] Trend error:', error);
    res.status(500).json({ error: 'Failed to get satisfaction trend' });
  }
});

// ============================================
// Alert Management Endpoints
// ============================================

/**
 * GET /api/support-satisfaction/alerts
 * List all active satisfaction alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { customerId, status = 'active', limit = '50' } = req.query;

    if (!supabase) {
      return res.json({ alerts: [] });
    }

    let query = supabase
      .from('support_satisfaction_alerts')
      .select(`
        *,
        customers (id, name, arr, health_score)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ alerts: data || [] });
  } catch (error) {
    console.error('[SatisfactionRoutes] Alerts error:', error);
    res.status(500).json({ error: 'Failed to get satisfaction alerts' });
  }
});

/**
 * GET /api/support-satisfaction/alerts/:alertId
 * Get alert details
 */
router.get('/alerts/:alertId', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    if (!supabase) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const { data, error } = await supabase
      .from('support_satisfaction_alerts')
      .select(`
        *,
        customers (id, name, arr, health_score),
        support_satisfaction (*)
      `)
      .eq('id', alertId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ alert: data });
  } catch (error) {
    console.error('[SatisfactionRoutes] Alert detail error:', error);
    res.status(500).json({ error: 'Failed to get alert details' });
  }
});

/**
 * POST /api/support-satisfaction/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const userId = (req as any).userId || 'system';

    const alert = await supportSatisfactionService.acknowledgeAlert(alertId, userId);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ alert });
  } catch (error) {
    console.error('[SatisfactionRoutes] Acknowledge error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

/**
 * POST /api/support-satisfaction/alerts/:alertId/resolve
 * Resolve an alert
 */
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;

    const alert = await supportSatisfactionService.resolveAlert(alertId, notes);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ alert });
  } catch (error) {
    console.error('[SatisfactionRoutes] Resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// ============================================
// Follow-up Endpoints
// ============================================

/**
 * POST /api/support-satisfaction/:satisfactionId/follow-up
 * Mark CSM follow-up complete
 */
router.post('/:satisfactionId/follow-up', async (req: Request, res: Response) => {
  try {
    const { satisfactionId } = req.params;
    const { notes } = req.body;

    const satisfaction = await supportSatisfactionService.markFollowedUp(
      satisfactionId,
      notes
    );

    if (!satisfaction) {
      return res.status(404).json({ error: 'Satisfaction record not found' });
    }

    res.json({ satisfaction });
  } catch (error) {
    console.error('[SatisfactionRoutes] Follow-up error:', error);
    res.status(500).json({ error: 'Failed to mark follow-up' });
  }
});

// ============================================
// Statistics Endpoints
// ============================================

/**
 * GET /api/support-satisfaction/stats
 * Get overall satisfaction statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    if (!supabase) {
      return res.json({
        totalResponses: 0,
        averageCsat: 0,
        poorRatings: 0,
        activeAlerts: 0,
        period: { days: daysNum },
      });
    }

    // Get satisfaction stats
    const { data: responses } = await supabase
      .from('support_satisfaction')
      .select('rating')
      .gte('created_at', cutoffDate.toISOString());

    const totalResponses = responses?.length || 0;
    const averageCsat = totalResponses > 0
      ? responses!.reduce((sum, r) => sum + r.rating, 0) / totalResponses
      : 0;
    const poorRatings = responses?.filter(r => r.rating <= 2).length || 0;

    // Get active alerts count
    const { count: activeAlerts } = await supabase
      .from('support_satisfaction_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get trend distribution
    const { data: trends } = await supabase
      .from('support_satisfaction_trends')
      .select('trend_direction');

    const trendDistribution = trends?.reduce((acc, t) => {
      acc[t.trend_direction] = (acc[t.trend_direction] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    res.json({
      totalResponses,
      averageCsat: Math.round(averageCsat * 10) / 10,
      poorRatings,
      poorRatingPercent: totalResponses > 0
        ? Math.round((poorRatings / totalResponses) * 100)
        : 0,
      activeAlerts: activeAlerts || 0,
      trendDistribution,
      period: {
        days: daysNum,
        from: cutoffDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('[SatisfactionRoutes] Stats error:', error);
    res.status(500).json({ error: 'Failed to get satisfaction stats' });
  }
});

/**
 * GET /api/support-satisfaction/at-risk
 * Get customers with declining satisfaction
 */
router.get('/at-risk', async (req: Request, res: Response) => {
  try {
    const { limit = '20' } = req.query;

    if (!supabase) {
      return res.json({ customers: [] });
    }

    const { data, error } = await supabase
      .from('support_satisfaction_trends')
      .select(`
        *,
        customers (id, name, arr, health_score, stage)
      `)
      .in('trend_direction', ['declining', 'critical'])
      .order('trend_percentage', { ascending: true })
      .limit(parseInt(limit as string));

    if (error) throw error;

    res.json({ customers: data || [] });
  } catch (error) {
    console.error('[SatisfactionRoutes] At-risk error:', error);
    res.status(500).json({ error: 'Failed to get at-risk customers' });
  }
});

// ============================================
// Helper Functions
// ============================================

/**
 * Send alert notifications via configured channels
 */
async function sendAlertNotifications(
  alert: any,
  payload: CSATWebhookPayload,
  req?: Request
): Promise<void> {
  try {
    // Build Slack alert context matching PRD format
    const context = await supportSatisfactionService.buildSlackAlertContext({
      id: alert.satisfactionId,
      customerId: payload.customerId,
      ticketId: payload.ticketId,
      ticketSubject: payload.ticketSubject,
      rating: payload.rating,
      feedback: payload.feedback,
      ticketCategory: payload.ticketCategory,
      resolutionTimeHours: payload.resolutionTimeHours,
      wasEscalated: payload.wasEscalated || false,
      csmNotified: false,
      csmFollowedUp: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Get CSM for customer
    const csmId = await getCustomerCSM(payload.customerId, req);

    if (csmId) {
      // Send in-app notification
      await sendNotification(csmId, {
        type: 'risk_signal',
        title: alert.title,
        body: buildNotificationBody(context),
        priority: alert.severity === 'critical' ? 'urgent' : alert.severity === 'high' ? 'high' : 'medium',
        customerId: payload.customerId,
        customerName: context.customerName,
        data: {
          alertId: alert.id,
          rating: payload.rating,
          ticketId: payload.ticketId,
        },
        actionUrl: `/customers/${payload.customerId}?tab=support`,
      });
    }

    // Mark alert as notified
    if (supabase) {
      await supabase
        .from('support_satisfaction_alerts')
        .update({
          notified_at: new Date().toISOString(),
          notification_channel: 'multi',
        })
        .eq('id', alert.id);
    }
  } catch (error) {
    console.error('[SatisfactionRoutes] Notification error:', error);
  }
}

/**
 * Build notification body matching PRD format
 */
function buildNotificationBody(context: any): string {
  const slaStatus = context.resolutionTimeHours && context.slaHours
    ? context.resolutionTimeHours > context.slaHours
      ? ` (SLA: ${context.slaHours} hours - BREACHED)`
      : ''
    : '';

  let body = `Poor Rating Received: ${context.rating}/5\n\n`;
  body += `Ticket: #${context.ticketId}\n`;
  body += `Subject: "${context.ticketSubject}"\n`;
  if (context.ticketCategory) {
    body += `Category: ${context.ticketCategory}\n`;
  }
  if (context.resolutionTimeHours) {
    body += `Resolution Time: ${context.resolutionTimeHours} hours${slaStatus}\n`;
  }

  if (context.customerFeedback) {
    body += `\nCustomer Feedback:\n"${context.customerFeedback}"\n`;
  }

  body += `\nContext:\n`;
  body += `- Customer ARR: $${context.customerArr.toLocaleString()}\n`;
  body += `- Support history: ${context.supportHistory.ticketsThisMonth} tickets this month\n`;
  body += `- Previous avg CSAT: ${context.supportHistory.previousAvgCsat}\n`;

  if (context.lowRatingCount30Days > 1) {
    body += `\nThis is the ${getOrdinal(context.lowRatingCount30Days)} low rating in 30 days.`;
  }

  return body;
}

/**
 * Get ordinal suffix for number
 */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Get CSM ID for customer
 */
async function getCustomerCSM(customerId: string, req?: Request): Promise<string | null> {
  if (!supabase) return null;

  let custQuery = supabase
    .from('customers')
    .select('assigned_csm_id');
  if (req) {
    custQuery = applyOrgFilter(custQuery, req);
  }
  const { data } = await custQuery
    .eq('id', customerId)
    .single();

  return data?.assigned_csm_id || null;
}

export { router as supportSatisfactionRoutes };
