/**
 * Contract Amendment Needed Alert Types
 * PRD-108: Contract Amendment Needed
 *
 * Types for proactively detecting and alerting when contract amendments
 * may be needed due to usage overages, scope changes, or term modifications.
 *
 * This is distinct from PRD-042 (Contract Amendment Request) which handles
 * the actual amendment workflow. This PRD focuses on detection and alerting.
 */

// ============================================
// Amendment Trigger Types
// ============================================

export type AmendmentAlertTriggerType =
  | 'usage_overage'
  | 'seat_overage'
  | 'storage_overage'
  | 'api_overage'
  | 'out_of_scope_request'
  | 'use_case_change'
  | 'early_renewal_request'
  | 'term_extension_request'
  | 'feature_upgrade_request'
  | 'pricing_adjustment';

export type AmendmentAlertPriority = 'low' | 'medium' | 'high' | 'critical';
export type AmendmentAlertStatus = 'detected' | 'notified' | 'in_progress' | 'resolved' | 'dismissed';

// ============================================
// Overage Details
// ============================================

export interface UsageOverageDetails {
  metricType: 'api_calls' | 'storage' | 'bandwidth' | 'custom';
  contracted: number;
  actual: number;
  overageAmount: number;
  overagePercent: number;
  unit: string;
  persistedMonths?: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface SeatOverageDetails {
  contracted: number;
  actual: number;
  additionalSeats: number;
  recentActiveUsers?: Array<{
    id: string;
    name: string;
    email: string;
    lastActive: string;
  }>;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface ScopeChangeDetails {
  originalScope: string[];
  requestedChanges: string[];
  requestDate: string;
  requestedBy?: string;
  businessJustification?: string;
}

// ============================================
// Amendment Options
// ============================================

export interface AmendmentOption {
  id: string;
  title: string;
  description: string;
  estimatedMonthlyValue: number;
  estimatedAnnualValue: number;
  isRecommended: boolean;
  pros: string[];
  cons: string[];
  nextSteps: string[];
}

// ============================================
// Contract Amendment Alert
// ============================================

export interface ContractAmendmentAlert {
  id: string;
  customerId: string;
  customerName: string;
  triggerType: AmendmentAlertTriggerType;
  priority: AmendmentAlertPriority;
  status: AmendmentAlertStatus;

  // Current situation
  situation: {
    description: string;
    details: UsageOverageDetails | SeatOverageDetails | ScopeChangeDetails | Record<string, any>;
    firstDetectedAt: string;
    persistedDays: number;
  };

  // Contract context
  contract: {
    id?: string;
    currentArr: number;
    contractStart: string;
    contractEnd: string;
    daysUntilRenewal: number;
    currentPlan?: string;
    entitlements?: Array<{
      name: string;
      limit: number;
      currentUsage: number;
    }>;
  };

  // Customer context
  customerContext: {
    healthScore: number;
    relationshipStatus: 'excellent' | 'good' | 'fair' | 'at_risk';
    csmId?: string;
    csmName?: string;
    segment?: string;
    industry?: string;
  };

  // Estimated impact
  impact: {
    estimatedMonthlyValue: number;
    estimatedAnnualValue: number;
    revenueAtRisk?: number;
    complianceRisk?: boolean;
    urgencyScore: number; // 0-100
  };

  // Options for resolution
  options: AmendmentOption[];
  recommendedOptionId?: string;

  // Actions taken
  actions: Array<{
    actionType: 'email_sent' | 'meeting_scheduled' | 'amendment_created' | 'note_added' | 'status_changed';
    performedBy: string;
    performedAt: string;
    details?: Record<string, any>;
  }>;

  // Metadata
  detectedAt: string;
  notifiedAt?: string;
  resolvedAt?: string;
  dismissedAt?: string;
  dismissedBy?: string;
  dismissReason?: string;
  createdBy: 'system' | 'manual';
  notes?: string;
}

// ============================================
// Detection Configuration
// ============================================

export interface AmendmentAlertTriggerConfig {
  type: AmendmentAlertTriggerType;
  enabled: boolean;
  thresholds: {
    overagePercentTrigger: number;  // e.g., 10 for 10%
    persistedDaysTrigger: number;   // e.g., 7 days
    minValueTrigger?: number;       // Minimum estimated value to trigger
  };
  priority: AmendmentAlertPriority;
  notificationChannels: Array<'slack' | 'email' | 'in_app'>;
}

// Default trigger configurations
export const DEFAULT_ALERT_TRIGGERS: AmendmentAlertTriggerConfig[] = [
  {
    type: 'usage_overage',
    enabled: true,
    thresholds: {
      overagePercentTrigger: 10,
      persistedDaysTrigger: 7,
      minValueTrigger: 500,
    },
    priority: 'high',
    notificationChannels: ['slack', 'in_app'],
  },
  {
    type: 'seat_overage',
    enabled: true,
    thresholds: {
      overagePercentTrigger: 0,  // Any overage
      persistedDaysTrigger: 3,
    },
    priority: 'high',
    notificationChannels: ['slack', 'in_app'],
  },
  {
    type: 'api_overage',
    enabled: true,
    thresholds: {
      overagePercentTrigger: 10,
      persistedDaysTrigger: 7,
    },
    priority: 'medium',
    notificationChannels: ['in_app'],
  },
  {
    type: 'storage_overage',
    enabled: true,
    thresholds: {
      overagePercentTrigger: 20,
      persistedDaysTrigger: 14,
    },
    priority: 'medium',
    notificationChannels: ['in_app'],
  },
  {
    type: 'out_of_scope_request',
    enabled: true,
    thresholds: {
      overagePercentTrigger: 0,
      persistedDaysTrigger: 0,
    },
    priority: 'medium',
    notificationChannels: ['slack', 'in_app'],
  },
];

// ============================================
// API Types
// ============================================

export interface ContractAmendmentAlertFilters {
  customerId?: string;
  status?: AmendmentAlertStatus | 'all';
  priority?: AmendmentAlertPriority | 'all';
  triggerType?: AmendmentAlertTriggerType | 'all';
  csmId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'detected_at' | 'priority' | 'estimated_value' | 'customer_name';
  sortOrder?: 'asc' | 'desc';
}

export interface ContractAmendmentAlertSummary {
  total: number;
  byStatus: Record<AmendmentAlertStatus, number>;
  byPriority: Record<AmendmentAlertPriority, number>;
  byTriggerType: Record<AmendmentAlertTriggerType, number>;
  totalEstimatedMonthlyValue: number;
  totalEstimatedAnnualValue: number;
  avgDaysOpen: number;
  criticalCount: number;
}

export interface ContractAmendmentAlertListResponse {
  alerts: ContractAmendmentAlert[];
  summary: ContractAmendmentAlertSummary;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ContractAmendmentAlertAPIResponse {
  success: boolean;
  data: ContractAmendmentAlert | ContractAmendmentAlertListResponse;
  meta: {
    generatedAt: string;
    responseTimeMs: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// Slack Alert Data
// ============================================

export interface ContractAmendmentSlackAlertData {
  alertId: string;
  customerName: string;
  customerId: string;
  amendmentType: AmendmentAlertTriggerType;
  amendmentTypeLabel: string;
  situation: {
    description: string;
    contracted: string;
    actual: string;
    overage: string;
    persistedMonths?: number;
  };
  estimatedValue: {
    monthly: number;
    annual: number;
  };
  customerContext: {
    currentArr: number;
    contractEnd: string;
    healthScore: number;
    daysUntilRenewal: number;
  };
  options: Array<{
    number: number;
    title: string;
    description: string;
  }>;
  csmName?: string;
  frontendUrl: string;
}

// ============================================
// Display Configuration
// ============================================

export const ALERT_TYPE_LABELS: Record<AmendmentAlertTriggerType, string> = {
  usage_overage: 'Usage Overage',
  seat_overage: 'Seat Overage',
  storage_overage: 'Storage Overage',
  api_overage: 'API Overage',
  out_of_scope_request: 'Out of Scope Request',
  use_case_change: 'Use Case Change',
  early_renewal_request: 'Early Renewal Request',
  term_extension_request: 'Term Extension Request',
  feature_upgrade_request: 'Feature Upgrade Request',
  pricing_adjustment: 'Pricing Adjustment',
};

export const ALERT_TYPE_ICONS: Record<AmendmentAlertTriggerType, string> = {
  usage_overage: '\ud83d\udcc8',        // chart increasing
  seat_overage: '\ud83d\udc65',          // busts in silhouette
  storage_overage: '\ud83d\udcbe',       // floppy disk
  api_overage: '\u26a1',                 // zap
  out_of_scope_request: '\ud83d\udccb',  // clipboard
  use_case_change: '\ud83d\udd04',       // counterclockwise arrows
  early_renewal_request: '\u23f0',       // alarm clock
  term_extension_request: '\ud83d\udcc5', // calendar
  feature_upgrade_request: '\u2b06',      // up arrow
  pricing_adjustment: '\ud83d\udcb0',    // money bag
};

export const ALERT_PRIORITY_CONFIG: Record<AmendmentAlertPriority, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}> = {
  low: {
    label: 'Low Priority',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    dotColor: 'bg-blue-500',
  },
  medium: {
    label: 'Medium Priority',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    dotColor: 'bg-yellow-500',
  },
  high: {
    label: 'High Priority',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30',
    dotColor: 'bg-orange-500',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    dotColor: 'bg-red-500',
  },
};

export const ALERT_STATUS_CONFIG: Record<AmendmentAlertStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  detected: {
    label: 'Detected',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  notified: {
    label: 'Notified',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  resolved: {
    label: 'Resolved',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
  },
  dismissed: {
    label: 'Dismissed',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
  },
};
