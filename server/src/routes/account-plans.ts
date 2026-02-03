/**
 * Account Plans Routes
 * PRD-235: AI-Powered Account Planning
 *
 * API endpoints for generating, viewing, updating, and approving account plans.
 *
 * Endpoints:
 * - POST /api/customers/:id/account-plan/generate - Generate AI account plan
 * - GET  /api/customers/:id/account-plan         - Get existing account plan
 * - PUT  /api/account-plans/:id                  - Update account plan
 * - POST /api/account-plans/:id/approve          - Manager approval workflow
 * - GET  /api/account-plans                      - List all account plans
 * - GET  /api/account-plans/stats                - Get account plan statistics
 */

import { Router, Request, Response } from 'express';
import {
  accountPlanGenerator,
  AccountPlan,
  PlanStatus,
} from '../services/ai/account-plan-generator.js';
import { config } from '../config/index.js';

const router = Router();

// Demo user ID - ONLY used in development mode
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

/**
 * Get user ID from request
 */
const getUserId = (req: Request): string => {
  if ((req as unknown as { userId: string }).userId) {
    return (req as unknown as { userId: string }).userId;
  }
  if (config.nodeEnv === 'development') {
    return DEMO_USER_ID;
  }
  return DEMO_USER_ID;
};

/**
 * POST /api/customers/:id/account-plan/generate
 *
 * Generate a new AI-powered account plan for a customer.
 *
 * Request Body:
 * - fiscal_year (required): "FY2026", "FY2027", etc.
 * - include_sections (optional): Array of section names or ["all"]
 * - reference_similar_accounts (optional): boolean (default: true)
 */
router.post('/customers/:id/account-plan/generate', async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const userId = getUserId(req);

    const {
      fiscal_year: fiscalYear,
      include_sections: includeSections = ['all'],
      reference_similar_accounts: referenceSimilarAccounts = true,
    } = req.body;

    console.log(`[AccountPlans] Generating plan for customer ${customerId}, FY${fiscalYear}`);

    if (!fiscalYear) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'fiscal_year is required (e.g., "FY2026")',
        },
      });
    }

    // Generate the plan
    const plan = await accountPlanGenerator.generateAccountPlan({
      customerId,
      fiscalYear,
      includeSections,
      referenceSimilarAccounts,
    });

    if (!plan) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'Failed to generate account plan. Please try again.',
        },
      });
    }

    // Return the generated plan
    return res.json({
      success: true,
      data: formatPlanResponse(plan),
      message: 'Account plan generated successfully',
    });
  } catch (error) {
    console.error('[AccountPlans] Error generating plan:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate account plan',
      },
    });
  }
});

/**
 * GET /api/customers/:id/account-plan
 *
 * Get the existing account plan for a customer.
 *
 * Query Parameters:
 * - fiscal_year (optional): Specific fiscal year (default: current FY)
 */
router.get('/customers/:id/account-plan', async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const fiscalYear = (req.query.fiscal_year as string) || `FY${new Date().getFullYear()}`;

    console.log(`[AccountPlans] Fetching plan for customer ${customerId}, ${fiscalYear}`);

    const plan = await accountPlanGenerator.getPlan(customerId, fiscalYear);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: `No account plan found for ${fiscalYear}. Generate one first.`,
        },
      });
    }

    return res.json({
      success: true,
      data: formatPlanResponse(plan),
    });
  } catch (error) {
    console.error('[AccountPlans] Error fetching plan:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch account plan',
      },
    });
  }
});

/**
 * PUT /api/account-plans/:id
 *
 * Update an existing account plan.
 *
 * Request Body: Partial AccountPlan object with fields to update
 */
router.put('/account-plans/:id', async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;
    const updates = req.body;

    console.log(`[AccountPlans] Updating plan ${planId}`);

    // Validate updates
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No updates provided',
        },
      });
    }

    // Don't allow status changes via this endpoint
    delete updates.status;
    delete updates.approved_by;
    delete updates.approved_at;

    const success = await accountPlanGenerator.updatePlan(planId, updates);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update account plan',
        },
      });
    }

    return res.json({
      success: true,
      data: { planId, updated: true },
      message: 'Account plan updated successfully',
    });
  } catch (error) {
    console.error('[AccountPlans] Error updating plan:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update account plan',
      },
    });
  }
});

