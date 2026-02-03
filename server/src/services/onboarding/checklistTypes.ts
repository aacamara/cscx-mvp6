/**
 * Onboarding Checklist Types (PRD-012)
 *
 * Types for checklist upload, parsing, and progress tracking.
 */

// ============================================
// Checklist Task Types
// ============================================

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'skipped';

export type TaskOwnerType = 'customer' | 'internal' | 'vendor';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type OnboardingPhase =
  | 'setup'
  | 'configuration'
  | 'integration'
  | 'training'
  | 'data_migration'
  | 'testing'
  | 'go_live'
  | 'post_go_live';

export interface ChecklistTask {
  id: string;
  name: string;
  description?: string;
  owner: string;
  ownerEmail?: string;
  ownerType: TaskOwnerType;
  status: TaskStatus;
  dueDate?: Date;
  completedDate?: Date;
  phase: OnboardingPhase;
  dependencies?: string[];
  blockerReason?: string;
  priority: TaskPriority;
  notes?: string;
  originalRowIndex?: number;
}

// ============================================
// Checklist Types
// ============================================

export type ChecklistSource = 'excel' | 'csv' | 'asana' | 'monday' | 'jira' | 'sheets' | 'notion' | 'manual';

export interface OnboardingChecklist {
  id: string;
  customerId: string;
  customerName: string;
  source: ChecklistSource;
  sourceFileName?: string;
  tasks: ChecklistTask[];
  phases: PhaseBreakdown[];
  createdAt: Date;
  updatedAt: Date;
  importedAt: Date;
  lastSyncAt?: Date;
}

export interface PhaseBreakdown {
  phase: OnboardingPhase;
  taskCount: number;
  completedCount: number;
  blockedCount: number;
  progressPercent: number;
  status: 'not_started' | 'in_progress' | 'on_track' | 'behind' | 'completed';
  estimatedCompletionDate?: Date;
}

// ============================================
// Upload & Parsing Types
// ============================================

export interface ChecklistUploadInput {
  content: string; // base64 for files, raw for text
  fileName: string;
  mimeType: string;
  customerId: string;
  customerName: string;
}

export interface ColumnMapping {
  taskName: number;
  owner?: number;
  status?: number;
  dueDate?: number;
  phase?: number;
  description?: number;
  dependencies?: number;
  priority?: number;
  notes?: number;
}

export interface ParsedChecklist {
  tasks: ChecklistTask[];
  columnMapping: ColumnMapping;
  detectedSource: ChecklistSource;
  parseConfidence: number;
  warnings: string[];
  totalRows: number;
  validRows: number;
  skippedRows: number;
}

// ============================================
// Progress Metrics Types
// ============================================

export interface ProgressMetrics {
  customerId: string;
  customerName: string;
  overallProgress: number; // 0-100
  onTimeRate: number; // % of tasks completed by due date
  completedTasks: number;
  totalTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  tasksCompletedThisWeek: number;
  velocity: number; // tasks per week
  projectedGoLiveDate: Date | null;
  targetGoLiveDate: Date | null;
  daysAheadOrBehind: number; // negative = behind
  phaseProgress: PhaseProgress[];
  milestones: MilestoneProgress[];
  calculatedAt: Date;
}

export interface PhaseProgress {
  phase: OnboardingPhase;
  name: string;
  taskCount: number;
  completedCount: number;
  blockedCount: number;
  progressPercent: number;
  status: 'not_started' | 'in_progress' | 'on_track' | 'behind' | 'completed';
  startDate?: Date;
  targetEndDate?: Date;
  projectedEndDate?: Date;
}

export interface MilestoneProgress {
  id: string;
  name: string;
  targetDate: Date;
  projectedDate?: Date;
  completedDate?: Date;
  status: 'pending' | 'on_track' | 'at_risk' | 'completed' | 'missed';
  tasksDependentOn: string[];
}

// ============================================
// Risk Detection Types
// ============================================

export type RiskLevel = 'low' | 'medium' | 'medium_high' | 'high' | 'critical';

export type RiskType =
  | 'timeline_at_risk'
  | 'tasks_overdue'
  | 'blockers_identified'
  | 'customer_tasks_overdue'
  | 'velocity_declining'
  | 'no_progress'
  | 'critical_path_blocked';

export interface RiskFactor {
  type: RiskType;
  severity: RiskLevel;
  description: string;
  impact: string;
  durationDays?: number;
  affectedTasks?: string[];
  suggestedAction: string;
}

export interface OnboardingRiskAssessment {
  customerId: string;
  customerName: string;
  overallRisk: RiskLevel;
  riskScore: number; // 0-100
  factors: RiskFactor[];
  topRiskDescription: string;
  projectedDelayDays: number;
  requiresIntervention: boolean;
  recommendedActions: RecommendedAction[];
  calculatedAt: Date;
}

export interface RecommendedAction {
  id: string;
  action: string;
  reason: string;
  priority: TaskPriority;
  targetContact?: string;
  actionType: 'escalate' | 'follow_up' | 'schedule_call' | 'send_email' | 'create_task';
}

// ============================================
// Blocker Types
// ============================================

