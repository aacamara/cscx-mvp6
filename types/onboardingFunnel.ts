/**
 * Onboarding Funnel Report Types
 * PRD-154: Onboarding funnel visualization and analytics
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

export const STAGE_LABELS: Record<OnboardingStage, string> = {
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

// Expected duration in days for each stage (for stuck detection)
export const STAGE_EXPECTED_DAYS: Record<OnboardingStage, number> = {
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

// ============================================
// Stage Status Types
// ============================================

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';

export interface StageProgress {
  stage: OnboardingStage;
  entered_at: string | null;
  completed_at: string | null;
  duration_days: number | null;
  status: StageStatus;
  blockers: string[];
}

// ============================================
// Onboarding Progress (Individual Customer)
// ============================================

export interface OnboardingMilestone {
  name: string;
  target_date: string;
  actual_date: string | null;
  on_track: boolean;
}

export interface OnboardingProgress {
  customer_id: string;
  customer_name: string;
  current_stage: OnboardingStage;
  started_at: string;
  target_completion: string;
  csm_id: string;
  csm_name: string;
  arr: number;
  segment: string;
  health_score: number;
  stages: StageProgress[];
  milestones: OnboardingMilestone[];
  is_at_risk: boolean;
  days_in_current_stage: number;
  total_days: number;
  completion_percentage: number;
}

// ============================================
// Funnel Stage Metrics
// ============================================

export interface FunnelStageMetrics {
  total_entered: number;
  currently_in: number;
  completed: number;
  dropped: number;
  skipped: number;
  conversion_rate: number;
  avg_duration_days: number;
  median_duration_days: number;
  stuck_count: number;
  stuck_threshold_days: number;
}

export interface FunnelStage {
  stage: OnboardingStage;
  order: number;
  label: string;
  metrics: FunnelStageMetrics;
}

// ============================================
// Overall Funnel Metrics
// ============================================

export interface FunnelMetrics {
  total_onboardings: number;
  completed: number;
  in_progress: number;
  dropped: number;
  completion_rate: number;
  avg_total_duration_days: number;
  median_total_duration_days: number;
  avg_time_to_value_days: number;
  top_bottleneck: OnboardingStage | null;
  top_drop_off_stage: OnboardingStage | null;
  on_track_count: number;
  at_risk_count: number;
  stuck_count: number;
}

// ============================================
// Stuck Customer
// ============================================

export interface StuckCustomer {
  customer_id: string;
  customer_name: string;
  current_stage: OnboardingStage;
  days_in_stage: number;
  expected_days: number;
  overdue_by: number;
  blockers: string[];
  csm_id: string;
  csm_name: string;
  last_activity: string | null;
  arr: number;
  segment: string;
}

// ============================================
// Cohort Comparison
// ============================================

export interface CohortComparison {
  cohort_name: string;
  cohort_type: 'date' | 'segment' | 'csm' | 'product';
  total_customers: number;
  completed: number;
  completion_rate: number;
  avg_duration_days: number;
  avg_time_to_value_days: number;
  stuck_count: number;
}

// ============================================
// Time-to-Value Analysis
// ============================================

export interface TimeToValueMetrics {
  avg_ttv_days: number;
  median_ttv_days: number;
  best_ttv_days: number;
  best_ttv_customer: string;
  target_ttv_days: number;
  variance_from_target: number;
  by_segment: {
    segment: string;
    avg_ttv_days: number;
    customer_count: number;
  }[];
  trend: {
    date: string;
    avg_ttv_days: number;
  }[];
}

// ============================================
// CSM Performance
// ============================================

export interface CSMOnboardingPerformance {
  csm_id: string;
  csm_name: string;
  total_onboardings: number;
  completed: number;
  in_progress: number;
  completion_rate: number;
  avg_duration_days: number;
  avg_time_to_value_days: number;
  stuck_customers: number;
  on_track_pct: number;
}

// ============================================
// API Response Types
// ============================================

export interface OnboardingFunnelResponse {
  funnel: FunnelStage[];
  active_onboardings: OnboardingProgress[];
  metrics: FunnelMetrics;
  time_to_value: TimeToValueMetrics;
  cohort_comparison?: CohortComparison[];
  csm_performance?: CSMOnboardingPerformance[];
}

export interface StuckCustomersResponse {
  customers: StuckCustomer[];
  by_stage: { stage: OnboardingStage; count: number }[];
  total_stuck: number;
  total_arr_at_risk: number;
}

export interface CustomerOnboardingDetailResponse {
  progress: OnboardingProgress;
  stage_history: {
    stage: OnboardingStage;
    entered_at: string;
    completed_at: string | null;
    duration_days: number | null;
    notes: string[];
  }[];
  activities: {
    timestamp: string;
    type: string;
    description: string;
    user: string;
  }[];
  recommendations: string[];
}

// ============================================
// Filter Types
// ============================================

export interface OnboardingFunnelFilters {
  period_start?: string;
  period_end?: string;
  segment?: string;
  csm_id?: string;
  stage_filter?: OnboardingStage;
  status_filter?: 'all' | 'on_track' | 'at_risk' | 'stuck' | 'completed';
  search?: string;
  sort_by?: 'name' | 'stage' | 'days' | 'arr' | 'health';
  sort_order?: 'asc' | 'desc';
}

// ============================================
// Stage Transition Event
// ============================================

export interface StageTransitionEvent {
  customer_id: string;
  from_stage: OnboardingStage | null;
  to_stage: OnboardingStage;
  transitioned_at: string;
  triggered_by: 'manual' | 'automatic' | 'agent';
  user_id?: string;
  notes?: string;
}
