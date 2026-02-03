/**
 * Meeting History & Outcomes Types (PRD-077)
 *
 * Provides comprehensive view of all meetings with a customer account
 * including schedules, attendees, outcomes, action items, and follow-up status.
 */

// ============================================
// Core Meeting Types
// ============================================

export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type MeetingTypeValue = 'kickoff' | 'check_in' | 'qbr' | 'training' | 'escalation' | 'expansion' | 'renewal' | 'executive' | 'technical' | 'other';
export type OutcomeType = 'decision' | 'commitment' | 'insight' | 'risk' | 'opportunity';
export type OutcomeStatus = 'open' | 'in_progress' | 'completed' | 'overdue';
export type ActionItemStatus = 'pending' | 'completed' | 'overdue';
export type AttendanceStatus = 'attended' | 'no_show' | 'partial';
export type MeetingSentiment = 'positive' | 'neutral' | 'negative';

/**
 * Meeting attendee information
 */
export interface MeetingAttendee {
  email: string;
  name: string;
  role?: string;
  isInternal: boolean;
}

/**
 * Meeting outcome record
 */
export interface MeetingOutcome {
  id: string;
  type: OutcomeType;
  description: string;
  owner: string;
  dueDate: string | null;
  status: OutcomeStatus;
}

/**
 * Action item from a meeting
 */
export interface MeetingActionItem {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  status: ActionItemStatus;
  completedAt: string | null;
  notes?: string;
  meetingId: string;
  meetingTitle?: string;
  meetingDate?: string;
}

/**
 * Meeting analysis data
 */
export interface MeetingAnalysis {
  keyTopics: string[];
  customerSignals: string[];
  competitorMentions: string[];
  featureRequests: string[];
  riskIndicators: string[];
  expansionOpportunities: string[];
}

/**
 * Complete meeting record
 */
export interface Meeting {
  id: string;
  customerId: string;
  customerName?: string;

  // Basic info
  title: string;
  description: string;
  meetingType: MeetingTypeValue;
  scheduledAt: string;
  duration: number; // minutes
  status: MeetingStatus;

  // Participants
  organizer: string;
  internalAttendees: MeetingAttendee[];
  externalAttendees: MeetingAttendee[];
  attendanceStatus: Record<string, AttendanceStatus>;

  // Location/Access
  meetingUrl?: string;
  calendarEventId?: string;
  recordingUrl?: string;
  transcriptId?: string;

  // Outcomes (post-meeting)
  summary?: string;
  outcomes: MeetingOutcome[];
  actionItems: MeetingActionItem[];
  nextMeeting?: string | null;
  sentiment?: MeetingSentiment;

  // Analysis
  analysis?: MeetingAnalysis;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Meeting Stats & Summary Types
// ============================================

/**
 * Meeting statistics for a customer
 */
export interface MeetingStats {
  totalMeetings: number;
  meetingsThisQuarter: number;
  avgFrequency: string; // e.g., "2/month"
  attendanceRate: number; // percentage
  lastMeetingDate: string | null;
  lastMeetingDaysAgo: number | null;
  nextMeetingDate: string | null;
  nextMeetingType?: MeetingTypeValue;
  vsAverageTotal: number; // percentage difference from average
  vsAverageQuarter: string; // "above", "average", "below"
}

/**
 * Meeting type distribution
 */
export interface MeetingTypeDistribution {
  type: MeetingTypeValue;
  count: number;
  percentage: number;
  lastDate: string | null;
}

/**
 * Attendee analysis
 */
export interface AttendeeAnalysis {
  name: string;
  email: string;
  role?: string;
  meetingsAttended: number;
  attendanceRate: number;
  lastAttendedDate: string | null;
  isExecutive: boolean;
  isChampion: boolean;
}

/**
 * Commitment tracking
 */
export interface CommitmentTracking {
  commitment: string;
  madeDate: string;
  meetingId: string;
  owner: string;
  status: 'scheduled' | 'completed' | 'in_progress' | 'overdue';
  dueDate?: string;
  completedDate?: string;
}

// ============================================
// Meeting Prep Types
// ============================================

/**
 * Meeting prep checklist item
 */
export interface PrepChecklistItem {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: string;
}

/**
 * Upcoming meeting with prep status
 */
export interface UpcomingMeeting extends Meeting {
  prepStatus: 'not_started' | 'in_progress' | 'ready';
  prepProgress: number; // percentage 0-100
  prepChecklist: PrepChecklistItem[];
  agenda: string[];
  suggestedTopics: string[];
}

// ============================================
// API Response Types
// ============================================

/**
 * Full meeting history response
 */
export interface MeetingHistoryResponse {
  customerId: string;
  customerName: string;
  customerSince: string;

