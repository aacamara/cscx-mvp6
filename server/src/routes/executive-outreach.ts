/**
 * Executive Outreach Routes
 * PRD-031: Executive Sponsor Outreach
 *
 * API endpoints for executive-level communication workflows
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import {
  executiveOutreachGenerator,
  type OutreachPurpose,
  type ExecutiveOutreachRequest,
} from '../services/executive/index.js';
import { pendingActionsService } from '../services/pendingActions.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Executive Identification
// ============================================

/**
 * GET /api/customers/:customerId/executives
 * List executive stakeholders for a customer
 */
router.get('/:customerId/executives', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const executives = await executiveOutreachGenerator.getExecutives(customerId);

    res.json({
      success: true,
      executives,
      total: executives.length,
    });
  } catch (error) {
    console.error('Error fetching executives:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch executives',
    });
  }
});

// ============================================
// Executive Summary
// ============================================

/**
 * GET /api/customers/:customerId/executive-summary
 * Get executive-level partnership summary
 */
router.get('/:customerId/executive-summary', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const summary = await executiveOutreachGenerator.generateExecutiveSummary(customerId);

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Error generating executive summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate executive summary',
    });
  }
});

// ============================================
// Executive Outreach Generation
// ============================================

/**
 * POST /api/customers/:customerId/executive-outreach
 * Generate executive outreach email drafts
 *
 * Request body:
 * {
 *   executiveId?: string,       // Optional - specific executive to target
 *   purpose: OutreachPurpose,   // Type of outreach
 *   csmName?: string,           // CSM name for signature
 *   csmEmail?: string,          // CSM email for signature
 *   customMessage?: string,     // Custom message to include
 *   proposedDates?: Array<{date: string, time: string}>,  // For briefing requests
 *   expansionDetails?: {...},   // For expansion outreach
 *   escalationDetails?: {...},  // For escalation awareness
 * }
 */
router.post('/:customerId/executive-outreach', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const userId = req.headers['x-user-id'] as string;
    const {
      executiveId,
      purpose,
      csmName,
      csmEmail,
      customMessage,
      proposedDates,
      expansionDetails,
      escalationDetails,
    } = req.body;

    // Validate purpose
    const validPurposes: OutreachPurpose[] = [
      'introduction',
      'strategic_alignment',
      'pre_qbr',
      'escalation_awareness',
      'expansion',
      'value_summary',
    ];

    if (!purpose || !validPurposes.includes(purpose)) {
      return res.status(400).json({
        success: false,
        error: `Invalid purpose. Must be one of: ${validPurposes.join(', ')}`,
      });
    }

    const request: ExecutiveOutreachRequest = {
      customerId,
      executiveId,
      purpose,
      csmId: userId,
      csmName,
      csmEmail,
      customMessage,
      proposedDates,
      expansionDetails,
      escalationDetails,
    };

    const result = await executiveOutreachGenerator.generateOutreach(request);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        executives: result.executives,
      });
    }

    res.json({
      success: true,
      drafts: result.drafts,
      executives: result.executives,
      summary: result.summary,
    });
  } catch (error) {
    console.error('Error generating executive outreach:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate executive outreach',
    });
  }
});

/**
 * POST /api/customers/:customerId/executive-outreach/:draftId/enhance
 * Enhance a draft with AI personalization
 */
router.post('/:customerId/executive-outreach/:draftId/enhance', async (req: Request, res: Response) => {
  try {
    const { draft, executivePriorities } = req.body;

    if (!draft) {
      return res.status(400).json({
        success: false,
        error: 'Draft is required',
      });
    }

    const enhanced = await executiveOutreachGenerator.enhanceWithAI(draft, executivePriorities);

    res.json({
      success: true,
      draft: enhanced,
    });
  } catch (error) {
    console.error('Error enhancing draft:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enhance draft',
    });
  }
});

/**
 * POST /api/customers/:customerId/executive-outreach/:draftId/send
 * Queue executive outreach for sending (with HITL approval)
 */
