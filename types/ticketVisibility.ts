/**
 * Support Ticket Visibility Types
 * PRD-122: Support Ticket to CSM Visibility
 */

// ============================================
// Core Ticket Types (Extended for CSM Visibility)
// ============================================

export type TicketSource = 'zendesk' | 'intercom' | 'salesforce_service' | 'freshdesk' | 'hubspot' | 'manual';
export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketStatus = 'new' | 'open' | 'pending' | 'solved' | 'closed';
export type TicketCategory = 'technical' | 'billing' | 'training' | 'feature_request' | 'security' | 'downtime' | 'integration' | 'general';

export interface SupportTicketVisibility {
  id: string;
  externalId: string;
  source: TicketSource;
  customerId: string;
  customerName?: string;
  customerHealthScore?: number;
  customerTier?: 'enterprise' | 'business' | 'startup' | 'free';

  // Ticket details
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategory;
  tags?: string[];

  // Assignment
  assignedAgent?: string;
  assignedAgentEmail?: string;
  csmId?: string;
  csmName?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;

  // SLA tracking
  slaFirstResponseTargetHours?: number;
  slaResolutionTargetHours?: number;
  slaFirstResponseMet?: boolean;
  slaResolutionMet?: boolean;
  isAgingBeyondSLA?: boolean;
  ageHours?: number;

  // Satisfaction
  csatScore?: number;
  csatFeedback?: string;

  // Escalation
  isEscalated: boolean;
  escalationLevel: number;
  escalationReason?: string;

  // Customer interaction count (replies)
  customerReplyCount: number;
  agentReplyCount: number;
  lastCustomerReplyAt?: string;

  // External link
  externalUrl?: string;
}

// ============================================
// CSM Ticket Notification Types
// ============================================

export type TicketNotificationType =
  | 'new_ticket'
  | 'status_change'
  | 'priority_escalation'
  | 'customer_reply'
  | 'resolution'
  | 'aging_sla'
  | 'escalation';

export type NotificationChannel = 'slack' | 'email' | 'in_app';
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface TicketNotification {
  id: string;
  ticketId: string;
  ticketExternalId: string;
  customerId: string;
  customerName: string;
  csmId: string;
  notificationType: TicketNotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];

  // Notification content
  title: string;
  message: string;
  ticketSummary: {
    subject: string;
    priority: TicketPriority;
    status: TicketStatus;
    assignedAgent?: string;
    ageHours: number;
  };

  // Context enrichment
  customerContext?: {
    healthScore: number;
    tier: string;
    renewalDate?: string;
    daysToRenewal?: number;
    openTicketCount: number;
  };

  // Timestamps
  createdAt: string;
  sentAt?: string;
  acknowledgedAt?: string;

  // Tracking
  acknowledged: boolean;
  acknowledgedBy?: string;
}

// ============================================
// CSM Notification Preferences
// ============================================

export interface TicketNotificationPreferences {
  csmId: string;

  // Priority thresholds
  notifyOnP1: boolean; // Always true for most configs
  notifyOnP2: boolean; // Always true for most configs
  notifyOnP3: boolean; // Configurable
  notifyOnP4: boolean; // Configurable

  // Customer tier filtering
  notifyOnEnterprise: boolean; // Always true
  notifyOnBusiness: boolean; // Configurable
  notifyOnStartup: boolean; // Configurable
  notifyOnFree: boolean; // Configurable

  // Issue type filtering (always escalate these)
  alwaysEscalateSecurity: boolean;
  alwaysEscalateDowntime: boolean;

  // Channel preferences
  urgentChannel: NotificationChannel; // Default: slack
  highChannel: NotificationChannel; // Default: in_app
  normalChannel: NotificationChannel; // Default: in_app
  lowChannel: NotificationChannel; // Default: email_digest

  // Batching settings
  enableBatching: boolean;
  batchIntervalMinutes: number; // Default: 60 for P3/P4
  dailyDigestEnabled: boolean;
  dailyDigestTime: string; // HH:mm format

  // SLA aging alerts
  notifyOnAgingSLA: boolean;
  agingThresholdPercent: number; // Alert at X% of SLA
}

// ============================================
// Customer Ticket Dashboard
// ============================================

export interface CustomerTicketSummary {
  customerId: string;
  customerName: string;

  // Counts
  openTickets: number;
  pendingTickets: number;
  recentlyClosed: number; // Last 30 days

