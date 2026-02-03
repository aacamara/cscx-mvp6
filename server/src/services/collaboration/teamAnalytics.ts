/**
 * Team Analytics Service
 *
 * PRD-260: Team Goal Tracking
 *
 * Handles goal creation, progress tracking, metric calculations,
 * and team analytics for CS teams.
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export type PeriodType = 'monthly' | 'quarterly' | 'annual';
export type PeriodStatus = 'planning' | 'active' | 'completed';
export type GoalType = 'metric' | 'task' | 'milestone';
export type OwnerType = 'team' | 'individual';
export type GoalStatus = 'on_track' | 'at_risk' | 'behind' | 'achieved' | 'exceeded';
export type TargetDirection = 'increase' | 'decrease' | 'maintain';
export type AchievementType = 'achieved' | 'exceeded' | 'milestone' | 'streak';

export interface GoalPeriod {
  id: string;
  name: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  period_id: string;
  parent_goal_id?: string;
  owner_type: OwnerType;
  team_id?: string;
  user_id?: string;
  name: string;
  description?: string;
  goal_type: GoalType;
  metric_name?: string;
  metric_calculation?: Record<string, unknown>;
  baseline_value?: number;
  target_value?: number;
  stretch_target_value?: number;
  target_direction: TargetDirection;
  task_count_target?: number;
  milestones?: Milestone[];
  current_value?: number;
  progress_percentage: number;
  status: GoalStatus;
  last_calculated_at?: string;
  is_public: boolean;
  show_in_leaderboard: boolean;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  period?: GoalPeriod;
  parent_goal?: Goal;
  child_goals?: Goal[];
  contributions?: GoalContribution[];
  recent_progress?: GoalProgressPoint[];
}

export interface Milestone {
  id: string;
  name: string;
  target_date: string;
  completed: boolean;
  completed_at?: string;
}

export interface GoalProgressPoint {
  id: string;
  goal_id: string;
  recorded_at: string;
  value: number;
  progress_percentage: number;
  status: GoalStatus;
  notes?: string;
}

export interface GoalCheckIn {
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

export interface GoalContribution {
  id: string;
  team_goal_id: string;
  individual_goal_id: string;
  user_id: string;
  contribution_value?: number;
  contribution_percentage?: number;
  calculated_at: string;
}

export interface GoalAchievement {
  id: string;
  goal_id: string;
  user_id?: string;
  achievement_type: AchievementType;
  achievement_name?: string;
  achieved_at: string;
  acknowledged: boolean;
  celebrated: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateGoalPeriodInput {
  name: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  status?: PeriodStatus;
  created_by_user_id?: string;
}

export interface CreateGoalInput {
  period_id: string;
  parent_goal_id?: string;
  owner_type: OwnerType;
  team_id?: string;
  user_id?: string;
  name: string;
  description?: string;
  goal_type: GoalType;
  metric_name?: string;
  metric_calculation?: Record<string, unknown>;
  baseline_value?: number;
  target_value?: number;
  stretch_target_value?: number;
  target_direction?: TargetDirection;
  task_count_target?: number;
  milestones?: Milestone[];
  is_public?: boolean;
  show_in_leaderboard?: boolean;
  created_by_user_id?: string;
}

export interface UpdateGoalInput {
  name?: string;
  description?: string;
  target_value?: number;
  stretch_target_value?: number;
  current_value?: number;
  progress_percentage?: number;
  status?: GoalStatus;
  milestones?: Milestone[];
  is_public?: boolean;
  show_in_leaderboard?: boolean;
}

export interface TeamDashboard {
  period: GoalPeriod;
  team_goals: Goal[];
  summary: {
    total_goals: number;
    on_track_count: number;
    at_risk_count: number;
    behind_count: number;
    achieved_count: number;
    average_progress: number;
  };
  leaderboard: LeaderboardEntry[];
  recent_achievements: GoalAchievement[];
}

export interface LeaderboardEntry {
  user_id: string;
  user_name?: string;
  goals_count: number;
  achieved_count: number;
  average_progress: number;
  total_contribution_value: number;
  rank: number;
}

export interface IndividualDashboard {
  period: GoalPeriod;
  individual_goals: Goal[];
  team_contributions: GoalContribution[];
  summary: {
    total_goals: number;
    on_track_count: number;
    achieved_count: number;
    average_progress: number;
    team_contribution_percentage: number;
  };
  achievements: GoalAchievement[];
  upcoming_milestones: Milestone[];
}

// ============================================
// Metric Calculators
// ============================================

interface DateRange {
  start: Date;
  end: Date;
}

interface MetricScope {
  team_id?: string;
  user_id?: string;
}

type MetricCalculatorFn = (scope: MetricScope, period: DateRange) => Promise<number>;

const metricCalculators: Record<string, MetricCalculatorFn> = {
  nrr: async (scope, period) => {
    if (!supabase) return 0;

    // Get customers for scope
    let query = supabase.from('customers').select('id, arr');
    if (scope.user_id) {
      query = query.eq('csm_id', scope.user_id);
    }
    const { data: customers } = await query;
    if (!customers || customers.length === 0) return 100;

    // Calculate start and end ARR
    const customerIds = customers.map(c => c.id);
    const startArr = customers.reduce((sum, c) => sum + (Number(c.arr) || 0), 0);

    // Get renewals and expansions in period
    const { data: renewals } = await supabase
      .from('customers')
      .select('arr, previous_arr')
      .in('id', customerIds);

    const endArr = renewals?.reduce((sum, r) => sum + (Number(r.arr) || 0), 0) || startArr;

    return startArr > 0 ? Math.round((endArr / startArr) * 100) : 100;
  },

  retention_rate: async (scope, period) => {
    if (!supabase) return 0;

    let query = supabase.from('customers').select('id, status');
    if (scope.user_id) {
      query = query.eq('csm_id', scope.user_id);
    }
    const { data: customers } = await query;
    if (!customers || customers.length === 0) return 100;

    const activeCount = customers.filter(c => c.status !== 'churned').length;
    return Math.round((activeCount / customers.length) * 100);
  },

  nps: async (scope, period) => {
    if (!supabase) return 0;

    let query = supabase
      .from('nps_responses')
      .select('score, category')
      .gte('submitted_at', period.start.toISOString())
      .lte('submitted_at', period.end.toISOString());

    const { data: responses } = await query;
    if (!responses || responses.length === 0) return 0;

    const promoters = responses.filter(r => r.category === 'promoter').length;
    const detractors = responses.filter(r => r.category === 'detractor').length;

    return Math.round(((promoters - detractors) / responses.length) * 100);
  },

  qbr_completion: async (scope, period) => {
    if (!supabase) return 0;

    let customerQuery = supabase.from('customers').select('id');
    if (scope.user_id) {
      customerQuery = customerQuery.eq('csm_id', scope.user_id);
    }
    const { data: customers } = await customerQuery;
    if (!customers || customers.length === 0) return 0;

    const customerIds = customers.map(c => c.id);
    const { count } = await supabase
      .from('qbrs')
      .select('*', { count: 'exact', head: true })
      .in('customer_id', customerIds)
      .eq('status', 'completed')
      .gte('completed_at', period.start.toISOString())
      .lte('completed_at', period.end.toISOString());

    return Math.round(((count || 0) / customers.length) * 100);
  },

  health_score_avg: async (scope, _period) => {
    if (!supabase) return 0;

    let query = supabase.from('customers').select('health_score');
    if (scope.user_id) {
      query = query.eq('csm_id', scope.user_id);
    }
    const { data: customers } = await query;
    if (!customers || customers.length === 0) return 0;

    const totalScore = customers.reduce((sum, c) => sum + (Number(c.health_score) || 0), 0);
    return Math.round(totalScore / customers.length);
  },

  churn_rate: async (scope, period) => {
    if (!supabase) return 0;

    let query = supabase.from('customers').select('id, status, churned_at');
    if (scope.user_id) {
      query = query.eq('csm_id', scope.user_id);
    }
    const { data: customers } = await query;
    if (!customers || customers.length === 0) return 0;

    const churned = customers.filter(c =>
      c.status === 'churned' &&
      c.churned_at &&
      new Date(c.churned_at) >= period.start &&
      new Date(c.churned_at) <= period.end
    ).length;

    return Math.round((churned / customers.length) * 100);
  },
};

// ============================================
// Goal Period Functions
// ============================================

/**
 * Create a new goal period
 */
