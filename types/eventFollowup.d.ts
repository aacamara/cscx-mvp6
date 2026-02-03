/**
 * Event Follow-Up Types
 * PRD-055: Webinar/Event Follow-Up Sequence
 *
 * Types for post-event follow-up sequences based on attendance status.
 */
import { EventType } from './eventEngagement.js';
export type ParticipationType = 'attended' | 'registered_missed' | 'partial';
export type FollowUpEmailType = 'thank_you' | 'resources' | 'discussion' | 'recording' | 'highlights';
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
export interface CSMContext {
    name: string;
    email: string;
    title?: string;
    calendarLink?: string;
    phoneNumber?: string;
}
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
export interface EventFollowUpGenerationOptions {
    event: EventContext;
    customer: CustomerEventContext;
    csm: CSMContext;
    userId: string;
    customVariables?: Record<string, any>;
    skipEmails?: FollowUpEmailType[];
}
export interface BulkFollowUpRequest {
    eventId: string;
    customerIds?: string[];
    includeNoShows?: boolean;
    startImmediately?: boolean;
    customMessage?: string;
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
    scheduleFor?: string;
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
export declare const EVENT_FOLLOWUP_ATTENDED_TEMPLATE: {
    name: string;
    type: "event_followup_attended";
    description: string;
    emails: {
        day: number;
        dayOffset: number;
        emailType: FollowUpEmailType;
        sendTime: string;
        description: string;
    }[];
};
export declare const EVENT_FOLLOWUP_MISSED_TEMPLATE: {
    name: string;
    type: "event_followup_missed";
    description: string;
    emails: {
        day: number;
        dayOffset: number;
        emailType: FollowUpEmailType;
        sendTime: string;
        description: string;
    }[];
};
//# sourceMappingURL=eventFollowup.d.ts.map