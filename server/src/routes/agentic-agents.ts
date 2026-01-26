/**
 * Agentic Agents API Routes
 * Endpoints for executing agents in agentic mode
 * Now includes WebSocket broadcasting for real-time notifications
 * Enhanced with rate limiting, validation, audit logging, and metrics
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  executeGoal,
  planGoal,
  executePlan,
  resumeAfterApproval,
  executeWithSpecialist,
  quickCheckIn,
  executeParallelSpecialists,
  executeCollaborativeGoal,
  ParallelTask,
} from '../agents/engine/orchestrator-executor.js';
import { batchOperationsService } from '../services/batchOperations.js';
import { agentMemoryService } from '../services/agentMemory.js';
import { agenticModeService } from '../services/agentic-mode.js';
import { AgentContext, CustomerProfile } from '../agents/types.js';
import { SupabaseService } from '../services/supabase.js';

// Production readiness imports
import { agenticRateLimit } from '../middleware/agenticRateLimit.js';
import {
  validateExecuteRequest,
  validatePlanRequest,
  validateResumeRequest,
  validateSpecialistRequest,
  validateAgentIdParam,
  validateCustomerIdParam,
  validateStateIdParam,
} from '../middleware/validation.js';
import { auditLog } from '../services/auditLog.js';
import {
  recordAgentExecutionStart,
  recordAgentExecutionComplete,
  recordAgentExecutionError,
  recordApprovalRequested,
  recordApprovalDecision,
  recordToolExecution,
} from '../middleware/metrics.js';

const router = Router();
const db = new SupabaseService();

// Apply rate limiting to all agentic routes
router.use(agenticRateLimit);

// WebSocket handler will be injected via middleware
let wsHandler: any = null;

// Middleware to inject WebSocket handler
export function setWebSocketHandler(handler: any): void {
  wsHandler = handler;
}

// Helper to broadcast agentic events
function broadcastAgenticEvent(userId: string, eventType: string, data: any): void {
  if (wsHandler) {
    wsHandler.broadcastToUser(userId, {
      type: eventType,
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Store pending states for resumption
const pendingStates = new Map<string, any>();

// Helper to get user ID from request
function getUserId(req: Request): string {
  return (req.headers['x-user-id'] as string) ||
         (req.query.userId as string) ||
         'demo-user';
}

// Helper to build context from customer data
async function buildContext(
  userId: string,
  customerId?: string
): Promise<AgentContext> {
  let customer: CustomerProfile = {
    id: 'unknown',
    name: 'Unknown Customer',
    arr: 0,
    healthScore: 0,
    status: 'active',
  };

  if (customerId) {
    try {
      const customerData = await db.getCustomer(customerId);
      if (customerData) {
        customer = {
          id: customerData.id,
          name: customerData.name,
          arr: customerData.arr || 0,
          healthScore: customerData.health_score || 0,
          status: customerData.stage || 'active',
          renewalDate: customerData.renewal_date,
          primaryContact: customerData.primary_contact_email ? {
            name: customerData.primary_contact_name || 'Contact',
            email: customerData.primary_contact_email,
          } : undefined,
        };
      }
    } catch (e) {
      console.log('[AgenticAgents] Could not load customer:', e);
    }
  }

  return {
    userId,
    customer,
    currentPhase: 'monitoring',
    completedTasks: [],
    pendingApprovals: [],
    recentInteractions: [],
    riskSignals: [],
  };
}

/**
 * POST /api/agentic/execute
 * Execute a goal autonomously
 */
