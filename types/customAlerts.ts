/**
 * Custom Alert Configuration Types
 * PRD-080: Types for custom alert rules
 */

// ============================================
// Metric Types
// ============================================

export type AlertMetricType =
  | 'health_score'
  | 'usage'
  | 'engagement'
  | 'nps'
  | 'support_tickets'
  | 'feature_adoption'
  | 'login_activity'
  | 'contract_value'
  | 'days_to_renewal'
  | 'custom';

export type AlertComparisonOperator =
  | 'below'
  | 'above'
  | 'equals'
  | 'drops_by'
  | 'increases_by'
  | 'changes_by';

export type AlertUrgency = 'low' | 'medium' | 'high' | 'critical';

export type NotificationChannel = 'email' | 'slack' | 'in_app' | 'webhook';

export type AlertRuleType = 'system' | 'custom' | 'template';

export type AlertTargetType = 'customer' | 'segment' | 'portfolio';

// ============================================
// Alert Rule
// ============================================

export interface CustomAlertRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  enabled: boolean;
  ruleType: AlertRuleType;

  // Target configuration
  target: {
    type: AlertTargetType;
    customerId?: string;  // For customer-specific alerts
    customerName?: string;
    segmentId?: string;   // For segment-based alerts
    segmentName?: string;
    filters?: Record<string, any>;  // Additional filtering criteria
  };

  // Condition configuration
  condition: {
    metric: AlertMetricType;
    metricLabel?: string;  // Human-readable label for custom metrics
    operator: AlertComparisonOperator;
    threshold: number;
    currentValue?: number;  // Populated when fetching
    unit?: string;  // e.g., '%', 'days', 'count'
  };

  // Notification configuration
  notification: {
    channels: NotificationChannel[];
    urgency: AlertUrgency;
    messageTemplate?: string;  // Custom message template with placeholders
    recipients?: string[];  // Additional email recipients
    slackChannel?: string;  // Specific Slack channel
    webhookUrl?: string;  // For webhook notifications
  };

  // Timing configuration
  timing: {
    cooldownMinutes: number;  // Minimum time between alerts
    maxFiresPerDay: number;   // Maximum alerts per day
    activeHoursOnly?: boolean;  // Only fire during business hours
    timezone?: string;
  };

  // Template reference
  templateId?: string;

  // Stats
  lastFiredAt?: Date;
  fireCount: number;
  lastValue?: number;

  // Metadata
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Alert Event
// ============================================

export interface AlertEvent {
  id: string;
  alertRuleId: string;
  alertRuleName: string;
  customerId: string;
  customerName: string;
  metric: AlertMetricType;
  previousValue?: number;
  currentValue: number;
  threshold: number;
  operator: AlertComparisonOperator;
  urgency: AlertUrgency;
  notificationsSent: Array<{
    channel: NotificationChannel;
    success: boolean;
    sentAt: Date;
    error?: string;
  }>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  firedAt: Date;
}

// ============================================
// Alert Templates
// ============================================

export interface AlertTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  metric: AlertMetricType;
  defaultOperator: AlertComparisonOperator;
  defaultThreshold: number;
  defaultUrgency: AlertUrgency;
  defaultCooldownMinutes: number;
  suggestedActions?: string[];
  isSystem: boolean;
}

// ============================================
// Alert Summary
// ============================================

export interface AlertSummary {
  totalRules: number;
  activeRules: number;
  alertsFiredToday: number;
  alertsFiredWeek: number;
  byUrgency: Record<AlertUrgency, number>;
  byMetric: Record<AlertMetricType, number>;
  topTriggeredRules: Array<{
    ruleId: string;
    ruleName: string;
    fireCount: number;
  }>;
}

// ============================================
// Create/Update DTOs
// ============================================

export interface CreateAlertRuleDTO {
  name: string;
  description?: string;
  targetType: AlertTargetType;
  customerId?: string;
  segmentId?: string;
  metric: AlertMetricType;
  operator: AlertComparisonOperator;
  threshold: number;
  channels: NotificationChannel[];
  urgency: AlertUrgency;
  cooldownMinutes?: number;
  maxFiresPerDay?: number;
  messageTemplate?: string;
  templateId?: string;
}

export interface UpdateAlertRuleDTO {
  name?: string;
  description?: string;
  enabled?: boolean;
  threshold?: number;
  channels?: NotificationChannel[];
  urgency?: AlertUrgency;
  cooldownMinutes?: number;
  maxFiresPerDay?: number;
  messageTemplate?: string;
}

// ============================================
// Metric Definitions
// ============================================

