/**
 * Daily Summary Types
 * PRD-150: End of Day -> Daily Summary
 *
 * Provides automated end-of-day summaries for CSMs
 */
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
export interface DailySummary {
    id: string;
    csmId: string;
    date: string;
    timezone: string;
    accomplishments: {
        tasksCompleted: TaskRef[];
        meetingsHeld: MeetingSummary[];
        emailsSent: number;
        callsMade: number;
        documentsCreated: string[];
        issuesResolved: string[];
    };
    tomorrow: {
        meetings: MeetingPreview[];
        tasksDue: TaskRef[];
        deadlines: Deadline[];
        reminders: Reminder[];
    };
    attention: {
        overdueTasks: TaskRef[];
        missedFollowUps: FollowUp[];
        alerts: Alert[];
        pendingApprovals: ApprovalRef[];
        unansweredEmails: EmailRef[];
    };
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
    metrics: {
        customerTouches: number;
        avgResponseTime: number;
        taskCompletionRate: number;
        meetingEffectiveness?: number;
        vsAverage: {
            customerTouches: number;
            taskCompletionRate: number;
            responseTime: number;
        };
    };
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
export interface WeeklySummary {
    id: string;
    csmId: string;
    weekStartDate: string;
    weekEndDate: string;
    timezone: string;
    accomplishments: {
        totalTasksCompleted: number;
        totalMeetingsHeld: number;
        totalEmailsSent: number;
        totalCallsMade: number;
        highlights: string[];
    };
    comparison: {
        tasksCompleted: {
            current: number;
            previous: number;
            change: number;
        };
        customerTouches: {
            current: number;
            previous: number;
            change: number;
        };
        avgResponseTime: {
            current: number;
            previous: number;
            change: number;
        };
        taskCompletionRate: {
            current: number;
            previous: number;
            change: number;
        };
    };
    goals?: {
        goalId: string;
        title: string;
        target: number;
        current: number;
        progress: number;
    }[];
    nextWeek: {
        scheduledMeetings: number;
        tasksDue: number;
        renewals: RenewalPreview[];
        deadlines: Deadline[];
    };
    createdAt: string;
}
export interface DailySummarySettings {
    userId: string;
    enabled: boolean;
    schedule: {
        time: string;
        timezone: string;
        skipWeekends: boolean;
        skipHolidays: boolean;
    };
    delivery: {
        email: boolean;
        slack: boolean;
        inApp: boolean;
        slackChannelId?: string;
    };
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
export interface TriggerSummaryRequest {
    userId: string;
    date?: string;
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
//# sourceMappingURL=dailySummary.d.ts.map