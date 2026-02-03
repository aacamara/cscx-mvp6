-- PRD-082: Decision Maker Analysis
-- Migration for decision maker analysis and influence scoring

-- ============================================
-- Decision Maker Analysis Fields on Stakeholders
-- ============================================

-- Add influence and engagement scoring columns
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS influence_score INTEGER DEFAULT 50 CHECK (influence_score >= 0 AND influence_score <= 100);
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 50 CHECK (engagement_score >= 0 AND engagement_score <= 100);
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMPTZ;

-- Decision authority tracking (stored as JSONB array)
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS decision_authority JSONB DEFAULT '[]';
-- Values: 'budget_approval', 'contract_signing', 'technical_approval', 'business_approval', 'legal_approval', 'executive_sponsor', 'influencer'

-- Known priorities and communication preferences
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS known_priorities JSONB DEFAULT '[]';
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS communication_preference VARCHAR(20) DEFAULT 'email';
-- Values: 'email', 'phone', 'in_person', 'slack'

-- Engagement metrics (derived from activity)
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS meeting_attendance_rate INTEGER DEFAULT 0 CHECK (meeting_attendance_rate >= 0 AND meeting_attendance_rate <= 100);
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS email_response_rate INTEGER DEFAULT 0 CHECK (email_response_rate >= 0 AND email_response_rate <= 100);
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS total_interactions INTEGER DEFAULT 0;

-- Relationship strength
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS relationship_strength VARCHAR(20) DEFAULT 'none';
-- Values: 'strong', 'moderate', 'weak', 'none'

-- Data confidence
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS data_confidence VARCHAR(10) DEFAULT 'low';
-- Values: 'high', 'medium', 'low'

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_stakeholders_influence_score ON stakeholders(influence_score DESC);
CREATE INDEX IF NOT EXISTS idx_stakeholders_engagement_score ON stakeholders(engagement_score);
CREATE INDEX IF NOT EXISTS idx_stakeholders_last_analyzed ON stakeholders(last_analyzed_at);

-- ============================================
-- Decision Maker Analysis History Table
-- ============================================

CREATE TABLE IF NOT EXISTS decision_maker_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  analysis_type VARCHAR(30) NOT NULL DEFAULT 'general',
  -- Values: 'renewal', 'expansion', 'general', 'risk_mitigation'

  -- Summary metrics
  total_decision_makers INTEGER NOT NULL DEFAULT 0,
  covered_decision_makers INTEGER NOT NULL DEFAULT 0,
  coverage_percentage INTEGER NOT NULL DEFAULT 0,
  avg_influence_score INTEGER NOT NULL DEFAULT 0,
  avg_engagement_score INTEGER NOT NULL DEFAULT 0,
  has_executive_sponsor BOOLEAN DEFAULT FALSE,
  has_champion BOOLEAN DEFAULT FALSE,
  single_threaded_risk BOOLEAN DEFAULT FALSE,

  -- Pattern analysis
  decision_pattern VARCHAR(30) DEFAULT 'unknown',
  -- Values: 'consensus_driven', 'top_down', 'committee_based', 'champion_led', 'unknown'
  pattern_confidence INTEGER DEFAULT 0,
  pattern_description TEXT,

  -- Full analysis data
  analysis_data JSONB NOT NULL DEFAULT '{}',

  -- Confidence and completeness
  data_completeness INTEGER NOT NULL DEFAULT 0 CHECK (data_completeness >= 0 AND data_completeness <= 100),
  confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_dm_analyses_customer ON decision_maker_analyses(customer_id);
CREATE INDEX IF NOT EXISTS idx_dm_analyses_type ON decision_maker_analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_dm_analyses_created ON decision_maker_analyses(created_at DESC);

-- ============================================
-- Engagement Gap Tracking Table
-- ============================================

CREATE TABLE IF NOT EXISTS engagement_gaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,

  gap_type VARCHAR(30) NOT NULL,
  -- Values: 'no_contact', 'stale_relationship', 'low_response', 'missing_executive'

  severity VARCHAR(10) NOT NULL DEFAULT 'medium',
  -- Values: 'critical', 'high', 'medium', 'low'

  days_since_contact INTEGER,
  recommendation TEXT NOT NULL,
  suggested_action TEXT NOT NULL,

  -- Resolution tracking
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,

  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_gaps_customer ON engagement_gaps(customer_id);
