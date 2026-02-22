/**
 * Onboarding Stall Detection API Routes (PRD-098)
 *
 * Provides endpoints for:
 * - Stall detection dashboard data
 * - Manual stall check trigger
 * - Intervention execution
 * - Stall rules management
 */

import { Router, Request, Response } from 'express';
import {
  detectOnboardingStall,
  getOnboardingCustomers,
  getStalledOnboardingsDashboard,
  runStallDetection,
} from '../services/onboarding/stallDetector.js';
import {
  executeIntervention,
  runInterventionWorkflow,
} from '../services/onboarding/stallIntervention.js';
import {
  DEFAULT_STALL_RULES,
  OnboardingStallCheck,
  CustomerSegment,
} from '../services/onboarding/types.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// GET /api/onboarding-stalls/dashboard
// Get stalled onboardings dashboard data
// ============================================
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const dashboard = await getStalledOnboardingsDashboard();

    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to fetch dashboard data',
    });
  }
});

// ============================================
// GET /api/onboarding-stalls/check
// Run stall detection and return results
// ============================================
router.get('/check', async (req: Request, res: Response) => {
  try {
    const stalls = await runStallDetection();

    res.json({
      success: true,
      data: {
        totalChecked: (await getOnboardingCustomers()).length,
        stalledCount: stalls.length,
        stalls: stalls.map((s) => ({
          customerId: s.customerId,
          customerName: s.customerName,
          phase: s.phase,
          highestSeverity: s.highestSeverity,
          issueCount: s.issues.length,
          primaryBlocker: s.primaryBlocker,
          daysInOnboarding: s.daysInOnboarding,
          targetDays: s.targetOnboardingDays,
          requiresEscalation: s.requiresEscalation,
          suggestedInterventions: s.suggestedInterventions,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stall check error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to run stall detection',
    });
  }
});

// ============================================
// POST /api/onboarding-stalls/check/:customerId
// Check specific customer for stalls
// ============================================
router.post('/check/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // Get all onboarding customers and find the specific one
    const customers = await getOnboardingCustomers();
    const customer = customers.find((c) => c.customerId === customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found or not in onboarding stage',
      });
    }

    const stallResult = detectOnboardingStall(customer);

    res.json({
      success: true,
      data: {
        customerId,
        customerName: customer.customerName,
        isStalled: stallResult !== null,
        stallResult: stallResult
          ? {
              phase: stallResult.phase,
              highestSeverity: stallResult.highestSeverity,
              issues: stallResult.issues,
              primaryBlocker: stallResult.primaryBlocker,
              daysInOnboarding: stallResult.daysInOnboarding,
              targetDays: stallResult.targetOnboardingDays,
              requiresEscalation: stallResult.requiresEscalation,
              suggestedInterventions: stallResult.suggestedInterventions,
            }
          : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Customer stall check error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to check customer stall status',
    });
  }
});

// ============================================
// POST /api/onboarding-stalls/intervene/:customerId
// Execute intervention for a specific stalled customer
// ============================================
router.post('/intervene/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { slackWebhook, createTask = true, draftEmail = true, escalate = true } = req.body;

    // Get customer and check for stall
    const customers = await getOnboardingCustomers();
    const customer = customers.find((c) => c.customerId === customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found or not in onboarding stage',
      });
    }

    const stallResult = detectOnboardingStall(customer);

    if (!stallResult) {
      return res.status(400).json({
        success: false,
        error: 'Customer onboarding is not stalled',
      });
    }

    // Execute intervention
    const interventionResult = await executeIntervention(stallResult, {
      slackWebhook,
      createTask,
      draftEmail,
      escalate,
    });

    res.json({
      success: true,
      data: {
        customerId,
        customerName: interventionResult.customerName,
        actionsExecuted: interventionResult.actions.length,
        actions: interventionResult.actions,
        notificationsSent: interventionResult.notificationsSent,
        taskCreated: interventionResult.taskCreated,
        emailDraftId: interventionResult.emailDraftId,
        executedAt: interventionResult.executedAt,
      },
    });
  } catch (error) {
    console.error('Intervention execution error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to execute intervention',
    });
  }
});

// ============================================
// POST /api/onboarding-stalls/intervene-all
// Run intervention workflow for all stalled onboardings
// ============================================
router.post('/intervene-all', async (req: Request, res: Response) => {
  try {
    const { slackWebhook } = req.body;

    // Detect all stalls
    const stalls = await runStallDetection();

    if (stalls.length === 0) {
      return res.json({
        success: true,
        data: {
          message: 'No stalled onboardings detected',
          interventionsExecuted: 0,
        },
      });
    }

    // Run interventions
    const results = await runInterventionWorkflow(stalls, slackWebhook);

    res.json({
      success: true,
      data: {
        totalStalls: stalls.length,
        interventionsExecuted: results.length,
        results: results.map((r) => ({
          customerId: r.customerId,
          customerName: r.customerName,
          actionsExecuted: r.actions.length,
          notificationsSent: r.notificationsSent,
          executedAt: r.executedAt,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Bulk intervention error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to run intervention workflow',
    });
  }
});

// ============================================
// GET /api/onboarding-stalls/rules
// Get stall detection rules
// ============================================
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const { segment } = req.query;

    let rules = DEFAULT_STALL_RULES;

    if (segment) {
      rules = rules.filter(
        (r) => !r.segment || r.segment === (segment as CustomerSegment)
      );
    }

    res.json({
      success: true,
      data: {
        rules: rules.map((r, idx) => ({
          id: `rule-${idx}`,
          ...r,
        })),
        segments: ['enterprise', 'mid-market', 'smb'],
        conditionTypes: ['overdue', 'no_activity', 'no_response', 'tasks_overdue', 'user_not_activated'],
      },
    });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to get stall rules',
    });
  }
});

// ============================================
// GET /api/onboarding-stalls/summary
// Get summary metrics for stalled onboardings
// ============================================
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const dashboard = await getStalledOnboardingsDashboard();

    // Calculate additional metrics
    const criticalCount = dashboard.stalledBySeverity.critical || 0;
    const highCount = dashboard.stalledBySeverity.high || 0;
    const requiresImmediate = criticalCount + highCount;

    res.json({
      success: true,
      data: {
        totalStalled: dashboard.totalStalledOnboardings,
        arrAtRisk: dashboard.totalArrAtRisk,
        averageDaysStalled: dashboard.averageDaysStalled,
        requiresImmediateAttention: requiresImmediate,
        bySeverity: dashboard.stalledBySeverity,
        byPhase: dashboard.stalledByPhase,
        topRisks: dashboard.stalledOnboardings.slice(0, 5).map((s) => ({
          customerId: s.customerId,
          customerName: s.customerName,
          arr: s.arr,
          severity: s.highestSeverity,
          primaryBlocker: s.primaryBlocker,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Summary fetch error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to fetch summary',
    });
  }
});

export default router;
