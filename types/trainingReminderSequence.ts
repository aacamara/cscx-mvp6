/**
 * Training Reminder Sequence Types (PRD-143)
 *
 * Automated reminder sequences when training sessions are scheduled.
 * Sends T-7, T-3, T-1 day, and T-1 hour reminders with pre-training materials.
 */

// ============================================
// Core Training Sequence Types
// ============================================

export type TrainingType =
  | 'onboarding'
  | 'feature'
  | 'advanced'
  | 'certification'
  | 'custom';

export type ReminderType = 'week' | '3day' | '1day' | '1hour';

export type AttendeeResponseStatus =
  | 'pending'
  | 'confirmed'
  | 'rescheduled'
  | 'cancelled';

export type SequenceStatus =
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'paused';

// ============================================
// Training Attendee
// ============================================

export interface TrainingAttendee {
  id: string;
  email: string;
  name: string;
  role?: string;
  responseStatus: AttendeeResponseStatus;
  confirmedAt?: string;
  rescheduleRequestedAt?: string;
  cancelledAt?: string;
  noShowMarkedAt?: string;
}

// ============================================
// Reminder Status
// ============================================

export interface ReminderStatus {
  id: string;
  type: ReminderType;
  scheduledFor: string;
  sent: boolean;
  sentAt: string | null;
  emailId?: string;
  openedAt?: string;
  clickedAt?: string;
  error?: string;
}

// ============================================
// Training Materials
// ============================================

export interface TrainingMaterials {
  prework: PreworkItem[];
  prerequisites: string[];
  agenda: string;
  joinLink: string;
  learningObjectives: string[];
  questionsToConsider: string[];
  setupInstructions?: string;
}

export interface PreworkItem {
  title: string;
  type: 'video' | 'document' | 'quiz' | 'exercise' | 'reading';
  url: string;
  estimatedMinutes: number;
  required: boolean;
}

// ============================================
// Post-Training Follow-Up
// ============================================

export interface PostTrainingFollowUp {
  sent: boolean;
  sentAt: string | null;
  recordingUrl: string | null;
  materialsUrl: string | null;
  surveyId: string | null;
  surveyCompleted: boolean;
  nextSteps: string[];
  certificationInfo?: {
    available: boolean;
    url?: string;
    deadline?: string;
  };
}

// ============================================
// Attendance Tracking
// ============================================

export interface AttendanceTracking {
  attended: string[]; // attendee IDs
  noShow: string[]; // attendee IDs
  rescheduled: string[]; // attendee IDs
  partial: string[]; // attendee IDs who left early
}

// ============================================
// Training Reminder Sequence (Main Entity)
// ============================================

