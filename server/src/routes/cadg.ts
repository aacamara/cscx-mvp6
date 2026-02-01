/**
 * CADG API Routes
 * PRD: Context-Aware Agentic Document Generation
 *
 * Endpoints:
 * - POST /api/cadg/plan - Create execution plan
 * - POST /api/cadg/plan/:planId/approve - Approve plan
 * - POST /api/cadg/plan/:planId/reject - Reject plan
 * - GET /api/cadg/artifact/:artifactId - Get artifact
 * - GET /api/cadg/plans - Get user's plans
 */

import { Router, Request, Response } from 'express';
import { contextAggregator } from '../services/cadg/contextAggregator.js';
import { taskClassifier } from '../services/cadg/taskClassifier.js';
import { reasoningEngine } from '../services/cadg/reasoningEngine.js';
import { planService } from '../services/cadg/planService.js';
import { artifactGenerator } from '../services/cadg/artifactGenerator.js';
import { capabilityMatcher } from '../services/cadg/capabilityMatcher.js';
import { PlanModification } from '../services/cadg/types.js';

const router = Router();

/**
 * POST /api/cadg/plan
 * Create an execution plan for a task
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { query, customerId } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Step 1: Classify the task
    const classification = await taskClassifier.classify(query);

    // Check if it's a generative request
    if (!taskClassifier.isGenerativeRequest(query) && classification.confidence < 0.6) {
      return res.json({
        success: true,
        isGenerative: false,
        message: 'This appears to be a question rather than a generative task',
        classification,
      });
    }

    // Step 2: Match to capability (optional, enhances context)
    const capabilityMatch = await capabilityMatcher.match(query, {
      customerId,
      userId,
    });

    // Step 3: Aggregate context
    const context = await contextAggregator.aggregateContext({
      taskType: classification.taskType,
      customerId: customerId || null,
      userQuery: query,
      userId,
    });

    // Step 4: Create execution plan
    const plan = await reasoningEngine.createPlan({
      taskType: classification.taskType,
      context,
      userQuery: query,
      methodology: capabilityMatch.methodology,
    });

    // Step 5: Persist the plan
    const saveResult = await planService.createPlan(
      plan,
      userId,
      customerId || null,
      query,
      {
        knowledge: context.knowledge,
        metadata: context.metadata,
      }
    );

    if (!saveResult.success) {
      console.error('[CADG] Failed to save plan:', saveResult.error);
    }

    // Determine if approval is required
    const requiresApproval = plan.actions.some(a => a.requiresApproval);

    res.json({
      success: true,
      isGenerative: true,
      planId: plan.planId,
      plan,
      classification,
      capability: capabilityMatch.capability ? {
        id: capabilityMatch.capability.id,
        name: capabilityMatch.capability.name,
        confidence: capabilityMatch.confidence,
      } : null,
      requiresApproval,
      contextSummary: {
        sourcesSearched: context.metadata.sourcesSearched,
        playbooksFound: context.knowledge.playbooks.length,
        risksDetected: context.platformData.riskSignals.length,
        gatheringDurationMs: context.metadata.gatheringDurationMs,
      },
    });
  } catch (error) {
    console.error('[CADG] Plan creation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create plan',
    });
  }
});

/**
 * POST /api/cadg/plan/:planId/approve
 * Approve a plan for execution
 */
