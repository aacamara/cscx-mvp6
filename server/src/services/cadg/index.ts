/**
 * Context-Aware Agentic Document Generation (CADG) Service
 * PRD: CADG System
 *
 * Main export file that provides:
 * - All type definitions
 * - Individual service exports
 * - Orchestrated CADG flow
 */

// Export all types
export * from './types.js';

// Export individual services
export { contextAggregator, aggregateContext } from './contextAggregator.js';
export { taskClassifier } from './taskClassifier.js';
export { reasoningEngine } from './reasoningEngine.js';
export { planService } from './planService.js';
export { artifactGenerator } from './artifactGenerator.js';
export { capabilityMatcher } from './capabilityMatcher.js';

// Export data helpers
export {
  dataHelpers,
  aggregateCustomerContext,
  aggregatePortfolioContext,
  getPlaybooksByType,
  formatDataForDocument,
} from './dataHelpers.js';
export type {
  CustomerContext,
  PortfolioContext,
  Stakeholder,
  ContractInfo,
  RenewalPipelineItem,
  AtRiskCustomer,
  TeamMetrics,
  CSMInfo,
  PlaybookType,
  DocumentData,
  DocumentSection,
  DocumentMetadata,
} from './dataHelpers.js';

// Import services for orchestration
import { contextAggregator } from './contextAggregator.js';
import { taskClassifier } from './taskClassifier.js';
import { reasoningEngine } from './reasoningEngine.js';
import { planService } from './planService.js';
import { artifactGenerator } from './artifactGenerator.js';
import { capabilityMatcher } from './capabilityMatcher.js';
import { dataHelpers } from './dataHelpers.js';
import {
  TaskType,
  ExecutionPlan,
  GeneratedArtifact,
  AggregatedContext,
  TaskClassificationResult,
  CapabilityMatchResult,
} from './types.js';

/**
 * Full CADG orchestration result
 */
export interface CADGResult {
  success: boolean;
  isGenerative: boolean;
  classification: TaskClassificationResult;
  capability: CapabilityMatchResult | null;
  plan: ExecutionPlan | null;
  context: AggregatedContext | null;
  artifact: GeneratedArtifact | null;
  error?: string;
}

/**
 * CADG Service - Orchestrates the full generation flow
 */
