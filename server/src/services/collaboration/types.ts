/**
 * PRD-258: Coverage Backup System Types
 * Data models for enhanced coverage backup management
 */

// ============================================
// Absence Types
// ============================================

export type AbsenceType = 'vacation' | 'sick' | 'conference' | 'parental' | 'other';
export type AbsenceStatus = 'planned' | 'coverage_assigned' | 'active' | 'completed' | 'cancelled';
export type CoverageType = 'full' | 'partial' | 'tiered';
export type AssignmentStatus = 'pending' | 'accepted' | 'declined' | 'active' | 'completed';
export type CoverageTier = 1 | 2;

export interface CSMAbsence {
  id: string;
  userId: string;
  absenceType: AbsenceType;
  startDate: Date;
  endDate: Date;
  isPartial: boolean;
  partialHours?: string;
  preferredBackupUserId?: string;
  specialInstructions?: string;
  status: AbsenceStatus;
  calendarEventId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Coverage Assignment Types
// ============================================

export interface CoverageAssignment {
  id: string;
  absenceId: string;
  backupUserId: string;
  assignedByUserId?: string;
  coverageType: CoverageType;
  coveredCustomerIds?: string[];
  tier: CoverageTier;
  status: AssignmentStatus;
  acceptedAt?: Date;
  declinedReason?: string;
  notificationsReceived: number;
  actionsTaken: number;
  createdAt: Date;
}

// ============================================
// Backup Suggestion Types
// ============================================

export interface BackupSuggestion {
  userId: string;
  userName: string;
  userEmail: string;
  score: number;
  factors: BackupScoreFactors;
  availability: BackupAvailability;
}

export interface BackupScoreFactors {
  capacityScore: number;
  familiarityScore: number;
  skillMatchScore: number;
  preferenceScore: number;
}

export interface BackupAvailability {
  currentAccountCount: number;
  maxAccountCount: number;
  pendingCoverageCount: number;
  isAvailable: boolean;
}

// ============================================
// Coverage Brief Types
// ============================================

export interface CoverageBrief {
  id: string;
  coverageAssignmentId: string;
  customerId: string;
  briefContent: CoverageBriefContent;
  generatedAt: Date;
  viewedAt?: Date;
  viewedBy?: string;
  notesAdded?: string;
  actionsTaken: CoverageAction[];
}

export interface CoverageBriefContent {
  customer: CustomerBriefInfo;
  keyContacts: StakeholderInfo[];
  urgentItems: UrgentItem[];
  recentActivity: ActivityRecord[];
  scheduledEvents: ScheduledEvent[];
  riskFlags: RiskSignal[];
  specialNotes: string;
}

export interface CustomerBriefInfo {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  stage: string;
  renewalDate?: string;
  segment?: string;
  industry?: string;
}

export interface StakeholderInfo {
  id: string;
  name: string;
  email: string;
  title?: string;
  role?: string;
  isPrimary: boolean;
  phone?: string;
  lastContactDate?: Date;
}

export interface UrgentItem {
  id: string;
  type: 'task' | 'meeting' | 'escalation' | 'renewal';
  description: string;
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
}

export interface ActivityRecord {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'task';
  title: string;
  summary?: string;
  date: Date;
  performedBy: string;
}

export interface ScheduledEvent {
  id: string;
  title: string;
  type: 'meeting' | 'qbr' | 'renewal' | 'call';
  startTime: Date;
  endTime: Date;
  attendees: string[];
  location?: string;
  notes?: string;
}

export interface RiskSignal {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  status: 'active' | 'monitoring' | 'resolved';
}

// ============================================
// Coverage Activity Types
// ============================================

export type CoverageActivityType = 'email' | 'call' | 'meeting' | 'task' | 'escalation' | 'note';

export interface CoverageActivity {
  id: string;
  coverageAssignmentId: string;
  customerId?: string;
  backupUserId: string;
  originalCsmId: string;
  activityType: CoverageActivityType;
  description?: string;
  outcome?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  activityDate: Date;
}

export interface CoverageAction {
  id: string;
  type: CoverageActivityType;
  description: string;
  date: Date;
  outcome?: string;
}

// ============================================
// Return Handback Types
// ============================================

export interface CoverageHandback {
  coverageAssignmentId: string;
  originalCsmId: string;
  backupCsmId: string;
  startDate: Date;
  endDate: Date;
  summary: HandbackSummary;
  activities: CoverageActivity[];
  accountSummaries: AccountHandbackSummary[];
  feedbackFromBackup?: string;
  generatedAt: Date;
}

export interface HandbackSummary {
  totalActivities: number;
  emailsSent: number;
  meetingsHeld: number;
  tasksCompleted: number;
  escalationsHandled: number;
  averageResponseTime?: number;
}

export interface AccountHandbackSummary {
  customerId: string;
  customerName: string;
  activitiesCount: number;
  healthScoreChange: number;
  healthScoreBefore: number;
  healthScoreAfter: number;
  outstandingItems: UrgentItem[];
  highlights: string[];
  followUpRecommendations: string[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateAbsenceRequest {
  userId: string;
  absenceType: AbsenceType;
  startDate: string; // ISO date string
  endDate: string;
  isPartial?: boolean;
  partialHours?: string;
  preferredBackupUserId?: string;
  specialInstructions?: string;
}

export interface UpdateAbsenceRequest {
  absenceType?: AbsenceType;
  startDate?: string;
  endDate?: string;
  isPartial?: boolean;
  partialHours?: string;
  preferredBackupUserId?: string;
  specialInstructions?: string;
  status?: AbsenceStatus;
}

export interface CreateCoverageAssignmentRequest {
  absenceId: string;
  backupUserId: string;
  assignedByUserId: string;
  coverageType?: CoverageType;
  coveredCustomerIds?: string[];
  tier?: CoverageTier;
}

export interface AcceptCoverageRequest {
  acceptedAt?: string;
}

export interface DeclineCoverageRequest {
  reason: string;
}

export interface AddCoverageNoteRequest {
  coverageAssignmentId: string;
  customerId?: string;
  activityType: CoverageActivityType;
  description: string;
  outcome?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface TeamAbsenceCalendarView {
  startDate: Date;
  endDate: Date;
  absences: TeamAbsenceEntry[];
}

export interface TeamAbsenceEntry {
  absenceId: string;
  userId: string;
  userName: string;
  absenceType: AbsenceType;
  startDate: Date;
  endDate: Date;
  status: AbsenceStatus;
  coverageAssigned: boolean;
  backupName?: string;
}