  // Lists
  tickets: SupportTicketVisibility[];

  // Trends
  ticketTrend: {
    period: string;
    count: number;
    change: number; // vs previous period
    trend: 'increasing' | 'stable' | 'decreasing';
  };

  // CSAT
  avgCsatScore?: number;
  csatTrend: 'improving' | 'stable' | 'declining';

  // Patterns/Concerns
  concerningPatterns: TicketPattern[];

  // SLA performance
  slaPerformance: {
    firstResponseMetPercent: number;
    resolutionMetPercent: number;
    avgFirstResponseHours: number;
    avgResolutionHours: number;
  };
}

// ============================================
// Ticket Pattern Analysis
// ============================================

export type PatternType =
  | 'recurring_issue'
  | 'feature_gap'
  | 'training_need'
  | 'risk_indicator'
  | 'escalation_pattern';

export interface TicketPattern {
  id: string;
  customerId: string;
  patternType: PatternType;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';

  // Evidence
  ticketIds: string[];
  ticketCount: number;
  timeframeDescription: string; // e.g., "5 tickets in last 14 days"

  // Keywords/themes
  keywords: string[];
  categories: TicketCategory[];

  // Recommendations
  recommendations: TicketRecommendation[];

  // Timestamps
  firstOccurrence: string;
  lastOccurrence: string;
  detectedAt: string;

  // Status
  status: 'active' | 'acknowledged' | 'addressed' | 'dismissed';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface TicketRecommendation {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  type: 'reach_out' | 'training' | 'feature_request' | 'escalate' | 'internal_note';
}

// ============================================
// CSM Action Types
// ============================================

export type CSMTicketAction =
  | 'add_internal_note'
  | 'request_escalation'
  | 'reach_out_customer'
  | 'loop_in_team_member'
  | 'link_to_risk_signal'
  | 'acknowledge_pattern';

export interface CSMTicketActionRequest {
  ticketId: string;
  action: CSMTicketAction;
  csmId: string;
  csmName: string;

  // Action-specific data
  note?: string;
  escalationReason?: string;
  teamMemberEmail?: string;
  riskSignalId?: string;
  customerMessage?: string;

  // Metadata
  timestamp: string;
}

export interface CSMTicketActionResult {
  success: boolean;
  actionId: string;
  ticketId: string;
  action: CSMTicketAction;
  result?: {
    message: string;
    externalActionId?: string;
    syncedToSource: boolean;
  };
  error?: string;
}

// ============================================
// CSM Ticket Summary (Portfolio View)
// ============================================

export interface CSMTicketPortfolioSummary {
  csmId: string;
  csmName?: string;
  period: string;

  // Overview counts
  totalOpenTickets: number;
  totalCustomersWithTickets: number;
  urgentTickets: number; // P1/P2
  escalatedTickets: number;
  agingTickets: number; // Beyond SLA

  // Customers needing attention
  customersNeedingAttention: Array<{
    customerId: string;
    customerName: string;
    healthScore: number;
    openTicketCount: number;
    hasEscalation: boolean;
    hasP1P2: boolean;
    attentionReasons: string[];
  }>;

  // Patterns across portfolio
  portfolioPatterns: TicketPattern[];

  // Notifications
  pendingNotifications: TicketNotification[];

  // Statistics
  stats: {
    avgTicketsPerCustomer: number;
    avgResolutionHours: number;
    avgCsat: number;
    slaMetPercent: number;
  };
}

// ============================================
// API Response Types
// ============================================

export interface CustomerTicketsResponse {
  customerId: string;
  customerName: string;
  summary: CustomerTicketSummary;
  patterns: TicketPattern[];
  recentNotifications: TicketNotification[];
}

export interface TicketDetailResponse {
  ticket: SupportTicketVisibility;
  customerContext: {
    healthScore: number;
    tier: string;
    recentCsmInteractions: Array<{
      type: string;
      date: string;
      summary: string;
    }>;
    upcomingRenewal?: {
      date: string;
      daysUntil: number;
      arr: number;
    };
    relatedTickets: SupportTicketVisibility[];
    stakeholderContacts: Array<{
      name: string;
      role: string;
      email: string;
    }>;
  };
  availableActions: CSMTicketAction[];
}

export interface TicketNotificationResponse {
  notifications: TicketNotification[];
  total: number;
  unacknowledged: number;
}
