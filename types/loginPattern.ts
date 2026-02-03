/**
 * PRD-100: Login Pattern Change Types
 *
 * Type definitions for login pattern detection and alerting system.
 * Used to detect and alert on changes in user login behavior.
 */

// ============================================
// Login Frequency Types
// ============================================

export type LoginFrequency = 'daily' | 'weekly' | 'monthly' | 'inactive';

export type PatternChangeType = 'downgraded' | 'stopped' | 'resumed' | 'improved';

export type LoginPatternAlertType =
  | 'individual_downgrade'      // Single user frequency downgrade
  | 'individual_stopped'        // Single user stopped logging in (14+ days)
  | 'power_user_disengagement' // Power user reducing activity
  | 'account_level_decline'    // Overall account login decline >30%
  | 'bulk_downgrade';          // Multiple users downgraded

export type LoginPatternAlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type LoginPatternAlertStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';

// ============================================
// User Login Pattern
// ============================================

export interface UserLoginPattern {
  id: string;
  customerId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  isPowerUser: boolean;

  // Frequency tracking
  historicalFrequency: LoginFrequency;
  currentFrequency: LoginFrequency;

  // Login metrics
  lastLoginAt: Date | null;
  daysSinceLogin: number;
  loginCount30d: number;
  loginCount7d: number;

  // Pattern change
  patternChangedAt: Date | null;
  patternChangeType: PatternChangeType | null;

  // Averages
  avgLoginsPerWeekHistorical: number;
  avgLoginsPerWeekCurrent: number;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Affected User Details (for alerts)
// ============================================

export interface AffectedUserDetail {
  userId: string;
  name: string;
  email?: string;
  role?: string;
  isPowerUser: boolean;
  previousFrequency: LoginFrequency;
  currentFrequency: LoginFrequency;
  lastLogin: string; // ISO date string
  daysSinceLogin: number;
}

// ============================================
// Account Metrics
// ============================================

export interface AccountLoginMetrics {
  previousAvgLoginsPerWeek: number;
  currentAvgLoginsPerWeek: number;
  changePercent: number;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  powerUsersAffected: number;
}

// ============================================
// Account Context
// ============================================

export interface LoginPatternAccountContext {
  arr?: number;
  healthScore?: number;
  renewalDate?: string;
  daysToRenewal?: number;
  csmName?: string;
  segment?: string;
  recentChanges?: string[];
}

// ============================================
// Suggested Action
// ============================================

export interface SuggestedAction {
  type: 'send_email' | 'schedule_call' | 'create_task' | 'slack_notify';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  template?: string;
}

// ============================================
// Login Pattern Alert
// ============================================

export interface LoginPatternAlert {
  id: string;
  customerId: string;
  customerName?: string;
  alertType: LoginPatternAlertType;
  severity: LoginPatternAlertSeverity;
  status: LoginPatternAlertStatus;

  // Metrics
  totalUsers: number;
  affectedUsers: number;
  previousAvgLoginsPerWeek: number;
  currentAvgLoginsPerWeek: number;
  changePercent: number;

  // Details
  affectedUserDetails: AffectedUserDetail[];
  accountContext: LoginPatternAccountContext;
  suggestedActions: SuggestedAction[];

  // Resolution
  resolvedAt: Date | null;
  resolutionNotes?: string;

  // Timing
  detectedAt: Date;
  cooldownExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Detection Configuration
// ============================================

export interface LoginPatternDetectionConfig {
  // Thresholds
  accountDeclineThreshold?: number;      // Default: 30 (30% decline triggers alert)
  inactiveDaysThreshold?: number;        // Default: 14 days
  cooldownDays?: number;                 // Default: 7 days between alerts

  // Filters
  excludeNewUsers?: boolean;             // Default: true (exclude users < 30 days old)
  newUserDays?: number;                  // Default: 30
  minimumBaseline?: number;              // Default: 5 logins in baseline period
  includePowerUsersOnly?: boolean;       // Default: false

  // Options
  excludeWeekends?: boolean;             // Default: false
  excludeHolidays?: boolean;             // Default: false
}

// ============================================
// Detection Results
// ============================================

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

// ============================================
// Login Analysis
// ============================================

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

// ============================================
// Slack Alert Metadata
// ============================================

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

// ============================================
// Risk Signal Metadata (for risk_signals table)
// ============================================

export interface LoginPatternRiskSignalMetadata {
  pattern_type: string;
  account_level_change: boolean;
  total_users: number;
  affected_users: number;
  users: AffectedUserDetail[];
  account_metrics: AccountLoginMetrics;
}

// ============================================
// API Request/Response Types
// ============================================

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

// ============================================
// Event Types (for trigger engine)
// ============================================

export interface LoginPatternEventData {
  alertType: LoginPatternAlertType;
  severity: LoginPatternAlertSeverity;
  affectedUsers: number;
  totalUsers: number;
  changePercent: number;
  affectedUserDetails: AffectedUserDetail[];
  accountMetrics: AccountLoginMetrics;
}