export const cadgService = {
  /**
   * Process a user query and determine if it's generative
   */
  async classify(
    userQuery: string,
    context?: { customerId?: string; userId?: string }
  ): Promise<{
    isGenerative: boolean;
    classification: TaskClassificationResult;
    capability: CapabilityMatchResult | null;
  }> {
    const classification = await taskClassifier.classify(userQuery);
    const isGenerative = taskClassifier.isGenerativeRequest(userQuery) ||
      classification.confidence >= 0.7;

    let capability: CapabilityMatchResult | null = null;
    if (isGenerative) {
      capability = await capabilityMatcher.match(userQuery, context);
    }

    return {
      isGenerative,
      classification,
      capability,
    };
  },

  /**
   * Create an execution plan for a query
   */
  async createPlan(params: {
    userQuery: string;
    customerId: string | null;
    userId: string;
    taskType?: TaskType;
  }): Promise<{
    success: boolean;
    plan: ExecutionPlan | null;
    context: AggregatedContext | null;
    error?: string;
  }> {
    try {
      const { userQuery, customerId, userId, taskType: providedTaskType } = params;

      // Classify if task type not provided
      const taskType = providedTaskType ||
        (await taskClassifier.classify(userQuery)).taskType;

      // Get capability match for methodology
      const capabilityMatch = await capabilityMatcher.match(userQuery, {
        customerId: customerId || undefined,
        userId,
      });

      // Aggregate context
      const context = await contextAggregator.aggregateContext({
        taskType,
        customerId,
        userQuery,
        userId,
      });

      // Create plan
      const plan = await reasoningEngine.createPlan({
        taskType,
        context,
        userQuery,
        methodology: capabilityMatch.methodology,
      });

      // Save plan to database
      const saveResult = await planService.createPlan(
        plan,
        userId,
        customerId,
        userQuery,
        { knowledge: context.knowledge, metadata: context.metadata }
      );

      if (!saveResult.success) {
        console.error('[CADG] Failed to save plan to database:', saveResult.error);
        // Still return the plan for display, but log the error
        // The approval flow won't work, but user can see what would be generated
      } else {
        console.log('[CADG] Plan saved to database:', plan.planId);
      }

      return {
        success: true,
        plan,
        context,
      };
    } catch (error) {
      console.error('[cadgService] createPlan error:', error);
      return {
        success: false,
        plan: null,
        context: null,
        error: error instanceof Error ? error.message : 'Failed to create plan',
      };
    }
  },

  /**
   * Execute an approved plan and generate artifact
   */
  async execute(params: {
    planId: string;
    userId: string;
    modifications?: any[];
  }): Promise<{
    success: boolean;
    artifact: GeneratedArtifact | null;
    error?: string;
  }> {
    try {
      const { planId, userId, modifications } = params;

      // Get the plan
      const { plan: planRow, success } = await planService.getPlan(planId);
      if (!success || !planRow) {
        return { success: false, artifact: null, error: 'Plan not found' };
      }

      // Approve the plan
      await planService.approvePlan(planId, userId, modifications);

      // Update status to executing
      await planService.updatePlanStatus(planId, 'executing');

      // Apply modifications
      let finalPlan = planRow.plan_json;
      if (modifications && modifications.length > 0) {
        finalPlan = planService.applyModifications(planRow.plan_json, modifications);
      }

      // Re-aggregate context
      const context = await contextAggregator.aggregateContext({
        taskType: finalPlan.taskType,
        customerId: planRow.customer_id,
        userQuery: planRow.user_query,
        userId,
      });

      // Generate artifact
      const artifact = await artifactGenerator.generate({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
      });

      // Update plan to completed
      await planService.updatePlanStatus(planId, 'completed');

      console.log('[CADG] Execution completed, artifact generated');

      return {
        success: true,
        artifact,
      };
    } catch (error) {
      console.error('[cadgService] execute error:', error);

      // Try to mark plan as failed
      try {
        await planService.updatePlanStatus(
          params.planId,
          'failed',
          error instanceof Error ? error.message : 'Execution failed'
        );
      } catch {}

      return {
        success: false,
        artifact: null,
        error: error instanceof Error ? error.message : 'Failed to execute plan',
      };
    }
  },

  /**
   * Full flow: classify -> plan -> execute (if auto-approved)
   */
  async process(params: {
    userQuery: string;
    customerId: string | null;
    userId: string;
    autoApprove?: boolean;
  }): Promise<CADGResult> {
    const { userQuery, customerId, userId, autoApprove = false } = params;

    // Step 1: Classify
    const { isGenerative, classification, capability } = await this.classify(
      userQuery,
      { customerId: customerId || undefined, userId }
    );

    if (!isGenerative) {
      return {
        success: true,
        isGenerative: false,
        classification,
        capability,
        plan: null,
        context: null,
        artifact: null,
      };
    }

    // Step 2: Create plan
    const { success: planSuccess, plan, context, error: planError } =
      await this.createPlan({
        userQuery,
        customerId,
        userId,
        taskType: classification.taskType,
      });

    if (!planSuccess || !plan) {
      return {
        success: false,
        isGenerative: true,
        classification,
        capability,
        plan: null,
        context,
        artifact: null,
        error: planError,
      };
    }

    // Step 3: Execute if auto-approved
    if (autoApprove) {
      const { success: execSuccess, artifact, error: execError } =
        await this.execute({
          planId: plan.planId,
          userId,
        });

      return {
        success: execSuccess,
        isGenerative: true,
        classification,
        capability,
        plan,
        context,
        artifact,
        error: execError,
      };
    }

    // Return plan for manual approval
    return {
      success: true,
      isGenerative: true,
      classification,
      capability,
      plan,
      context,
      artifact: null,
    };
  },

  // Expose individual services for direct access
  contextAggregator,
  taskClassifier,
  reasoningEngine,
  planService,
  artifactGenerator,
  capabilityMatcher,
  dataHelpers,
};

export default cadgService;
