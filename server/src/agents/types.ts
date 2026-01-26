/**
 * CSCX.AI 10X Agent Architecture - Core Types
 * Production-grade multi-agent orchestration system
 */

import { JSONSchema7 } from 'json-schema';

// ============================================
// Agent Model Types
// ============================================

export type AgentModel = 'claude-opus-4' | 'claude-sonnet-4' | 'claude-haiku-4';

// ============================================
// Permission Model (IAM-Style)
// ============================================

export interface AgentPermissions {
  allowedTools: string[];
  allowedDirectories: string[];
  requiresApproval: string[];  // Actions needing human confirmation
  blockedActions: string[];    // Never allow (e.g., delete customer, send without review)
}

// ============================================
// Context Engineering
// ============================================

export interface CustomerProfile {
  id: string;
  name: string;
  industry?: string;
  arr: number;
  healthScore: number;
  status: 'active' | 'onboarding' | 'at_risk' | 'churned';
  renewalDate?: string;
  csmName?: string;
  primaryContact?: {
    name: string;
    email: string;
    title?: string;
  };
  workspaceConnection?: WorkspaceConnection;
}

export interface WorkspaceConnection {
  googleCalendar: {
    connected: boolean;
    lastSync: Date | null;
    syncedCalendars: string[];
    permissions: ('read' | 'write' | 'manage')[];
  };
  googleDrive: {
    connected: boolean;
    customerFolderId: string | null;
    sharedFolders: string[];
  };
  gmail: {
    connected: boolean;
    trackedThreads: string[];
    lastEmailDate: Date | null;
    unreadCount: number;
  };
  overallStatus: 'healthy' | 'partial' | 'disconnected';
  lastHealthCheck: Date;
}

export interface ContractData {
  company_name: string;
  arr: number;
  contract_period?: string;
  entitlements?: Array<{ description: string; quantity?: number }>;
  stakeholders?: Array<{ name: string; role: string; email?: string }>;
  technical_requirements?: Array<{ requirement: string; priority?: string }>;
  contract_tasks?: Array<{ task: string; status?: string }>;
  missing_info?: string[];
  pricing_terms?: any;
  next_steps?: string[];
}

export interface OnboardingPlan {
  timeline_days: number;
  phases: Array<{
    name: string;
    days: string;
    tasks: Array<{
      task: string;
      owner: string;
      status: string;
    }>;
  }>;
}

export interface RiskSignal {
  type: 'churn' | 'engagement' | 'adoption' | 'sentiment';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
}

export interface Interaction {
  type: 'email' | 'meeting' | 'call' | 'note' | 'task';
  title: string;
  description?: string;
  date: Date;
  user?: string;
}

export interface AgentContext {
  // Immutable context (set once)
  customer: CustomerProfile;
  contract?: ContractData;
  plan?: OnboardingPlan;

  // Dynamic context (updates as workflow progresses)
  currentPhase: OnboardingPhase;
  completedTasks: CompletedStep[];
  pendingApprovals: Approval[];
  recentInteractions: Interaction[];
  riskSignals: RiskSignal[];

  // Task ledger for orchestrator
  taskLedger?: TaskLedger;
}

// ============================================
// Workflow State Machine
// ============================================

export type OnboardingPhase =
  | 'upload'           // Contract upload
  | 'parsing'          // AI extracting data
  | 'review'           // Human reviews extracted data
  | 'enriching'        // AI gathering additional intelligence
  | 'planning'         // AI generating onboarding plan
  | 'plan_review'      // Human reviews plan
  | 'executing'        // Agents actively working
  | 'monitoring'       // Ongoing monitoring post-onboarding
  | 'completed';       // Onboarding complete

export const phaseTransitions: Record<OnboardingPhase, OnboardingPhase[]> = {
  'upload': ['parsing'],
  'parsing': ['review'],
  'review': ['enriching', 'planning'], // Can skip enrichment
  'enriching': ['planning'],
  'planning': ['plan_review'],
  'plan_review': ['executing', 'planning'], // Can regenerate plan
  'executing': ['monitoring', 'completed'],
  'monitoring': ['completed'],
  'completed': []
};

// ============================================
// Tool Definitions
// ============================================

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
  requiresApproval: boolean;
  execute: (input: any, context: AgentContext) => Promise<ToolResult>;
}

// ============================================
// Task Ledger (Orchestrator's Plan)
// ============================================

export interface TaskStep {
  id: string;
  description: string;
  agentId: string;
  toolName?: string;
  input?: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  dependsOn?: string[];
}

export interface CompletedStep extends TaskStep {
  status: 'completed';
  result: ToolResult;
  completedAt: Date;
  durationMs: number;
}

export interface BlockedStep extends TaskStep {
  status: 'blocked';
  blockedReason: string;
  blockedAt: Date;
}

export interface TaskLedger {
  id: string;
  originalRequest: string;
  plan: TaskStep[];
  currentStep: number;
  completedSteps: CompletedStep[];
  blockedSteps: BlockedStep[];
  status: 'planning' | 'executing' | 'waiting_approval' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Approval System (HITL)
// ============================================

export type ApprovalType =
  | 'send_email'           // Always require approval
  | 'book_meeting'         // Always require approval
  | 'create_document'      // Require approval
  | 'share_externally'     // Always require approval
  | 'update_crm'           // Auto-approve if minor
  | 'internal_note'        // Auto-approve
  | 'research_action'      // Auto-approve
  | 'escalation';          // Always require approval

export interface Approval {
  id: string;
  type: ApprovalType;
  agentId: string;
  action: {
    toolName: string;
    input: any;
    description: string;
  };
  reason: string;
  recommendation: string;
  preview?: any; // Email preview, meeting details, etc.
  createdAt: Date;
  expiresAt: Date;
  urgency: 'blocking' | 'important' | 'informational';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface ApprovalPolicy {
  type: ApprovalType;
  requiresApproval: boolean;
  autoApproveConditions?: (context: AgentContext, action: any) => boolean;
  urgency: 'blocking' | 'important' | 'informational';
  expiresInMinutes?: number;
}

// ============================================
// Agent Definition
// ============================================

export interface AgentHooks {
  preToolUse?: (tool: string, input: any) => Promise<boolean>;
  postToolUse?: (tool: string, output: any) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  model: AgentModel;

  // Tools this agent can use
  tools: Tool[];

  // Permissions
  permissions: AgentPermissions;

  // Context requirements
  requiredContext: string[];

  // Hooks for observability
  hooks: AgentHooks;
}

// ============================================
// Agent Events (Observability)
// ============================================

export interface AgentEvent {
  id: string;
  timestamp: Date;
  agentId: string;
  eventType: 'tool_use' | 'decision' | 'error' | 'approval_request' | 'completion';

  // Tool use details
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;

  // Decision details
  decision?: string;
  reasoning?: string;

  // Error details
  error?: Error;

  // Metrics
  durationMs: number;
  tokensUsed: number;
}

export interface AgentMetrics {
  agentId: string;
  totalActions: number;
  successRate: number;
  avgResponseTime: number;
  approvalRate: number;
  errorRate: number;
  tokenUsage: number;
}
