/**
 * Orchestrator Executor
 * Executes orchestrator with agentic loop capabilities
 *
 * This connects the Orchestrator agent to the agentic loop engine,
 * enabling autonomous multi-step execution with planning.
 */

import {
  executeAgenticLoop,
  resumeAgenticLoop,
  generatePlan,
  AgenticModeConfig,
  AgenticLoopState,
  DEFAULT_AGENTIC_CONFIG,
} from './agentic-loop.js';
import { OrchestratorAgent, getOrchestratorSystemPrompt } from '../specialists/orchestrator.js';
import { SchedulerAgent } from '../specialists/scheduler.js';
import { CommunicatorAgent } from '../specialists/communicator.js';
import { ResearcherAgent } from '../specialists/researcher.js';
import { AgentContext, Tool, TaskLedger, TaskStep, Agent } from '../types.js';
import { agenticModeService } from '../../services/agentic-mode.js';

// All available specialist agents
const SPECIALIST_AGENTS: Record<string, Agent> = {
  scheduler: SchedulerAgent,
  communicator: CommunicatorAgent,
  researcher: ResearcherAgent,
};

// Get all tools from all agents
function getAllTools(): Tool[] {
  const allTools: Tool[] = [...OrchestratorAgent.tools];

  for (const agent of Object.values(SPECIALIST_AGENTS)) {
    allTools.push(...agent.tools);
  }

  return allTools;
}

// Get tools for a specific agent
function getAgentTools(agentId: string): Tool[] {
  const agent = SPECIALIST_AGENTS[agentId] || OrchestratorAgent;
  return agent.tools;
}

export interface ExecutionResult {
  success: boolean;
  state: AgenticLoopState;
  plan?: TaskLedger;
  message: string;
  actions: ExecutedAction[];
}

interface ExecutedAction {
  toolName: string;
  input: any;
  result: any;
  timestamp: Date;
}

/**
 * Execute a goal through the orchestrator
 */
export async function executeGoal(
  goal: string,
  context: AgentContext,
  agenticConfig?: AgenticModeConfig
): Promise<ExecutionResult> {
  // Get effective agentic config for the user
  const effectiveConfig = agenticConfig ||
    await agenticModeService.getEffectiveConfig(context.userId);

  console.log(`[Orchestrator] Executing goal: "${goal.substring(0, 50)}..." (agentic: ${effectiveConfig.enabled})`);

  // Get system prompt
  const systemPrompt = getOrchestratorSystemPrompt(context);

  // Get all available tools
  const tools = getAllTools();

  // Execute the agentic loop
  const state = await executeAgenticLoop(
    goal,
    tools,
    context,
    effectiveConfig,
    systemPrompt
  );

  // Collect executed actions
  const actions: ExecutedAction[] = state.steps.map(step => ({
    toolName: step.toolName,
    input: step.toolInput,
    result: step.toolResult,
    timestamp: step.timestamp,
  }));

  const result: ExecutionResult = {
    success: state.status === 'completed',
    state,
    message: getStatusMessage(state),
    actions,
  };

  // If completed, log summary
  if (state.status === 'completed') {
    console.log(`[Orchestrator] Goal completed in ${state.currentStep} steps`);
  } else if (state.status === 'paused_for_approval') {
    console.log(`[Orchestrator] Waiting for approval: ${state.pendingApproval?.toolName}`);
  }

  return result;
}

/**
 * Generate a plan for a complex goal
 */
export async function planGoal(
  goal: string,
  context: AgentContext
): Promise<TaskLedger> {
  console.log(`[Orchestrator] Planning goal: "${goal.substring(0, 50)}..."`);

  const systemPrompt = getOrchestratorSystemPrompt(context);
  const tools = getAllTools();

  const plan = await generatePlan(goal, tools, context, systemPrompt);

  console.log(`[Orchestrator] Generated plan with ${plan.plan.length} steps`);

  return plan;
}

/**
 * Execute a pre-generated plan with proper dependency tracking
 */
