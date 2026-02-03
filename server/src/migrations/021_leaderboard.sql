-- Migration: Leaderboard System (PRD-260)
-- Date: 2026-01-30
-- Description: Creates tables for team goal tracking and leaderboard functionality

-- ============================================
-- Goal Periods Table
-- Stores time periods for goal tracking (Q1 2026, FY 2026, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS goal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly', 'annual')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_period_dates CHECK (end_date > start_date)
);

-- Indexes for goal_periods
CREATE INDEX IF NOT EXISTS idx_goal_periods_status ON goal_periods(status);
CREATE INDEX IF NOT EXISTS idx_goal_periods_dates ON goal_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_goal_periods_type ON goal_periods(period_type);

-- ============================================
-- Goals Table
-- Individual and team goals with metric tracking
-- ============================================

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES goal_periods(id) ON DELETE CASCADE,
  parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,

  -- Ownership
  owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('team', 'individual')),
  team_id UUID,
  user_id TEXT,

  -- Goal definition
  name VARCHAR(500) NOT NULL,
  description TEXT,
  goal_type VARCHAR(50) NOT NULL CHECK (goal_type IN ('metric', 'task', 'milestone')),

  -- For metric-based goals
  metric_name VARCHAR(200),
  metric_calculation JSONB,
  baseline_value DECIMAL,
  target_value DECIMAL NOT NULL,
  stretch_target_value DECIMAL,
  target_direction VARCHAR(20) DEFAULT 'increase' CHECK (target_direction IN ('increase', 'decrease', 'maintain')),

  -- For task/milestone goals
  task_count_target INTEGER,
  milestones JSONB DEFAULT '[]',

  -- Current state
  current_value DECIMAL DEFAULT 0,
  progress_percentage DECIMAL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'on_track' CHECK (status IN ('not_started', 'on_track', 'at_risk', 'behind', 'achieved', 'exceeded')),
  last_calculated_at TIMESTAMPTZ,

  -- Visibility & Leaderboard
  is_public BOOLEAN DEFAULT true,
  show_in_leaderboard BOOLEAN DEFAULT true,
  weight DECIMAL DEFAULT 1.0,

  -- Metadata
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chk_goal_owner CHECK (
    (owner_type = 'team' AND team_id IS NOT NULL) OR
    (owner_type = 'individual' AND user_id IS NOT NULL)
  )
);

-- Indexes for goals
CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(period_id);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_team ON goals(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_leaderboard ON goals(show_in_leaderboard) WHERE show_in_leaderboard = true;
CREATE INDEX IF NOT EXISTS idx_goals_metric ON goals(metric_name) WHERE metric_name IS NOT NULL;

-- ============================================
-- Goal Progress History Table
-- Tracks historical progress for trend analysis
-- ============================================

CREATE TABLE IF NOT EXISTS goal_progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  value DECIMAL NOT NULL,
  progress_percentage DECIMAL,
  status VARCHAR(20),
  notes TEXT,
  recorded_by VARCHAR(50) DEFAULT 'system' CHECK (recorded_by IN ('system', 'manual', 'api'))
);