export const ALERT_METRICS: Record<AlertMetricType, {
  label: string;
  description: string;
  unit: string;
  defaultThreshold: number;
  supportedOperators: AlertComparisonOperator[];
}> = {
  health_score: {
    label: 'Health Score',
    description: 'Overall customer health score (0-100)',
    unit: '%',
    defaultThreshold: 60,
    supportedOperators: ['below', 'above', 'drops_by', 'increases_by']
  },
  usage: {
    label: 'Usage',
    description: 'Product usage metrics',
    unit: '%',
    defaultThreshold: 50,
    supportedOperators: ['below', 'above', 'drops_by', 'increases_by', 'changes_by']
  },
  engagement: {
    label: 'Engagement',
    description: 'Customer engagement score',
    unit: '%',
    defaultThreshold: 40,
    supportedOperators: ['below', 'above', 'drops_by']
  },
  nps: {
    label: 'NPS Score',
    description: 'Net Promoter Score (-100 to 100)',
    unit: '',
    defaultThreshold: 0,
    supportedOperators: ['below', 'above', 'drops_by', 'equals']
  },
  support_tickets: {
    label: 'Support Tickets',
    description: 'Open support ticket count',
    unit: 'tickets',
    defaultThreshold: 5,
    supportedOperators: ['above', 'increases_by']
  },
  feature_adoption: {
    label: 'Feature Adoption',
    description: 'Key feature adoption rate',
    unit: '%',
    defaultThreshold: 30,
    supportedOperators: ['below', 'drops_by']
  },
  login_activity: {
    label: 'Login Activity',
    description: 'Days since last login',
    unit: 'days',
    defaultThreshold: 14,
    supportedOperators: ['above']
  },
  contract_value: {
    label: 'Contract Value',
    description: 'Annual recurring revenue',
    unit: 'USD',
    defaultThreshold: 100000,
    supportedOperators: ['above', 'below']
  },
  days_to_renewal: {
    label: 'Days to Renewal',
    description: 'Days until contract renewal',
    unit: 'days',
    defaultThreshold: 90,
    supportedOperators: ['below', 'equals']
  },
  custom: {
    label: 'Custom Metric',
    description: 'User-defined metric',
    unit: '',
    defaultThreshold: 0,
    supportedOperators: ['below', 'above', 'equals', 'drops_by', 'increases_by', 'changes_by']
  }
};

// ============================================
// Default Templates
// ============================================

export const DEFAULT_ALERT_TEMPLATES: AlertTemplate[] = [
  {
    id: 'tpl-health-drop',
    name: 'Health Score Drop',
    description: 'Alert when health score drops below threshold',
    category: 'Health',
    metric: 'health_score',
    defaultOperator: 'below',
    defaultThreshold: 60,
    defaultUrgency: 'high',
    defaultCooldownMinutes: 1440,
    suggestedActions: [
      'Review recent customer activity',
      'Schedule check-in call',
      'Analyze support tickets'
    ],
    isSystem: true
  },
  {
    id: 'tpl-usage-drop',
    name: 'Usage Drop',
    description: 'Alert when usage drops significantly',
    category: 'Engagement',
    metric: 'usage',
    defaultOperator: 'drops_by',
    defaultThreshold: 20,
    defaultUrgency: 'medium',
    defaultCooldownMinutes: 1440,
    suggestedActions: [
      'Check for technical issues',
      'Review user feedback',
      'Offer training session'
    ],
    isSystem: true
  },
  {
    id: 'tpl-nps-detractor',
    name: 'NPS Detractor Alert',
    description: 'Alert when NPS falls into detractor range',
    category: 'Satisfaction',
    metric: 'nps',
    defaultOperator: 'below',
    defaultThreshold: 7,
    defaultUrgency: 'critical',
    defaultCooldownMinutes: 60,
    suggestedActions: [
      'Immediate outreach to understand concerns',
      'Escalate to leadership if needed',
      'Create recovery plan'
    ],
    isSystem: true
  },
  {
    id: 'tpl-support-spike',
    name: 'Support Ticket Spike',
    description: 'Alert on high support ticket volume',
    category: 'Support',
    metric: 'support_tickets',
    defaultOperator: 'above',
    defaultThreshold: 5,
    defaultUrgency: 'high',
    defaultCooldownMinutes: 240,
    suggestedActions: [
      'Review ticket themes',
      'Coordinate with support team',
      'Consider proactive outreach'
    ],
    isSystem: true
  },
  {
    id: 'tpl-renewal-approaching',
    name: 'Renewal Approaching',
    description: 'Alert when renewal date is near',
    category: 'Renewal',
    metric: 'days_to_renewal',
    defaultOperator: 'below',
    defaultThreshold: 90,
    defaultUrgency: 'medium',
    defaultCooldownMinutes: 10080,
    suggestedActions: [
      'Review account health',
      'Prepare renewal proposal',
      'Schedule renewal discussion'
    ],
    isSystem: true
  },
  {
    id: 'tpl-no-login',
    name: 'No Login Activity',
    description: 'Alert when customer has not logged in',
    category: 'Engagement',
    metric: 'login_activity',
    defaultOperator: 'above',
    defaultThreshold: 14,
    defaultUrgency: 'medium',
    defaultCooldownMinutes: 1440,
    suggestedActions: [
      'Send re-engagement email',
      'Check for technical issues',
      'Offer refresher training'
    ],
    isSystem: true
  },
  {
    id: 'tpl-adoption-stalled',
    name: 'Feature Adoption Stalled',
    description: 'Alert when feature adoption is low',
    category: 'Adoption',
    metric: 'feature_adoption',
    defaultOperator: 'below',
    defaultThreshold: 30,
    defaultUrgency: 'medium',
    defaultCooldownMinutes: 2880,
    suggestedActions: [
      'Schedule product walkthrough',
      'Share success stories',
      'Identify adoption blockers'
    ],
    isSystem: true
  }
];

// ============================================
// Urgency Configuration
// ============================================

export const URGENCY_CONFIG: Record<AlertUrgency, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  defaultCooldown: number;
}> = {
  low: {
    label: 'Low',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    defaultCooldown: 10080  // 7 days
  },
  medium: {
    label: 'Medium',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    defaultCooldown: 1440  // 24 hours
  },
  high: {
    label: 'High',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30',
    defaultCooldown: 240  // 4 hours
  },
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    defaultCooldown: 60  // 1 hour
  }
};

// ============================================
// Operator Labels
// ============================================

export const OPERATOR_LABELS: Record<AlertComparisonOperator, string> = {
  below: 'drops below',
  above: 'exceeds',
  equals: 'equals',
  drops_by: 'drops by',
  increases_by: 'increases by',
  changes_by: 'changes by'
};
