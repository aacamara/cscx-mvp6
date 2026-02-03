/**
 * Training Completion & Certification Tracking Types
 * PRD-017: Track certifications, identify training gaps, monitor time-to-competency
 */

// ============================================
// Training Record Types
// ============================================

export interface TrainingRecord {
  id?: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_role?: string;
  customer_id: string;
  course_id: string;
  course_name: string;
  course_type: CourseType;
  status: TrainingStatus;
  enrollment_date: string;
  completion_date?: string;
  score?: number;
  passing_score?: number;
  passed?: boolean;
  certification_earned?: string;
  certification_expires?: string;
  time_to_complete_days?: number;
  metadata?: Record<string, unknown>;
}

export type CourseType =
  | 'fundamentals'
  | 'admin'
  | 'advanced'
  | 'api'
  | 'reporting'
  | 'integration'
  | 'custom';

export type TrainingStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'expired';

// ============================================
// Certification Types
// ============================================

export interface Certification {
  id: string;
  name: string;
  course_id: string;
  required_score: number;
  validity_days?: number;
  required_for_roles?: string[];
  is_mandatory?: boolean;
}

export interface UserCertification {
  user_id: string;
  user_email: string;
  user_name: string;
  user_role?: string;
  certification_id: string;
  certification_name: string;
  earned_date: string;
  expires_date?: string;
  status: CertificationStatus;
  score: number;
  days_until_expiry?: number;
}

export type CertificationStatus =
  | 'active'
  | 'expiring_soon' // Within 30 days
  | 'expired'
  | 'revoked';

// ============================================
// Training Data Upload Types
// ============================================

export interface TrainingDataUploadResult {
  success: boolean;
  file_id: string;
  file_name: string;
  total_records: number;
  unique_users: number;
  unique_courses: number;
  customer_id?: string;
  customer_name?: string;
  column_mapping: TrainingColumnMapping;
  preview: TrainingRecord[];
  errors?: string[];
}

export interface TrainingColumnMapping {
  user_id?: string;
  user_email?: string;
  user_name?: string;
  user_role?: string;
  course_id?: string;
  course_name?: string;
  course_type?: string;
  status?: string;
  enrollment_date?: string;
  completion_date?: string;
  score?: string;
  passing_score?: string;
  certification?: string;
  certification_expiry?: string;
  [key: string]: string | undefined;
}

// ============================================
// Training Status & Analytics Types
// ============================================

export interface CustomerTrainingStatus {
  customer_id: string;
  customer_name: string;
  overview: TrainingOverview;
  courses: CourseCompletionStatus[];
  certifications: CertificationOverview;
  gaps: TrainingGap[];
  expiring_certifications: UserCertification[];
  users_by_status: UserTrainingStatus[];
  training_vs_adoption: TrainingAdoptionCorrelation;
}

export interface TrainingOverview {
  total_users: number;
  certified_users: number;
  in_progress_users: number;
  not_started_users: number;
  certification_rate: number;
  avg_time_to_complete: number;
  overall_pass_rate: number;
}

export interface CourseCompletionStatus {
  course_id: string;
  course_name: string;
  course_type: CourseType;
  enrolled_count: number;
  completed_count: number;
  completion_rate: number;
  pass_rate: number;
  avg_score?: number;
  avg_days_to_complete: number;
  is_required?: boolean;
}

export interface CertificationOverview {
  total_certifications: number;
  active_certifications: number;
  expiring_soon: number;
  expired: number;
  certification_rate: number;
}

export interface TrainingGap {
  gap_type: 'missing_certification' | 'role_requirement' | 'expired' | 'low_completion';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affected_users: GapAffectedUser[];
  recommended_action: string;
  course_or_certification: string;
}

export interface GapAffectedUser {
  user_id: string;
  user_email: string;
  user_name: string;
  user_role?: string;
  last_activity?: string;
  missing_item: string;
}

export interface UserTrainingStatus {
  user_id: string;
  user_email: string;
  user_name: string;
  user_role?: string;
  total_courses: number;
  completed_courses: number;
  certifications_earned: number;
  certifications_required: number;
  completion_percentage: number;
  status: 'certified' | 'in_progress' | 'not_started' | 'at_risk';
  last_activity?: string;
}