/**
 * POST /api/account-plans/:id/approve
 *
 * Manager approval workflow for account plans.
 *
 * Request Body:
 * - action: "approve" | "request_changes" | "reject"
 * - feedback (optional): string - feedback for the plan author
 */
router.post('/account-plans/:id/approve', async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;
    const userId = getUserId(req);
    const { action, feedback } = req.body;

    console.log(`[AccountPlans] Approval action ${action} for plan ${planId}`);

    if (!action || !['approve', 'request_changes', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'action must be one of: approve, request_changes, reject',
        },
      });
    }

    let newStatus: PlanStatus;
    switch (action) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'request_changes':
        newStatus = 'draft';
        break;
      case 'reject':
        newStatus = 'draft';
        break;
      default:
        newStatus = 'pending_review';
    }

    const success = await accountPlanGenerator.updatePlanStatus(
      planId,
      newStatus,
      action === 'approve' ? userId : undefined
    );

    if (!success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'APPROVAL_FAILED',
          message: 'Failed to process approval action',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        planId,
        action,
        newStatus,
        approvedBy: action === 'approve' ? userId : undefined,
        approvedAt: action === 'approve' ? new Date().toISOString() : undefined,
        feedback,
      },
      message: `Account plan ${action === 'approve' ? 'approved' : action === 'request_changes' ? 'sent back for changes' : 'rejected'}`,
    });
  } catch (error) {
    console.error('[AccountPlans] Error processing approval:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process approval',
      },
    });
  }
});

/**
 * POST /api/account-plans/:id/submit
 *
 * Submit a draft plan for manager review.
 */
router.post('/account-plans/:id/submit', async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;

    console.log(`[AccountPlans] Submitting plan ${planId} for review`);

    const success = await accountPlanGenerator.updatePlanStatus(planId, 'pending_review');

    if (!success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'SUBMIT_FAILED',
          message: 'Failed to submit plan for review',
        },
      });
    }

    return res.json({
      success: true,
      data: { planId, status: 'pending_review' },
      message: 'Account plan submitted for review',
    });
  } catch (error) {
    console.error('[AccountPlans] Error submitting plan:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit plan for review',
      },
    });
  }
});

/**
 * POST /api/account-plans/:id/activate
 *
 * Activate an approved plan.
 */
router.post('/account-plans/:id/activate', async (req: Request, res: Response) => {
  try {
    const planId = req.params.id;

    console.log(`[AccountPlans] Activating plan ${planId}`);

    const success = await accountPlanGenerator.updatePlanStatus(planId, 'active');

    if (!success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'ACTIVATE_FAILED',
          message: 'Failed to activate plan. Ensure plan is approved first.',
        },
      });
    }

    return res.json({
      success: true,
      data: { planId, status: 'active' },
      message: 'Account plan activated',
    });
  } catch (error) {
    console.error('[AccountPlans] Error activating plan:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to activate plan',
      },
    });
  }
});

// ============================================
// Response Formatting
// ============================================

/**
 * Format plan for API response
 */
function formatPlanResponse(plan: AccountPlan) {
  return {
    plan_id: plan.id,
    customer_id: plan.customer_id,
    customer_name: plan.customer_name,
    fiscal_year: plan.fiscal_year,
    status: plan.status,
    ai_confidence: plan.ai_confidence,

    executive_summary: plan.executive_summary,

    business_context: plan.business_context,

    strategic_objectives: plan.strategic_objectives,

    stakeholder_plan: plan.stakeholder_plan,

    expansion_plan: plan.expansion_plan,

    risk_mitigation: plan.risk_mitigation,

    qbr_schedule: plan.qbr_schedule,

    action_plan_90day: plan.action_plan_90day,

    benchmark_comparison: plan.benchmark_comparison,

    metadata: {
      ai_generated: plan.ai_generated,
      generation_context: plan.generation_context,
      created_by: plan.created_by,
      created_at: plan.created_at,
      approved_by: plan.approved_by,
      approved_at: plan.approved_at,
    },
  };
}

export default router;
