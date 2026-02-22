/**
 * Expansion Routes (PRD-103: Expansion Signal Detected)
 *
 * API endpoints for expansion signal detection, opportunity management,
 * and Slack notifications.
 *
 * Endpoints:
 * - GET  /api/expansion/scan                        - Scan all customers for expansion signals
 * - GET  /api/expansion/signals/:customerId         - Detect signals for specific customer
 * - GET  /api/expansion/opportunities               - List active expansion opportunities
 * - GET  /api/expansion/opportunities/:opportunityId - Get opportunity details
 * - POST /api/expansion/opportunities               - Create opportunity from detection
 * - PATCH /api/expansion/opportunities/:opportunityId/stage - Update opportunity stage
 * - POST /api/expansion/opportunities/:opportunityId/notify-sales - Notify sales rep
 * - POST /api/expansion/alert/csm                   - Send CSM Slack alert
 * - POST /api/expansion/alert/sales                 - Send Sales Slack alert
 */

import { Router, Request, Response } from 'express';
import { expansionDetector } from '../services/expansion/detector.js';
import { expansionOpportunityService } from '../services/expansion/opportunity-service.js';
import { expansionSlackAlerts } from '../services/expansion/slack-alerts.js';
import { expansionWorkflowService } from '../services/expansion/workflow.js';
import { ExpansionStage } from '../services/expansion/types.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Signal Detection Endpoints
// ============================================

/**
 * GET /api/expansion/scan
 *
 * Scan all active customers for expansion signals.
 * This is typically called by a scheduled job daily.
 *
 * Query Parameters:
 * - minScore (optional): Minimum composite score threshold (default: 0.6)
 * - limit (optional): Maximum number of results to return
 */
router.get('/scan', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const minScore = parseFloat(req.query.minScore as string) || 0.6;
    const limit = parseInt(req.query.limit as string) || 50;

    console.log(`[Expansion] Starting scan with minScore=${minScore}, limit=${limit}`);

    const results = await expansionDetector.scanAllCustomers(minScore);

    // Apply limit
    const limitedResults = results.slice(0, limit);

    const responseTime = Date.now() - startTime;
    console.log(`[Expansion] Scan complete: ${limitedResults.length} customers with signals in ${responseTime}ms`);

    return res.json({
      success: true,
      data: {
        detections: limitedResults,
        summary: {
          totalScanned: results.length,
          returned: limitedResults.length,
          highScore: limitedResults.filter(r => r.compositeScore >= 0.8).length,
          mediumScore: limitedResults.filter(r => r.compositeScore >= 0.6 && r.compositeScore < 0.8).length,
          totalEstimatedArr: limitedResults.reduce((sum, r) => sum + r.estimatedExpansionArr, 0),
        },
      },
      meta: {
        scannedAt: new Date().toISOString(),
        responseTimeMs: responseTime,
        minScoreThreshold: minScore,
      },
    });
  } catch (error) {
    console.error('[Expansion] Scan error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'SCAN_FAILED',
        message: 'Failed to scan for expansion signals',
      },
    });
  }
});

/**
 * GET /api/expansion/signals/:customerId
 *
 * Detect expansion signals for a specific customer.
 */
router.get('/signals/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    const detection = await expansionDetector.detectSignals(customerId);

    const responseTime = Date.now() - startTime;

    if (!detection) {
      return res.json({
        success: true,
        data: {
          customerId,
          signals: [],
          compositeScore: 0,
          message: 'No expansion signals detected',
        },
        meta: {
          detectedAt: new Date().toISOString(),
          responseTimeMs: responseTime,
        },
      });
    }

    console.log(`[Expansion] Detected ${detection.signals.length} signals for ${detection.customerName} (score: ${detection.compositeScore.toFixed(2)})`);

    return res.json({
      success: true,
      data: detection,
      meta: {
        detectedAt: new Date().toISOString(),
        responseTimeMs: responseTime,
      },
    });
  } catch (error) {
    console.error('[Expansion] Signal detection error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'DETECTION_FAILED',
        message: 'Failed to detect expansion signals',
      },
    });
  }
});

