/**
 * Renewal Checklist Routes (PRD-089)
 *
 * API endpoints for renewal preparation checklists:
 * - GET /api/customers/:customerId/renewal-checklist - Get overview
 * - POST /api/customers/:customerId/renewal-checklist - Create checklist
 * - PATCH /api/renewal-checklists/:checklistId/items/:itemId - Update item
 * - POST /api/renewal-checklists/:checklistId/items - Add custom item
 * - POST /api/customers/:customerId/renewal-docs/regenerate - Regenerate document
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';
import {
  renewalChecklistService,
  MilestoneType,
  ItemStatus,
  ItemPriority,
  RENEWAL_CHECKLISTS
} from '../services/renewalChecklist.js';
import { sendSlackAlert } from '../services/notifications/slack.js';

const router = Router();
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Customer Renewal Checklist Endpoints
// ============================================

/**
 * GET /api/customers/:customerId/renewal-checklist
 * Get renewal checklist overview for a customer
 */
router.get('/customers/:customerId/renewal-checklist', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // Get customer data
    let customerData = null;
    if (supabase) {
      let custQuery = supabase
        .from('customers')
        .select('id, name, arr, health_score, renewal_date, segment, stage');
      custQuery = applyOrgFilter(custQuery, req);
      const { data } = await custQuery
        .eq('id', customerId)
        .single();
      customerData = data;
    }

    if (!customerData) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get checklist overview
    const overview = await renewalChecklistService.getRenewalChecklistOverview(customerId);

    // Build response matching PRD spec
    const response = {
      customer: {
        id: customerData.id,
        name: customerData.name,
        arr: customerData.arr,
        healthScore: customerData.health_score,
        segment: customerData.segment,
        status: customerData.stage
      },
      renewal: {
        date: overview.renewalDate,
        daysUntil: overview.daysUntilRenewal
      },
      currentMilestone: overview.currentMilestone,
      checklists: overview.checklists,
      documents: {
        valueSummary: overview.documents.find(d => d.type === 'value_summary') || null,
        renewalProposal: overview.documents.find(d => d.type === 'renewal_proposal') || null
      },
      templates: RENEWAL_CHECKLISTS
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting renewal checklist:', error);
    res.status(500).json({ error: 'Failed to get renewal checklist' });
  }
});

/**
 * POST /api/customers/:customerId/renewal-checklist
 * Create or trigger a milestone checklist
 */
router.post('/customers/:customerId/renewal-checklist', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { milestone, inheritIncomplete = true } = req.body;

    if (!milestone || !['90_day', '60_day', '30_day', '7_day'].includes(milestone)) {
      return res.status(400).json({
        error: 'Valid milestone required: 90_day, 60_day, 30_day, or 7_day'
      });
    }

    // Get customer data
    let customerData = null;
    if (supabase) {
      let custQuery = supabase
        .from('customers')
        .select('id, name, arr, health_score, renewal_date, segment');
      custQuery = applyOrgFilter(custQuery, req);
      const { data } = await custQuery
        .eq('id', customerId)
        .single();
      customerData = data;
    }

    if (!customerData) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (!customerData.renewal_date) {
      return res.status(400).json({ error: 'Customer has no renewal date set' });
    }

    // Get previous checklist for inheritance
    let previousChecklist = null;
    if (inheritIncomplete) {
      previousChecklist = await renewalChecklistService.getCustomerChecklist(
        customerId,
        getPreviousMilestone(milestone as MilestoneType)
      );
    }

    // Create the checklist
    const checklist = await renewalChecklistService.createChecklist(
      customerId,
      new Date(customerData.renewal_date),
      milestone as MilestoneType,
      {
        arr: customerData.arr,
        healthScore: customerData.health_score,
        segment: customerData.segment,
        inheritIncomplete,
        previousChecklist: previousChecklist || undefined
      }
    );

    // Log the alert
    await renewalChecklistService.logAlert(
      customerId,
      checklist.id,
      milestone as MilestoneType,
      'milestone_triggered',
      'api',
      { triggeredBy: 'manual' }
    );

    res.status(201).json({
      checklist,
      message: `Created ${milestone} checklist with ${checklist.items.length} items`
    });
  } catch (error) {
    console.error('Error creating renewal checklist:', error);
    res.status(500).json({ error: 'Failed to create renewal checklist' });
  }
});

// ============================================
// Checklist Item Endpoints
// ============================================

/**
 * PATCH /api/renewal-checklists/:checklistId/items/:itemId
 * Update a checklist item status
 */