export async function executePlan(
  plan: TaskLedger,
  context: AgentContext,
  agenticConfig?: AgenticModeConfig
): Promise<ExecutionResult> {
  const effectiveConfig = agenticConfig ||
    await agenticModeService.getEffectiveConfig(context.userId);

  console.log(`[Orchestrator] Executing plan: ${plan.id} (${plan.plan.length} steps)`);

  // Track execution state
  const completedStepIds = new Set<string>();
  const allActions: ExecutedAction[] = [];
  let currentStepIndex = 0;
  let pausedState: any = null;

  // Execute steps in dependency order
  while (currentStepIndex < plan.plan.length) {
    // Find next executable step (dependencies satisfied)
    const nextStep = findNextExecutableStep(plan.plan, completedStepIds, currentStepIndex);

    if (!nextStep) {
      // No executable step found - might be blocked or all done
      break;
    }

    console.log(`[Orchestrator] Executing step ${nextStep.id}: ${nextStep.description}`);

    // Build goal for this specific step
    const stepGoal = `Execute this step: ${nextStep.description}${
      nextStep.toolName ? ` using the ${nextStep.toolName} tool` : ''
    }`;

    // Execute this step
    const stepResult = await executeGoal(stepGoal, context, {
      ...effectiveConfig,
      maxSteps: 3, // Limit steps per plan step
    });

    // Collect actions
    allActions.push(...stepResult.actions);

    // Check result
    if (stepResult.state.status === 'paused_for_approval') {
      // Store state for later resumption
      pausedState = {
        planId: plan.id,
        currentStepIndex,
        completedStepIds: Array.from(completedStepIds),
        stepResult,
      };
      break;
    }

    if (stepResult.state.status === 'completed') {
      completedStepIds.add(nextStep.id);
      currentStepIndex++;

      // Update plan status
      plan.completedSteps.push({
        ...nextStep,
        status: 'completed',
        result: { success: true, data: stepResult.state.finalResult },
        completedAt: new Date(),
        durationMs: 0,
      });
    } else if (stepResult.state.status === 'failed') {
      // Mark step as failed
      plan.blockedSteps.push({
        ...nextStep,
        status: 'blocked',
        blockedReason: stepResult.state.error || 'Step execution failed',
        blockedAt: new Date(),
      });
      // Continue to next step (don't block entire plan)
      currentStepIndex++;
    }
  }

  // Determine final status
  const allCompleted = completedStepIds.size === plan.plan.length;
  const status = pausedState
    ? 'paused_for_approval'
    : allCompleted
      ? 'completed'
      : 'max_steps_reached';

  const result: ExecutionResult = {
    success: allCompleted,
    state: {
      goalDescription: plan.originalRequest,
      currentStep: currentStepIndex,
      maxSteps: plan.plan.length,
      steps: allActions.map((a, i) => ({
        stepNumber: i + 1,
        toolName: a.toolName,
        toolInput: a.input,
        toolResult: a.result,
        reasoning: '',
        timestamp: a.timestamp,
      })),
      status,
      pendingApproval: pausedState?.stepResult?.state?.pendingApproval,
      finalResult: allCompleted ? 'Plan executed successfully' : undefined,
    },
    plan: {
      ...plan,
      status: allCompleted ? 'completed' : 'executing',
      updatedAt: new Date(),
    },
    message: allCompleted
      ? `Plan completed: ${completedStepIds.size}/${plan.plan.length} steps executed`
      : pausedState
        ? `Plan paused for approval at step ${currentStepIndex + 1}`
        : `Plan partially completed: ${completedStepIds.size}/${plan.plan.length} steps`,
    actions: allActions,
  };

  // Store pause state for resumption
  if (pausedState) {
    (result.state as any)._planPauseState = pausedState;
  }

  return result;
}

/**
 * Find the next step that can be executed (all dependencies satisfied)
 */
function findNextExecutableStep(
  steps: TaskStep[],
  completedIds: Set<string>,
  startIndex: number
): TaskStep | null {
  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];

    // Check if already completed
    if (completedIds.has(step.id)) continue;

    // Check if all dependencies are satisfied
    const deps = step.dependsOn || [];
    const depsCompleted = deps.every(depId => completedIds.has(depId));

    if (depsCompleted) {
      return step;
    }
  }

  return null;
}

/**
 * Resume plan execution after approval
 */