// ============================================
// Opportunity Management Endpoints
// ============================================

/**
 * GET /api/expansion/opportunities
 *
 * List active expansion opportunities.
 *
 * Query Parameters:
 * - stage (optional): Filter by stage (detected, qualified, proposed, negotiating)
 * - timeline (optional): Filter by timeline (immediate, this_quarter, next_quarter)
 * - minScore (optional): Minimum composite score
 */
router.get('/opportunities', async (req: Request, res: Response) => {
  try {
    const stage = req.query.stage as ExpansionStage[] | undefined;
    const timeline = req.query.timeline as any;
    const minScore = parseFloat(req.query.minScore as string) || undefined;

    const opportunities = await expansionOpportunityService.listActiveOpportunities({
      stage: stage ? (Array.isArray(stage) ? stage : [stage]) : undefined,
      timeline,
      minCompositeScore: minScore,
    });

    return res.json({
      success: true,
      data: {
        opportunities,
        summary: {
          total: opportunities.length,
          totalEstimatedValue: opportunities.reduce((sum, o) => sum + o.estimatedValue, 0),
          byStage: {
            detected: opportunities.filter(o => o.stage === 'detected').length,
            qualified: opportunities.filter(o => o.stage === 'qualified').length,
            proposed: opportunities.filter(o => o.stage === 'proposed').length,
            negotiating: opportunities.filter(o => o.stage === 'negotiating').length,
          },
        },
      },
    });
  } catch (error) {
    console.error('[Expansion] List opportunities error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'LIST_FAILED',
        message: 'Failed to list expansion opportunities',
      },
    });
  }
});

/**
 * GET /api/expansion/opportunities/:opportunityId
 *
 * Get details for a specific opportunity.
 */
router.get('/opportunities/:opportunityId', async (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.params;

    const opportunity = await expansionOpportunityService.getOpportunity(opportunityId);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Expansion opportunity not found',
        },
      });
    }

    return res.json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    console.error('[Expansion] Get opportunity error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'GET_FAILED',
        message: 'Failed to get expansion opportunity',
      },
    });
  }
});

/**
 * POST /api/expansion/opportunities
 *
 * Create an expansion opportunity from a signal detection.
 *
 * Request Body:
 * - customerId (required): Customer ID to create opportunity for
 * - qualifiedBy (optional): User ID who qualified the opportunity
 */
router.post('/opportunities', async (req: Request, res: Response) => {
  try {
    const { customerId, qualifiedBy } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    // First detect signals for this customer
    const detection = await expansionDetector.detectSignals(customerId);

    if (!detection || detection.signals.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_SIGNALS',
          message: 'No expansion signals detected for this customer',
        },
      });
    }

    // Create the opportunity
    const opportunity = await expansionOpportunityService.createOpportunity(detection, qualifiedBy);

    if (!opportunity) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create expansion opportunity',
        },
      });
    }

    console.log(`[Expansion] Created opportunity ${opportunity.id} for ${opportunity.customerName}`);

    return res.status(201).json({
      success: true,
      data: {
        opportunity,
        alertData: expansionOpportunityService.generateAlertData(detection, opportunity.id),
      },
    });
  } catch (error) {
    console.error('[Expansion] Create opportunity error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_FAILED',
        message: 'Failed to create expansion opportunity',
      },
    });
  }
});

/**
 * PATCH /api/expansion/opportunities/:opportunityId/stage
 *
 * Update the stage of an expansion opportunity.
 *
 * Request Body:
 * - stage (required): New stage (detected, qualified, proposed, negotiating, closed_won, closed_lost)
 * - notes (optional): Notes about the stage change
 */
