/**
 * Agentic Agents API Routes
 * Endpoints for executing agents in agentic mode
 * Now includes WebSocket broadcasting for real-time notifications
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  executeGoal,
  planGoal,
  executePlan,
  resumeAfterApproval,
  executeWithSpecialist,
  quickCheckIn,
} from '../agents/engine/orchestrator-executor.js';
import { agenticModeService } from '../services/agentic-mode.js';
import { AgentContext, CustomerProfile } from '../agents/types.js';
import { SupabaseService } from '../services/supabase.js';

const router = Router();
const db = new SupabaseService();

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
router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { goal, customerId } = req.body;

    if (!goal) {
      return res.status(400).json({
        success: false,
        error: 'goal is required',
      });
    }

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

    // Broadcast steps executed
    for (const action of result.actions) {
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

      // Broadcast: approval required
      broadcastAgenticEvent(userId, 'approval_required', {
        stateId,
        actionType: result.state.pendingApproval?.toolName,
        riskLevel: result.state.pendingApproval?.riskLevel,
        reason: result.state.pendingApproval?.reason,
      });

      return res.json({
        success: true,
        status: 'paused_for_approval',
        stateId,
        pendingApproval: result.state.pendingApproval,
        message: result.message,
        actionsExecuted: result.actions.length,
      });
    }

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
    next(error);
  }
});

/**
 * POST /api/agentic/plan
 * Generate a plan for a goal
 */
router.post('/plan', async (req: Request, res: Response, next: NextFunction) => {
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
    const plan = await planGoal(goal, context);

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
router.post('/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { stateId, approved } = req.body;

    if (!stateId) {
      return res.status(400).json({
        success: false,
        error: 'stateId is required',
      });
    }

    if (typeof approved !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'approved must be a boolean',
      });
    }

    // Retrieve stored state
    const stored = pendingStates.get(stateId);
    if (!stored) {
      return res.status(404).json({
        success: false,
        error: 'State not found. It may have expired.',
      });
    }

    // Resume execution
    const result = await resumeAfterApproval(
      stored.state,
      approved,
      stored.context
    );

    // Clean up stored state
    pendingStates.delete(stateId);

    // If paused again, store new state
    if (result.state.status === 'paused_for_approval') {
      const newStateId = `state_${Date.now()}`;
      pendingStates.set(newStateId, {
        state: result.state,
        context: stored.context,
        createdAt: new Date(),
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

    res.json({
      success: result.success,
      status: result.state.status,
      message: result.message,
      actions: result.actions,
      stepsExecuted: result.state.currentStep,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agentic/specialist/:agentId
 * Execute a task with a specific specialist agent
 */
router.post('/specialist/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { agentId } = req.params;
    const { task, customerId } = req.body;

    if (!task) {
      return res.status(400).json({
        success: false,
        error: 'task is required',
      });
    }

    const validAgents = ['scheduler', 'communicator', 'researcher'];
    if (!validAgents.includes(agentId)) {
      return res.status(400).json({
        success: false,
        error: `Invalid agent. Must be one of: ${validAgents.join(', ')}`,
      });
    }

    const context = await buildContext(userId, customerId);
    const result = await executeWithSpecialist(agentId, task, context);

    // If paused for approval, store state
    if (result.state.status === 'paused_for_approval') {
      const stateId = `state_${Date.now()}`;
      pendingStates.set(stateId, {
        state: result.state,
        context,
        agentId,
        createdAt: new Date(),
      });

      return res.json({
        success: true,
        status: 'paused_for_approval',
        stateId,
        agentId,
        pendingApproval: result.state.pendingApproval,
        message: result.message,
      });
    }

    res.json({
      success: result.success,
      status: result.state.status,
      agentId,
      message: result.message,
      actions: result.actions,
    });
  } catch (error) {
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

export default router;
