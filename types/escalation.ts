/**
 * PRD-121: Escalation War Room Types
 *
 * Type definitions for the escalation war room system.
 * Supports automated war room creation when escalations are logged.
 */

// ============================================
// Escalation Types
// ============================================

export type EscalationSeverity = 'P1' | 'P2' | 'P3';

export type EscalationStatus = 'active' | 'resolved' | 'post_mortem' | 'closed';

export type EscalationCategory =
  | 'technical'
  | 'support'
  | 'product'
  | 'commercial'
  | 'relationship';

export type EscalationTrigger =
  | 'manual'
  | 'support_ticket'
  | 'critical_risk_signal'
  | 'customer_request'
  | 'executive_involvement';

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'created' | 'status_change' | 'update' | 'participant_added' | 'meeting' | 'resolution' | 'note';
  title: string;
  description?: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
}

export interface Escalation {
  id: string;
  customerId: string;
  customerName: string;
  customerARR?: number;
  customerHealthScore?: number;
  customerSegment?: string;
  severity: EscalationSeverity;
  status: EscalationStatus;
  category: EscalationCategory;
  trigger: EscalationTrigger;
  title: string;
  description: string;
  impact: string;
  customerContacts: CustomerContact[];
  timeline: TimelineEvent[];
  previousEscalations?: PreviousEscalation[];
  recommendedResolution?: string;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdBy: string;
  ownerId: string;
  ownerName?: string;
}

