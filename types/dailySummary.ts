/**
 * Daily Summary Types
 * PRD-150: End of Day -> Daily Summary
 *
 * Provides automated end-of-day summaries for CSMs
 */

// ============================================
// Core Data Types
// ============================================

export interface TaskRef {
  id: string;
  title: string;
  customerId?: string;
  customerName?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  completedAt?: string;
}

export interface MeetingSummary {
  id: string;
  title: string;
  customerId?: string;
  customerName?: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  outcome?: string;
  notes?: string;
}

export interface MeetingPreview {
  id: string;
  title: string;
  customerId?: string;
  customerName?: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  prepRequired?: boolean;
}

export interface Deadline {
  id: string;
  title: string;
  customerId?: string;
  customerName?: string;
  dueDate: string;
  type: 'renewal' | 'milestone' | 'task' | 'other';
  daysUntilDue: number;
}

export interface Reminder {
  id: string;
  title: string;
  customerId?: string;
  customerName?: string;
  reminderDate: string;
  type: 'follow_up' | 'check_in' | 'renewal' | 'custom';
}

export interface FollowUp {
  id: string;
  title: string;
  customerId?: string;
  customerName?: string;
  originalDate: string;
  daysOverdue: number;
}

export interface Alert {
  id: string;
  type: 'health_drop' | 'churn_risk' | 'engagement_drop' | 'support_escalation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  customerId?: string;
  customerName?: string;
  detectedAt: string;
}

export interface ApprovalRef {
  id: string;
  type: string;
  title: string;
  customerId?: string;
  customerName?: string;
  requestedAt: string;
  requestedBy?: string;
}

export interface EmailRef {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  customerId?: string;
  customerName?: string;
  receivedAt: string;
  daysUnanswered: number;
}

export interface CustomerRef {
  id: string;
  name: string;
  healthScore: number;
  healthColor: 'green' | 'yellow' | 'red';
  arr: number;
  reason: string;
}

export interface RenewalPreview {
  id: string;
  customerName: string;
  customerId: string;
  renewalDate: string;
  daysUntilRenewal: number;
  arr: number;
  healthScore: number;
  healthColor: 'green' | 'yellow' | 'red';
  status?: 'pending' | 'in_progress' | 'at_risk';
}

// ============================================
// Daily Summary Data Model
// ============================================

export interface DailySummary {
  id: string;
  csmId: string;
  date: string; // ISO date string YYYY-MM-DD
  timezone: string;

  // FR-2: Today's Accomplishments
  accomplishments: {
    tasksCompleted: TaskRef[];
    meetingsHeld: MeetingSummary[];
    emailsSent: number;
    callsMade: number;
    documentsCreated: string[];
    issuesResolved: string[];
  };

  // FR-3: Tomorrow's Preview
  tomorrow: {
    meetings: MeetingPreview[];
    tasksDue: TaskRef[];
    deadlines: Deadline[];
    reminders: Reminder[];
  };

  // FR-4: Attention Required
  attention: {
    overdueTasks: TaskRef[];
    missedFollowUps: FollowUp[];
    alerts: Alert[];
    pendingApprovals: ApprovalRef[];
    unansweredEmails: EmailRef[];
  };

  // FR-5: Portfolio Health Snapshot
  portfolio: {
    totalCustomers: number;
    healthDistribution: {
      green: number;
      yellow: number;
      red: number;
    };
    needingAttention: CustomerRef[];
    riskSignals: number;
    upcomingRenewals: RenewalPreview[];
  };

  // FR-6: Key Metrics
  metrics: {
    customerTouches: number;
    avgResponseTime: number; // in hours
    taskCompletionRate: number; // percentage 0-100
    meetingEffectiveness?: number; // percentage 0-100
    vsAverage: {
      customerTouches: number; // percentage vs avg, e.g., +15 or -10
      taskCompletionRate: number;
      responseTime: number;
    };
  };

  // FR-7: Delivery tracking
  delivery: {
    channels: ('email' | 'slack' | 'in_app')[];
    sentAt: string | null;
    viewedAt: string | null;
    emailId?: string;
    slackTs?: string;
  };

  createdAt: string;
  updatedAt: string;
}

// ============================================
// Weekly Summary (FR-8)
// ============================================

export interface WeeklySummary {
  id: string;
  csmId: string;
  weekStartDate: string; // ISO date string (Monday)
  weekEndDate: string; // ISO date string (Sunday)
  timezone: string;

  // Week's accomplishments
  accomplishments: {
    totalTasksCompleted: number;
    totalMeetingsHeld: number;
    totalEmailsSent: number;
    totalCallsMade: number;
    highlights: string[];
  };

  // Comparison with previous week
  comparison: {
    tasksCompleted: { current: number; previous: number; change: number };
    customerTouches: { current: number; previous: number; change: number };
    avgResponseTime: { current: number; previous: number; change: number };
    taskCompletionRate: { current: number; previous: number; change: number };
  };

  // Goals progress
  goals?: {
    goalId: string;
    title: string;
    target: number;
    current: number;
    progress: number; // percentage
  }[];

  // Next week preview
  nextWeek: {
    scheduledMeetings: number;
    tasksDue: number;
    renewals: RenewalPreview[];
    deadlines: Deadline[];
  };

  createdAt: string;
}

// ============================================
// Summary Settings
// ============================================

export interface DailySummarySettings {
  userId: string;
  enabled: boolean;

  // FR-1: Schedule configuration
  schedule: {
    time: string; // HH:mm format, e.g., "17:00"
    timezone: string; // e.g., "America/New_York"
    skipWeekends: boolean;
    skipHolidays: boolean;
  };

  // FR-7: Delivery preferences
  delivery: {
    email: boolean;
    slack: boolean;
    inApp: boolean;
    slackChannelId?: string; // For DM, this is the DM channel
  };

  // Content preferences
  content: {
    showMetrics: boolean;
    showPortfolioHealth: boolean;
    showWeeklyComparison: boolean;
    maxCustomersNeedingAttention: number;
    maxUpcomingRenewals: number;
    maxOverdueTasks: number;
  };

  createdAt: string;
  updatedAt: string;
}

// ============================================
// API Types
// ============================================

export interface TriggerSummaryRequest {
  userId: string;
  date?: string; // Optional, defaults to today
  delivery?: ('email' | 'slack' | 'in_app')[];
  forceRefresh?: boolean;
}

export interface TriggerSummaryResponse {
  success: boolean;
  summaryId: string;
  summary: DailySummary;
  deliveryResults: {
    email: boolean;
    slack: boolean;
    inApp: boolean;
  };
}

export interface UpdateSettingsRequest {
  enabled?: boolean;
  schedule?: Partial<DailySummarySettings['schedule']>;
  delivery?: Partial<DailySummarySettings['delivery']>;
  content?: Partial<DailySummarySettings['content']>;
}

export interface GetSummaryResponse {
  success: boolean;
  summary: DailySummary | null;
}

export interface GetWeeklySummaryResponse {
  success: boolean;
  summary: WeeklySummary | null;
}
