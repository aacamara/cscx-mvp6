/**
 * Event Follow-Up Types
 * PRD-055: Webinar/Event Follow-Up Sequence
 *
 * Types for post-event follow-up sequences based on attendance status.
 */

import { EventType, AttendanceStatus } from './eventEngagement.js';

// ============================================
// Event Follow-Up Types
// ============================================

export type ParticipationType = 'attended' | 'registered_missed' | 'partial';

export type FollowUpEmailType =
  | 'thank_you'        // Day 1 for attended
  | 'resources'        // Day 3 for attended
  | 'discussion'       // Day 7 for attended
  | 'recording'        // Day 1 for missed
  | 'highlights';      // Day 4 for missed

// ============================================
// Event Context
// ============================================

export interface EventContext {
  id: string;
  name: string;
  type: EventType;
  date: string;
  topic?: string;
  recordingUrl?: string;
  slidesUrl?: string;
  summaryDocUrl?: string;
  keyTakeaways?: string[];
  speakers?: Array<{
    name: string;
    title?: string;
    company?: string;
  }>;
  duration_minutes?: number;
  relatedResources?: Array<{
    title: string;
    url: string;
    type: 'document' | 'video' | 'checklist' | 'case_study';
  }>;
}

// ============================================
// Customer Context for Personalization
// ============================================

export interface CustomerEventContext {
  customerId: string;
  customerName: string;
  contactName: string;
  contactEmail: string;
  contactTitle?: string;
  arr?: number;
  healthScore?: number;
  industry?: string;
  segment?: string;
  participationType: ParticipationType;
  attendanceDuration?: number;
  askedQuestions?: boolean;
  submittedFeedback?: boolean;
}

// ============================================
// CSM Context
// ============================================

export interface CSMContext {
  name: string;
  email: string;
  title?: string;
  calendarLink?: string;
  phoneNumber?: string;
}

// ============================================
// Follow-Up Sequence Definition
// ============================================

