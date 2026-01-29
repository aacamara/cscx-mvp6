/**
 * Playbook System Types
 * Defines types for multi-step workflow automation playbooks
 */

// ============================================
// Playbook Types
// ============================================

export type PlaybookType =
  | 'renewal'
  | 'risk'
  | 'expansion'
  | 'onboarding'
  | 'qbr'
  | 'escalation'
  | 'retention'
  | 'custom';

export type PlaybookCategory =
  | 'retention'
  | 'growth'
  | 'activation'
  | 'engagement'
  | 'support';

// ============================================
// Playbook Stage
// ============================================

export interface PlaybookStage {
  id: string;
  name: string;
  description?: string;

  /**
   * Day offset from anchor date (can be negative for before, positive for after)
   * Examples: -90 = 90 days before anchor, 7 = 7 days after anchor
   */
  dayOffset: number;

  /**
   * Actions to execute in this stage
   */
  actions: PlaybookAction[];

  /**
   * Conditions that must be met to enter this stage
   */
  entryConditions?: StageCondition[];

  /**
   * Conditions to auto-complete this stage
   */
  completionConditions?: StageCondition[];

  /**
   * If true, stage is optional and can be skipped
   */
  optional?: boolean;

  /**
   * If true, all actions must be approved before execution
   */
  requiresApproval?: boolean;
}

export interface StageCondition {
  type: 'metric' | 'event' | 'custom';
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value: any;
}

// ============================================
// Playbook Action
// ============================================

export type PlaybookActionType =
  | 'email'
  | 'meeting'
  | 'slack'
  | 'task'
  | 'document'
  | 'call'
  | 'internal_note'
  | 'webhook'
  | 'custom';

export interface PlaybookAction {
  id: string;
  type: PlaybookActionType;
  name: string;
  description?: string;

  /**
   * MCP tool to use for execution
   */
  tool?: string;

  /**
   * Parameters for the tool/action
   * Can include template variables like {{customerName}}
   */
  params: Record<string, any>;

  /**
   * If true, requires human approval before execution
   */
  requiresApproval?: boolean;

  /**
   * Priority of the action within the stage
   */
  priority?: number;

  /**
   * Days after stage entry to execute (0 = immediately)
   */
  dayDelay?: number;

  /**
   * If true, action failure doesn't block stage completion
   */
  allowFailure?: boolean;
}

// ============================================
// Playbook Definition
// ============================================

export interface Playbook {
  id: string;
  name: string;
  description?: string;
  type: PlaybookType;
  category: PlaybookCategory;
  stages: PlaybookStage[];

  /**
   * Triggers that can auto-start this playbook
   */
  triggers?: PlaybookTrigger[];

  /**
   * Variables that can be customized per execution
   */
  variables?: PlaybookVariable[];

  /**
   * Estimated total duration in days
   */
  estimatedDurationDays?: number;

  /**
   * Who created this playbook
   */
  source: 'system' | 'user';

  enabled: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaybookTrigger {
  type: 'event' | 'schedule' | 'manual';
  event?: string;
  schedule?: string;  // Cron expression
  conditions?: StageCondition[];
}

export interface PlaybookVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

// ============================================
// Playbook Execution
// ============================================

export type ExecutionStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type StageStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'failed';

export interface PlaybookExecution {
  id: string;
  playbookId: string;
  playbookName?: string;
  customerId: string;
  customerName?: string;
  userId: string;

  /**
   * The date that day offsets are calculated from
   * For renewal playbooks: renewal date
   * For onboarding: start date
   */
  anchorDate: Date;

  /**
   * Current stage ID
   */
  currentStage?: string;

  /**
   * Current step within stage
   */
  currentStep: number;

  /**
   * Status of each stage
   */
  stageStatuses: Record<string, StageStatus>;

  /**
   * Results of executed actions
   */
  actionResults: ActionResult[];

  /**
   * Variable values for this execution
   */
  variables: Record<string, any>;

  status: ExecutionStatus;
  startedAt: Date;
  pausedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface ActionResult {
  actionId: string;
  stageId: string;
  actionType: PlaybookActionType;
  status: 'pending' | 'approved' | 'executed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  approvalId?: string;
  executedAt?: Date;
}

// ============================================
// Playbook Events (for observability)
// ============================================

export interface PlaybookEvent {
  type: PlaybookEventType;
  executionId: string;
  playbookId: string;
  customerId: string;
  stageId?: string;
  actionId?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export type PlaybookEventType =
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_paused'
  | 'execution_resumed'
  | 'stage_entered'
  | 'stage_completed'
  | 'stage_skipped'
  | 'action_started'
  | 'action_completed'
  | 'action_failed'
  | 'approval_requested'
  | 'approval_received';

// ============================================
// Exports
// ============================================

export { PlaybookExecutor, playbookExecutor } from './executor.js';
