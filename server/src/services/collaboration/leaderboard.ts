/**
 * Leaderboard Service
 * PRD-260: Team Goal Tracking - Leaderboard functionality
 *
 * Features:
 * - Goal period management
 * - Goal CRUD operations
 * - Progress tracking and history
 * - Leaderboard calculation and caching
 * - Achievement tracking
 * - Metric calculation integration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';

// ============================================
// Types
// ============================================

type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'annual';
type PeriodStatus = 'planning' | 'active' | 'completed' | 'archived';
type GoalOwnerType = 'team' | 'individual';
type GoalType = 'metric' | 'task' | 'milestone';
type TargetDirection = 'increase' | 'decrease' | 'maintain';
type GoalStatus = 'not_started' | 'on_track' | 'at_risk' | 'behind' | 'achieved' | 'exceeded';
type AchievementType = 'achieved' | 'exceeded' | 'milestone' | 'streak' | 'first_place';
type LeaderboardDisplayType = 'ranked_list' | 'podium' | 'progress_bars' | 'cards';
type LeaderboardVisibility = 'private' | 'team' | 'organization' | 'public';

interface GoalPeriod {
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

interface Goal {
  id: string;
  period_id: string;
  parent_goal_id?: string;
  owner_type: GoalOwnerType;
  team_id?: string;
  user_id?: string;
  name: string;
  description?: string;
  goal_type: GoalType;
  metric_name?: string;
  metric_calculation?: any;
  baseline_value?: number;
  target_value: number;
  stretch_target_value?: number;
  target_direction: TargetDirection;
  task_count_target?: number;
  milestones?: any[];
  current_value: number;
  progress_percentage: number;
  status: GoalStatus;
  last_calculated_at?: string;
  is_public: boolean;
  show_in_leaderboard: boolean;
  weight: number;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

interface GoalProgressHistory {
  id: string;
  goal_id: string;
  recorded_at: string;
  value: number;
  progress_percentage?: number;
  status?: GoalStatus;
  notes?: string;
  recorded_by: 'system' | 'manual' | 'api';
}

interface GoalCheckIn {
  id: string;
  goal_id: string;
  user_id: string;
  check_in_date: string;
  progress_notes?: string;
  blockers?: string;
  support_needed?: string;
  confidence_level?: number;
  created_at: string;
}

interface GoalContribution {
  id: string;
  team_goal_id: string;
  individual_goal_id?: string;
  user_id: string;
  contribution_value: number;
  contribution_percentage: number;
  calculated_at: string;
}

interface GoalAchievement {
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

interface LeaderboardConfig {
  id: string;
  name: string;
  description?: string;
  period_id?: string;
  display_type: LeaderboardDisplayType;
  show_ranks: boolean;
  show_progress: boolean;
  show_change: boolean;
  show_avatars: boolean;
  max_entries: number;
  metrics_included: string[];
  scoring_formula?: any;
  is_active: boolean;
  visibility: LeaderboardVisibility;
  enable_badges: boolean;
  enable_streaks: boolean;
  enable_celebrations: boolean;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

interface LeaderboardEntry {
  id: string;
  config_id: string;
  user_id: string;
  rank: number;
  previous_rank?: number;
  rank_change: number;
  total_score: number;
  score_breakdown: Record<string, any>;
  goals_achieved: number;
  goals_total: number;
  achievement_rate: number;
  streak_days: number;
  user_name?: string;
  user_avatar_url?: string;
  user_title?: string;
  calculated_at: string;
}

interface LeaderboardResponse {
  config: LeaderboardConfig;
  period: GoalPeriod;
  entries: LeaderboardEntry[];
  current_user_entry?: LeaderboardEntry;
  period_progress: number;
  last_updated: string;
}

interface GoalDashboardResponse {
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
// Leaderboard Service
// ============================================

class LeaderboardService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Goal Period Operations
  // ============================================

  /**
   * Get all goal periods
   */
  async getGoalPeriods(status?: PeriodStatus): Promise<GoalPeriod[]> {
    if (!this.supabase) {
      return this.getMockPeriods();
    }

    try {
      let query = this.supabase
        .from('goal_periods')
        .select('*')
        .order('start_date', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Leaderboard] Error fetching periods:', error);
        return this.getMockPeriods();
      }

      return data || [];
    } catch (error) {
      console.error('[Leaderboard] Error fetching periods:', error);
      return this.getMockPeriods();
    }
  }

  /**
   * Get a single goal period by ID
   */
  async getGoalPeriod(periodId: string): Promise<GoalPeriod | null> {
    if (!this.supabase) {
      const mockPeriods = this.getMockPeriods();
      return mockPeriods.find(p => p.id === periodId) || mockPeriods[0];
    }

    try {
      const { data, error } = await this.supabase
        .from('goal_periods')
        .select('*')
        .eq('id', periodId)
        .single();

      if (error) {
        console.error('[Leaderboard] Error fetching period:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Leaderboard] Error fetching period:', error);
      return null;
    }
  }

  /**
   * Get the current active period
   */
  async getCurrentPeriod(): Promise<GoalPeriod | null> {
    if (!this.supabase) {
      return this.getMockPeriods()[0];
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await this.supabase
        .from('goal_periods')
        .select('*')
        .eq('status', 'active')
        .lte('start_date', today)
        .gte('end_date', today)
        .single();

      if (error) {
        // Fallback to most recent active period
        const { data: fallbackData } = await this.supabase
          .from('goal_periods')
          .select('*')
          .eq('status', 'active')
          .order('start_date', { ascending: false })
          .limit(1)
          .single();

        return fallbackData || this.getMockPeriods()[0];
      }

      return data;
    } catch (error) {
      console.error('[Leaderboard] Error fetching current period:', error);
      return this.getMockPeriods()[0];
    }
  }

  /**
   * Create a new goal period
   */
  async createGoalPeriod(period: Omit<GoalPeriod, 'id' | 'created_at' | 'updated_at'>): Promise<GoalPeriod | null> {
    if (!this.supabase) {
      return {
        id: uuidv4(),
        ...period,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    try {
      const { data, error } = await this.supabase
        .from('goal_periods')
        .insert(period)
        .select()
        .single();

      if (error) {
        console.error('[Leaderboard] Error creating period:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Leaderboard] Error creating period:', error);
      return null;
    }
  }

  /**
   * Update a goal period
   */
  async updateGoalPeriod(periodId: string, updates: Partial<GoalPeriod>): Promise<GoalPeriod | null> {
    if (!this.supabase) {
      const mockPeriods = this.getMockPeriods();
      const period = mockPeriods.find(p => p.id === periodId);
      return period ? { ...period, ...updates } : null;
    }

    try {
      const { data, error } = await this.supabase
        .from('goal_periods')
        .update(updates)
        .eq('id', periodId)
        .select()
        .single();

      if (error) {
        console.error('[Leaderboard] Error updating period:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Leaderboard] Error updating period:', error);
      return null;
    }
  }

  // ============================================
  // Goal Operations
  // ============================================

  /**
   * Get goals for a period
   */
  async getGoals(periodId: string, userId?: string): Promise<Goal[]> {
    if (!this.supabase) {
      return this.getMockGoals(periodId, userId);
    }

    try {
      let query = this.supabase
        .from('goals')
        .select('*')
        .eq('period_id', periodId)
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.or(`user_id.eq.${userId},is_public.eq.true`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Leaderboard] Error fetching goals:', error);
        return this.getMockGoals(periodId, userId);
      }

      return data || [];
    } catch (error) {
      console.error('[Leaderboard] Error fetching goals:', error);
      return this.getMockGoals(periodId, userId);
    }
  }

  /**
   * Get a single goal by ID
   */
  async getGoal(goalId: string): Promise<Goal | null> {
    if (!this.supabase) {
      const mockGoals = this.getMockGoals('mock-period');
      return mockGoals.find(g => g.id === goalId) || null;
    }

    try {
      const { data, error } = await this.supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .single();

      if (error) {
        console.error('[Leaderboard] Error fetching goal:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Leaderboard] Error fetching goal:', error);
      return null;
    }
  }

  /**
   * Create a new goal
   */
  async createGoal(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'current_value' | 'progress_percentage' | 'status'>): Promise<Goal | null> {
    if (!this.supabase) {
      return {
        id: uuidv4(),
        ...goal,
        current_value: 0,
        progress_percentage: 0,
        status: 'not_started',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    try {
      const { data, error } = await this.supabase
        .from('goals')
        .insert({
          ...goal,
          current_value: 0,
          progress_percentage: 0,
          status: 'not_started'
        })
        .select()
        .single();

      if (error) {
        console.error('[Leaderboard] Error creating goal:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Leaderboard] Error creating goal:', error);
      return null;
    }
  }

  /**
   * Update goal progress
   */
  async updateGoalProgress(goalId: string, currentValue: number, notes?: string): Promise<Goal | null> {
    const goal = await this.getGoal(goalId);
    if (!goal) return null;

    // Calculate progress percentage
    const progress = this.calculateProgress(
      currentValue,
      goal.baseline_value || 0,
      goal.target_value,
      goal.target_direction
    );

    // Determine status
    const period = await this.getGoalPeriod(goal.period_id);
    const periodProgress = period ? this.calculatePeriodProgress(period) : 50;
    const status = this.determineGoalStatus(progress, periodProgress);

    // Check for achievements
    const previousStatus = goal.status;
    if (status === 'achieved' && previousStatus !== 'achieved' && previousStatus !== 'exceeded') {
      await this.createAchievement(goalId, goal.user_id, 'achieved', currentValue);
    } else if (status === 'exceeded' && previousStatus !== 'exceeded') {
      await this.createAchievement(goalId, goal.user_id, 'exceeded', currentValue);
    }

    if (!this.supabase) {
      return {
        ...goal,
        current_value: currentValue,
        progress_percentage: progress,
        status,
        last_calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    try {
      // Update goal
      const { data, error } = await this.supabase
        .from('goals')
        .update({
          current_value: currentValue,
          progress_percentage: progress,
          status,
          last_calculated_at: new Date().toISOString()
        })
        .eq('id', goalId)
        .select()
        .single();

      if (error) {
        console.error('[Leaderboard] Error updating goal progress:', error);
        return null;
      }

      // Record progress history
      await this.supabase.from('goal_progress_history').insert({
        goal_id: goalId,
        value: currentValue,
        progress_percentage: progress,
        status,
        notes,
        recorded_by: 'api'
      });

      return data;
    } catch (error) {
      console.error('[Leaderboard] Error updating goal progress:', error);
      return null;
    }
  }

  /**
   * Get goal progress history
   */
  async getGoalHistory(goalId: string, limit = 30): Promise<GoalProgressHistory[]> {
    if (!this.supabase) {
      return this.getMockProgressHistory(goalId);
    }

    try {
      const { data, error } = await this.supabase
        .from('goal_progress_history')
        .select('*')
        .eq('goal_id', goalId)
        .order('recorded_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[Leaderboard] Error fetching goal history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Leaderboard] Error fetching goal history:', error);
      return [];
    }
  }

  // ============================================
  // Check-in Operations
  // ============================================

  /**
   * Create a goal check-in
   */
  async createCheckIn(checkIn: Omit<GoalCheckIn, 'id' | 'created_at'>): Promise<GoalCheckIn | null> {
    if (!this.supabase) {
      return {
        id: uuidv4(),
        ...checkIn,
        created_at: new Date().toISOString()
      };
    }

    try {
      const { data, error } = await this.supabase
        .from('goal_check_ins')
        .insert(checkIn)
        .select()
        .single();

      if (error) {
        console.error('[Leaderboard] Error creating check-in:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Leaderboard] Error creating check-in:', error);
      return null;
    }
  }

  /**
   * Get check-ins for a goal
   */
  async getCheckIns(goalId: string): Promise<GoalCheckIn[]> {
    if (!this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('goal_check_ins')
        .select('*')
        .eq('goal_id', goalId)
        .order('check_in_date', { ascending: false });

      if (error) {
        console.error('[Leaderboard] Error fetching check-ins:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Leaderboard] Error fetching check-ins:', error);
      return [];
    }
  }

  // ============================================
  // Achievement Operations
  // ============================================

  /**
   * Create an achievement
   */
  async createAchievement(goalId: string, userId?: string, type: AchievementType = 'achieved', value?: number): Promise<GoalAchievement | null> {
    if (!this.supabase) {
      return {
        id: uuidv4(),
        goal_id: goalId,
        user_id: userId,
        achievement_type: type,
        achievement_value: value,
        achieved_at: new Date().toISOString(),
        acknowledged: false,
        celebrated: false
      };
    }

    try {
      const { data, error } = await this.supabase
        .from('goal_achievements')
        .insert({
          goal_id: goalId,
          user_id: userId,
          achievement_type: type,
          achievement_value: value
        })
        .select()
        .single();

      if (error) {
        console.error('[Leaderboard] Error creating achievement:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Leaderboard] Error creating achievement:', error);
      return null;
    }
  }

  /**
   * Get user achievements
   */
  async getUserAchievements(userId: string): Promise<GoalAchievement[]> {
    if (!this.supabase) {
      return this.getMockAchievements(userId);
    }

    try {
      const { data, error } = await this.supabase
        .from('goal_achievements')
        .select('*')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false });

      if (error) {
        console.error('[Leaderboard] Error fetching achievements:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Leaderboard] Error fetching achievements:', error);
      return [];
    }
  }

  /**
   * Acknowledge an achievement
   */
  async acknowledgeAchievement(achievementId: string): Promise<GoalAchievement | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('goal_achievements')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', achievementId)
        .select()
        .single();

      if (error) {
        console.error('[Leaderboard] Error acknowledging achievement:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Leaderboard] Error acknowledging achievement:', error);
      return null;
    }
  }

  // ============================================
  // Leaderboard Operations
  // ============================================

  /**
   * Get leaderboard data
   */
  async getLeaderboard(configId?: string, periodId?: string, limit = 10): Promise<LeaderboardResponse | null> {
    // Get config and period
    let config: LeaderboardConfig | null = null;
    let period: GoalPeriod | null = null;

    if (configId) {
      config = await this.getLeaderboardConfig(configId);
    }

    if (!config) {
      config = await this.getDefaultLeaderboardConfig();
    }

    if (!config) {
      return null;
    }

    if (periodId) {
      period = await this.getGoalPeriod(periodId);
    } else if (config.period_id) {
      period = await this.getGoalPeriod(config.period_id);
    } else {
      period = await this.getCurrentPeriod();
    }

    if (!period) {
      return null;
    }

    // Calculate leaderboard entries
    const entries = await this.calculateLeaderboardEntries(config, period, limit);
    const periodProgress = this.calculatePeriodProgress(period);

    return {
      config,
      period,
      entries,
      period_progress: periodProgress,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Get leaderboard config
   */
  async getLeaderboardConfig(configId: string): Promise<LeaderboardConfig | null> {
    if (!this.supabase) {
      return this.getDefaultLeaderboardConfig();
    }

    try {
      const { data, error } = await this.supabase
        .from('leaderboard_configs')
        .select('*')
        .eq('id', configId)
        .single();

      if (error) {
        console.error('[Leaderboard] Error fetching config:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Leaderboard] Error fetching config:', error);
      return null;
    }
  }

  /**
   * Get or create default leaderboard config
   */
  async getDefaultLeaderboardConfig(): Promise<LeaderboardConfig> {
    return {
      id: 'default',
      name: 'Team Leaderboard',
      description: 'Track team performance across key metrics',
      display_type: 'ranked_list',
      show_ranks: true,
      show_progress: true,
      show_change: true,
      show_avatars: true,
      max_entries: 10,
      metrics_included: ['nrr', 'retention_rate', 'health_score_avg', 'activities_logged'],
      is_active: true,
      visibility: 'team',
      enable_badges: true,
      enable_streaks: true,
      enable_celebrations: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Calculate leaderboard entries from goals
   */
  async calculateLeaderboardEntries(config: LeaderboardConfig, period: GoalPeriod, limit: number): Promise<LeaderboardEntry[]> {
    // Get existing entries for rank change calculation
    const existingEntries = await this.getExistingEntries(config.id);
    const existingRanks = new Map(existingEntries.map(e => [e.user_id, e.rank]));

    // Get all goals for the period that should be on leaderboard
    const goals = await this.getLeaderboardGoals(period.id);

    // Group goals by user
    const userGoals = new Map<string, Goal[]>();
    for (const goal of goals) {
      if (goal.user_id) {
        const existing = userGoals.get(goal.user_id) || [];
        existing.push(goal);
        userGoals.set(goal.user_id, existing);
      }
    }

    // Calculate scores for each user
    const entries: LeaderboardEntry[] = [];
    for (const [userId, userGoalList] of Array.from(userGoals.entries())) {
      const scoreBreakdown: Record<string, any> = {};
      let totalScore = 0;
      let goalsAchieved = 0;
      let goalsTotal = userGoalList.length;

      for (const goal of userGoalList) {
        const metricKey = goal.metric_name || goal.name;
        const weightedScore = goal.progress_percentage * (goal.weight || 1);

        scoreBreakdown[metricKey] = {
          value: goal.current_value,
          progress: goal.progress_percentage,
          weight: goal.weight || 1,
          weighted_score: weightedScore
        };

        totalScore += weightedScore;

        if (goal.status === 'achieved' || goal.status === 'exceeded') {
          goalsAchieved++;
        }
      }

      // Normalize score
      const avgScore = goalsTotal > 0 ? totalScore / goalsTotal : 0;

      entries.push({
        id: uuidv4(),
        config_id: config.id,
        user_id: userId,
        rank: 0, // Will be set after sorting
        previous_rank: existingRanks.get(userId),
        rank_change: 0, // Will be calculated
        total_score: avgScore,
        score_breakdown: scoreBreakdown,
        goals_achieved: goalsAchieved,
        goals_total: goalsTotal,
        achievement_rate: goalsTotal > 0 ? (goalsAchieved / goalsTotal) * 100 : 0,
        streak_days: 0, // TODO: Calculate from check-ins
        user_name: await this.getUserName(userId),
        user_avatar_url: await this.getUserAvatar(userId),
        user_title: await this.getUserTitle(userId),
        calculated_at: new Date().toISOString()
      });
    }

    // Sort by total score descending
    entries.sort((a, b) => b.total_score - a.total_score);

    // Assign ranks and calculate rank change
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
      if (entry.previous_rank) {
        entry.rank_change = entry.previous_rank - entry.rank;
      }
    });

    return entries.slice(0, limit);
  }

  /**
   * Get existing leaderboard entries for rank comparison
   */
  async getExistingEntries(configId: string): Promise<LeaderboardEntry[]> {
    if (!this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('leaderboard_entries')
        .select('*')
        .eq('config_id', configId);

      if (error) {
        console.error('[Leaderboard] Error fetching existing entries:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Leaderboard] Error fetching existing entries:', error);
      return [];
    }
  }

  /**
   * Get goals that should appear on leaderboard
   */
  async getLeaderboardGoals(periodId: string): Promise<Goal[]> {
    if (!this.supabase) {
      return this.getMockGoals(periodId);
    }

    try {
      const { data, error } = await this.supabase
        .from('goals')
        .select('*')
        .eq('period_id', periodId)
        .eq('show_in_leaderboard', true)
        .eq('owner_type', 'individual');

      if (error) {
        console.error('[Leaderboard] Error fetching leaderboard goals:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Leaderboard] Error fetching leaderboard goals:', error);
      return [];
    }
  }

  /**
   * Save leaderboard entries to cache
   */
  async saveLeaderboardEntries(entries: LeaderboardEntry[]): Promise<void> {
    if (!this.supabase || entries.length === 0) return;

    try {
      // Delete existing entries for this config
      await this.supabase
        .from('leaderboard_entries')
        .delete()
        .eq('config_id', entries[0].config_id);

      // Insert new entries
      await this.supabase
        .from('leaderboard_entries')
        .insert(entries);
    } catch (error) {
      console.error('[Leaderboard] Error saving entries:', error);
    }
  }

  // ============================================
  // Goal Dashboard
  // ============================================

  /**
   * Get goal dashboard for a user
   */
  async getGoalDashboard(userId: string, periodId?: string): Promise<GoalDashboardResponse | null> {
    const period = periodId ? await this.getGoalPeriod(periodId) : await this.getCurrentPeriod();
    if (!period) return null;

    const allGoals = await this.getGoals(period.id, userId);
    const teamGoals = allGoals.filter(g => g.owner_type === 'team');
    const individualGoals = allGoals.filter(g => g.owner_type === 'individual' && g.user_id === userId);

    const contributions = await this.getUserContributions(userId, period.id);
    const achievements = await this.getUserAchievements(userId);
    const recentAchievements = achievements.filter(a => {
      const achievedDate = new Date(a.achieved_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return achievedDate >= thirtyDaysAgo;
    });

    // Get upcoming deadlines (goals ending in next 14 days)
    const today = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
    const upcomingDeadlines = individualGoals.filter(g => {
      const endDate = new Date(period.end_date);
      return endDate <= twoWeeksLater && g.status !== 'achieved' && g.status !== 'exceeded';
    });

    // Calculate progress summary
    const userGoals = individualGoals;
    const progressSummary = {
      total_goals: userGoals.length,
      achieved: userGoals.filter(g => g.status === 'achieved' || g.status === 'exceeded').length,
      on_track: userGoals.filter(g => g.status === 'on_track').length,
      at_risk: userGoals.filter(g => g.status === 'at_risk').length,
      behind: userGoals.filter(g => g.status === 'behind').length,
      average_progress: userGoals.length > 0
        ? userGoals.reduce((sum, g) => sum + g.progress_percentage, 0) / userGoals.length
        : 0
    };

    return {
      period,
      team_goals: teamGoals,
      individual_goals: individualGoals,
      contributions,
      recent_achievements: recentAchievements,
      upcoming_deadlines: upcomingDeadlines,
      progress_summary: progressSummary
    };
  }

  /**
   * Get user contributions to team goals
   */
  async getUserContributions(userId: string, periodId: string): Promise<GoalContribution[]> {
    if (!this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('goal_contributions')
        .select(`
          *,
          team_goal:team_goal_id(*)
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('[Leaderboard] Error fetching contributions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Leaderboard] Error fetching contributions:', error);
      return [];
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Calculate progress percentage
   */
  private calculateProgress(
    currentValue: number,
    baselineValue: number,
    targetValue: number,
    direction: TargetDirection
  ): number {
    if (direction === 'increase') {
      const totalChange = targetValue - baselineValue;
      const currentChange = currentValue - baselineValue;
      if (totalChange === 0) return 100;
      return Math.max(0, Math.min(150, (currentChange / totalChange) * 100));
    } else if (direction === 'decrease') {
      const totalChange = baselineValue - targetValue;
      const currentChange = baselineValue - currentValue;
      if (totalChange === 0) return 100;
      return Math.max(0, Math.min(150, (currentChange / totalChange) * 100));
    } else {
      // Maintain: calculate deviation from target
      if (targetValue === 0) return 100;
      const deviation = Math.abs(currentValue - targetValue) / targetValue * 100;
      return Math.max(0, 100 - deviation);
    }
  }

  /**
   * Determine goal status based on progress
   */
  private determineGoalStatus(progress: number, periodProgress: number): GoalStatus {
    if (progress >= 110) return 'exceeded';
    if (progress >= 100) return 'achieved';
    if (progress >= periodProgress - 5) return 'on_track';
    if (progress >= periodProgress - 20) return 'at_risk';
    return 'behind';
  }

  /**
   * Calculate how far through a period we are
   */
  private calculatePeriodProgress(period: GoalPeriod): number {
    const start = new Date(period.start_date).getTime();
    const end = new Date(period.end_date).getTime();
    const now = Date.now();

    if (now <= start) return 0;
    if (now >= end) return 100;

    return ((now - start) / (end - start)) * 100;
  }

  /**
   * Get user name (placeholder - should integrate with user service)
   */
  private async getUserName(userId: string): Promise<string> {
    // TODO: Integrate with user service
    const names = ['Sarah Chen', 'Mike Torres', 'Jennifer Park', 'Alex Kim', 'Jordan Smith', 'Casey Taylor'];
    const index = userId.charCodeAt(0) % names.length;
    return names[index];
  }

  /**
   * Get user avatar (placeholder)
   */
  private async getUserAvatar(userId: string): Promise<string> {
    // TODO: Integrate with user service
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
  }

  /**
   * Get user title (placeholder)
   */
  private async getUserTitle(userId: string): Promise<string> {
    // TODO: Integrate with user service
    const titles = ['Senior CSM', 'CSM', 'Enterprise CSM', 'CSM Lead', 'Strategic CSM'];
    const index = userId.charCodeAt(0) % titles.length;
    return titles[index];
  }

  // ============================================
  // Mock Data (for development without database)
  // ============================================

  private getMockPeriods(): GoalPeriod[] {
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);

    return [
      {
        id: 'q1-2026',
        name: 'Q1 2026',
        description: 'First quarter goals',
        period_type: 'quarterly',
        start_date: quarterStart.toISOString().split('T')[0],
        end_date: quarterEnd.toISOString().split('T')[0],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'fy-2026',
        name: 'FY 2026',
        description: 'Annual goals',
        period_type: 'annual',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }

  private getMockGoals(periodId: string, userId?: string): Goal[] {
    const users = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
    const goals: Goal[] = [];

    for (const user of users) {
      goals.push(
        {
          id: `goal-nrr-${user}`,
          period_id: periodId,
          owner_type: 'individual',
          user_id: user,
          name: 'Net Revenue Retention',
          description: 'Maintain NRR above target',
          goal_type: 'metric',
          metric_name: 'nrr',
          baseline_value: 95,
          target_value: 110,
          stretch_target_value: 115,
          target_direction: 'increase',
          current_value: 100 + Math.random() * 20,
          progress_percentage: 60 + Math.random() * 50,
          status: 'on_track',
          is_public: true,
          show_in_leaderboard: true,
          weight: 1.5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: `goal-retention-${user}`,
          period_id: periodId,
          owner_type: 'individual',
          user_id: user,
          name: 'Customer Retention',
          description: 'Maintain customer retention rate',
          goal_type: 'metric',
          metric_name: 'retention_rate',
          baseline_value: 90,
          target_value: 95,
          stretch_target_value: 98,
          target_direction: 'increase',
          current_value: 90 + Math.random() * 10,
          progress_percentage: 50 + Math.random() * 60,
          status: 'on_track',
          is_public: true,
          show_in_leaderboard: true,
          weight: 1.2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      );
    }

    if (userId) {
      return goals.filter(g => g.user_id === userId || g.is_public);
    }

    return goals;
  }

  private getMockProgressHistory(goalId: string): GoalProgressHistory[] {
    const history: GoalProgressHistory[] = [];
    const baseValue = 50;

    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      history.push({
        id: `history-${goalId}-${i}`,
        goal_id: goalId,
        recorded_at: date.toISOString(),
        value: baseValue + (30 - i) * 1.5 + Math.random() * 5,
        progress_percentage: ((30 - i) / 30) * 100 + Math.random() * 10,
        status: 'on_track',
        recorded_by: 'system'
      });
    }

    return history;
  }

  private getMockAchievements(userId: string): GoalAchievement[] {
    return [
      {
        id: `achievement-1-${userId}`,
        goal_id: `goal-nrr-${userId}`,
        user_id: userId,
        achievement_type: 'milestone',
        achievement_value: 105,
        achieved_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        acknowledged: true,
        celebrated: false
      },
      {
        id: `achievement-2-${userId}`,
        goal_id: `goal-retention-${userId}`,
        user_id: userId,
        achievement_type: 'streak',
        achievement_value: 7,
        achieved_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        acknowledged: false,
        celebrated: false
      }
    ];
  }
}

// Export singleton instance
export const leaderboardService = new LeaderboardService();
export default leaderboardService;
