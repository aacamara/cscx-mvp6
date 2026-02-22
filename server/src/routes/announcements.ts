/**
 * Product Update Announcements Routes
 * PRD-033: Product Update Announcement
 *
 * API endpoints for generating and sending personalized product update announcements
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { productUpdateAnnouncementService } from '../services/announcements/productUpdate.js';
import { gmailService } from '../services/google/gmail.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ==================== Product Updates ====================

/**
 * GET /api/announcements/product-updates
 * List all product updates
 */
router.get('/product-updates', async (req: Request, res: Response) => {
  try {
    const { category, isMajor, limit, since } = req.query;

    const updates = await productUpdateAnnouncementService.listProductUpdates({
      category: category as string,
      isMajor: isMajor === 'true',
      limit: limit ? parseInt(limit as string) : undefined,
      since: since as string,
    });

    res.json({
      success: true,
      data: updates,
      total: updates.length,
    });
  } catch (error) {
    console.error('List product updates error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list product updates' }
    });
  }
});

/**
 * GET /api/announcements/product-updates/:id
 * Get a single product update
 */
router.get('/product-updates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const update = await productUpdateAnnouncementService.getProductUpdate(id);
    if (!update) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Product update not found' }
      });
    }

    res.json({
      success: true,
      data: update,
    });
  } catch (error) {
    console.error('Get product update error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get product update' }
    });
  }
});

/**
 * POST /api/announcements/product-updates
 * Create a new product update
 */
router.post('/product-updates', async (req: Request, res: Response) => {
  try {
    const {
      title,
      slug,
      version,
      releaseDate,
      category,
      description,
      keyBenefits,
      useCases,
      affectedProducts,
      documentationUrl,
      migrationGuideUrl,
      trainingUrl,
      videoUrl,
      relevanceCriteria,
      targetSegments,
      targetEntitlements,
      isMajor,
    } = req.body;

    if (!title || !releaseDate || !category || !description) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'title, releaseDate, category, and description are required' }
      });
    }

    const update = await productUpdateAnnouncementService.createProductUpdate({
      title,
      slug,
      version,
      releaseDate,
      category,
      description,
      keyBenefits: keyBenefits || [],
      useCases: useCases || [],
      affectedProducts: affectedProducts || [],
      documentationUrl,
      migrationGuideUrl,
      trainingUrl,
      videoUrl,
      relevanceCriteria,
      targetSegments,
      targetEntitlements,
      isMajor: isMajor || false,
    });

    if (!update) {
      return res.status(500).json({
        error: { code: 'CREATE_FAILED', message: 'Failed to create product update' }
      });
    }

    res.status(201).json({
      success: true,
      data: update,
    });
  } catch (error) {
    console.error('Create product update error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create product update' }
    });
  }
});

// ==================== Customer Relevance ====================

/**
 * GET /api/announcements/product-updates/:id/relevant-customers
 * Find customers who would benefit from a product update
 */
router.get('/product-updates/:id/relevant-customers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, segment, minHealthScore } = req.query;

    const update = await productUpdateAnnouncementService.getProductUpdate(id);
    if (!update) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Product update not found' }
      });
    }

    const relevantCustomers = await productUpdateAnnouncementService.findRelevantCustomers(id, {
      limit: limit ? parseInt(limit as string) : undefined,
      segment: segment as string,
      minHealthScore: minHealthScore ? parseInt(minHealthScore as string) : undefined,
    });

    // Group by relevance tier
    const tiers = {
      high: relevantCustomers.filter(c => c.score >= 0.7),
      medium: relevantCustomers.filter(c => c.score >= 0.4 && c.score < 0.7),
      low: relevantCustomers.filter(c => c.score < 0.4),
    };

    res.json({
      success: true,
      data: {
        productUpdate: {
          id: update.id,
          title: update.title,
          releaseDate: update.releaseDate,
        },
        totalCustomers: relevantCustomers.length,
        tiers: {
          high: tiers.high.length,
          medium: tiers.medium.length,
          low: tiers.low.length,
        },
        customers: relevantCustomers,
      },
    });
  } catch (error) {
    console.error('Find relevant customers error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to find relevant customers' }
    });
  }
});

// ==================== Announcement Generation ====================

/**
 * POST /api/announcements/product-update
 * Generate personalized product update emails for multiple customers
 */
