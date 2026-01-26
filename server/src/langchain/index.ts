/**
 * LangChain Module Exports
 * Central export for all LangChain-powered functionality
 */

// Vector Store
export { vectorStore, VectorStoreService } from './vectorstore/index.js';

// Tools
export {
  allTools,
  searchTools,
  actionTools,
  analysisTools,
  knowledgeBaseSearchTool,
  contractSearchTool,
  customerNotesSearchTool,
  scheduleMeetingTool,
  sendEmailTool,
  createTaskTool,
  logActivityTool,
  calculateHealthScoreTool,
  googleDriveSearchTool,
  getCustomerSummaryTool
} from './tools/index.js';

// Agents
export {
  agents,
  OnboardingAgent,
  AdoptionAgent,
  RenewalAgent,
  RiskAgent,
  StrategicAgent
} from './agents/CSAgents.js';

export type {
  AgentType,
  CustomerContext,
  AgentResponse,
  ConversationMessage
} from './agents/CSAgents.js';

// Email Agent
export {
  emailAgent,
  EmailAgent
} from './agents/emailAgent.js';

export type {
  EmailType,
  EmailDraftRequest,
  EmailDraftResponse,
  CustomerContext as EmailCustomerContext
} from './agents/emailAgent.js';

// Agent Orchestrator (Multi-agent routing and execution)
export { agentOrchestrator, AgentOrchestrator } from './agents/orchestrator.js';

// Backward compatibility aliases
export { agentOrchestrator as orchestrator } from './agents/orchestrator.js';

// Workflow Agent (LangGraph + Claude Tools)
export { workflowAgent, WorkflowAgent } from './agents/WorkflowAgent.js';
