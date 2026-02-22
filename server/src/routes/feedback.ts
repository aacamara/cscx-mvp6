/**
 * Feedback Routes
 *
 * PRD-128: Feedback Received → Routing
 *
 * API endpoints for feedback submission, classification, routing,
 * acknowledgment, and lifecycle management.
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import {
  createFeedback,
  getFeedbackById,
  listFeedback,
  updateFeedbackStatus,
  rerouteFeedback,
  resolveFeedback,
  generateAcknowledgmentDraft,
  sendAcknowledgment,
  getFeedbackAnalytics,
  notifyCSMOfFeedback,
  getRoutingRules,
  classifyFeedback,
} from '../services/feedback/index.js';
import type {
  FeedbackSource,
  FeedbackStatus,
  FeedbackType,
  FeedbackCategory,
  FeedbackSentiment,
} from '../services/feedback/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Feedback Submission
// ============================================

/**
 * POST /api/feedback
 * Submit new customer feedback
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      source,
      sourceId,
      sourceUrl,
      submittedBy,
      content,
      rawContent,
      metadata,
    } = req.body;

    // Validation
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    if (!source) {
      return res.status(400).json({ error: 'source is required' });
    }

    const validSources: FeedbackSource[] = ['survey', 'widget', 'support', 'meeting', 'email', 'social'];
    if (!validSources.includes(source)) {
      return res.status(400).json({ error: `source must be one of: ${validSources.join(', ')}` });
    }

    if (!submittedBy?.email) {
      return res.status(400).json({ error: 'submittedBy.email is required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }

    // Create feedback with classification and routing
    const { feedback, shouldNotifyCSM } = await createFeedback({
      customerId,
      source,
      sourceId,
      sourceUrl,
      submittedBy,
      content,
      rawContent,
      metadata,
    }, req.organizationId);

    // Send CSM notification if needed
    if (shouldNotifyCSM) {
      const slackWebhook = process.env.SLACK_FEEDBACK_WEBHOOK_URL || process.env.SLACK_ALERTS_WEBHOOK_URL;
      if (slackWebhook) {
        await notifyCSMOfFeedback(feedback, slackWebhook, req.organizationId);
      }
    }

    res.status(201).json({
      success: true,
      feedback,
      shouldNotifyCSM,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error creating feedback:', error);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

/**
 * POST /api/feedback/classify
 * Classify feedback content without creating a record (preview)
 */