export interface TrainingAdoptionCorrelation {
  fully_certified: { avg_usage_score: number; avg_feature_adoption: number; count: number };
  partially_certified: { avg_usage_score: number; avg_feature_adoption: number; count: number };
  not_certified: { avg_usage_score: number; avg_feature_adoption: number; count: number };
  insight?: string;
}

// ============================================
// Training Gaps Analysis Types
// ============================================

export interface TrainingGapAnalysis {
  customer_id: string;
  customer_name: string;
  analysis_date: string;
  gaps_by_role: RoleGap[];
  users_without_required_certs: GapAffectedUser[];
  low_completion_courses: CourseCompletionStatus[];
  priority_recommendations: TrainingRecommendation[];
  risk_summary: {
    high_priority_gaps: number;
    medium_priority_gaps: number;
    low_priority_gaps: number;
    total_affected_users: number;
  };
}

export interface RoleGap {
  role: string;
  total_users: number;
  required_certification: string;
  certified_count: number;
  certification_rate: number;
  gap_count: number;
}

export interface TrainingRecommendation {
  priority: 'high' | 'medium' | 'low';
  type: 'certification' | 'recertification' | 'enablement';
  title: string;
  description: string;
  affected_users_count: number;
  risk?: string;
  suggested_action: string;
}

// ============================================
// Training Plan Types
// ============================================

export interface TrainingPlan {
  id?: string;
  customer_id: string;
  customer_name: string;
  created_date: string;
  created_by: string;
  status: 'draft' | 'active' | 'completed';
  weeks: TrainingPlanWeek[];
  success_metrics: TrainingSuccessMetric[];
}

export interface TrainingPlanWeek {
  week_number: number;
  start_date: string;
  end_date: string;
  title: string;
  items: TrainingPlanItem[];
}

export interface TrainingPlanItem {
  id: string;
  type: 'certification' | 'recertification' | 'training_session' | 'workshop' | 'office_hours';
  title: string;
  description: string;
  assigned_users: string[];
  due_date: string;
  completed: boolean;
  completed_date?: string;
}

export interface TrainingSuccessMetric {
  metric: string;
  current_value: number | string;
  target_value: number | string;
  unit?: string;
}

// ============================================
// Training Reminder Types
// ============================================

export interface TrainingReminder {
  id?: string;
  type: 'certification_required' | 'recertification_due' | 'uncertified_users' | 'custom';
  recipients: TrainingReminderRecipient[];
  subject: string;
  body_template: string;
  sent_date?: string;
  status: 'pending' | 'sent' | 'failed';
}

export interface TrainingReminderRecipient {
  user_email: string;
  user_name: string;
  personalization: {
    certification_name?: string;
    expiry_date?: string;
    course_name?: string;
    [key: string]: string | undefined;
  };
}

export interface SendRemindersResult {
  success: boolean;
  total_sent: number;
  reminders: {
    type: string;
    recipients_count: number;
    subject: string;
    body_preview: string;
  }[];
  errors?: string[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface TrainingUploadRequest {
  file: File | Buffer;
  file_name: string;
  customer_id?: string;
  column_mapping?: TrainingColumnMapping;
}

export interface TrainingStatusRequest {
  customer_id: string;
  include_users?: boolean;
  include_gaps?: boolean;
}

export interface TrainingGapsRequest {
  customer_id: string;
  min_gap_severity?: 'high' | 'medium' | 'low';
}

export interface SendRemindersRequest {
  customer_id: string;
  reminder_types: ('certification_required' | 'recertification_due' | 'uncertified_users')[];
  custom_message?: string;
}

export interface CreateTrainingPlanRequest {
  customer_id: string;
  include_gaps: boolean;
  include_expiring: boolean;
  weeks?: number;
}

// ============================================
// Training Metrics
// ============================================

export interface TrainingMetrics {
  completion_rate: number;
  certification_rate: number;
  avg_time_to_complete: number;
  pass_rate: number;
  recertification_due: number;
  training_coverage: number;
}

export const TRAINING_METRICS_DEFINITIONS = {
  completion_rate: 'Percentage of users who completed training',
  certification_rate: 'Percentage of users certified',
  avg_time_to_complete: 'Average days from enrollment to completion',
  pass_rate: 'Percentage passing on first attempt',
  recertification_due: 'Users with expiring certifications',
  training_coverage: 'Percentage of user base enrolled in training'
};
