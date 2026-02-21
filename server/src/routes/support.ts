/**
 * Support Routes
 * PRD-087: API endpoints for support ticket operations and spike detection
 */

import { Router, Request, Response } from 'express';
import { supportService } from '../services/support/index.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Webhook Endpoints
// ============================================

/**
 * POST /api/webhooks/support/ticket
 * Receive ticket events from external support systems (Zendesk, Intercom, etc.)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // Validate required fields
    if (!payload.ticketId || !payload.customerId) {
      return res.status(400).json({
        error: 'ticketId and customerId are required',
      });
    }

    // Process the webhook
    const result = await supportService.processTicketWebhook({
      ticketId: payload.ticketId,
      customerId: payload.customerId,
      category: payload.category,
      severity: payload.severity,
      subject: payload.subject || 'Support Ticket',
      description: payload.description,
      reporterEmail: payload.reporterEmail,
      reporterName: payload.reporterName,
      assignee: payload.assignee,
      status: payload.status,
      tags: payload.tags,
      externalUrl: payload.externalUrl,
      createdAt: payload.createdAt,
      isEscalation: payload.isEscalation,
      escalationLevel: payload.escalationLevel,
      metadata: payload.metadata,
    }, (req as any).organizationId);

    res.json({
      success: true,
      ticketId: result.ticket.id,
      spikeDetected: result.spikeDetected,
      spike: result.spikeResult ? {
        ticketCount: result.spikeResult.ticketCount,
        multiplier: result.spikeResult.multiplier,
        severity: result.spikeResult.severity,
        themes: result.spikeResult.themes,
      } : null,
    });
  } catch (error) {
    console.error('[Support Webhook] Error:', error);
    res.status(500).json({ error: 'Failed to process ticket webhook' });
  }
});

/**
 * POST /api/webhooks/support/ticket/batch
 * Process multiple tickets at once (for bulk imports or syncs)
 */
router.post('/webhook/batch', async (req: Request, res: Response) => {
  try {
    const { tickets } = req.body;

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ error: 'tickets array is required' });
    }

    const results = [];
    for (const payload of tickets) {
      if (!payload.ticketId || !payload.customerId) continue;

      const result = await supportService.processTicketWebhook({
        ticketId: payload.ticketId,
        customerId: payload.customerId,
        category: payload.category,
        severity: payload.severity,
        subject: payload.subject || 'Support Ticket',
        description: payload.description,
        reporterEmail: payload.reporterEmail,
        reporterName: payload.reporterName,
        assignee: payload.assignee,
        status: payload.status,
        tags: payload.tags,
        externalUrl: payload.externalUrl,
        createdAt: payload.createdAt,
        isEscalation: payload.isEscalation,
        metadata: payload.metadata,
      }, (req as any).organizationId);

      results.push({
        ticketId: result.ticket.externalId,
        spikeDetected: result.spikeDetected,
      });
    }

    res.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('[Support Webhook Batch] Error:', error);
    res.status(500).json({ error: 'Failed to process batch webhook' });
  }
});

// ============================================
// Spike Detection Endpoints
// ============================================

/**
 * POST /api/support/check-spike
 * Manually check for ticket spike for a customer
 */
