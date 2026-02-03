-- PRD-085: Account Readiness Assessment
-- Migration for readiness_assessments table

-- ============================================
-- Readiness Assessments Table
-- ============================================

CREATE TABLE IF NOT EXISTS readiness_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  milestone_type VARCHAR(50) NOT NULL,
  milestone_date DATE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  dimension_scores JSONB NOT NULL DEFAULT '{}',
  gaps JSONB NOT NULL DEFAULT '[]',
  checklist JSONB NOT NULL DEFAULT '[]',
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome VARCHAR(20) CHECK (outcome IN ('success', 'partial', 'failed', 'pending')),
  outcome_notes TEXT,
  outcome_recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraint for milestone type
ALTER TABLE readiness_assessments
ADD CONSTRAINT valid_milestone_type CHECK (
  milestone_type IN ('renewal', 'expansion', 'qbr', 'onboarding_complete', 'executive_briefing')
);

-- ============================================
-- Indexes
-- ============================================

-- Index for customer lookups
CREATE INDEX IF NOT EXISTS idx_readiness_customer_id
ON readiness_assessments(customer_id);

-- Index for milestone type filtering
CREATE INDEX IF NOT EXISTS idx_readiness_milestone_type
ON readiness_assessments(milestone_type);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_readiness_assessed_at
ON readiness_assessments(assessed_at DESC);

-- Index for finding assessments by milestone date
CREATE INDEX IF NOT EXISTS idx_readiness_milestone_date
ON readiness_assessments(milestone_date);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_readiness_customer_milestone
ON readiness_assessments(customer_id, milestone_type, assessed_at DESC);

-- Index for outcome analysis
CREATE INDEX IF NOT EXISTS idx_readiness_outcome
ON readiness_assessments(outcome) WHERE outcome IS NOT NULL;

-- ============================================
-- Triggers
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_readiness_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_readiness_updated_at ON readiness_assessments;
CREATE TRIGGER trigger_readiness_updated_at
  BEFORE UPDATE ON readiness_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_readiness_timestamp();

-- ============================================
-- Views
-- ============================================

-- View for latest assessment per customer per milestone type
CREATE OR REPLACE VIEW latest_readiness_assessments AS
SELECT DISTINCT ON (customer_id, milestone_type)
  id,
  customer_id,
  milestone_type,
  milestone_date,
  overall_score,
  dimension_scores,
  gaps,
  assessed_at,
  outcome
FROM readiness_assessments
ORDER BY customer_id, milestone_type, assessed_at DESC;

-- View for upcoming milestones that need attention
CREATE OR REPLACE VIEW upcoming_milestones_needing_attention AS
SELECT
  ra.id,
  ra.customer_id,
  c.name as customer_name,
  ra.milestone_type,
  ra.milestone_date,
  ra.overall_score,
  ra.assessed_at,
  CASE
    WHEN ra.overall_score < 50 THEN 'critical'
    WHEN ra.overall_score < 70 THEN 'needs_attention'
    ELSE 'on_track'
  END as readiness_status,
  ra.milestone_date - CURRENT_DATE as days_until_milestone,
  jsonb_array_length(ra.gaps) as gap_count
FROM readiness_assessments ra
JOIN customers c ON ra.customer_id = c.id
WHERE ra.milestone_date IS NOT NULL
  AND ra.milestone_date >= CURRENT_DATE
  AND ra.milestone_date <= CURRENT_DATE + INTERVAL '90 days'
  AND ra.id IN (
    SELECT id FROM latest_readiness_assessments
  )
ORDER BY
  CASE WHEN ra.overall_score < 50 THEN 0 ELSE 1 END,
  ra.milestone_date ASC;

-- ============================================
-- Functions
-- ============================================

