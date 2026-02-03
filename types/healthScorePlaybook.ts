/**
 * Health Score Playbook Types
 * PRD-118: Health Score Change -> Playbook Selection
 *
 * Types for automatic playbook recommendations when health scores change
 */

// ============================================
// Health Score Change Types
// ============================================

export type HealthScoreChangeType =
  | 'critical_drop'    // Drop > 10 points in 7 days
  | 'warning_drop'     // Drop > 5 points in 7 days
  | 'improvement'      // Increase > 15 points in 30 days
  | 'threshold_crossed'; // Score crosses boundary (e.g., 70->65)

export type HealthScoreZone = 'green' | 'yellow' | 'red';

export type HealthScoreTrend = 'declining' | 'stable' | 'improving';

// ============================================
// Health Score Component Change
// ============================================

export interface HealthScoreComponentChange {
  previous: number;
  current: number;
  change: number;
}

// ============================================
// Contributing Factor
// ============================================

export type ContributingFactorType =
  | 'usage_decline'
  | 'engagement_drop'
  | 'sentiment_negative'
  | 'no_login'
  | 'support_escalation'
  | 'champion_departure'
  | 'contract_concern'
  | 'renewal_risk'
  | 'nps_drop'
  | 'feature_non_adoption';

export interface ContributingFactor {
  type: ContributingFactorType;
  severity: 'high' | 'medium' | 'low';
  description: string;
  metric?: string;
  metricChange?: number;
  detectedAt: string;
}

// ============================================
// Health Score Change Event
// ============================================

export interface HealthScoreChangeEvent {
  id: string;
  customerId: string;
  customerName: string;
  previousScore: number;
  currentScore: number;
  changeAmount: number;
  changePeriodDays: number;
  changeType: HealthScoreChangeType;
  previousZone: HealthScoreZone;
  currentZone: HealthScoreZone;
  trend: HealthScoreTrend;
  components: {
    usage: HealthScoreComponentChange;
    engagement: HealthScoreComponentChange;
    sentiment: HealthScoreComponentChange;
  };
  contributingFactors: ContributingFactor[];
  detectedAt: string;
  customerContext: {
    arr: number;
    segment: string;
    renewalDate: string | null;
    daysToRenewal: number | null;
    csmId: string | null;
    lastContactDays: number | null;
  };
}

// ============================================
// Playbook Types
// ============================================

export type PlaybookMatchType = 'save' | 'engagement' | 'expansion' | 'intervention';

export interface PlaybookOption {
  id: string;
  name: string;
  type: PlaybookMatchType;
  description: string;
  matchScore: number;
  matchReason: string;
  estimatedDuration: string;
  successRate: number | null;
}

// ============================================
// Action Item
// ============================================

export interface PlaybookActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dueInDays: number;
  type: 'email' | 'meeting' | 'call' | 'task' | 'document';
}

// ============================================
// Playbook Recommendation
// ============================================

export type RecommendationStatus = 'pending' | 'accepted' | 'modified' | 'rejected' | 'expired';

export interface PlaybookRecommendation {
  id: string;
  changeEventId: string;
  customerId: string;
  customerName: string;
  recommendedPlaybook: PlaybookOption;
  alternativePlaybooks: PlaybookOption[];
  firstActions: PlaybookActionItem[];
  expectedOutcome: string;
  timeCommitment: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  status: RecommendationStatus;
  csmResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
  expiresAt: string;
}

// ============================================
// Playbook Initiation
// ============================================

export interface PlaybookInitiation {
  recommendationId: string;
  playbookId: string;
  executionId: string;
  customerId: string;
  initiatedAt: string;
  initiatedBy: string;
  modifications: string[];
  firstTasks: Array<{
    id: string;
    title: string;
    dueDate: string;
    assignee: string;
  }>;
  milestones: Array<{
    name: string;
    targetDate: string;
  }>;
}

// ============================================
// Notification Types
// ============================================

export type NotificationChannel = 'in_app' | 'slack' | 'email';

export interface HealthScoreNotification {
  id: string;
  changeEventId: string;
  customerId: string;
  customerName: string;
  channel: NotificationChannel;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  actionUrl: string;
  sentAt: string;
  readAt: string | null;
  recipientId: string;
  recipientType: 'csm' | 'manager';
}

// ============================================
// Escalation
// ============================================

export type EscalationReason =
  | 'critical_health_score'  // Below 40
  | 'multiple_drops'         // Multiple consecutive drops
  | 'high_arr_risk'          // High-ARR customer affected
  | 'renewal_imminent';      // Near renewal with low health

export interface HealthScoreEscalation {
  id: string;
  changeEventId: string;
  customerId: string;
  customerName: string;
  reason: EscalationReason;
  description: string;
  escalatedTo: string;
  escalatedBy: string;
  escalatedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolution: string | null;
}

// ============================================
// API Request/Response Types
// ============================================

export interface GetHealthChangesRequest {
  customerId?: string;
  changeType?: HealthScoreChangeType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface GetHealthChangesResponse {
  changes: HealthScoreChangeEvent[];
  total: number;
  hasMore: boolean;
}

export interface GetRecommendationRequest {
  changeEventId: string;
  customerId: string;
}

export interface RecommendPlaybookRequest {
  changeEventId: string;
  customerId: string;
  customerContext?: {
    recentInteractions?: string[];
    csmNotes?: string;
  };
}

export interface RespondToRecommendationRequest {
  recommendationId: string;
  action: 'accept' | 'modify' | 'reject';
  modifications?: {
    playbookId?: string;
    actionChanges?: Array<{
      actionId: string;
      change: 'skip' | 'delay' | 'modify';
      newValue?: any;
    }>;
  };
  reason?: string;
}

export interface StartPlaybookRequest {
  recommendationId: string;
  customizations?: {
    variables?: Record<string, any>;
    skipActions?: string[];
    additionalNotes?: string;
  };
}

// ============================================
// Health Score History Entry
// ============================================

export interface HealthScoreHistoryEntry {
  id: string;
  customerId: string;
  score: number;
  usageScore: number;
  engagementScore: number;
  sentimentScore: number;
  calculatedAt: string;
  source: 'scheduled' | 'manual' | 'event_triggered';
  metadata?: Record<string, any>;
}

// ============================================
// Monitoring Configuration
// ============================================

export interface HealthScoreMonitoringConfig {
  criticalDropThreshold: number;    // Default: 10 points in 7 days
  warningDropThreshold: number;     // Default: 5 points in 7 days
  improvementThreshold: number;     // Default: 15 points in 30 days
  criticalScoreThreshold: number;   // Default: 40
  highArrThreshold: number;         // Default: 100000
  escalationEnabled: boolean;
  notificationChannels: NotificationChannel[];
  cooldownMinutes: number;          // Default: 60
}

// ============================================
// Dashboard Stats
// ============================================

export interface HealthScorePlaybookStats {
  period: string;
  totalChangesDetected: number;
  criticalDrops: number;
  warningDrops: number;
  improvements: number;
  recommendationsMade: number;
  recommendationsAccepted: number;
  recommendationsRejected: number;
  playbooksStarted: number;
  avgResponseTimeHours: number;
  healthRecoveryRate: number;
}