router.post('/check-spike', async (req: Request, res: Response) => {
  try {
    const { customerId, lookbackHours, baselineDays, spikeThreshold } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const result = await supportService.detectTicketSpike({
      customerId,
      lookbackHours: lookbackHours || 24,
      baselineDays: baselineDays || 30,
      spikeThreshold: spikeThreshold || 3.0,
    }, (req as any).organizationId);

    res.json({
      isSpike: result.isSpike,
      ticketCount: result.ticketCount,
      baseline: result.baseline,
      multiplier: result.multiplier,
      severity: result.severity,
      themes: result.themes,
      categoryBreakdown: result.categoryBreakdown,
      severityBreakdown: result.severityBreakdown,
      tickets: result.tickets.slice(0, 10).map(t => ({
        id: t.id,
        externalId: t.externalId,
        subject: t.subject,
        category: t.category,
        severity: t.severity,
        status: t.status,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error('[Check Spike] Error:', error);
    res.status(500).json({ error: 'Failed to check for spike' });
  }
});

/**
 * POST /api/support/check-spike/all
 * Check for spikes across all customers (for scheduled job)
 */
router.post('/check-spike/all', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get all active customers
    let customersQuery = supabase
      .from('customers')
      .select('id, name')
      .eq('status', 'active');
    customersQuery = applyOrgFilter(customersQuery, req);
    const { data: customers, error: customersError } = await customersQuery;

    if (customersError) throw customersError;

    const spikesDetected = [];

    for (const customer of customers || []) {
      const result = await supportService.detectTicketSpike({
        customerId: customer.id,
        lookbackHours: 24,
        spikeThreshold: 3.0,
      }, (req as any).organizationId);

      if (result.isSpike) {
        spikesDetected.push({
          customerId: customer.id,
          customerName: customer.name,
          ticketCount: result.ticketCount,
          multiplier: result.multiplier,
          severity: result.severity,
          themes: result.themes,
        });
      }
    }

    res.json({
      customersChecked: customers?.length || 0,
      spikesDetected: spikesDetected.length,
      spikes: spikesDetected,
    });
  } catch (error) {
    console.error('[Check All Spikes] Error:', error);
    res.status(500).json({ error: 'Failed to check all customers for spikes' });
  }
});

// ============================================
// Summary Endpoints
// ============================================

/**
 * GET /api/support/summary/:customerId
 * Get comprehensive support summary for a customer
 */
router.get('/summary/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const lookbackHours = parseInt(req.query.lookbackHours as string) || 24;

    const summary = await supportService.getSupportSummary(customerId, lookbackHours, (req as any).organizationId);

    res.json(summary);
  } catch (error) {
    console.error('[Support Summary] Error:', error);
    res.status(500).json({ error: 'Failed to get support summary' });
  }
});

// ============================================
// Ticket Endpoints
// ============================================

/**
 * GET /api/support/tickets/:customerId
 * Get tickets for a customer
 */
router.get('/tickets/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      lookbackHours,
      status,
      category,
      severity,
      limit,
    } = req.query;

    const tickets = await supportService.getTickets(customerId, {
      lookbackHours: lookbackHours ? parseInt(lookbackHours as string) : undefined,
      status: status ? (status as string).split(',') as any[] : undefined,
      category: category ? (category as string).split(',') as any[] : undefined,
      severity: severity ? (severity as string).split(',') as any[] : undefined,
      limit: limit ? parseInt(limit as string) : 50,
    }, (req as any).organizationId);

    res.json({ tickets });
  } catch (error) {
    console.error('[Get Tickets] Error:', error);
    res.status(500).json({ error: 'Failed to get tickets' });
  }
});

// ============================================
// Baseline Endpoints
// ============================================

/**
 * GET /api/support/baseline/:customerId
 * Get stored baseline for a customer
 */
router.get('/baseline/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const baseline = await supportService.getBaseline(customerId, (req as any).organizationId);

    if (!baseline) {
      return res.status(404).json({ error: 'No baseline found for customer' });
    }

    res.json(baseline);
  } catch (error) {
    console.error('[Get Baseline] Error:', error);
    res.status(500).json({ error: 'Failed to get baseline' });
  }
});

/**
 * POST /api/support/baseline/:customerId
 * Calculate and store baseline for a customer
 */
router.post('/baseline/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { days } = req.body;

    const baseline = await supportService.calculateBaseline(customerId, days || 30, (req as any).organizationId);

    res.json(baseline);
  } catch (error) {
    console.error('[Calculate Baseline] Error:', error);
    res.status(500).json({ error: 'Failed to calculate baseline' });
  }
});

