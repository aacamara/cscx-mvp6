/**
 * PRD-131: CSM Out of Office Coverage Types
 * Data models for coverage management system
 */

// ============================================
// Core Coverage Types
// ============================================

export type CoverageStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export type CoveragePriority = 'high' | 'medium' | 'low';

export type CoverageAssignmentMethod =
  | 'primary_backup'      // Pre-configured backup CSM
  | 'team_round_robin'    // Distribute among team
  | 'workload_balanced'   // Based on current workload
  | 'skill_matched';      // Based on segment/skill matching

export type RoutingType = 'email' | 'slack' | 'tasks' | 'alerts' | 'calendar';

export type NotificationMethod = 'auto' | 'manual' | 'none';

export type OOODetectionSource =
  | 'google_calendar'
  | 'slack_status'
  | 'manual_flag'
  | 'pto_system';

// ============================================
// Meeting Reference
// ============================================

export interface MeetingRef {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  meetLink?: string;
  action: 'attend' | 'reschedule' | 'delegate';
}

// ============================================
// Task Reference
// ============================================

export interface TaskRef {
  id: string;
  title: string;
  dueDate: Date;
  priority: CoveragePriority;
  status: 'pending' | 'in_progress' | 'blocked';
  assignedTo?: string;
}

// ============================================
// Covered Account
// ============================================

export interface CoveredAccount {
  customerId: string;
  customerName: string;
  priority: CoveragePriority;
  healthScore: number;
  arr: number;
  activeIssues: Array<{
    id: string;
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: string;
    createdAt: Date;
  }>;
  upcomingMeetings: MeetingRef[];
  pendingTasks: TaskRef[];
  keyContacts: Array<{
    name: string;
    email: string;
    title?: string;
    phone?: string;
  }>;
  contextNotes: string;
  lastContactDate?: Date;
  renewalDate?: Date;
}

// ============================================
// Routing Update
// ============================================

export interface RoutingUpdate {
  id: string;
  type: RoutingType;
  originalRouting: string;
  temporaryRouting: string;
  appliedAt: Date;
  revertedAt: Date | null;
  status: 'pending' | 'applied' | 'reverted' | 'failed';
  error?: string;
}

// ============================================
// Activity Summary
// ============================================

export interface ActivitySummary {
  customerId: string;
  customerName: string;
  activities: Array<{
    type: 'email' | 'meeting' | 'call' | 'note' | 'task' | 'escalation';
    title: string;
    description?: string;
    date: Date;
    performedBy: string;
    outcome?: string;
  }>;
  sentimentChange?: 'improved' | 'stable' | 'declined';
  healthScoreChange?: number;
  issuesResolved: string[];
  issuesCreated: string[];
  keyHighlights: string[];
}

// ============================================
// Handoff Brief
// ============================================

export interface HandoffBrief {
  documentId: string;
  documentUrl?: string;
  generatedAt: Date;
  viewedAt: Date | null;
  viewedBy?: string;
  portfolioSummary: {
    totalAccounts: number;
    highPriorityCount: number;
    activeIssuesCount: number;
    upcomingMeetingsCount: number;
    pendingTasksCount: number;
    totalARR: number;
  };
  accounts: CoveredAccount[];
}

// ============================================
// Customer Notification
// ============================================

export interface CustomerNotification {
  sent: boolean;
  sentAt: Date | null;
  method: NotificationMethod;
  templateUsed?: string;
  recipientCount?: number;
  failedRecipients?: string[];
}

// ============================================
// Return Handback
// ============================================

export interface ReturnHandback {
  summaryDocId: string | null;
  summaryDocUrl?: string;
  generatedAt: Date | null;
  viewedAt: Date | null;
  activitiesDuringAbsence: ActivitySummary[];
  outstandingIssues: Array<{
    id: string;
    customerId: string;
    customerName: string;
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    requiresFollowUp: boolean;
    recommendedAction: string;
  }>;
  healthScoreChanges: Array<{
    customerId: string;
    customerName: string;
    previousScore: number;
    currentScore: number;
    changeReason?: string;
  }>;
  followUpRecommendations: Array<{
    customerId: string;
    customerName: string;
    recommendation: string;
    priority: CoveragePriority;
    suggestedAction: string;
  }>;
}

// ============================================
// CSM Profile (for backup configuration)
// ============================================

export interface CSMProfile {
  id: string;
  name: string;
  email: string;
  teamId?: string;
  primaryBackupId?: string;
  skills: string[];
  segments: string[];
  currentWorkload: number; // 0-100 percentage
  maxCoverageAccounts: number;
  availableForCoverage: boolean;
}

// ============================================
// OOO Coverage (Main Entity)
// ============================================

export interface OOOCoverage {
  id: string;
  csmId: string;
  csmName: string;
  csmEmail: string;
  coveringCsmId: string;
  coveringCsmName: string;
  coveringCsmEmail: string;

  // Dates
  startDate: Date;
  endDate: Date;

  // Detection
  detectionSource: OOODetectionSource;
  detectedAt?: Date;

  // Assignment
  assignmentMethod: CoverageAssignmentMethod;

  // Status
  status: CoverageStatus;

  // Covered accounts
  coveredAccounts: CoveredAccount[];

  // Handoff documentation
  handoffBrief: HandoffBrief | null;

  // Customer notifications
  customerNotifications: CustomerNotification;

  // Routing updates
  routingUpdates: RoutingUpdate[];

  // Return handback
  returnHandback: ReturnHandback | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  notes?: string;
}

// ============================================
// Setup Request Types
// ============================================

export interface OOOSetupRequest {
  csmId: string;
  startDate: Date;
  endDate: Date;
  coveringCsmId?: string; // If not provided, system will assign
  assignmentMethod?: CoverageAssignmentMethod;
  notificationPreference: NotificationMethod;
  accountPriorityOverrides?: Array<{
    customerId: string;
    priority: CoveragePriority;
  }>;
  customNotes?: string;
}

export interface OOOSetupResponse {
  coverage: OOOCoverage;
  handoffBriefUrl?: string;
  coverageAssignmentReason: string;
  warnings?: string[];
}

// ============================================
// Coverage Dashboard Types
// ============================================

export interface CoverageDashboardSummary {
  coverageId: string;
  originalCsmName: string;
  coverageDates: {
    start: Date;
    end: Date;
    daysRemaining: number;
  };
  accountsOverview: {
    total: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  };
  actionItems: {
    urgentTasks: number;
    upcomingMeetings: number;
    openEscalations: number;
  };
  healthOverview: {
    averageHealthScore: number;
    atRiskAccounts: number;
    totalARR: number;
  };
}

export interface CoverageAccountView {
  customerId: string;
  customerName: string;
  priority: CoveragePriority;
  healthScore: number;
  arr: number;
  status: 'needs_attention' | 'stable' | 'at_risk';
  lastActivity?: {
    type: string;
    date: Date;
    summary: string;
  };
  nextAction?: {
    type: string;
    dueDate: Date;
    description: string;
  };
  quickLinks: {
    customerDetail: string;
    sendEmail: string;
    scheduleMeeting: string;
  };
}

// ============================================
// Notification Templates
// ============================================

export interface CoverageNotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[]; // e.g., {{coveringCsmName}}, {{oooStartDate}}
}

// ============================================
// Calendar Event Types
// ============================================

export interface OOOCalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  isOOO: boolean;
  eventType: 'outOfOffice' | 'vacation' | 'pto' | 'other';
}