router.patch('/renewal-checklists/:checklistId/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { checklistId, itemId } = req.params;
    const { status, notes } = req.body;
    const userId = (req as any).userId || 'system';

    if (status && !['pending', 'in_progress', 'completed', 'skipped'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Use: pending, in_progress, completed, or skipped'
      });
    }

    const checklist = await renewalChecklistService.updateItem(checklistId, itemId, {
      status: status as ItemStatus,
      notes,
      completedBy: userId
    });

    if (!checklist) {
      return res.status(404).json({ error: 'Checklist or item not found' });
    }

    res.json({
      checklist,
      item: checklist.items.find(i => i.id === itemId)
    });
  } catch (error) {
    console.error('Error updating checklist item:', error);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

/**
 * POST /api/renewal-checklists/:checklistId/items
 * Add a custom item to a checklist
 */
router.post('/renewal-checklists/:checklistId/items', async (req: Request, res: Response) => {
  try {
    const { checklistId } = req.params;
    const { title, description, priority = 'medium' } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
      return res.status(400).json({
        error: 'Invalid priority. Use: low, medium, high, or critical'
      });
    }

    const checklist = await renewalChecklistService.addCustomItem(checklistId, {
      id: `custom_${Date.now()}`,
      title,
      description,
      priority: priority as ItemPriority
    });

    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    res.status(201).json({
      checklist,
      message: 'Custom item added'
    });
  } catch (error) {
    console.error('Error adding custom item:', error);
    res.status(500).json({ error: 'Failed to add custom item' });
  }
});

// ============================================
// Document Generation Endpoints
// ============================================

/**
 * POST /api/customers/:customerId/renewal-docs/regenerate
 * Regenerate a renewal document
 */
router.post('/customers/:customerId/renewal-docs/regenerate', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { documentType, checklistId } = req.body;
    const userId = (req as any).userId || 'system';

    if (!documentType || !['value_summary', 'renewal_proposal'].includes(documentType)) {
      return res.status(400).json({
        error: 'Valid documentType required: value_summary or renewal_proposal'
      });
    }

    // Get customer data for document variables
    let customerData = null;
    if (supabase) {
      let custQuery = supabase
        .from('customers')
        .select('*');
      custQuery = applyOrgFilter(custQuery, req);
      const { data } = await custQuery
        .eq('id', customerId)
        .single();
      customerData = data;
    }

    if (!customerData) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Build document variables
    const variables: Record<string, string> = {
      customerName: customerData.name,
      date: new Date().toLocaleDateString(),
      arr: customerData.arr ? `$${customerData.arr.toLocaleString()}` : 'N/A',
      renewalDate: customerData.renewal_date
        ? new Date(customerData.renewal_date).toLocaleDateString()
        : 'N/A',
      healthScore: (customerData.health_score || 70).toString(),
      overview: `${customerData.name} has been a valued partner since ${
        customerData.created_at
          ? new Date(customerData.created_at).getFullYear()
          : 'joining'
      }.`,
      metrics: 'Key metrics will be populated from usage data.',
      outcomes: 'Business outcomes delivered during the partnership.',
      savings: 'Time and cost savings analysis.',
      testimonials: 'Customer feedback and testimonials.',
      potential: 'Future growth opportunities and recommendations.'
    };

    // For renewal proposal, add additional fields
    if (documentType === 'renewal_proposal') {
      variables.summary = `Partnership summary for ${customerData.name}`;
      variables.valueDelivered = 'Summary of value delivered during the contract period.';
      variables.roiAnalysis = 'Return on investment analysis.';
      variables.terms = 'Proposed renewal terms and pricing.';
      variables.expansion = 'Expansion and growth opportunities.';
      variables.nextSteps = 'Recommended next steps for renewal.';
    }

    // Generate document
    const result = await renewalChecklistService.generateDocument(
      userId,
      customerId,
      checklistId || '',
      documentType,
      variables
    );

    if (!result) {
      return res.status(500).json({
        error: 'Failed to generate document. Check Google Workspace connection.'
      });
    }

    res.json({
      documentId: result.id,
      url: result.url,
      type: documentType,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error regenerating document:', error);
    res.status(500).json({ error: 'Failed to regenerate document' });
  }
});

// ============================================
// Milestone Trigger Endpoints (for scheduled jobs)
// ============================================

/**
 * POST /api/renewal-checklists/process-milestones
 * Process upcoming renewals and trigger milestone checklists
 * (Called by scheduled job)
 */