// ============================================
// Risk Signal Endpoints
// ============================================

/**
 * GET /api/support/signals/:customerId
 * Get active risk signals for a customer
 */
router.get('/signals/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { signalType } = req.query;

    const signals = await supportService.getRiskSignals(
      customerId,
      signalType as string | undefined,
      (req as any).organizationId
    );

    res.json({ signals });
  } catch (error) {
    console.error('[Get Signals] Error:', error);
    res.status(500).json({ error: 'Failed to get risk signals' });
  }
});

/**
 * POST /api/support/signals/:signalId/acknowledge
 * Acknowledge a risk signal
 */
router.post('/signals/:signalId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { signalId } = req.params;
    const userId = (req as any).userId || 'system';

    const signal = await supportService.acknowledgeSignal(signalId, userId, (req as any).organizationId);

    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    res.json({ signal });
  } catch (error) {
    console.error('[Acknowledge Signal] Error:', error);
    res.status(500).json({ error: 'Failed to acknowledge signal' });
  }
});

/**
 * POST /api/support/signals/:signalId/resolve
 * Resolve a risk signal
 */
router.post('/signals/:signalId/resolve', async (req: Request, res: Response) => {
  try {
    const { signalId } = req.params;
    const { notes } = req.body;

    const signal = await supportService.resolveSignal(signalId, notes, false, (req as any).organizationId);

    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    res.json({ signal });
  } catch (error) {
    console.error('[Resolve Signal] Error:', error);
    res.status(500).json({ error: 'Failed to resolve signal' });
  }
});

// ============================================
// Email Draft Endpoints (for spike acknowledgment)
// ============================================

/**
 * GET /api/support/drafts/:customerId
 * Get email drafts for a customer
 */
router.get('/drafts/:customerId', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.json({ drafts: [] });
    }

    const { customerId } = req.params;
    const { status } = req.query;

    let query = supabase
      .from('email_drafts')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ drafts: data });
  } catch (error) {
    console.error('[Get Drafts] Error:', error);
    res.status(500).json({ error: 'Failed to get email drafts' });
  }
});

/**
 * POST /api/support/drafts/:draftId/approve
 * Approve an email draft
 */
router.post('/drafts/:draftId/approve', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { draftId } = req.params;
    const userId = (req as any).userId || 'system';

    const { data, error } = await supabase
      .from('email_drafts')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .select()
      .single();

    if (error) throw error;

    res.json({ draft: data });
  } catch (error) {
    console.error('[Approve Draft] Error:', error);
    res.status(500).json({ error: 'Failed to approve draft' });
  }
});

// ============================================
// PRD-4 US-009: Support Ticket Submission
// ============================================

/**
 * GET /api/support/tickets
 * List all tickets with optional filters (customerId, status)
 */
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const { customerId, status } = req.query;

    if (supabase) {
      let query = supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      query = applyOrgFilter(query, req);

      if (customerId) {
        query = query.eq('customer_id', customerId as string);
      }
      if (status && status !== 'all') {
        query = query.eq('status', status as string);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('List tickets error:', error);
        // Return empty array if table doesn't exist
        return res.json({ tickets: [] });
      }

      // Transform to frontend format
      const tickets = (data || []).map(t => ({
        id: t.id || t.external_id,
        customerId: t.customer_id,
        customerName: t.customer_name,
        subject: t.subject,
        description: t.description,
        priority: t.priority,
        category: t.category,
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        assignedTo: t.assigned_to,
        troubleshootingSuggestions: t.ai_suggestions
      }));

      return res.json({ tickets });
    }

    // No database, return empty
    res.json({ tickets: [] });
  } catch (error) {
    console.error('[List Tickets] Error:', error);
    res.status(500).json({ error: 'Failed to list tickets' });
  }
});

/**
 * POST /api/support/tickets
 * Submit a new support ticket with AI troubleshooting suggestions
 */
