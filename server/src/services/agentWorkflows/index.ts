/**
 * Agent Workflows Service
 *
 * Provides a unified interface for executing agent workflows that orchestrate
 * multiple Google Workspace services (Sheets, Drive, Gmail, Calendar, Apps Script).
 *
 * Each workflow:
 * 1. Fetches data from relevant Google sources
 * 2. Processes and analyzes the data
 * 3. Creates outputs (docs, sheets, folders)
 * 4. Returns to chat for HITL approval
 */

import { workflowExecutor } from './workflowExecutor.js';
import { onboardingWorkflows } from './definitions/onboardingWorkflows.js';
import { adoptionWorkflows } from './definitions/adoptionWorkflows.js';
import { renewalWorkflows } from './definitions/renewalWorkflows.js';
import { riskWorkflows } from './definitions/riskWorkflows.js';
import { strategicWorkflows } from './definitions/strategicWorkflows.js';
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowContext,
  WorkflowId,
  CSAgentType,
} from './types.js';

// Export types
export * from './types.js';
export { workflowExecutor } from './workflowExecutor.js';

// ============================================
// ALL WORKFLOWS REGISTRY
// ============================================

export const ALL_WORKFLOWS: Record<WorkflowId, WorkflowDefinition> = {
  ...onboardingWorkflows,
  ...adoptionWorkflows,
  ...renewalWorkflows,
  ...riskWorkflows,
  ...strategicWorkflows,
};

// ============================================
// AGENT → WORKFLOW MAPPING
// ============================================

export const AGENT_WORKFLOWS: Record<CSAgentType, WorkflowId[]> = {
  onboarding: [
    'create_kickoff_package',
    'generate_onboarding_plan',
    'create_welcome_sequence',
    'setup_customer_workspace',
    'create_training_materials',
  ],
  adoption: [
    'analyze_usage_metrics',
    'create_adoption_report',
    'generate_training_recommendations',
    'create_feature_rollout_plan',
    'build_champion_playbook',
  ],
  renewal: [
    'generate_renewal_forecast',
    'create_qbr_package',
    'build_value_summary',
    'create_renewal_proposal',
    'analyze_expansion_opportunities',
  ],
  risk: [
    'run_health_assessment',
    'create_save_play',
    'generate_escalation_report',
    'analyze_churn_signals',
    'create_recovery_plan',
  ],
  strategic: [
    'create_account_plan',
    'generate_executive_briefing',
    'build_success_story',
    'create_partnership_proposal',
    'analyze_strategic_opportunities',
  ],
};

// ============================================
// WORKFLOW SERVICE API
// ============================================

class AgentWorkflowService {
  /**
   * Get workflow definition by ID
   */
  getWorkflow(workflowId: WorkflowId): WorkflowDefinition | undefined {
    return ALL_WORKFLOWS[workflowId];
  }

  /**
   * Get all workflows for an agent type
   */
  getAgentWorkflows(agentType: CSAgentType): WorkflowDefinition[] {
    const workflowIds = AGENT_WORKFLOWS[agentType];
    return workflowIds.map(id => ALL_WORKFLOWS[id]).filter(Boolean);
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: WorkflowId,
    context: WorkflowContext,
    input: Record<string, unknown> = {}
  ): Promise<WorkflowExecution> {
    const workflow = ALL_WORKFLOWS[workflowId];
    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowId}`);
    }

    // Verify agent type matches
    if (workflow.agentType !== context.agentType) {
      console.warn(
        `Workflow ${workflowId} is for ${workflow.agentType} but being executed by ${context.agentType}`
      );
    }

    return workflowExecutor.execute(workflow, context, input);
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return workflowExecutor.getExecution(executionId);
  }

  /**
   * Approve workflow execution
   */
  async approveExecution(executionId: string, userId: string): Promise<WorkflowExecution> {
    return workflowExecutor.approve(executionId, userId);
  }

  /**
   * Reject workflow execution
   */
  async rejectExecution(
    executionId: string,
    userId: string,
    reason?: string
  ): Promise<WorkflowExecution> {
    return workflowExecutor.reject(executionId, userId, reason);
  }

  /**
   * Subscribe to workflow events
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    workflowExecutor.on(event, listener);
  }

  /**
   * Get workflow metadata for frontend display
   */
  getWorkflowMetadata(workflowId: WorkflowId): {
    id: string;
    name: string;
    description: string;
    category: string;
    requiresApproval: boolean;
    steps: { id: string; name: string }[];
  } | undefined {
    const workflow = ALL_WORKFLOWS[workflowId];
    if (!workflow) return undefined;

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      category: workflow.category,
      requiresApproval: workflow.requiresApproval,
      steps: workflow.steps.map(s => ({ id: s.id, name: s.name })),
    };
  }

  /**
   * Get all workflow metadata for an agent
   */
  getAgentWorkflowMetadata(agentType: CSAgentType): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
  }> {
    return this.getAgentWorkflows(agentType).map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      category: w.category,
    }));
  }
}

export const agentWorkflowService = new AgentWorkflowService();

// ============================================
// QUICK ACTION → WORKFLOW MAPPING
// ============================================

/**
 * Maps frontend quick action IDs to workflow IDs
 */
export const ACTION_TO_WORKFLOW: Record<string, WorkflowId> = {
  // Onboarding actions
  'kickoff': 'create_kickoff_package',
  'plan_30_60_90': 'generate_onboarding_plan',
  'welcome_sequence': 'create_welcome_sequence',
  'stakeholder_map': 'setup_customer_workspace',

  // Adoption actions
  'usage_analysis': 'analyze_usage_metrics',
  'adoption_campaign': 'create_adoption_report',
  'feature_training': 'generate_training_recommendations',
  'champion_program': 'build_champion_playbook',

  // Renewal actions
  'renewal_forecast': 'generate_renewal_forecast',
  'qbr_prep': 'create_qbr_package',
  'value_summary': 'build_value_summary',
  'renewal_playbook': 'create_renewal_proposal',
  'expansion_analysis': 'analyze_expansion_opportunities',

  // Risk actions
  'risk_assessment': 'run_health_assessment',
  'save_play': 'create_save_play',
  'escalation': 'generate_escalation_report',
  'health_check': 'analyze_churn_signals',

  // Strategic actions
  'account_plan': 'create_account_plan',
  'exec_briefing': 'generate_executive_briefing',
  'success_plan': 'build_success_story',
};

/**
 * Helper to execute workflow from a quick action
 */
export async function executeFromAction(
  actionId: string,
  context: WorkflowContext,
  input: Record<string, unknown> = {}
): Promise<WorkflowExecution | null> {
  const workflowId = ACTION_TO_WORKFLOW[actionId];
  if (!workflowId) {
    console.log(`No workflow mapped for action: ${actionId}`);
    return null;
  }

  return agentWorkflowService.executeWorkflow(workflowId, context, input);
}
