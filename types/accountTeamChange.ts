/**
 * Account Team Change Types
 * PRD-132: Account Team Change Update Propagation
 *
 * Types for managing team member changes and propagating updates across systems
 */

import { AccountTeamRole, AccountTeamMember, MemberStatus } from './accountTeam';

// ============================================
// Change Type Definitions
// ============================================

export type TeamChangeType = 'csm' | 'ae' | 'support' | 'executive_sponsor' | 'tam' | 'se' | 'implementation' | 'other';

export type PropagationSystemType =
  | 'cscx'           // CSCX customer record
  | 'salesforce'     // Salesforce CRM
  | 'hubspot'        // HubSpot CRM
  | 'slack'          // Slack channels
  | 'google_drive'   // Google Drive permissions
  | 'google_calendar'// Google Calendar access
  | 'email_lists'    // Email distribution lists
  | 'support_system' // Support ticket routing
  | 'zendesk'        // Zendesk assignments
  | 'intercom'       // Intercom assignments
  | 'automations';   // Workflow/automation routing

export type PropagationStatusValue = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export type TransitionPhase = 'initiated' | 'handoff_prep' | 'handoff_meeting' | 'knowledge_transfer' | 'customer_notification' | 'completed';

// ============================================
// Team Member Types
// ============================================

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: AccountTeamRole;
  title: string;
  photoUrl: string | null;
  slackHandle: string | null;
  phone: string | null;
}

// ============================================
// Propagation Status Types
// ============================================

export interface PropagationStatus {
  system: PropagationSystemType;
  systemName: string;
  status: PropagationStatusValue;
  updatedAt: string | null;
  error: string | null;
  retryCount: number;
  details: Record<string, unknown>;
}

export interface PropagationSummary {
  totalSystems: number;
  completed: number;
  failed: number;
  pending: number;
  inProgress: number;
  skipped: number;
  overallStatus: 'pending' | 'in_progress' | 'completed' | 'partial_failure' | 'failed';
  lastUpdated: string;
}

// ============================================
// Transition Types
// ============================================

export interface TransitionStatus {
  phase: TransitionPhase;
  handoffDocId: string | null;
  handoffDocUrl: string | null;
  meetingScheduled: boolean;
  meetingId: string | null;
  meetingDate: string | null;
  tasksTransferred: boolean;
  tasksTransferredCount: number;
  customerNotified: boolean;
  customerNotificationDate: string | null;
  customerNotificationApprovalId: string | null;
}

export interface HandoffDocument {
  id: string;
  url: string;
  title: string;
  createdAt: string;
  sections: {
    accountOverview: boolean;
    keyContacts: boolean;
    activeInitiatives: boolean;
    openIssues: boolean;
    recentInteractions: boolean;
    upcomingRenewals: boolean;
    customNotes: boolean;
  };
}

// ============================================
// Account Team Change Core Types
// ============================================

export interface AccountTeamChange {
  id: string;
  customerId: string;
  customerName: string;
  changeType: TeamChangeType;
  previousAssignment: TeamMember | null;
  newAssignment: TeamMember;
  effectiveDate: string;
  reason: string;
  reasonCategory: 'reassignment' | 'departure' | 'promotion' | 'restructure' | 'territory_change' | 'performance' | 'other';
  urgency: 'normal' | 'urgent' | 'immediate';
  propagationStatus: PropagationStatus[];
  propagationSummary: PropagationSummary;
  transition: TransitionStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notes: string;
}

// ============================================
// Team History Types
// ============================================

export interface TeamHistoryEntry {
  id: string;
  customerId: string;
  memberUserId: string;
  memberName: string;
  role: AccountTeamRole;
  startDate: string;
  endDate: string | null;
  tenure: {
    days: number;
    months: number;
    formatted: string;
  };
  changeReason: string | null;
  handoffNotes: string | null;
}

export interface TeamHistory {
  customerId: string;
  customerName: string;
  currentTeam: TeamMember[];
  previousMembers: TeamHistoryEntry[];
  totalChanges: number;
  avgTenure: {
    days: number;
    formatted: string;
  };
}

// ============================================
// Customer Notification Types
// ============================================

export interface CustomerNotification {
  id: string;
  changeId: string;
  customerId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'rejected';
  approvalId: string | null;
  scheduledDate: string | null;
  sentDate: string | null;
  variables: {
    customerName: string;
    previousCsmName: string;
    newCsmName: string;
    newCsmEmail: string;
    newCsmPhone: string | null;
    effectiveDate: string;
    transitionTimeline: string;
  };
}

// ============================================
// API Response Types
// ============================================

export interface AccountTeamChangeResponse {
  change: AccountTeamChange;
  customer: {
    id: string;
    name: string;
    arr: number;
    healthScore: number;
    industry: string | null;
  };
  handoffDocument: HandoffDocument | null;
  customerNotification: CustomerNotification | null;
}

