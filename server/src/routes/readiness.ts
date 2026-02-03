/**
 * Readiness Assessment Routes (PRD-085)
 *
 * API endpoints for account readiness assessment before major milestones.
 *
 * Endpoints:
 * - GET  /api/readiness/:customerId                    - Get readiness assessment
 * - GET  /api/readiness/:customerId/:milestoneType     - Milestone-specific assessment
 * - POST /api/readiness/:customerId/checklist          - Generate action checklist
 * - GET  /api/readiness/:customerId/history            - Get assessment history
 * - PATCH /api/readiness/:assessmentId/checklist/:itemId - Update checklist item
 * - POST /api/readiness/:assessmentId/outcome          - Record milestone outcome
 * - GET  /api/readiness/templates/:milestoneType       - Get checklist templates
 */

import { Router, Request, Response } from 'express';
import {
  readinessAssessmentService,
  MilestoneType,
  AssessmentOptions,
} from '../services/intelligence/readinessAssessment.js';
import {
  readinessChecklistTemplates,
  generateChecklistFromTemplate,
} from '../templates/readinessChecklist.js';

const router = Router();

// ============================================
// Assessment Endpoints
// ============================================

/**
 * GET /api/readiness/:customerId
 *
 * Get a readiness assessment for a customer.
 * Defaults to renewal if no milestone type specified.
 *
 * Query Parameters:
 * - milestoneType: Type of milestone (renewal, expansion, qbr, etc.)
 * - milestoneDate: Target date for the milestone (ISO format)
 * - includeChecklist: Whether to generate checklist (default: true)
 * - includeAiAnalysis: Whether to include AI analysis (default: true)
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const {
      milestoneType = 'renewal',
      milestoneDate,
      includeChecklist = 'true',
      includeAiAnalysis = 'true',
    } = req.query;

    // Validate milestone type
    const validMilestones: MilestoneType[] = ['renewal', 'expansion', 'qbr', 'onboarding_complete', 'executive_briefing'];
    if (!validMilestones.includes(milestoneType as MilestoneType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MILESTONE_TYPE',
          message: `Invalid milestone type. Must be one of: ${validMilestones.join(', ')}`,
        },
      });
    }

    const options: AssessmentOptions = {
      milestoneType: milestoneType as MilestoneType,
      milestoneDate: milestoneDate as string | undefined,
      includeChecklist: includeChecklist === 'true',
      includeAiAnalysis: includeAiAnalysis === 'true',
    };

    console.log(`[Readiness] Assessing ${customerId} for ${milestoneType}`);

    const assessment = await readinessAssessmentService.assessReadiness(customerId, options);

    const responseTime = Date.now() - startTime;
    console.log(`[Readiness] Assessment complete in ${responseTime}ms - Score: ${assessment.overallScore}`);

    return res.json({
      success: true,
      data: assessment,
      meta: {
        responseTimeMs: responseTime,
        assessedAt: assessment.assessedAt,
      },
    });
  } catch (error) {
    console.error('[Readiness] Assessment error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'ASSESSMENT_FAILED',
        message: 'Failed to assess account readiness',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/readiness/:customerId/:milestoneType
 *
 * Get a milestone-specific readiness assessment.
 *
 * Path Parameters:
 * - customerId: Customer ID
 * - milestoneType: Type of milestone
 *
 * Query Parameters:
 * - milestoneDate: Target date for the milestone
 */