export interface Blocker {
  id: string;
  taskId: string;
  taskName: string;
  blockerDescription: string;
  owner: string;
  ownerType: TaskOwnerType;
  identifiedDate: Date;
  durationDays: number;
  impact: string[];
  impactedTasks: string[];
  status: 'active' | 'resolving' | 'resolved';
  resolvedDate?: Date;
  resolution?: string;
}

// ============================================
// Overdue Task Types
// ============================================

export interface OverdueTask {
  taskId: string;
  taskName: string;
  owner: string;
  ownerEmail?: string;
  ownerType: TaskOwnerType;
  dueDate: Date;
  daysOverdue: number;
  phase: OnboardingPhase;
  blockedReason?: string;
  impactsGoLive: boolean;
}

// ============================================
// Dashboard Types
// ============================================

export interface OnboardingProgressDashboard {
  customerId: string;
  customerName: string;
  startDate: Date;
  targetGoLiveDate: Date;
  projectedGoLiveDate: Date | null;
  metrics: ProgressMetrics;
  risk: OnboardingRiskAssessment;
  overdueTasks: OverdueTask[];
  blockers: Blocker[];
  recentActivity: TaskActivity[];
  updatedAt: Date;
}

export interface TaskActivity {
  taskId: string;
  taskName: string;
  action: 'completed' | 'started' | 'blocked' | 'unblocked' | 'updated' | 'created';
  actor: string;
  timestamp: Date;
  details?: string;
}

// ============================================
// At-Risk Onboarding Types
// ============================================

export interface AtRiskOnboarding {
  customerId: string;
  customerName: string;
  arr: number;
  startDate: Date;
  targetGoLiveDate: Date;
  projectedGoLiveDate: Date | null;
  daysAtRisk: number;
  riskLevel: RiskLevel;
  riskScore: number;
  topRisk: string;
  blockerCount: number;
  overdueTaskCount: number;
  progressPercent: number;
  csm?: string;
  csmEmail?: string;
  lastActivityDate: Date;
  recommendedAction: string;
}

export interface AtRiskOnboardingList {
  totalAtRisk: number;
  totalArrAtRisk: number;
  onboardings: AtRiskOnboarding[];
  byRiskLevel: Record<RiskLevel, number>;
  updatedAt: Date;
}

// ============================================
// Status Update Types
// ============================================

export interface TaskStatusUpdate {
  taskId: string;
  newStatus: TaskStatus;
  completedDate?: Date;
  blockerReason?: string;
  notes?: string;
  updatedBy: string;
}

export interface BulkTaskUpdate {
  checklistId: string;
  updates: TaskStatusUpdate[];
}

// ============================================
// Phase Mapping Constants
// ============================================

export const PHASE_DISPLAY_NAMES: Record<OnboardingPhase, string> = {
  setup: 'Setup/Configuration',
  configuration: 'Configuration',
  integration: 'Integration',
  training: 'Training',
  data_migration: 'Data Migration',
  testing: 'Testing/UAT',
  go_live: 'Go-Live',
  post_go_live: 'Post Go-Live'
};

export const PHASE_ORDER: OnboardingPhase[] = [
  'setup',
  'configuration',
  'integration',
  'data_migration',
  'training',
  'testing',
  'go_live',
  'post_go_live'
];

// ============================================
// Status Mapping Constants
// ============================================

export const STATUS_KEYWORDS: Record<TaskStatus, string[]> = {
  completed: ['done', 'complete', 'completed', 'finished', 'closed', 'resolved', '100%', 'yes', 'y', 'x', '✓', '✔'],
  in_progress: ['in progress', 'in-progress', 'wip', 'working', 'started', 'active', 'ongoing', 'in review'],
  blocked: ['blocked', 'waiting', 'on hold', 'pending', 'stuck', 'delayed', 'paused'],
  not_started: ['not started', 'todo', 'to do', 'new', 'open', 'backlog', 'planned', ''],
  skipped: ['skipped', 'n/a', 'na', 'not applicable', 'cancelled', 'canceled', 'removed']
};

export const PHASE_KEYWORDS: Record<OnboardingPhase, string[]> = {
  setup: ['setup', 'set up', 'configuration', 'configure', 'initial', 'kickoff', 'kick-off', 'prep'],
  configuration: ['config', 'settings', 'customize', 'customization'],
  integration: ['integration', 'api', 'connect', 'sso', 'saml', 'oauth', 'sync', 'webhook'],
  training: ['training', 'train', 'education', 'onboard', 'session', 'workshop', 'enablement'],
  data_migration: ['migration', 'import', 'export', 'data', 'transfer', 'load', 'etl'],
  testing: ['test', 'uat', 'qa', 'validation', 'verify', 'pilot'],
  go_live: ['go-live', 'go live', 'golive', 'launch', 'deploy', 'production', 'live'],
  post_go_live: ['post', 'hypercare', 'support', 'optimization', 'adoption']
};

export const PRIORITY_KEYWORDS: Record<TaskPriority, string[]> = {
  critical: ['critical', 'blocker', 'p0', 'urgent', 'asap', 'must have'],
  high: ['high', 'p1', 'important', 'required', 'priority'],
  medium: ['medium', 'p2', 'normal', 'standard', 'should have'],
  low: ['low', 'p3', 'minor', 'nice to have', 'optional']
};
