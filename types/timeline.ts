/**
 * Customer Journey Timeline Types (PRD-062)
 *
 * Type definitions for timeline events, stakeholder engagement,
 * and journey visualization components.
 */

// ============================================
// EVENT TYPES
// ============================================

export type TimelineEventType =
  // Customer-Facing Events
  | 'meeting'
  | 'email_sent'
  | 'email_received'
  | 'call'
  | 'support_ticket'
  | 'nps_survey'
  | 'qbr'
  | 'training'
  // Contract Events
  | 'contract_signed'
  | 'contract_renewed'
  | 'contract_expanded'
  | 'contract_amendment'
  // Health Events
  | 'health_change'
  | 'risk_signal'
  | 'risk_resolved'
  // Usage Events
  | 'usage_milestone'
  | 'feature_adopted'
  | 'usage_drop'
  // Internal Events
  | 'internal_note'
  | 'csm_change'
  | 'escalation';

export type TimelineEventCategory =
  | 'customer_facing'
  | 'contract'
  | 'health'
  | 'usage'
  | 'internal';

export type EventSentiment = 'positive' | 'neutral' | 'negative';
export type EventImportance = 'high' | 'normal' | 'low';

// ============================================
// TIMELINE EVENT
// ============================================

export interface TimelineEventParticipant {
  name: string;
  email?: string;
  role?: string;
}

export interface TimelineEvent {
  id: string;
  customerId: string;

  // Classification
  eventType: TimelineEventType;
  eventCategory: TimelineEventCategory;

  // Content
  title: string;
  description?: string;

  // Temporal
  occurredAt: string; // ISO timestamp
  durationMinutes?: number;

  // Participants
  participants?: TimelineEventParticipant[];
  stakeholderIds?: string[];

  // Source
  sourceType: string;
  sourceId?: string;
  sourceUrl?: string;

  // Analysis
  sentiment?: EventSentiment;
  importance: EventImportance;
  isMilestone: boolean;

  // Metadata
  metadata?: Record<string, unknown>;
  tags?: string[];

  // Internal
  isInternal: boolean;
  createdBy?: string;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// TIMELINE FILTERS
// ============================================

export interface TimelineFilters {
  startDate?: string;
  endDate?: string;
  eventTypes?: TimelineEventType[];
  eventCategories?: TimelineEventCategory[];
  includeInternal?: boolean;
  sentiment?: EventSentiment;
  importance?: EventImportance;
  stakeholderIds?: string[];
  searchQuery?: string;
}

// ============================================
// TIMELINE STATS
// ============================================

export interface TimelineStats {
  totalEvents: number;
  byType: Record<TimelineEventType, number>;
  byCategory: Record<TimelineEventCategory, number>;
  communicationBalance: {
    outbound: number;
    inbound: number;
    meetings: number;
  };
  dateRange: {
    earliest: string;
    latest: string;
    totalDays: number;
  };
}

// ============================================
// MILESTONES
// ============================================

export type MilestoneType =
  | 'onboarding_complete'
  | 'first_value'
  | 'renewal'
  | 'expansion'
  | 'champion_identified'
  | 'executive_sponsor_added'
  | 'health_improvement'
  | 'risk_resolved';

export interface Milestone {
  id: string;
  customerId: string;
  milestoneType: MilestoneType;
  title: string;
  description?: string;
  achievedAt: string;
  relatedEventId?: string;
  relatedContractId?: string;
  valueImpact?: number;
  metadata?: Record<string, unknown>;
}

// ============================================
// HEALTH SCORE HISTORY
// ============================================

export interface HealthScorePoint {
  id: string;
  customerId: string;
  score: number;
  previousScore?: number;
  changeAmount?: number;

  // Components
  engagementComponent?: number;
  adoptionComponent?: number;
  sentimentComponent?: number;
  supportComponent?: number;

  changeReason?: string;
  changeTriggers?: Array<{ type: string; description: string }>;

  recordedAt: string;
}

// ============================================
// STAKEHOLDER ENGAGEMENT
// ============================================

export interface StakeholderEngagementPeriod {
  id: string;
  stakeholderId: string;
  customerId: string;

  periodStart: string;
  periodEnd: string;

  // Counts
  meetingsCount: number;
  emailsSent: number;
  emailsReceived: number;
  callsCount: number;
  totalInteractions: number;

  // Scores
  engagementScore?: number;
  responseRate?: number;
  avgResponseTimeHours?: number;

  // Sentiment
  sentimentTrend?: 'improving' | 'stable' | 'declining';
  sentimentScore?: number;

  activityBreakdown?: Record<string, number>;
}

export interface StakeholderEngagementSummary {
  stakeholder: {
    id: string;
    name: string;
    role?: string;
    email?: string;
    isPrimary: boolean;
  };
  currentEngagement: StakeholderEngagementPeriod | null;
  engagementHistory: StakeholderEngagementPeriod[];
  lastContact?: string;
  totalInteractionsAllTime: number;
  sentiment: EventSentiment | 'unknown';
}

// ============================================
// ACTIVITY HEATMAP
// ============================================

export interface ActivityHeatmapData {
  date: string; // YYYY-MM-DD
  count: number;
  events: Array<{
    type: TimelineEventType;
    count: number;
  }>;
}

// ============================================
// COMMUNICATION THREAD
// ============================================

export interface CommunicationThread {
  id: string;
  customerId: string;
  threadId: string;
  subject: string;

