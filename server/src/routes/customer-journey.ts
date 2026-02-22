/**
 * Customer Journey Map Routes
 * PRD-159: Customer Journey Map Report
 *
 * API endpoints for customer journey visualization and analytics.
 *
 * Endpoints:
 * - GET  /api/journey/:customerId         - Get journey map for a customer
 * - GET  /api/journey/analytics           - Get journey analytics
 * - POST /api/journey/:customerId/event   - Record a journey event
 * - POST /api/journey/:customerId/milestone - Record a milestone
 * - PUT  /api/journey/:customerId/stage   - Update customer stage
 * - PUT  /api/journey/milestone/:id       - Update milestone status
 */

import { Router, Request, Response } from 'express';
import { customerJourneyService } from '../services/customerJourney.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

/**
 * GET /api/journey/:customerId
 *
 * Get complete journey map for a customer.
 *
 * Query Parameters:
 * - includeEvents (boolean): Include event timeline (default: true)
 * - includeMilestones (boolean): Include milestones (default: true)
 * - includeHealthHistory (boolean): Include health history (default: true)
 * - startDate (string): Filter events from this date
 * - endDate (string): Filter events until this date
 * - eventTypes (string): Comma-separated event types to filter
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const {
      includeEvents,
      includeMilestones,
      includeHealthHistory,
      startDate,
      endDate,
      eventTypes
    } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    const options: {
      dateRange?: { start: string; end: string };
      includeEvents?: boolean;
      includeMilestones?: boolean;
      includeHealthHistory?: boolean;
      eventTypes?: string[];
    } = {};

    if (includeEvents !== undefined) {
      options.includeEvents = includeEvents === 'true';
    }

    if (includeMilestones !== undefined) {
      options.includeMilestones = includeMilestones === 'true';
    }

    if (includeHealthHistory !== undefined) {
      options.includeHealthHistory = includeHealthHistory === 'true';
    }

    if (startDate && endDate) {
      options.dateRange = {
        start: startDate as string,
        end: endDate as string
      };
    }

    if (eventTypes) {
      options.eventTypes = (eventTypes as string).split(',') as string[];
    }

    const journeyMap = await customerJourneyService.getJourneyMap(customerId, options);

    if (!journeyMap) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Customer with ID '${customerId}' not found`
        }
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(`[Journey] Journey map retrieved for ${journeyMap.customerName} in ${responseTime}ms`);

    return res.json({
      success: true,
      data: journeyMap,
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: responseTime,
        eventCount: journeyMap.events.length,
        milestoneCount: journeyMap.milestones.length,
        dataCompleteness: calculateDataCompleteness(journeyMap)
      }
    });
  } catch (error) {
    console.error('[Journey] Error getting journey map:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve customer journey map'
      }
    });
  }
});

/**
 * GET /api/journey/analytics
 *
 * Get journey analytics across all customers.
 *
 * Query Parameters:
 * - period (string): 'week', 'month', 'quarter', 'year' (default: 'month')
 * - segment (string): Filter by customer segment
 * - csmId (string): Filter by CSM
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { period = 'month', segment, csmId } = req.query;

    const validPeriods = ['week', 'month', 'quarter', 'year'];
    if (!validPeriods.includes(period as string)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PERIOD',
          message: `Period must be one of: ${validPeriods.join(', ')}`
        }
      });
    }

    const analytics = await customerJourneyService.getJourneyAnalytics(
      period as 'week' | 'month' | 'quarter' | 'year',
      segment as string | undefined,
      csmId as string | undefined
    );

    const responseTime = Date.now() - startTime;

    console.log(`[Journey] Analytics retrieved in ${responseTime}ms`);

    // Calculate total customers
    const totalCustomers = Object.values(analytics.stageDistribution).reduce((a, b) => a + b, 0);

    return res.json({
      success: true,
      data: analytics,
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: responseTime,
        customerCount: totalCustomers,
        period: period as string
      }
    });
  } catch (error) {
    console.error('[Journey] Error getting analytics:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve journey analytics'
      }
    });
  }
});

/**
 * POST /api/journey/:customerId/event
 *
 * Record a journey event for a customer.
 *
 * Request Body:
 * - type (required): Event type
 * - title (required): Event title
 * - description: Event description
 * - stage (required): Current stage
 * - sentiment: 'positive', 'neutral', 'negative'
 * - importance: 'high', 'medium', 'low'
 * - metadata: Additional event data
 * - participants: Array of participant names
 * - outcome: Event outcome
 */
router.post('/:customerId/event', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { type, title, description, stage, sentiment, importance, metadata, participants, outcome, source } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    if (!type || !title || !stage) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'type, title, and stage are required'
        }
      });
    }

    const eventId = await customerJourneyService.recordEvent(customerId, {
      type,
      title,
      description,
      stage,
      sentiment,
      importance: importance || 'medium',
      metadata,
      participants,
      outcome,
      source
    });

    console.log(`[Journey] Event recorded for customer ${customerId}: ${eventId}`);

    return res.status(201).json({
      success: true,
      data: {
        eventId,
        message: 'Event recorded successfully'
      }
    });
  } catch (error) {
    console.error('[Journey] Error recording event:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to record journey event'
      }
    });
  }
});