export interface CustomerContact {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

export interface PreviousEscalation {
  id: string;
  title: string;
  category: EscalationCategory;
  severity: EscalationSeverity;
  resolvedAt: Date;
  resolution: string;
}

// ============================================
// War Room Types
// ============================================

export type ParticipantRole =
  | 'owner'
  | 'support'
  | 'product'
  | 'engineering'
  | 'executive'
  | 'observer';

export type NotificationPreference = 'all' | 'critical' | 'summary';

export interface Participant {
  userId: string;
  userName: string;
  email: string;
  role: ParticipantRole;
  addedAt: Date;
  notificationPreference: NotificationPreference;
  slackUserId?: string;
}

export interface StatusUpdate {
  id: string;
  timestamp: Date;
  status: string;
  summary: string;
  progress?: number;
  blockers?: string[];
  nextActions?: string[];
  updatedBy: string;
  updatedByName?: string;
}

export interface MeetingRef {
  id: string;
  type: 'kickoff' | 'sync' | 'resolution_review' | 'post_mortem';
  title: string;
  scheduledAt: Date;
  calendarEventId?: string;
  calendarEventUrl?: string;
  attendees: string[];
  notes?: string;
}

export interface CommunicationLog {
  id: string;
  timestamp: Date;
  type: 'internal_update' | 'customer_email' | 'executive_briefing' | 'resolution_notification';
  channel: 'slack' | 'email' | 'document';
  title: string;
  content?: string;
  recipients: string[];
  sentBy: string;
  documentUrl?: string;
}

export interface Resolution {
  resolvedAt: Date;
  resolvedBy: string;
  resolvedByName?: string;
  summary: string;
  rootCause?: string;
  actionsTaken: string[];
  preventionMeasures?: string[];
  customerConfirmed: boolean;
  customerConfirmedAt?: Date;
  postMortemScheduled: boolean;
  postMortemDate?: Date;
}

export interface WarRoom {
  id: string;
  escalationId: string;
  slackChannelId: string;
  slackChannelName: string;
  slackChannelUrl?: string;
  participants: Participant[];
  briefDocumentId: string;
  briefDocumentUrl?: string;
  dashboardUrl: string;
  statusUpdates: StatusUpdate[];
  meetings: MeetingRef[];
  communications: CommunicationLog[];
  resolution: Resolution | null;
  createdAt: Date;
  closedAt: Date | null;
  archivedAt: Date | null;
}

// ============================================
// Communication Templates
// ============================================

export interface CommunicationTemplate {
  id: string;
  type: 'internal_status' | 'customer_acknowledgment' | 'executive_briefing' | 'resolution_notification';
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

export const COMMUNICATION_TEMPLATES: CommunicationTemplate[] = [
  {
    id: 'internal_status',
    type: 'internal_status',
    name: 'Internal Status Update',
    subject: '[{{severity}}] {{customerName}} Escalation Update',
    body: `*Status Update: {{customerName}} Escalation*

*Current Status:* {{status}}
*Time in Escalation:* {{timeInEscalation}}
*Owner:* {{ownerName}}

*Summary:*
{{summary}}

*Progress:*
{{progress}}

*Blockers:*
{{blockers}}

*Next Actions:*
{{nextActions}}

_Updated by {{updatedBy}} at {{timestamp}}_`,
    variables: ['severity', 'customerName', 'status', 'timeInEscalation', 'ownerName', 'summary', 'progress', 'blockers', 'nextActions', 'updatedBy', 'timestamp'],
  },
  {
    id: 'customer_acknowledgment',
    type: 'customer_acknowledgment',
    name: 'Customer Acknowledgment Email',
    subject: 'Your escalation has been received - {{ticketNumber}}',
    body: `Dear {{contactName}},

Thank you for bringing this to our attention. We understand the urgency and have escalated this matter to our priority response team.

*Your Escalation Reference:* {{ticketNumber}}
*Priority Level:* {{severity}}
*Assigned Owner:* {{ownerName}}

We have assembled a dedicated team to address your concerns. You can expect:
- An initial update within {{initialUpdateTime}}
- Regular progress updates every {{updateFrequency}}
- A direct point of contact for any questions

If you have additional information or need immediate assistance, please reply to this email or contact {{ownerName}} directly.

We are committed to resolving this as quickly as possible.

Best regards,
{{senderName}}
Customer Success Team`,
    variables: ['contactName', 'ticketNumber', 'severity', 'ownerName', 'initialUpdateTime', 'updateFrequency', 'senderName'],
  },
  {
    id: 'executive_briefing',
    type: 'executive_briefing',
    name: 'Executive Briefing',
    subject: '[EXECUTIVE] {{severity}} Escalation: {{customerName}} - {{title}}',
    body: `*EXECUTIVE BRIEFING*

*Customer:* {{customerName}}
*ARR:* {{arr}}
*Health Score:* {{healthScore}}
*Escalation Priority:* {{severity}}

---

*Issue Summary:*
{{summary}}

*Business Impact:*
{{impact}}

*Timeline:*
{{timeline}}

*Current Status:*
{{currentStatus}}

*Resolution Plan:*
{{resolutionPlan}}

*Executive Attention Required:*
{{execAttention}}

*Team Assigned:*
{{teamAssigned}}

*Estimated Resolution:* {{estimatedResolution}}

---
_Prepared by {{preparedBy}} | {{timestamp}}_`,
    variables: ['customerName', 'arr', 'healthScore', 'severity', 'summary', 'impact', 'timeline', 'currentStatus', 'resolutionPlan', 'execAttention', 'teamAssigned', 'estimatedResolution', 'preparedBy', 'timestamp'],
  },
  {
    id: 'resolution_notification',
    type: 'resolution_notification',
    name: 'Resolution Notification',
    subject: 'Escalation Resolved: {{customerName}} - {{title}}',
    body: `Dear {{contactName}},

We are pleased to inform you that the escalation regarding "{{title}}" has been resolved.

*Resolution Summary:*
{{resolutionSummary}}

*Actions Taken:*
{{actionsTaken}}

*Prevention Measures:*
{{preventionMeasures}}

We value your partnership and appreciate your patience while we worked to resolve this matter. If you have any questions or concerns about the resolution, please don't hesitate to reach out.

A member of our team will follow up with you shortly to ensure everything is working as expected.

Best regards,
{{senderName}}
Customer Success Team`,
    variables: ['contactName', 'title', 'resolutionSummary', 'actionsTaken', 'preventionMeasures', 'senderName'],
  },
];

// ============================================
// Status Update Schedule
// ============================================

export const STATUS_UPDATE_SCHEDULE: Record<EscalationSeverity, { intervalHours: number; label: string }> = {
  P1: { intervalHours: 4, label: 'Every 4 hours' },
  P2: { intervalHours: 8, label: 'Every 8 hours' },
  P3: { intervalHours: 24, label: 'Daily' },
};

// ============================================
// Default Participants by Category
// ============================================

export interface ParticipantConfig {
  role: ParticipantRole;
  required: boolean;
  severity: EscalationSeverity[];
}

export const DEFAULT_PARTICIPANTS: Record<EscalationCategory, ParticipantConfig[]> = {
  technical: [
    { role: 'owner', required: true, severity: ['P1', 'P2', 'P3'] },
    { role: 'engineering', required: true, severity: ['P1', 'P2', 'P3'] },
    { role: 'support', required: true, severity: ['P1', 'P2'] },
    { role: 'executive', required: true, severity: ['P1'] },
  ],
  support: [
    { role: 'owner', required: true, severity: ['P1', 'P2', 'P3'] },
    { role: 'support', required: true, severity: ['P1', 'P2', 'P3'] },
    { role: 'product', required: false, severity: ['P1', 'P2'] },
    { role: 'executive', required: true, severity: ['P1'] },
  ],
  product: [
    { role: 'owner', required: true, severity: ['P1', 'P2', 'P3'] },
    { role: 'product', required: true, severity: ['P1', 'P2', 'P3'] },
    { role: 'engineering', required: false, severity: ['P1', 'P2'] },
    { role: 'executive', required: true, severity: ['P1'] },
  ],
  commercial: [
    { role: 'owner', required: true, severity: ['P1', 'P2', 'P3'] },
    { role: 'executive', required: true, severity: ['P1', 'P2'] },
  ],
  relationship: [
    { role: 'owner', required: true, severity: ['P1', 'P2', 'P3'] },
    { role: 'executive', required: true, severity: ['P1'] },
  ],
};

// ============================================
// API Request/Response Types
// ============================================

export interface CreateEscalationRequest {
  customerId: string;
  severity: EscalationSeverity;
  category: EscalationCategory;
  title: string;
  description: string;
  impact: string;
  trigger?: EscalationTrigger;
  customerContacts?: CustomerContact[];
}

export interface CreateEscalationResponse {
  escalation: Escalation;
  warRoom: WarRoom;
}

export interface UpdateEscalationStatusRequest {
  status: EscalationStatus;
  summary?: string;
}

export interface AddStatusUpdateRequest {
  summary: string;
  progress?: number;
  blockers?: string[];
  nextActions?: string[];
}

export interface ResolveEscalationRequest {
  summary: string;
  rootCause?: string;
  actionsTaken: string[];
  preventionMeasures?: string[];
}

export interface EscalationFilters {
  status?: EscalationStatus | EscalationStatus[];
  severity?: EscalationSeverity | EscalationSeverity[];
  category?: EscalationCategory;
  customerId?: string;
  ownerId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface EscalationListResponse {
  escalations: Escalation[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================
// Escalation Metrics Types
// ============================================

export interface EscalationMetrics {
  totalActive: number;
  activeByPriority: {
    P1: number;
    P2: number;
    P3: number;
  };
  activeByCategory: Record<string, number>;
  recentResolved: number;
  avgResolutionTimeMs: number;
  avgResolutionTimeHours: number;
}
