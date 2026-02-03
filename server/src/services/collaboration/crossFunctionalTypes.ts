/**
 * PRD-257: Cross-Functional Alignment Types
 *
 * Type definitions for cross-functional collaboration features including
 * activity timeline, account team, conflict detection, and coordination.
 */

// ============================================
// Cross-Functional Activity Types
// ============================================

export type SourceSystem = 'salesforce' | 'zendesk' | 'jira' | 'slack' | 'cscx' | 'hubspot' | 'intercom';

export type Team = 'sales' | 'support' | 'product' | 'engineering' | 'cs' | 'executive';

export type ActivityType =
  | 'email'
  | 'call'
  | 'meeting'
  | 'task'
  | 'ticket'
  | 'opportunity'
  | 'deal'
  | 'feature_request'
  | 'bug'
  | 'implementation'
  | 'escalation'
  | 'note'
  | 'message';

export interface CrossFunctionalActivity {
  id: string;
  customerId: string;
  sourceSystem: SourceSystem;
  sourceId?: string;
  sourceUrl?: string;
  activityType: ActivityType;
  title: string;
  description?: string;
  team: Team;
  performedByName?: string;
  performedByEmail?: string;
  performedByUserId?: string;
  contactName?: string;
  contactEmail?: string;
  activityDate: Date;
  isPlanned: boolean;
  status?: string;
  outcome?: string;
  metadata: Record<string, any>;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateActivityParams {
  customerId: string;
  sourceSystem: SourceSystem;
  sourceId?: string;
  sourceUrl?: string;
  activityType: ActivityType;
  title: string;
  description?: string;
  team: Team;
  performedByName?: string;
  performedByEmail?: string;
  performedByUserId?: string;
  contactName?: string;
  contactEmail?: string;
  activityDate: Date | string;
  isPlanned?: boolean;
  status?: string;
  outcome?: string;
  metadata?: Record<string, any>;
}

export interface ActivityFilters {
  customerId?: string;
  teams?: Team[];
  activityTypes?: ActivityType[];
  sourceSystems?: SourceSystem[];
  isPlanned?: boolean;
  startDate?: Date | string;
  endDate?: Date | string;
  contactEmail?: string;
  performedByEmail?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// Account Team Types
// ============================================

export interface AccountTeamMember {
  id: string;
  customerId: string;
  userId?: string;
  externalEmail?: string;
  name: string;
  team: Team;
  role: string;
  responsibilities?: string;
  sourceSystem?: SourceSystem;
  sourceId?: string;
  isActive: boolean;
  addedAt: Date;
  updatedAt: Date;
}

export interface CreateTeamMemberParams {
  customerId: string;
  userId?: string;
  externalEmail?: string;
  name: string;
  team: Team;
  role: string;
  responsibilities?: string;
  sourceSystem?: SourceSystem;
  sourceId?: string;
}

export interface UpdateTeamMemberParams {
  name?: string;
  team?: Team;
  role?: string;
  responsibilities?: string;
  isActive?: boolean;
}

// ============================================
// Coordination Request Types
// ============================================

export type RequestType = 'hold_off' | 'alignment_call' | 'context_share';

export type RequestStatus = 'pending' | 'acknowledged' | 'completed' | 'expired' | 'declined';

export interface CoordinationRequest {
  id: string;
  customerId: string;
  requestedByUserId?: string;
  requestType: RequestType;
  targetTeam?: Team;
  targetEmail?: string;
  reason: string;
  contextNotes?: string;
  startDate?: Date;
  endDate?: Date;
  status: RequestStatus;
  responseNotes?: string;
  respondedByUserId?: string;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCoordinationRequestParams {
  customerId: string;
  requestedByUserId?: string;
  requestType: RequestType;
  targetTeam?: Team;
  targetEmail?: string;
  reason: string;
  contextNotes?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

export interface UpdateCoordinationRequestParams {
  status?: RequestStatus;
  responseNotes?: string;
  respondedByUserId?: string;
}

// ============================================
// Activity Conflict Types
// ============================================

export type ConflictType = 'multiple_outreach' | 'message_conflict' | 'overlap' | 'gap';

export type ConflictSeverity = 'info' | 'warning' | 'critical';

export interface ActivityConflict {
  id: string;
  customerId: string;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  description: string;
  activities: string[]; // Array of activity IDs
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedByUserId?: string;
  resolutionNotes?: string;
  isDismissed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResolveConflictParams {
  resolvedByUserId?: string;
  resolutionNotes?: string;
}

// ============================================
// Integration Sync Types
// ============================================

export type SyncStatus = 'never' | 'success' | 'partial' | 'failed';

export interface IntegrationSyncStatus {
  id: string;
  sourceSystem: SourceSystem;
  lastSyncAt?: Date;
  lastSyncStatus: SyncStatus;
  lastError?: string;
  recordsSynced: number;
  nextSyncAt?: Date;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Aggregated Response Types
// ============================================

export interface ActivityTimeline {
  activities: CrossFunctionalActivity[];
  total: number;
  hasMore: boolean;
  teamBreakdown: Record<Team, number>;
  sourceBreakdown: Record<SourceSystem, number>;
  plannedCount: number;
  completedCount: number;
}

export interface AccountTeam {
  members: AccountTeamMember[];
  teamBreakdown: Record<Team, AccountTeamMember[]>;
  totalActive: number;
  totalInactive: number;
}

export interface ConflictSummary {
  conflicts: ActivityConflict[];
  total: number;
  unresolvedCount: number;
  bySeverity: Record<ConflictSeverity, number>;
  byType: Record<ConflictType, number>;
}

export interface CrossFunctionalSummary {
  timeline: ActivityTimeline;
  team: AccountTeam;
  conflicts: ConflictSummary;
  coordinationRequests: CoordinationRequest[];
  syncStatus: IntegrationSyncStatus[];
}

// ============================================
// Conflict Detection for Analysis
// ============================================

export interface ConflictDetectionParams {
  customerId: string;
  lookbackDays?: number;
  outreachThreshold?: number; // Max outreach to same contact in period
  gapThresholdDays?: number; // Days without activity to flag as gap
}

export interface ConflictDetectionResult {
  conflicts: Omit<ActivityConflict, 'id' | 'createdAt' | 'updatedAt'>[];
  analyzed: {
    activitiesChecked: number;
    contactsAnalyzed: number;
    teamsInvolved: Team[];
  };
}
