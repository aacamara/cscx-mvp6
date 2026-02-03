/**
 * Onboarding Progress Report Types
 * PRD-162: Onboarding Progress Tracking and Reporting
 *
 * Provides types for:
 * - Onboarding stages and progress tracking
 * - Funnel visualization and metrics
 * - Time-to-value analysis
 * - Stuck customer detection
 */

// ============================================
// Onboarding Stage Definitions
// ============================================

export enum OnboardingStage {
  CONTRACT_SIGNED = 'contract_signed',
  KICKOFF_SCHEDULED = 'kickoff_scheduled',
  KICKOFF_COMPLETED = 'kickoff_completed',
  TECHNICAL_SETUP = 'technical_setup',
  DATA_MIGRATION = 'data_migration',
  TRAINING_SCHEDULED = 'training_scheduled',
  TRAINING_COMPLETED = 'training_completed',
  FIRST_USE = 'first_use',
  VALUE_REALIZED = 'value_realized',
  ONBOARDING_COMPLETE = 'onboarding_complete'
}

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';

// Expected duration in days for each stage
export const STAGE_EXPECTED_DURATIONS: Record<OnboardingStage, number> = {
  [OnboardingStage.CONTRACT_SIGNED]: 0,
  [OnboardingStage.KICKOFF_SCHEDULED]: 2,
  [OnboardingStage.KICKOFF_COMPLETED]: 1,
  [OnboardingStage.TECHNICAL_SETUP]: 5,
  [OnboardingStage.DATA_MIGRATION]: 7,
  [OnboardingStage.TRAINING_SCHEDULED]: 2,
  [OnboardingStage.TRAINING_COMPLETED]: 3,
  [OnboardingStage.FIRST_USE]: 3,
  [OnboardingStage.VALUE_REALIZED]: 5,
  [OnboardingStage.ONBOARDING_COMPLETE]: 0
};

// Stage display names
export const STAGE_DISPLAY_NAMES: Record<OnboardingStage, string> = {
  [OnboardingStage.CONTRACT_SIGNED]: 'Contract Signed',
  [OnboardingStage.KICKOFF_SCHEDULED]: 'Kickoff Scheduled',
  [OnboardingStage.KICKOFF_COMPLETED]: 'Kickoff Completed',
  [OnboardingStage.TECHNICAL_SETUP]: 'Technical Setup',
  [OnboardingStage.DATA_MIGRATION]: 'Data Migration',
  [OnboardingStage.TRAINING_SCHEDULED]: 'Training Scheduled',
  [OnboardingStage.TRAINING_COMPLETED]: 'Training Completed',
  [OnboardingStage.FIRST_USE]: 'First Use',
  [OnboardingStage.VALUE_REALIZED]: 'Value Realized',
  [OnboardingStage.ONBOARDING_COMPLETE]: 'Onboarding Complete'
};

// Stage order for funnel progression
export const STAGE_ORDER: OnboardingStage[] = [
  OnboardingStage.CONTRACT_SIGNED,
  OnboardingStage.KICKOFF_SCHEDULED,
  OnboardingStage.KICKOFF_COMPLETED,
  OnboardingStage.TECHNICAL_SETUP,
  OnboardingStage.DATA_MIGRATION,
  OnboardingStage.TRAINING_SCHEDULED,
  OnboardingStage.TRAINING_COMPLETED,
  OnboardingStage.FIRST_USE,
  OnboardingStage.VALUE_REALIZED,
  OnboardingStage.ONBOARDING_COMPLETE
];

// ============================================
// Stage Progress Types
// ============================================

export interface StageProgress {
  stage: OnboardingStage;
  entered_at: string;
  completed_at?: string;
  duration_days?: number;
  status: StageStatus;
  blockers?: string[];
  notes?: string;
}

export interface OnboardingMilestoneProgress {
  name: string;
  target_date: string;
  actual_date?: string;
  on_track: boolean;
  description?: string;
}

// ============================================
// Customer Onboarding Progress
// ============================================

export interface OnboardingProgress {
  customer_id: string;
  customer_name: string;
  current_stage: OnboardingStage;
  started_at: string;
  target_completion: string;

  // Overall progress percentage
  progress_pct: number;

  // Stage-by-stage progress
  stages: StageProgress[];

  // Key milestones
  milestones: OnboardingMilestoneProgress[];

  // Assignment
  csm_id?: string;
  csm_name?: string;

  // Health indicators
  is_stuck: boolean;
  days_in_current_stage: number;
  expected_days_in_stage: number;
  is_overdue: boolean;

  // Metadata
  arr?: number;
  segment?: string;
  industry?: string;
}

// ============================================
// Funnel Stage Metrics
// ============================================

export interface FunnelStageMetrics {
  stage: OnboardingStage;
  order: number;
  display_name: string;

