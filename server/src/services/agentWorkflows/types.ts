/**
 * Agent Workflow Types
 *
 * Workflows are multi-step orchestrations that:
 * 1. Fetch data from Google Workspace (Sheets, Drive, Gmail)
 * 2. Process and analyze the data
 * 3. Create outputs (docs, sheets, folders)
 * 4. Return to chat for HITL approval
 */

import type { CSAgentType } from '../google/agentActions.js';

// Re-export CSAgentType for convenience
export type { CSAgentType };

// ============================================
// Workflow Execution Types
// ============================================

export type WorkflowStatus =
  | 'pending'        // Not started
  | 'fetching'       // Gathering data from Google Workspace
  | 'processing'     // Analyzing data
  | 'creating'       // Creating outputs
  | 'awaiting_review' // Output ready, waiting for user review
  | 'approved'       // User approved
  | 'rejected'       // User rejected
  | 'completed'      // Successfully executed
  | 'failed';        // Error occurred

export interface WorkflowStep {
  id: string;
  name: string;
  status: WorkflowStatus;
  description?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  data?: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  agentType: CSAgentType;
  userId: string;
  customerId: string;
  customerName: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  input: Record<string, unknown>;
  output?: WorkflowOutput;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface WorkflowOutput {
  // Created files
  files?: Array<{
    type: 'doc' | 'sheet' | 'slide' | 'folder';
    id: string;
    name: string;
    url: string;
  }>;
  // Summary message for chat
  summary: string;
  // Data to display in review
  reviewData?: Record<string, unknown>;
  // Demo mode indicator
  demoMode?: boolean;
  // Actions available after review
  actions?: Array<{
    id: string;
    label: string;
    type: 'approve' | 'reject' | 'edit' | 'view';
  }>;
}

// ============================================
// Data Source Types
// ============================================

export interface DataSource {
  type: 'sheet' | 'drive' | 'gmail' | 'calendar';
  query: DataSourceQuery;
  transform?: (data: unknown) => unknown;
}

export type DataSourceQuery =
  | SheetQuery
  | DriveQuery
  | GmailQuery
  | CalendarQuery;

export interface SheetQuery {
  type: 'sheet';
  spreadsheetId?: string;       // Specific sheet ID
  spreadsheetName?: string;     // Search by name in customer workspace
  sheetTab?: string;            // Specific tab
  range?: string;               // e.g., 'A1:Z100'
  filters?: Record<string, string>; // Column filters
}

export interface DriveQuery {
  type: 'drive';
  folderId?: string;
  folderPath?: string;          // e.g., 'Contracts', 'QBRs'
  fileType?: 'doc' | 'sheet' | 'slide' | 'pdf' | 'any';
  nameContains?: string;
  createdAfter?: Date;
  modifiedAfter?: Date;
  maxResults?: number;
}

export interface GmailQuery {
  type: 'gmail';
  query?: string;               // Gmail search query
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  after?: Date;
  before?: Date;
  maxResults?: number;
  includeBody?: boolean;
}

export interface CalendarQuery {
  type: 'calendar';
  timeMin?: Date;
  timeMax?: Date;
  query?: string;
  maxResults?: number;
}

// ============================================
// Workflow Definition Types
// ============================================

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  agentType: CSAgentType;
  category: 'analysis' | 'creation' | 'communication' | 'automation';

  // What data to fetch
  dataSources: DataSource[];

  // What to create
  outputs: WorkflowOutputDefinition[];

  // Approval settings
  requiresApproval: boolean;
  approvalMessage?: string;

  // Execution steps
  steps: WorkflowStepDefinition[];
}

export interface WorkflowStepDefinition {
  id: string;
  name: string;
  type: 'fetch' | 'process' | 'create' | 'notify';
  config: Record<string, unknown>;
}

export interface WorkflowOutputDefinition {
  type: 'doc' | 'sheet' | 'slide' | 'folder' | 'email_draft';
  template?: string;
  name: string;
  folder?: string;              // Customer workspace folder
  variables?: string[];         // Variables to populate from data
}

// ============================================
// Agent-Specific Workflow IDs
// ============================================

export type OnboardingWorkflowId =
  | 'create_kickoff_package'
  | 'generate_onboarding_plan'
  | 'create_welcome_sequence'
  | 'setup_customer_workspace'
  | 'create_training_materials';

export type AdoptionWorkflowId =
  | 'analyze_usage_metrics'
  | 'create_adoption_report'
  | 'generate_training_recommendations'
  | 'create_feature_rollout_plan'
  | 'build_champion_playbook';

export type RenewalWorkflowId =
  | 'generate_renewal_forecast'
  | 'create_qbr_package'
  | 'build_value_summary'
  | 'create_renewal_proposal'
  | 'analyze_expansion_opportunities';

export type RiskWorkflowId =
  | 'run_health_assessment'
  | 'create_save_play'
  | 'generate_escalation_report'
  | 'analyze_churn_signals'
  | 'create_recovery_plan';

export type StrategicWorkflowId =
  | 'create_account_plan'
  | 'generate_executive_briefing'
  | 'build_success_story'
  | 'create_partnership_proposal'
  | 'analyze_strategic_opportunities';

export type WorkflowId =
  | OnboardingWorkflowId
  | AdoptionWorkflowId
  | RenewalWorkflowId
  | RiskWorkflowId
  | StrategicWorkflowId;

// ============================================
// Workflow Context
// ============================================

export interface WorkflowContext {
  userId: string;
  agentType: CSAgentType;
  customerId: string;
  customerName: string;
  customerARR?: number;
  renewalDate?: string;
  healthScore?: number;
  sessionId?: string;
  // Data fetched during execution
  fetchedData?: Record<string, unknown>;
}
