/**
 * Quiet Account Alert Types
 * PRD-106: Detect and alert on accounts with extended silence
 *
 * Monitors for accounts lacking meaningful CSM interaction:
 * - Meetings, emails, support tickets, CSM notes
 * - Segment-specific thresholds (Enterprise: 21d, Mid-Market: 30d, SMB: 45d)
 * - Escalation at 60+ days of silence
 */
export type InteractionType = 'meeting' | 'email_sent' | 'email_received' | 'support_ticket' | 'csm_note' | 'call' | 'qbr';
export interface LastInteraction {
    type: InteractionType;
    date: string;
    daysAgo: number;
    subject?: string;
    participants?: string[];
    summary?: string;
}
export interface EngagementTrackingRecord {
    id: string;
    customerId: string;
    lastMeetingAt: string | null;
    lastEmailSentAt: string | null;
    lastEmailReceivedAt: string | null;
    lastSupportTicketAt: string | null;
    lastCsmNoteAt: string | null;
    lastMeaningfulInteractionAt: string | null;
    quietSince: string | null;
    quietDays: number;
    quietAlertSentAt: string | null;
    reEngagedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export type CustomerSegment = 'enterprise' | 'mid-market' | 'smb' | 'startup';
export type QuietSeverity = 'warning' | 'elevated' | 'critical';
export type QuietAccountStatus = 'active' | 'quiet' | 're_engaged' | 'excluded';
export interface QuietThresholds {
    enterprise: number;
    'mid-market': number;
    smb: number;
    startup: number;
    escalation: number;
}
export declare const DEFAULT_QUIET_THRESHOLDS: QuietThresholds;
export interface QuietAccountContext {
    arr: number;
    healthScore: number;
    segment: CustomerSegment;
    daysToRenewal: number | null;
    usageStatus: 'active' | 'declining' | 'inactive';
    loginStatus: 'regular' | 'sporadic' | 'inactive';
}
export interface QuietAccountAlert {
    id: string;
    customerId: string;
    customerName: string;
    quietDays: number;
    severity: QuietSeverity;
    threshold: number;
    lastActivities: LastInteraction[];
    context: QuietAccountContext;
    interpretation: string;
    suggestedActions: string[];
    alertSentAt: string;
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
    reEngagedAt: string | null;
    createdAt: string;
}
export interface ReEngagementSuggestion {
    type: 'email' | 'meeting' | 'call' | 'value_summary';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    template?: string;
    conversationStarters?: string[];
}
export interface CheckInEmailDraft {
    to: string;
    subject: string;
    body: string;
    tone: 'friendly' | 'professional' | 'urgent';
    personalization: {
        lastTouchpoint: string;
        accountContext: string;
        valueReminder: string;
    };
}
export interface QuietAccountFilters {
    severity?: QuietSeverity;
    segment?: CustomerSegment;
    minQuietDays?: number;
    maxQuietDays?: number;
    csmId?: string;
    includeExcluded?: boolean;
    sortBy?: 'quiet_days' | 'arr' | 'renewal_date' | 'health_score';
    sortOrder?: 'asc' | 'desc';
}
export interface QuietAccountSummary {
    totalQuietAccounts: number;
    bySegment: Record<CustomerSegment, number>;
    bySeverity: Record<QuietSeverity, number>;
    totalArrAtRisk: number;
    avgQuietDays: number;
    reEngagedThisWeek: number;
    reEngagedThisMonth: number;
}
export interface QuietAccountsResponse {
    accounts: QuietAccountAlert[];
    summary: QuietAccountSummary;
    timestamp: string;
}
export interface QuietAccountDetailResponse {
    alert: QuietAccountAlert;
    engagementHistory: LastInteraction[];
    reEngagementSuggestions: ReEngagementSuggestion[];
    draftCheckInEmail: CheckInEmailDraft | null;
}
export interface QuietAccountEventData {
    customerId: string;
    customerName: string;
    quietDays: number;
    threshold: number;
    severity: QuietSeverity;
    segment: CustomerSegment;
    lastInteraction: LastInteraction | null;
    arr: number;
    healthScore: number;
    daysToRenewal: number | null;
}
export interface QuietAccountConfig {
    thresholds: QuietThresholds;
    excludedStages: string[];
    excludedReasons: string[];
    alertSchedule: string;
    enableSlackAlerts: boolean;
    enableEmailAlerts: boolean;
    autoCreateTasks: boolean;
    taskDueDateOffsetDays: number;
}
export declare const DEFAULT_QUIET_ACCOUNT_CONFIG: QuietAccountConfig;
//# sourceMappingURL=quietAccount.d.ts.map