export interface TrainingReminderSequence {
  id: string;
  customerId: string;
  customerName: string;
  userId: string; // CSM who owns this sequence
  training: {
    id: string;
    calendarEventId?: string;
    type: TrainingType;
    title: string;
    description?: string;
    scheduledAt: string;
    duration: number; // in minutes
    timezone: string;
    attendees: TrainingAttendee[];
    trainer?: {
      name: string;
      email: string;
    };
  };
  reminders: ReminderStatus[];
  materials: TrainingMaterials;
  postTraining: PostTrainingFollowUp;
  attendance: AttendanceTracking;
  status: SequenceStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ============================================
// Training Analytics
// ============================================

export interface TrainingAttendanceAnalytics {
  totalScheduled: number;
  totalCompleted: number;
  attendanceRate: number;
  noShowRate: number;
  rescheduleRate: number;
  preworkCompletionRate: number;
  avgSatisfactionScore: number | null;
  postTrainingAdoptionRate: number | null;
}

export interface TrainingSequenceStats {
  customerId: string;
  customerName: string;
  totalSequences: number;
  activeSequences: number;
  completedSequences: number;
  analytics: TrainingAttendanceAnalytics;
  upcomingTrainings: TrainingReminderSequence[];
  recentTrainings: TrainingReminderSequence[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateTrainingSequenceRequest {
  customerId: string;
  customerName: string;
  training: {
    type: TrainingType;
    title: string;
    description?: string;
    scheduledAt: string;
    duration: number;
    timezone?: string;
    attendees: Array<{
      email: string;
      name: string;
      role?: string;
    }>;
    trainer?: {
      name: string;
      email: string;
    };
    calendarEventId?: string;
  };
  materials?: Partial<TrainingMaterials>;
  customReminderTiming?: {
    weekBefore?: boolean;
    threeDaysBefore?: boolean;
    dayBefore?: boolean;
    hourBefore?: boolean;
  };
}

export interface UpdateTrainingSequenceRequest {
  training?: Partial<CreateTrainingSequenceRequest['training']>;
  materials?: Partial<TrainingMaterials>;
  status?: SequenceStatus;
}

export interface UpdateAttendanceRequest {
  attendeeId: string;
  status: 'attended' | 'noShow' | 'rescheduled' | 'partial';
}

export interface TriggerPostTrainingRequest {
  recordingUrl?: string;
  materialsUrl?: string;
  surveyId?: string;
  nextSteps?: string[];
  certificationInfo?: PostTrainingFollowUp['certificationInfo'];
}

export interface TrainingSequenceListResponse {
  success: boolean;
  sequences: TrainingReminderSequence[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TrainingSequenceResponse {
  success: boolean;
  sequence: TrainingReminderSequence;
}

export interface TrainingStatsResponse {
  success: boolean;
  stats: TrainingSequenceStats;
}

// ============================================
// Reminder Email Templates
// ============================================

export interface ReminderEmailContent {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export const REMINDER_TEMPLATES: Record<ReminderType, {
  subjectTemplate: string;
  includePrework: boolean;
  includePrereqs: boolean;
  includeAgenda: boolean;
  includeJoinLink: boolean;
  includeLearningObjectives: boolean;
  tone: 'informational' | 'reminder' | 'urgent';
}> = {
  week: {
    subjectTemplate: 'Training Confirmed: {{title}} - {{date}}',
    includePrework: true,
    includePrereqs: true,
    includeAgenda: true,
    includeJoinLink: false,
    includeLearningObjectives: true,
    tone: 'informational',
  },
  '3day': {
    subjectTemplate: 'Reminder: {{title}} in 3 Days',
    includePrework: true,
    includePrereqs: false,
    includeAgenda: true,
    includeJoinLink: false,
    includeLearningObjectives: true,
    tone: 'reminder',
  },
  '1day': {
    subjectTemplate: 'Tomorrow: {{title}} Training Session',
    includePrework: false,
    includePrereqs: false,
    includeAgenda: true,
    includeJoinLink: true,
    includeLearningObjectives: false,
    tone: 'reminder',
  },
  '1hour': {
    subjectTemplate: 'Starting Soon: {{title}} (1 Hour)',
    includePrework: false,
    includePrereqs: false,
    includeAgenda: false,
    includeJoinLink: true,
    includeLearningObjectives: false,
    tone: 'urgent',
  },
};

// ============================================
// Default Training Materials by Type
// ============================================

export const DEFAULT_MATERIALS_BY_TYPE: Record<TrainingType, Partial<TrainingMaterials>> = {
  onboarding: {
    learningObjectives: [
      'Understand platform navigation and key features',
      'Complete initial setup and configuration',
      'Learn best practices for getting started',
    ],
    questionsToConsider: [
      'What are your primary use cases?',
      'Who are the key stakeholders in your organization?',
      'What does success look like for your team?',
    ],
  },
  feature: {
    learningObjectives: [
      'Master the new feature capabilities',
      'Understand integration points with existing workflows',
      'Learn optimization techniques',
    ],
    questionsToConsider: [
      'How will this feature improve your current processes?',
      'What workflows would benefit most from this feature?',
    ],
  },
  advanced: {
    learningObjectives: [
      'Explore advanced configuration options',
      'Learn power user tips and tricks',
      'Understand API and automation capabilities',
    ],
    questionsToConsider: [
      'What advanced use cases are you looking to implement?',
      'Are there any integrations you want to explore?',
    ],
  },
  certification: {
    learningObjectives: [
      'Demonstrate comprehensive platform knowledge',
      'Pass certification assessment',
      'Earn official certification credentials',
    ],
    questionsToConsider: [
      'Have you completed all prerequisite training?',
      'What areas do you need to review before the exam?',
    ],
  },
  custom: {
    learningObjectives: [],
    questionsToConsider: [],
  },
};