router.post('/:customerId/executive-outreach/:draftId/send', async (req: Request, res: Response) => {
  try {
    const { customerId, draftId } = req.params;
    const userId = req.headers['x-user-id'] as string;
    const { draft, sendImmediately = false } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID required',
      });
    }

    if (!draft) {
      return res.status(400).json({
        success: false,
        error: 'Draft is required',
      });
    }

    // Create pending action for HITL approval
    const action = await pendingActionsService.createAction({
      userId,
      agentId: 'executive-outreach',
      customerId,
      type: 'send_email',
      details: {
        subject: draft.subject,
        to: draft.executiveEmail,
        body: draft.bodyText,
        bodyHtml: draft.bodyHtml,
        metadata: {
          draftId,
          executiveId: draft.executiveId,
          executiveName: draft.executiveName,
          purpose: draft.purpose,
          talkingPoints: draft.talkingPoints,
          suggestedSendTime: draft.suggestedSendTime,
        },
      },
    });

    // If sendImmediately is true and auto-approve is enabled, approve immediately
    // Otherwise, queue for HITL approval
    if (sendImmediately) {
      // This would trigger actual send - for now, just return the action
      // In production, this would integrate with Gmail service
    }

    res.json({
      success: true,
      message: 'Outreach queued for approval',
      action,
      requiresApproval: true,
    });
  } catch (error) {
    console.error('Error queuing outreach:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to queue outreach for sending',
    });
  }
});

/**
 * POST /api/customers/:customerId/executive-outreach/:draftId/sent
 * Record that an executive outreach was actually sent
 */
router.post('/:customerId/executive-outreach/:draftId/sent', async (req: Request, res: Response) => {
  try {
    const { customerId, draftId } = req.params;
    const { executiveId } = req.body;

    if (!executiveId) {
      return res.status(400).json({
        success: false,
        error: 'executiveId is required',
      });
    }

    await executiveOutreachGenerator.recordOutreachSent(draftId, executiveId, customerId);

    res.json({
      success: true,
      message: 'Outreach recorded as sent',
    });
  } catch (error) {
    console.error('Error recording outreach sent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record outreach',
    });
  }
});

// ============================================
// Executive Engagement Tracking
// ============================================

/**
 * GET /api/customers/:customerId/executive-engagement
 * Get executive engagement history for a customer
 */
router.get('/:customerId/executive-engagement', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit = '10' } = req.query;

    if (!supabase) {
      return res.json({
        success: true,
        engagements: [],
        message: 'Database not available',
      });
    }

    // Get executive stakeholders with engagement data
    const { data: executives, error: execError } = await supabase
      .from('stakeholders')
      .select('id, name, role, email, last_contact_at, last_exec_outreach, engagement_score, interaction_count, sentiment')
      .eq('customer_id', customerId)
      .eq('is_exec_sponsor', true)
      .order('last_contact_at', { ascending: false, nullsFirst: false });

    if (execError) throw execError;

    // Get recent executive outreach activities
    const { data: activities, error: actError } = await supabase
      .from('activity_feed')
      .select('*')
      .eq('customer_id', customerId)
      .in('action_type', ['executive_outreach_drafted', 'executive_outreach_sent'])
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (actError) throw actError;

    res.json({
      success: true,
      executives: executives || [],
      recentActivities: activities || [],
    });
  } catch (error) {
    console.error('Error fetching executive engagement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch executive engagement data',
    });
  }
});

/**
 * POST /api/customers/:customerId/executive-engagement/record
 * Record an executive engagement (meeting, call, email response)
 */