router.get('/:customerId/:milestoneType', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId, milestoneType } = req.params;
    const { milestoneDate } = req.query;

    // Validate milestone type
    const validMilestones: MilestoneType[] = ['renewal', 'expansion', 'qbr', 'onboarding_complete', 'executive_briefing'];
    if (!validMilestones.includes(milestoneType as MilestoneType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MILESTONE_TYPE',
          message: `Invalid milestone type. Must be one of: ${validMilestones.join(', ')}`,
        },
      });
    }

    const options: AssessmentOptions = {
      milestoneType: milestoneType as MilestoneType,
      milestoneDate: milestoneDate as string | undefined,
      includeChecklist: true,
      includeAiAnalysis: true,
    };

    const assessment = await readinessAssessmentService.assessReadiness(customerId, options);

    const responseTime = Date.now() - startTime;

    return res.json({
      success: true,
      data: assessment,
      meta: {
        responseTimeMs: responseTime,
        assessedAt: assessment.assessedAt,
      },
    });
  } catch (error) {
    console.error('[Readiness] Milestone assessment error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'ASSESSMENT_FAILED',
        message: 'Failed to assess account readiness',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

// ============================================
// Checklist Endpoints
// ============================================

/**
 * POST /api/readiness/:customerId/checklist
 *
 * Generate an action checklist from templates.
 *
 * Body Parameters:
 * - milestoneType: Type of milestone (required)
 * - milestoneDate: Target date for the milestone (required)
 * - excludeIds: Array of template IDs to exclude (optional)
 * - additionalItems: Array of custom items to add (optional)
 */
router.post('/:customerId/checklist', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      milestoneType,
      milestoneDate,
      excludeIds,
      additionalItems,
      priorityOverrides,
    } = req.body;

    // Validate required fields
    if (!milestoneType || !milestoneDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'milestoneType and milestoneDate are required',
        },
      });
    }

    // Validate milestone type
    const validMilestones: MilestoneType[] = ['renewal', 'expansion', 'qbr', 'onboarding_complete', 'executive_briefing'];
    if (!validMilestones.includes(milestoneType as MilestoneType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MILESTONE_TYPE',
          message: `Invalid milestone type. Must be one of: ${validMilestones.join(', ')}`,
        },
      });
    }

    const checklist = generateChecklistFromTemplate(
      milestoneType as MilestoneType,
      milestoneDate,
      {
        excludeIds,
        additionalItems,
        priorityOverrides,
      }
    );

    return res.json({
      success: true,
      data: {
        customerId,
        ...checklist,
      },
    });
  } catch (error) {
    console.error('[Readiness] Checklist generation error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'CHECKLIST_GENERATION_FAILED',
        message: 'Failed to generate checklist',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * PATCH /api/readiness/:assessmentId/checklist/:itemId
 *
 * Update a checklist item.
 *
 * Body Parameters:
 * - completed: Whether the item is completed
 * - assignee: Person assigned to the item
 * - notes: Additional notes
 * - dueDate: Updated due date
 */
router.patch('/:assessmentId/checklist/:itemId', async (req: Request, res: Response) => {
  try {
    const { assessmentId, itemId } = req.params;
    const updates = req.body;

    // Validate updates
    const allowedFields = ['completed', 'assignee', 'notes', 'dueDate', 'priority'];
    const invalidFields = Object.keys(updates).filter(k => !allowedFields.includes(k));
    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FIELDS',
          message: `Invalid fields: ${invalidFields.join(', ')}. Allowed: ${allowedFields.join(', ')}`,
        },
      });
    }

    const success = await readinessAssessmentService.updateChecklistItem(
      assessmentId,
      itemId,
      updates
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'Assessment or checklist item not found',
        },
      });
    }

    return res.json({
      success: true,
      message: 'Checklist item updated',
    });
  } catch (error) {
    console.error('[Readiness] Checklist update error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: 'Failed to update checklist item',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

// ============================================
// History Endpoints
// ============================================

/**
 * GET /api/readiness/:customerId/history
 *
 * Get assessment history for a customer.
 *
 * Query Parameters:
 * - milestoneType: Filter by milestone type (optional)
 * - limit: Maximum number of results (default: 10)
 */
router.get('/:customerId/history', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { milestoneType, limit = '10' } = req.query;

    const history = await readinessAssessmentService.getReadinessHistory(
      customerId,
      milestoneType as MilestoneType | undefined,
      parseInt(limit as string, 10)
    );

    return res.json({
      success: true,
      data: {
        customerId,
        history,
        count: history.length,
      },
    });
  } catch (error) {
    console.error('[Readiness] History fetch error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'HISTORY_FETCH_FAILED',
        message: 'Failed to fetch assessment history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

// ============================================
// Outcome Recording
// ============================================

/**
 * POST /api/readiness/:assessmentId/outcome
 *
 * Record the outcome of a milestone after it occurs.
 * This is used for learning and improving future assessments.
 *
 * Body Parameters:
 * - outcome: 'success' | 'partial' | 'failed'
 * - notes: Additional context about the outcome (optional)
 */
router.post('/:assessmentId/outcome', async (req: Request, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const { outcome, notes } = req.body;

    // Validate outcome
    const validOutcomes = ['success', 'partial', 'failed'];
    if (!outcome || !validOutcomes.includes(outcome)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OUTCOME',
          message: `Outcome must be one of: ${validOutcomes.join(', ')}`,
        },
      });
    }

    const success = await readinessAssessmentService.recordOutcome(
      assessmentId,
      outcome,
      notes
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ASSESSMENT_NOT_FOUND',
          message: 'Assessment not found',
        },
      });
    }

    return res.json({
      success: true,
      message: 'Outcome recorded successfully',
    });
  } catch (error) {
    console.error('[Readiness] Outcome recording error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'OUTCOME_RECORDING_FAILED',
        message: 'Failed to record outcome',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

// ============================================
// Template Endpoints
// ============================================

/**
 * GET /api/readiness/templates/:milestoneType
 *
 * Get checklist templates for a specific milestone type.
 */
router.get('/templates/:milestoneType', async (req: Request, res: Response) => {
  try {
    const { milestoneType } = req.params;

    // Validate milestone type
    const validMilestones: MilestoneType[] = ['renewal', 'expansion', 'qbr', 'onboarding_complete', 'executive_briefing'];
    if (!validMilestones.includes(milestoneType as MilestoneType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MILESTONE_TYPE',
          message: `Invalid milestone type. Must be one of: ${validMilestones.join(', ')}`,
        },
      });
    }

    const templates = readinessChecklistTemplates.getTemplatesByMilestone(
      milestoneType as MilestoneType
    );

    return res.json({
      success: true,
      data: {
        milestoneType,
        templates,
        count: templates.length,
      },
    });
  } catch (error) {
    console.error('[Readiness] Template fetch error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'TEMPLATE_FETCH_FAILED',
        message: 'Failed to fetch templates',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/readiness/templates
 *
 * Get all available checklist templates.
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const allTemplates = readinessChecklistTemplates.getAllTemplates();

    const summary = Object.entries(allTemplates).map(([type, templates]) => ({
      milestoneType: type,
      templateCount: templates.length,
      criticalTasks: templates.filter(t => t.priority === 'critical').length,
    }));

    return res.json({
      success: true,
      data: {
        templates: allTemplates,
        summary,
      },
    });
  } catch (error) {
    console.error('[Readiness] All templates fetch error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'TEMPLATES_FETCH_FAILED',
        message: 'Failed to fetch templates',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export default router;