router.patch('/opportunities/:opportunityId/stage', async (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const { stage, notes } = req.body;

    const validStages: ExpansionStage[] = ['detected', 'qualified', 'proposed', 'negotiating', 'closed_won', 'closed_lost'];

    if (!stage || !validStages.includes(stage)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STAGE',
          message: `Stage must be one of: ${validStages.join(', ')}`,
        },
      });
    }

    const opportunity = await expansionOpportunityService.updateStage(opportunityId, stage, notes);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Expansion opportunity not found',
        },
      });
    }

    console.log(`[Expansion] Updated opportunity ${opportunityId} to stage ${stage}`);

    return res.json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    console.error('[Expansion] Update stage error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: 'Failed to update opportunity stage',
      },
    });
  }
});

/**
 * POST /api/expansion/opportunities/:opportunityId/notify-sales
 *
 * Assign a sales rep and send notification.
 *
 * Request Body:
 * - salesRepId (required): ID of the sales rep to assign
 * - userId (required): ID of the user sending the notification
 * - salesSlackUserId (required): Slack user ID of the sales rep
 * - csmName (required): Name of the CSM for context
 */
router.post('/opportunities/:opportunityId/notify-sales', async (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const { salesRepId, userId, salesSlackUserId, csmName } = req.body;

    if (!salesRepId || !salesSlackUserId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'salesRepId and salesSlackUserId are required',
        },
      });
    }

    // Assign the sales rep
    const opportunity = await expansionOpportunityService.assignSalesRep(opportunityId, salesRepId);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Expansion opportunity not found',
        },
      });
    }

    // Generate alert data and send Slack notification
    const detection = await expansionDetector.detectSignals(opportunity.customerId);
    if (detection) {
      const alertData = expansionOpportunityService.generateAlertData(detection, opportunity.id);
      await expansionSlackAlerts.sendSalesAlert(userId, salesSlackUserId, alertData, csmName || 'CSM');
    }

    console.log(`[Expansion] Notified sales rep ${salesRepId} for opportunity ${opportunityId}`);

    return res.json({
      success: true,
      data: {
        opportunity,
        salesNotified: true,
      },
    });
  } catch (error) {
    console.error('[Expansion] Notify sales error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFY_FAILED',
        message: 'Failed to notify sales rep',
      },
    });
  }
});

// ============================================
// Slack Alert Endpoints
// ============================================

/**
 * POST /api/expansion/alert/csm
 *
 * Send expansion signal alert to CSM via Slack.
 *
 * Request Body:
 * - userId (required): User ID for Slack connection
 * - customerId (required): Customer to generate alert for
 * - channelId (optional): Slack channel ID (if not provided, sends DM)
 * - csmSlackUserId (optional): Slack user ID for DM (required if no channelId)
 */
router.post('/alert/csm', async (req: Request, res: Response) => {
  try {
    const { userId, customerId, channelId, csmSlackUserId } = req.body;

    if (!userId || !customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'userId and customerId are required',
        },
      });
    }

    if (!channelId && !csmSlackUserId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DESTINATION',
          message: 'Either channelId or csmSlackUserId is required',
        },
      });
    }

    // Detect signals
    const detection = await expansionDetector.detectSignals(customerId);

    if (!detection || detection.signals.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_SIGNALS',
          message: 'No expansion signals detected for this customer',
        },
      });
    }

    // Create or get existing opportunity
    const opportunity = await expansionOpportunityService.createOpportunity(detection);
    const alertData = expansionOpportunityService.generateAlertData(detection, opportunity?.id || 'pending');

    // Send alert
    if (channelId) {
      await expansionSlackAlerts.sendCsmAlert(userId, channelId, alertData);
    } else {
      await expansionSlackAlerts.sendCsmDm(userId, csmSlackUserId!, alertData);
    }

    console.log(`[Expansion] Sent CSM alert for ${detection.customerName}`);

    return res.json({
      success: true,
      data: {
        alertSent: true,
        alertData,
        opportunityId: opportunity?.id,
      },
    });
  } catch (error) {
    console.error('[Expansion] CSM alert error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_FAILED',
        message: 'Failed to send CSM alert',
      },
    });
  }
});

