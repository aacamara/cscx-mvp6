/**
 * Risk Mitigation Types (PRD-136)
 * Types for risk mitigation completion, status updates, and monitoring
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type RiskType = 'save_play' | 'escalation' | 'risk_signal';
export type MitigationOutcome = 'resolved' | 'partially_resolved' | 'unresolved';
export type MonitoringStatus = 'active' | 'stable' | 'recurrence_detected' | 'completed';

// Stability periods by risk type (in days)
export const STABILITY_PERIODS: Record<RiskType, number> = {
  save_play: 30,     // Save plays need longer monitoring
  escalation: 14,    // Escalations monitored for 2 weeks
  risk_signal: 21,   // Risk signals get 3 weeks
};

// Stakeholder notification channels by severity
export type NotificationChannel = 'email' | 'slack' | 'in_app';

export const NOTIFICATION_CHANNELS_BY_SEVERITY: Record<string, NotificationChannel[]> = {
  critical: ['email', 'slack', 'in_app'],
  high: ['email', 'slack', 'in_app'],
  medium: ['email', 'in_app'],
  low: ['in_app'],
};

// ============================================
// CORE INTERFACES
// ============================================

/**
 * Resolution details for a completed mitigation
 */
export interface MitigationResolution {
  summary: string;
  actionsTaken: string[];
  lessonsLearned: string[];
  nextSteps: string[];
}

/**
 * Stakeholder notification record
 */
export interface StakeholderNotification {
  stakeholderId: string;
  stakeholderName: string;
  stakeholderRole: string;
  channel: NotificationChannel;
  sentAt: Date;
  status: 'sent' | 'delivered' | 'failed';
}

/**
 * Health score update record
 */
export interface HealthScoreUpdate {
  previousScore: number;
  newScore: number;
  signalRemoved: boolean;
  changeReason: string;
  components?: {
    usage: number;
    engagement: number;
    risk: number;
    business: number;
  };
}

/**
 * Post-mitigation monitoring settings
 */
export interface MitigationMonitoring {
  stabilityPeriod: number;        // Days to monitor
  monitoringEndDate: Date;        // When monitoring ends
  recurrenceDetected: boolean;    // Has issue returned
  recurrenceDate?: Date;          // When recurrence detected
  recurrenceDetails?: string;     // Description of recurrence
  checkpoints: MonitoringCheckpoint[];
}

/**
 * Monitoring checkpoint (periodic health check)
 */
export interface MonitoringCheckpoint {
  id: string;
  scheduledAt: Date;
  completedAt?: Date;
  status: 'pending' | 'completed' | 'missed';
  healthScore?: number;
  notes?: string;
}

/**
 * Full risk mitigation completion record
 */