  metrics: {
    total_entered: number;
    currently_in: number;
    completed: number;
    dropped: number;
    skipped: number;

    conversion_rate: number;    // Percentage who completed this stage
    drop_off_rate: number;      // Percentage who dropped at this stage
    avg_duration_days: number;  // Average time spent in stage
    median_duration_days: number;

    stuck_count: number;        // Number currently stuck
    stuck_threshold_days: number; // Threshold for "stuck" detection
  };
}

// ============================================
// Funnel Overview Metrics
// ============================================

export interface FunnelOverviewMetrics {
  total_onboardings: number;
  active_onboardings: number;
  completed: number;
  in_progress: number;
  dropped: number;

  // Rates
  completion_rate: number;
  drop_off_rate: number;

  // Time metrics
  avg_total_duration_days: number;
  median_total_duration_days: number;
  avg_time_to_value_days: number;

  // Bottleneck identification
  top_bottleneck: OnboardingStage | null;
  top_drop_off_stage: OnboardingStage | null;

  // Comparison
  vs_target: {
    completion_rate_delta: number;
    ttv_delta: number;
  };
}

// ============================================
// Stuck Customer Types
// ============================================

export interface StuckCustomer {
  customer_id: string;
  customer_name: string;
  current_stage: OnboardingStage;
  days_in_stage: number;
  expected_days: number;
  overdue_by: number;
  blockers: string[];
  csm_id?: string;
  csm_name?: string;
  last_activity?: string;
  arr?: number;
  priority: 'high' | 'medium' | 'low';
  recommended_action?: string;
}

// ============================================
// Time-to-Value Analysis
// ============================================

export interface TTVMetrics {
  overall: {
    avg_ttv_days: number;
    median_ttv_days: number;
    best_ttv_days: number;
    best_ttv_customer?: string;
    target_ttv_days: number;
    vs_target: number;
  };

  by_segment: Array<{
    segment: string;
    avg_ttv_days: number;
    customer_count: number;
  }>;

  trend: Array<{
    month: string;
    avg_ttv_days: number;
    count: number;
  }>;
}

// ============================================
// Cohort Comparison
// ============================================

export interface OnboardingCohort {
  name: string;
  period?: string;
  customer_count: number;
  completed_count: number;
  completion_rate: number;
  avg_duration_days: number;
  avg_ttv_days: number;
  stuck_count: number;
  total_arr: number;
}

export interface CohortComparisonData {
  dimension: 'start_date' | 'segment' | 'csm' | 'product';
  cohorts: OnboardingCohort[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface OnboardingFunnelFilters {
  period?: {
    start: string;
    end: string;
  };
  segment?: string;
  csm_id?: string;
  stage_filter?: OnboardingStage;
  status_filter?: 'all' | 'active' | 'completed' | 'stuck' | 'dropped';
}

export interface OnboardingFunnelResponse {
  funnel: FunnelStageMetrics[];
  overview: FunnelOverviewMetrics;
  active_onboardings: OnboardingProgress[];
  stuck_customers: StuckCustomer[];
  ttv_metrics: TTVMetrics;
  filters_applied: OnboardingFunnelFilters;
}

export interface CustomerOnboardingDetailResponse {
  customer: {
    id: string;
    name: string;
    arr: number;
    segment?: string;
    industry?: string;
  };
  progress: OnboardingProgress;
  timeline: Array<{
    date: string;
    event: string;
    stage?: OnboardingStage;
    details?: string;
  }>;
  recommendations: string[];
  risks: Array<{
    severity: 'high' | 'medium' | 'low';
    description: string;
    mitigation?: string;
  }>;
}

export interface StuckCustomersResponse {
  customers: StuckCustomer[];
  by_stage: Array<{
    stage: OnboardingStage;
    display_name: string;
    count: number;
    total_arr: number;
  }>;
  total_stuck: number;
  total_arr_at_risk: number;
}

// ============================================
// CSM Performance Types
// ============================================

export interface CSMOnboardingPerformance {
  csm_id: string;
  csm_name: string;
  total_onboardings: number;
  completed: number;
  in_progress: number;
  stuck: number;
  completion_rate: number;
  avg_duration_days: number;
  avg_ttv_days: number;
  total_arr: number;
}

export interface CSMPerformanceResponse {
  csms: CSMOnboardingPerformance[];
  team_avg: {
    completion_rate: number;
    avg_duration_days: number;
    avg_ttv_days: number;
  };
}

// ============================================
// Alerts and Notifications
// ============================================

export interface OnboardingAlert {
  id: string;
  type: 'stuck' | 'overdue' | 'at_risk' | 'milestone_missed';
  severity: 'high' | 'medium' | 'low';
  customer_id: string;
  customer_name: string;
  stage?: OnboardingStage;
  message: string;
  created_at: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
}

export interface OnboardingAlertsResponse {
  alerts: OnboardingAlert[];
  unacknowledged_count: number;
  by_severity: {
    high: number;
    medium: number;
    low: number;
  };
}
