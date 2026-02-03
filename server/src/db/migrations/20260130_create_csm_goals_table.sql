-- PRD-178: Team Performance Dashboard
-- Create csm_goals table for tracking CSM performance goals

-- Create csm_goals table
CREATE TABLE IF NOT EXISTS csm_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID,  -- For team-level goals (nullable for team-wide goals)
  metric VARCHAR(50) NOT NULL CHECK (metric IN ('retention', 'nrr', 'health', 'activity')),
  target_value DECIMAL(10, 2) NOT NULL,
  current_value DECIMAL(10, 2) DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_csm_goals_user_id ON csm_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_csm_goals_team_id ON csm_goals(team_id);
CREATE INDEX IF NOT EXISTS idx_csm_goals_metric ON csm_goals(metric);
CREATE INDEX IF NOT EXISTS idx_csm_goals_period ON csm_goals(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_csm_goals_status ON csm_goals(status);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_csm_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS csm_goals_updated_at ON csm_goals;
CREATE TRIGGER csm_goals_updated_at
  BEFORE UPDATE ON csm_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_csm_goals_updated_at();

-- Enable Row Level Security
ALTER TABLE csm_goals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own goals and team goals
CREATE POLICY csm_goals_select_policy ON csm_goals
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    user_id IS NULL OR  -- Team-wide goals
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'manager')
    )
  );

-- Policy: Only managers and admins can create/update goals
CREATE POLICY csm_goals_insert_policy ON csm_goals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY csm_goals_update_policy ON csm_goals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'manager')
    )
  );

-- Grant permissions
GRANT SELECT ON csm_goals TO authenticated;
GRANT INSERT, UPDATE ON csm_goals TO authenticated;

-- Add comment
COMMENT ON TABLE csm_goals IS 'PRD-178: Team Performance Dashboard - CSM goal tracking';