/**
 * POST /api/journey/:customerId/milestone
 *
 * Record a milestone for a customer.
 *
 * Request Body:
 * - name (required): Milestone name
 * - description (required): Milestone description
 * - targetDate (required): Target completion date
 * - stage (required): Journey stage for this milestone
 * - impact: 'critical', 'high', 'medium', 'low'
 * - achievedDate: If already achieved
 * - status: 'pending', 'achieved', 'missed', 'at_risk'
 */
router.post('/:customerId/milestone', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { name, description, targetDate, stage, impact, achievedDate, status } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    if (!name || !description || !targetDate || !stage) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'name, description, targetDate, and stage are required'
        }
      });
    }

    const milestoneId = await customerJourneyService.recordMilestone(customerId, {
      name,
      description,
      targetDate,
      stage,
      impact: impact || 'medium',
      achievedDate,
      status: status || 'pending'
    });

    console.log(`[Journey] Milestone recorded for customer ${customerId}: ${milestoneId}`);

    return res.status(201).json({
      success: true,
      data: {
        milestoneId,
        message: 'Milestone recorded successfully'
      }
    });
  } catch (error) {
    console.error('[Journey] Error recording milestone:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to record milestone'
      }
    });
  }
});

/**
 * PUT /api/journey/:customerId/stage
 *
 * Update customer's journey stage.
 *
 * Request Body:
 * - stage (required): New stage
 * - reason: Reason for stage change
 */
router.put('/:customerId/stage', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { stage, reason } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    const validStages = ['prospect', 'onboarding', 'adoption', 'growth', 'maturity', 'renewal', 'at_risk', 'churned'];
    if (!stage || !validStages.includes(stage)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STAGE',
          message: `Stage must be one of: ${validStages.join(', ')}`
        }
      });
    }

    await customerJourneyService.recordStageChange(customerId, stage, reason);

    console.log(`[Journey] Stage changed for customer ${customerId}: ${stage}`);

    return res.json({
      success: true,
      data: {
        message: `Customer stage updated to ${stage}`
      }
    });
  } catch (error) {
    console.error('[Journey] Error updating stage:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update customer stage'
      }
    });
  }
});

/**
 * PUT /api/journey/milestone/:milestoneId
 *
 * Update milestone status.
 *
 * Request Body:
 * - status (required): 'pending', 'achieved', 'missed', 'at_risk'
 * - achievedDate: Date milestone was achieved (required if status is 'achieved')
 */
router.put('/milestone/:milestoneId', async (req: Request, res: Response) => {
  try {
    const { milestoneId } = req.params;
    const { status, achievedDate } = req.body;

    if (!milestoneId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_MILESTONE_ID',
          message: 'Milestone ID is required'
        }
      });
    }

    const validStatuses = ['pending', 'achieved', 'missed', 'at_risk'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Status must be one of: ${validStatuses.join(', ')}`
        }
      });
    }

    if (status === 'achieved' && !achievedDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACHIEVED_DATE',
          message: 'achievedDate is required when status is "achieved"'
        }
      });
    }

    await customerJourneyService.updateMilestoneStatus(milestoneId, status, achievedDate);

    console.log(`[Journey] Milestone ${milestoneId} status updated: ${status}`);

    return res.json({
      success: true,
      data: {
        message: `Milestone status updated to ${status}`
      }
    });
  } catch (error) {
    console.error('[Journey] Error updating milestone:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update milestone status'
      }
    });
  }
});

/**
 * Calculate data completeness percentage for a journey map
 */
function calculateDataCompleteness(journeyMap: {
  events: unknown[];
  milestones: unknown[];
  healthHistory: unknown[];
  stageHistory: unknown[];
  stats: Record<string, unknown>;
}): number {
  let score = 0;
  let total = 0;

  // Events presence (20%)
  total += 20;
  if (journeyMap.events.length > 0) score += 10;
  if (journeyMap.events.length > 5) score += 10;

  // Milestones presence (20%)
  total += 20;
  if (journeyMap.milestones.length > 0) score += 10;
  if (journeyMap.milestones.length > 3) score += 10;

  // Health history (20%)
  total += 20;
  if (journeyMap.healthHistory.length > 0) score += 10;
  if (journeyMap.healthHistory.length > 10) score += 10;

  // Stage history (20%)
  total += 20;
  if (journeyMap.stageHistory.length > 0) score += 10;
  if (journeyMap.stageHistory.length > 1) score += 10;

  // Stats completeness (20%)
  total += 20;
  const statsKeys = Object.keys(journeyMap.stats);
  const nonZeroStats = statsKeys.filter(k => journeyMap.stats[k] !== 0 && journeyMap.stats[k] !== undefined);
  score += Math.round((nonZeroStats.length / statsKeys.length) * 20);

  return Math.round((score / total) * 100);
}

export default router;
