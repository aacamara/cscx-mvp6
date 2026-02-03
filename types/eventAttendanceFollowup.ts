/**
 * Event Attendance Follow-Up Types (PRD-135)
 *
 * Types for customer event attendance detection and automated follow-up:
 * - Attendance detection from various platforms
 * - CSM notification and context capture
 * - Personalized follow-up generation
 * - Activity logging and aggregate analysis
 */

import { EventType, AttendanceStatus, EngagementLevel } from './eventEngagement.js';

// ============================================
// Core Event Attendance Types
// ============================================

export type EventAttendanceSource =
  | 'zoom_webinar'
  | 'goto_webinar'
  | 'conference_registration'
  | 'lms_completion'
  | 'marketing_platform'
  | 'manual_entry';

export type FollowUpStatus =
  | 'pending_generation'
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'sent'
  | 'failed'
  | 'cancelled';

export type NotificationStatus =
  | 'pending'
  | 'sent'
  | 'read'
  | 'dismissed';

// ============================================
// Event Attendance Record
// ============================================

/**
 * Customer event attendance record per PRD-135 spec
 */
export interface EventAttendance {
  id: string;
  customerId: string;
  customerName: string;
  stakeholderId: string | null;
  stakeholderName: string | null;
  stakeholderEmail: string | null;
  stakeholderTitle: string | null;
  event: {
    id: string;
    name: string;
    type: EventType | 'webinar' | 'conference' | 'training' | 'workshop' | 'other';
    topic: string;
    date: string;
    endDate?: string;
    host?: string;
    description?: string;
    recordingUrl?: string;
    slidesUrl?: string;
    resourceUrls?: Array<{ title: string; url: string; type: string }>;
  };
  attendance: {
    registered: boolean;
    registeredAt?: string;
    attended: boolean;
    attendedAt?: string;
    duration: number; // minutes
    engagementLevel: EngagementLevel | 'high' | 'medium' | 'low';
    questionsAsked: number;
    pollsAnswered?: number;
    downloadsCount: number;
    sessionsAttended: string[]; // for multi-session conferences
    feedbackSubmitted?: boolean;
    feedbackRating?: number;
  };
  followUp: {
    generated: boolean;
    generatedAt?: string;
    draftId: string | null;
    status: FollowUpStatus;
    sent: boolean;
    sentAt: string | null;
    approvedBy?: string;
    approvedAt?: string;
  };
  csmNotification: {
    notified: boolean;
    notifiedAt?: string;
    status: NotificationStatus;
    dismissedAt?: string;
  };
  source: EventAttendanceSource;
  sourceId?: string; // External ID from source platform
  detectedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CSM Notification Types
// ============================================

/**
 * CSM notification for customer event attendance
 */
export interface EventAttendanceNotification {
  id: string;
  csmId: string;
  csmEmail: string;
  attendanceId: string;
  customerId: string;
  customerName: string;
  stakeholderName: string | null;
  event: {
    id: string;
    name: string;
    type: string;
    topic: string;
    date: string;
  };
  engagementSummary: {
    level: EngagementLevel;
    duration: number;
    questionsAsked: number;
    downloadsCount: number;
    highlights: string[];
  };
  relevanceToGoals?: string;
  recommendedFollowUp: {
    type: 'thank_you' | 'resources' | 'discussion' | 'training_completion';
    priority: 'high' | 'medium' | 'low';
    suggestedActions: string[];
    draftAvailable: boolean;
  };
  status: NotificationStatus;
  createdAt: string;
  readAt?: string;
  dismissedAt?: string;
}

// ============================================
// Follow-Up Generation Types
// ============================================

/**
 * Generated follow-up email draft
 */
export interface EventFollowUpDraft {
  id: string;
  attendanceId: string;
  customerId: string;
  customerName: string;
  stakeholderEmail: string;
  stakeholderName: string;
  event: {
    id: string;
    name: string;
    type: string;
    date: string;
  };
  email: {
    subject: string;
    bodyHtml: string;
    bodyText: string;
    keyTakeaways: string[];
    additionalResources: Array<{
      title: string;
      url: string;
      description?: string;
    }>;
    cta?: {
      text: string;
      url: string;
    };
  };
  personalization: {
    customerGoals?: string[];
    relevantFeatures?: string[];
    industryContext?: string;
    previousInteractions?: string[];
  };
  status: FollowUpStatus;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  sentBy?: string;
  sentAt?: string;
}

// ============================================
// Activity Log Types
// ============================================

/**
 * Event participation activity log entry
 */
export interface EventParticipationActivity {
  id: string;
  customerId: string;
  customerName: string;
  activityType:
    | 'event_registered'
    | 'event_attended'
    | 'event_missed'
    | 'follow_up_generated'
    | 'follow_up_sent'
    | 'follow_up_replied'
    | 'training_completed';
  eventId: string;
  eventName: string;
  eventType: string;
  description: string;
  metadata: Record<string, unknown>;
  engagementScoreImpact?: number;
  timestamp: string;
}

// ============================================
// Aggregate Analysis Types
// ============================================

/**
 * Event impact analysis
 */
export interface EventImpactAnalysis {
  eventId: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  summary: {
    totalRegistered: number;
    totalAttended: number;
    attendanceRate: number;
    avgEngagementLevel: number;
    avgDuration: number;
    totalQuestionsAsked: number;
    totalDownloads: number;
    feedbackScore?: number;
  };
  customerBreakdown: {
    bySegment: Record<string, { registered: number; attended: number; attendanceRate: number }>;
    byHealthScore: Record<string, { registered: number; attended: number; attendanceRate: number }>;
    byIndustry: Record<string, { registered: number; attended: number; attendanceRate: number }>;
  };
  engagementTrend: {
    preEventEngagement: number;
    postEventEngagement: number;
    change: number;
    changePercent: number;
  };
  followUpMetrics: {
    followUpsSent: number;
    followUpsOpened: number;
    followUpsReplied: number;
    openRate: number;
    responseRate: number;
  };
  topicInterests: Array<{
    topic: string;
    attendeeCount: number;
    engagementScore: number;
  }>;
}

/**
 * Customer event engagement trends
 */
export interface CustomerEventTrends {
  customerId: string;
  customerName: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    eventsRegistered: number;
    eventsAttended: number;
    attendanceRate: number;
    avgEngagementLevel: number;
    totalDuration: number;
    questionsAsked: number;
    trainingsCompleted: number;
  };
  eventHistory: Array<{
    eventId: string;
    eventName: string;
    eventType: string;
    eventDate: string;
    attended: boolean;
    engagementLevel?: EngagementLevel;
    duration?: number;
    followUpSent: boolean;
    followUpReplied?: boolean;
  }>;
  topicsOfInterest: string[];
  recommendations: string[];
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Record attendance request
 */
export interface RecordAttendanceRequest {
  customerId: string;
  stakeholderId?: string;
  stakeholderEmail?: string;
  stakeholderName?: string;
  event: {
    id?: string;
    name: string;
    type: string;
    topic: string;
    date: string;
    endDate?: string;
  };
  attendance: {
    registered: boolean;
    attended: boolean;
    duration?: number;
    engagementLevel?: 'high' | 'medium' | 'low';
    questionsAsked?: number;
    downloadsCount?: number;
    sessionsAttended?: string[];
  };
  source: EventAttendanceSource;
  sourceId?: string;
}

export interface RecordAttendanceResponse {
  success: boolean;
  attendance: EventAttendance;
  notification?: EventAttendanceNotification;
  message: string;
}

/**
 * Generate follow-up request
 */
export interface GenerateFollowUpRequest {
  attendanceId: string;
  customMessage?: string;
  includeResources?: boolean;
  includeDiscussionOffer?: boolean;
}

export interface GenerateFollowUpResponse {
  success: boolean;
  draft: EventFollowUpDraft;
  message: string;
}

/**
 * Approve and send follow-up request
 */
export interface SendFollowUpRequest {
  draftId: string;
  modifications?: {
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
  };
}

export interface SendFollowUpResponse {
  success: boolean;
  sentAt: string;
  emailId?: string;
  message: string;
}

/**
 * Get customer events request
 */
export interface GetCustomerEventsRequest {
  customerId: string;
  dateRange?: {
    start: string;
    end: string;
  };
  eventType?: string;
  includeFollowUpStatus?: boolean;
}

export interface GetCustomerEventsResponse {
  success: boolean;
  events: EventAttendance[];
  trends?: CustomerEventTrends;
  totalCount: number;
}

/**
 * Get event analysis request
 */
export interface GetEventAnalysisRequest {
  eventId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  groupBy?: 'segment' | 'industry' | 'health_score';
}

export interface GetEventAnalysisResponse {
  success: boolean;
  analysis: EventImpactAnalysis | EventImpactAnalysis[];
  aggregateSummary?: {
    totalEvents: number;
    totalAttendees: number;
    avgAttendanceRate: number;
    avgEngagementLevel: number;
    eventROI?: Record<string, number>;
  };
}

/**
 * Bulk attendance import
 */
export interface BulkAttendanceImportRequest {
  eventId: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  source: EventAttendanceSource;
  attendees: Array<{
    email: string;
    name?: string;
    customerId?: string;
    attended: boolean;
    duration?: number;
    engagementLevel?: 'high' | 'medium' | 'low';
  }>;
  generateFollowUps?: boolean;
  notifyCSMs?: boolean;
}

export interface BulkAttendanceImportResponse {
  success: boolean;
  imported: number;
  matched: number;
  unmatched: number;
  errors: Array<{
    email: string;
    error: string;
  }>;
  followUpsGenerated?: number;
  notificationsSent?: number;
}

// ============================================
// UI Display Helpers
// ============================================

export const EVENT_TYPE_LABELS: Record<string, string> = {
  webinar: 'Webinar',
  conference: 'Conference',
  training: 'Training',
  workshop: 'Workshop',
  user_group: 'User Group',
  meetup: 'Meetup',
  other: 'Other'
};

export const ENGAGEMENT_LEVEL_LABELS: Record<string, string> = {
  high: 'High Engagement',
  medium: 'Medium Engagement',
  low: 'Low Engagement'
};

export const FOLLOWUP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  pending_generation: 'Pending Generation',
  draft: 'Draft Created',
  pending_review: 'Pending Review',
  approved: 'Approved',
  sent: 'Sent',
  failed: 'Failed',
  cancelled: 'Cancelled'
};

export const SOURCE_LABELS: Record<EventAttendanceSource, string> = {
  zoom_webinar: 'Zoom Webinar',
  goto_webinar: 'GoTo Webinar',
  conference_registration: 'Conference Registration',
  lms_completion: 'LMS (Training)',
  marketing_platform: 'Marketing Platform',
  manual_entry: 'Manual Entry'
};

export const ENGAGEMENT_LEVEL_COLORS: Record<string, string> = {
  high: 'text-green-600 bg-green-100',
  medium: 'text-yellow-600 bg-yellow-100',
  low: 'text-red-600 bg-red-100'
};

export const FOLLOWUP_STATUS_COLORS: Record<FollowUpStatus, string> = {
  pending_generation: 'text-gray-600 bg-gray-100',
  draft: 'text-blue-600 bg-blue-100',
  pending_review: 'text-yellow-600 bg-yellow-100',
  approved: 'text-green-600 bg-green-100',
  sent: 'text-green-700 bg-green-200',
  failed: 'text-red-600 bg-red-100',
  cancelled: 'text-gray-500 bg-gray-100'
};
