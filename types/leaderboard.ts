/**
 * Leaderboard Types
 * PRD-260: Team Goal Tracking - Leaderboard functionality
 */

// ============================================
// Goal Period Types
// ============================================

export type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type PeriodStatus = 'planning' | 'active' | 'completed' | 'archived';

export interface GoalPeriod {
  id: string;
  name: string;
  description?: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Goal Types
// ============================================

export type GoalOwnerType = 'team' | 'individual';
export type GoalType = 'metric' | 'task' | 'milestone';
export type TargetDirection = 'increase' | 'decrease' | 'maintain';
export type GoalStatus = 'not_started' | 'on_track' | 'at_risk' | 'behind' | 'achieved' | 'exceeded';

export interface MetricCalculation {
  source: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  filters?: Record<string, any>;
}

export interface Milestone {
  id: string;
  name: string;
  target_value: number;
  completed: boolean;
  completed_at?: string;
}

export interface Goal {
  id: string;
  period_id: string;
  parent_goal_id?: string;

  // Ownership
  owner_type: GoalOwnerType;
  team_id?: string;
  user_id?: string;

  // Definition
  name: string;
  description?: string;
  goal_type: GoalType;

  // Metric goals
  metric_name?: string;
  metric_calculation?: MetricCalculation;
  baseline_value?: number;
  target_value: number;
  stretch_target_value?: number;
  target_direction: TargetDirection;

  // Task/milestone goals
  task_count_target?: number;
  milestones?: Milestone[];

  // Current state
  current_value: number;
  progress_percentage: number;
  status: GoalStatus;
  last_calculated_at?: string;

  // Visibility
  is_public: boolean;
  show_in_leaderboard: boolean;
  weight: number;

  // Metadata
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Goal Progress History
// ============================================

export interface GoalProgressHistory {
  id: string;
  goal_id: string;
  recorded_at: string;
  value: number;
  progress_percentage?: number;
  status?: GoalStatus;
  notes?: string;
  recorded_by: 'system' | 'manual' | 'api';
}

// ============================================
// Goal Check-in
// ============================================

export interface GoalCheckIn {
  id: string;
  goal_id: string;
  user_id: string;
  check_in_date: string;
  progress_notes?: string;
  blockers?: string;
  support_needed?: string;
  confidence_level?: number; // 1-5
  created_at: string;
}

// ============================================
// Goal Contribution
// ============================================

export interface GoalContribution {
  id: string;
  team_goal_id: string;
  individual_goal_id?: string;
  user_id: string;
  contribution_value: number;
  contribution_percentage: number;
  calculated_at: string;
}

// ============================================
// Goal Achievement
// ============================================

export type AchievementType = 'achieved' | 'exceeded' | 'milestone' | 'streak' | 'first_place';

export interface GoalAchievement {
  id: string;
  goal_id: string;
  user_id?: string;
  team_id?: string;
  achievement_type: AchievementType;
  achievement_value?: number;
  achieved_at: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  celebrated: boolean;
  celebrated_at?: string;
  message?: string;
}

// ============================================
// Leaderboard Configuration
// ============================================

export type LeaderboardDisplayType = 'ranked_list' | 'podium' | 'progress_bars' | 'cards';
export type LeaderboardVisibility = 'private' | 'team' | 'organization' | 'public';

export interface ScoringFormula {
  metrics: Array<{
    metric: string;
    weight: number;
  }>;
  bonuses?: Array<{
    condition: string;
    points: number;
  }>;
}

export interface LeaderboardConfig {
  id: string;
  name: string;
  description?: string;
  period_id?: string;

  // Display
  display_type: LeaderboardDisplayType;
  show_ranks: boolean;
  show_progress: boolean;
  show_change: boolean;
  show_avatars: boolean;
  max_entries: number;

  // Scoring
  metrics_included: string[];
  scoring_formula?: ScoringFormula;

  // Visibility
  is_active: boolean;
  visibility: LeaderboardVisibility;

