-- PRD-238: Expansion Propensity Modeling
-- Database schema for storing expansion propensity scores and tracking accuracy

-- ============================================================================
-- Expansion Propensity Table
-- Stores calculated propensity scores for customers
-- ============================================================================

CREATE TABLE IF NOT EXISTS expansion_propensity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  propensity_score INTEGER NOT NULL CHECK (propensity_score >= 0 AND propensity_score <= 100),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  contributing_factors JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{"factor": string, "description": string, "weight": number, "category": string, "signal": string}]
  recommended_products JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{"name": string, "reason": string, "estimatedValue": number, "confidence": number}]
  estimated_value DECIMAL(12,2) DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}'::jsonb,
  -- Structure: {"usage": number, "engagement": number, "health": number, "business": number, "stakeholder": number, "cohort": number}
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)  -- One active score per customer
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_expansion_propensity_score
  ON expansion_propensity(propensity_score DESC);

CREATE INDEX IF NOT EXISTS idx_expansion_propensity_customer
  ON expansion_propensity(customer_id);

CREATE INDEX IF NOT EXISTS idx_expansion_propensity_calculated_at
  ON expansion_propensity(calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_expansion_propensity_estimated_value
  ON expansion_propensity(estimated_value DESC);

-- Partial index for high propensity customers (frequently queried)
CREATE INDEX IF NOT EXISTS idx_expansion_propensity_high
  ON expansion_propensity(customer_id, propensity_score DESC)
  WHERE propensity_score >= 60;

-- ============================================================================
-- Expansion Propensity History Table
-- Tracks historical propensity scores for trend analysis and model accuracy
-- ============================================================================

CREATE TABLE IF NOT EXISTS expansion_propensity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  propensity_score INTEGER NOT NULL CHECK (propensity_score >= 0 AND propensity_score <= 100),
  confidence DECIMAL(3,2),
  contributing_factors JSONB,
  estimated_value DECIMAL(12,2),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_propensity_history_customer_date
  ON expansion_propensity_history(customer_id, calculated_at DESC);

-- ============================================================================
-- Expansion Propensity Feedback Table
-- Tracks feedback on propensity score accuracy for model improvement
-- ============================================================================

CREATE TABLE IF NOT EXISTS expansion_propensity_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  propensity_id UUID REFERENCES expansion_propensity(id) ON DELETE SET NULL,
  propensity_score_at_feedback INTEGER NOT NULL,
  feedback_accurate BOOLEAN NOT NULL,
  actual_outcome VARCHAR(50) CHECK (actual_outcome IN (
    'expanded', 'renewed_flat', 'downgraded', 'churned', 'pending'
  )),
  actual_expansion_value DECIMAL(12,2),
  notes TEXT,
  feedback_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_propensity_feedback_customer
  ON expansion_propensity_feedback(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_propensity_feedback_accuracy
  ON expansion_propensity_feedback(feedback_accurate, created_at DESC);

-- ============================================================================
-- Model Accuracy Metrics View
-- Aggregated view for tracking model performance
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS expansion_propensity_accuracy AS
SELECT
  DATE_TRUNC('week', created_at) AS week_start,
  COUNT(*) AS total_feedback,
  SUM(CASE WHEN feedback_accurate THEN 1 ELSE 0 END) AS accurate_count,
  ROUND(AVG(CASE WHEN feedback_accurate THEN 1 ELSE 0 END) * 100, 2) AS accuracy_rate,
  AVG(propensity_score_at_feedback) AS avg_score_when_accurate,
  SUM(COALESCE(actual_expansion_value, 0)) AS total_expansion_captured
FROM expansion_propensity_feedback
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week_start DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_propensity_accuracy_week
  ON expansion_propensity_accuracy(week_start);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to refresh the accuracy view
CREATE OR REPLACE FUNCTION refresh_propensity_accuracy()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY expansion_propensity_accuracy;
END;
$$;

-- Function to archive old propensity scores to history
CREATE OR REPLACE FUNCTION archive_propensity_to_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only archive if score changed significantly (>5 points)
  IF OLD.propensity_score IS NOT NULL AND
     ABS(NEW.propensity_score - OLD.propensity_score) > 5 THEN
    INSERT INTO expansion_propensity_history (
      customer_id,
      propensity_score,
      confidence,
      contributing_factors,
      estimated_value,
      calculated_at
    ) VALUES (
      OLD.customer_id,
      OLD.propensity_score,
      OLD.confidence,
      OLD.contributing_factors,
      OLD.estimated_value,
      OLD.calculated_at
    );
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to archive scores on update
DROP TRIGGER IF EXISTS trigger_archive_propensity ON expansion_propensity;
CREATE TRIGGER trigger_archive_propensity
  BEFORE UPDATE ON expansion_propensity
  FOR EACH ROW
  EXECUTE FUNCTION archive_propensity_to_history();

-- Function to get customer propensity trend
CREATE OR REPLACE FUNCTION get_propensity_trend(
  p_customer_id UUID,
  p_days INTEGER DEFAULT 90
)
RETURNS TABLE (
  calculated_at TIMESTAMPTZ,
  propensity_score INTEGER,
  estimated_value DECIMAL(12,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.calculated_at,
    h.propensity_score,
    h.estimated_value
  FROM expansion_propensity_history h
  WHERE h.customer_id = p_customer_id
    AND h.calculated_at >= NOW() - (p_days || ' days')::INTERVAL
  ORDER BY h.calculated_at ASC;
END;
$$;

-- Function to get top expansion opportunities
CREATE OR REPLACE FUNCTION get_top_expansion_opportunities(
  p_limit INTEGER DEFAULT 10,
  p_min_score INTEGER DEFAULT 60
)
RETURNS TABLE (
  customer_id UUID,
  customer_name TEXT,
  propensity_score INTEGER,
  confidence DECIMAL(3,2),
  estimated_value DECIMAL(12,2),
  contributing_factors JSONB,
  calculated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ep.customer_id,
    c.name AS customer_name,
    ep.propensity_score,
    ep.confidence,
    ep.estimated_value,
    ep.contributing_factors,
    ep.calculated_at
  FROM expansion_propensity ep
  JOIN customers c ON c.id = ep.customer_id
  WHERE ep.propensity_score >= p_min_score
    AND c.stage NOT IN ('churned', 'onboarding')
  ORDER BY ep.propensity_score DESC, ep.estimated_value DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE expansion_propensity ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_propensity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_propensity_feedback ENABLE ROW LEVEL SECURITY;

-- Policies for expansion_propensity
CREATE POLICY expansion_propensity_select_policy ON expansion_propensity
  FOR SELECT USING (true);

CREATE POLICY expansion_propensity_insert_policy ON expansion_propensity
  FOR INSERT WITH CHECK (true);

CREATE POLICY expansion_propensity_update_policy ON expansion_propensity
  FOR UPDATE USING (true);

-- Policies for expansion_propensity_history
CREATE POLICY propensity_history_select_policy ON expansion_propensity_history
  FOR SELECT USING (true);

CREATE POLICY propensity_history_insert_policy ON expansion_propensity_history
  FOR INSERT WITH CHECK (true);

-- Policies for expansion_propensity_feedback
CREATE POLICY propensity_feedback_select_policy ON expansion_propensity_feedback
  FOR SELECT USING (true);

CREATE POLICY propensity_feedback_insert_policy ON expansion_propensity_feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY propensity_feedback_update_policy ON expansion_propensity_feedback
  FOR UPDATE USING (true);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE expansion_propensity IS 'Stores current expansion propensity scores for customers (PRD-238)';
COMMENT ON TABLE expansion_propensity_history IS 'Historical propensity scores for trend analysis and model accuracy tracking';
COMMENT ON TABLE expansion_propensity_feedback IS 'User feedback on propensity score accuracy for model improvement';
COMMENT ON MATERIALIZED VIEW expansion_propensity_accuracy IS 'Weekly aggregated model accuracy metrics';
COMMENT ON FUNCTION refresh_propensity_accuracy() IS 'Refreshes the propensity accuracy materialized view';
COMMENT ON FUNCTION get_propensity_trend(UUID, INTEGER) IS 'Returns propensity score trend for a customer over specified days';
COMMENT ON FUNCTION get_top_expansion_opportunities(INTEGER, INTEGER) IS 'Returns top expansion opportunities above minimum score';
