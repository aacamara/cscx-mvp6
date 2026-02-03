// Legacy agent types (sub-agents for orchestration)
export type LegacyAgentId = 'onboarding' | 'meeting' | 'training' | 'intelligence';

// New LangChain-powered specialist agents
export type CSAgentType = 'onboarding' | 'adoption' | 'renewal' | 'risk' | 'strategic';

// Combined agent ID (supports both legacy and new)
export type AgentId = LegacyAgentId | CSAgentType;
export type AgentStatus = 'idle' | 'ready' | 'active';

export interface Agent {
  id: AgentId;
  name: string;
  icon: string;
  color: string;
  description: string;
  capabilities: string[];
}

export interface RoutingDecision {
  agentType: CSAgentType;
  confidence: number;
  reasoning: string;
}

export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface AgentMessage {
  agent?: AgentId;
  message: string;
  isUser?: boolean;
  isThinking?: boolean;
  isApproval?: boolean;
  deploy?: AgentId;
  routing?: RoutingDecision;
  toolResults?: Array<{ toolCallId?: string; toolName: string; result: any }>;
  attachment?: {
    name: string;
    size: number;
    type: string;
  };
  status?: MessageStatus;
  id?: string;
}

// Re-export CustomerContext from workflow for consistency
export type { CustomerContext } from './workflow';

// Contract task from parsing (simplified to match workflow)
export interface ContractTask {
  task: string;
  description?: string;
  owner?: string;
  assigned_agent?: string;
  priority?: 'High' | 'Medium' | 'Low' | 'high' | 'medium' | 'low';
  dependencies?: string;
  due_date?: string;
  status?: string;
}

// Legacy sub-agents (for internal orchestration)
export const AGENTS: Record<LegacyAgentId, Agent> = {
  onboarding: {
    id: 'onboarding',
    name: 'Onboarding Agent',
    icon: '🎯',
    color: '#e63946',
    description: 'Main orchestrator - coordinates all subagents',
    capabilities: ['Coordinate workflows', 'Deploy subagents', 'Track progress', 'Request approvals'],
  },
  meeting: {
    id: 'meeting',
    name: 'Meeting Agent',
    icon: '🎙',
    color: '#22c55e',
    description: 'Runs discovery calls, captures use cases and information',
    capabilities: ['Schedule Zoom/Meet/Teams', 'Join calls', 'Live transcription', 'Extract insights'],
  },
  training: {
    id: 'training',
    name: 'Training Agent',
    icon: '📚',
    color: '#3b82f6',
    description: 'AI-powered training modules, KB-powered voice agent',
    capabilities: ['Voice-enabled training', 'Knowledge base Q&A', 'Onboarding guides', 'Self-service support'],
  },
  intelligence: {
    id: 'intelligence',
    name: 'Intelligence Agent',
    icon: '📊',
    color: '#a855f7',
    description: 'Consolidates data, health metrics, customer story',
    capabilities: ['CRM data sync', 'Health scoring', 'Integration monitoring', 'Customer timeline'],
  },
};

// New LangChain-powered CS specialist agents
export const CS_AGENTS: Record<CSAgentType, Agent> = {
  onboarding: {
    id: 'onboarding',
    name: 'Onboarding Specialist',
    icon: '🚀',
    color: '#e63946',
    description: 'Expert in new customer setup, kickoff, and 30-60-90 day plans',
    capabilities: ['Kickoff planning', 'Stakeholder mapping', 'Training coordination', 'Early warning detection'],
  },
  adoption: {
    id: 'adoption',
    name: 'Adoption Specialist',
    icon: '📈',
    color: '#22c55e',
    description: 'Drives product usage, feature adoption, and user engagement',
    capabilities: ['Usage analysis', 'Training programs', 'Feature campaigns', 'Champion development'],
  },
  renewal: {
    id: 'renewal',
    name: 'Renewal Specialist',
    icon: '🔄',
    color: '#3b82f6',
    description: 'Manages renewals, expansion, and commercial negotiations',
    capabilities: ['Renewal forecasting', 'Value summaries', 'Expansion strategy', 'Pricing negotiation'],
  },
  risk: {
    id: 'risk',
    name: 'Risk Specialist',
    icon: '⚠️',
    color: '#f59e0b',
    description: 'Identifies at-risk customers and creates save plays',
    capabilities: ['Risk scoring', 'Save plays', 'Escalation management', 'Issue resolution'],
  },
  strategic: {
    id: 'strategic',
    name: 'Strategic CSM',
    icon: '🎯',
    color: '#a855f7',
    description: 'Handles executive relationships, QBRs, and strategic planning',
    capabilities: ['Executive engagement', 'QBR preparation', 'Account planning', 'Business transformation'],
  },
};
