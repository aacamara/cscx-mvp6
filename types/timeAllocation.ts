/**
 * Time Allocation Analysis Types
 * PRD-161: Time tracking and analysis for CSM productivity
 */

// ============================================
// Activity Types
// ============================================

export enum ActivityType {
  MEETING = 'meeting',
  EMAIL = 'email',
  CALL = 'call',
  INTERNAL_MEETING = 'internal_meeting',
  ADMIN = 'admin',
  DOCUMENTATION = 'documentation',
  TRAINING = 'training',
  RESEARCH = 'research',
  TRAVEL = 'travel',
  OTHER = 'other'
}

export const ACTIVITY_CONFIG: Record<ActivityType, {
  label: string;
  color: string;
  customerFacing: boolean;
}> = {
  [ActivityType.MEETING]: { label: 'Customer Meetings', color: '#4ade80', customerFacing: true },
  [ActivityType.EMAIL]: { label: 'Email', color: '#60a5fa', customerFacing: true },
  [ActivityType.CALL]: { label: 'Calls', color: '#f472b6', customerFacing: true },
  [ActivityType.INTERNAL_MEETING]: { label: 'Internal Meetings', color: '#a78bfa', customerFacing: false },
  [ActivityType.ADMIN]: { label: 'Admin', color: '#fbbf24', customerFacing: false },
  [ActivityType.DOCUMENTATION]: { label: 'Documentation', color: '#34d399', customerFacing: false },
  [ActivityType.TRAINING]: { label: 'Training', color: '#f87171', customerFacing: false },
  [ActivityType.RESEARCH]: { label: 'Research', color: '#fb923c', customerFacing: false },
  [ActivityType.TRAVEL]: { label: 'Travel', color: '#94a3b8', customerFacing: false },
  [ActivityType.OTHER]: { label: 'Other', color: '#6b7280', customerFacing: false }
};

// Efficiency thresholds
export const EFFICIENCY_THRESHOLDS = {
  excellent: { max: 1.5, label: 'Excellent', color: 'green' },
  normal: { max: 3.0, label: 'Normal', color: 'yellow' },
  high: { max: Infinity, label: 'High', color: 'red' }
};

// Target percentages
export const TIME_TARGETS = {
  customerFacing: { target: 60, label: 'Customer-Facing Target' },
  admin: { target: 15, label: 'Admin Overhead Target' }
};

// ============================================
// Time Entry
// ============================================

export type TimeEntrySource = 'calendar' | 'email' | 'manual' | 'system';

export interface TimeEntry {
  id: string;
  csm_id: string;
  customer_id?: string;
  customer_name?: string;
  activity_type: ActivityType;
  description?: string;
  duration_minutes: number;
  date: string;
  source: TimeEntrySource;
  reference_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTimeEntryRequest {
  activity_type: ActivityType;
  customer_id?: string;
  duration_minutes: number;
  date: string;
  description?: string;
}

// ============================================
// Activity Breakdown
// ============================================

export interface ActivityBreakdown {
  type: ActivityType;
  label: string;
  hours: number;
  percentage: number;
  color: string;
  customer_facing: boolean;
}

// ============================================
// Customer Time Breakdown
// ============================================

export interface CustomerTimeBreakdown {
  customer_id: string;
  customer_name: string;
  hours: number;
  arr: number;
  hours_per_10k_arr: number;
  efficiency_status: 'excellent' | 'normal' | 'high';
  activities: {
    type: ActivityType;
    hours: number;
  }[];
}

// ============================================
// CSM Time Breakdown
// ============================================

export interface CSMTimeBreakdown {
  csm_id: string;
  csm_name: string;
  total_hours: number;
  customer_facing_pct: number;
  admin_pct: number;
  customer_count: number;
  arr_managed: number;
  arr_per_hour: number;
  efficiency_score: number;
  top_activities: {
    type: ActivityType;
    hours: number;
    percentage: number;
  }[];
}

// ============================================
// Time Trends
// ============================================

export interface TimeTrend {
  date: string;
  total_hours: number;
  customer_facing_hours: number;
  admin_hours: number;
  customer_facing_pct: number;
}

export interface WeeklyTrend {
  week: string;
  week_label: string;
  total_hours: number;
  by_activity: {
    type: ActivityType;
    hours: number;
  }[];
}

// ============================================
// Optimization Suggestions
// ============================================

export type SuggestionPriority = 'high' | 'medium' | 'low';
export type SuggestionCategory = 'time_balance' | 'customer_efficiency' | 'admin_reduction' | 'engagement';

export interface OptimizationSuggestion {
  id: string;
  priority: SuggestionPriority;
  category: SuggestionCategory;
  title: string;
  description: string;
  impact: string;
  customer_id?: string;
  customer_name?: string;
  metric_value?: number;
  metric_label?: string;
}

// ============================================
// Summary Metrics
// ============================================

export interface TimeAllocationSummary {
  period: string;
  period_label: string;
  total_hours: number;
  total_csms: number;
  customer_facing_pct: number;
  customer_facing_vs_target: number;
  admin_pct: number;
  admin_vs_target: number;
  internal_pct: number;
  avg_hours_per_10k_arr: number;
  tracking_completeness: number;
}

// ============================================
// API Response Types
// ============================================

export interface TimeAllocationResponse {
  summary: TimeAllocationSummary;
  by_activity: ActivityBreakdown[];
  by_csm: CSMTimeBreakdown[];
  by_customer: CustomerTimeBreakdown[];
  trends: WeeklyTrend[];
  recommendations: OptimizationSuggestion[];
}

export interface CSMTimeDetailResponse {
  csm: {
    id: string;
    name: string;
    email: string;
    customer_count: number;
    arr_managed: number;
  };
  period: string;
  total_hours: number;
  by_activity: ActivityBreakdown[];
  by_customer: CustomerTimeBreakdown[];
  weekly_trends: WeeklyTrend[];
  recommendations: OptimizationSuggestion[];
}

// ============================================
// Filter Types
// ============================================

export interface TimeAllocationFilters {
  csm_id?: string;
  team_id?: string;
  period?: 'week' | 'month' | 'quarter' | 'year';
  start_date?: string;
  end_date?: string;
  activity_type?: ActivityType;
  customer_id?: string;
}

export interface TimeEntriesFilters {
  csm_id?: string;
  customer_id?: string;
  activity_type?: ActivityType;
  source?: TimeEntrySource;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}
