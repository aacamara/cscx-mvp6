/**
 * Support Followup Types
 * PRD-052: Re-Engagement After Support Ticket
 */

// ============================================
// Core Types
// ============================================

export type TicketSeverityLevel = 'minor' | 'moderate' | 'major';
export type FollowupStatus = 'draft' | 'pending' | 'sent' | 'delivered' | 'opened' | 'replied' | 'failed';

export interface SupportTicketContext {
  ticketId: string;
  externalId: string;
  subject: string;
  description?: string;
  category: 'technical' | 'billing' | 'training' | 'feature_request' | 'security' | 'downtime' | 'integration' | 'general';
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'new' | 'open' | 'pending' | 'resolved' | 'closed';

  // Resolution details
  resolution?: string;
  resolvedAt?: string;
  resolutionTimeHours?: number;

  // Issue duration
  createdAt: string;
  durationDays?: number;

  // Assignment
  assignedAgent?: string;
  assignedAgentEmail?: string;

  // External link
  externalUrl?: string;

  // Was it escalated?
  wasEscalated: boolean;
  escalationLevel?: number;

  // Customer satisfaction
  csatScore?: number;
  csatFeedback?: string;
}

export interface CustomerContext {
  customerId: string;
  customerName: string;
  contactName: string;
  contactEmail: string;
  contactTitle?: string;
  healthScore?: number;
  previousHealthScore?: number;
  healthScoreChange?: number;
  tier?: 'enterprise' | 'business' | 'startup' | 'free';
  arr?: number;
  renewalDate?: string;
  daysToRenewal?: number;

  // Multiple stakeholders involved?
  stakeholdersInvolved?: Array<{
    name: string;
    title?: string;
    email?: string;
  }>;

  // Recent interaction history
  lastContactDate?: string;
  openTicketCount?: number;
  recentTicketCount?: number; // Last 30 days
}

export interface CSMContext {
  csmId: string;
  csmName: string;
  csmEmail: string;
  csmPhone?: string;
  csmTitle?: string;
}

// ============================================
// Followup Request/Response Types
// ============================================

export interface GenerateFollowupRequest {
  customerId: string;
  ticketId: string;
  csmId: string;

  // Optional overrides
  severityOverride?: TicketSeverityLevel;
  customMessage?: string;
  additionalOffers?: string[];

  // Scheduling
  sendImmediately?: boolean;
  scheduledAt?: string;

  // Reminder settings
  reminderDays?: number;
  reminderType?: 'check_metrics' | 'follow_up' | 'health_check';
}

export interface FollowupEmailDraft {
  id: string;
  ticketId: string;
  customerId: string;
  csmId: string;

  // Email content
  subject: string;
  bodyHtml: string;
  bodyText: string;

  // Recipients
  toEmail: string;
  toName: string;
  ccEmails?: string[];

  // Classification
  severityLevel: TicketSeverityLevel;
  followupType: 'acknowledgment' | 'satisfaction_check' | 'relationship_repair';

  // Status tracking
  status: FollowupStatus;

  // Context data (for regeneration/audit)
  ticketContext: SupportTicketContext;
  customerContext: CustomerContext;

  // Scheduled reminder
  reminder?: {
    scheduledAt: string;
    type: string;
    description: string;
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  openedAt?: string;
  repliedAt?: string;

  // Gmail integration
  gmailMessageId?: string;
  gmailThreadId?: string;
}

export interface GenerateFollowupResponse {
  success: boolean;
  draft: FollowupEmailDraft;
  analysis: {
    ticketSeverity: TicketSeverityLevel;
    followupType: string;
    customerImpact: 'low' | 'medium' | 'high' | 'critical';
    healthScoreImpact?: number;
    recommendations: string[];
  };
}

// ============================================
// Followup Analytics Types
// ============================================

export interface FollowupMetrics {
  csmId: string;
  period: string;

