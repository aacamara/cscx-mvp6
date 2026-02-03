-- PRD-032: Champion Nurture Sequence
-- Migration for champion nurture tracking and engagement scoring

-- ============================================
-- Champion Touches Table
-- Tracks all nurture interactions with champions
-- ============================================
CREATE TABLE IF NOT EXISTS champion_touches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE SET NULL,
  touch_type VARCHAR(50) NOT NULL,
  -- Types: 'recognition', 'exclusive', 'career', 'community', 'checkin', 'manual', 'meeting', 'gift'
  touch_date TIMESTAMPTZ DEFAULT NOW(),
  title TEXT,
  description TEXT,
  email_id UUID, -- Reference to email_sequence_items if email-based
  engagement_response VARCHAR(20),
  -- Response: 'opened', 'clicked', 'replied', 'no_response', 'declined', 'accepted'
  sentiment_score INTEGER, -- -100 to 100
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_champion_touches_stakeholder ON champion_touches(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_champion_touches_customer ON champion_touches(customer_id);
CREATE INDEX IF NOT EXISTS idx_champion_touches_sequence ON champion_touches(sequence_id);
CREATE INDEX IF NOT EXISTS idx_champion_touches_type ON champion_touches(touch_type);
CREATE INDEX IF NOT EXISTS idx_champion_touches_date ON champion_touches(touch_date DESC);

-- ============================================
-- Add Champion Fields to Stakeholders
-- ============================================
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS champion_score INTEGER DEFAULT 50;
-- Champion score: 0-100, measures champion engagement level

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS champion_since TIMESTAMPTZ;
-- Date when stakeholder was identified as champion

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS champion_tier VARCHAR(20);
-- Tier: 'emerging', 'established', 'strategic', 'advisory_board'

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS last_nurture_touch TIMESTAMPTZ;
-- Last time a nurture touch was sent

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS nurture_sequence_count INTEGER DEFAULT 0;
-- Number of nurture sequences sent

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS key_contributions TEXT[];
-- List of key contributions (case studies, referrals, expansions, etc.)

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS career_interests TEXT[];
-- Career interests for career development content targeting

-- ============================================
-- Champion Engagement Metrics Table
-- Historical tracking of engagement scores
-- ============================================
CREATE TABLE IF NOT EXISTS champion_engagement_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  engagement_score INTEGER NOT NULL,
  champion_score INTEGER,
  components JSONB NOT NULL DEFAULT '{}',
  -- Components: { email_engagement: 20, meeting_attendance: 15, product_feedback: 10, ... }
  trend VARCHAR(20),
  -- Trend: 'improving', 'stable', 'declining'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_champion_engagement_stakeholder ON champion_engagement_history(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_champion_engagement_date ON champion_engagement_history(recorded_at DESC);

-- ============================================
-- Champion Alerts Table
-- Tracks alerts for champion disengagement
-- ============================================
CREATE TABLE IF NOT EXISTS champion_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  -- Types: 'score_drop', 'no_response', 'missed_interactions', 'sentiment_decline', 'engagement_threshold'
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  -- Severity: 'low', 'medium', 'high', 'critical'
  title TEXT NOT NULL,
  description TEXT,
  threshold_value INTEGER,
  actual_value INTEGER,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_champion_alerts_stakeholder ON champion_alerts(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_champion_alerts_customer ON champion_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_champion_alerts_severity ON champion_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_champion_alerts_resolved ON champion_alerts(resolved_at);

-- ============================================
-- Update Triggers
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_champion_touches_timestamp
  BEFORE UPDATE ON champion_touches
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER IF NOT EXISTS update_champion_alerts_timestamp
  BEFORE UPDATE ON champion_alerts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- Function: Calculate Champion Score
-- ============================================
CREATE OR REPLACE FUNCTION calculate_champion_score(
  p_stakeholder_id UUID
) RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  email_score INTEGER := 0;
  interaction_score INTEGER := 0;
  contribution_score INTEGER := 0;
  recency_score INTEGER := 0;
  stakeholder_rec RECORD;
  touch_count INTEGER;
  last_touch TIMESTAMPTZ;
  days_since_touch INTEGER;
BEGIN
  -- Get stakeholder data
  SELECT * INTO stakeholder_rec FROM stakeholders WHERE id = p_stakeholder_id;

  IF stakeholder_rec IS NULL THEN
    RETURN 0;
  END IF;

  -- Email engagement component (max 25)
  SELECT
    COUNT(*),
    MAX(touch_date)
  INTO touch_count, last_touch
  FROM champion_touches
  WHERE stakeholder_id = p_stakeholder_id
    AND engagement_response IN ('opened', 'clicked', 'replied', 'accepted')
    AND touch_date > NOW() - INTERVAL '90 days';

  email_score := LEAST(touch_count * 5, 25);

  -- Interaction frequency component (max 25)
  interaction_score := LEAST(COALESCE(stakeholder_rec.interaction_count, 0) * 2, 25);

  -- Contribution component (max 30)
  IF stakeholder_rec.key_contributions IS NOT NULL THEN
    contribution_score := LEAST(array_length(stakeholder_rec.key_contributions, 1) * 10, 30);
  END IF;

  -- Recency component (max 20)
  IF last_touch IS NOT NULL THEN
    days_since_touch := EXTRACT(DAY FROM NOW() - last_touch);
    IF days_since_touch <= 7 THEN
      recency_score := 20;
    ELSIF days_since_touch <= 14 THEN
      recency_score := 15;
    ELSIF days_since_touch <= 30 THEN
      recency_score := 10;
    ELSIF days_since_touch <= 60 THEN
      recency_score := 5;
    ELSE
      recency_score := 0;
    END IF;
  END IF;

  -- Total score
  score := email_score + interaction_score + contribution_score + recency_score;

  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Update Champion Score
-- Called after champion touches are recorded
-- ============================================
CREATE OR REPLACE FUNCTION update_champion_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE stakeholders
  SET
    champion_score = calculate_champion_score(NEW.stakeholder_id),
    last_nurture_touch = NEW.touch_date,
    updated_at = NOW()
  WHERE id = NEW.stakeholder_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_update_champion_score
  AFTER INSERT ON champion_touches
  FOR EACH ROW EXECUTE FUNCTION update_champion_score();

-- ============================================
-- Function: Check Champion Engagement Threshold
-- Creates alert if champion score drops below threshold
-- ============================================
CREATE OR REPLACE FUNCTION check_champion_engagement_threshold()
RETURNS TRIGGER AS $$
DECLARE
  prev_score INTEGER;
  score_drop INTEGER;
BEGIN
  -- Only check if this is a champion
  IF NEW.is_champion = TRUE THEN
    -- Get previous score
    SELECT champion_score INTO prev_score
    FROM stakeholders
    WHERE id = NEW.id;

    -- Check for significant drop (> 15 points)
    IF prev_score IS NOT NULL AND NEW.champion_score IS NOT NULL THEN
      score_drop := prev_score - NEW.champion_score;

      IF score_drop >= 15 THEN
        INSERT INTO champion_alerts (
          stakeholder_id,
          customer_id,
          alert_type,
          severity,
          title,
          description,
          threshold_value,
          actual_value
        ) VALUES (
          NEW.id,
          NEW.customer_id,
          'score_drop',
          CASE WHEN score_drop >= 25 THEN 'high' ELSE 'medium' END,
          'Champion engagement score dropped significantly',
          format('Champion score dropped from %s to %s (%s point decrease)', prev_score, NEW.champion_score, score_drop),
          prev_score,
          NEW.champion_score
        );
      END IF;
    END IF;

    -- Check for low overall score
    IF NEW.champion_score IS NOT NULL AND NEW.champion_score < 40 THEN
      INSERT INTO champion_alerts (
        stakeholder_id,
        customer_id,
        alert_type,
        severity,
        title,
        description,
        threshold_value,
        actual_value
      ) VALUES (
        NEW.id,
        NEW.customer_id,
        'engagement_threshold',
        'high',
        'Champion engagement below critical threshold',
        format('Champion %s has engagement score of %s (threshold: 40)', NEW.name, NEW.champion_score),
        40,
        NEW.champion_score
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Grant Permissions
-- ============================================
GRANT ALL ON champion_touches TO authenticated;
GRANT ALL ON champion_engagement_history TO authenticated;
GRANT ALL ON champion_alerts TO authenticated;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE champion_touches IS 'PRD-032: Tracks all nurture interactions with customer champions';
COMMENT ON TABLE champion_engagement_history IS 'PRD-032: Historical tracking of champion engagement scores';
COMMENT ON TABLE champion_alerts IS 'PRD-032: Alerts for champion disengagement detection';
COMMENT ON FUNCTION calculate_champion_score IS 'PRD-032: Calculates champion engagement score based on interactions, contributions, and recency';
