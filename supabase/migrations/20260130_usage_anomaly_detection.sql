-- PRD-084: Usage Anomaly Detection
-- Database schema for usage anomaly detection and baselines

-- Usage Anomalies Table
-- Stores detected usage anomalies for customers
CREATE TABLE IF NOT EXISTS usage_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL,
  anomaly_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  baseline_value DECIMAL(15,2) NOT NULL,
  actual_value DECIMAL(15,2) NOT NULL,
  deviation_percent DECIMAL(10,2) NOT NULL,
  z_score DECIMAL(10,4),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID,
  affected_feature VARCHAR(100),
  possible_cause TEXT,
  duration INTEGER, -- days the anomaly has persisted
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_metric_type CHECK (metric_type IN ('dau', 'wau', 'mau', 'total_events', 'api_calls', 'feature_usage', 'session_duration')),
  CONSTRAINT valid_anomaly_type CHECK (anomaly_type IN ('drop', 'spike', 'pattern_change', 'feature_abandonment')),
  CONSTRAINT valid_severity CHECK (severity IN ('critical', 'warning', 'info'))
);

-- Usage Baselines Table
-- Stores statistical baselines for anomaly detection
CREATE TABLE IF NOT EXISTS usage_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL,
  mean DECIMAL(15,4) NOT NULL,
  std_dev DECIMAL(15,4) NOT NULL,
  median DECIMAL(15,4) NOT NULL,
  q1 DECIMAL(15,4) NOT NULL,
  q3 DECIMAL(15,4) NOT NULL,
  iqr DECIMAL(15,4) NOT NULL,
  data_points INTEGER NOT NULL,
  seasonal_factors JSONB DEFAULT '{}'::JSONB,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for one baseline per customer per metric
  UNIQUE(customer_id, metric_type)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_usage_anomalies_customer_id ON usage_anomalies(customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_anomalies_detected_at ON usage_anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_anomalies_severity ON usage_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_usage_anomalies_anomaly_type ON usage_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_usage_anomalies_dismissed ON usage_anomalies(dismissed_at) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_usage_anomalies_customer_undismissed ON usage_anomalies(customer_id) WHERE dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_usage_baselines_customer_metric ON usage_baselines(customer_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_usage_baselines_calculated_at ON usage_baselines(calculated_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DROP TRIGGER IF EXISTS update_usage_anomalies_updated_at ON usage_anomalies;
CREATE TRIGGER update_usage_anomalies_updated_at
  BEFORE UPDATE ON usage_anomalies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_baselines_updated_at ON usage_baselines;
CREATE TRIGGER update_usage_baselines_updated_at
  BEFORE UPDATE ON usage_baselines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE usage_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_baselines ENABLE ROW LEVEL SECURITY;

-- Policies: Allow authenticated users to view anomalies (CSMs can see all)
CREATE POLICY "Authenticated users can view anomalies"
  ON usage_anomalies FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert anomalies"
  ON usage_anomalies FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update anomalies"
  ON usage_anomalies FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view baselines"
  ON usage_baselines FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage baselines"
  ON usage_baselines FOR ALL
  USING (auth.role() = 'authenticated');

-- Service role bypass for backend operations
CREATE POLICY "Service role has full access to anomalies"
  ON usage_anomalies FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to baselines"
  ON usage_baselines FOR ALL
  USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE usage_anomalies IS 'Stores detected usage anomalies for customers (PRD-084)';
COMMENT ON TABLE usage_baselines IS 'Stores statistical baselines for anomaly detection (PRD-084)';
COMMENT ON COLUMN usage_anomalies.metric_type IS 'Type of usage metric: dau, wau, mau, total_events, api_calls, feature_usage, session_duration';
COMMENT ON COLUMN usage_anomalies.anomaly_type IS 'Type of anomaly: drop, spike, pattern_change, feature_abandonment';
COMMENT ON COLUMN usage_anomalies.severity IS 'Severity level: critical, warning, info';
COMMENT ON COLUMN usage_anomalies.z_score IS 'Statistical z-score measuring deviation from baseline';
COMMENT ON COLUMN usage_anomalies.dismissed_at IS 'When the anomaly was dismissed as a false positive';
COMMENT ON COLUMN usage_baselines.seasonal_factors IS 'Day-of-week adjustment factors for seasonal patterns';
