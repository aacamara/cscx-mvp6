/**
 * PRD-130: Upsell Success Measurement Types
 * TypeScript interfaces for upsell success tracking
 */

// ============================================
// Core Measurement Types
// ============================================

export interface UpsellSuccessMeasurement {
  id: string;
  customerId: string;
  upsellId?: string;
  opportunityId?: string;
  upsellDetails: UpsellDetails;
  successCriteria: SuccessCriteria;
  measurementPlan: MeasurementPlan;
  progress: MeasurementProgress;
  reviews: SuccessReview[];
  outcome: MeasurementOutcome;
  healthScoreBefore?: number;
  healthScoreAfter?: number;
  source: UpsellSource;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsellDetails {
  products: string[];
  arrIncrease: number;
  closeDate: Date;
  salesRep?: string;
}

export type UpsellSource = 'salesforce' | 'manual' | 'api' | 'contract_amendment';

// ============================================
// Success Criteria
// ============================================

export interface SuccessCriteria {
  metrics: SuccessMetric[];
  goals: string[];
  benchmarks: Record<string, number>;
}

export interface SuccessMetric {
  id?: string;
  name: string;
  type: MetricType;
  target: number;
  current?: number;
  baseline?: number;
  unit: string;
  measurement: MeasurementMethod;
  progressPercentage?: number;
  trend?: MetricTrend;
  valueHistory?: MetricHistoryEntry[];
}

export type MetricType = 'usage' | 'adoption' | 'roi' | 'satisfaction';
export type MeasurementMethod = 'automatic' | 'manual';
export type MetricTrend = 'up' | 'down' | 'flat';

export interface MetricHistoryEntry {
  value: number;
  timestamp: Date;
}

// ============================================
// Measurement Plan
// ============================================

export interface MeasurementPlan {
  trackingStart: Date;
  checkpoints: Checkpoint[];
  dashboardUrl?: string;
}

export interface Checkpoint {
  id?: string;
  day: number;
  type: CheckpointType;
  status: CheckpointStatus;
  scheduledDate: Date;
  completedDate?: Date;
  completedBy?: string;
  summary?: string;
  findings?: string[];
  recommendations?: string[];
  actionItems?: ActionItem[];
  documentUrl?: string;
  documentId?: string;
}

export type CheckpointType = 'check' | 'review' | 'assessment';
export type CheckpointStatus = 'pending' | 'completed' | 'skipped' | 'overdue';

export interface ActionItem {
  task: string;
  owner?: string;
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'completed';
}

// ============================================
// Progress Tracking
// ============================================

export interface MeasurementProgress {
  currentStatus: ProgressStatus;
  metricsProgress: MetricProgress[];
  lastUpdated: Date;
}

export type ProgressStatus = 'pending' | 'on_track' | 'at_risk' | 'behind' | 'exceeding';

export interface MetricProgress {
  metricId: string;
  name: string;
  current: number;
  target: number;
  percentage: number;
  trend: MetricTrend;
}

// ============================================
// Success Review
// ============================================

export interface SuccessReview {
  id: string;
  checkpointDay: number;
  reviewDate: Date;
  reviewedBy: string;
  overallAssessment: ProgressStatus;
  metricsSnapshot: MetricProgress[];
  findings: string[];
  recommendations: string[];
  nextSteps: string[];
  documentUrl?: string;
}

// ============================================
// Outcome Documentation
// ============================================

export interface MeasurementOutcome {
  status: OutcomeStatus;
  evidence: string[];
  lessonsLearned: string[];
  documentedAt?: Date;
}

export type OutcomeStatus = 'pending' | 'success' | 'partial' | 'at_risk' | 'failed';

// ============================================
// Feedback & Learning
// ============================================

export interface UpsellFeedback {
  id: string;
  measurementId: string;
  feedbackType: FeedbackType;
  title: string;
  description?: string;
  impactScore?: number;
  confidenceScore?: number;
  productCategory?: string;
  customerSegment?: string;
  actionTaken?: string;
  actionEffective?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type FeedbackType = 'correlation' | 'pattern' | 'risk_indicator' | 'success_factor';

// ============================================
// API Request/Response Types
// ============================================

export interface CreateMeasurementRequest {
  customerId: string;
  opportunityId?: string;
  products: string[];
  arrIncrease: number;
  closeDate: string;
  salesRep?: string;
  goals?: string[];
  source?: UpsellSource;
}

export interface UpdateProgressRequest {
  metrics: Array<{
    metricId: string;
    value: number;
  }>;
}

export interface RecordReviewRequest {
  checkpointDay: number;
  reviewedBy: string;
  overallAssessment: ProgressStatus;
  findings: string[];
  recommendations: string[];
  nextSteps: string[];
  documentUrl?: string;
}

export interface DocumentOutcomeRequest {
  status: OutcomeStatus;
  evidence: string[];
  lessonsLearned: string[];
  healthScoreAfter?: number;
}

export interface MeasurementSummary {
  id: string;
  customerId: string;
  customerName: string;
  customerArr: number;
  products: string[];
  arrIncrease: number;
  closeDate: Date;
  progressStatus: ProgressStatus;
  outcomeStatus: OutcomeStatus;
  daysSinceClose: number;
  completedCheckpoints: number;
  totalCheckpoints: number;
  avgMetricProgress: number;
}

export interface UpcomingCheckpoint {
  id: string;
  measurementId: string;
  customerId: string;
  customerName: string;
  dayNumber: number;
  checkpointType: CheckpointType;
  scheduledDate: Date;
  status: CheckpointStatus;
  products: string[];
  arrIncrease: number;
}

export interface OutcomeAnalysis {
  outcomeStatus: OutcomeStatus;
  count: number;
  avgArrIncrease: number;
  avgHealthChange: number;
  productMix: string[][];
}

// ============================================
// Default Success Templates
// ============================================

export interface SuccessTemplate {
  productCategory: string;
  metrics: SuccessMetric[];
  benchmarks: Record<string, number>;
  checkpointDays: number[];
}

export const DEFAULT_SUCCESS_TEMPLATES: SuccessTemplate[] = [
  {
    productCategory: 'default',
    metrics: [
      {
        name: 'Feature Adoption Rate',
        type: 'adoption',
        target: 80,
        unit: '%',
        measurement: 'automatic',
      },
      {
        name: 'Active Users',
        type: 'usage',
        target: 100,
        unit: 'users',
        measurement: 'automatic',
      },
      {
        name: 'Customer Satisfaction',
        type: 'satisfaction',
        target: 4.5,
        unit: 'rating',
        measurement: 'manual',
      },
      {
        name: 'Time to Value',
        type: 'roi',
        target: 30,
        unit: 'days',
        measurement: 'automatic',
      },
    ],
    benchmarks: {
      industryAdoptionRate: 75,
      industryTimeToValue: 45,
      industryNPS: 50,
    },
    checkpointDays: [30, 60, 90],
  },
  {
    productCategory: 'enterprise',
    metrics: [
      {
        name: 'Feature Adoption Rate',
        type: 'adoption',
        target: 70,
        unit: '%',
        measurement: 'automatic',
      },
      {
        name: 'Active Users',
        type: 'usage',
        target: 500,
        unit: 'users',
        measurement: 'automatic',
      },
      {
        name: 'Executive Engagement',
        type: 'satisfaction',
        target: 4,
        unit: 'meetings/quarter',
        measurement: 'manual',
      },
      {
        name: 'ROI Achievement',
        type: 'roi',
        target: 100,
        unit: '%',
        measurement: 'manual',
      },
    ],
    benchmarks: {
      industryAdoptionRate: 65,
      industryTimeToValue: 60,
      industryNPS: 45,
    },
    checkpointDays: [30, 60, 90, 180],
  },
];
