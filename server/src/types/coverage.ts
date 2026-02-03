/**
 * PRD-131: CSM Out of Office Coverage Types
 * Data models for OOO coverage management
 */

// ============================================
// Core Coverage Types
// ============================================

export type CoverageStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type CoveragePriority = 'high' | 'medium' | 'low';
export type NotificationMethod = 'auto' | 'manual' | 'none';
export type RoutingType = 'email' | 'slack' | 'tasks' | 'alerts' | 'calendar';

export interface OOOCoverage {
  id: string;
  csmId: string;
  csmName: string;
  csmEmail: string;
  coveringCsmId: string;
  coveringCsmName: string;
  coveringCsmEmail: string;
  startDate: Date;
  endDate: Date;
  status: CoverageStatus;
  reason?: string;
  coveredAccounts: CoveredAccount[];
  handoffBrief: HandoffBrief;
  customerNotifications: CustomerNotificationConfig;
  routingUpdates: RoutingUpdate[];
  returnHandback: ReturnHandback;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CoveredAccount {
  customerId: string;
  customerName: string;
  priority: CoveragePriority;
  healthScore: number;
  arr: number;
  activeIssues: ActiveIssue[];
  upcomingMeetings: MeetingRef[];
  pendingTasks: TaskRef[];
  keyContacts: KeyContact[];
  contextNotes: string;
  status: 'active' | 'at_risk' | 'onboarding';
}

export interface ActiveIssue {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'pending';
  createdAt: Date;
  description?: string;
}

export interface MeetingRef {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  meetLink?: string;
  action: 'attend' | 'reschedule' | 'delegate';
}

export interface TaskRef {
  id: string;
  title: string;
  dueDate: Date;
  priority: CoveragePriority;
  status: 'pending' | 'in_progress' | 'blocked';
}

export interface KeyContact {
  name: string;
  email: string;
  role: string;
  phone?: string;
  notes?: string;
}

// ============================================
// Handoff Brief Types
// ============================================

export interface HandoffBrief {
  documentId: string | null;
  documentUrl?: string;
  generatedAt: Date | null;
  viewedAt: Date | null;
  viewedBy?: string;
  portfolioSummary: PortfolioSummary;
  accountBriefs: AccountBrief[];
}

export interface PortfolioSummary {
  totalAccounts: number;
  totalArr: number;
  highPriorityCount: number;
  atRiskCount: number;
  upcomingMeetingsCount: number;
  pendingTasksCount: number;
  activeIssuesCount: number;
  keyHighlights: string[];
  criticalActions: string[];
}

export interface AccountBrief {
  customerId: string;
  customerName: string;
  priority: CoveragePriority;
  currentStatus: string;
  healthScore: number;
  arr: number;
  lastInteraction?: {
    type: 'email' | 'meeting' | 'call';
    date: Date;
    summary: string;
  };
  activeRisks: string[];
  pendingDeadlines: {
    item: string;
    date: Date;
    type: 'task' | 'meeting' | 'renewal';
  }[];
  scheduledMeetings: MeetingRef[];
  ongoingConversations: string[];
  keyStakeholders: KeyContact[];
  contextNotes: string;
  recommendedActions: string[];
}

// ============================================
// Customer Notification Types
// ============================================

export interface CustomerNotificationConfig {
  enabled: boolean;
  sent: boolean;
  sentAt: Date | null;
  method: NotificationMethod;
  template?: string;
  customMessage?: string;
  notifiedCustomers: NotifiedCustomer[];
}

export interface NotifiedCustomer {
  customerId: string;
  customerName: string;
  contactEmail: string;
  contactName: string;
  sentAt: Date;
  emailId?: string;
  opened?: boolean;
}

// ============================================
// Routing Update Types
// ============================================

export interface RoutingUpdate {
  id: string;
  type: RoutingType;
  description: string;
  originalRouting: string;
  temporaryRouting: string;
  status: 'pending' | 'active' | 'reverted' | 'failed';
  appliedAt: Date | null;
  revertedAt: Date | null;
  error?: string;
}

// ============================================
// Return Handback Types
// ============================================

export interface ReturnHandback {
  summaryDocId: string | null;
  summaryDocUrl?: string;
  generatedAt: Date | null;
  activitiesDuringAbsence: ActivitySummary[];
  issuesResolved: ResolvedIssue[];
  issuesOutstanding: OutstandingIssue[];
  sentimentChanges: SentimentChange[];
  followUpRecommendations: FollowUpRecommendation[];
  coveringCsmNotes?: string;
}

export interface ActivitySummary {
  id: string;
  type: 'email' | 'meeting' | 'call' | 'task' | 'note' | 'escalation';
  customerId: string;
  customerName: string;
  title: string;
  description: string;
  date: Date;
  performedBy: string;
  outcome?: string;
}

export interface ResolvedIssue {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  resolution: string;
  resolvedAt: Date;
  resolvedBy: string;
}

export interface OutstandingIssue {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  notes: string;
  recommendedAction: string;
}

export interface SentimentChange {
  customerId: string;
  customerName: string;
  previousHealth: number;
  currentHealth: number;
  change: 'improved' | 'declined' | 'stable';
  reason?: string;
}

export interface FollowUpRecommendation {
  customerId: string;
  customerName: string;
  priority: CoveragePriority;
  action: string;
  reason: string;
  suggestedDate?: Date;
}

// ============================================
// Coverage Assignment Types
// ============================================

export interface CSM {
  id: string;
  name: string;
  email: string;
  role: 'csm' | 'senior_csm' | 'csm_manager';
  teamId?: string;
  primaryBackupId?: string;
  segment?: string;
  skills?: string[];
  currentWorkload: number; // Number of accounts
  maxWorkload: number;
  isAvailable: boolean;
}

export interface CoverageAssignmentRequest {
  csmId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  preferredCoveringCsmId?: string;
  accountPriorities?: { customerId: string; priority: CoveragePriority }[];
  notifyCustomers: boolean;
  notificationMethod: NotificationMethod;
}

export interface CoverageAssignmentResult {
  success: boolean;
  coverageId?: string;
  coveringCsm?: CSM;
  assignmentMethod: 'primary_backup' | 'round_robin' | 'workload_balanced' | 'skill_matched';
  splitCoverage?: boolean;
  secondaryCoveringCsm?: CSM;
  warnings?: string[];
  errors?: string[];
}

// ============================================
// OOO Detection Types
// ============================================

export type OOODetectionSource = 'google_calendar' | 'manual' | 'slack' | 'pto_system';

export interface OOODetection {
  id: string;
  csmId: string;
  source: OOODetectionSource;
  startDate: Date;
  endDate: Date;
  detectedAt: Date;
  processed: boolean;
  coverageId?: string;
  rawData?: any;
}

// ============================================
// API Request/Response Types
// ============================================

export interface SetupCoverageRequest {
  csmId: string;
  startDate: string; // ISO date string
  endDate: string;
  reason?: string;
  coveringCsmId?: string;
  notifyCustomers: boolean;
  notificationMethod: NotificationMethod;
  customNotificationMessage?: string;
  accountPriorities?: { customerId: string; priority: CoveragePriority }[];
}

export interface CoverageResponse {
  success: boolean;
  coverage?: OOOCoverage;
  error?: string;
}

export interface HandoffBriefResponse {
  success: boolean;
  brief?: HandoffBrief;
  documentUrl?: string;
  error?: string;
}

export interface CoverageDashboard {
  activeCoverages: OOOCoverage[];
  upcomingCoverages: OOOCoverage[];
  myActiveCoverage: OOOCoverage | null;
  coveringFor: OOOCoverage[];
  recentlyCompleted: OOOCoverage[];
}

export interface ReturnHandbackResponse {
  success: boolean;
  handback?: ReturnHandback;
  documentUrl?: string;
  error?: string;
}
