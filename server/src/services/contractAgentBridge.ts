/**
 * Contract Agent Bridge
 * Connects contract parsing workflow to agent execution system
 * Triggers appropriate agents based on parsed contract data
 */

import { agentOrchestrator } from '../langchain/agents/orchestrator.js';
import { agentTracer } from './agentTracer.js';
import { SpecialistType, SpecialistContext } from '../langchain/agents/specialists/index.js';

// ============================================
// Types
// ============================================

interface ContractExtraction {
  company_name: string;
  arr?: number;
  contract_period?: string;
  entitlements?: Array<{ description: string; quantity?: number }>;
  stakeholders?: Array<{ name: string; role: string; email?: string }>;
  technical_requirements?: Array<{ requirement: string; priority?: string }>;
  contract_tasks?: Array<{ task: string; deadline?: string }>;
  pricing_terms?: Array<{ item: string; amount?: number }>;
  missing_info?: string[];
  next_steps?: string[];
}

interface OnboardingPlan {
  phases: Array<{
    name: string;
    duration: string;
    tasks: Array<{
      title: string;
      description: string;
      owner?: string;
      dependencies?: string[];
    }>;
  }>;
  milestones?: Array<{
    name: string;
    date: string;
    criteria: string[];
  }>;
}

interface AgentExecutionConfig {
  userId: string;
  sessionId: string;
  contractData: ContractExtraction;
  onboardingPlan?: OnboardingPlan;
  autoExecute?: boolean;
}

interface AgentExecutionResult {
  success: boolean;
  agentUsed: SpecialistType;
  response: string;
  actions: Array<{
    type: string;
    description: string;
    status: 'pending' | 'completed' | 'requires_approval';
  }>;
  trace: {
    runId: string;
    steps: number;
    duration: number;
  };
}

// ============================================
// Contract Analysis Functions
// ============================================

/**
 * Analyze contract to determine urgency and required actions
 */
function analyzeContractUrgency(contract: ContractExtraction): {
  urgency: 'high' | 'medium' | 'low';
  reasons: string[];
} {
  const reasons: string[] = [];
  let urgencyScore = 0;

  // High ARR customers need immediate attention
  if (contract.arr && contract.arr > 100000) {
    urgencyScore += 3;
    reasons.push(`High-value customer ($${contract.arr.toLocaleString()} ARR)`);
  }

  // Missing critical info needs follow-up
  if (contract.missing_info && contract.missing_info.length > 3) {
    urgencyScore += 2;
    reasons.push(`${contract.missing_info.length} missing information items`);
  }

  // Complex technical requirements
  if (contract.technical_requirements && contract.technical_requirements.length > 5) {
    urgencyScore += 1;
    reasons.push(`${contract.technical_requirements.length} technical requirements to address`);
  }

  // Many stakeholders = complex engagement
  if (contract.stakeholders && contract.stakeholders.length > 5) {
    urgencyScore += 1;
    reasons.push(`${contract.stakeholders.length} stakeholders to coordinate`);
  }

  return {
    urgency: urgencyScore >= 4 ? 'high' : urgencyScore >= 2 ? 'medium' : 'low',
    reasons
  };
}

/**
 * Determine which specialist agents should be engaged
 */
function determineRequiredAgents(
  contract: ContractExtraction,
  plan?: OnboardingPlan
): SpecialistType[] {
  const agents: SpecialistType[] = ['onboarding']; // Always start with onboarding

  // Complex stakeholder map needs research
  if (contract.stakeholders && contract.stakeholders.length > 3) {
    agents.push('research');
  }

  // Technical requirements need adoption support
  if (contract.technical_requirements && contract.technical_requirements.length > 0) {
    agents.push('adoption');
  }

  // Email drafting for initial outreach
  agents.push('email');

  // Meeting scheduling for kickoff
  agents.push('meeting');

  return [...new Set(agents)]; // Remove duplicates
}

/**
 * Build context message for agent from contract data
 */