router.post('/tickets', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      subject,
      description,
      priority = 'medium',
      category,
      reporterEmail,
      reporterName
    } = req.body;

    // Validate required fields
    if (!customerId || !subject || !description) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'customerId, subject, and description are required'
        }
      });
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `priority must be one of: ${validPriorities.join(', ')}`
        }
      });
    }

    // Generate a unique ticket ID
    const ticketId = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Generate AI troubleshooting suggestions based on the description
    const troubleshootingSuggestions = generateTroubleshootingSuggestions(subject, description, category);

    if (!supabase) {
      return res.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database not configured'
        }
      });
    }

    // Store in database
    const { data, error } = await supabase
      .from('support_tickets')
      .insert(withOrgId({
        external_id: ticketId,
        customer_id: customerId,
        subject,
        description,
        priority,
        category: category || 'general',
        status: 'open',
        reporter_email: reporterEmail,
        reporter_name: reporterName,
        ai_suggestions: troubleshootingSuggestions,
        created_at: new Date().toISOString()
      }, req))
      .select()
      .single();

    if (error) {
      console.error('[Support] Failed to create ticket:', error);
      return res.status(500).json({
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to save support ticket to database',
          details: error.message
        }
      });
    }

    const ticket = data;

    res.status(201).json({
      ticketId: ticketId,
      status: 'open',
      message: 'Support ticket created successfully',
      ticket,
      troubleshootingSuggestions
    });
  } catch (error) {
    console.error('[Create Ticket] Error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create support ticket' }
    });
  }
});

/**
 * Generate AI troubleshooting suggestions based on ticket content
 */
function generateTroubleshootingSuggestions(
  subject: string,
  description: string,
  category?: string
): string[] {
  const suggestions: string[] = [];
  const lowerSubject = subject.toLowerCase();
  const lowerDesc = description.toLowerCase();

  // Login/Authentication issues
  if (lowerSubject.includes('login') || lowerSubject.includes('password') ||
      lowerDesc.includes('cannot login') || lowerDesc.includes('access denied')) {
    suggestions.push('Try resetting your password using the "Forgot Password" link');
    suggestions.push('Clear browser cache and cookies, then try again');
    suggestions.push('Check if your account is locked - contact admin after 5 failed attempts');
    suggestions.push('Verify you are using the correct email address');
  }

  // Performance issues
  if (lowerSubject.includes('slow') || lowerSubject.includes('performance') ||
      lowerDesc.includes('loading') || lowerDesc.includes('timeout')) {
    suggestions.push('Check your internet connection speed');
    suggestions.push('Try accessing from a different browser');
    suggestions.push('Disable browser extensions temporarily');
    suggestions.push('Check our status page for any ongoing incidents');
  }

  // Integration issues
  if (lowerSubject.includes('integration') || lowerSubject.includes('sync') ||
      lowerDesc.includes('salesforce') || lowerDesc.includes('hubspot')) {
    suggestions.push('Verify your integration credentials are still valid');
    suggestions.push('Check if the connected service has any outages');
    suggestions.push('Try disconnecting and reconnecting the integration');
    suggestions.push('Review sync logs for specific error messages');
  }

  // Data issues
  if (lowerSubject.includes('data') || lowerSubject.includes('missing') ||
      lowerDesc.includes('not showing') || lowerDesc.includes('incorrect')) {
    suggestions.push('Refresh the page to fetch the latest data');
    suggestions.push('Check if you have the correct filters applied');
    suggestions.push('Verify your permissions allow access to this data');
    suggestions.push('Check the date range settings');
  }

  // Default suggestions if no specific match
  if (suggestions.length === 0) {
    suggestions.push('Please provide any relevant screenshots or error messages');
    suggestions.push('Note the exact steps to reproduce this issue');
    suggestions.push('Check our knowledge base for related articles');
    suggestions.push('Our support team will respond within 24 hours');
  }

  return suggestions.slice(0, 4); // Return max 4 suggestions
}

export default router;