router.post('/execute', validateExecuteRequest, async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const userId = getUserId(req);
  const { goal, customerId } = req.body;

  // Record metrics
  recordAgentExecutionStart('orchestrator');

  // Log execution start
  await auditLog.logExecutionStart(userId, goal, customerId, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  try {
    // Build context
    const context = await buildContext(userId, customerId);

    // Broadcast: execution started
    broadcastAgenticEvent(userId, 'trace:run:start', {
      runId: `run_${Date.now()}`,
      agentName: 'Orchestrator',
      goal: goal.substring(0, 100),
    });

    // Execute the goal
    const result = await executeGoal(goal, context);
    const durationMs = Date.now() - startTime;

    // Record tool executions for metrics
    for (const action of result.actions) {
      recordToolExecution(action.toolName);
      broadcastAgenticEvent(userId, 'agent:step', {
        runId: result.state.goalDescription,
        stepId: `step_${Date.now()}`,
        type: 'tool',
        name: action.toolName,
        status: 'completed',
      });
    }

    // If paused for approval, store state for resumption
    if (result.state.status === 'paused_for_approval') {
      const stateId = `state_${Date.now()}`;
      pendingStates.set(stateId, {
        state: result.state,
        context,
        createdAt: new Date(),
      });

      // Record approval metrics
      recordApprovalRequested();

      // Log approval request
      await auditLog.log({
        userId,
        action: 'approval_requested',
        agentType: 'orchestrator',
        customerId,
        status: 'pending',
        durationMs,
        metadata: {
          stateId,
          actionType: result.state.pendingApproval?.toolName,
          riskLevel: result.state.pendingApproval?.riskLevel,
        },
      });

      // Broadcast: approval required
      broadcastAgenticEvent(userId, 'approval_required', {
        stateId,
        actionType: result.state.pendingApproval?.toolName,
        riskLevel: result.state.pendingApproval?.riskLevel,
        reason: result.state.pendingApproval?.reason,
      });

      // Record completion metrics (paused state)
      recordAgentExecutionComplete('orchestrator', durationMs);

      return res.json({
        success: true,
        status: 'paused_for_approval',
        stateId,
        pendingApproval: result.state.pendingApproval,
        message: result.message,
        actionsExecuted: result.actions.length,
      });
    }

    // Record completion metrics
    recordAgentExecutionComplete('orchestrator', durationMs);

    // Log successful completion
    await auditLog.logExecutionComplete(
      userId,
      goal,
      { status: result.state.status, actionsCount: result.actions.length },
      durationMs,
      customerId
    );

    // Broadcast: execution completed
    broadcastAgenticEvent(userId, 'trace:run:end', {
      runId: result.state.goalDescription,
      status: result.state.status,
      stepsExecuted: result.state.currentStep,
    });

    res.json({
      success: result.success,
      status: result.state.status,
      message: result.message,
      actions: result.actions,
      stepsExecuted: result.state.currentStep,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Record error metrics
    recordAgentExecutionError('orchestrator', durationMs);

    // Log error
    await auditLog.logExecutionError(
      userId,
      goal,
      error as Error,
      durationMs,
      customerId
    );

    next(error);
  }
});

/**
 * POST /api/agentic/plan
 * Generate a plan for a goal
 */
router.post('/plan', validatePlanRequest, async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const userId = getUserId(req);
  const { goal, customerId } = req.body;

  // Record metrics
  recordAgentExecutionStart('planner');

  // Log plan start
  await auditLog.log({
    userId,
    action: 'agent_plan_start',
    agentType: 'planner',
    customerId,
    input: { goal },
    status: 'pending',
  });

  try {
    const context = await buildContext(userId, customerId);
    const plan = await planGoal(goal, context);
    const durationMs = Date.now() - startTime;

    // Record completion metrics
    recordAgentExecutionComplete('planner', durationMs);

    // Log successful completion
    await auditLog.log({
      userId,
      action: 'agent_plan_complete',
      agentType: 'planner',
      customerId,
      input: { goal },
      output: { planId: plan.id, stepsCount: plan.plan.length },
      status: 'success',
      durationMs,
    });

    res.json({
      success: true,
      plan: {
        id: plan.id,
        goal: plan.originalRequest,
        steps: plan.plan.map(step => ({
          id: step.id,
          description: step.description,
          tool: step.toolName,
          dependencies: step.dependsOn,
        })),
        totalSteps: plan.plan.length,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Record error metrics
    recordAgentExecutionError('planner', durationMs);

    // Log error
    await auditLog.log({
      userId,
      action: 'agent_plan_error',
      agentType: 'planner',
      customerId,
      input: { goal },
      status: 'failure',
      durationMs,
      error: {
        message: (error as Error).message,
        stack: (error as Error).stack,
      },
    });

    next(error);
  }
});

/**
 * POST /api/agentic/execute-plan
 * Execute a previously generated plan
 */
router.post('/execute-plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { planId, customerId } = req.body;

    // For now, generate a fresh plan and execute
    // In production, would retrieve stored plan
    return res.status(400).json({
      success: false,
      error: 'Plan execution not yet implemented. Use /execute for direct goal execution.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agentic/resume
 * Resume execution after approval
 */
router.post('/resume', validateResumeRequest, async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const userId = getUserId(req);
  const { stateId, approved, reason } = req.body;

  // Record approval decision metrics
  recordApprovalDecision(approved);

  // Log approval decision
  await auditLog.logApprovalDecision(
    userId,
    stateId,
    approved,
    undefined,
    reason
  );

  try {
    // Retrieve stored state
    const stored = pendingStates.get(stateId);
    if (!stored) {
      return res.status(404).json({
        success: false,
        error: 'State not found. It may have expired.',
      });
    }

    // Log resume start
    await auditLog.log({
      userId,
      action: 'agent_resume_start',
      agentType: stored.agentId || 'orchestrator',
      status: 'pending',
      metadata: { stateId, approved },
    });

    // Record metrics
    recordAgentExecutionStart(stored.agentId || 'orchestrator');

    // Resume execution
    const result = await resumeAfterApproval(
      stored.state,
      approved,
      stored.context
    );
    const durationMs = Date.now() - startTime;

    // Clean up stored state
    pendingStates.delete(stateId);

    // Record tool executions
    for (const action of result.actions) {
      recordToolExecution(action.toolName);
    }

    // If paused again, store new state
    if (result.state.status === 'paused_for_approval') {
      const newStateId = `state_${Date.now()}`;
      pendingStates.set(newStateId, {
        state: result.state,
        context: stored.context,
        agentId: stored.agentId,
        createdAt: new Date(),
      });

      // Record approval metrics
      recordApprovalRequested();

      // Record completion metrics
      recordAgentExecutionComplete(stored.agentId || 'orchestrator', durationMs);

      // Log resume complete (paused again)
      await auditLog.log({
        userId,
        action: 'agent_resume_complete',
        agentType: stored.agentId || 'orchestrator',
        status: 'success',
        durationMs,
        metadata: { newStateId, pausedForApproval: true },
      });

      return res.json({
        success: true,
        status: 'paused_for_approval',
        stateId: newStateId,
        pendingApproval: result.state.pendingApproval,
        message: result.message,
        actionsExecuted: result.actions.length,
      });
    }

    // Record completion metrics
    recordAgentExecutionComplete(stored.agentId || 'orchestrator', durationMs);

    // Log resume complete
    await auditLog.log({
      userId,
      action: 'agent_resume_complete',
      agentType: stored.agentId || 'orchestrator',
      status: 'success',
      durationMs,
      output: { status: result.state.status, actionsCount: result.actions.length },
    });

    res.json({
      success: result.success,
      status: result.state.status,
      message: result.message,
      actions: result.actions,
      stepsExecuted: result.state.currentStep,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Record error metrics
    recordAgentExecutionError('orchestrator', durationMs);

    // Log error
    await auditLog.log({
      userId,
      action: 'agent_resume_error',
      status: 'failure',
      durationMs,
      error: {
        message: (error as Error).message,
        stack: (error as Error).stack,
      },
      metadata: { stateId },
    });

    next(error);
  }
});

/**
 * POST /api/agentic/specialist/:agentId
 * Execute a task with a specific specialist agent
 */
router.post('/specialist/:agentId', validateAgentIdParam, validateSpecialistRequest, async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const userId = getUserId(req);
  const { agentId } = req.params;
  const { task, customerId } = req.body;

  // Record metrics
  recordAgentExecutionStart(agentId);

  // Log specialist start
  await auditLog.log({
    userId,
    action: 'specialist_execute_start',
    agentType: agentId,
    customerId,
    input: { task },
    status: 'pending',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string,
  });

  try {
    const context = await buildContext(userId, customerId);
    const result = await executeWithSpecialist(agentId, task, context);
    const durationMs = Date.now() - startTime;

    // Record tool executions
    for (const action of result.actions) {
      recordToolExecution(action.toolName);
    }

    // If paused for approval, store state
    if (result.state.status === 'paused_for_approval') {
      const stateId = `state_${Date.now()}`;
      pendingStates.set(stateId, {
        state: result.state,
        context,
        agentId,
        createdAt: new Date(),
      });

      // Record approval metrics
      recordApprovalRequested();

      // Record completion metrics
      recordAgentExecutionComplete(agentId, durationMs);

      // Log specialist complete (paused)
      await auditLog.logSpecialistExecution(
        userId,
        agentId,
        task,
        { pausedForApproval: true, stateId },
        'success',
        durationMs,
        customerId
      );

      return res.json({
        success: true,
        status: 'paused_for_approval',
        stateId,
        agentId,
        pendingApproval: result.state.pendingApproval,
        message: result.message,
      });
    }

    // Record completion metrics
    recordAgentExecutionComplete(agentId, durationMs);

    // Log specialist complete
    await auditLog.logSpecialistExecution(
      userId,
      agentId,
      task,
      { status: result.state.status, actionsCount: result.actions.length },
      'success',
      durationMs,
      customerId
    );

    res.json({
      success: result.success,
      status: result.state.status,
      agentId,
      message: result.message,
      actions: result.actions,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Record error metrics
    recordAgentExecutionError(agentId, durationMs);

    // Log specialist error
    await auditLog.logSpecialistExecution(
      userId,
      agentId,
      task,
      null,
      'failure',
      durationMs,
      customerId,
      error as Error
    );

    next(error);
  }
});

/**
 * GET /api/agentic/check-in/:customerId
 * Quick check-in for a customer
 */
router.get('/check-in/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { customerId } = req.params;

    const context = await buildContext(userId, customerId);
    const checkIn = await quickCheckIn(context);

    res.json({
      success: true,
      data: {
        customerId,
        customerName: context.customer.name,
        ...checkIn,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agentic/pending-states
 * Get all pending approval states (for debugging/admin)
 */
router.get('/pending-states', async (req: Request, res: Response) => {
  const states = Array.from(pendingStates.entries()).map(([id, data]) => ({
    id,
    createdAt: data.createdAt,
    pendingApproval: data.state.pendingApproval,
    agentId: data.agentId,
  }));

  res.json({
    success: true,
    count: states.length,
    states,
  });
});

/**
 * DELETE /api/agentic/pending-states/:stateId
 * Cancel a pending state
 */
router.delete('/pending-states/:stateId', async (req: Request, res: Response) => {
  const { stateId } = req.params;

  if (pendingStates.has(stateId)) {
    pendingStates.delete(stateId);
    res.json({ success: true, message: 'State cancelled' });
  } else {
    res.status(404).json({ success: false, error: 'State not found' });
  }
});

// ============================================
// Batch Operations
// ============================================

/**
 * POST /api/agentic/batch-execute
 * Execute a goal for multiple customers in parallel
 */
router.post('/batch-execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const {
      goal,
      customerIds,
      concurrency,
      stopOnError,
      timeoutMs,
    } = req.body;

    if (!goal) {
      return res.status(400).json({
        success: false,
        error: 'goal is required',
      });
    }

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'customerIds must be a non-empty array',
      });
    }

    // Limit batch size
    const maxBatchSize = 50;
    if (customerIds.length > maxBatchSize) {
      return res.status(400).json({
        success: false,
        error: `Batch size exceeds maximum of ${maxBatchSize} customers`,
      });
    }

    console.log(`[BatchExecute] Starting batch for ${customerIds.length} customers: "${goal.substring(0, 50)}..."`);

    const result = await batchOperationsService.executeBatch({
      goal,
      customerIds,
      userId,
      concurrency: concurrency || 5,
      stopOnError: stopOnError || false,
      timeoutMs: timeoutMs || 60000,
    });

    res.json({
      success: result.success,
      batchId: result.id,
      status: result.status,
      totalCustomers: result.totalCustomers,
      successCount: result.successCount,
      failedCount: result.failedCount,
      skippedCount: result.skippedCount,
      summary: result.summary,
      results: result.results.map(r => ({
        customerId: r.customerId,
        customerName: r.customerName,
        status: r.status,
        durationMs: r.durationMs,
        error: r.error,
        actionsExecuted: r.result?.actions.length || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agentic/batch-execute-filter
 * Execute a goal for customers matching filter criteria
 */
router.post('/batch-execute-filter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const {
      goal,
      filter,
      concurrency,
      stopOnError,
    } = req.body;

    if (!goal) {
      return res.status(400).json({
        success: false,
        error: 'goal is required',
      });
    }

    if (!filter || typeof filter !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'filter object is required',
      });
    }

    const result = await batchOperationsService.executeBatchByFilter({
      goal,
      userId,
      filter,
      concurrency,
      stopOnError,
    });

    res.json({
      success: result.success,
      batchId: result.id,
      status: result.status,
      totalCustomers: result.totalCustomers,
      successCount: result.successCount,
      failedCount: result.failedCount,
      summary: result.summary,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agentic/batch/:batchId/progress
 * Get progress of a running batch
 */
router.get('/batch/:batchId/progress', async (req: Request, res: Response) => {
  const { batchId } = req.params;
  const progress = batchOperationsService.getBatchProgress(batchId);

  if (!progress) {
    return res.status(404).json({
      success: false,
      error: 'Batch not found or completed',
    });
  }

  res.json({
    success: true,
    progress,
  });
});

// ============================================
// Parallel Specialist Execution
// ============================================

/**
 * POST /api/agentic/parallel-execute
 * Execute multiple specialist tasks in parallel
 */
router.post('/parallel-execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const {
      tasks,
      customerId,
      continueOnError,
      timeoutMs,
      maxConcurrency,
    } = req.body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tasks must be a non-empty array',
      });
    }

    // Validate tasks
    const validAgents = ['scheduler', 'communicator', 'researcher', 'orchestrator'];
    for (const task of tasks) {
      if (!task.agentId || !task.task) {
        return res.status(400).json({
          success: false,
          error: 'Each task must have agentId and task fields',
        });
      }
      if (!validAgents.includes(task.agentId)) {
        return res.status(400).json({
          success: false,
          error: `Invalid agentId: ${task.agentId}. Must be one of: ${validAgents.join(', ')}`,
        });
      }
    }

    const context = await buildContext(userId, customerId);

    const parallelTasks: ParallelTask[] = tasks.map((t: any, index: number) => ({
      agentId: t.agentId,
      task: t.task,
      priority: t.priority || index,
    }));

    const result = await executeParallelSpecialists(
      parallelTasks,
      context,
      { continueOnError, timeoutMs, maxConcurrency }
    );

    res.json({
      success: result.success,
      totalTasks: result.totalTasks,
      completedTasks: result.completedTasks,
      failedTasks: result.failedTasks,
      results: result.results.map(r => ({
        agentId: r.agentId,
        task: r.task.substring(0, 100),
        success: r.result.success,
        status: r.result.state.status,
        durationMs: r.durationMs,
        actionsExecuted: r.result.actions.length,
      })),
      totalActionsExecuted: result.mergedActions.length,
      errors: result.errors,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agentic/collaborative-execute
 * Execute a complex goal using multiple specialists collaboratively
 */
router.post('/collaborative-execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { goal, customerId } = req.body;

    if (!goal) {
      return res.status(400).json({
        success: false,
        error: 'goal is required',
      });
    }

    const context = await buildContext(userId, customerId);
    const result = await executeCollaborativeGoal(goal, context);

    res.json({
      success: result.success,
      message: result.message,
      plan: {
        id: result.plan.id,
        stepsCount: result.plan.plan.length,
      },
      parallelResults: result.parallelResults ? {
        totalTasks: result.parallelResults.totalTasks,
        completedTasks: result.parallelResults.completedTasks,
        failedTasks: result.parallelResults.failedTasks,
      } : null,
      sequentialResults: result.sequentialResults?.map(r => ({
        success: r.success,
        status: r.state.status,
        actionsExecuted: r.actions.length,
      })) || [],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Agent Memory
// ============================================

/**
 * GET /api/agentic/memory/:customerId
 * Get memory context for a customer
 */
router.get('/memory/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { customerId } = req.params;
    const { types, limit, minImportance } = req.query;

    const memories = await agentMemoryService.getMemories(customerId, {
      types: types ? (types as string).split(',') as any[] : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      minImportance: minImportance ? parseInt(minImportance as string) : undefined,
    });

    res.json({
      success: true,
      customerId,
      memories: memories.map(m => ({
        id: m.id,
        type: m.type,
        content: m.content.substring(0, 500),
        importance: m.importance,
        createdAt: m.createdAt,
        expiresAt: m.expiresAt,
      })),
      total: memories.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agentic/memory/:customerId/context
 * Get full memory context formatted for agent prompts
 */
router.get('/memory/:customerId/context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { customerId } = req.params;
    const maxTokens = req.query.maxTokens ? parseInt(req.query.maxTokens as string) : undefined;

    const contextString = await agentMemoryService.buildContextString(customerId, userId, maxTokens);
    const context = await agentMemoryService.getMemoryContext(customerId, userId);

    res.json({
      success: true,
      customerId,
      contextString,
      stats: {
        recentConversations: context.recentConversations.length,
        recentActions: context.recentActions.length,
        insights: context.insights.length,
        preferences: context.preferences.length,
        summaries: context.summaries.length,
        totalMemories: context.totalMemories,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agentic/memory/:customerId
 * Store a new memory for a customer
 */
router.post('/memory/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { customerId } = req.params;
    const { type, content, metadata, importance, ttlDays } = req.body;

    if (!type || !content) {
      return res.status(400).json({
        success: false,
        error: 'type and content are required',
      });
    }

    const validTypes = ['conversation', 'action', 'insight', 'preference', 'context'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const memory = await agentMemoryService.storeMemory({
      customerId,
      userId,
      type,
      content,
      metadata,
      importance,
      ttlDays,
    });

    res.status(201).json({
      success: true,
      memory: {
        id: memory.id,
        type: memory.type,
        importance: memory.importance,
        expiresAt: memory.expiresAt,
        createdAt: memory.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agentic/memory/:customerId/search
 * Search memories by content
 */
router.post('/memory/:customerId/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const { query, limit } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'query is required',
      });
    }

    const results = await agentMemoryService.searchMemories(customerId, query, limit || 10);

    res.json({
      success: true,
      results: results.map(r => ({
        id: r.memory.id,
        type: r.memory.type,
        content: r.memory.content.substring(0, 300),
        relevanceScore: r.relevanceScore,
        importance: r.memory.importance,
        createdAt: r.memory.createdAt,
      })),
      total: results.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/agentic/memory/:customerId
 * Clear all memories for a customer
 */
router.delete('/memory/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const deletedCount = await agentMemoryService.clearCustomerMemories(customerId);

    res.json({
      success: true,
      deletedCount,
      message: `Cleared ${deletedCount} memories for customer ${customerId}`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agentic/memory/:customerId/summarize
 * Summarize old memories for a customer
 */
router.post('/memory/:customerId/summarize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { customerId } = req.params;

    const summary = await agentMemoryService.summarizeMemories(customerId, userId);

    if (!summary) {
      return res.json({
        success: true,
        summarized: false,
        message: 'Not enough memories to summarize or summarization not available',
      });
    }

    res.json({
      success: true,
      summarized: true,
      summary: {
        id: summary.id,
        content: summary.content,
        createdAt: summary.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