-- Function to get readiness trend for a customer
CREATE OR REPLACE FUNCTION get_readiness_trend(
  p_customer_id UUID,
  p_milestone_type VARCHAR(50),
  p_lookback_days INTEGER DEFAULT 90
)
RETURNS TABLE (
  assessed_at TIMESTAMPTZ,
  overall_score INTEGER,
  dimension_scores JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ra.assessed_at,
    ra.overall_score,
    ra.dimension_scores
  FROM readiness_assessments ra
  WHERE ra.customer_id = p_customer_id
    AND ra.milestone_type = p_milestone_type
    AND ra.assessed_at >= NOW() - (p_lookback_days || ' days')::INTERVAL
  ORDER BY ra.assessed_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate average readiness by segment
CREATE OR REPLACE FUNCTION get_segment_readiness_avg(
  p_milestone_type VARCHAR(50)
)
RETURNS TABLE (
  segment VARCHAR(50),
  avg_score NUMERIC,
  customer_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.segment,
    ROUND(AVG(lra.overall_score)::NUMERIC, 1) as avg_score,
    COUNT(DISTINCT c.id) as customer_count
  FROM latest_readiness_assessments lra
  JOIN customers c ON lra.customer_id = c.id
  WHERE lra.milestone_type = p_milestone_type
  GROUP BY c.segment
  ORDER BY avg_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get outcome correlation data
CREATE OR REPLACE FUNCTION get_readiness_outcome_correlation(
  p_milestone_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  score_range VARCHAR(20),
  total_count BIGINT,
  success_count BIGINT,
  partial_count BIGINT,
  failed_count BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH scored_assessments AS (
    SELECT
      CASE
        WHEN overall_score >= 80 THEN '80-100'
        WHEN overall_score >= 60 THEN '60-79'
        WHEN overall_score >= 40 THEN '40-59'
        ELSE '0-39'
      END as score_range,
      outcome
    FROM readiness_assessments
    WHERE outcome IS NOT NULL
      AND (p_milestone_type IS NULL OR milestone_type = p_milestone_type)
  )
  SELECT
    sa.score_range,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE sa.outcome = 'success') as success_count,
    COUNT(*) FILTER (WHERE sa.outcome = 'partial') as partial_count,
    COUNT(*) FILTER (WHERE sa.outcome = 'failed') as failed_count,
    ROUND(
      (COUNT(*) FILTER (WHERE sa.outcome = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      1
    ) as success_rate
  FROM scored_assessments sa
  GROUP BY sa.score_range
  ORDER BY sa.score_range DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies (if enabled)
-- ============================================

-- Enable RLS
ALTER TABLE readiness_assessments ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own customers' assessments
CREATE POLICY readiness_select_own ON readiness_assessments
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE csm_id = auth.uid()
         OR team_id IN (SELECT team_id FROM user_teams WHERE user_id = auth.uid())
    )
  );

-- Policy for users to insert assessments for their customers
CREATE POLICY readiness_insert_own ON readiness_assessments
  FOR INSERT
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers
      WHERE csm_id = auth.uid()
         OR team_id IN (SELECT team_id FROM user_teams WHERE user_id = auth.uid())
    )
  );

-- Policy for users to update their customers' assessments
CREATE POLICY readiness_update_own ON readiness_assessments
  FOR UPDATE
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE csm_id = auth.uid()
         OR team_id IN (SELECT team_id FROM user_teams WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- Sample Data (for testing, commented out)
-- ============================================

/*
INSERT INTO readiness_assessments (
  customer_id,
  milestone_type,
  milestone_date,
  overall_score,
  dimension_scores,
  gaps,
  checklist,
  assessed_at
)
SELECT
  id as customer_id,
  'renewal' as milestone_type,
  contract_end_date as milestone_date,
  health_score as overall_score,
  jsonb_build_object(
    'productAdoption', health_score + FLOOR(RANDOM() * 10 - 5),
    'stakeholderEngagement', health_score + FLOOR(RANDOM() * 15 - 7),
    'valueRealization', health_score + FLOOR(RANDOM() * 10 - 5),
    'supportHealth', health_score + FLOOR(RANDOM() * 20 - 10),
    'executiveAlignment', health_score + FLOOR(RANDOM() * 15 - 7),
    'financialHealth', health_score + FLOOR(RANDOM() * 10 - 5)
  ) as dimension_scores,
  '[]'::jsonb as gaps,
  '[]'::jsonb as checklist,
  NOW() - (FLOOR(RANDOM() * 30) || ' days')::INTERVAL as assessed_at
FROM customers
WHERE contract_end_date IS NOT NULL
  AND contract_end_date >= CURRENT_DATE
  AND contract_end_date <= CURRENT_DATE + INTERVAL '90 days'
LIMIT 10;
*/

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE readiness_assessments IS 'PRD-085: Stores account readiness assessments for major milestones';
COMMENT ON COLUMN readiness_assessments.milestone_type IS 'Type of milestone: renewal, expansion, qbr, onboarding_complete, executive_briefing';
COMMENT ON COLUMN readiness_assessments.dimension_scores IS 'JSONB object with scores for each dimension (productAdoption, stakeholderEngagement, etc.)';
COMMENT ON COLUMN readiness_assessments.gaps IS 'JSONB array of identified gaps with priority, impact, and suggested actions';
COMMENT ON COLUMN readiness_assessments.checklist IS 'JSONB array of checklist items with task, due date, completed status';
COMMENT ON COLUMN readiness_assessments.outcome IS 'Recorded outcome after milestone: success, partial, failed, pending';