export async function resumePlanAfterApproval(
  previousResult: ExecutionResult,
  approved: boolean,
  context: AgentContext,
  agenticConfig?: AgenticModeConfig
): Promise<ExecutionResult> {
  const pauseState = (previousResult.state as any)?._planPauseState;

  if (!pauseState || !previousResult.plan) {
    return resumeAfterApproval(previousResult.state, approved, context, agenticConfig);
  }

  // Resume the step that was paused
  const stepResult = await resumeAfterApproval(
    pauseState.stepResult.state,
    approved,
    context,
    agenticConfig
  );

  // Reconstruct completed steps set
  const completedStepIds = new Set<string>(pauseState.completedStepIds);

  if (stepResult.state.status === 'completed') {
    completedStepIds.add(previousResult.plan.plan[pauseState.currentStepIndex].id);
  }

  // Continue executing remaining steps
  const remainingPlan: TaskLedger = {
    ...previousResult.plan,
    plan: previousResult.plan.plan.slice(pauseState.currentStepIndex + 1),
  };

  if (remainingPlan.plan.length > 0) {
    const continueResult = await executePlan(remainingPlan, context, agenticConfig);
    return {
      ...continueResult,
      actions: [...stepResult.actions, ...continueResult.actions],
    };
  }

  return stepResult;
}

/**
 * Resume execution after approval
 */
export async function resumeAfterApproval(
  previousState: AgenticLoopState,
  approved: boolean,
  context: AgentContext,
  agenticConfig?: AgenticModeConfig
): Promise<ExecutionResult> {
  const effectiveConfig = agenticConfig ||
    await agenticModeService.getEffectiveConfig(context.userId);

  console.log(`[Orchestrator] Resuming after approval: ${approved ? 'APPROVED' : 'REJECTED'}`);

  const systemPrompt = getOrchestratorSystemPrompt(context);
  const tools = getAllTools();

  const state = await resumeAgenticLoop(
    previousState,
    approved,
    tools,
    context,
    effectiveConfig,
    systemPrompt
  );

  const actions: ExecutedAction[] = state.steps.map(step => ({
    toolName: step.toolName,
    input: step.toolInput,
    result: step.toolResult,
    timestamp: step.timestamp,
  }));

  return {
    success: state.status === 'completed',
    state,
    message: getStatusMessage(state),
    actions,
  };
}

/**
 * Execute a task with a specific specialist agent
 */
export async function executeWithSpecialist(
  agentId: string,
  task: string,
  context: AgentContext,
  agenticConfig?: AgenticModeConfig
): Promise<ExecutionResult> {
  const agent = SPECIALIST_AGENTS[agentId];
  if (!agent) {
    return {
      success: false,
      state: {
        goalDescription: task,
        currentStep: 0,
        maxSteps: 0,
        steps: [],
        status: 'failed',
        error: `Unknown agent: ${agentId}`,
      },
      message: `Unknown agent: ${agentId}`,
      actions: [],
    };
  }

  const effectiveConfig = agenticConfig ||
    await agenticModeService.getEffectiveConfig(context.userId);

  console.log(`[${agent.name}] Executing task: "${task.substring(0, 50)}..."`);

  const systemPrompt = `You are ${agent.name}, a specialized ${agent.role} agent.

${agent.description}

Your tools: ${agent.tools.map(t => t.name).join(', ')}

Current customer: ${context.customer?.name || 'Unknown'}
Customer health: ${context.customer?.healthScore || 'Unknown'}%
`;

  const state = await executeAgenticLoop(
    task,
    agent.tools,
    context,
    effectiveConfig,
    systemPrompt
  );

  const actions: ExecutedAction[] = state.steps.map(step => ({
    toolName: step.toolName,
    input: step.toolInput,
    result: step.toolResult,
    timestamp: step.timestamp,
  }));

  return {
    success: state.status === 'completed',
    state,
    message: getStatusMessage(state),
    actions,
  };
}

/**
 * Quick check-in: get status and recommendations
 */
export async function quickCheckIn(
  context: AgentContext
): Promise<{
  healthScore: number;
  riskSignals: string[];
  recommendations: string[];
  pendingApprovals: number;
}> {
  const customer = context.customer;

  return {
    healthScore: customer?.healthScore || 0,
    riskSignals: context.riskSignals?.map(r => r.description) || [],
    recommendations: generateQuickRecommendations(context),
    pendingApprovals: context.pendingApprovals?.length || 0,
  };
}

// ============================================
// Parallel Specialist Execution
// ============================================

export interface ParallelTask {
  agentId: string;
  task: string;
  priority?: number;  // Lower = higher priority for result merging
}

export interface ParallelExecutionResult {
  success: boolean;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  results: Array<{
    agentId: string;
    task: string;
    result: ExecutionResult;
    durationMs: number;
  }>;
  mergedActions: ExecutedAction[];
  errors: string[];
}

