-- PRD-260: Team Goal Tracking
-- Database schema for team goals, progress tracking, and analytics

-- Goal periods table
CREATE TABLE IF NOT EXISTS goal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL, -- 'Q1 2026', 'FY 2026'
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('planning', 'active', 'completed')),
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID REFERENCES goal_periods(id) ON DELETE CASCADE NOT NULL,
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
  metric_name VARCHAR(200), -- 'nrr', 'retention_rate', 'nps', 'qbr_completion'
  metric_calculation JSONB,
  baseline_value DECIMAL,
  target_value DECIMAL,
  stretch_target_value DECIMAL,
  target_direction VARCHAR(20) DEFAULT 'increase' CHECK (target_direction IN ('increase', 'decrease', 'maintain')),

  -- For task/milestone goals
  task_count_target INTEGER,
  milestones JSONB DEFAULT '[]'::JSONB,

  -- Current state
  current_value DECIMAL,
  progress_percentage DECIMAL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'behind', 'achieved', 'exceeded')),
  last_calculated_at TIMESTAMPTZ,

  -- Visibility
  is_public BOOLEAN DEFAULT true,
  show_in_leaderboard BOOLEAN DEFAULT true,

  created_by_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal progress history
CREATE TABLE IF NOT EXISTS goal_progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  value DECIMAL NOT NULL,
  progress_percentage DECIMAL,
  status VARCHAR(20),
  notes TEXT
);

-- Goal check-ins
CREATE TABLE IF NOT EXISTS goal_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT NOT NULL,
  check_in_date DATE NOT NULL,
  progress_notes TEXT,
  blockers TEXT,
  support_needed TEXT,
  confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal contributions (track individual -> team)
CREATE TABLE IF NOT EXISTS goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  individual_goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  contribution_value DECIMAL,
  contribution_percentage DECIMAL,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal achievements
CREATE TABLE IF NOT EXISTS goal_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT,
  achievement_type VARCHAR(50) CHECK (achievement_type IN ('achieved', 'exceeded', 'milestone', 'streak')),
  achievement_name VARCHAR(200),
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT false,
  celebrated BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Indexes for goals queries
CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(period_id);
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals(owner_type, team_id, user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);

-- Indexes for progress history
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress_history(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_recorded ON goal_progress_history(recorded_at);

-- Indexes for check-ins
CREATE INDEX IF NOT EXISTS idx_goal_checkins_goal ON goal_check_ins(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_checkins_user ON goal_check_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_checkins_date ON goal_check_ins(check_in_date);

-- Indexes for contributions
CREATE INDEX IF NOT EXISTS idx_goal_contributions_team ON goal_contributions(team_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user ON goal_contributions(user_id);

-- Indexes for achievements
CREATE INDEX IF NOT EXISTS idx_goal_achievements_goal ON goal_achievements(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_achievements_user ON goal_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_achievements_type ON goal_achievements(achievement_type);

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_goal_periods_updated_at ON goal_periods;
CREATE TRIGGER update_goal_periods_updated_at
  BEFORE UPDATE ON goal_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE goal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_achievements ENABLE ROW LEVEL SECURITY;

-- Public goals are viewable by all authenticated users
CREATE POLICY "Users can view public goals"
  ON goals FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  USING (user_id = auth.uid()::TEXT);

CREATE POLICY "Users can manage own goals"
  ON goals FOR ALL
  USING (user_id = auth.uid()::TEXT OR created_by_user_id = auth.uid()::TEXT);

CREATE POLICY "Users can view goal periods"
  ON goal_periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage own check-ins"
  ON goal_check_ins FOR ALL
  USING (user_id = auth.uid()::TEXT);

CREATE POLICY "Users can view contributions"
  ON goal_contributions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view achievements"
  ON goal_achievements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage own achievements"
  ON goal_achievements FOR ALL
  USING (user_id = auth.uid()::TEXT);

-- Service role bypass for backend operations
CREATE POLICY "Service role has full access to goal_periods"
  ON goal_periods FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to goals"
  ON goals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to goal_progress_history"
  ON goal_progress_history FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to goal_check_ins"
  ON goal_check_ins FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to goal_contributions"
  ON goal_contributions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to goal_achievements"
  ON goal_achievements FOR ALL
  USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE goal_periods IS 'Time periods for goal tracking (monthly, quarterly, annual) - PRD-260';
COMMENT ON TABLE goals IS 'Team and individual goals with metric tracking - PRD-260';
COMMENT ON TABLE goal_progress_history IS 'Historical progress snapshots for goals - PRD-260';
COMMENT ON TABLE goal_check_ins IS 'Weekly/regular check-ins on goal progress - PRD-260';
COMMENT ON TABLE goal_contributions IS 'Individual contributions to team goals - PRD-260';
COMMENT ON TABLE goal_achievements IS 'Goal milestones and achievement tracking - PRD-260';
