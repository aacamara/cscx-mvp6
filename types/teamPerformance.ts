/**
 * Team Performance Dashboard Types
 * PRD-178: Team Performance Dashboard for CS Leaders
 */

// ============================================
// CSM Metrics Types
// ============================================

export interface CSMMetrics {
  user_id: string;
  user_name: string;
  email: string;
  avatar_url?: string;

  // Portfolio metrics
  portfolio_value: number;        // Total ARR under management
  customer_count: number;         // Number of customers

  // Performance metrics
  retention_rate: number;         // 0-100%
  net_revenue_retention: number;  // NRR as percentage (e.g., 112%)
  health_score_avg: number;       // 0-100

  // Activity metrics
  activity_score: number;         // 0-100 composite score
  meetings_this_month: number;
  emails_this_month: number;
  tasks_completed: number;

  // Trends
  retention_trend: 'improving' | 'stable' | 'declining';
  nrr_trend: 'improving' | 'stable' | 'declining';
  health_trend: 'improving' | 'stable' | 'declining';

  // Previous period metrics (for comparison)
  retention_rate_previous: number;
  nrr_previous: number;
  health_score_avg_previous: number;
}

// ============================================
// Team Summary Types
// ============================================

export interface TeamSummary {
  total_csms: number;
  total_customers: number;
  total_arr: number;

  // Team averages
  avg_retention_rate: number;
  avg_nrr: number;
  avg_health_score: number;
  avg_activity_score: number;

  // Trends (week-over-week)
  retention_change_wow: number;
  nrr_change_wow: number;
  health_change_wow: number;

  // Distribution
  high_performers: number;  // CSMs above target
  meeting_target: number;   // CSMs at target
  below_target: number;     // CSMs below target
}

// ============================================
// Goal Types
// ============================================

export interface CSMGoal {
  id: string;
  user_id: string;
  metric: 'retention' | 'nrr' | 'health' | 'activity';
  target_value: number;
  current_value: number;
  period_start: string;
  period_end: string;
  status: 'on_track' | 'at_risk' | 'behind';
  created_at: string;
  updated_at?: string;
}

export interface TeamGoal {
  id: string;
  team_id?: string;
  metric: 'retention' | 'nrr' | 'health' | 'activity';
  target_value: number;
  current_value: number;
  period_start: string;
  period_end: string;
  progress_pct: number;  // 0-100
  status: 'on_track' | 'at_risk' | 'behind';
}

// ============================================
// Leaderboard Types
// ============================================

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  user_name: string;
  avatar_url?: string;
  metric_value: number;
  change_from_previous: number;
  is_top_performer: boolean;
}

export interface Leaderboard {
  metric: 'retention' | 'nrr' | 'health' | 'activity';
  period: string;
  entries: LeaderboardEntry[];
}

// ============================================
// Highlight Types
// ============================================

export interface TeamHighlight {
  type: 'achievement' | 'improvement' | 'concern';
  title: string;
  description: string;
  csm_name?: string;
  csm_id?: string;
  metric?: string;
  value?: number;
}

// ============================================
// Trend Data Types
// ============================================

export interface TeamTrendPoint {
  date: string;
  avg_retention: number;
  avg_nrr: number;
  avg_health: number;
  avg_activity: number;
}

// ============================================
// API Response Types
// ============================================

export interface TeamPerformanceResponse {
  summary: TeamSummary;
  csm_metrics: CSMMetrics[];
  team_goals: TeamGoal[];
  highlights: TeamHighlight[];
  trends: TeamTrendPoint[];
  period: {
    start: string;
    end: string;
    label: string;
  };
}

export interface CSMDetailResponse {
  csm: CSMMetrics;
  customers: CSMCustomerSummary[];
  goals: CSMGoal[];
  activity_log: CSMActivity[];
  trends: CSMTrendPoint[];
}

export interface CSMCustomerSummary {
  customer_id: string;
  customer_name: string;
  arr: number;
  health_score: number;
  health_category: 'healthy' | 'warning' | 'critical';
  days_to_renewal: number | null;
  last_contact: string | null;
}

export interface CSMActivity {
  id: string;
  type: 'meeting' | 'email' | 'call' | 'note' | 'task';
  customer_name: string;
  description: string;
  timestamp: string;
}

export interface CSMTrendPoint {
  date: string;
  retention: number;
  nrr: number;
  health: number;
  activity: number;
}

// ============================================
// Filter Types
// ============================================

export interface TeamPerformanceFilters {
  period?: 'month' | 'quarter' | 'year';
  team_id?: string;
  sort_by?: 'retention' | 'nrr' | 'health' | 'activity' | 'portfolio' | 'name';
  sort_order?: 'asc' | 'desc';
}

// ============================================
// Goal Input Types
// ============================================

export interface CreateGoalInput {
  metric: 'retention' | 'nrr' | 'health' | 'activity';
  target_value: number;
  period_start: string;
  period_end: string;
  user_id?: string;  // If omitted, applies to whole team
}
