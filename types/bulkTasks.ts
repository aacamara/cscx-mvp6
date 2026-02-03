/**
 * Bulk Task Creation Types (PRD-147)
 *
 * Type definitions for bulk task creation and portfolio-wide actions.
 * Supports task templates, customer selection, and execution tracking.
 */

// ============================================
// Task Priority & Types
// ============================================

export type TaskPriority = 'high' | 'medium' | 'low';

export type TaskType =
  | 'qbr'
  | 'renewal_outreach'
  | 'health_check'
  | 'onboarding'
  | 'adoption_review'
  | 'escalation'
  | 'check_in'
  | 'training'
  | 'custom';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';

// ============================================
// Customer Selection
// ============================================

export type SelectionType = 'manual' | 'segment' | 'filter' | 'list' | 'all';

export interface CustomerSegmentCriteria {
  healthScoreMin?: number;
  healthScoreMax?: number;
  arrMin?: number;
  arrMax?: number;
  stage?: string[];
  industry?: string[];
  renewalWithinDays?: number;
  csmId?: string;
}

export interface CustomerFilterCriteria {
  query?: string;
  sortBy?: 'name' | 'arr' | 'health_score' | 'renewal_date';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
}

export interface CustomerSelection {
  type: SelectionType;
  criteria: CustomerSegmentCriteria | CustomerFilterCriteria | null;
  customerIds: string[];
  totalCount: number;
}

// ============================================
// Due Date Calculation Rules
// ============================================

export type DueDateRuleType =
  | 'fixed_days'
  | 'relative_to_renewal'
  | 'relative_to_contract_start'
  | 'end_of_week'
  | 'end_of_month'
  | 'specific_date';

export interface DueDateRule {
  type: DueDateRuleType;
  daysOffset?: number; // For fixed_days, relative_to_*
  specificDate?: string; // ISO date string for specific_date
}

// ============================================
// Assignee Rules
// ============================================

export type AssigneeRuleType =
  | 'assigned_csm'
  | 'specific_user'
  | 'round_robin'
  | 'workload_balanced';

export interface AssigneeRule {
  type: AssigneeRuleType;
  specificUserId?: string; // For specific_user
  userPool?: string[]; // For round_robin and workload_balanced
}

// ============================================
// Task Template
// ============================================

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  taskType: TaskType;
  priority: TaskPriority;
  dueDateRule: DueDateRule;
  assigneeRule: AssigneeRule;
  tags?: string[];
  isReusable: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTemplateInput {
  name: string;
  description: string;
  taskType: TaskType;
  priority: TaskPriority;
  dueDateRule: DueDateRule;
  assigneeRule: AssigneeRule;
  tags?: string[];
  isReusable?: boolean;
}

// ============================================
// Execution Configuration
// ============================================

export type ExecutionMode = 'immediate' | 'scheduled' | 'staggered';

export interface ExecutionConfig {
  mode: ExecutionMode;
  scheduledAt?: string | null; // ISO date for scheduled mode
  staggerIntervalMinutes?: number | null; // Minutes between tasks for staggered
  skipExisting: boolean; // Skip if similar task exists
  notifyOnComplete: boolean;
}

// ============================================
// Bulk Task Operation
// ============================================

export type BulkOperationStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'cancelled';

export interface BulkTaskError {
  customerId: string;
  customerName: string;
  error: string;
  timestamp: string;
}

export interface BulkTaskProgress {
  status: BulkOperationStatus;
  created: number;
  skipped: number;
  failed: number;
  total: number;
  taskIds: string[];
  errors: BulkTaskError[];
  startedAt: string | null;
  completedAt: string | null;
  lastUpdatedAt: string;
}

export interface BulkTaskOperation {
  id: string;
  createdBy: string;
  templateId: string | null;
  template: TaskTemplateInput;
  selection: CustomerSelection;
  execution: ExecutionConfig;
  progress: BulkTaskProgress;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Created Task
// ============================================

export interface BulkCreatedTask {
  id: string;
  bulkOperationId: string;
  customerId: string;
  customerName: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: TaskPriority;
  taskType: TaskType;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateBulkTaskRequest {
  template: TaskTemplateInput;
  selection: CustomerSelection;
  execution: ExecutionConfig;
  templateId?: string; // Use existing template
  saveAsTemplate?: boolean;
}

export interface BulkTaskOperationResponse {
  operation: BulkTaskOperation;
  message: string;
}

export interface BulkTaskListResponse {
  operations: BulkTaskOperation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BulkCreatedTasksResponse {
  tasks: BulkCreatedTask[];
  total: number;
  completed: number;
  pending: number;
}

export interface TaskTemplateListResponse {
  templates: TaskTemplate[];
  total: number;
}

// ============================================
// Variable Resolution
// ============================================

export interface CustomerVariables {
  customer_name: string;
  customer_id: string;
  arr: number;
  health_score: number | null;
  renewal_date: string | null;
  days_until_renewal: number | null;
  csm_name: string | null;
  csm_email: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  industry: string | null;
  stage: string | null;
}

// ============================================
// Analytics & Reporting
// ============================================

export interface BulkTaskAnalytics {
  operationId: string;
  completionRate: number;
  averageCompletionTime: number | null; // In hours
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  overdueCount: number;
  portfolioCoverage: number; // Percentage of portfolio with tasks
}

// ============================================
// Wizard State
// ============================================

export type WizardStep = 'select-customers' | 'configure-template' | 'execution-options' | 'preview-confirm';

export interface BulkTaskWizardState {
  step: WizardStep;
  selection: CustomerSelection;
  template: TaskTemplateInput | null;
  execution: ExecutionConfig;
  previewTasks: Array<{
    customerId: string;
    customerName: string;
    title: string;
    dueDate: string | null;
    assignee: string | null;
  }>;
  validationErrors: Record<string, string>;
}

// ============================================
// Customer List for Selection
// ============================================

export interface CustomerForSelection {
  id: string;
  name: string;
  arr: number;
  healthScore: number | null;
  stage: string;
  industry: string | null;
  renewalDate: string | null;
  csmName: string | null;
}

export interface CustomerSearchResult {
  customers: CustomerForSelection[];
  total: number;
  hasMore: boolean;
}