/**
 * POST /api/expansion/alert/sales
 *
 * Send expansion signal alert to Sales rep via Slack (FR-3.1).
 *
 * Request Body:
 * - userId (required): User ID for Slack connection
 * - opportunityId (required): Expansion opportunity ID
 * - salesSlackUserId (required): Slack user ID of sales rep
 * - csmName (required): Name of the CSM for attribution
 */
router.post('/alert/sales', async (req: Request, res: Response) => {
  try {
    const { userId, opportunityId, salesSlackUserId, csmName } = req.body;

    if (!userId || !opportunityId || !salesSlackUserId || !csmName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'userId, opportunityId, salesSlackUserId, and csmName are required',
        },
      });
    }

    // Get opportunity
    const opportunity = await expansionOpportunityService.getOpportunity(opportunityId);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Expansion opportunity not found',
        },
      });
    }

    // Get latest detection for alert data
    const detection = await expansionDetector.detectSignals(opportunity.customerId);

    if (!detection) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_SIGNALS',
          message: 'Cannot generate alert - no current signals',
        },
      });
    }

    const alertData = expansionOpportunityService.generateAlertData(detection, opportunity.id);

    // Send sales alert
    await expansionSlackAlerts.sendSalesAlert(userId, salesSlackUserId, alertData, csmName);

    console.log(`[Expansion] Sent sales alert for ${detection.customerName} to ${salesSlackUserId}`);

    return res.json({
      success: true,
      data: {
        alertSent: true,
        alertData,
      },
    });
  } catch (error) {
    console.error('[Expansion] Sales alert error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_FAILED',
        message: 'Failed to send sales alert',
      },
    });
  }
});

// ============================================
// Customer Opportunities Endpoint
// ============================================

/**
 * GET /api/expansion/customers/:customerId/opportunities
 *
 * Get all expansion opportunities for a specific customer.
 */
router.get('/customers/:customerId/opportunities', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const opportunities = await expansionOpportunityService.getCustomerOpportunities(customerId);

    return res.json({
      success: true,
      data: {
        customerId,
        opportunities,
        summary: {
          total: opportunities.length,
          active: opportunities.filter(o => !['closed_won', 'closed_lost'].includes(o.stage)).length,
          totalEstimatedValue: opportunities.reduce((sum, o) => sum + o.estimatedValue, 0),
        },
      },
    });
  } catch (error) {
    console.error('[Expansion] Get customer opportunities error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'GET_FAILED',
        message: 'Failed to get customer opportunities',
      },
    });
  }
});

// ============================================
// Workflow Endpoints
// ============================================

/**
 * POST /api/expansion/workflow/run
 *
 * Execute the expansion signal detection workflow manually.
 * This is the same workflow that runs daily at 9 AM.
 *
 * Request Body:
 * - userId (required): User ID for Slack connections
 * - minCompositeScore (optional): Minimum score threshold (default: 0.6)
 * - highScoreThreshold (optional): Threshold for sales alerts (default: 0.8)
 * - taskDueOffsetDays (optional): Days until task due date (default: 7)
 */
router.post('/workflow/run', async (req: Request, res: Response) => {
  try {
    const { userId, minCompositeScore, highScoreThreshold, taskDueOffsetDays } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'userId is required to execute workflow',
        },
      });
    }

    console.log('[Expansion] Starting manual workflow run');

    const result = await expansionWorkflowService.executeWorkflow(userId, {
      minCompositeScore,
      highScoreThreshold,
      taskDueOffsetDays,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Expansion] Workflow execution error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'WORKFLOW_FAILED',
        message: 'Failed to execute expansion workflow',
      },
    });
  }
});

export default router;