  messageCount: number;
  participantCount: number;
  participants: TimelineEventParticipant[];

  firstMessageAt: string;
  lastMessageAt: string;

  threadType?: 'inquiry' | 'support' | 'negotiation' | 'general';
  sentiment?: EventSentiment;
  status: 'active' | 'closed' | 'pending';
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface TimelineResponse {
  customer: {
    id: string;
    name: string;
    customerSince: string;
  };
  events: TimelineEvent[];
  milestones: Milestone[];
  stats: TimelineStats;
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

export interface CustomerJourneyView {
  customer: {
    id: string;
    name: string;
    arr: number;
    healthScore: number;
    stage: string;
    customerSince: string;
    renewalDate?: string;
  };

  // Timeline data
  events: TimelineEvent[];
  milestones: Milestone[];
  stats: TimelineStats;

  // Health journey
  healthHistory: HealthScorePoint[];

  // Stakeholder engagement
  stakeholderEngagement: StakeholderEngagementSummary[];

  // Activity heatmap
  activityHeatmap: ActivityHeatmapData[];

  // Key highlights
  highlights: {
    keyMilestones: Milestone[];
    recentActivity: TimelineEvent[];
    contractEvents: TimelineEvent[];
    stakeholderChanges: TimelineEvent[];
  };

  // Metadata
  generatedAt: string;
  dataCompleteness: number;
}

// ============================================
// EVENT TYPE CONFIGURATION
// ============================================

export interface EventTypeConfig {
  type: TimelineEventType;
  category: TimelineEventCategory;
  label: string;
  icon: string;
  color: string;
  source: string;
}

export const EVENT_TYPE_CONFIG: EventTypeConfig[] = [
  // Customer-Facing
  { type: 'meeting', category: 'customer_facing', label: 'Meeting', icon: 'CalendarIcon', color: 'blue', source: 'Calendar' },
  { type: 'email_sent', category: 'customer_facing', label: 'Email Sent', icon: 'EnvelopeIcon', color: 'cyan', source: 'Gmail' },
  { type: 'email_received', category: 'customer_facing', label: 'Email Received', icon: 'InboxIcon', color: 'teal', source: 'Gmail' },
  { type: 'call', category: 'customer_facing', label: 'Call', icon: 'PhoneIcon', color: 'indigo', source: 'Zoom/Phone' },
  { type: 'support_ticket', category: 'customer_facing', label: 'Support Ticket', icon: 'TicketIcon', color: 'orange', source: 'Zendesk' },
  { type: 'nps_survey', category: 'customer_facing', label: 'NPS Survey', icon: 'StarIcon', color: 'yellow', source: 'Survey' },
  { type: 'qbr', category: 'customer_facing', label: 'QBR', icon: 'PresentationIcon', color: 'purple', source: 'Calendar' },
  { type: 'training', category: 'customer_facing', label: 'Training', icon: 'AcademicCapIcon', color: 'green', source: 'Sessions' },

  // Contract
  { type: 'contract_signed', category: 'contract', label: 'Contract Signed', icon: 'DocumentIcon', color: 'emerald', source: 'Contracts' },
  { type: 'contract_renewed', category: 'contract', label: 'Contract Renewed', icon: 'RefreshIcon', color: 'emerald', source: 'Contracts' },
  { type: 'contract_expanded', category: 'contract', label: 'Contract Expanded', icon: 'TrendingUpIcon', color: 'emerald', source: 'Contracts' },
  { type: 'contract_amendment', category: 'contract', label: 'Contract Amendment', icon: 'PencilIcon', color: 'amber', source: 'Contracts' },

  // Health
  { type: 'health_change', category: 'health', label: 'Health Change', icon: 'HeartIcon', color: 'red', source: 'Health' },
  { type: 'risk_signal', category: 'health', label: 'Risk Signal', icon: 'ExclamationIcon', color: 'red', source: 'Alerts' },
  { type: 'risk_resolved', category: 'health', label: 'Risk Resolved', icon: 'CheckCircleIcon', color: 'green', source: 'Alerts' },

  // Usage
  { type: 'usage_milestone', category: 'usage', label: 'Usage Milestone', icon: 'TrophyIcon', color: 'gold', source: 'Analytics' },
  { type: 'feature_adopted', category: 'usage', label: 'Feature Adopted', icon: 'SparklesIcon', color: 'violet', source: 'Analytics' },
  { type: 'usage_drop', category: 'usage', label: 'Usage Drop', icon: 'TrendingDownIcon', color: 'red', source: 'Analytics' },

  // Internal
  { type: 'internal_note', category: 'internal', label: 'Internal Note', icon: 'DocumentTextIcon', color: 'gray', source: 'Notes' },
  { type: 'csm_change', category: 'internal', label: 'CSM Change', icon: 'UserSwitchIcon', color: 'gray', source: 'System' },
  { type: 'escalation', category: 'internal', label: 'Escalation', icon: 'BellAlertIcon', color: 'red', source: 'Internal' },
];

export const getEventTypeConfig = (type: TimelineEventType): EventTypeConfig | undefined =>
  EVENT_TYPE_CONFIG.find(c => c.type === type);