export async function createGoalPeriod(input: CreateGoalPeriodInput): Promise<GoalPeriod | null> {
  if (!supabase) return null;

  const id = uuidv4();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('goal_periods')
    .insert({
      id,
      name: input.name,
      period_type: input.period_type,
      start_date: input.start_date,
      end_date: input.end_date,
      status: input.status || 'planning',
      created_by_user_id: input.created_by_user_id,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating goal period:', error);
    return null;
  }

  return mapDbGoalPeriod(data);
}

/**
 * Get all goal periods
 */
export async function getGoalPeriods(status?: PeriodStatus): Promise<GoalPeriod[]> {
  if (!supabase) return [];

  let query = supabase
    .from('goal_periods')
    .select('*')
    .order('start_date', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map(mapDbGoalPeriod);
}

/**
 * Get a single goal period by ID
 */
export async function getGoalPeriod(id: string): Promise<GoalPeriod | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('goal_periods')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return mapDbGoalPeriod(data);
}

/**
 * Update a goal period
 */
export async function updateGoalPeriod(
  id: string,
  updates: Partial<Pick<GoalPeriod, 'name' | 'status'>>
): Promise<GoalPeriod | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('goal_periods')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return null;

  return mapDbGoalPeriod(data);
}

// ============================================
// Goal Functions
// ============================================