CREATE INDEX IF NOT EXISTS idx_engagement_gaps_stakeholder ON engagement_gaps(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_engagement_gaps_severity ON engagement_gaps(severity);
CREATE INDEX IF NOT EXISTS idx_engagement_gaps_resolved ON engagement_gaps(is_resolved) WHERE is_resolved = FALSE;

-- ============================================
-- Historical Decision Outcomes Table
-- ============================================

CREATE TABLE IF NOT EXISTS decision_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  outcome_type VARCHAR(30) NOT NULL,
  -- Values: 'renewal', 'expansion', 'churn', 'downgrade', 'upsell'

  outcome_result VARCHAR(20) NOT NULL,
  -- Values: 'won', 'lost', 'pending', 'delayed'

  -- Financial impact
  arr_before DECIMAL(12, 2),
  arr_after DECIMAL(12, 2),
  arr_change DECIMAL(12, 2),

  -- Decision maker involvement
  decision_makers_involved JSONB DEFAULT '[]',
  primary_decision_maker_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,

  -- Timeline
  cycle_start_date DATE,
  cycle_end_date DATE,
  cycle_length_days INTEGER,

  -- Analysis
  success_factors JSONB DEFAULT '[]',
  risk_factors JSONB DEFAULT '[]',
  lessons_learned TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_outcomes_customer ON decision_outcomes(customer_id);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_type ON decision_outcomes(outcome_type);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_result ON decision_outcomes(outcome_result);

-- ============================================
-- Functions
-- ============================================

-- Function to calculate influence score for a stakeholder
CREATE OR REPLACE FUNCTION calculate_influence_score(
  p_stakeholder_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 50;
  v_stakeholder RECORD;
  v_interactions INTEGER;
  v_meetings_attended INTEGER;
  v_total_meetings INTEGER;
BEGIN
  -- Get stakeholder details
  SELECT * INTO v_stakeholder
  FROM stakeholders
  WHERE id = p_stakeholder_id;

  IF NOT FOUND THEN
    RETURN 50;
  END IF;

  -- Base score from role
  IF v_stakeholder.role ILIKE '%ceo%' OR v_stakeholder.role ILIKE '%cfo%' OR v_stakeholder.role ILIKE '%cto%' THEN
    v_score := 90;
  ELSIF v_stakeholder.role ILIKE '%vp%' OR v_stakeholder.role ILIKE '%vice president%' THEN
    v_score := 80;
  ELSIF v_stakeholder.role ILIKE '%director%' OR v_stakeholder.role ILIKE '%head of%' THEN
    v_score := 70;
  ELSIF v_stakeholder.role ILIKE '%manager%' OR v_stakeholder.role ILIKE '%senior%' THEN
    v_score := 60;
  ELSE
    v_score := 40;
  END IF;

  -- Boost for executive sponsor or champion
  IF v_stakeholder.is_exec_sponsor = TRUE THEN
    v_score := GREATEST(v_score, 95);
  END IF;

  IF v_stakeholder.is_champion = TRUE THEN
    v_score := v_score + 10;
  END IF;

  -- Boost for decision maker flag
  IF v_stakeholder.decision_maker = TRUE THEN
    v_score := v_score + 10;
  END IF;

  -- Boost for budget authority
  IF v_stakeholder.budget_authority = TRUE THEN
    v_score := v_score + 10;
  END IF;

  -- Cap at 100
  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate engagement score for a stakeholder
CREATE OR REPLACE FUNCTION calculate_engagement_score(
  p_stakeholder_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_stakeholder RECORD;
  v_days_since_contact INTEGER;
  v_recent_activities INTEGER;
BEGIN
  -- Get stakeholder details
  SELECT * INTO v_stakeholder
  FROM stakeholders
  WHERE id = p_stakeholder_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate days since last contact
  IF v_stakeholder.last_contact_at IS NOT NULL THEN
    v_days_since_contact := EXTRACT(DAY FROM NOW() - v_stakeholder.last_contact_at);

    -- Recency score (40 points max)
    IF v_days_since_contact <= 7 THEN
      v_score := v_score + 40;
    ELSIF v_days_since_contact <= 14 THEN
      v_score := v_score + 35;
    ELSIF v_days_since_contact <= 30 THEN
      v_score := v_score + 25;
    ELSIF v_days_since_contact <= 60 THEN
      v_score := v_score + 15;
    ELSIF v_days_since_contact <= 90 THEN
      v_score := v_score + 5;
    END IF;
  END IF;

  -- Response rate score (30 points max)
  IF v_stakeholder.email_response_rate IS NOT NULL THEN
    v_score := v_score + LEAST(30, (v_stakeholder.email_response_rate * 0.3)::INTEGER);
  END IF;

  -- Meeting attendance score (20 points max)
  IF v_stakeholder.meeting_attendance_rate IS NOT NULL THEN
    v_score := v_score + LEAST(20, (v_stakeholder.meeting_attendance_rate * 0.2)::INTEGER);
  END IF;

  -- Sentiment bonus (10 points max)
  CASE v_stakeholder.sentiment
    WHEN 'positive' THEN v_score := v_score + 10;
    WHEN 'neutral' THEN v_score := v_score + 5;
    ELSE NULL;
  END CASE;

  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql;

-- Function to detect engagement gaps for a customer
CREATE OR REPLACE FUNCTION detect_engagement_gaps(
  p_customer_id UUID
) RETURNS TABLE (
  stakeholder_id UUID,
  stakeholder_name TEXT,
  title TEXT,
  gap_type VARCHAR(30),
  days_since_contact INTEGER,
  severity VARCHAR(10),
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS stakeholder_id,
    s.name AS stakeholder_name,
    s.title,
    CASE
      WHEN s.last_contact_at IS NULL THEN 'no_contact'::VARCHAR(30)
      WHEN s.last_contact_at < NOW() - INTERVAL '60 days' AND s.decision_maker = TRUE THEN 'stale_relationship'::VARCHAR(30)
      WHEN s.last_contact_at < NOW() - INTERVAL '30 days' AND s.is_exec_sponsor = TRUE THEN 'stale_relationship'::VARCHAR(30)
      WHEN s.email_response_rate < 20 THEN 'low_response'::VARCHAR(30)
      ELSE 'stale_relationship'::VARCHAR(30)
    END AS gap_type,
    CASE
      WHEN s.last_contact_at IS NOT NULL THEN EXTRACT(DAY FROM NOW() - s.last_contact_at)::INTEGER
      ELSE NULL
    END AS days_since_contact,
    CASE
      WHEN s.is_exec_sponsor = TRUE AND (s.last_contact_at IS NULL OR s.last_contact_at < NOW() - INTERVAL '30 days') THEN 'critical'::VARCHAR(10)
      WHEN s.decision_maker = TRUE AND (s.last_contact_at IS NULL OR s.last_contact_at < NOW() - INTERVAL '45 days') THEN 'high'::VARCHAR(10)
      WHEN s.is_champion = TRUE AND (s.last_contact_at IS NULL OR s.last_contact_at < NOW() - INTERVAL '30 days') THEN 'high'::VARCHAR(10)
      WHEN s.last_contact_at IS NULL OR s.last_contact_at < NOW() - INTERVAL '60 days' THEN 'medium'::VARCHAR(10)
      ELSE 'low'::VARCHAR(10)
    END AS severity,
    CASE
      WHEN s.last_contact_at IS NULL THEN 'Schedule introductory meeting to establish relationship'
      WHEN s.is_exec_sponsor = TRUE THEN 'Schedule executive briefing to maintain sponsor relationship'
      WHEN s.decision_maker = TRUE THEN 'Reach out to re-engage this key decision maker'
      WHEN s.email_response_rate < 20 THEN 'Try alternative communication channel'
      ELSE 'Schedule check-in call to maintain relationship'
    END AS recommendation
  FROM stakeholders s
  WHERE s.customer_id = p_customer_id
    AND s.status = 'active'
    AND (
      s.decision_maker = TRUE
      OR s.is_exec_sponsor = TRUE
      OR s.is_champion = TRUE
      OR s.influence_level = 'high'
    )
    AND (
      s.last_contact_at IS NULL
      OR s.last_contact_at < NOW() - INTERVAL '30 days'
      OR s.email_response_rate < 20
    )
  ORDER BY
    CASE WHEN s.is_exec_sponsor = TRUE THEN 0 ELSE 1 END,
    CASE WHEN s.decision_maker = TRUE THEN 0 ELSE 1 END,
    s.influence_score DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Function to get decision makers summary for a customer
CREATE OR REPLACE FUNCTION get_decision_makers_summary(
  p_customer_id UUID
) RETURNS TABLE (
  total_decision_makers BIGINT,
  covered_decision_makers BIGINT,
  coverage_percentage INTEGER,
  avg_influence_score INTEGER,
  avg_engagement_score INTEGER,
  has_executive_sponsor BOOLEAN,
  has_champion BOOLEAN,
  single_threaded_risk BOOLEAN
) AS $$
DECLARE
  v_total BIGINT;
  v_covered BIGINT;
  v_has_sponsor BOOLEAN;
  v_has_champion BOOLEAN;
  v_single_threaded BOOLEAN;
BEGIN
  -- Count total decision makers
  SELECT COUNT(*) INTO v_total
  FROM stakeholders
  WHERE customer_id = p_customer_id
    AND status = 'active'
    AND decision_maker = TRUE;

  -- Count covered (engaged within 30 days)
  SELECT COUNT(*) INTO v_covered
  FROM stakeholders
  WHERE customer_id = p_customer_id
    AND status = 'active'
    AND decision_maker = TRUE
    AND last_contact_at > NOW() - INTERVAL '30 days';

  -- Check for executive sponsor
  SELECT EXISTS(
    SELECT 1 FROM stakeholders
    WHERE customer_id = p_customer_id
      AND status = 'active'
      AND is_exec_sponsor = TRUE
  ) INTO v_has_sponsor;

  -- Check for champion
  SELECT EXISTS(
    SELECT 1 FROM stakeholders
    WHERE customer_id = p_customer_id
      AND status = 'active'
      AND is_champion = TRUE
  ) INTO v_has_champion;

  -- Check for single-threaded risk
  SELECT (
    SELECT COUNT(*) FROM stakeholders
    WHERE customer_id = p_customer_id
      AND status = 'active'
      AND (decision_maker = TRUE OR is_champion = TRUE OR is_exec_sponsor = TRUE)
      AND last_contact_at > NOW() - INTERVAL '30 days'
  ) <= 1 INTO v_single_threaded;

  RETURN QUERY
  SELECT
    v_total AS total_decision_makers,
    v_covered AS covered_decision_makers,
    CASE WHEN v_total > 0 THEN ((v_covered::FLOAT / v_total::FLOAT) * 100)::INTEGER ELSE 0 END AS coverage_percentage,
    COALESCE((
      SELECT AVG(COALESCE(influence_score, 50))::INTEGER
      FROM stakeholders
      WHERE customer_id = p_customer_id AND status = 'active' AND decision_maker = TRUE
    ), 50) AS avg_influence_score,
    COALESCE((
      SELECT AVG(COALESCE(engagement_score, 0))::INTEGER
      FROM stakeholders
      WHERE customer_id = p_customer_id AND status = 'active' AND decision_maker = TRUE
    ), 0) AS avg_engagement_score,
    v_has_sponsor AS has_executive_sponsor,
    v_has_champion AS has_champion,
    v_single_threaded AS single_threaded_risk;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers
-- ============================================

-- Trigger to auto-calculate influence score when stakeholder is updated
CREATE OR REPLACE FUNCTION auto_calculate_influence_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.influence_score := calculate_influence_score(NEW.id);
  NEW.last_analyzed_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_calculate_influence_score
  BEFORE INSERT OR UPDATE OF role, is_exec_sponsor, is_champion, decision_maker, budget_authority
  ON stakeholders
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_influence_score();

-- Update engagement gaps timestamp
CREATE OR REPLACE TRIGGER update_engagement_gaps_timestamp
  BEFORE UPDATE ON engagement_gaps
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- Grant Permissions
-- ============================================

GRANT ALL ON decision_maker_analyses TO authenticated;
GRANT ALL ON engagement_gaps TO authenticated;
GRANT ALL ON decision_outcomes TO authenticated;

-- ============================================
-- Update Existing Stakeholders
-- ============================================

-- Calculate initial influence scores for existing stakeholders
UPDATE stakeholders
SET
  influence_score = calculate_influence_score(id),
  engagement_score = calculate_engagement_score(id),
  last_analyzed_at = NOW()
WHERE decision_maker = TRUE OR is_exec_sponsor = TRUE OR is_champion = TRUE;

-- Set default decision authority based on roles
UPDATE stakeholders
SET decision_authority =
  CASE
    WHEN role ILIKE '%ceo%' OR role ILIKE '%cfo%' THEN '["budget_approval", "contract_signing", "executive_sponsor"]'::JSONB
    WHEN role ILIKE '%cto%' OR role ILIKE '%vp%engineering%' THEN '["technical_approval", "business_approval"]'::JSONB
    WHEN role ILIKE '%vp%' OR role ILIKE '%director%' THEN '["business_approval"]'::JSONB
    WHEN role ILIKE '%legal%' OR role ILIKE '%counsel%' THEN '["legal_approval"]'::JSONB
    WHEN is_champion = TRUE THEN '["influencer"]'::JSONB
    ELSE '[]'::JSONB
  END
WHERE decision_authority = '[]'::JSONB;