export interface ParallelExecutionConfig {
  continueOnError?: boolean;    // Continue other tasks if one fails (default: true)
  timeoutMs?: number;           // Per-task timeout (default: 60000)
  maxConcurrency?: number;      // Max parallel tasks (default: all)
}

/**
 * Execute multiple specialist tasks in parallel
 * Use this when tasks are independent and can run concurrently
 */
export async function executeParallelSpecialists(
  tasks: ParallelTask[],
  context: AgentContext,
  config?: ParallelExecutionConfig,
  agenticConfig?: AgenticModeConfig
): Promise<ParallelExecutionResult> {
  const {
    continueOnError = true,
    timeoutMs = 60000,
    maxConcurrency = tasks.length,
  } = config || {};

  console.log(`[Orchestrator] Executing ${tasks.length} parallel specialist tasks`);

  const startTime = Date.now();
  const results: ParallelExecutionResult['results'] = [];
  const errors: string[] = [];
  let stopped = false;

  // Process in batches for concurrency control
  const batches = chunkArray(tasks, maxConcurrency);

  for (const batch of batches) {
    if (stopped) break;

    const batchPromises = batch.map(async (task) => {
      if (stopped) {
        return {
          agentId: task.agentId,
          task: task.task,
          result: createSkippedResult(task.task, 'Execution stopped due to error'),
          durationMs: 0,
        };
      }

      const taskStart = Date.now();

      try {
        const result = await executeWithTimeout(
          executeWithSpecialist(task.agentId, task.task, context, agenticConfig),
          timeoutMs
        );

        return {
          agentId: task.agentId,
          task: task.task,
          result,
          durationMs: Date.now() - taskStart,
        };

      } catch (error) {
        const errorMessage = (error as Error).message;
        errors.push(`[${task.agentId}] ${errorMessage}`);

        if (!continueOnError) {
          stopped = true;
        }

        return {
          agentId: task.agentId,
          task: task.task,
          result: createFailedResult(task.task, errorMessage),
          durationMs: Date.now() - taskStart,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  // Sort by priority if specified
  const sortedResults = [...results].sort((a, b) => {
    const taskA = tasks.find(t => t.agentId === a.agentId && t.task === a.task);
    const taskB = tasks.find(t => t.agentId === b.agentId && t.task === b.task);
    return (taskA?.priority || 0) - (taskB?.priority || 0);
  });

  // Merge all actions in priority order
  const mergedActions: ExecutedAction[] = [];
  for (const r of sortedResults) {
    mergedActions.push(...r.result.actions);
  }

  const completedTasks = results.filter(r => r.result.success).length;
  const failedTasks = results.filter(r => !r.result.success).length;

  const parallelResult: ParallelExecutionResult = {
    success: failedTasks === 0,
    totalTasks: tasks.length,
    completedTasks,
    failedTasks,
    results: sortedResults,
    mergedActions,
    errors,
  };

  console.log(`[Orchestrator] Parallel execution completed: ${completedTasks}/${tasks.length} successful in ${Date.now() - startTime}ms`);

  return parallelResult;
}

/**
 * Execute specialists for a complex multi-faceted goal
 * Automatically determines which specialists to engage
 */
export async function executeCollaborativeGoal(
  goal: string,
  context: AgentContext,
  agenticConfig?: AgenticModeConfig
): Promise<{
  plan: TaskLedger;
  parallelResults?: ParallelExecutionResult;
  sequentialResults?: ExecutionResult[];
  success: boolean;
  message: string;
}> {
  console.log(`[Orchestrator] Executing collaborative goal: "${goal.substring(0, 50)}..."`);

  // First, generate a plan
  const plan = await planGoal(goal, context);

  // Analyze plan for parallelizable steps
  const { parallelSteps, sequentialSteps } = analyzeStepsForParallelization(plan.plan);

  const results: {
    parallelResults?: ParallelExecutionResult;
    sequentialResults: ExecutionResult[];
  } = {
    sequentialResults: [],
  };

  // Execute parallel steps first (if any)
  if (parallelSteps.length > 0) {
    const parallelTasks: ParallelTask[] = parallelSteps.map((step, index) => ({
      agentId: step.agentId || 'orchestrator',
      task: step.description,
      priority: index,
    }));

    results.parallelResults = await executeParallelSpecialists(
      parallelTasks,
      context,
      { continueOnError: true },
      agenticConfig
    );
  }

  // Execute sequential steps
  for (const step of sequentialSteps) {
    const stepGoal = `Execute: ${step.description}`;
    const stepResult = await executeGoal(stepGoal, context, agenticConfig);
    results.sequentialResults.push(stepResult);

    // Stop on failure for sequential steps
    if (!stepResult.success && stepResult.state.status !== 'paused_for_approval') {
      break;
    }
  }

  // Determine overall success
  const parallelSuccess = !results.parallelResults || results.parallelResults.success;
  const sequentialSuccess = results.sequentialResults.every(r => r.success);

  return {
    plan,
    parallelResults: results.parallelResults,
    sequentialResults: results.sequentialResults,
    success: parallelSuccess && sequentialSuccess,
    message: parallelSuccess && sequentialSuccess
      ? 'Collaborative goal completed successfully'
      : 'Collaborative goal partially completed with some failures',
  };
}

// Helper: Analyze steps for parallelization opportunities
function analyzeStepsForParallelization(steps: TaskStep[]): {
  parallelSteps: TaskStep[];
  sequentialSteps: TaskStep[];
} {
  const parallelSteps: TaskStep[] = [];
  const sequentialSteps: TaskStep[] = [];

  for (const step of steps) {
    // Steps with no dependencies and certain agent types can run in parallel
    const noDependencies = !step.dependsOn || step.dependsOn.length === 0;
    const isParallelizable = ['researcher', 'scheduler'].includes(step.agentId);

    if (noDependencies && isParallelizable) {
      parallelSteps.push(step);
    } else {
      sequentialSteps.push(step);
    }
  }

  return { parallelSteps, sequentialSteps };
}

// Helper: Execute with timeout
async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Execution timeout')), timeoutMs)
    ),
  ]);
}

// Helper: Chunk array for batch processing
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Helper: Create skipped result
function createSkippedResult(task: string, reason: string): ExecutionResult {
  return {
    success: false,
    state: {
      goalDescription: task,
      currentStep: 0,
      maxSteps: 0,
      steps: [],
      status: 'failed',
      error: reason,
    },
    message: reason,
    actions: [],
  };
}

// Helper: Create failed result
function createFailedResult(task: string, error: string): ExecutionResult {
  return {
    success: false,
    state: {
      goalDescription: task,
      currentStep: 0,
      maxSteps: 0,
      steps: [],
      status: 'failed',
      error,
    },
    message: `Execution failed: ${error}`,
    actions: [],
  };
}

// Helper: Generate quick recommendations based on context
function generateQuickRecommendations(context: AgentContext): string[] {
  const recommendations: string[] = [];
  const customer = context.customer;

  if (!customer) return recommendations;

  // Health-based recommendations
  if (customer.healthScore < 60) {
    recommendations.push('Schedule an urgent check-in call to address declining health');
  } else if (customer.healthScore < 80) {
    recommendations.push('Consider proactive outreach to maintain engagement');
  }

  // Renewal-based recommendations
  if (customer.renewalDate) {
    const daysToRenewal = Math.ceil(
      (new Date(customer.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysToRenewal <= 30) {
      recommendations.push(`Renewal in ${daysToRenewal} days - start renewal conversation`);
    } else if (daysToRenewal <= 90) {
      recommendations.push(`Renewal in ${daysToRenewal} days - schedule QBR`);
    }
  }

  // Phase-based recommendations
  if (context.currentPhase === 'executing') {
    recommendations.push('Monitor onboarding progress and address any blockers');
  } else if (context.currentPhase === 'monitoring') {
    recommendations.push('Review usage trends and identify expansion opportunities');
  }

  return recommendations;
}

// Helper: Get human-readable status message
function getStatusMessage(state: AgenticLoopState): string {
  switch (state.status) {
    case 'completed':
      return state.finalResult as string || 'Goal completed successfully';
    case 'paused_for_approval':
      return `Waiting for approval: ${state.pendingApproval?.toolName} (${state.pendingApproval?.riskLevel} risk)`;
    case 'failed':
      return `Execution failed: ${state.error}`;
    case 'max_steps_reached':
      return `Reached maximum steps (${state.maxSteps}). Consider increasing limit or breaking down the goal.`;
    case 'running':
      return 'Execution in progress...';
    default:
      return 'Unknown status';
  }
}

export default {
  executeGoal,
  planGoal,
  executePlan,
  resumeAfterApproval,
  resumePlanAfterApproval,
  executeWithSpecialist,
  quickCheckIn,
  executeParallelSpecialists,
  executeCollaborativeGoal,
};
