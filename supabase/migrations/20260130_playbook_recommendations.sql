-- PRD-232: Automated Playbook Selection
-- Database schema for AI-powered playbook recommendations and outcome tracking

-- Playbook recommendations table
CREATE TABLE IF NOT EXISTS playbook_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  playbook_id TEXT NOT NULL,
  fit_score INTEGER CHECK (fit_score >= 0 AND fit_score <= 100),
  reasoning JSONB DEFAULT '[]'::JSONB,
  alternatives JSONB DEFAULT '[]'::JSONB,
  trigger_type VARCHAR(50) CHECK (trigger_type IN ('automatic', 'suggested', 'manual')),
  trigger_event JSONB,
  status VARCHAR(50) DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'started', 'active', 'declined', 'completed')),
  decline_reason TEXT,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_playbook_recommendations_customer_id ON playbook_recommendations(customer_id);
CREATE INDEX IF NOT EXISTS idx_playbook_recommendations_playbook_id ON playbook_recommendations(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_recommendations_status ON playbook_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_playbook_recommendations_trigger_type ON playbook_recommendations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_playbook_recommendations_created_at ON playbook_recommendations(created_at DESC);

-- Playbook outcomes table for tracking effectiveness
CREATE TABLE IF NOT EXISTS playbook_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  playbook_id TEXT NOT NULL,
  recommendation_id UUID REFERENCES playbook_recommendations(id) ON DELETE SET NULL,
  selection_method VARCHAR(50) CHECK (selection_method IN ('ai_recommended', 'manual')),
  was_recommended_playbook BOOLEAN DEFAULT true,
  override_playbook_id TEXT,
  outcome VARCHAR(50) CHECK (outcome IN ('success', 'partial', 'failed', 'in_progress', 'cancelled')),
  health_change INTEGER,
  health_at_start INTEGER,
  health_at_end INTEGER,
  notes TEXT,
  outcome_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for outcomes queries
CREATE INDEX IF NOT EXISTS idx_playbook_outcomes_customer_id ON playbook_outcomes(customer_id);
CREATE INDEX IF NOT EXISTS idx_playbook_outcomes_playbook_id ON playbook_outcomes(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_outcomes_selection_method ON playbook_outcomes(selection_method);
CREATE INDEX IF NOT EXISTS idx_playbook_outcomes_outcome ON playbook_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_playbook_outcomes_created_at ON playbook_outcomes(created_at DESC);

-- Playbook criteria table for configurable matching rules
CREATE TABLE IF NOT EXISTS playbook_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id TEXT NOT NULL UNIQUE,
  lifecycle_stages TEXT[] DEFAULT ARRAY[]::TEXT[],
  health_score_min INTEGER DEFAULT 0,
  health_score_max INTEGER DEFAULT 100,
  risk_signals TEXT[] DEFAULT ARRAY[]::TEXT[],
  expansion_signals TEXT[] DEFAULT ARRAY[]::TEXT[],
  renewal_days_min INTEGER DEFAULT 0,
  renewal_days_max INTEGER DEFAULT 365,
  industries TEXT[] DEFAULT ARRAY[]::TEXT[],
  segments TEXT[] DEFAULT ARRAY[]::TEXT[],
  min_arr INTEGER DEFAULT 0,
  max_arr INTEGER,
  priority_weight INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for criteria lookups
CREATE INDEX IF NOT EXISTS idx_playbook_criteria_playbook_id ON playbook_criteria(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_criteria_is_active ON playbook_criteria(is_active);

-- Playbook triggers table for automatic recommendations
CREATE TABLE IF NOT EXISTS playbook_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type VARCHAR(100) NOT NULL,
  playbook_id TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::JSONB,
  auto_start BOOLEAN DEFAULT false,
  require_approval_conditions JSONB DEFAULT '[]'::JSONB,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for trigger lookups
CREATE INDEX IF NOT EXISTS idx_playbook_triggers_trigger_type ON playbook_triggers(trigger_type);
CREATE INDEX IF NOT EXISTS idx_playbook_triggers_is_active ON playbook_triggers(is_active);

-- Add criteria column to playbooks table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playbooks' AND column_name = 'criteria'
  ) THEN
    ALTER TABLE playbooks ADD COLUMN criteria JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'playbooks' AND column_name = 'success_rate'
  ) THEN
    ALTER TABLE playbooks ADD COLUMN success_rate NUMERIC(5,4);
  END IF;
END $$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to new tables
DROP TRIGGER IF EXISTS update_playbook_recommendations_updated_at ON playbook_recommendations;
CREATE TRIGGER update_playbook_recommendations_updated_at
  BEFORE UPDATE ON playbook_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_playbook_outcomes_updated_at ON playbook_outcomes;
CREATE TRIGGER update_playbook_outcomes_updated_at
  BEFORE UPDATE ON playbook_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_playbook_criteria_updated_at ON playbook_criteria;
CREATE TRIGGER update_playbook_criteria_updated_at
  BEFORE UPDATE ON playbook_criteria
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_playbook_triggers_updated_at ON playbook_triggers;
CREATE TRIGGER update_playbook_triggers_updated_at
  BEFORE UPDATE ON playbook_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE playbook_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_triggers ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access to playbook_recommendations"
  ON playbook_recommendations FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to playbook_outcomes"
  ON playbook_outcomes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to playbook_criteria"
  ON playbook_criteria FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to playbook_triggers"
  ON playbook_triggers FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "Authenticated users can view playbook_recommendations"
  ON playbook_recommendations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view playbook_outcomes"
  ON playbook_outcomes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view playbook_criteria"
  ON playbook_criteria FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view playbook_triggers"
  ON playbook_triggers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insert default playbook triggers
INSERT INTO playbook_triggers (trigger_type, playbook_id, conditions, auto_start, require_approval_conditions, priority)
VALUES
  ('health_score_drop', 'save-play-standard',
   '[{"metric": "health_score_change_7d", "operator": "<", "value": -15}, {"metric": "health_score", "operator": "<", "value": 50}]'::JSONB,
   false, '["high_arr", "active_expansion"]'::JSONB, 10),
  ('renewal_approaching', 'renewal-90day',
   '[{"metric": "days_to_renewal", "operator": "<=", "value": 90}, {"metric": "renewal_playbook_active", "operator": "=", "value": false}]'::JSONB,
   true, '[]'::JSONB, 20),
  ('low_adoption', 'adoption-standard',
   '[{"metric": "feature_adoption_rate", "operator": "<", "value": 30}, {"metric": "days_since_onboarding", "operator": ">", "value": 30}]'::JSONB,
   false, '["active_save_play"]'::JSONB, 5),
  ('expansion_signal', 'expansion-upsell',
   '[{"metric": "health_score", "operator": ">=", "value": 80}, {"metric": "has_expansion_signal", "operator": "=", "value": true}]'::JSONB,
   false, '[]'::JSONB, 8)
ON CONFLICT DO NOTHING;

-- Insert default playbook criteria
INSERT INTO playbook_criteria (playbook_id, lifecycle_stages, health_score_min, health_score_max, risk_signals, expansion_signals, renewal_days_min, renewal_days_max, segments)
VALUES
  ('onboarding-standard', ARRAY['new', 'onboarding'], 0, 100, ARRAY[]::TEXT[], ARRAY[]::TEXT[], 300, 365, ARRAY[]::TEXT[]),
  ('onboarding-enterprise', ARRAY['new', 'onboarding'], 0, 100, ARRAY[]::TEXT[], ARRAY[]::TEXT[], 300, 365, ARRAY['enterprise']),
  ('adoption-standard', ARRAY['active', 'growing'], 40, 75, ARRAY['low_usage', 'feature_drop'], ARRAY[]::TEXT[], 60, 365, ARRAY[]::TEXT[]),
  ('renewal-90day', ARRAY['active', 'renewing'], 50, 100, ARRAY[]::TEXT[], ARRAY[]::TEXT[], 0, 90, ARRAY[]::TEXT[]),
  ('save-play-standard', ARRAY['at_risk', 'active'], 0, 50, ARRAY['health_drop', 'usage_decline', 'engagement_drop'], ARRAY[]::TEXT[], 0, 365, ARRAY[]::TEXT[]),
  ('save-play-executive', ARRAY['at_risk', 'active'], 0, 45, ARRAY['health_drop', 'champion_departure', 'executive_change'], ARRAY[]::TEXT[], 0, 365, ARRAY['enterprise', 'strategic']),
  ('expansion-upsell', ARRAY['active', 'growing'], 75, 100, ARRAY[]::TEXT[], ARRAY['high_usage', 'new_use_case', 'team_growth'], 90, 365, ARRAY[]::TEXT[]),
  ('qbr-standard', ARRAY['active', 'growing', 'renewing'], 0, 100, ARRAY[]::TEXT[], ARRAY[]::TEXT[], 0, 365, ARRAY[]::TEXT[])
ON CONFLICT (playbook_id) DO NOTHING;

-- Function to calculate playbook success rates (to be called periodically)
CREATE OR REPLACE FUNCTION calculate_playbook_success_rates()
RETURNS void AS $$
DECLARE
  playbook RECORD;
  success_count INTEGER;
  total_count INTEGER;
  rate NUMERIC;
BEGIN
  FOR playbook IN SELECT DISTINCT playbook_id FROM playbook_outcomes LOOP
    SELECT
      COUNT(*) FILTER (WHERE outcome = 'success'),
      COUNT(*)
    INTO success_count, total_count
    FROM playbook_outcomes
    WHERE playbook_id = playbook.playbook_id
    AND outcome IS NOT NULL;

    IF total_count >= 5 THEN
      rate := success_count::NUMERIC / total_count::NUMERIC;

      UPDATE playbooks
      SET success_rate = rate
      WHERE id = playbook.playbook_id OR code = playbook.playbook_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE playbook_recommendations IS 'Stores AI-generated playbook recommendations for customers (PRD-232)';
COMMENT ON TABLE playbook_outcomes IS 'Tracks outcomes of playbook executions for effectiveness measurement (PRD-232)';
COMMENT ON TABLE playbook_criteria IS 'Configurable criteria for playbook matching and selection (PRD-232)';
COMMENT ON TABLE playbook_triggers IS 'Automated trigger rules for proactive playbook recommendations (PRD-232)';
