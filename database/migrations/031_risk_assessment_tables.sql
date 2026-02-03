-- Risk Assessment Tables (PRD-229)
-- AI-powered deal and customer risk assessment

-- ============================================
-- RISK ASSESSMENTS
-- Main table storing risk assessments
-- ============================================
CREATE TABLE IF NOT EXISTS risk_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  deal_id TEXT,
  deal_type VARCHAR(50), -- 'renewal', 'upsell', 'cross_sell', 'expansion'
  deal_value NUMERIC,
  close_date DATE,
  overall_risk_score INTEGER NOT NULL CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  risks JSONB NOT NULL DEFAULT '[]',
  mitigations JSONB DEFAULT '[]',
  comparison JSONB,
  trend JSONB,
  model_version VARCHAR(20),
  assessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for risk_assessments
CREATE INDEX IF NOT EXISTS idx_risk_assessments_customer ON risk_assessments(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_deal ON risk_assessments(deal_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_level ON risk_assessments(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_score ON risk_assessments(overall_risk_score);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_assessed ON risk_assessments(assessed_at);

-- ============================================
-- RISK ASSESSMENT HISTORY
-- Historical record of risk scores for trending
-- ============================================
CREATE TABLE IF NOT EXISTS risk_assessment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  deal_id TEXT,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for risk_assessment_history
CREATE INDEX IF NOT EXISTS idx_risk_history_customer ON risk_assessment_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_history_customer_date ON risk_assessment_history(customer_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_risk_history_recorded ON risk_assessment_history(recorded_at);

-- ============================================
-- RISK MITIGATION ACTIONS
-- Tracking of mitigation actions taken
-- ============================================
CREATE TABLE IF NOT EXISTS risk_mitigation_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  deal_id TEXT,
  risk_id TEXT NOT NULL,
  action TEXT NOT NULL,
  expected_impact INTEGER,
  effort VARCHAR(20) CHECK (effort IN ('low', 'medium', 'high')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  outcome VARCHAR(50) CHECK (outcome IN ('successful', 'partially_successful', 'unsuccessful')),
  owner TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for risk_mitigation_actions
CREATE INDEX IF NOT EXISTS idx_mitigation_customer ON risk_mitigation_actions(customer_id);
CREATE INDEX IF NOT EXISTS idx_mitigation_status ON risk_mitigation_actions(status);
CREATE INDEX IF NOT EXISTS idx_mitigation_risk ON risk_mitigation_actions(risk_id);

-- ============================================
-- RISK ALERTS
-- Alerts for risk threshold crossings
-- ============================================
CREATE TABLE IF NOT EXISTS risk_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('threshold_crossed', 'rapid_increase', 'new_critical_risk')),
  previous_level VARCHAR(20) CHECK (previous_level IN ('low', 'medium', 'high', 'critical')),
  current_level VARCHAR(20) NOT NULL CHECK (current_level IN ('low', 'medium', 'high', 'critical')),
  previous_score INTEGER,
  current_score INTEGER NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ
);

-- Indexes for risk_alerts
CREATE INDEX IF NOT EXISTS idx_risk_alerts_customer ON risk_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_acknowledged ON risk_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_triggered ON risk_alerts(triggered_at);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_level ON risk_alerts(current_level);

-- ============================================
-- RISK CONFIGURATION
-- Configuration for risk thresholds and weights
-- ============================================
CREATE TABLE IF NOT EXISTS risk_configuration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO risk_configuration (config_key, config_value, description)
VALUES
  ('alert_thresholds', '{"medium": 50, "high": 70, "critical": 85}', 'Risk score thresholds for alert levels'),
  ('risk_weights', '{"relationship": 1.0, "product": 1.0, "commercial": 0.8, "competitive": 1.2, "timing": 0.7, "process": 0.6}', 'Weighting factors for risk categories'),
  ('refresh_interval_hours', '24', 'How often to automatically refresh risk assessments')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- AUTO-UPDATE TIMESTAMPS TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_risk_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to risk_assessments
DROP TRIGGER IF EXISTS update_risk_assessments_timestamp ON risk_assessments;
CREATE TRIGGER update_risk_assessments_timestamp
  BEFORE UPDATE ON risk_assessments
  FOR EACH ROW EXECUTE FUNCTION update_risk_timestamp();

-- Apply trigger to risk_configuration
DROP TRIGGER IF EXISTS update_risk_configuration_timestamp ON risk_configuration;
CREATE TRIGGER update_risk_configuration_timestamp
  BEFORE UPDATE ON risk_configuration
  FOR EACH ROW EXECUTE FUNCTION update_risk_timestamp();

-- ============================================
-- ALERT GENERATION FUNCTION
-- Creates alert when risk level crosses threshold
-- ============================================
CREATE OR REPLACE FUNCTION generate_risk_alert()
RETURNS TRIGGER AS $$
DECLARE
  prev_record RECORD;
  should_alert BOOLEAN := FALSE;
  alert_type_val VARCHAR(50);
BEGIN
  -- Get previous assessment for this customer
  SELECT overall_risk_score, risk_level
  INTO prev_record
  FROM risk_assessment_history
  WHERE customer_id = NEW.customer_id
    AND recorded_at < NOW() - INTERVAL '1 hour'
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Check if we should generate an alert
  IF prev_record IS NOT NULL THEN
    -- Threshold crossed
    IF prev_record.risk_level != NEW.risk_level AND NEW.risk_level IN ('high', 'critical') THEN
      should_alert := TRUE;
      alert_type_val := 'threshold_crossed';
    -- Rapid increase (more than 15 points)
    ELSIF NEW.risk_score - prev_record.overall_risk_score > 15 THEN
      should_alert := TRUE;
      alert_type_val := 'rapid_increase';
    END IF;
  ELSIF NEW.risk_level = 'critical' THEN
    -- New critical risk
    should_alert := TRUE;
    alert_type_val := 'new_critical_risk';
  END IF;

  IF should_alert THEN
    INSERT INTO risk_alerts (
      customer_id,
      customer_name,
      alert_type,
      previous_level,
      current_level,
      previous_score,
      current_score
    )
    SELECT
      NEW.customer_id,
      c.name,
      alert_type_val,
      prev_record.risk_level,
      NEW.risk_level,
      prev_record.overall_risk_score,
      NEW.risk_score
    FROM customers c
    WHERE c.id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to risk_assessment_history
DROP TRIGGER IF EXISTS trigger_risk_alert ON risk_assessment_history;
CREATE TRIGGER trigger_risk_alert
  AFTER INSERT ON risk_assessment_history
  FOR EACH ROW EXECUTE FUNCTION generate_risk_alert();

-- ============================================
-- VIEWS
-- Useful views for querying risk data
-- ============================================

-- Latest risk assessment per customer
CREATE OR REPLACE VIEW v_latest_risk_assessments AS
SELECT DISTINCT ON (customer_id)
  ra.*
FROM risk_assessments ra
ORDER BY customer_id, assessed_at DESC;

-- At-risk customers (high or critical)
CREATE OR REPLACE VIEW v_at_risk_customers AS
SELECT
  c.id,
  c.name,
  c.arr,
  c.industry,
  ra.overall_risk_score,
  ra.risk_level,
  ra.risks,
  ra.assessed_at
FROM customers c
JOIN v_latest_risk_assessments ra ON c.id = ra.customer_id
WHERE ra.risk_level IN ('high', 'critical')
ORDER BY ra.overall_risk_score DESC;

-- Portfolio risk summary
CREATE OR REPLACE VIEW v_portfolio_risk_summary AS
SELECT
  ra.risk_level,
  COUNT(*) as customer_count,
  SUM(c.arr) as total_arr,
  AVG(ra.overall_risk_score) as avg_risk_score
FROM v_latest_risk_assessments ra
JOIN customers c ON ra.customer_id = c.id
GROUP BY ra.risk_level;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE risk_assessments IS 'AI-powered risk assessments for customers and deals (PRD-229)';
COMMENT ON TABLE risk_assessment_history IS 'Historical record of risk scores for trending analysis';
COMMENT ON TABLE risk_mitigation_actions IS 'Tracking of mitigation actions taken to address risks';
COMMENT ON TABLE risk_alerts IS 'Alerts generated when risk levels cross thresholds';
COMMENT ON TABLE risk_configuration IS 'Configuration settings for risk assessment system';