router.post('/classify', async (req: Request, res: Response) => {
  try {
    const { content, customerContext } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }

    const classification = await classifyFeedback(content, customerContext);

    res.json({
      success: true,
      classification,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error classifying feedback:', error);
    res.status(500).json({ error: 'Failed to classify feedback' });
  }
});

// ============================================
// Feedback Retrieval
// ============================================

/**
 * GET /api/feedback
 * List feedback with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      status,
      type,
      category,
      sentiment,
      source,
      team,
      assignedTo,
      startDate,
      endDate,
      search,
      limit,
      offset,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await listFeedback({
      customerId: customerId as string | undefined,
      status: status as FeedbackStatus | FeedbackStatus[] | undefined,
      type: type as FeedbackType | FeedbackType[] | undefined,
      category: category as FeedbackCategory | FeedbackCategory[] | undefined,
      sentiment: sentiment as FeedbackSentiment | undefined,
      source: source as FeedbackSource | undefined,
      team: team as string | undefined,
      assignedTo: assignedTo as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    }, req.organizationId);

    res.json({
      success: true,
      ...result,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error listing feedback:', error);
    res.status(500).json({ error: 'Failed to list feedback' });
  }
});

/**
 * GET /api/feedback/:feedbackId
 * Get single feedback item
 */
router.get('/:feedbackId', async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;

    const feedback = await getFeedbackById(feedbackId, req.organizationId);

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    // Get events/activity log
    let events: unknown[] = [];
    let comments: unknown[] = [];

    if (supabase) {
      let eventsQuery = supabase
        .from('feedback_events')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: false });

      let commentsQuery = supabase
        .from('feedback_comments')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });

      if (req.organizationId) {
        eventsQuery = eventsQuery.eq('organization_id', req.organizationId);
        commentsQuery = commentsQuery.eq('organization_id', req.organizationId);
      }

      const [eventsResult, commentsResult] = await Promise.all([
        eventsQuery,
        commentsQuery,
      ]);

      events = eventsResult.data || [];
      comments = commentsResult.data || [];
    }

    res.json({
      success: true,
      feedback,
      events,
      comments,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error getting feedback:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

/**
 * GET /api/feedback/customer/:customerId
 * Get all feedback for a customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit, offset } = req.query;

    const result = await listFeedback({
      customerId,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }, req.organizationId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error getting customer feedback:', error);
    res.status(500).json({ error: 'Failed to get customer feedback' });
  }
});

// ============================================
// Feedback Management
// ============================================

/**
 * PUT /api/feedback/:feedbackId/status
 * Update feedback status
 */
router.put('/:feedbackId/status', async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;
    const { status, userId } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const validStatuses: FeedbackStatus[] = ['received', 'routed', 'acknowledged', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const result = await updateFeedbackStatus(feedbackId, status, userId, req.organizationId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error) {
    console.error('[FeedbackRoutes] Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

/**
 * PUT /api/feedback/:feedbackId/route
 * Re-route feedback to different team
 */
router.put('/:feedbackId/route', async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;
    const { team, assignTo, userId } = req.body;

    if (!team) {
      return res.status(400).json({ error: 'team is required' });
    }

    const result = await rerouteFeedback(feedbackId, team, assignTo, userId, req.organizationId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error) {
    console.error('[FeedbackRoutes] Error re-routing feedback:', error);
    res.status(500).json({ error: 'Failed to re-route feedback' });
  }
});

/**
 * PUT /api/feedback/:feedbackId/resolve
 * Resolve feedback
 */
router.put('/:feedbackId/resolve', async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;
    const { outcome, outcomeDetails, externalTicketId, externalTicketUrl, userId } = req.body;

    if (!outcome) {
      return res.status(400).json({ error: 'outcome is required' });
    }

    const validOutcomes = ['implemented', 'fixed', 'wont_fix', 'duplicate', 'planned'];
    if (!validOutcomes.includes(outcome)) {
      return res.status(400).json({ error: `outcome must be one of: ${validOutcomes.join(', ')}` });
    }

    const result = await resolveFeedback(
      feedbackId,
      outcome,
      outcomeDetails,
      externalTicketId,
      externalTicketUrl,
      userId,
      req.organizationId
    );

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error) {
    console.error('[FeedbackRoutes] Error resolving feedback:', error);
    res.status(500).json({ error: 'Failed to resolve feedback' });
  }
});

// ============================================
// Acknowledgment
// ============================================

/**
 * POST /api/feedback/:feedbackId/acknowledge/draft
 * Generate acknowledgment draft
 */
router.post('/:feedbackId/acknowledge/draft', async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;

    const result = await generateAcknowledgmentDraft(feedbackId, req.organizationId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      draft: result.draft,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error generating draft:', error);
    res.status(500).json({ error: 'Failed to generate acknowledgment draft' });
  }
});

/**
 * POST /api/feedback/:feedbackId/acknowledge/send
 * Send acknowledgment
 */
router.post('/:feedbackId/acknowledge/send', async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;
    const { method, content, approvedBy } = req.body;

    if (!method) {
      return res.status(400).json({ error: 'method is required' });
    }

    const validMethods = ['email', 'slack', 'in_app'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: `method must be one of: ${validMethods.join(', ')}` });
    }

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    if (!approvedBy) {
      return res.status(400).json({ error: 'approvedBy is required' });
    }

    const result = await sendAcknowledgment(feedbackId, method, content, approvedBy, req.organizationId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error) {
    console.error('[FeedbackRoutes] Error sending acknowledgment:', error);
    res.status(500).json({ error: 'Failed to send acknowledgment' });
  }
});

