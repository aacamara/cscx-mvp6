/**
 * Outreach.io Integration Types
 * PRD-191: Outreach Sequence Trigger
 */

// ============================================
// OAuth Types
// ============================================

export interface OutreachOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: Date;
  scope: string[];
}

export interface OutreachConnection {
  userId: string;
  outreachUserId: number;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string[];
  connectedAt: Date;
}

// ============================================
// Sequence Types
// ============================================

export interface OutreachSequence {
  id: number;
  name: string;
  description?: string;
  sequenceType: 'email' | 'call' | 'task' | 'mixed';
  stepCount: number;
  bounceCount: number;
  clickCount: number;
  deliverCount: number;
  failureCount: number;
  negativeReplyCount: number;
  neutralReplyCount: number;
  openCount: number;
  optOutCount: number;
  positiveReplyCount: number;
  replyCount: number;
  scheduleCount: number;
  enabled: boolean;
  locked: boolean;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface SequenceStep {
  id: number;
  sequenceId: number;
  order: number;
  stepType: 'email' | 'call' | 'task' | 'linkedin' | 'manual';
  name?: string;
  interval: number; // days
  taskPriority?: 'high' | 'medium' | 'low';
  taskNote?: string;
}

export interface SequenceMetrics {
  sequenceId: number;
  enrolledCount: number;
  activeCount: number;
  pausedCount: number;
  completedCount: number;
  bouncedCount: number;
  repliedCount: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

// ============================================
// Prospect Types
// ============================================

export interface OutreachProspect {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  emails?: string[];
  title?: string;
  company?: string;
  phone?: string;
  mobilePhone?: string;
  linkedInUrl?: string;
  accountId?: number;
  ownerId?: number;
  stage?: string;
  engagedAt?: Date;
  engagedScore?: number;
  createdAt: Date;
  updatedAt: Date;
  customFields?: Record<string, unknown>;
}

export interface CreateProspectRequest {
  firstName: string;
  lastName: string;
  email: string;
  emails?: string[];
  title?: string;
  company?: string;
  phone?: string;
  mobilePhone?: string;
  linkedInUrl?: string;
  accountId?: number;
  customFields?: Record<string, unknown>;
}

// ============================================
// Sequence State Types (Enrollment)
// ============================================

export type SequenceStateStatus =
  | 'active'
  | 'paused'
  | 'finished'
  | 'bounced'
  | 'opted_out'
  | 'failed'
  | 'pending';

export interface OutreachSequenceState {
  id: number;
  prospectId: number;
  sequenceId: number;
  mailboxId?: number;
  state: SequenceStateStatus;
  activeAt?: Date;
  pausedAt?: Date;
  finishedAt?: Date;
  errorReason?: string;
  clickCount: number;
  deliverCount: number;
  openCount: number;
  replyCount: number;
  bounceCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnrollProspectRequest {
  prospectId: number;
  sequenceId: number;
  mailboxId?: number;
}

// ============================================
// Trigger Mapping Types
// ============================================

export type OutreachTriggerType =
  | 'new_customer'
  | 'renewal_approaching'
  | 'health_drop'
  | 'champion_left'
  | 'onboarding_complete'
  | 'usage_drop'
  | 'nps_detractor'
  | 'upsell_opportunity'
  | 'at_risk';

export interface OutreachMapping {
  id: string;
  triggerType: OutreachTriggerType;
  sequenceId: number;
  sequenceName: string;
  stakeholderRoles?: string[];
  segmentFilter?: string;
  healthThreshold?: number;
  daysBeforeRenewal?: number;
  enabled: boolean;
  requiresApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMappingRequest {
  triggerType: OutreachTriggerType;
  sequenceId: number;
  sequenceName: string;
  stakeholderRoles?: string[];
  segmentFilter?: string;
  healthThreshold?: number;
  daysBeforeRenewal?: number;
  enabled?: boolean;
  requiresApproval?: boolean;
}

// ============================================
// Enrollment Types
// ============================================

export type EnrollmentStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'enrolled'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'bounced'
  | 'opted_out';

export interface OutreachEnrollment {
  id: string;
  stakeholderId: string;
  customerId: string;
  outreachProspectId: number;
  sequenceId: number;
  sequenceName: string;
  sequenceStateId?: number;
  status: EnrollmentStatus;
  triggerType?: OutreachTriggerType;
  triggeredBy?: string;
  approvedBy?: string;
  enrolledAt?: Date;
  completedAt?: Date;
  pausedAt?: Date;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnrollStakeholderRequest {
  stakeholderId: string;
  sequenceId: number;
  triggerType?: OutreachTriggerType;
  skipApproval?: boolean;
  mailboxId?: number;
}

// ============================================
// Status Types
// ============================================

export interface StakeholderSequenceStatus {
  stakeholderId: string;
  stakeholderName: string;
  stakeholderEmail: string;
  outreachProspectId?: number;
  activeSequences: Array<{
    sequenceId: number;
    sequenceName: string;
    status: SequenceStateStatus;
    enrolledAt: Date;
    currentStep?: number;
    totalSteps?: number;
    lastActivityAt?: Date;
  }>;
  completedSequences: Array<{
    sequenceId: number;
    sequenceName: string;
    completedAt: Date;
    outcome?: 'replied' | 'bounced' | 'opted_out' | 'no_reply';
  }>;
  pendingEnrollments: Array<{
    sequenceId: number;
    sequenceName: string;
    requestedAt: Date;
    triggerType?: OutreachTriggerType;
  }>;
}

// ============================================
// Webhook Event Types
// ============================================

export type OutreachWebhookEventType =
  | 'sequence_state.active'
  | 'sequence_state.paused'
  | 'sequence_state.finished'
  | 'sequence_state.bounced'
  | 'sequence_state.opted_out'
  | 'prospect.updated'
  | 'mailing.delivered'
  | 'mailing.opened'
  | 'mailing.clicked'
  | 'mailing.replied'
  | 'mailing.bounced';

export interface OutreachWebhookPayload {
  type: OutreachWebhookEventType;
  data: {
    id: number;
    type: string;
    attributes: Record<string, unknown>;
    relationships?: Record<string, { data: { id: number; type: string } }>;
  };
  meta: {
    eventName: string;
    deliveredAt: string;
  };
}

// ============================================
// API Response Types
// ============================================

export interface OutreachApiResponse<T> {
  data: T;
  included?: Array<{
    id: number;
    type: string;
    attributes: Record<string, unknown>;
  }>;
  meta?: {
    count?: number;
    page?: {
      current: number;
      entries: number;
      maximum: number;
    };
  };
  links?: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

export interface OutreachApiError {
  id: string;
  status: number;
  title: string;
  detail: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
}