router.post('/:customerId/executive-engagement/record', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { executiveId, engagementType, notes, outcome } = req.body;

    if (!executiveId || !engagementType) {
      return res.status(400).json({
        success: false,
        error: 'executiveId and engagementType are required',
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    // Update stakeholder last contact
    await supabase
      .from('stakeholders')
      .update({
        last_contact_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', executiveId);

    // Increment interaction count using raw SQL
    await supabase.rpc('increment_interaction_count', { stakeholder_id: executiveId });

    // Log activity
    await supabase
      .from('activity_feed')
      .insert({
        id: uuidv4(),
        customer_id: customerId,
        action_type: `executive_engagement_${engagementType}`,
        action_data: {
          executiveId,
          engagementType,
          notes,
          outcome,
          recordedAt: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });

    res.json({
      success: true,
      message: 'Engagement recorded successfully',
    });
  } catch (error) {
    console.error('Error recording executive engagement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record engagement',
    });
  }
});

// ============================================
// Talking Points Generator
// ============================================

/**
 * GET /api/customers/:customerId/executive-talking-points
 * Generate talking points for an executive call
 */
router.get('/:customerId/executive-talking-points', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { executiveId, meetingType = 'general' } = req.query;

    // Get executive summary for context
    const summary = await executiveOutreachGenerator.generateExecutiveSummary(customerId);

    // Get executive details if provided
    let executive = null;
    if (executiveId) {
      executive = await executiveOutreachGenerator.getExecutive(executiveId as string);
    }

    // Generate talking points based on context
    const talkingPoints = generateTalkingPoints(summary, executive, meetingType as string);

    res.json({
      success: true,
      talkingPoints,
      summary,
      executive,
    });
  } catch (error) {
    console.error('Error generating talking points:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate talking points',
    });
  }
});

/**
 * Generate contextual talking points
 */
function generateTalkingPoints(
  summary: any,
  executive: any,
  meetingType: string
): { category: string; points: string[] }[] {
  const talkingPoints: { category: string; points: string[] }[] = [];

  // Opening / Relationship
  talkingPoints.push({
    category: 'Opening',
    points: executive?.lastContactDate
      ? [
          `Reference previous conversation: ${executive.lastContactContext || 'our last meeting'}`,
          `Acknowledge their time and appreciate the partnership`,
        ]
      : [
          `Introduce yourself and your role supporting ${summary.customerName}`,
          `Express appreciation for the opportunity to connect`,
        ],
  });

  // Partnership Value
  if (summary.partnershipHighlights && summary.partnershipHighlights.length > 0) {
    talkingPoints.push({
      category: 'Partnership Value',
      points: summary.partnershipHighlights.slice(0, 3).map((h: any) => `${h.metric}: ${h.value}${h.context ? ` (${h.context})` : ''}`),
    });
  }

  // Achievements
  if (summary.achievements && summary.achievements.length > 0) {
    talkingPoints.push({
      category: 'Key Achievements',
      points: summary.achievements.slice(0, 3),
    });
  }

  // Strategic Alignment
  if (summary.strategicInitiatives && summary.strategicInitiatives.length > 0) {
    talkingPoints.push({
      category: 'Strategic Alignment',
      points: [
        ...summary.strategicInitiatives.slice(0, 2),
        'Ask: What are your top priorities for the coming quarter?',
      ],
    });
  }

  // Meeting-type specific points
  switch (meetingType) {
    case 'qbr':
      talkingPoints.push({
        category: 'QBR Focus',
        points: [
          'Review quarterly objectives and outcomes',
          'Discuss roadmap alignment and upcoming features',
          'Gather feedback on partnership experience',
          'Align on priorities for next quarter',
        ],
      });
      break;
    case 'renewal':
      talkingPoints.push({
        category: 'Renewal Discussion',
        points: [
          'Summarize value delivered throughout partnership',
          'Discuss any concerns or unmet expectations',
          'Present renewal terms and expansion opportunities',
          'Confirm decision-making process and timeline',
        ],
      });
      break;
    case 'escalation':
      talkingPoints.push({
        category: 'Escalation Resolution',
        points: [
          'Acknowledge the issue and take ownership',
          'Present clear resolution plan and timeline',
          'Discuss preventive measures',
          'Confirm follow-up communication cadence',
        ],
      });
      break;
    default:
      talkingPoints.push({
        category: 'Discussion Topics',
        points: [
          'Understand evolving business priorities',
          'Identify opportunities for deeper partnership value',
          'Discuss any concerns or feedback',
          'Agree on next steps and follow-up',
        ],
      });
  }

  // Closing
  talkingPoints.push({
    category: 'Closing',
    points: [
      'Summarize key takeaways and action items',
      'Confirm preferred communication cadence',
      'Thank them for their time and partnership',
    ],
  });

  return talkingPoints;
}

export { router as executiveOutreachRoutes };
export default router;
