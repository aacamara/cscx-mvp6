/**
 * PRD-100: Login Pattern Change Types
 *
 * Type definitions for login pattern detection and alerting system.
 * Used to detect and alert on changes in user login behavior.
 */
export type LoginFrequency = 'daily' | 'weekly' | 'monthly' | 'inactive';
export type PatternChangeType = 'downgraded' | 'stopped' | 'resumed' | 'improved';
export type LoginPatternAlertType = 'individual_downgrade' | 'individual_stopped' | 'power_user_disengagement' | 'account_level_decline' | 'bulk_downgrade';
export type LoginPatternAlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type LoginPatternAlertStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';
export interface UserLoginPattern {
    id: string;
    customerId: string;
    userId: string;
    userEmail?: string;
    userName?: string;
    userRole?: string;
    isPowerUser: boolean;
    historicalFrequency: LoginFrequency;
    currentFrequency: LoginFrequency;
    lastLoginAt: Date | null;
    daysSinceLogin: number;
    loginCount30d: number;
    loginCount7d: number;
    patternChangedAt: Date | null;
    patternChangeType: PatternChangeType | null;
    avgLoginsPerWeekHistorical: number;
    avgLoginsPerWeekCurrent: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface AffectedUserDetail {
    userId: string;
    name: string;
    email?: string;
    role?: string;
    isPowerUser: boolean;
    previousFrequency: LoginFrequency;
    currentFrequency: LoginFrequency;
    lastLogin: string;
    daysSinceLogin: number;
}
export interface AccountLoginMetrics {
    previousAvgLoginsPerWeek: number;
    currentAvgLoginsPerWeek: number;
    changePercent: number;
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    powerUsersAffected: number;
}
export interface LoginPatternAccountContext {
    arr?: number;
    healthScore?: number;
    renewalDate?: string;
    daysToRenewal?: number;
    csmName?: string;
    segment?: string;
    recentChanges?: string[];
}
export interface SuggestedAction {
    type: 'send_email' | 'schedule_call' | 'create_task' | 'slack_notify';
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    template?: string;
}
export interface LoginPatternAlert {
    id: string;
    customerId: string;
    customerName?: string;
    alertType: LoginPatternAlertType;
    severity: LoginPatternAlertSeverity;
    status: LoginPatternAlertStatus;
    totalUsers: number;
    affectedUsers: number;
    previousAvgLoginsPerWeek: number;
    currentAvgLoginsPerWeek: number;
    changePercent: number;
    affectedUserDetails: AffectedUserDetail[];
    accountContext: LoginPatternAccountContext;
    suggestedActions: SuggestedAction[];
    resolvedAt: Date | null;
    resolutionNotes?: string;
    detectedAt: Date;
    cooldownExpiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface LoginPatternDetectionConfig {
    accountDeclineThreshold?: number;
    inactiveDaysThreshold?: number;
    cooldownDays?: number;
    excludeNewUsers?: boolean;
    newUserDays?: number;
    minimumBaseline?: number;
    includePowerUsersOnly?: boolean;
    excludeWeekends?: boolean;
    excludeHolidays?: boolean;
}
export interface LoginPatternDetectionResult {
    customerId: string;
    customerName: string;
    alerts: LoginPatternAlert[];
    usersAnalyzed: number;
    patternsChanged: number;
    skipped: boolean;
    skipReason?: string;
}
export interface BulkDetectionResult {
    processed: number;
    alertsGenerated: number;
    results: LoginPatternDetectionResult[];
}
export interface UserLoginAnalysis {
    userId: string;
    loginDates: Date[];
    lookbackDays: number;
}
export interface LoginPatternAnalysis {
    historicalCategory: LoginFrequency;
    currentCategory: LoginFrequency;
    historicalLoginsPerWeek: number;
    currentLoginsPerWeek: number;
    changeDetected: boolean;
    changeType: PatternChangeType | null;
    severity: LoginPatternAlertSeverity;
}
export interface LoginPatternSlackMetadata {
    patternType: 'login_frequency_downgrade' | 'login_stopped' | 'account_decline';
    accountLevelChange: boolean;
    totalUsers: number;
    affectedUsers: number;
    users: Array<{
        userId: string;
        name: string;
        role?: string;
        isPowerUser: boolean;
        previousFrequency: LoginFrequency;
        currentFrequency: LoginFrequency;
        lastLogin: string;
    }>;
    accountMetrics: {
        previousAvgLoginsPerWeek: number;
        currentAvgLoginsPerWeek: number;
        changePercent: number;
    };
}
export interface LoginPatternRiskSignalMetadata {
    pattern_type: string;
    account_level_change: boolean;
    total_users: number;
    affected_users: number;
    users: AffectedUserDetail[];
    account_metrics: AccountLoginMetrics;
}
export interface DetectLoginPatternsRequest {
    customerId?: string;
    config?: LoginPatternDetectionConfig;
}
export interface DetectLoginPatternsResponse {
    success: boolean;
    customerId?: string;
    customerName?: string;
    alertsCount: number;
    alerts: LoginPatternAlert[];
    skipped?: boolean;
    skipReason?: string;
}
export interface GetLoginPatternsRequest {
    customerId: string;
    includeInactive?: boolean;
    powerUsersOnly?: boolean;
    limit?: number;
}
export interface GetLoginPatternsResponse {
    success: boolean;
    customerId: string;
    patterns: UserLoginPattern[];
    summary: {
        totalUsers: number;
        dailyUsers: number;
        weeklyUsers: number;
        monthlyUsers: number;
        inactiveUsers: number;
        powerUsers: number;
        avgLoginsPerWeek: number;
    };
}
export interface ResolveAlertRequest {
    resolutionNotes?: string;
}
export interface TriggerWorkflowRequest {
    alertId: string;
    slackWebhookUrl?: string;
    sendCheckInEmail?: boolean;
}
export interface LoginPatternEventData {
    alertType: LoginPatternAlertType;
    severity: LoginPatternAlertSeverity;
    affectedUsers: number;
    totalUsers: number;
    changePercent: number;
    affectedUserDetails: AffectedUserDetail[];
    accountMetrics: AccountLoginMetrics;
}
//# sourceMappingURL=loginPattern.d.ts.map