export interface AccountTeamChangeListResponse {
  changes: AccountTeamChange[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalChanges: number;
    pendingPropagation: number;
    completed: number;
    failed: number;
    avgPropagationTime: string;
  };
}

export interface TeamHistoryResponse {
  history: TeamHistory;
  changes: AccountTeamChange[];
}

export interface PropagationRetryResponse {
  success: boolean;
  change: AccountTeamChange;
  retriedSystems: PropagationSystemType[];
  errors: Array<{ system: PropagationSystemType; error: string }>;
}

// ============================================
// API Request Types
// ============================================

export interface CreateTeamChangeRequest {
  customerId: string;
  changeType: TeamChangeType;
  previousAssignmentUserId: string | null;
  newAssignmentUserId: string;
  effectiveDate: string;
  reason: string;
  reasonCategory: 'reassignment' | 'departure' | 'promotion' | 'restructure' | 'territory_change' | 'performance' | 'other';
  urgency?: 'normal' | 'urgent' | 'immediate';
  notes?: string;
  skipSystems?: PropagationSystemType[];
}

export interface UpdateTeamChangeRequest {
  effectiveDate?: string;
  reason?: string;
  notes?: string;
  transition?: Partial<TransitionStatus>;
}

export interface RetryPropagationRequest {
  systems?: PropagationSystemType[];
  forceRetry?: boolean;
}

export interface GenerateHandoffDocRequest {
  includeSections?: Array<keyof HandoffDocument['sections']>;
  customNotes?: string;
}

export interface PrepareNotificationRequest {
  recipientEmail?: string;
  customSubject?: string;
  customBody?: string;
  scheduledDate?: string;
}

// ============================================
// Filter Types
// ============================================

export interface AccountTeamChangeFilters {
  status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'all';
  changeType?: TeamChangeType | 'all';
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  userId?: string;
  urgency?: 'normal' | 'urgent' | 'immediate' | 'all';
  search?: string;
  sortBy?: 'created_at' | 'effective_date' | 'customer_name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Constants
// ============================================

export const PROPAGATION_SYSTEMS: Record<PropagationSystemType, { name: string; description: string; priority: number }> = {
  cscx: { name: 'CSCX Platform', description: 'Update customer record ownership', priority: 1 },
  salesforce: { name: 'Salesforce', description: 'Update account owner', priority: 2 },
  hubspot: { name: 'HubSpot', description: 'Update contact owner', priority: 2 },
  slack: { name: 'Slack', description: 'Update channel membership', priority: 3 },
  google_drive: { name: 'Google Drive', description: 'Transfer folder permissions', priority: 4 },
  google_calendar: { name: 'Google Calendar', description: 'Update event access', priority: 4 },
  email_lists: { name: 'Email Lists', description: 'Update distribution lists', priority: 5 },
  support_system: { name: 'Support System', description: 'Update ticket routing', priority: 3 },
  zendesk: { name: 'Zendesk', description: 'Update assignee', priority: 3 },
  intercom: { name: 'Intercom', description: 'Update conversation owner', priority: 3 },
  automations: { name: 'Automations', description: 'Update workflow routing', priority: 6 },
};

export const CHANGE_TYPE_LABELS: Record<TeamChangeType, string> = {
  csm: 'CSM Change',
  ae: 'Account Executive Change',
  support: 'Support Lead Change',
  executive_sponsor: 'Executive Sponsor Change',
  tam: 'TAM Change',
  se: 'Solutions Engineer Change',
  implementation: 'Implementation Lead Change',
  other: 'Other Team Change',
};

export const REASON_CATEGORY_LABELS: Record<string, string> = {
  reassignment: 'Portfolio Reassignment',
  departure: 'Team Member Departure',
  promotion: 'Promotion / Role Change',
  restructure: 'Org Restructure',
  territory_change: 'Territory Change',
  performance: 'Performance Based',
  other: 'Other',
};

export const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'gray' },
  urgent: { label: 'Urgent', color: 'yellow' },
  immediate: { label: 'Immediate', color: 'red' },
};

export const TRANSITION_PHASE_LABELS: Record<TransitionPhase, { label: string; description: string }> = {
  initiated: { label: 'Initiated', description: 'Change request created' },
  handoff_prep: { label: 'Handoff Prep', description: 'Preparing handoff documentation' },
  handoff_meeting: { label: 'Handoff Meeting', description: 'Scheduling or conducting handoff meeting' },
  knowledge_transfer: { label: 'Knowledge Transfer', description: 'Transferring tasks and knowledge' },
  customer_notification: { label: 'Customer Notification', description: 'Notifying customer of change' },
  completed: { label: 'Completed', description: 'Transition complete' },
};
