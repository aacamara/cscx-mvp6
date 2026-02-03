/**
 * Recent Changes Alert Types
 * PRD-073: Real-time alerts and consolidated view of account changes
 */

// ============================================
// Change Types and Severity
// ============================================

export type ChangeType =
  // Health & Risk
  | 'health_score_drop'
  | 'health_score_improvement'
  | 'new_risk_signal'
  | 'risk_signal_resolved'
  // Stakeholder
  | 'champion_departed'
  | 'exec_sponsor_change'
  | 'new_decision_maker'
  | 'contact_info_updated'
  // Usage
  | 'usage_drop'
  | 'usage_spike'
  | 'no_login'
  | 'feature_abandoned'
  | 'feature_adopted'
  // Contract
  | 'renewal_approaching'
  | 'contract_amended'
  | 'expansion_opportunity'
  | 'payment_overdue'
  // Support
  | 'support_ticket_spike'
  | 'support_ticket_resolved'
  // Engagement
  | 'engagement_drop'
  | 'meeting_cancelled'
  | 'meeting_scheduled';

export type ChangeSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ChangeSentiment = 'positive' | 'negative' | 'neutral';
export type AlertChannel = 'push' | 'email' | 'slack' | 'in_app';

// ============================================
// Core Interfaces
// ============================================

export interface AccountChange {
  id: string;
  customerId: string;
  customerName: string;
  changeType: ChangeType;
  severity: ChangeSeverity;
  sentiment: ChangeSentiment;

  // Change details
  title: string;
  description: string;
  previousValue: string | number | null;
  newValue: string | number | null;
  changePercent: number | null;

  // Context
  detectedAt: string;
  source: string;
  relatedEntity: string | null;

  // Response tracking
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  actionTaken: string | null;
}

export interface ChangeAlert {
  change: AccountChange;
  channels: AlertChannel[];
  priority: number;
  expiresAt: string;
  actionRequired: boolean;
  suggestedActions: string[];
}

// ============================================
// Summary and Statistics
// ============================================

export interface ChangeSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  unacknowledged: number;
}

export interface ChangeTrend {
  week: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  netSentiment: 'positive' | 'negative' | 'neutral';
}

export interface ChangeCorrelation {
  sequence: Array<{
    changeType: ChangeType;
    date: string;
    description: string;
  }>;
  hypothesis: string;
  recommendation: string;
}

// ============================================
// Alert Preferences
// ============================================

export interface AlertThreshold {
  enabled: boolean;
  threshold: number;
  channels: AlertChannel[];
}

export interface AlertPreferences {
  customerId: string;
  healthDrop: AlertThreshold;
  usageChange: AlertThreshold;
  championActivity: AlertThreshold;
  supportTickets: AlertThreshold;
  renewalReminder: AlertThreshold;
}

// ============================================
// API Request/Response Types
// ============================================

export interface GetChangesRequest {
  customerId: string;
  period?: '7d' | '14d' | '30d' | '90d';
  severity?: ChangeSeverity | 'all';
  acknowledged?: boolean;
  changeTypes?: ChangeType[];
}

export interface GetChangesResponse {
  summary: ChangeSummary;
  changes: AccountChange[];
  trends: ChangeTrend[];
  correlations: ChangeCorrelation | null;
  alertPreferences: AlertPreferences;
}

export interface AcknowledgeChangeRequest {
  changeId: string;
  actionTaken?: string;
}

export interface UpdateAlertPreferencesRequest {
  customerId: string;
  preferences: Partial<AlertPreferences>;
}

// ============================================
// Change Detection Configuration
// ============================================

export interface ChangeDetectionConfig {
  changeType: ChangeType;
  severity: ChangeSeverity;
  sentimentMapping: ChangeSentiment;
  thresholds: {
    trigger: number;
    critical?: number;
    high?: number;
    medium?: number;
  };
  channels: AlertChannel[];
  actionRequired: boolean;
}

export const CHANGE_DETECTION_CONFIG: Record<string, ChangeDetectionConfig> = {
  // Health Score Changes
  health_score_drop_critical: {
    changeType: 'health_score_drop',
    severity: 'critical',
    sentimentMapping: 'negative',
    thresholds: { trigger: 20, critical: 20, high: 10, medium: 5 },
    channels: ['push', 'email', 'slack'],
    actionRequired: true,
  },
  health_score_drop_high: {
    changeType: 'health_score_drop',
    severity: 'high',
    sentimentMapping: 'negative',
    thresholds: { trigger: 10, high: 10, medium: 5 },
    channels: ['push', 'slack'],
    actionRequired: true,
  },
  health_score_drop_medium: {
    changeType: 'health_score_drop',
    severity: 'medium',
    sentimentMapping: 'negative',
    thresholds: { trigger: 5, medium: 5 },
    channels: ['slack'],
    actionRequired: false,
  },

  // Stakeholder Changes
  champion_departed: {
    changeType: 'champion_departed',
    severity: 'critical',
    sentimentMapping: 'negative',
    thresholds: { trigger: 1 },
    channels: ['push', 'email', 'slack'],
    actionRequired: true,
  },
  exec_sponsor_change: {
    changeType: 'exec_sponsor_change',
    severity: 'high',
    sentimentMapping: 'negative',
    thresholds: { trigger: 1 },
    channels: ['push', 'slack'],
    actionRequired: true,
  },

  // Usage Changes
  usage_drop_critical: {
    changeType: 'usage_drop',
    severity: 'critical',
    sentimentMapping: 'negative',
    thresholds: { trigger: 40, critical: 40, high: 20 },
    channels: ['push', 'email'],
    actionRequired: true,
  },
  usage_drop_high: {
    changeType: 'usage_drop',
    severity: 'high',
    sentimentMapping: 'negative',
    thresholds: { trigger: 20, high: 20 },
    channels: ['push'],
    actionRequired: true,
  },
  no_login: {
    changeType: 'no_login',
    severity: 'high',
    sentimentMapping: 'negative',
    thresholds: { trigger: 30 },
    channels: ['push'],
    actionRequired: true,
  },

  // Contract Changes
  renewal_approaching_critical: {
    changeType: 'renewal_approaching',
    severity: 'critical',
    sentimentMapping: 'neutral',
    thresholds: { trigger: 30, critical: 30, high: 60, medium: 90 },
    channels: ['push', 'email'],
    actionRequired: true,
  },
  payment_overdue: {
    changeType: 'payment_overdue',
    severity: 'high',
    sentimentMapping: 'negative',
    thresholds: { trigger: 1 },
    channels: ['push', 'email'],
    actionRequired: true,
  },
};

// ============================================
// Helper Functions
// ============================================

export const getSeverityColor = (severity: ChangeSeverity): string => {
  switch (severity) {
    case 'critical': return 'red';
    case 'high': return 'orange';
    case 'medium': return 'yellow';
    case 'low': return 'gray';
  }
};

export const getSentimentIcon = (sentiment: ChangeSentiment): string => {
  switch (sentiment) {
    case 'positive': return '+';
    case 'negative': return '-';
    case 'neutral': return '=';
  }
};

export const formatChangeType = (changeType: ChangeType): string => {
  return changeType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