  // Gamification
  enable_badges: boolean;
  enable_streaks: boolean;
  enable_celebrations: boolean;

  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Leaderboard Entry
// ============================================

export interface ScoreBreakdown {
  [metric: string]: {
    value: number;
    weight: number;
    weighted_score: number;
  };
}

export interface LeaderboardEntry {
  id: string;
  config_id: string;
  user_id: string;

  // Ranking
  rank: number;
  previous_rank?: number;
  rank_change: number;

  // Scores
  total_score: number;
  score_breakdown: ScoreBreakdown;

  // Metrics
  goals_achieved: number;
  goals_total: number;
  achievement_rate: number;
  streak_days: number;

  // User info
  user_name?: string;
  user_avatar_url?: string;
  user_title?: string;

  calculated_at: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateGoalPeriodRequest {
  name: string;
  description?: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  status?: PeriodStatus;
}

export interface CreateGoalRequest {
  period_id: string;
  parent_goal_id?: string;
  owner_type: GoalOwnerType;
  team_id?: string;
  user_id?: string;
  name: string;
  description?: string;
  goal_type: GoalType;
  metric_name?: string;
  metric_calculation?: MetricCalculation;
  baseline_value?: number;
  target_value: number;
  stretch_target_value?: number;
  target_direction?: TargetDirection;
  task_count_target?: number;
  milestones?: Milestone[];
  is_public?: boolean;
  show_in_leaderboard?: boolean;
  weight?: number;
}

export interface UpdateGoalProgressRequest {
  current_value: number;
  notes?: string;
}

export interface GoalCheckInRequest {
  progress_notes?: string;
  blockers?: string;
  support_needed?: string;
  confidence_level?: number;
}

export interface LeaderboardFilters {
  period_id?: string;
  metric?: string;
  team_id?: string;
  limit?: number;
}

// ============================================
// Leaderboard Response Types
// ============================================

export interface LeaderboardResponse {
  config: LeaderboardConfig;
  period: GoalPeriod;
  entries: LeaderboardEntry[];
  current_user_entry?: LeaderboardEntry;
  period_progress: number; // How far through the period (0-100)
  last_updated: string;
}

export interface GoalDashboardResponse {
  period: GoalPeriod;
  team_goals: Goal[];
  individual_goals: Goal[];
  contributions: GoalContribution[];
  recent_achievements: GoalAchievement[];
  upcoming_deadlines: Goal[];
  progress_summary: {
    total_goals: number;
    achieved: number;
    on_track: number;
    at_risk: number;
    behind: number;
    average_progress: number;
  };
}

// ============================================
// Metric Types (for auto-calculation)
// ============================================

export type StandardMetric =
  | 'nrr'                  // Net Revenue Retention
  | 'grr'                  // Gross Revenue Retention
  | 'retention_rate'       // Customer Retention Rate
  | 'nps'                  // Net Promoter Score
  | 'csat'                 // Customer Satisfaction
  | 'qbr_completion'       // QBR Completion Rate
  | 'onboarding_completion' // Onboarding Completion Rate
  | 'expansion_revenue'    // Expansion Revenue
  | 'health_score_avg'     // Average Health Score
  | 'at_risk_customers'    // Number of At-Risk Customers
  | 'activities_logged'    // Number of Activities Logged
  | 'meetings_held'        // Number of Meetings Held
  | 'emails_sent';         // Number of Emails Sent

export interface MetricDefinition {
  name: StandardMetric;
  label: string;
  description: string;
  unit: string;
  direction: TargetDirection;
  category: 'revenue' | 'retention' | 'engagement' | 'health' | 'activity';
}

export const STANDARD_METRICS: Record<StandardMetric, MetricDefinition> = {
  nrr: {
    name: 'nrr',
    label: 'Net Revenue Retention',
    description: 'Revenue retained plus expansion minus churn',
    unit: '%',
    direction: 'increase',
    category: 'revenue'
  },
  grr: {
    name: 'grr',
    label: 'Gross Revenue Retention',
    description: 'Revenue retained minus churn',
    unit: '%',
    direction: 'increase',
    category: 'revenue'
  },
  retention_rate: {
    name: 'retention_rate',
    label: 'Customer Retention Rate',
    description: 'Percentage of customers retained',
    unit: '%',
    direction: 'increase',
    category: 'retention'
  },
  nps: {
    name: 'nps',
    label: 'Net Promoter Score',
    description: 'Customer loyalty metric',
    unit: 'score',
    direction: 'increase',
    category: 'engagement'
  },
  csat: {
    name: 'csat',
    label: 'Customer Satisfaction',
    description: 'Customer satisfaction score',
    unit: '%',
    direction: 'increase',
    category: 'engagement'
  },
  qbr_completion: {
    name: 'qbr_completion',
    label: 'QBR Completion Rate',
    description: 'Percentage of QBRs completed',
    unit: '%',
    direction: 'increase',
    category: 'activity'
  },
  onboarding_completion: {
    name: 'onboarding_completion',
    label: 'Onboarding Completion',
    description: 'Percentage of onboardings completed',
    unit: '%',
    direction: 'increase',
    category: 'activity'
  },
  expansion_revenue: {
    name: 'expansion_revenue',
    label: 'Expansion Revenue',
    description: 'Revenue from upsells and expansions',
    unit: '$',
    direction: 'increase',
    category: 'revenue'
  },
  health_score_avg: {
    name: 'health_score_avg',
    label: 'Average Health Score',
    description: 'Average health score across portfolio',
    unit: 'score',
    direction: 'increase',
    category: 'health'
  },
  at_risk_customers: {
    name: 'at_risk_customers',
    label: 'At-Risk Customers',
    description: 'Number of customers flagged as at-risk',
    unit: 'count',
    direction: 'decrease',
    category: 'health'
  },
  activities_logged: {
    name: 'activities_logged',
    label: 'Activities Logged',
    description: 'Number of activities logged',
    unit: 'count',
    direction: 'increase',
    category: 'activity'
  },
  meetings_held: {
    name: 'meetings_held',
    label: 'Meetings Held',
    description: 'Number of customer meetings',
    unit: 'count',
    direction: 'increase',
    category: 'activity'
  },
  emails_sent: {
    name: 'emails_sent',
    label: 'Emails Sent',
    description: 'Number of customer emails sent',
    unit: 'count',
    direction: 'increase',
    category: 'activity'
  }
};

// ============================================
// Badge Types
// ============================================

export type BadgeType =
  | 'top_performer'
  | 'streak_7'
  | 'streak_30'
  | 'goal_crusher'
  | 'team_player'
  | 'rising_star'
  | 'consistency_king';

export interface Badge {
  type: BadgeType;
  label: string;
  description: string;
  icon: string;
  earned_at?: string;
}

export const BADGE_DEFINITIONS: Record<BadgeType, Omit<Badge, 'earned_at'>> = {
  top_performer: {
    type: 'top_performer',
    label: 'Top Performer',
    description: 'Ranked #1 on the leaderboard',
    icon: 'trophy'
  },
  streak_7: {
    type: 'streak_7',
    label: 'Week Warrior',
    description: 'Maintained progress for 7 days straight',
    icon: 'fire'
  },
  streak_30: {
    type: 'streak_30',
    label: 'Unstoppable',
    description: 'Maintained progress for 30 days straight',
    icon: 'flame'
  },
  goal_crusher: {
    type: 'goal_crusher',
    label: 'Goal Crusher',
    description: 'Exceeded goal target by 20% or more',
    icon: 'target'
  },
  team_player: {
    type: 'team_player',
    label: 'Team Player',
    description: 'Top contributor to team goals',
    icon: 'users'
  },
  rising_star: {
    type: 'rising_star',
    label: 'Rising Star',
    description: 'Improved rank by 5 or more positions',
    icon: 'star'
  },
  consistency_king: {
    type: 'consistency_king',
    label: 'Consistency King',
    description: 'Submitted check-ins every week this period',
    icon: 'check-circle'
  }
};