function buildAgentPrompt(
  contract: ContractExtraction,
  plan?: OnboardingPlan
): string {
  const parts: string[] = [
    `New customer onboarding: ${contract.company_name}`,
  ];

  if (contract.arr) {
    parts.push(`ARR: $${contract.arr.toLocaleString()}`);
  }

  if (contract.stakeholders && contract.stakeholders.length > 0) {
    const keyStakeholders = contract.stakeholders.slice(0, 3)
      .map(s => `${s.name} (${s.role})`).join(', ');
    parts.push(`Key stakeholders: ${keyStakeholders}`);
  }

  if (contract.technical_requirements && contract.technical_requirements.length > 0) {
    parts.push(`Technical requirements: ${contract.technical_requirements.length} items`);
  }

  if (plan?.phases && plan.phases.length > 0) {
    const firstPhase = plan.phases[0];
    parts.push(`First phase: ${firstPhase.name} (${firstPhase.duration})`);
    parts.push(`Initial tasks: ${firstPhase.tasks?.length || 0} tasks`);
  }

  parts.push('');
  parts.push('Please help me kick off this onboarding:');
  parts.push('1. Draft a welcome email to the primary stakeholder');
  parts.push('2. Schedule a kickoff meeting');
  parts.push('3. Create initial tasks for the first 30 days');

  return parts.join('\n');
}

// ============================================
// Main Bridge Functions
// ============================================

/**
 * Trigger agent execution from parsed contract
 */
export async function triggerAgentFromContract(
  config: AgentExecutionConfig
): Promise<AgentExecutionResult> {
  const { userId, sessionId, contractData, onboardingPlan, autoExecute = true } = config;
  const startTime = Date.now();
  let stepCount = 0;

  // Start a trace for this bridge operation
  const bridgeRun = await agentTracer.startRun({
    agentId: 'contract-bridge',
    agentName: 'Contract Agent Bridge',
    agentType: 'orchestrator',
    userId,
    sessionId,
    customerContext: {
      name: contractData.company_name,
      arr: contractData.arr,
    },
    input: `Contract parsed for ${contractData.company_name}`,
    metadata: {
      source: 'contract_parsing',
      hasOnboardingPlan: !!onboardingPlan
    }
  });

  try {
    // Analyze contract urgency
    const urgencyAnalysis = analyzeContractUrgency(contractData);
    await agentTracer.logStep(bridgeRun.id, {
      type: 'thinking',
      name: 'Analyze Contract Urgency',
      description: `Urgency: ${urgencyAnalysis.urgency}`,
      output: urgencyAnalysis
    });
    stepCount++;

    // Determine required agents
    const requiredAgents = determineRequiredAgents(contractData, onboardingPlan);
    await agentTracer.logStep(bridgeRun.id, {
      type: 'decision',
      name: 'Determine Required Agents',
      output: { agents: requiredAgents }
    });
    stepCount++;

    // Build agent context
    const context: SpecialistContext = {
      userId,
      sessionId,
      customerContext: {
        id: `contract-${Date.now()}`,
        name: contractData.company_name,
        arr: contractData.arr,
        healthScore: 70, // New customer default
        daysToRenewal: 365,
      },
      contractContext: {
        stakeholders: contractData.stakeholders,
        technicalRequirements: contractData.technical_requirements,
        entitlements: contractData.entitlements,
        tasks: contractData.contract_tasks
      }
    };

    // Build the prompt
    const prompt = buildAgentPrompt(contractData, onboardingPlan);

    await agentTracer.logStep(bridgeRun.id, {
      type: 'thinking',
      name: 'Build Agent Prompt',
      input: { contractName: contractData.company_name },
      output: { promptLength: prompt.length }
    });
    stepCount++;

    // Execute through orchestrator if autoExecute is enabled
    if (autoExecute) {
      await agentTracer.logStep(bridgeRun.id, {
        type: 'handoff',
        name: 'Handoff to Orchestrator',
        description: 'Delegating to agent orchestrator for execution'
      });
      stepCount++;

      const result = await agentOrchestrator.chat(prompt, context);

      await agentTracer.endRun(bridgeRun.id, {
        status: result.requiresApproval ? 'waiting_approval' : 'completed',
        output: result.response
      });

      return {
        success: true,
        agentUsed: result.specialistUsed,
        response: result.response,
        actions: result.pendingActions.map((action: any) => ({
          type: action.type || 'task',
          description: action.description || action.title || 'Pending action',
          status: action.requiresApproval ? 'requires_approval' : 'pending'
        })),
        trace: {
          runId: bridgeRun.id,
          steps: stepCount,
          duration: Date.now() - startTime
        }
      };
    }

    // If not auto-executing, just return analysis
    await agentTracer.endRun(bridgeRun.id, {
      status: 'completed',
      output: 'Contract analyzed, awaiting manual agent trigger'
    });

    return {
      success: true,
      agentUsed: 'onboarding',
      response: `Contract for ${contractData.company_name} analyzed. Ready to execute with agents: ${requiredAgents.join(', ')}`,
      actions: requiredAgents.map(agent => ({
        type: 'agent_ready',
        description: `${agent} agent ready to execute`,
        status: 'pending' as const
      })),
      trace: {
        runId: bridgeRun.id,
        steps: stepCount,
        duration: Date.now() - startTime
      }
    };

  } catch (error) {
    await agentTracer.endRun(bridgeRun.id, {
      status: 'failed',
      error: (error as Error).message
    });

    return {
      success: false,
      agentUsed: 'onboarding',
      response: `Failed to process contract: ${(error as Error).message}`,
      actions: [],
      trace: {
        runId: bridgeRun.id,
        steps: stepCount,
        duration: Date.now() - startTime
      }
    };
  }
}

