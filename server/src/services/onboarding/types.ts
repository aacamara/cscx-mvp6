/**
 * Onboarding Stall Detection Types (PRD-098)
 *
 * Types for tracking onboarding progress and detecting stalls.
 */

// ============================================
// Milestone Types
// ============================================

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'stalled';

export type StallOwner = 'customer' | 'internal' | 'unknown';

export interface OnboardingMilestone {
  id: string;
  customerId: string;
  phase: string;
  expectedStartDate?: Date;
  expectedEndDate?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  status: MilestoneStatus;
  stallDetectedAt?: Date;
  stallReason?: string;
  stallOwner?: StallOwner;
  interventionAt?: Date;
  createdAt: Date;
}

// ============================================
// Stall Detection Types
// ============================================

export type StallConditionType = 'overdue' | 'no_activity' | 'no_response' | 'tasks_overdue' | 'user_not_activated';

export type CustomerSegment = 'enterprise' | 'mid-market' | 'smb';

export interface OnboardingStallRule {
  id: string;
  phase?: string;
  conditionType: StallConditionType;
  thresholdDays: number;
  segment?: CustomerSegment;
  enabled: boolean;
}

// Default stall rules by segment
export const DEFAULT_STALL_RULES: Omit<OnboardingStallRule, 'id'>[] = [
  // Enterprise - longer thresholds
  { conditionType: 'overdue', thresholdDays: 5, segment: 'enterprise', enabled: true },
  { conditionType: 'no_activity', thresholdDays: 7, segment: 'enterprise', enabled: true },
  { conditionType: 'no_response', thresholdDays: 10, segment: 'enterprise', enabled: true },
  { conditionType: 'tasks_overdue', thresholdDays: 5, segment: 'enterprise', enabled: true },
  { conditionType: 'user_not_activated', thresholdDays: 7, segment: 'enterprise', enabled: true },

  // Mid-market - standard thresholds
  { conditionType: 'overdue', thresholdDays: 3, segment: 'mid-market', enabled: true },
  { conditionType: 'no_activity', thresholdDays: 5, segment: 'mid-market', enabled: true },
  { conditionType: 'no_response', thresholdDays: 7, segment: 'mid-market', enabled: true },
  { conditionType: 'tasks_overdue', thresholdDays: 3, segment: 'mid-market', enabled: true },
  { conditionType: 'user_not_activated', thresholdDays: 5, segment: 'mid-market', enabled: true },

  // SMB - shorter thresholds
  { conditionType: 'overdue', thresholdDays: 2, segment: 'smb', enabled: true },
  { conditionType: 'no_activity', thresholdDays: 3, segment: 'smb', enabled: true },
  { conditionType: 'no_response', thresholdDays: 5, segment: 'smb', enabled: true },
  { conditionType: 'tasks_overdue', thresholdDays: 2, segment: 'smb', enabled: true },
  { conditionType: 'user_not_activated', thresholdDays: 3, segment: 'smb', enabled: true },
];

// ============================================
// Stall Check Types
// ============================================

export interface OnboardingTask {
  id: string;
  task: string;
  owner: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  dueDate?: Date;
  blockedReason?: string;
}

export interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  invitedAt?: Date;
  activatedAt?: Date;
  lastActiveAt?: Date;
}

export interface OnboardingStallCheck {
  customerId: string;
  customerName: string;
  currentPhase: string;
  phaseStartDate: Date;
  lastActivityDate: Date;
  lastResponseDate: Date;
  pendingTasks: OnboardingTask[];
  invitedUsers: OnboardingUser[];
  expectedDurationDays: number;
  segment: CustomerSegment;
  arr: number;
  csmId?: string;
  csmName?: string;
  csmManagerId?: string;
}

// ============================================
// Stall Result Types
// ============================================

export type StallIssueSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface StallIssue {
  type: StallConditionType | 'phase_overdue';
  severity: StallIssueSeverity;
  details: string;
  owner: StallOwner;
  daysStalled: number;
  tasks?: OnboardingTask[];
  users?: OnboardingUser[];
}

export interface StallResult {
  isStalled: boolean;
  customerId: string;
  customerName: string;
  phase: string;
  issues: StallIssue[];
  highestSeverity: StallIssueSeverity;
  primaryBlocker: string;
  daysInOnboarding: number;
  targetOnboardingDays: number;
  suggestedInterventions: string[];
  requiresEscalation: boolean;
  arr: number;
  segment: CustomerSegment;
  csmId?: string;
  csmName?: string;
}

// ============================================
// Intervention Types
// ============================================

export type InterventionType =
  | 'slack_alert'
  | 'create_task'
  | 'draft_email'
  | 'schedule_call'
  | 'escalate_manager';

export interface InterventionAction {
  type: InterventionType;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data?: Record<string, unknown>;
}

export interface InterventionResult {
  customerId: string;
  customerName: string;
  stallResult: StallResult;
  actions: InterventionAction[];
  executedAt: Date;
  notificationsSent: {
    slack: boolean;
    email: boolean;
    inApp: boolean;
  };
  taskCreated?: string;
  emailDraftId?: string;
}

// ============================================
// Dashboard Types
// ============================================

export interface StalledOnboardingCard {
  customerId: string;
  customerName: string;
  arr: number;
  segment: CustomerSegment;
  daysInOnboarding: number;
  targetDays: number;
  currentPhase: string;
  phaseProgress: number; // 0-100
  primaryBlocker: string;
  daysSinceActivity: number;
  issueCount: number;
  highestSeverity: StallIssueSeverity;
  stallDetectedAt: Date;
  suggestedAction: string;
}

export interface OnboardingStallDashboard {
  totalStalledOnboardings: number;
  totalArrAtRisk: number;
  averageDaysStalled: number;
  stalledByPhase: Record<string, number>;
  stalledBySeverity: Record<StallIssueSeverity, number>;
  stalledOnboardings: StalledOnboardingCard[];
}