  // Volume metrics
  totalFollowupsSent: number;
  followupsByTicketSeverity: Record<string, number>;
  followupsByType: Record<string, number>;

  // Engagement metrics
  openRate: number;
  replyRate: number;
  avgTimeToReply?: number;

  // Outcome metrics
  healthScoreRecoveryRate: number;
  avgHealthScoreRecovery: number;
  customerSatisfactionAfterFollowup?: number;

  // Response sentiment
  positiveResponseRate: number;
  neutralResponseRate: number;
  negativeResponseRate: number;
}

export interface CustomerFollowupHistory {
  customerId: string;
  customerName: string;
  followups: FollowupEmailDraft[];

  // Summary stats
  totalFollowups: number;
  avgResponseTime?: number;
  lastFollowupDate?: string;

  // Patterns
  commonTicketCategories: string[];
  escalationTrend: 'increasing' | 'stable' | 'decreasing';
  relationshipHealth: 'strong' | 'recovering' | 'at_risk';
}

// ============================================
// API Response Types
// ============================================

export interface TicketFollowupListResponse {
  followups: FollowupEmailDraft[];
  total: number;
  pending: number;
  sent: number;
}

export interface FollowupActionResult {
  success: boolean;
  followupId: string;
  action: 'create' | 'send' | 'schedule' | 'cancel' | 'update';
  message: string;

  // For send action
  gmailMessageId?: string;

  // For schedule action
  scheduledAt?: string;

  // Reminder created
  reminderId?: string;
}

// ============================================
// Template Configuration
// ============================================

export interface FollowupTemplateConfig {
  minor: {
    subject: string;
    tone: 'friendly' | 'professional';
    includeMetrics: boolean;
    offerMeeting: boolean;
  };
  moderate: {
    subject: string;
    tone: 'empathetic' | 'professional';
    includeMetrics: boolean;
    offerMeeting: boolean;
    includeSummary: boolean;
  };
  major: {
    subject: string;
    tone: 'apologetic' | 'committed';
    includeMetrics: boolean;
    offerMeeting: boolean;
    includeSummary: boolean;
    includeEscalationPath: boolean;
  };
}

export const DEFAULT_FOLLOWUP_CONFIG: FollowupTemplateConfig = {
  minor: {
    subject: 'Quick Check-in After Your Recent Support Request',
    tone: 'friendly',
    includeMetrics: false,
    offerMeeting: false,
  },
  moderate: {
    subject: 'Following Up on Your Resolved Issue - All Good?',
    tone: 'empathetic',
    includeMetrics: true,
    offerMeeting: true,
    includeSummary: true,
  },
  major: {
    subject: 'Personal Follow-Up: Checking In After Your Recent Issue',
    tone: 'apologetic',
    includeMetrics: true,
    offerMeeting: true,
    includeSummary: true,
    includeEscalationPath: true,
  },
};

// ============================================
// Automation Trigger Types
// ============================================

export interface FollowupTriggerConfig {
  enabled: boolean;

  // Auto-trigger conditions
  triggerOnP1Resolution: boolean;
  triggerOnP2Resolution: boolean;
  triggerOnEscalatedResolution: boolean;
  triggerOnMultipleTickets: boolean;
  multipleTicketThreshold: number; // e.g., 3 tickets in 7 days

  // Delay before sending
  delayHours: number;

  // Skip conditions
  skipIfRecentContact: boolean;
  recentContactDays: number;
  skipIfLowHealthScore: boolean;
  lowHealthScoreThreshold: number;
}

export const DEFAULT_TRIGGER_CONFIG: FollowupTriggerConfig = {
  enabled: true,
  triggerOnP1Resolution: true,
  triggerOnP2Resolution: true,
  triggerOnEscalatedResolution: true,
  triggerOnMultipleTickets: true,
  multipleTicketThreshold: 3,
  delayHours: 4,
  skipIfRecentContact: true,
  recentContactDays: 2,
  skipIfLowHealthScore: false,
  lowHealthScoreThreshold: 30,
};