router.post('/product-update', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || req.body.userId;
    const {
      productUpdateId,
      customerIds,
      targetType,
      targetCriteria,
      campaignName,
      templateType,
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    if (!productUpdateId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'productUpdateId is required' }
      });
    }

    const result = await productUpdateAnnouncementService.createBulkAnnouncementCampaign(
      productUpdateId,
      userId,
      {
        targetType,
        targetCriteria,
        customerIds,
        name: campaignName,
      }
    );

    if (!result || result.drafts.length === 0) {
      return res.status(404).json({
        error: { code: 'NO_CUSTOMERS', message: 'No relevant customers found for this product update' }
      });
    }

    res.status(201).json({
      success: true,
      message: `Generated ${result.drafts.length} personalized announcement drafts`,
      data: {
        campaignId: result.campaignId,
        productUpdateId: result.productUpdateId,
        totalCustomers: result.totalCustomers,
        summary: result.summary,
        drafts: result.drafts.map(draft => ({
          customerId: draft.customerId,
          customerName: draft.customerName,
          recipientName: draft.recipientName,
          recipientEmail: draft.recipientEmail,
          subject: draft.subject,
          relevanceScore: draft.relevanceScore,
          relevanceReasons: draft.relevanceReasons,
          preview: draft.bodyText.substring(0, 300) + '...',
        })),
      },
    });
  } catch (error) {
    console.error('Generate announcements error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate announcement emails' }
    });
  }
});

/**
 * GET /api/announcements/campaigns/:campaignId/drafts
 * Get all drafts for a campaign
 */
router.get('/campaigns/:campaignId/drafts', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    const { data: drafts, error } = await supabase
      .from('announcement_sends')
      .select(`
        *,
        customers(name, segment, arr, health_score)
      `)
      .eq('campaign_id', campaignId)
      .order('relevance_score', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: { code: 'QUERY_ERROR', message: 'Failed to fetch drafts' }
      });
    }

    res.json({
      success: true,
      data: drafts.map((d: any) => ({
        id: d.id,
        customerId: d.customer_id,
        customerName: d.customers?.name,
        segment: d.customers?.segment,
        arr: d.customers?.arr,
        healthScore: d.customers?.health_score,
        recipientName: d.recipient_name,
        recipientEmail: d.recipient_email,
        status: d.status,
        subject: d.subject,
        relevanceScore: d.relevance_score,
        relevanceReasons: d.relevance_reasons,
        bodyHtml: d.body_html,
        bodyText: d.body_text,
        sentAt: d.sent_at,
        openedAt: d.opened_at,
      })),
      total: drafts.length,
    });
  } catch (error) {
    console.error('Get campaign drafts error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get campaign drafts' }
    });
  }
});

/**
 * PUT /api/announcements/drafts/:draftId
 * Update a specific draft
 */
router.put('/drafts/:draftId', async (req: Request, res: Response) => {
  try {
    const { draftId } = req.params;
    const { subject, bodyHtml, bodyText } = req.body;

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    const { error } = await supabase
      .from('announcement_sends')
      .update({
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    if (error) {
      return res.status(500).json({
        error: { code: 'UPDATE_ERROR', message: 'Failed to update draft' }
      });
    }

    res.json({
      success: true,
      message: 'Draft updated successfully',
    });
  } catch (error) {
    console.error('Update draft error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update draft' }
    });
  }
});

// ==================== Bulk Send ====================

/**
 * POST /api/announcements/bulk-send
 * Submit drafts for approval and bulk send
 */
router.post('/bulk-send', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || req.body.userId;
    const { campaignId, draftIds, sendImmediately } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    if (!campaignId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'campaignId is required' }
      });
    }

    if (sendImmediately) {
      // Direct send without approval (for testing/admin)
      const result = await sendCampaignEmails(campaignId, userId, draftIds);
      return res.json({
        success: true,
        message: `Sent ${result.sent} emails`,
        data: result,
      });
    }

    // Submit for approval
    const { approvalIds, count } = await productUpdateAnnouncementService.submitForApproval(
      campaignId,
      userId,
      draftIds
    );

    // Update campaign status
    if (supabase) {
      await supabase
        .from('announcement_campaigns')
        .update({ status: 'scheduled' })
        .eq('id', campaignId);
    }

    res.json({
      success: true,
      message: `${count} emails submitted for approval`,
      data: {
        campaignId,
        approvalCount: count,
        approvalIds,
      },
    });
  } catch (error) {
    console.error('Bulk send error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit for bulk send' }
    });
  }
});

