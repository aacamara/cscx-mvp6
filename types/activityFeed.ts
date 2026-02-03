/**
 * Activity Feed Analysis Types
 * PRD-172: Activity tracking and analysis for customer engagement
 */

// ============================================
// Activity Types
// ============================================

export type ActivityType = 'email' | 'meeting' | 'call' | 'note' | 'task' | 'document';

export interface Activity {
  id: string;
  type: ActivityType;
  customer_id: string;
  customer_name?: string;
  csm_id: string;
  csm_name?: string;
  timestamp: string;
  description: string;
  outcome?: string;
  duration_minutes?: number;
  participants?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ============================================
// Activity Metrics
// ============================================

export interface ActivityMetrics {
  period: string;
  period_start: string;
  period_end: string;
  total_activities: number;
  by_type: Record<ActivityType, number>;
  by_csm: Record<string, { name: string; count: number }>;
  avg_per_customer: number;
  customers_with_activity: number;
  customers_without_activity: number;
  total_customers: number;
}

// ============================================
// Customer Activity Summary
// ============================================

export interface CustomerActivitySummary {
  customer_id: string;
  customer_name: string;
  arr: number;
  health_color: 'green' | 'yellow' | 'red';
  total_activities: number;
  last_activity_date: string | null;
  days_since_activity: number | null;
  by_type: Record<ActivityType, number>;
  activity_trend: 'increasing' | 'stable' | 'decreasing' | 'none';
}

// ============================================
// Activity Gap Detection
// ============================================

export interface ActivityGap {
  customer_id: string;
  customer_name: string;
  arr: number;
  health_color: 'green' | 'yellow' | 'red';
  days_since_activity: number;
  last_activity_date: string | null;
  last_activity_type: ActivityType | null;
  risk_level: 'low' | 'medium' | 'high';
  csm_id: string;
  csm_name: string;
}

// ============================================
// CSM Productivity
// ============================================

export interface CSMProductivity {
  csm_id: string;
  csm_name: string;
  total_activities: number;
  customers_touched: number;
  total_customers: number;
  coverage_rate: number;
  by_type: Record<ActivityType, number>;
  avg_activities_per_customer: number;
  activities_this_week: number;
  activities_last_week: number;
  trend_change: number;
}

// ============================================
// Activity Trend Data
// ============================================

export interface ActivityTrendPoint {
  date: string;
  total: number;
  by_type: Record<ActivityType, number>;
}

// ============================================
// Activity Effectiveness
// ============================================

export interface ActivityEffectiveness {
  activity_type: ActivityType;
  total_count: number;
  avg_health_impact: number;
  correlated_health_improvements: number;
  correlated_health_declines: number;
  avg_response_rate: number;
  recommended_frequency: string;
}

// ============================================
// API Response Types
// ============================================

export interface ActivityFeedResponse {
  summary: {
    total_activities: number;
    avg_per_customer: number;
    customers_with_gaps: number;
    coverage_rate: number;
  };
  metrics: ActivityMetrics;
  by_type: Array<{
    type: ActivityType;
    count: number;
    percentage: number;
  }>;
  gaps: ActivityGap[];
  recent_activities: Activity[];
  trends: ActivityTrendPoint[];
  csm_productivity: CSMProductivity[];
}

export interface CustomerActivityResponse {
  customer: {
    id: string;
    name: string;
    arr: number;
    health_color: 'green' | 'yellow' | 'red';
  };
  summary: CustomerActivitySummary;
  activities: Activity[];
  effectiveness: ActivityEffectiveness[];
}

// ============================================
// Filter Types
// ============================================

export interface ActivityFeedFilters {
  period?: 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'custom';
  start_date?: string;
  end_date?: string;
  activity_types?: ActivityType[];
  csm_id?: string;
  customer_id?: string;
  include_gaps?: boolean;
  gap_threshold_days?: number;
}

// ============================================
// Constants
// ============================================

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  email: 'Email',
  meeting: 'Meeting',
  call: 'Call',
  note: 'Note',
  task: 'Task',
  document: 'Document',
};

export const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
  email: '#3B82F6',    // blue
  meeting: '#10B981',  // green
  call: '#F59E0B',     // amber
  note: '#8B5CF6',     // purple
  task: '#EF4444',     // red
  document: '#6366F1', // indigo
};

export const GAP_THRESHOLDS = {
  low: 7,      // 7 days without activity
  medium: 14,  // 14 days without activity
  high: 21,    // 21+ days without activity
};