export interface RiskMitigationCompletion {
  id: string;
  riskId: string;
  customerId: string;
  customerName: string;
  riskType: RiskType;
  originalSeverity: 'critical' | 'high' | 'medium' | 'low';
  outcome: MitigationOutcome;
  resolution: MitigationResolution;
  notifications: {
    recipients: StakeholderNotification[];
    sentAt: Date;
    totalSent: number;
    totalDelivered: number;
  };
  healthUpdate: HealthScoreUpdate;
  monitoring: MitigationMonitoring;
  completedAt: Date;
  completedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

/**
 * Request to complete a risk mitigation
 */
export interface CompleteMitigationRequest {
  riskId: string;
  customerId: string;
  riskType: RiskType;
  outcome: MitigationOutcome;
  resolution: {
    summary: string;
    actionsTaken: string[];
    lessonsLearned?: string[];
    nextSteps?: string[];
  };
  notifyStakeholders?: boolean;
  stakeholderIds?: string[];
}

/**
 * Response from completing a mitigation
 */
export interface CompleteMitigationResponse {
  success: boolean;
  mitigation: RiskMitigationCompletion;
  healthUpdate: HealthScoreUpdate;
  notificationsSent: number;
}

/**
 * Request to log a recurrence
 */
export interface LogRecurrenceRequest {
  mitigationId: string;
  details: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  shouldEscalate?: boolean;
}

/**
 * Response from logging a recurrence
 */
export interface LogRecurrenceResponse {
  success: boolean;
  mitigation: RiskMitigationCompletion;
  escalationCreated?: boolean;
  escalationId?: string;
}

/**
 * Filters for listing resolved mitigations
 */
export interface ResolvedMitigationFilters {
  customerId?: string;
  riskType?: RiskType | RiskType[];
  outcome?: MitigationOutcome | MitigationOutcome[];
  completedAfter?: Date;
  completedBefore?: Date;
  monitoringActive?: boolean;
  hasRecurrence?: boolean;
}

/**
 * Paginated list response
 */
export interface ResolvedMitigationListResponse {
  mitigations: RiskMitigationCompletion[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Status update that was generated
 */
export interface GeneratedStatusUpdate {
  id: string;
  mitigationId: string;
  customerId: string;
  customerName: string;
  title: string;
  summary: string;
  sections: {
    resolution: string;
    actionsTaken: string;
    outcome: string;
    healthImpact: string;
    nextSteps?: string;
  };
  recipients: Array<{
    name: string;
    email: string;
    role: string;
  }>;
  createdAt: Date;
}

// ============================================
// DASHBOARD TYPES
// ============================================

/**
 * Summary metrics for risk mitigation dashboard
 */
export interface RiskMitigationMetrics {
  totalResolved: {
    last7Days: number;
    last30Days: number;
    last90Days: number;
  };
  byOutcome: {
    resolved: number;
    partiallyResolved: number;
    unresolved: number;
  };
  byRiskType: {
    savePlay: number;
    escalation: number;
    riskSignal: number;
  };
  averageTimeToResolution: {
    overall: number;  // in hours
    byType: Record<RiskType, number>;
  };
  healthScoreImpact: {
    avgImprovement: number;
    totalCustomersImproved: number;
  };
  activeMonitoring: number;
  recurrenceRate: number;
}

/**
 * Customer mitigation history entry
 */
export interface CustomerMitigationHistory {
  customerId: string;
  customerName: string;
  totalMitigations: number;
  successRate: number;
  averageResolutionTime: number;
  recentMitigations: Array<{
    id: string;
    riskType: RiskType;
    outcome: MitigationOutcome;
    completedAt: Date;
    healthDelta: number;
  }>;
}

// ============================================
// TIMELINE TYPES
// ============================================

/**
 * Timeline event for customer activity log
 */
export interface MitigationTimelineEvent {
  id: string;
  type: 'mitigation_started' | 'mitigation_completed' | 'status_update_sent' | 'health_recalculated' | 'recurrence_detected' | 'monitoring_completed';
  mitigationId: string;
  customerId: string;
  timestamp: Date;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// NOTIFICATION TEMPLATES
// ============================================

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject?: string;  // For email
  body: string;
  variables: string[];  // e.g., ['customerName', 'resolution', 'healthScore']
}

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'mitigation_complete_email',
    name: 'Mitigation Complete Email',
    channel: 'email',
    subject: 'Risk Mitigation Resolved: {{customerName}}',
    body: `
The risk mitigation for {{customerName}} has been resolved.

**Resolution Summary**
{{resolutionSummary}}

**Actions Taken**
{{actionsTaken}}

**Outcome**
{{outcome}}

**Health Score Update**
Previous: {{previousScore}} | Current: {{newScore}} ({{delta}})

{{nextSteps}}
`,
    variables: ['customerName', 'resolutionSummary', 'actionsTaken', 'outcome', 'previousScore', 'newScore', 'delta', 'nextSteps'],
  },
  {
    id: 'mitigation_complete_slack',
    name: 'Mitigation Complete Slack',
    channel: 'slack',
    body: `:white_check_mark: *Risk Mitigation Resolved: {{customerName}}*\n\n{{resolutionSummary}}\n\nHealth: {{previousScore}} -> {{newScore}} ({{delta}})`,
    variables: ['customerName', 'resolutionSummary', 'previousScore', 'newScore', 'delta'],
  },
];