/**
 * Get recommended next actions based on contract
 */
export function getRecommendedActions(
  contract: ContractExtraction,
  plan?: OnboardingPlan
): Array<{
  action: string;
  agent: SpecialistType;
  priority: 'high' | 'medium' | 'low';
  description: string;
}> {
  const actions: Array<{
    action: string;
    agent: SpecialistType;
    priority: 'high' | 'medium' | 'low';
    description: string;
  }> = [];

  // Always recommend kickoff email
  const primaryStakeholder = contract.stakeholders?.[0];
  if (primaryStakeholder) {
    actions.push({
      action: 'draft_welcome_email',
      agent: 'email',
      priority: 'high',
      description: `Draft welcome email to ${primaryStakeholder.name} (${primaryStakeholder.role})`
    });
  }

  // Schedule kickoff meeting
  actions.push({
    action: 'schedule_kickoff',
    agent: 'meeting',
    priority: 'high',
    description: 'Schedule kickoff meeting with key stakeholders'
  });

  // Research if complex stakeholder map
  if (contract.stakeholders && contract.stakeholders.length > 3) {
    actions.push({
      action: 'stakeholder_research',
      agent: 'research',
      priority: 'medium',
      description: `Research ${contract.stakeholders.length} stakeholders for engagement strategy`
    });
  }

  // Technical review if requirements exist
  if (contract.technical_requirements && contract.technical_requirements.length > 0) {
    actions.push({
      action: 'technical_review',
      agent: 'adoption',
      priority: 'medium',
      description: `Review ${contract.technical_requirements.length} technical requirements`
    });
  }

  // Handle missing information
  if (contract.missing_info && contract.missing_info.length > 0) {
    actions.push({
      action: 'gather_missing_info',
      agent: 'onboarding',
      priority: 'high',
      description: `Gather ${contract.missing_info.length} missing information items`
    });
  }

  return actions;
}

/**
 * Create onboarding summary for agents
 */
export function createOnboardingSummary(
  contract: ContractExtraction,
  plan?: OnboardingPlan
): string {
  const lines: string[] = [
    `# Onboarding Summary: ${contract.company_name}`,
    '',
    '## Contract Overview',
  ];

  if (contract.arr) {
    lines.push(`- **ARR**: $${contract.arr.toLocaleString()}`);
  }
  if (contract.contract_period) {
    lines.push(`- **Contract Period**: ${contract.contract_period}`);
  }

  if (contract.stakeholders && contract.stakeholders.length > 0) {
    lines.push('', '## Key Stakeholders');
    contract.stakeholders.forEach(s => {
      lines.push(`- **${s.name}** - ${s.role}${s.email ? ` (${s.email})` : ''}`);
    });
  }

  if (contract.entitlements && contract.entitlements.length > 0) {
    lines.push('', '## Entitlements');
    contract.entitlements.slice(0, 5).forEach(e => {
      lines.push(`- ${e.description}${e.quantity ? ` (${e.quantity})` : ''}`);
    });
    if (contract.entitlements.length > 5) {
      lines.push(`- ... and ${contract.entitlements.length - 5} more`);
    }
  }

  if (plan?.phases && plan.phases.length > 0) {
    lines.push('', '## 30-60-90 Day Plan');
    plan.phases.forEach(phase => {
      lines.push(``, `### ${phase.name} (${phase.duration})`);
      phase.tasks?.slice(0, 3).forEach(task => {
        lines.push(`- ${task.title}`);
      });
      if (phase.tasks && phase.tasks.length > 3) {
        lines.push(`- ... and ${phase.tasks.length - 3} more tasks`);
      }
    });
  }

  if (contract.missing_info && contract.missing_info.length > 0) {
    lines.push('', '## Missing Information');
    contract.missing_info.forEach(info => {
      lines.push(`- ⚠️ ${info}`);
    });
  }

  return lines.join('\n');
}
