-- PRD-130: Upsell Success Measurement
-- Migration: 027_upsell_success_measurement.sql
-- Created: 2026-01-29
-- Description: Tables for measuring success after upsell completion

-- ================================================
-- UPSELL SUCCESS MEASUREMENTS TABLE
-- Core table for tracking upsell success measurement plans
-- ================================================
CREATE TABLE IF NOT EXISTS upsell_success_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  upsell_id VARCHAR(255), -- External upsell/opportunity ID
  opportunity_id VARCHAR(255), -- Salesforce opportunity ID

  -- Upsell Details
  products JSONB DEFAULT '[]', -- Array of product names
  arr_increase DECIMAL(12,2) NOT NULL,
  close_date TIMESTAMPTZ NOT NULL,
  sales_rep VARCHAR(255),

  -- Success Criteria
  success_criteria JSONB DEFAULT '{}', -- {metrics: [], goals: [], benchmarks: {}}

  -- Measurement Plan
  measurement_plan JSONB DEFAULT '{}', -- {trackingStart, checkpoints: [], dashboardUrl}

  -- Progress Tracking
  progress_status VARCHAR(50) DEFAULT 'pending' CHECK (progress_status IN ('pending', 'on_track', 'at_risk', 'behind', 'exceeding')),
  metrics_progress JSONB DEFAULT '[]', -- Array of metric progress records
  progress_last_updated TIMESTAMPTZ,

  -- Reviews
  reviews JSONB DEFAULT '[]', -- Array of review records

  -- Outcome Documentation
  outcome_status VARCHAR(50) DEFAULT 'pending' CHECK (outcome_status IN ('pending', 'success', 'partial', 'at_risk', 'failed')),
  outcome_evidence JSONB DEFAULT '[]', -- Array of evidence items
  lessons_learned JSONB DEFAULT '[]', -- Array of lesson strings
  outcome_documented_at TIMESTAMPTZ,

  -- Health Score Impact
  health_score_before INTEGER,
  health_score_after INTEGER,

  -- Metadata
  source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('salesforce', 'manual', 'api', 'contract_amendment')),
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_upsell_measurements_customer ON upsell_success_measurements(customer_id);
CREATE INDEX IF NOT EXISTS idx_upsell_measurements_status ON upsell_success_measurements(progress_status);
CREATE INDEX IF NOT EXISTS idx_upsell_measurements_outcome ON upsell_success_measurements(outcome_status);
CREATE INDEX IF NOT EXISTS idx_upsell_measurements_close_date ON upsell_success_measurements(close_date);
CREATE INDEX IF NOT EXISTS idx_upsell_measurements_opportunity ON upsell_success_measurements(opportunity_id);

-- ================================================
-- SUCCESS METRICS TABLE
-- Stores individual metric definitions for measurement
-- ================================================
CREATE TABLE IF NOT EXISTS upsell_success_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  measurement_id UUID NOT NULL REFERENCES upsell_success_measurements(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('usage', 'adoption', 'roi', 'satisfaction')),
  target_value DECIMAL(12,4) NOT NULL,
  current_value DECIMAL(12,4) DEFAULT 0,
  baseline_value DECIMAL(12,4),
  unit VARCHAR(50) NOT NULL,
  measurement_method VARCHAR(50) DEFAULT 'automatic' CHECK (measurement_method IN ('automatic', 'manual')),

  -- Progress
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  trend VARCHAR(20) DEFAULT 'flat' CHECK (trend IN ('up', 'down', 'flat')),

  -- History
  value_history JSONB DEFAULT '[]', -- Array of {value, timestamp}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_success_metrics_measurement ON upsell_success_metrics(measurement_id);
CREATE INDEX IF NOT EXISTS idx_success_metrics_type ON upsell_success_metrics(metric_type);