router.post('/plan/:planId/approve', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { modifications } = req.body as { modifications?: PlanModification[] };
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Get the plan
    const { plan: planRow, success, error } = await planService.getPlan(planId);

    if (!success || !planRow) {
      return res.status(404).json({
        success: false,
        error: error || 'Plan not found',
      });
    }

    if (planRow.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Plan is already ${planRow.status}`,
      });
    }

    // Approve the plan
    const approveResult = await planService.approvePlan(planId, userId, modifications);

    if (!approveResult.success) {
      return res.status(500).json({
        success: false,
        error: approveResult.error,
      });
    }

    // Update status to executing
    await planService.updatePlanStatus(planId, 'executing');

    // Apply modifications if any
    let finalPlan = planRow.plan_json;
    if (modifications && modifications.length > 0) {
      finalPlan = planService.applyModifications(planRow.plan_json, modifications);
    }

    // Re-aggregate context for execution
    const context = await contextAggregator.aggregateContext({
      taskType: finalPlan.taskType,
      customerId: planRow.customer_id,
      userQuery: planRow.user_query,
      userId,
    });

    // Generate the artifact
    const artifact = await artifactGenerator.generate({
      plan: finalPlan,
      context,
      userId,
      customerId: planRow.customer_id,
    });

    // Update plan to completed
    await planService.updatePlanStatus(planId, 'completed');

    res.json({
      success: true,
      artifactId: artifact.artifactId,
      status: 'completed',
      preview: artifact.preview,
      storage: artifact.storage,
      metadata: {
        generationDurationMs: artifact.metadata.generationDurationMs,
        sourcesUsed: artifact.metadata.sourcesUsed,
      },
    });
  } catch (error) {
    console.error('[CADG] Plan approval error:', error);

    // Try to update plan status to failed
    try {
      await planService.updatePlanStatus(
        req.params.planId,
        'failed',
        error instanceof Error ? error.message : 'Execution failed'
      );
    } catch {}

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute plan',
    });
  }
});

/**
 * POST /api/cadg/plan/:planId/reject
 * Reject a plan
 */
router.post('/plan/:planId/reject', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { reason } = req.body;

    const result = await planService.rejectPlan(planId, reason);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: 'Plan rejected',
    });
  } catch (error) {
    console.error('[CADG] Plan rejection error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject plan',
    });
  }
});

/**
 * GET /api/cadg/artifact/:artifactId
 * Get a generated artifact
 */
router.get('/artifact/:artifactId', async (req: Request, res: Response) => {
  try {
    const { artifactId } = req.params;

    const { artifact, success, error } = await artifactGenerator.getArtifact(artifactId);

    if (!success || !artifact) {
      return res.status(404).json({
        success: false,
        error: error || 'Artifact not found',
      });
    }

    res.json({
      success: true,
      artifact: {
        id: artifact.id,
        type: artifact.artifact_type,
        title: artifact.title,
        preview: artifact.preview_markdown,
        driveUrl: artifact.drive_url,
        createdAt: artifact.created_at,
        sourcesUsed: artifact.sources_used,
        generationDurationMs: artifact.generation_duration_ms,
      },
    });
  } catch (error) {
    console.error('[CADG] Get artifact error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get artifact',
    });
  }
});

/**
 * GET /api/cadg/plans
 * Get user's plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;
    const { status, customerId, limit } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const { plans, success, error } = await planService.getUserPlans(userId, {
      status: status as any,
      customerId: customerId as string,
      limit: limit ? parseInt(limit as string) : 20,
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        error,
      });
    }

    res.json({
      success: true,
      plans: plans.map(p => ({
        id: p.id,
        taskType: p.task_type,
        userQuery: p.user_query,
        status: p.status,
        customerId: p.customer_id,
        createdAt: p.created_at,
        approvedAt: p.approved_at,
      })),
    });
  } catch (error) {
    console.error('[CADG] Get plans error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get plans',
    });
  }
});

/**
 * GET /api/cadg/capabilities
 * Get all available capabilities
 */
router.get('/capabilities', async (_req: Request, res: Response) => {
  try {
    const capabilities = await capabilityMatcher.getAllCapabilities();

    res.json({
      success: true,
      capabilities: capabilities.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        description: c.description,
        examplePrompts: c.examplePrompts.slice(0, 3),
      })),
    });
  } catch (error) {
    console.error('[CADG] Get capabilities error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get capabilities',
    });
  }
});

export default router;
