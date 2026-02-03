-- Migration: PRD-059 Renewal Pipeline Forecast
-- Creates tables for storing renewal pipeline data and forecast history

-- ============================================
-- RENEWAL PIPELINE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS renewal_pipeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  renewal_date DATE NOT NULL,
  current_arr NUMERIC NOT NULL DEFAULT 0,
  predicted_outcome TEXT CHECK (predicted_outcome IN ('renew', 'churn', 'downgrade', 'expand')) DEFAULT 'renew',
  probability INTEGER CHECK (probability >= 0 AND probability <= 100) DEFAULT 50,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  expected_arr NUMERIC,
  confidence_low NUMERIC,
  confidence_high NUMERIC,
  factors JSONB DEFAULT '[]',
  last_contact_date DATE,
  csm_id UUID,
  owner_notes TEXT,
  status TEXT CHECK (status IN ('open', 'in_progress', 'committed', 'closed_won', 'closed_lost')) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_pipeline_customer ON renewal_pipeline(customer_id);
CREATE INDEX IF NOT EXISTS idx_renewal_pipeline_date ON renewal_pipeline(renewal_date);
CREATE INDEX IF NOT EXISTS idx_renewal_pipeline_risk ON renewal_pipeline(risk_level);
CREATE INDEX IF NOT EXISTS idx_renewal_pipeline_status ON renewal_pipeline(status);

-- ============================================
-- FORECAST HISTORY TABLE (for accuracy tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS renewal_forecast_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  forecast_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  predicted_outcome TEXT NOT NULL,
  predicted_probability INTEGER NOT NULL,
  predicted_arr NUMERIC NOT NULL,
  actual_outcome TEXT,
  actual_arr NUMERIC,
  was_accurate BOOLEAN,
  accuracy_score NUMERIC,
  factors_snapshot JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forecast_history_customer ON renewal_forecast_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_forecast_history_date ON renewal_forecast_history(forecast_date);

-- ============================================
-- RENEWAL FACTORS TABLE (configurable weights)
-- ============================================
CREATE TABLE IF NOT EXISTS renewal_factors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0.1,
  positive_threshold NUMERIC,
  negative_threshold NUMERIC,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default factors with weights from PRD
INSERT INTO renewal_factors (name, display_name, weight, positive_threshold, negative_threshold, description)
VALUES
  ('health_score', 'Health Score', 0.25, 70, 50, 'Overall customer health score'),
  ('usage_trend', 'Usage Trend', 0.20, 0.1, -0.1, 'Month-over-month usage change'),
  ('stakeholder_engagement', 'Stakeholder Engagement', 0.15, 14, 30, 'Days since last stakeholder contact'),
  ('champion_status', 'Champion Status', 0.15, 1, 0, 'Active champion presence (1=yes, 0=no)'),
  ('nps_score', 'NPS Score', 0.10, 8, 6, 'Latest NPS response'),
  ('support_ticket_trend', 'Support Ticket Trend', 0.10, -0.1, 0.2, 'Change in support ticket volume'),
  ('historical_renewal', 'Historical Renewal', 0.05, 1, 0, 'Previous renewal history (1=renewed, 0=new)')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================
CREATE TRIGGER update_renewal_pipeline_timestamp
  BEFORE UPDATE ON renewal_pipeline
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_renewal_factors_timestamp
  BEFORE UPDATE ON renewal_factors
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- ADD RENEWAL DATE TO CUSTOMERS IF NOT EXISTS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'renewal_date'
  ) THEN
    ALTER TABLE customers ADD COLUMN renewal_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'nps_score'
  ) THEN
    ALTER TABLE customers ADD COLUMN nps_score INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'champion_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN champion_id UUID REFERENCES stakeholders(id);
  END IF;
END $$;

-- ============================================
-- SAMPLE RENEWAL PIPELINE DATA
-- ============================================
INSERT INTO renewal_pipeline (customer_id, renewal_date, current_arr, predicted_outcome, probability, risk_level, expected_arr)
SELECT
  c.id,
  (CURRENT_DATE + (30 + (random() * 60)::INTEGER))::DATE as renewal_date,
  c.arr,
  CASE
    WHEN c.health_score >= 80 THEN 'expand'
    WHEN c.health_score >= 60 THEN 'renew'
    WHEN c.health_score >= 40 THEN 'downgrade'
    ELSE 'churn'
  END as predicted_outcome,
  GREATEST(10, LEAST(95, c.health_score + (random() * 10 - 5)::INTEGER)) as probability,
  CASE
    WHEN c.health_score >= 80 THEN 'low'
    WHEN c.health_score >= 60 THEN 'medium'
    WHEN c.health_score >= 40 THEN 'high'
    ELSE 'critical'
  END as risk_level,
  CASE
    WHEN c.health_score >= 80 THEN c.arr * 1.2
    WHEN c.health_score >= 60 THEN c.arr
    WHEN c.health_score >= 40 THEN c.arr * 0.8
    ELSE 0
  END as expected_arr
FROM customers c
WHERE c.arr > 0
ON CONFLICT DO NOTHING;