-- ================================================
-- MEASUREMENT CHECKPOINTS TABLE
-- Stores checkpoint status for 30/60/90 day reviews
-- ================================================
CREATE TABLE IF NOT EXISTS measurement_checkpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  measurement_id UUID NOT NULL REFERENCES upsell_success_measurements(id) ON DELETE CASCADE,

  day_number INTEGER NOT NULL CHECK (day_number > 0),
  checkpoint_type VARCHAR(50) NOT NULL CHECK (checkpoint_type IN ('check', 'review', 'assessment')),
  scheduled_date DATE NOT NULL,

  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'overdue')),
  completed_date DATE,
  completed_by VARCHAR(255),

  -- Review Data
  summary TEXT,
  findings JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',

  -- Related documents
  document_url TEXT,
  document_id VARCHAR(255),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_measurement ON measurement_checkpoints(measurement_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_status ON measurement_checkpoints(status);
CREATE INDEX IF NOT EXISTS idx_checkpoints_scheduled ON measurement_checkpoints(scheduled_date);

-- ================================================
-- UPSELL FEEDBACK TABLE
-- Captures learnings for continuous improvement
-- ================================================
CREATE TABLE IF NOT EXISTS upsell_success_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  measurement_id UUID NOT NULL REFERENCES upsell_success_measurements(id) ON DELETE CASCADE,

  feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('correlation', 'pattern', 'risk_indicator', 'success_factor')),

  -- Feedback Content
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Impact Analysis
  impact_score DECIMAL(3,2) CHECK (impact_score >= 0 AND impact_score <= 1),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Categorization
  product_category VARCHAR(255),
  customer_segment VARCHAR(255),

  -- Action taken
  action_taken TEXT,
  action_effective BOOLEAN,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_measurement ON upsell_success_feedback(measurement_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON upsell_success_feedback(feedback_type);

-- ================================================
-- VIEWS
-- ================================================

-- View: Active measurement plans with progress summary
CREATE OR REPLACE VIEW v_upsell_measurements_summary AS
SELECT
  usm.id,
  usm.customer_id,
  c.name as customer_name,
  c.arr as customer_arr,
  usm.products,
  usm.arr_increase,
  usm.close_date,
  usm.progress_status,
  usm.outcome_status,
  usm.created_at,
  -- Calculate days since close
  EXTRACT(DAY FROM NOW() - usm.close_date)::INTEGER as days_since_close,
  -- Count checkpoints
  (SELECT COUNT(*) FROM measurement_checkpoints mc WHERE mc.measurement_id = usm.id AND mc.status = 'completed') as completed_checkpoints,
  (SELECT COUNT(*) FROM measurement_checkpoints mc WHERE mc.measurement_id = usm.id) as total_checkpoints,
  -- Metric progress average
  (SELECT AVG(progress_percentage) FROM upsell_success_metrics sm WHERE sm.measurement_id = usm.id) as avg_metric_progress
FROM upsell_success_measurements usm
JOIN customers c ON c.id = usm.customer_id
WHERE usm.outcome_status IN ('pending', 'at_risk')
ORDER BY usm.close_date DESC;

-- View: Upcoming checkpoints requiring attention
CREATE OR REPLACE VIEW v_upcoming_checkpoints AS
SELECT
  mc.id,
  mc.measurement_id,
  usm.customer_id,
  c.name as customer_name,
  mc.day_number,
  mc.checkpoint_type,
  mc.scheduled_date,
  mc.status,
  usm.products,
  usm.arr_increase
FROM measurement_checkpoints mc
JOIN upsell_success_measurements usm ON usm.id = mc.measurement_id
JOIN customers c ON c.id = usm.customer_id
WHERE mc.status = 'pending'
  AND mc.scheduled_date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY mc.scheduled_date ASC;

-- View: Outcome analysis for learning
CREATE OR REPLACE VIEW v_upsell_outcome_analysis AS
SELECT
  usm.outcome_status,
  COUNT(*) as count,
  AVG(usm.arr_increase) as avg_arr_increase,
  AVG(usm.health_score_after - usm.health_score_before) as avg_health_change,
  JSONB_AGG(DISTINCT usm.products) as product_mix
FROM upsell_success_measurements usm
WHERE usm.outcome_status != 'pending'
GROUP BY usm.outcome_status;

-- ================================================
-- TRIGGERS
-- ================================================

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_upsell_measurements_updated_at ON upsell_success_measurements;
CREATE TRIGGER update_upsell_measurements_updated_at
  BEFORE UPDATE ON upsell_success_measurements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_success_metrics_updated_at ON upsell_success_metrics;
CREATE TRIGGER update_success_metrics_updated_at
  BEFORE UPDATE ON upsell_success_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_checkpoints_updated_at ON measurement_checkpoints;
CREATE TRIGGER update_checkpoints_updated_at
  BEFORE UPDATE ON measurement_checkpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- FUNCTIONS
-- ================================================

-- Function to auto-mark overdue checkpoints
CREATE OR REPLACE FUNCTION mark_overdue_checkpoints()
RETURNS void AS $$
BEGIN
  UPDATE measurement_checkpoints
  SET status = 'overdue', updated_at = NOW()
  WHERE status = 'pending'
    AND scheduled_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
