-- PRD-113: Risk Score Calculation
-- Dedicated risk score tracking with signal aggregation

-- ============================================
-- RISK SCORES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  previous_score INTEGER,
  score_change INTEGER,
  trend VARCHAR(20) CHECK (trend IN ('increasing', 'stable', 'decreasing')),
  risk_level VARCHAR(20) GENERATED ALWAYS AS (
    CASE
      WHEN score >= 80 THEN 'critical'
      WHEN score >= 60 THEN 'high'
      WHEN score >= 40 THEN 'medium'
      ELSE 'low'
    END
  ) STORED,
  components JSONB NOT NULL DEFAULT '{}',
  signal_breakdown JSONB NOT NULL DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculation_reason VARCHAR(100) DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure one score per customer per day
  UNIQUE(customer_id, (calculated_at::date))
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_risk_scores_customer_id ON risk_scores(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_score ON risk_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scores_calculated_at ON risk_scores(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scores_risk_level ON risk_scores(risk_level);

-- ============================================
-- RISK SCORE HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS risk_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  risk_level VARCHAR(20),
  components JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_score_history_customer ON risk_score_history(customer_id, recorded_at DESC);

-- ============================================
-- RISK SCORE ALERTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS risk_score_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('threshold_exceeded', 'rapid_increase', 'critical_signals')),
  previous_score INTEGER,
  current_score INTEGER NOT NULL,
  score_change INTEGER,
  previous_level VARCHAR(20),
  current_level VARCHAR(20),
  triggered_signals JSONB NOT NULL DEFAULT '[]',
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMPTZ,
  action_taken VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_score_alerts_customer ON risk_score_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_score_alerts_unacked ON risk_score_alerts(acknowledged, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_score_alerts_type ON risk_score_alerts(alert_type);

-- ============================================
-- RISK SIGNALS TABLE (individual signals tracked over time)
-- ============================================

CREATE TABLE IF NOT EXISTS risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  signal_type VARCHAR(50) NOT NULL CHECK (signal_type IN (
    'usage_decline',
    'nps_detractor',
    'champion_departed',
    'support_escalation',
    'payment_issues',
    'competitive_mention',
    'engagement_silence',
    'health_score_drop'
  )),
  severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  value DECIMAL(5,2) NOT NULL CHECK (value >= 0 AND value <= 1),
  raw_data JSONB NOT NULL DEFAULT '{}',
  evidence TEXT[],
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_signals_customer ON risk_signals(customer_id, is_active);
CREATE INDEX IF NOT EXISTS idx_risk_signals_type ON risk_signals(signal_type, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_signals_active ON risk_signals(customer_id, is_active, detected_at DESC);

-- ============================================
-- SAVE PLAYS TABLE (interventions for at-risk accounts)
-- ============================================

CREATE TABLE IF NOT EXISTS save_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  triggered_by_score_id UUID REFERENCES risk_scores(id),
  play_type VARCHAR(50) NOT NULL CHECK (play_type IN (
    'executive_outreach',
    'value_reinforcement',
    'adoption_workshop',
    'pricing_review',
    'champion_rebuild',
    'support_escalation',
    'custom'
  )),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to VARCHAR(255),
  risk_score_at_start INTEGER,
  risk_score_at_end INTEGER,
  actions_taken JSONB DEFAULT '[]',
  outcome VARCHAR(50) CHECK (outcome IN ('saved', 'churned', 'pending', 'partial')),
  notes TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_save_plays_customer ON save_plays(customer_id);
CREATE INDEX IF NOT EXISTS idx_save_plays_status ON save_plays(status);

-- ============================================
-- VIEWS
-- ============================================

-- Latest risk score per customer
CREATE OR REPLACE VIEW v_latest_risk_scores AS
SELECT DISTINCT ON (customer_id)
  rs.*,
  c.name as customer_name,
  c.arr,
  c.health_score,
  c.stage,
  c.renewal_date
FROM risk_scores rs
JOIN customers c ON rs.customer_id = c.id
ORDER BY customer_id, calculated_at DESC;

-- Portfolio risk summary
CREATE OR REPLACE VIEW v_risk_portfolio_summary AS
SELECT
  COUNT(*) as total_customers,
  SUM(c.arr) as total_arr,
  ROUND(AVG(COALESCE(rs.score, 0)), 0) as avg_risk_score,
  COUNT(CASE WHEN rs.risk_level = 'critical' THEN 1 END) as critical_count,
  COUNT(CASE WHEN rs.risk_level = 'high' THEN 1 END) as high_count,
  COUNT(CASE WHEN rs.risk_level = 'medium' THEN 1 END) as medium_count,
  COUNT(CASE WHEN rs.risk_level = 'low' THEN 1 END) as low_count,
  SUM(CASE WHEN rs.risk_level IN ('critical', 'high') THEN c.arr ELSE 0 END) as arr_at_risk
FROM customers c
LEFT JOIN (
  SELECT DISTINCT ON (customer_id) *
  FROM risk_scores
  ORDER BY customer_id, calculated_at DESC
) rs ON c.id = rs.customer_id
WHERE c.stage != 'churned';

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update customer stage based on risk score
CREATE OR REPLACE FUNCTION update_customer_stage_on_risk()
RETURNS TRIGGER AS $$
BEGIN
  -- If risk score exceeds threshold (70+), mark customer as at_risk
  IF NEW.score >= 70 AND EXISTS (
    SELECT 1 FROM customers WHERE id = NEW.customer_id AND stage NOT IN ('at_risk', 'churned')
  ) THEN
    UPDATE customers
    SET stage = 'at_risk', updated_at = NOW()
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update customer stage
DROP TRIGGER IF EXISTS trg_update_stage_on_risk ON risk_scores;
CREATE TRIGGER trg_update_stage_on_risk
  AFTER INSERT ON risk_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stage_on_risk();

-- Function to archive old risk score history
CREATE OR REPLACE FUNCTION archive_old_risk_history()
RETURNS void AS $$
BEGIN
  DELETE FROM risk_score_history
  WHERE recorded_at < NOW() - INTERVAL '365 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE risk_scores IS 'PRD-113: Composite risk scores with weighted signal aggregation';
COMMENT ON TABLE risk_score_alerts IS 'PRD-113: Alerts when risk scores exceed thresholds or change rapidly';
COMMENT ON TABLE risk_signals IS 'PRD-113: Individual risk signals tracked over time for recency weighting';
COMMENT ON TABLE save_plays IS 'PRD-113: Intervention workflows for at-risk accounts';
