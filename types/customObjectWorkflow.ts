/**
 * PRD-146: Custom Object Created -> Workflow
 * Types for custom object workflow automation
 */

// ============================================
// Custom Object Types
// ============================================

export type CustomObjectType =
  | 'project'
  | 'initiative'
  | 'milestone'
  | 'success_plan'
  | 'engagement'
  | 'custom';

export type WorkflowStatus = 'active' | 'completed' | 'cancelled' | 'paused';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';

export type AssignmentRuleType =
  | 'csm_owner'
  | 'account_executive'
  | 'technical_lead'
  | 'customer_contact'
  | 'specific_user'
  | 'round_robin';

// ============================================
// Task Reference
// ============================================

export interface TaskRef {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate?: Date;
  assignee?: string;
  order: number;
}

// ============================================
// Milestone Reference
// ============================================

export interface MilestoneRef {
  id: string;
  name: string;
  description?: string;
  targetDate?: Date;
  completedAt?: Date;
  status: 'pending' | 'completed' | 'missed';
}

// ============================================
// Notification Rule
// ============================================

export interface NotificationRule {
  id: string;
  trigger: 'task_due' | 'task_overdue' | 'milestone_approaching' | 'workflow_completed' | 'custom';
  triggerConfig?: {
    daysBefore?: number;
    condition?: string;
  };
  recipients: string[];
  channel: 'email' | 'slack' | 'in_app' | 'all';
  template?: string;
  enabled: boolean;
}

// ============================================
// Approval Configuration
// ============================================

export interface ApprovalConfig {
  id: string;
  name: string;
  requiredAt: 'milestone_complete' | 'workflow_start' | 'workflow_complete' | 'custom';
  approvers: string[];
  escalationPolicy?: {
    escalateAfterHours: number;
    escalateTo: string[];
  };
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
}

// ============================================
// Timeline Event
// ============================================

export interface TimelineEvent {
  id: string;
  name: string;
  type: 'milestone' | 'task_due' | 'review' | 'custom';
  date: Date;
  completed: boolean;
}

// ============================================
// Assignment Rules
// ============================================

export interface AssignmentRule {
  role: string;
  ruleType: AssignmentRuleType;
  specificUserId?: string;
  fallbackRule?: AssignmentRuleType;
}

// ============================================
// Custom Object Workflow
// ============================================

export interface CustomObjectWorkflow {
  id: string;
  objectType: CustomObjectType;
  objectId: string;
  objectName: string;
  customerId: string;
  customerName?: string;

  workflowTemplate: {
    id: string;
    name: string;
    version: number;
  };

  generatedElements: {
    tasks: TaskRef[];
    milestones: MilestoneRef[];
    notifications: NotificationRule[];
    approvals: ApprovalConfig[];
  };

  assignments: {
    owner: string;
    ownerName?: string;
    participants: string[];
    approvers: string[];
  };

  timeline: {
    startDate: Date;
    endDate: Date;
    milestones: TimelineEvent[];
  };

  status: WorkflowStatus;
  progress: number; // 0-100 percentage

  metadata?: Record<string, unknown>;

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// ============================================
// Task Template
// ============================================

export interface TaskTemplate {
  title: string;
  description?: string;
  assigneeRole: AssignmentRuleType;
  dueDaysFromStart: number;
  dependencies?: string[]; // Task template IDs
  order: number;
  tags?: string[];
  requiredForMilestone?: string; // Milestone template ID
}

// ============================================
// Milestone Template
// ============================================

export interface MilestoneTemplate {
  id: string;
  name: string;
  description?: string;
  dayFromStart: number;
  requiredTasksComplete?: boolean;
}

// ============================================
// Notification Template
// ============================================

export interface NotificationTemplate {
  trigger: NotificationRule['trigger'];
  triggerConfig?: NotificationRule['triggerConfig'];
  recipientRoles: AssignmentRuleType[];
  channel: NotificationRule['channel'];
  subjectTemplate?: string;
  bodyTemplate?: string;
}

// ============================================
// Workflow Template
// ============================================

export interface WorkflowTemplate {
  id: string;
  objectType: CustomObjectType;
  name: string;
  description?: string;
  version: number;

  tasks: TaskTemplate[];
  milestones: MilestoneTemplate[];
  notificationRules: NotificationTemplate[];
  assignmentRules: AssignmentRule[];

  estimatedDurationDays: number;

  // Conditions for template selection
  conditions?: {
    customerSegment?: string[];
    arrRange?: { min?: number; max?: number };
    customConditions?: Record<string, unknown>;
  };

  isDefault: boolean;
  isActive: boolean;

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API Request/Response Types
// ============================================

export interface GenerateWorkflowRequest {
  objectType: CustomObjectType;
  objectId: string;
  objectName: string;
  customerId: string;
  customerName?: string;
  templateId?: string; // Optional - auto-select if not provided
  customizations?: {
    adjustStartDate?: string; // ISO date
    overrideAssignments?: Partial<CustomObjectWorkflow['assignments']>;
    excludeTasks?: string[];
    additionalTasks?: Partial<TaskTemplate>[];
  };
}

export interface GenerateWorkflowResponse {
  workflow: CustomObjectWorkflow;
  appliedTemplate: {
    id: string;
    name: string;
    version: number;
  };
  warnings?: string[];
}

export interface CustomizeWorkflowRequest {
  addTasks?: Partial<TaskRef>[];
  removeTasks?: string[];
  updateTasks?: { id: string; updates: Partial<TaskRef> }[];
  updateTimeline?: {
    startDate?: string;
    endDate?: string;
  };
  updateAssignments?: Partial<CustomObjectWorkflow['assignments']>;
  saveAsTemplate?: boolean;
  newTemplateName?: string;
}

export interface ListTemplatesResponse {
  templates: WorkflowTemplate[];
  total: number;
}

export interface WorkflowStatistics {
  totalWorkflows: number;
  activeWorkflows: number;
  completedWorkflows: number;
  cancelledWorkflows: number;
  averageCompletionDays: number;
  completionRate: number;
  byObjectType: Record<CustomObjectType, number>;
  byTemplate: { templateId: string; templateName: string; count: number }[];
}
