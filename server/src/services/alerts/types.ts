/**
 * Intelligent Alert Filtering Types (PRD-221)
 *
 * Types for AI-powered alert scoring, filtering, bundling, and feedback
 */

// ============================================
// Alert Types
// ============================================

export type AlertType =
  | 'health_score_drop'
  | 'health_score_critical'
  | 'usage_drop'
  | 'usage_spike'
  | 'renewal_approaching'
  | 'engagement_drop'
  | 'champion_left'
  | 'nps_detractor'
  | 'support_escalation'
  | 'contract_expiring'
  | 'expansion_signal'
  | 'adoption_stalled'
  | 'invoice_overdue'
  | 'stakeholder_inactive'
  | 'custom';

export type DeliveryRecommendation = 'immediate' | 'digest' | 'suppress';

export type AlertFeedbackType = 'helpful' | 'not_helpful' | 'already_knew' | 'false_positive';

export type AlertStatus = 'unread' | 'read' | 'actioned' | 'dismissed' | 'snoozed';

// ============================================
// Raw Alert (Input)
// ============================================

export interface RawAlert {
  id: string;
  type: AlertType;
  customerId: string;
  customerName?: string;
  title: string;
  description: string;
  metricChange?: {
    metric: string;
    previousValue: number;
    currentValue: number;
    changePercent: number;
  };
  metadata?: Record<string, unknown>;
  source?: string;
  createdAt: Date;
}

// ============================================
// Alert Context (For Scoring)
// ============================================

export interface AlertContext {
  customer: {
    id: string;
    name: string;
    arr: number;
    healthScore: number;
    status: 'active' | 'onboarding' | 'at_risk' | 'churned';
    renewalDate?: Date;
    daysToRenewal?: number;
    tier?: 'enterprise' | 'growth' | 'starter';
  };
  recentAlerts: ScoredAlert[];
  activePlaybooks: string[];
  hasActiveSavePlay: boolean;
  seasonalPatterns?: {
    metric: string;
    expectedVariance: number;
  }[];
}

// ============================================
// Score Factor (Explainability)
// ============================================

export interface ScoreFactor {
  factor: string;
  weight: number;
  value: number;
  contribution: number;
  explanation: string;
}

// ============================================
// Alert Score (Output)
// ============================================

export interface AlertScore {
  rawAlertId: string;
  impactScore: number;      // 0-100 business impact
  urgencyScore: number;     // 0-100 time sensitivity
  confidenceScore: number;  // 0-100 signal reliability
  finalScore: number;       // Weighted combination
  factors: ScoreFactor[];
  deliveryRecommendation: DeliveryRecommendation;
  filtered: boolean;
  filterReason?: string;
}

// ============================================
// Scored Alert
// ============================================

export interface ScoredAlert extends RawAlert {
  score: AlertScore;
  status: AlertStatus;
  userId?: string;
  readAt?: Date;
  actionedAt?: Date;
  snoozeUntil?: Date;
}

// ============================================
// Alert Bundle
// ============================================

export interface AlertBundle {
  bundleId: string;
  customerId: string;
  customerName: string;
  alerts: ScoredAlert[];
  bundleScore: number;
  title: string;
  summary: string;
  recommendedAction: string;
  alertCount: number;
  createdAt: Date;
  status: AlertStatus;
}

// ============================================
// Alert Feedback
// ============================================

export interface AlertFeedback {
  id: string;
  alertId: string;
  bundleId?: string;
  userId: string;
  feedback: AlertFeedbackType;
  notes?: string;
  createdAt: Date;
}

// ============================================
// Alert Suppression Rule
// ============================================

export interface AlertSuppression {
  id: string;
  userId: string;
  suppressionType: 'customer' | 'alert_type' | 'threshold' | 'pattern';
  customerId?: string;
  alertType?: AlertType;
  reason: string;
  expiresAt?: Date;
  createdAt: Date;
}

// ============================================
// User Alert Preferences
// ============================================

export interface AlertPreferences {
  userId: string;
  immediateThreshold: number;  // Score >= this: immediate
  digestThreshold: number;     // Score >= this (but < immediate): digest
  suppressThreshold: number;   // Score < this: suppress

  quietHoursEnabled: boolean;
  quietHoursStart?: string;    // e.g., "18:00"
  quietHoursEnd?: string;      // e.g., "08:00"
  allowCriticalDuringQuiet: boolean;
  criticalThreshold: number;   // Score >= this: breaks quiet hours

  filterMinorHealthChanges: boolean;
  minorHealthChangeThreshold: number;  // Points (e.g., 10)
  filterSeasonalPatterns: boolean;
  filterActivePlaybooks: boolean;

  updatedAt: Date;
}

// ============================================
// Alert Summary Stats
// ============================================

export interface AlertSummaryStats {
  totalAlerts: number;
  priorityCount: number;
  digestCount: number;
  suppressedCount: number;
  byType: Record<AlertType, number>;
  byCustomer: Record<string, number>;
  averageScore: number;
  feedbackStats: {
    helpful: number;
    notHelpful: number;
    alreadyKnew: number;
    falsePositive: number;
  };
}

// ============================================
// API Request/Response Types
// ============================================

export interface GetAlertsRequest {
  format?: 'bundled' | 'individual';
  minScore?: number;
  status?: AlertStatus;
  customerId?: string;
  types?: AlertType[];
  limit?: number;
  offset?: number;
}

export interface GetAlertsResponse {
  bundles?: AlertBundle[];
  alerts?: ScoredAlert[];
  suppressedCount: number;
  digestCount: number;
  totalCount: number;
}

export interface SubmitFeedbackRequest {
  feedback: AlertFeedbackType;
  notes?: string;
}

export interface UpdatePreferencesRequest extends Partial<Omit<AlertPreferences, 'userId' | 'updatedAt'>> {}

// ============================================
// Default Preferences
// ============================================

export const DEFAULT_ALERT_PREFERENCES: Omit<AlertPreferences, 'userId'> = {
  immediateThreshold: 75,
  digestThreshold: 50,
  suppressThreshold: 50,

  quietHoursEnabled: false,
  quietHoursStart: '18:00',
  quietHoursEnd: '08:00',
  allowCriticalDuringQuiet: true,
  criticalThreshold: 90,

  filterMinorHealthChanges: true,
  minorHealthChangeThreshold: 10,
  filterSeasonalPatterns: true,
  filterActivePlaybooks: true,

  updatedAt: new Date(),
};