// ============================================
// Comments
// ============================================

/**
 * POST /api/feedback/:feedbackId/comments
 * Add comment to feedback
 */
router.post('/:feedbackId/comments', async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;
    const { content, authorId, authorName, authorEmail, internal = true } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    if (!authorName || !authorEmail) {
      return res.status(400).json({ error: 'authorName and authorEmail are required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { data, error } = await supabase
      .from('feedback_comments')
      .insert({
        feedback_id: feedbackId,
        content,
        author_id: authorId || null,
        author_name: authorName,
        author_email: authorEmail,
        internal,
        created_at: new Date().toISOString(),
        ...(req.organizationId ? { organization_id: req.organizationId } : {}),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log event
    await supabase.from('feedback_events').insert({
      feedback_id: feedbackId,
      event_type: 'comment_added',
      event_data: { internal, authorEmail },
      performed_by: authorId || null,
      created_at: new Date().toISOString(),
      ...(req.organizationId ? { organization_id: req.organizationId } : {}),
    });

    res.status(201).json({
      success: true,
      comment: data,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * GET /api/feedback/:feedbackId/comments
 * Get comments for feedback
 */
router.get('/:feedbackId/comments', async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;
    const { internal } = req.query;

    if (!supabase) {
      return res.json({ comments: [] });
    }

    let query = supabase
      .from('feedback_comments')
      .select('*')
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: true });

    if (req.organizationId) {
      query = query.eq('organization_id', req.organizationId);
    }

    if (internal !== undefined) {
      query = query.eq('internal', internal === 'true');
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      comments: data || [],
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error getting comments:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// ============================================
// Analytics & Reports
// ============================================

/**
 * GET /api/feedback/analytics
 * Get feedback analytics
 */
router.get('/report/analytics', async (req: Request, res: Response) => {
  try {
    const { period = '30', customerId } = req.query;
    const days = parseInt(period as string);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await getFeedbackAnalytics(
      { startDate, endDate },
      customerId as string | undefined,
      req.organizationId
    );

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// ============================================
// Routing Rules
// ============================================

/**
 * GET /api/feedback/rules
 * Get routing rules
 */
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const rules = await getRoutingRules(req.organizationId);

    res.json({
      success: true,
      rules,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error getting rules:', error);
    res.status(500).json({ error: 'Failed to get routing rules' });
  }
});

/**
 * POST /api/feedback/rules
 * Create routing rule
 */
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      priority,
      conditions,
      conditionLogic,
      routing,
      notifyCSM,
      autoAcknowledge,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (!conditions || !Array.isArray(conditions)) {
      return res.status(400).json({ error: 'conditions array is required' });
    }

    if (!routing?.primaryTeam) {
      return res.status(400).json({ error: 'routing.primaryTeam is required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { data, error } = await supabase
      .from('feedback_routing_rules')
      .insert({
        name,
        description,
        priority: priority || 100,
        conditions,
        condition_logic: conditionLogic || 'AND',
        routing_primary_team: routing.primaryTeam,
        routing_secondary_teams: routing.secondaryTeams || [],
        routing_assign_to: routing.assignTo || null,
        notify_csm: notifyCSM ?? true,
        auto_acknowledge: autoAcknowledge ?? false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(req.organizationId ? { organization_id: req.organizationId } : {}),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      rule: data,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error creating rule:', error);
    res.status(500).json({ error: 'Failed to create routing rule' });
  }
});

/**
 * PUT /api/feedback/rules/:ruleId
 * Update routing rule
 */
router.put('/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.conditions !== undefined) updateData.conditions = updates.conditions;
    if (updates.conditionLogic !== undefined) updateData.condition_logic = updates.conditionLogic;
    if (updates.routing?.primaryTeam !== undefined) updateData.routing_primary_team = updates.routing.primaryTeam;
    if (updates.routing?.secondaryTeams !== undefined) updateData.routing_secondary_teams = updates.routing.secondaryTeams;
    if (updates.routing?.assignTo !== undefined) updateData.routing_assign_to = updates.routing.assignTo;
    if (updates.notifyCSM !== undefined) updateData.notify_csm = updates.notifyCSM;
    if (updates.autoAcknowledge !== undefined) updateData.auto_acknowledge = updates.autoAcknowledge;

    let updateQuery = supabase
      .from('feedback_routing_rules')
      .update(updateData)
      .eq('id', ruleId);

    if (req.organizationId) {
      updateQuery = updateQuery.eq('organization_id', req.organizationId);
    }

    const { data, error } = await updateQuery
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      rule: data,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error updating rule:', error);
    res.status(500).json({ error: 'Failed to update routing rule' });
  }
});

/**
 * DELETE /api/feedback/rules/:ruleId
 * Delete routing rule
 */
router.delete('/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    let deleteQuery = supabase
      .from('feedback_routing_rules')
      .delete()
      .eq('id', ruleId);

    if (req.organizationId) {
      deleteQuery = deleteQuery.eq('organization_id', req.organizationId);
    }

    const { error } = await deleteQuery;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Routing rule deleted',
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error deleting rule:', error);
    res.status(500).json({ error: 'Failed to delete routing rule' });
  }
});

// ============================================
// Teams
// ============================================

/**
 * GET /api/feedback/teams
 * Get feedback teams
 */
router.get('/teams', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      // Return default teams
      const { DEFAULT_TEAMS } = await import('../../types/feedback.js');
      return res.json({
        success: true,
        teams: DEFAULT_TEAMS,
      });
    }

    let query = supabase
      .from('feedback_teams')
      .select('*')
      .order('name');

    if (req.organizationId) {
      query = query.eq('organization_id', req.organizationId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      teams: data || [],
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error getting teams:', error);
    res.status(500).json({ error: 'Failed to get teams' });
  }
});

// ============================================
// Webhook Integrations
// ============================================

/**
 * POST /api/feedback/webhooks/intercom
 * Webhook for Intercom feedback
 */
router.post('/webhooks/intercom', async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    // Handle Intercom conversation events
    if (type === 'conversation.rating.added' || type === 'conversation_rating') {
      const rating = data?.rating;
      const remark = rating?.remark;
      const customerEmail = rating?.contact?.email || data?.user?.email;

      if (!customerEmail || rating?.value === undefined) {
        return res.status(200).json({ received: true, processed: false, reason: 'Missing data' });
      }

      // Look up customer by email domain
      if (supabase) {
        const domain = customerEmail.split('@')[1];
        let custQuery = supabase
          .from('customers')
          .select('id');
        custQuery = applyOrgFilter(custQuery, req);
        const { data: customers } = await custQuery
          .ilike('domain', `%${domain}%`)
          .limit(1);

        const customerId = customers?.[0]?.id;
        if (!customerId) {
          return res.status(200).json({ received: true, processed: false, reason: 'Customer not found' });
        }

        const content = remark || (rating.value <= 2 ? 'Negative support experience rating' : 'Positive support experience rating');

        await createFeedback({
          customerId,
          source: 'support',
          sourceId: data?.conversation_id || data?.id,
          submittedBy: {
            email: customerEmail,
            name: data?.user?.name,
          },
          content,
          metadata: {
            rating: rating.value,
            platform: 'intercom',
            conversationId: data?.conversation_id,
          },
        }, req.organizationId);
      }

      return res.status(200).json({ received: true, processed: true });
    }

    res.status(200).json({ received: true, processed: false });
  } catch (error) {
    console.error('[FeedbackRoutes] Error processing Intercom webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * POST /api/feedback/webhooks/zendesk
 * Webhook for Zendesk feedback
 */
router.post('/webhooks/zendesk', async (req: Request, res: Response) => {
  try {
    const { ticket, current_user, satisfaction } = req.body;

    if (!satisfaction || !current_user?.email) {
      return res.status(200).json({ received: true, processed: false, reason: 'Missing satisfaction data' });
    }

    if (supabase) {
      const domain = current_user.email.split('@')[1];
      let custQuery = supabase
        .from('customers')
        .select('id');
      custQuery = applyOrgFilter(custQuery, req);
      const { data: customers } = await custQuery
        .ilike('domain', `%${domain}%`)
        .limit(1);

      const customerId = customers?.[0]?.id;
      if (!customerId) {
        return res.status(200).json({ received: true, processed: false, reason: 'Customer not found' });
      }

      const content = satisfaction.comment ||
        (satisfaction.score === 'bad' ? 'Negative support satisfaction rating' :
         satisfaction.score === 'good' ? 'Positive support satisfaction rating' : 'Support interaction');

      await createFeedback({
        customerId,
        source: 'support',
        sourceId: ticket?.id?.toString(),
        submittedBy: {
          email: current_user.email,
          name: current_user.name,
        },
        content,
        metadata: {
          score: satisfaction.score,
          platform: 'zendesk',
          ticketId: ticket?.id,
        },
      }, req.organizationId);
    }

    res.status(200).json({ received: true, processed: true });
  } catch (error) {
    console.error('[FeedbackRoutes] Error processing Zendesk webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * POST /api/feedback/webhooks/generic
 * Generic webhook endpoint for custom integrations
 */
router.post('/webhooks/generic', async (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      customer_email,
      source,
      source_id,
      submitter_email,
      submitter_name,
      content,
      metadata,
    } = req.body;

    // Validate required fields
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    if (!submitter_email) {
      return res.status(400).json({ error: 'submitter_email is required' });
    }

    // Determine customer ID
    let customerId = customer_id;

    if (!customerId && customer_email && supabase) {
      const domain = customer_email.split('@')[1];
      let custQuery = supabase
        .from('customers')
        .select('id');
      custQuery = applyOrgFilter(custQuery, req);
      const { data: customers } = await custQuery
        .ilike('domain', `%${domain}%`)
        .limit(1);
      customerId = customers?.[0]?.id;
    }

    if (!customerId) {
      return res.status(400).json({ error: 'Could not determine customer. Provide customer_id or customer_email' });
    }

    const { feedback } = await createFeedback({
      customerId,
      source: source || 'widget',
      sourceId: source_id,
      submittedBy: {
        email: submitter_email,
        name: submitter_name,
      },
      content,
      metadata: metadata || {},
    }, req.organizationId);

    res.status(201).json({
      success: true,
      feedbackId: feedback.id,
      classification: feedback.classification,
      routing: feedback.routing,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error processing generic webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// ============================================
// User Feedback Widget (Compound Product Launch)
// CP-007, CP-008: Simple feedback from in-app widget
// ============================================

/**
 * POST /api/feedback/widget
 * Simple endpoint for in-app feedback widget
 * Stores to user_feedback table (not the complex feedback routing system)
 */
router.post('/widget', async (req: Request, res: Response) => {
  try {
    const { type, message, rating, context } = req.body;
    const userId = req.headers['x-user-id'] as string;

    // Validate required fields
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Validate type if provided
    const validTypes = ['general', 'feature_request', 'bug', 'praise'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      const ratingNum = parseInt(rating, 10);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ error: 'rating must be between 1 and 5' });
      }
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { data, error } = await supabase
      .from('user_feedback')
      .insert({
        user_id: userId || null,
        type: type || 'general',
        context: context || null,
        message: message.trim(),
        rating: rating ? parseInt(rating, 10) : null,
        metadata: {
          source: 'widget',
          user_agent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
        ...(req.organizationId ? { organization_id: req.organizationId } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error('[FeedbackRoutes] Widget feedback error:', error);
      throw error;
    }

    res.status(201).json({
      success: true,
      feedbackId: data.id,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Error submitting widget feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;