  // Summary stats
  stats: MeetingStats;

  // Meetings
  upcomingMeetings: UpcomingMeeting[];
  recentMeetings: Meeting[];
  allMeetings: Meeting[];

  // Analysis
  typeDistribution: MeetingTypeDistribution[];
  attendeeAnalysis: AttendeeAnalysis[];
  commitments: CommitmentTracking[];

  // Action tracking
  actionItems: {
    open: MeetingActionItem[];
    completed: MeetingActionItem[];
    overdue: MeetingActionItem[];
  };

  // Fulfillment metrics
  commitmentFulfillmentRate: number;
  totalCommitments: number;
  keptCommitments: number;

  // Timestamps
  generatedAt: string;
}

/**
 * Meeting outcome update request
 */
export interface MeetingOutcomeUpdateRequest {
  summary?: string;
  outcomes?: Omit<MeetingOutcome, 'id'>[];
  actionItems?: Omit<MeetingActionItem, 'id' | 'meetingId'>[];
  sentiment?: MeetingSentiment;
  nextMeeting?: string | null;
}

/**
 * Action item update request
 */
export interface ActionItemUpdateRequest {
  status?: ActionItemStatus;
  notes?: string;
  completedAt?: string;
  dueDate?: string;
}

// ============================================
// Filter & Query Types
// ============================================

export type MeetingTimePeriod = 'all' | '6m' | '12m' | 'ytd';
export type MeetingStatusFilter = 'all' | 'completed' | 'upcoming' | 'cancelled';

export interface MeetingHistoryFilters {
  period?: MeetingTimePeriod;
  status?: MeetingStatusFilter;
  meetingType?: MeetingTypeValue;
}

// ============================================
// Meeting Type Metadata
// ============================================

export const MEETING_TYPE_METADATA: Record<MeetingTypeValue, {
  label: string;
  description: string;
  typicalFrequency: string;
  icon: string;
}> = {
  kickoff: {
    label: 'Kickoff',
    description: 'Initial onboarding meeting',
    typicalFrequency: 'Once',
    icon: 'rocket'
  },
  check_in: {
    label: 'Check-in',
    description: 'Regular touchpoint meeting',
    typicalFrequency: 'Monthly',
    icon: 'chat'
  },
  qbr: {
    label: 'QBR',
    description: 'Quarterly Business Review',
    typicalFrequency: 'Quarterly',
    icon: 'chart'
  },
  training: {
    label: 'Training',
    description: 'Product training session',
    typicalFrequency: 'As needed',
    icon: 'academic'
  },
  escalation: {
    label: 'Escalation',
    description: 'Issue resolution meeting',
    typicalFrequency: 'As needed',
    icon: 'alert'
  },
  expansion: {
    label: 'Expansion',
    description: 'Growth discussion meeting',
    typicalFrequency: 'As needed',
    icon: 'trending-up'
  },
  renewal: {
    label: 'Renewal',
    description: 'Contract renewal discussion',
    typicalFrequency: 'Annual',
    icon: 'refresh'
  },
  executive: {
    label: 'Executive',
    description: 'Exec-to-exec alignment',
    typicalFrequency: 'Quarterly',
    icon: 'briefcase'
  },
  technical: {
    label: 'Technical',
    description: 'Technical review session',
    typicalFrequency: 'As needed',
    icon: 'code'
  },
  other: {
    label: 'Other',
    description: 'Other meeting type',
    typicalFrequency: 'Varies',
    icon: 'calendar'
  }
};