/**
 * Create a new goal
 */
export async function createGoal(input: CreateGoalInput): Promise<Goal | null> {
  if (!supabase) return null;

  const id = uuidv4();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('goals')
    .insert({
      id,
      period_id: input.period_id,
      parent_goal_id: input.parent_goal_id,
      owner_type: input.owner_type,
      team_id: input.team_id,
      user_id: input.user_id,
      name: input.name,
      description: input.description,
      goal_type: input.goal_type,
      metric_name: input.metric_name,
      metric_calculation: input.metric_calculation,
      baseline_value: input.baseline_value,
      target_value: input.target_value,
      stretch_target_value: input.stretch_target_value,
      target_direction: input.target_direction || 'increase',
      task_count_target: input.task_count_target,
      milestones: input.milestones || [],
      progress_percentage: 0,
      status: 'on_track',
      is_public: input.is_public ?? true,
      show_in_leaderboard: input.show_in_leaderboard ?? true,
      created_by_user_id: input.created_by_user_id,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating goal:', error);
    return null;
  }

  return mapDbGoal(data);
}

/**
 * Get goals with filters
 */
export async function getGoals(filters: {
  period_id?: string;
  owner_type?: OwnerType;
  user_id?: string;
  team_id?: string;
  status?: GoalStatus;
  parent_goal_id?: string;
}): Promise<Goal[]> {
  if (!supabase) return [];

  let query = supabase
    .from('goals')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.period_id) {
    query = query.eq('period_id', filters.period_id);
  }
  if (filters.owner_type) {
    query = query.eq('owner_type', filters.owner_type);
  }
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.team_id) {
    query = query.eq('team_id', filters.team_id);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.parent_goal_id) {
    query = query.eq('parent_goal_id', filters.parent_goal_id);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map(mapDbGoal);
}

/**
 * Get a single goal by ID with related data
 */
export async function getGoal(id: string): Promise<Goal | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const goal = mapDbGoal(data);

  // Get child goals if this is a team goal
  if (goal.owner_type === 'team') {
    const { data: children } = await supabase
      .from('goals')
      .select('*')
      .eq('parent_goal_id', id);
    goal.child_goals = children?.map(mapDbGoal) || [];
  }

  // Get recent progress
  const { data: progress } = await supabase
    .from('goal_progress_history')
    .select('*')
    .eq('goal_id', id)
    .order('recorded_at', { ascending: false })
    .limit(10);
  goal.recent_progress = progress?.map(mapDbProgressPoint) || [];

  return goal;
}

/**
 * Update a goal
 */
export async function updateGoal(id: string, updates: UpdateGoalInput): Promise<Goal | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return null;

  return mapDbGoal(data);
}

/**
 * Delete a goal
 */
export async function deleteGoal(id: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id);

  return !error;
}

// ============================================
// Progress Tracking
// ============================================

/**
 * Calculate and update goal progress
 */
