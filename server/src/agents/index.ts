/**
 * CSCX.AI 10X Agent Architecture
 * Central export for all agents and types
 */

// Types
export * from './types';

// Agents
export { OrchestratorAgent, getOrchestratorSystemPrompt } from './specialists/orchestrator';
export { SchedulerAgent } from './specialists/scheduler';
export { CommunicatorAgent } from './specialists/communicator';
export { ResearcherAgent } from './specialists/researcher';

// Agent Registry
import { Agent } from './types';
import { OrchestratorAgent } from './specialists/orchestrator';
import { SchedulerAgent } from './specialists/scheduler';
import { CommunicatorAgent } from './specialists/communicator';
import { ResearcherAgent } from './specialists/researcher';

export const AgentRegistry: Record<string, Agent> = {
  orchestrator: OrchestratorAgent,
  scheduler: SchedulerAgent,
  communicator: CommunicatorAgent,
  researcher: ResearcherAgent,
};

export const getAgent = (agentId: string): Agent | undefined => {
  return AgentRegistry[agentId];
};

export const getAllAgents = (): Agent[] => {
  return Object.values(AgentRegistry);
};

// Approval Policies
import { ApprovalPolicy, ApprovalType, AgentContext } from './types';

export const approvalPolicies: ApprovalPolicy[] = [
  {
    type: 'send_email',
    requiresApproval: true,
    urgency: 'blocking',
    expiresInMinutes: 60 * 24 // 24 hours
  },
  {
    type: 'book_meeting',
    requiresApproval: true,
    urgency: 'important',
    expiresInMinutes: 60 * 4 // 4 hours
  },
  {
    type: 'create_document',
    requiresApproval: true,
    urgency: 'important',
    expiresInMinutes: 60 * 24
  },
  {
    type: 'share_externally',
    requiresApproval: true,
    urgency: 'blocking',
    expiresInMinutes: 60 * 24
  },
  {
    type: 'update_crm',
    requiresApproval: false,
    autoApproveConditions: (context: AgentContext, action: any) => {
      // Auto-approve minor CRM updates
      return action.metadata?.changeType === 'minor';
    },
    urgency: 'informational'
  },
  {
    type: 'internal_note',
    requiresApproval: false,
    urgency: 'informational'
  },
  {
    type: 'research_action',
    requiresApproval: false,
    urgency: 'informational'
  },
  {
    type: 'escalation',
    requiresApproval: true,
    urgency: 'blocking',
    expiresInMinutes: 60 * 2 // 2 hours
  }
];

export const getApprovalPolicy = (type: ApprovalType): ApprovalPolicy | undefined => {
  return approvalPolicies.find(p => p.type === type);
};

export const shouldRequireApproval = (
  type: ApprovalType,
  context: AgentContext,
  action: any
): boolean => {
  const policy = getApprovalPolicy(type);
  if (!policy) return true; // Default to requiring approval

  if (!policy.requiresApproval) return false;

  // Check auto-approve conditions
  if (policy.autoApproveConditions && policy.autoApproveConditions(context, action)) {
    return false;
  }

  return true;
};