/**
 * POST /api/announcements/send/:sendId
 * Send a specific announcement email (after approval)
 */
router.post('/send/:sendId', async (req: Request, res: Response) => {
  try {
    const { sendId } = req.params;
    const userId = req.headers['x-user-id'] as string || req.body.userId;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    // Get the send record
    const { data: send, error: fetchError } = await supabase
      .from('announcement_sends')
      .select('*')
      .eq('id', sendId)
      .single();

    if (fetchError || !send) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Announcement send not found' }
      });
    }

    // Check approval status
    if (send.status !== 'approved' && send.status !== 'draft') {
      return res.status(400).json({
        error: { code: 'INVALID_STATUS', message: `Cannot send email with status: ${send.status}` }
      });
    }

    // Send via Gmail
    const messageId = await gmailService.sendEmail(userId, {
      to: [send.recipient_email],
      subject: send.subject,
      bodyHtml: send.body_html,
      bodyText: send.body_text,
      saveToDb: true,
      customerId: send.customer_id,
    });

    // Update send record
    await supabase
      .from('announcement_sends')
      .update({
        status: 'sent',
        gmail_message_id: messageId,
        sent_at: new Date().toISOString(),
      })
      .eq('id', sendId);

    // Log activity
    await supabase.from('agent_activity_log').insert({
      user_id: userId,
      customer_id: send.customer_id,
      agent_type: 'communicator',
      action_type: 'announcement_sent',
      action_data: {
        sendId,
        productUpdateId: send.product_update_id,
        subject: send.subject,
        recipient: send.recipient_email,
      },
      result_data: { messageId },
      status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Announcement sent successfully',
      data: {
        sendId,
        messageId,
        sentAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Send announcement error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send announcement' }
    });
  }
});

// ==================== Feature Requests ====================

/**
 * GET /api/announcements/feature-requests
 * List customer feature requests
 */
router.get('/feature-requests', async (req: Request, res: Response) => {
  try {
    const { customerId, status, limit } = req.query;

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    let query = supabase
      .from('customer_feature_requests')
      .select(`
        *,
        customers(name, segment),
        product_updates(title, release_date)
      `)
      .order('requested_at', { ascending: false });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (limit) {
      query = query.limit(parseInt(limit as string));
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({
        error: { code: 'QUERY_ERROR', message: 'Failed to fetch feature requests' }
      });
    }

    res.json({
      success: true,
      data: data.map((r: any) => ({
        id: r.id,
        customerId: r.customer_id,
        customerName: r.customers?.name,
        customerSegment: r.customers?.segment,
        title: r.title,
        description: r.description,
        category: r.category,
        priority: r.priority,
        status: r.status,
        requestedAt: r.requested_at,
        resolvedAt: r.resolved_at,
        linkedProductUpdate: r.product_updates ? {
          id: r.product_update_id,
          title: r.product_updates.title,
          releaseDate: r.product_updates.release_date,
        } : null,
      })),
      total: data.length,
    });
  } catch (error) {
    console.error('Get feature requests error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get feature requests' }
    });
  }
});

/**
 * POST /api/announcements/feature-requests
 * Create a feature request
 */
router.post('/feature-requests', async (req: Request, res: Response) => {
  try {
    const { customerId, stakeholderId, title, description, category, priority } = req.body;

    if (!customerId || !title) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'customerId and title are required' }
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    const { data, error } = await supabase
      .from('customer_feature_requests')
      .insert({
        customer_id: customerId,
        stakeholder_id: stakeholderId,
        title,
        description,
        category,
        priority: priority || 'medium',
        status: 'requested',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: { code: 'CREATE_ERROR', message: 'Failed to create feature request' }
      });
    }

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Create feature request error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create feature request' }
    });
  }
});

/**
 * PUT /api/announcements/feature-requests/:id/link
 * Link a feature request to a product update
 */
router.put('/feature-requests/:id/link', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { productUpdateId, status } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    const { error } = await supabase
      .from('customer_feature_requests')
      .update({
        product_update_id: productUpdateId,
        status: status || 'released',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', id);

    if (error) {
      return res.status(500).json({
        error: { code: 'UPDATE_ERROR', message: 'Failed to link feature request' }
      });
    }

    res.json({
      success: true,
      message: 'Feature request linked to product update',
    });
  } catch (error) {
    console.error('Link feature request error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to link feature request' }
    });
  }
});