export async function updateGoalProgress(goalId: string): Promise<Goal | null> {
  if (!supabase) return null;

  const goal = await getGoal(goalId);
  if (!goal) return null;

  // Skip if not a metric-based goal
  if (goal.goal_type !== 'metric' || !goal.metric_name) {
    return goal;
  }

  // Get calculator
  const calculator = metricCalculators[goal.metric_name];
  if (!calculator) {
    console.warn(`No calculator for metric: ${goal.metric_name}`);
    return goal;
  }

  // Get period for date range
  const period = await getGoalPeriod(goal.period_id);
  if (!period) return goal;

  // Calculate current value
  const scope: MetricScope = goal.owner_type === 'team'
    ? { team_id: goal.team_id }
    : { user_id: goal.user_id };

  const dateRange: DateRange = {
    start: new Date(period.start_date),
    end: new Date(),
  };

  try {
    const currentValue = await calculator(scope, dateRange);
    const progress = calculateProgress(
      goal.baseline_value || 0,
      goal.target_value || 100,
      currentValue,
      goal.target_direction
    );
    const status = determineStatus(progress, period);

    // Update goal
    const updatedGoal = await updateGoal(goalId, {
      current_value: currentValue,
      progress_percentage: progress,
      status,
    });

    // Record progress history
    await recordProgressHistory(goalId, currentValue, progress, status);

    // Check for achievements
    await checkAchievements(goalId, currentValue, goal.target_value || 100, goal.stretch_target_value);

    return updatedGoal;
  } catch (error) {
    console.error('Error calculating goal progress:', error);
    return goal;
  }
}

/**
 * Record a progress history point
 */
async function recordProgressHistory(
  goalId: string,
  value: number,
  progress: number,
  status: GoalStatus,
  notes?: string
): Promise<void> {
  if (!supabase) return;

  await supabase.from('goal_progress_history').insert({
    id: uuidv4(),
    goal_id: goalId,
    recorded_at: new Date().toISOString(),
    value,
    progress_percentage: progress,
    status,
    notes,
  });
}

/**
 * Get progress history for a goal
 */
