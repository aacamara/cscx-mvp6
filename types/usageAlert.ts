/**
 * Usage Alert Types (PRD-086)
 *
 * Types for the usage drop alert system that detects significant
 * usage drops and triggers check-in workflows.
 */

// ============================================
// Alert Types
// ============================================

export type UsageMetricType =
  | 'dau'           // Daily Active Users
  | 'wau'           // Weekly Active Users
  | 'mau'           // Monthly Active Users
  | 'feature_usage' // Feature-specific usage
  | 'login_frequency'
  | 'total_events';

export type AlertSeverity = 'medium' | 'high' | 'critical';

export type AlertStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';

export interface UsageAlert {
  id: string;
  customerId: string;
  customerName: string;
  metricType: UsageMetricType;
  previousValue: number;
  currentValue: number;
  percentDrop: number;
  severity: AlertSeverity;
  status: AlertStatus;
  comparisonPeriod: string;
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  workflowTriggered: boolean;
  taskId?: string;
  draftEmailId?: string;
  customer?: {
    arr: number;
    healthScore: number;
    csmName?: string;
    primaryContact?: {
      name: string;
      email: string;
      title?: string;
    };
    segment?: string;
    daysToRenewal?: number;
  };
}

// ============================================
// Alert Configuration
// ============================================

export interface AlertThresholds {
  dau: number;
  wau: number;
  mau: number;
  featureUsage: number;
  loginFrequency: number;
  totalEvents: number;
}

export interface AlertConfiguration {
  id: string;
  name: string;
  segment?: string; // Customer segment this config applies to
  thresholds: AlertThresholds;
  minimumBaseline: number;
  cooldownDays: number;
  excludeWeekends: boolean;
  autoTriggerWorkflow: boolean;
  slackNotifications: boolean;
  emailNotifications: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  dau: 30,   // 30% drop triggers alert
  wau: 30,
  mau: 30,
  featureUsage: 50,
  loginFrequency: 50,
  totalEvents: 30,
};

export const SEVERITY_THRESHOLDS = {
  medium: { min: 30, max: 49 },
  high: { min: 50, max: 69 },
  critical: { min: 70, max: 100 },
};

// ============================================
// API Request/Response Types
// ============================================

export interface UsageAlertFilters {
  status?: AlertStatus | 'all';
  severity?: AlertSeverity | 'all';
  metricType?: UsageMetricType | 'all';
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface UsageAlertListResponse {
  success: boolean;
  alerts: UsageAlert[];
  total: number;
  summary: {
    open: number;
    acknowledged: number;
    inProgress: number;
    resolved: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
    };
    totalArrAtRisk: number;
  };
}

export interface AlertActionResponse {
  success: boolean;
  alert?: UsageAlert;
  message?: string;
  error?: string;
}

export interface WorkflowTriggerResponse {
  success: boolean;
  workflowId?: string;
  steps?: Array<{
    stepName: string;
    success: boolean;
    error?: string;
  }>;
  error?: string;
}

export interface DetectionRunResponse {
  success: boolean;
  processed: number;
  alertsGenerated: number;
  results: Array<{
    customerId: string;
    customerName: string;
    alertsCount: number;
    skipped: boolean;
    skipReason?: string;
  }>;
}

// ============================================
// Dashboard Summary Types
// ============================================

export interface UsageAlertSummary {
  totalOpen: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  totalArrAtRisk: number;
  avgPercentDrop: number;
  trendVsLastWeek: number;
  topAffectedMetric: UsageMetricType;
  alertsByDay: Array<{
    date: string;
    count: number;
    severity: AlertSeverity;
  }>;
  recentAlerts: UsageAlert[];
}

// ============================================
// Workflow Types
// ============================================

export interface CheckInWorkflowStep {
  id: string;
  name: string;
  type: 'slack_notify' | 'create_task' | 'draft_email' | 'update_health_score' | 'log_activity';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

export interface CheckInWorkflow {
  id: string;
  alertId: string;
  customerId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  steps: CheckInWorkflowStep[];
  startedAt: string;
  completedAt?: string;
  triggeredBy: 'automatic' | 'manual';
}

// ============================================
// UI State Types
// ============================================

export interface UsageAlertDashboardState {
  alerts: UsageAlert[];
  loading: boolean;
  error: string | null;
  selectedAlertId: string | null;
  filters: UsageAlertFilters;
  summary: UsageAlertSummary | null;
  configurations: AlertConfiguration[];
}

export type UsageAlertAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ALERTS'; payload: UsageAlert[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SELECT_ALERT'; payload: string | null }
  | { type: 'SET_FILTERS'; payload: Partial<UsageAlertFilters> }
  | { type: 'SET_SUMMARY'; payload: UsageAlertSummary }
  | { type: 'UPDATE_ALERT'; payload: UsageAlert }
  | { type: 'SET_CONFIGURATIONS'; payload: AlertConfiguration[] };

// ============================================
// Utility Functions
// ============================================

export function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return 'red';
    case 'high': return 'orange';
    case 'medium': return 'yellow';
  }
}

export function getSeverityBgClass(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
  }
}

export function getSeverityTextClass(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return 'text-red-400';
    case 'high': return 'text-orange-400';
    case 'medium': return 'text-yellow-400';
  }
}

export function getSeverityBgLightClass(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/20';
    case 'high': return 'bg-orange-500/20';
    case 'medium': return 'bg-yellow-500/20';
  }
}

export function getStatusBadgeClass(status: AlertStatus): string {
  switch (status) {
    case 'open': return 'bg-red-500/20 text-red-400';
    case 'acknowledged': return 'bg-yellow-500/20 text-yellow-400';
    case 'in_progress': return 'bg-blue-500/20 text-blue-400';
    case 'resolved': return 'bg-green-500/20 text-green-400';
    case 'dismissed': return 'bg-gray-500/20 text-gray-400';
  }
}

export function getMetricTypeLabel(metricType: UsageMetricType): string {
  switch (metricType) {
    case 'dau': return 'Daily Active Users';
    case 'wau': return 'Weekly Active Users';
    case 'mau': return 'Monthly Active Users';
    case 'feature_usage': return 'Feature Usage';
    case 'login_frequency': return 'Login Frequency';
    case 'total_events': return 'Total Events';
  }
}

export function formatPercentDrop(percentDrop: number): string {
  return `${Math.abs(percentDrop).toFixed(0)}%`;
}

export function calculateDueDateHours(severity: AlertSeverity): number {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 12;
    case 'medium': return 24;
  }
}