router.post('/renewal-checklists/process-milestones', async (req: Request, res: Response) => {
  try {
    const webhookUrl = req.body.slackWebhookUrl;

    // Get upcoming renewals
    const upcomingRenewals = await renewalChecklistService.getUpcomingRenewalsForMilestone();

    const results = {
      processed: 0,
      created: 0,
      skipped: 0,
      alerts: 0,
      errors: [] as string[]
    };

    for (const renewal of upcomingRenewals) {
      results.processed++;

      if (renewal.hasChecklist) {
        results.skipped++;
        continue;
      }

      try {
        // Get previous milestone checklist for inheritance
        const previousMilestone = getPreviousMilestone(renewal.milestone);
        let previousChecklist = null;
        if (previousMilestone) {
          previousChecklist = await renewalChecklistService.getCustomerChecklist(
            renewal.customerId,
            previousMilestone
          );
        }

        // Create checklist
        const checklist = await renewalChecklistService.createChecklist(
          renewal.customerId,
          renewal.renewalDate,
          renewal.milestone,
          {
            arr: renewal.arr,
            healthScore: renewal.healthScore,
            segment: renewal.segment,
            inheritIncomplete: true,
            previousChecklist: previousChecklist || undefined
          }
        );

        results.created++;

        // Log alert
        await renewalChecklistService.logAlert(
          renewal.customerId,
          checklist.id,
          renewal.milestone,
          'milestone_triggered',
          'scheduled',
          { daysUntil: renewal.daysUntil }
        );

        // Send Slack alert if webhook configured
        if (webhookUrl) {
          const alertSent = await sendSlackAlert(webhookUrl, {
            type: 'renewal_soon',
            title: `${getMilestoneEmoji(renewal.milestone)} Renewal Approaching: ${renewal.customerName}`,
            message: buildMilestoneMessage(renewal, checklist),
            customer: {
              id: renewal.customerId,
              name: renewal.customerName,
              arr: renewal.arr,
              healthScore: renewal.healthScore
            },
            priority: renewal.milestone === '7_day' ? 'urgent' : renewal.milestone === '30_day' ? 'high' : 'medium',
            actionUrl: `/customers/${renewal.customerId}`,
            fields: {
              daysUntilRenewal: renewal.daysUntil,
              milestone: RENEWAL_CHECKLISTS[renewal.milestone].name,
              checklistItems: checklist.items.length
            }
          });

          if (alertSent) results.alerts++;
        }
      } catch (error) {
        results.errors.push(`${renewal.customerName}: ${(error as Error).message}`);
      }
    }

    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('Error processing milestones:', error);
    res.status(500).json({ error: 'Failed to process milestones' });
  }
});

/**
 * GET /api/renewal-checklists/upcoming
 * Get list of upcoming renewals with their status
 */
router.get('/renewal-checklists/upcoming', async (req: Request, res: Response) => {
  try {
    const renewals = await renewalChecklistService.getUpcomingRenewalsForMilestone();

    res.json({
      count: renewals.length,
      renewals: renewals.map(r => ({
        ...r,
        milestoneName: RENEWAL_CHECKLISTS[r.milestone].name,
        alertSeverity: renewalChecklistService.getAlertSeverity(r.milestone)
      }))
    });
  } catch (error) {
    console.error('Error getting upcoming renewals:', error);
    res.status(500).json({ error: 'Failed to get upcoming renewals' });
  }
});

// ============================================
// Helper Functions
// ============================================

function getPreviousMilestone(milestone: MilestoneType): MilestoneType | null {
  switch (milestone) {
    case '60_day': return '90_day';
    case '30_day': return '60_day';
    case '7_day': return '30_day';
    default: return null;
  }
}

function getMilestoneEmoji(milestone: MilestoneType): string {
  switch (milestone) {
    case '7_day': return ':rotating_light:';
    case '30_day': return ':warning:';
    case '60_day': return ':calendar:';
    case '90_day': return ':calendar:';
    default: return ':calendar:';
  }
}

function buildMilestoneMessage(
  renewal: { daysUntil: number; milestone: MilestoneType; healthScore: number },
  checklist: { items: Array<{ title: string }> }
): string {
  const days = renewal.daysUntil;
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  let message = `*${days} days until renewal* (${date})\n\n`;
  message += `*Prep Checklist Generated:*\n`;

  checklist.items.slice(0, 5).forEach(item => {
    message += `- [ ] ${item.title}\n`;
  });

  if (checklist.items.length > 5) {
    message += `_...and ${checklist.items.length - 5} more items_\n`;
  }

  if (renewal.healthScore < 60) {
    message += `\n:rotating_light: *At-Risk Account* - Health score: ${renewal.healthScore}`;
  }

  return message;
}

export { router as renewalChecklistRoutes };