export async function getGoalProgressHistory(
  goalId: string,
  limit = 30
): Promise<GoalProgressPoint[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('goal_progress_history')
    .select('*')
    .eq('goal_id', goalId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(mapDbProgressPoint);
}

/**
 * Refresh all goals for a period
 */
export async function refreshPeriodGoals(periodId: string): Promise<void> {
  const goals = await getGoals({ period_id: periodId });

  for (const goal of goals) {
    if (goal.goal_type === 'metric') {
      await updateGoalProgress(goal.id);
    }
  }
}

// ============================================
// Check-ins
// ============================================

/**
 * Create a goal check-in
 */
export async function createCheckIn(input: {
  goal_id: string;
  user_id: string;
  progress_notes?: string;
  blockers?: string;
  support_needed?: string;
  confidence_level?: number;
}): Promise<GoalCheckIn | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('goal_check_ins')
    .insert({
      id: uuidv4(),
      goal_id: input.goal_id,
      user_id: input.user_id,
      check_in_date: new Date().toISOString().split('T')[0],
      progress_notes: input.progress_notes,
      blockers: input.blockers,
      support_needed: input.support_needed,
      confidence_level: input.confidence_level,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) return null;

  return mapDbCheckIn(data);
}

/**
 * Get check-ins for a goal
 */
export async function getGoalCheckIns(goalId: string): Promise<GoalCheckIn[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('goal_check_ins')
    .select('*')
    .eq('goal_id', goalId)
    .order('check_in_date', { ascending: false });

  if (error || !data) return [];

  return data.map(mapDbCheckIn);
}

// ============================================
// Contributions
// ============================================

/**
 * Calculate contributions from individual goals to team goals
 */
export async function calculateContributions(teamGoalId: string): Promise<GoalContribution[]> {
  if (!supabase) return [];

  const teamGoal = await getGoal(teamGoalId);
  if (!teamGoal || teamGoal.owner_type !== 'team') return [];

  // Get child goals
  const { data: childGoals } = await supabase
    .from('goals')
    .select('*')
    .eq('parent_goal_id', teamGoalId);

  if (!childGoals || childGoals.length === 0) return [];

  const contributions: GoalContribution[] = [];
  const totalProgress = childGoals.reduce((sum, g) => sum + (Number(g.progress_percentage) || 0), 0);

  for (const childGoal of childGoals) {
    const contributionPercentage = totalProgress > 0
      ? (Number(childGoal.progress_percentage) / totalProgress) * 100
      : 0;

    const contribution: GoalContribution = {
      id: uuidv4(),
      team_goal_id: teamGoalId,
      individual_goal_id: childGoal.id,
      user_id: childGoal.user_id,
      contribution_value: childGoal.current_value,
      contribution_percentage: Math.round(contributionPercentage * 100) / 100,
      calculated_at: new Date().toISOString(),
    };

    // Upsert contribution
    await supabase.from('goal_contributions').upsert({
      ...contribution,
    }, {
      onConflict: 'team_goal_id,individual_goal_id',
    });

    contributions.push(contribution);
  }

  return contributions;
}

/**
 * Get contributions for a user
 */
export async function getUserContributions(userId: string): Promise<GoalContribution[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('goal_contributions')
    .select('*')
    .eq('user_id', userId)
    .order('calculated_at', { ascending: false });

  if (error || !data) return [];

  return data.map(mapDbContribution);
}

// ============================================
// Achievements
// ============================================

/**
 * Check and record achievements
 */
async function checkAchievements(
  goalId: string,
  currentValue: number,
  targetValue: number,
  stretchTarget?: number
): Promise<void> {
  if (!supabase) return;

  const goal = await getGoal(goalId);
  if (!goal) return;

  // Check if already achieved
  const { data: existingAchievement } = await supabase
    .from('goal_achievements')
    .select('id')
    .eq('goal_id', goalId)
    .eq('achievement_type', 'achieved')
    .single();

  if (!existingAchievement && currentValue >= targetValue) {
    // Record achievement
    await supabase.from('goal_achievements').insert({
      id: uuidv4(),
      goal_id: goalId,
      user_id: goal.user_id,
      achievement_type: currentValue >= (stretchTarget || targetValue) ? 'exceeded' : 'achieved',
      achievement_name: `Goal Achieved: ${goal.name}`,
      achieved_at: new Date().toISOString(),
      acknowledged: false,
      celebrated: false,
      metadata: {
        target_value: targetValue,
        achieved_value: currentValue,
        stretch_target: stretchTarget,
      },
    });
  }
}

/**
 * Get achievements
 */
export async function getAchievements(filters: {
  goal_id?: string;
  user_id?: string;
  acknowledged?: boolean;
}): Promise<GoalAchievement[]> {
  if (!supabase) return [];

  let query = supabase
    .from('goal_achievements')
    .select('*')
    .order('achieved_at', { ascending: false });

  if (filters.goal_id) {
    query = query.eq('goal_id', filters.goal_id);
  }
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.acknowledged !== undefined) {
    query = query.eq('acknowledged', filters.acknowledged);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map(mapDbAchievement);
}

/**
 * Acknowledge an achievement
 */
export async function acknowledgeAchievement(achievementId: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('goal_achievements')
    .update({ acknowledged: true })
    .eq('id', achievementId);

  return !error;
}

/**
 * Celebrate an achievement
 */
export async function celebrateAchievement(achievementId: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('goal_achievements')
    .update({ celebrated: true })
    .eq('id', achievementId);

  return !error;
}

// ============================================
// Dashboards
// ============================================

/**
 * Get team dashboard
 */
export async function getTeamDashboard(periodId: string, teamId?: string): Promise<TeamDashboard | null> {
  const period = await getGoalPeriod(periodId);
  if (!period) return null;

  const teamGoals = await getGoals({
    period_id: periodId,
    owner_type: 'team',
    team_id: teamId,
  });

  // Calculate summary
  const summary = {
    total_goals: teamGoals.length,
    on_track_count: teamGoals.filter(g => g.status === 'on_track').length,
    at_risk_count: teamGoals.filter(g => g.status === 'at_risk').length,
    behind_count: teamGoals.filter(g => g.status === 'behind').length,
    achieved_count: teamGoals.filter(g => g.status === 'achieved' || g.status === 'exceeded').length,
    average_progress: teamGoals.length > 0
      ? Math.round(teamGoals.reduce((sum, g) => sum + g.progress_percentage, 0) / teamGoals.length)
      : 0,
  };

  // Get leaderboard
  const leaderboard = await getLeaderboard(periodId);

  // Get recent achievements
  const achievements = await getAchievements({ acknowledged: false });

  return {
    period,
    team_goals: teamGoals,
    summary,
    leaderboard,
    recent_achievements: achievements.slice(0, 5),
  };
}

/**
 * Get individual dashboard
 */
export async function getIndividualDashboard(periodId: string, userId: string): Promise<IndividualDashboard | null> {
  const period = await getGoalPeriod(periodId);
  if (!period) return null;

  const individualGoals = await getGoals({
    period_id: periodId,
    owner_type: 'individual',
    user_id: userId,
  });

  const contributions = await getUserContributions(userId);

  // Calculate summary
  const totalContribution = contributions.reduce((sum, c) => sum + (c.contribution_percentage || 0), 0);
  const summary = {
    total_goals: individualGoals.length,
    on_track_count: individualGoals.filter(g => g.status === 'on_track').length,
    achieved_count: individualGoals.filter(g => g.status === 'achieved' || g.status === 'exceeded').length,
    average_progress: individualGoals.length > 0
      ? Math.round(individualGoals.reduce((sum, g) => sum + g.progress_percentage, 0) / individualGoals.length)
      : 0,
    team_contribution_percentage: Math.round(totalContribution),
  };

  // Get achievements
  const achievements = await getAchievements({ user_id: userId });

  // Get upcoming milestones
  const upcomingMilestones: Milestone[] = [];
  for (const goal of individualGoals) {
    if (goal.milestones) {
      const upcoming = goal.milestones.filter(m =>
        !m.completed && new Date(m.target_date) > new Date()
      );
      upcomingMilestones.push(...upcoming);
    }
  }
  upcomingMilestones.sort((a, b) =>
    new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
  );

  return {
    period,
    individual_goals: individualGoals,
    team_contributions: contributions,
    summary,
    achievements,
    upcoming_milestones: upcomingMilestones.slice(0, 5),
  };
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(periodId: string): Promise<LeaderboardEntry[]> {
  if (!supabase) return [];

  // Get all individual goals for the period
  const goals = await getGoals({
    period_id: periodId,
    owner_type: 'individual',
  });

  // Group by user
  const userMap = new Map<string, {
    goals_count: number;
    achieved_count: number;
    total_progress: number;
    total_contribution: number;
  }>();

  for (const goal of goals) {
    if (!goal.user_id) continue;

    const existing = userMap.get(goal.user_id) || {
      goals_count: 0,
      achieved_count: 0,
      total_progress: 0,
      total_contribution: 0,
    };

    existing.goals_count++;
    if (goal.status === 'achieved' || goal.status === 'exceeded') {
      existing.achieved_count++;
    }
    existing.total_progress += goal.progress_percentage;

    userMap.set(goal.user_id, existing);
  }

  // Convert to leaderboard entries
  const entries: LeaderboardEntry[] = Array.from(userMap.entries()).map(([userId, data]) => ({
    user_id: userId,
    goals_count: data.goals_count,
    achieved_count: data.achieved_count,
    average_progress: Math.round(data.total_progress / data.goals_count),
    total_contribution_value: data.total_contribution,
    rank: 0,
  }));

  // Sort by achieved count, then average progress
  entries.sort((a, b) => {
    if (b.achieved_count !== a.achieved_count) {
      return b.achieved_count - a.achieved_count;
    }
    return b.average_progress - a.average_progress;
  });

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

// ============================================
// Helper Functions
// ============================================

function calculateProgress(
  baseline: number,
  target: number,
  current: number,
  direction: TargetDirection
): number {
  const range = Math.abs(target - baseline);
  if (range === 0) return current >= target ? 100 : 0;

  let progress: number;
  if (direction === 'increase') {
    progress = ((current - baseline) / range) * 100;
  } else if (direction === 'decrease') {
    progress = ((baseline - current) / range) * 100;
  } else {
    // maintain - measure deviation
    const deviation = Math.abs(current - target);
    progress = Math.max(0, 100 - (deviation / range) * 100);
  }

  return Math.min(100, Math.max(0, Math.round(progress)));
}

function determineStatus(progress: number, period: GoalPeriod): GoalStatus {
  const now = new Date();
  const start = new Date(period.start_date);
  const end = new Date(period.end_date);
  const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const expectedProgress = (elapsedDays / totalDays) * 100;

  if (progress >= 100) return 'exceeded';
  if (progress >= 95) return 'achieved';
  if (progress >= expectedProgress - 10) return 'on_track';
  if (progress >= expectedProgress - 25) return 'at_risk';
  return 'behind';
}

// ============================================
// Database Mappers
// ============================================

function mapDbGoalPeriod(row: Record<string, unknown>): GoalPeriod {
  return {
    id: row.id as string,
    name: row.name as string,
    period_type: row.period_type as PeriodType,
    start_date: row.start_date as string,
    end_date: row.end_date as string,
    status: row.status as PeriodStatus,
    created_by_user_id: row.created_by_user_id as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapDbGoal(row: Record<string, unknown>): Goal {
  return {
    id: row.id as string,
    period_id: row.period_id as string,
    parent_goal_id: row.parent_goal_id as string | undefined,
    owner_type: row.owner_type as OwnerType,
    team_id: row.team_id as string | undefined,
    user_id: row.user_id as string | undefined,
    name: row.name as string,
    description: row.description as string | undefined,
    goal_type: row.goal_type as GoalType,
    metric_name: row.metric_name as string | undefined,
    metric_calculation: row.metric_calculation as Record<string, unknown> | undefined,
    baseline_value: row.baseline_value as number | undefined,
    target_value: row.target_value as number | undefined,
    stretch_target_value: row.stretch_target_value as number | undefined,
    target_direction: row.target_direction as TargetDirection,
    task_count_target: row.task_count_target as number | undefined,
    milestones: row.milestones as Milestone[] | undefined,
    current_value: row.current_value as number | undefined,
    progress_percentage: row.progress_percentage as number,
    status: row.status as GoalStatus,
    last_calculated_at: row.last_calculated_at as string | undefined,
    is_public: row.is_public as boolean,
    show_in_leaderboard: row.show_in_leaderboard as boolean,
    created_by_user_id: row.created_by_user_id as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapDbProgressPoint(row: Record<string, unknown>): GoalProgressPoint {
  return {
    id: row.id as string,
    goal_id: row.goal_id as string,
    recorded_at: row.recorded_at as string,
    value: row.value as number,
    progress_percentage: row.progress_percentage as number,
    status: row.status as GoalStatus,
    notes: row.notes as string | undefined,
  };
}

function mapDbCheckIn(row: Record<string, unknown>): GoalCheckIn {
  return {
    id: row.id as string,
    goal_id: row.goal_id as string,
    user_id: row.user_id as string,
    check_in_date: row.check_in_date as string,
    progress_notes: row.progress_notes as string | undefined,
    blockers: row.blockers as string | undefined,
    support_needed: row.support_needed as string | undefined,
    confidence_level: row.confidence_level as number | undefined,
    created_at: row.created_at as string,
  };
}

function mapDbContribution(row: Record<string, unknown>): GoalContribution {
  return {
    id: row.id as string,
    team_goal_id: row.team_goal_id as string,
    individual_goal_id: row.individual_goal_id as string,
    user_id: row.user_id as string,
    contribution_value: row.contribution_value as number | undefined,
    contribution_percentage: row.contribution_percentage as number | undefined,
    calculated_at: row.calculated_at as string,
  };
}

function mapDbAchievement(row: Record<string, unknown>): GoalAchievement {
  return {
    id: row.id as string,
    goal_id: row.goal_id as string,
    user_id: row.user_id as string | undefined,
    achievement_type: row.achievement_type as AchievementType,
    achievement_name: row.achievement_name as string | undefined,
    achieved_at: row.achieved_at as string,
    acknowledged: row.acknowledged as boolean,
    celebrated: row.celebrated as boolean,
    metadata: row.metadata as Record<string, unknown> | undefined,
  };
}

// ============================================
// Exports
// ============================================

export const teamAnalyticsService = {
  // Periods
  createGoalPeriod,
  getGoalPeriods,
  getGoalPeriod,
  updateGoalPeriod,
  // Goals
  createGoal,
  getGoals,
  getGoal,
  updateGoal,
  deleteGoal,
  // Progress
  updateGoalProgress,
  getGoalProgressHistory,
  refreshPeriodGoals,
  // Check-ins
  createCheckIn,
  getGoalCheckIns,
  // Contributions
  calculateContributions,
  getUserContributions,
  // Achievements
  getAchievements,
  acknowledgeAchievement,
  celebrateAchievement,
  // Dashboards
  getTeamDashboard,
  getIndividualDashboard,
  getLeaderboard,
};

export default teamAnalyticsService;