// ==================== Adoption Tracking ====================

/**
 * GET /api/announcements/adoption/:productUpdateId
 * Get adoption metrics for a product update
 */
router.get('/adoption/:productUpdateId', async (req: Request, res: Response) => {
  try {
    const { productUpdateId } = req.params;

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    const { data, error } = await supabase
      .from('feature_adoption')
      .select(`
        *,
        customers(name, segment, arr)
      `)
      .eq('product_update_id', productUpdateId);

    if (error) {
      return res.status(500).json({
        error: { code: 'QUERY_ERROR', message: 'Failed to fetch adoption data' }
      });
    }

    // Calculate adoption summary
    const statusCounts: Record<string, number> = {
      not_started: 0,
      exploring: 0,
      piloting: 0,
      adopted: 0,
      heavy_usage: 0,
    };

    let totalAdoptionScore = 0;
    for (const adoption of data) {
      statusCounts[adoption.adoption_status] = (statusCounts[adoption.adoption_status] || 0) + 1;
      totalAdoptionScore += adoption.adoption_score || 0;
    }

    res.json({
      success: true,
      data: {
        productUpdateId,
        totalCustomers: data.length,
        averageAdoptionScore: data.length > 0 ? totalAdoptionScore / data.length : 0,
        statusBreakdown: statusCounts,
        adoptionRate: data.length > 0
          ? ((statusCounts.adopted + statusCounts.heavy_usage) / data.length) * 100
          : 0,
        customers: data.map((a: any) => ({
          customerId: a.customer_id,
          customerName: a.customers?.name,
          segment: a.customers?.segment,
          arr: a.customers?.arr,
          status: a.adoption_status,
          adoptionScore: a.adoption_score,
          firstUsedAt: a.first_used_at,
          lastUsedAt: a.last_used_at,
          usageCount: a.usage_count,
          feedback: a.feedback,
          feedbackSentiment: a.feedback_sentiment,
        })),
      },
    });
  } catch (error) {
    console.error('Get adoption metrics error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get adoption metrics' }
    });
  }
});

/**
 * POST /api/announcements/adoption/:productUpdateId/:customerId
 * Track feature adoption for a customer
 */
router.post('/adoption/:productUpdateId/:customerId', async (req: Request, res: Response) => {
  try {
    const { productUpdateId, customerId } = req.params;
    const { status, usageCount, feedback, feedbackSentiment } = req.body;

    if (!status) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'status is required' }
      });
    }

    await productUpdateAnnouncementService.trackAdoption(
      productUpdateId,
      customerId,
      status,
      { usageCount, feedback, feedbackSentiment }
    );

    res.json({
      success: true,
      message: 'Adoption tracked successfully',
    });
  } catch (error) {
    console.error('Track adoption error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to track adoption' }
    });
  }
});

// ==================== Helper Functions ====================

async function sendCampaignEmails(
  campaignId: string,
  userId: string,
  draftIds?: string[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  if (!supabase) {
    return { sent: 0, failed: 0, errors: ['Database not configured'] };
  }

  let query = supabase
    .from('announcement_sends')
    .select('*')
    .eq('campaign_id', campaignId)
    .in('status', ['draft', 'approved']);

  if (draftIds && draftIds.length > 0) {
    query = query.in('id', draftIds);
  }

  const { data: sends, error } = await query;
  if (error || !sends) {
    return { sent: 0, failed: 0, errors: ['Failed to fetch drafts'] };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const send of sends) {
    try {
      const messageId = await gmailService.sendEmail(userId, {
        to: [send.recipient_email],
        subject: send.subject,
        bodyHtml: send.body_html,
        bodyText: send.body_text,
        saveToDb: true,
        customerId: send.customer_id,
      });

      await supabase
        .from('announcement_sends')
        .update({
          status: 'sent',
          gmail_message_id: messageId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', send.id);

      sent++;
    } catch (err: any) {
      failed++;
      errors.push(`${send.recipient_email}: ${err.message}`);

      await supabase
        .from('announcement_sends')
        .update({
          status: 'failed',
          error_message: err.message,
        })
        .eq('id', send.id);
    }
  }

  // Update campaign status
  await supabase
    .from('announcement_campaigns')
    .update({
      status: failed === 0 ? 'completed' : 'completed',
      completed_at: new Date().toISOString(),
      sent_count: sent,
    })
    .eq('id', campaignId);

  return { sent, failed, errors };
}

export default router;