export interface EventFollowUpSequence {
  id: string;
  eventId: string;
  eventName: string;
  customerId: string;
  customerName: string;
  participationType: ParticipationType;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  startDate: string;
  totalEmails: number;
  emailsSent: number;
  items: EventFollowUpSequenceItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface EventFollowUpSequenceItem {
  id: string;
  sequenceId: string;
  itemOrder: number;
  dayOffset: number;
  sendTime: string;
  scheduledAt: string;
  emailType: FollowUpEmailType;
  purpose: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  toEmail: string;
  status: 'pending' | 'scheduled' | 'sent' | 'failed' | 'cancelled';
  sentAt?: string;
  openedAt?: string;
  clickedAt?: string;
  errorMessage?: string;
}

// ============================================
// Sequence Generation Options
// ============================================

export interface EventFollowUpGenerationOptions {
  event: EventContext;
  customer: CustomerEventContext;
  csm: CSMContext;
  userId: string;
  customVariables?: Record<string, any>;
  skipEmails?: FollowUpEmailType[];
}

// ============================================
// Bulk Follow-Up Types
// ============================================

export interface BulkFollowUpRequest {
  eventId: string;
  customerIds?: string[];        // If not provided, process all attendees
  includeNoShows?: boolean;      // Whether to include registered but missed
  startImmediately?: boolean;    // Start sequences immediately vs draft
  customMessage?: string;        // Optional custom message to include
}

export interface BulkFollowUpResult {
  success: boolean;
  eventId: string;
  eventName: string;
  totalCustomers: number;
  sequences: {
    attended: {
      count: number;
      customerIds: string[];
    };
    missed: {
      count: number;
      customerIds: string[];
    };
    partial: {
      count: number;
      customerIds: string[];
    };
  };
  errors: Array<{
    customerId: string;
    customerName: string;
    error: string;
  }>;
}

// ============================================
// Event Attendance Analysis
// ============================================

export interface EventAttendanceAnalysis {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventType: EventType;
  summary: {
    totalRegistered: number;
    totalAttended: number;
    totalMissed: number;
    totalPartial: number;
    attendanceRate: number;
    avgDurationMinutes?: number;
    questionsAsked: number;
    feedbackSubmitted: number;
  };
  attendees: EventAttendee[];
  noShows: EventNoShow[];
  partialAttendees: EventPartialAttendee[];
}

export interface EventAttendee {
  customerId: string;
  customerName: string;
  contactName: string;
  contactEmail: string;
  contactTitle?: string;
  durationMinutes?: number;
  askedQuestions: boolean;
  submittedFeedback: boolean;
  followUpStatus?: 'none' | 'pending' | 'in_progress' | 'completed';
}

export interface EventNoShow {
  customerId: string;
  customerName: string;
  contactName: string;
  contactEmail: string;
  contactTitle?: string;
  registeredAt: string;
  followUpStatus?: 'none' | 'pending' | 'in_progress' | 'completed';
}

export interface EventPartialAttendee {
  customerId: string;
  customerName: string;
  contactName: string;
  contactEmail: string;
  contactTitle?: string;
  durationMinutes: number;
  percentageAttended: number;
  followUpStatus?: 'none' | 'pending' | 'in_progress' | 'completed';
}

// ============================================
// Engagement Tracking
// ============================================

export interface FollowUpEngagement {
  sequenceId: string;
  customerId: string;
  eventId: string;
  emailsSent: number;
  emailsOpened: number;
  linksClicked: number;
  repliesReceived: number;
  meetingBooked: boolean;
  conversions: Array<{
    type: 'reply' | 'meeting' | 'resource_download' | 'other';
    timestamp: string;
    details?: string;
  }>;
  engagementScore: number;
}

// ============================================
// API Request/Response Types
// ============================================

export interface GenerateFollowUpRequest {
  eventId: string;
  customerId: string;
  userId: string;
  skipEmails?: FollowUpEmailType[];
  customMessage?: string;
}

export interface GenerateFollowUpResponse {
  success: boolean;
  sequence: EventFollowUpSequence;
  preview: {
    participationType: ParticipationType;
    totalEmails: number;
    emailPreviews: Array<{
      emailType: FollowUpEmailType;
      dayOffset: number;
      subject: string;
      bodyPreview: string;
    }>;
  };
}

export interface StartSequenceRequest {
  sequenceId: string;
  userId: string;
  scheduleFor?: string;  // ISO date to start the sequence
}

export interface StartSequenceResponse {
  success: boolean;
  sequenceId: string;
  status: 'scheduled' | 'in_progress';
  firstEmailScheduledAt: string;
  totalEmails: number;
}

export interface GetEventAttendeesRequest {
  eventId: string;
  includeFollowUpStatus?: boolean;
}

export interface GetEventAttendeesResponse {
  success: boolean;
  analysis: EventAttendanceAnalysis;
}

// ============================================
// Sequence Template Metadata
// ============================================

export const EVENT_FOLLOWUP_ATTENDED_TEMPLATE = {
  name: 'Event Follow-Up - Attended',
  type: 'event_followup_attended' as const,
  description: '3-email sequence for customers who attended an event',
  emails: [
    { day: 1, dayOffset: 0, emailType: 'thank_you' as FollowUpEmailType, sendTime: '10:00', description: 'Thank You & Key Takeaways' },
    { day: 3, dayOffset: 2, emailType: 'resources' as FollowUpEmailType, sendTime: '09:00', description: 'Resources & Toolkit' },
    { day: 7, dayOffset: 6, emailType: 'discussion' as FollowUpEmailType, sendTime: '10:00', description: 'Personalized Discussion Offer' },
  ],
};

export const EVENT_FOLLOWUP_MISSED_TEMPLATE = {
  name: 'Event Follow-Up - Missed',
  type: 'event_followup_missed' as const,
  description: '2-email sequence for customers who registered but missed an event',
  emails: [
    { day: 1, dayOffset: 0, emailType: 'recording' as FollowUpEmailType, sendTime: '10:00', description: 'Recording & Summary' },
    { day: 4, dayOffset: 3, emailType: 'highlights' as FollowUpEmailType, sendTime: '09:00', description: 'Key Highlights & Quick Start' },
  ],
};