-- Indexes for goal_progress_history
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress_history(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_date ON goal_progress_history(goal_id, recorded_at DESC);

-- ============================================
-- Goal Check-ins Table
-- Weekly check-ins for goal progress
-- ============================================

CREATE TABLE IF NOT EXISTS goal_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  check_in_date DATE NOT NULL,
  progress_notes TEXT,
  blockers TEXT,
  support_needed TEXT,
  confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for goal_check_ins
CREATE INDEX IF NOT EXISTS idx_goal_checkins_goal ON goal_check_ins(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_checkins_user ON goal_check_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_checkins_date ON goal_check_ins(check_in_date DESC);

-- ============================================
-- Goal Contributions Table
-- Tracks individual contributions to team goals
-- ============================================

CREATE TABLE IF NOT EXISTS goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  individual_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  contribution_value DECIMAL NOT NULL DEFAULT 0,
  contribution_percentage DECIMAL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for goal_contributions
CREATE INDEX IF NOT EXISTS idx_goal_contributions_team ON goal_contributions(team_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user ON goal_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_individual ON goal_contributions(individual_goal_id) WHERE individual_goal_id IS NOT NULL;

-- ============================================
-- Goal Achievements Table
-- Tracks goal achievements for recognition/celebration
-- ============================================

CREATE TABLE IF NOT EXISTS goal_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id TEXT,
  team_id UUID,
  achievement_type VARCHAR(50) NOT NULL CHECK (achievement_type IN ('achieved', 'exceeded', 'milestone', 'streak', 'first_place')),
  achievement_value DECIMAL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  celebrated BOOLEAN DEFAULT false,
  celebrated_at TIMESTAMPTZ,
  message TEXT
);

-- Indexes for goal_achievements
CREATE INDEX IF NOT EXISTS idx_goal_achievements_goal ON goal_achievements(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_achievements_user ON goal_achievements(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goal_achievements_team ON goal_achievements(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goal_achievements_date ON goal_achievements(achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_achievements_unacked ON goal_achievements(user_id, acknowledged) WHERE acknowledged = false;

-- ============================================
-- Leaderboard Configuration Table
-- Stores leaderboard display settings
-- ============================================

CREATE TABLE IF NOT EXISTS leaderboard_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  period_id UUID REFERENCES goal_periods(id) ON DELETE SET NULL,

  -- Display settings
  display_type VARCHAR(50) DEFAULT 'ranked_list' CHECK (display_type IN ('ranked_list', 'podium', 'progress_bars', 'cards')),
  show_ranks BOOLEAN DEFAULT true,
  show_progress BOOLEAN DEFAULT true,
  show_change BOOLEAN DEFAULT true,
  show_avatars BOOLEAN DEFAULT true,
  max_entries INTEGER DEFAULT 10,

  -- Scoring
  metrics_included TEXT[] DEFAULT '{}',
  scoring_formula JSONB,

  -- Visibility
  is_active BOOLEAN DEFAULT true,
  visibility VARCHAR(20) DEFAULT 'team' CHECK (visibility IN ('private', 'team', 'organization', 'public')),

  -- Gamification
  enable_badges BOOLEAN DEFAULT true,
  enable_streaks BOOLEAN DEFAULT true,
  enable_celebrations BOOLEAN DEFAULT true,

  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for leaderboard_configs
CREATE INDEX IF NOT EXISTS idx_leaderboard_configs_period ON leaderboard_configs(period_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_configs_active ON leaderboard_configs(is_active) WHERE is_active = true;

-- ============================================
-- Leaderboard Entries Table
-- Cached leaderboard rankings (updated periodically)
-- ============================================

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES leaderboard_configs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- Ranking
  rank INTEGER NOT NULL,
  previous_rank INTEGER,
  rank_change INTEGER DEFAULT 0,

  -- Scores
  total_score DECIMAL NOT NULL DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}',

  -- Metrics
  goals_achieved INTEGER DEFAULT 0,
  goals_total INTEGER DEFAULT 0,
  achievement_rate DECIMAL DEFAULT 0,
  streak_days INTEGER DEFAULT 0,

  -- User info (denormalized for performance)
  user_name VARCHAR(200),
  user_avatar_url TEXT,
  user_title VARCHAR(200),

  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for leaderboard_entries
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_config ON leaderboard_entries(config_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user ON leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_rank ON leaderboard_entries(config_id, rank);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_entries_unique ON leaderboard_entries(config_id, user_id);

-- ============================================
-- Trigger to update updated_at timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_leaderboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_goal_periods_updated_at ON goal_periods;
CREATE TRIGGER trigger_goal_periods_updated_at
  BEFORE UPDATE ON goal_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_leaderboard_updated_at();

DROP TRIGGER IF EXISTS trigger_goals_updated_at ON goals;
CREATE TRIGGER trigger_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_leaderboard_updated_at();

DROP TRIGGER IF EXISTS trigger_leaderboard_configs_updated_at ON leaderboard_configs;
CREATE TRIGGER trigger_leaderboard_configs_updated_at
  BEFORE UPDATE ON leaderboard_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_leaderboard_updated_at();

-- ============================================
-- Function to calculate goal progress
-- ============================================

CREATE OR REPLACE FUNCTION calculate_goal_progress(
  p_current_value DECIMAL,
  p_baseline_value DECIMAL,
  p_target_value DECIMAL,
  p_target_direction VARCHAR(20)
)
RETURNS DECIMAL AS $$
DECLARE
  v_progress DECIMAL;
  v_total_change DECIMAL;
  v_current_change DECIMAL;
BEGIN
  -- Handle null baseline
  IF p_baseline_value IS NULL THEN
    p_baseline_value := 0;
  END IF;

  -- Calculate based on direction
  IF p_target_direction = 'increase' THEN
    v_total_change := p_target_value - p_baseline_value;
    v_current_change := p_current_value - p_baseline_value;
  ELSIF p_target_direction = 'decrease' THEN
    v_total_change := p_baseline_value - p_target_value;
    v_current_change := p_baseline_value - p_current_value;
  ELSE -- maintain
    -- For maintain, calculate deviation from target
    v_progress := 100 - ABS(p_current_value - p_target_value) / NULLIF(p_target_value, 0) * 100;
    RETURN GREATEST(0, LEAST(100, v_progress));
  END IF;

  -- Calculate percentage
  IF v_total_change = 0 THEN
    RETURN 100; -- Already at target
  END IF;

  v_progress := (v_current_change / v_total_change) * 100;

  -- Cap at 0-150% (allow exceeding target)
  RETURN GREATEST(0, LEAST(150, v_progress));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Function to determine goal status based on progress
-- ============================================

CREATE OR REPLACE FUNCTION determine_goal_status(
  p_progress DECIMAL,
  p_period_progress DECIMAL -- How far through the period we are (0-100)
)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF p_progress >= 100 THEN
    IF p_progress >= 110 THEN
      RETURN 'exceeded';
    ELSE
      RETURN 'achieved';
    END IF;
  ELSIF p_progress >= p_period_progress - 5 THEN
    RETURN 'on_track';
  ELSIF p_progress >= p_period_progress - 20 THEN
    RETURN 'at_risk';
  ELSE
    RETURN 'behind';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE goal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- Service role bypass for all tables
CREATE POLICY "Service role can access all goal_periods"
  ON goal_periods FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all goals"
  ON goals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all goal_progress_history"
  ON goal_progress_history FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all goal_check_ins"
  ON goal_check_ins FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all goal_contributions"
  ON goal_contributions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all goal_achievements"
  ON goal_achievements FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all leaderboard_configs"
  ON leaderboard_configs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all leaderboard_entries"
  ON leaderboard_entries FOR ALL
  USING (auth.role() = 'service_role');

-- User policies for goals
CREATE POLICY "Users can view public goals"
  ON goals FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can view their own goals"
  ON goals FOR SELECT
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can create their own goals"
  ON goals FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can update their own goals"
  ON goals FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

-- User policies for check-ins
CREATE POLICY "Users can manage their own check-ins"
  ON goal_check_ins FOR ALL
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

-- User policies for achievements
CREATE POLICY "Users can view their achievements"
  ON goal_achievements FOR SELECT
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

-- Leaderboard entries are viewable by all authenticated users
CREATE POLICY "Users can view leaderboard entries"
  ON leaderboard_entries FOR SELECT
  USING (true);

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON TABLE goal_periods IS 'Time periods for goal tracking (PRD-260)';
COMMENT ON TABLE goals IS 'Individual and team goals with metric tracking';
COMMENT ON TABLE goal_progress_history IS 'Historical progress data for trend analysis';
COMMENT ON TABLE goal_check_ins IS 'Weekly check-ins for goal progress and blockers';
COMMENT ON TABLE goal_contributions IS 'Individual contributions to team goals';
COMMENT ON TABLE goal_achievements IS 'Goal achievements for recognition and celebration';
COMMENT ON TABLE leaderboard_configs IS 'Leaderboard display and scoring configuration';
COMMENT ON TABLE leaderboard_entries IS 'Cached leaderboard rankings for fast retrieval';

COMMENT ON FUNCTION calculate_goal_progress IS 'Calculates goal progress percentage based on direction';
COMMENT ON FUNCTION determine_goal_status IS 'Determines goal status based on progress vs expected timeline';
