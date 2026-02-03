-- Migration: PRD-105 Multi-Account Pattern Alert
-- Adds support for parent-child customer relationships and cross-account pattern detection

-- Add parent relationship columns to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS parent_customer_id UUID REFERENCES customers(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(50); -- subsidiary, division, region, brand

-- Index for fast family lookups
CREATE INDEX IF NOT EXISTS idx_customers_parent_customer_id ON customers(parent_customer_id);

-- Multi-account patterns table
CREATE TABLE IF NOT EXISTS multi_account_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_customer_id UUID REFERENCES customers(id) NOT NULL,
  pattern_type VARCHAR(50) NOT NULL, -- risk_contagion, replication_opportunity, synchronized_change, cross_expansion
  affected_customers UUID[] NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  -- Pattern-specific fields
  severity VARCHAR(20), -- low, medium, high, critical
  confidence_score INTEGER, -- 0-100
  recommendation TEXT,
  -- Tracking
  status VARCHAR(20) DEFAULT 'active', -- active, acknowledged, resolved, dismissed
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_multi_account_patterns_parent ON multi_account_patterns(parent_customer_id);
CREATE INDEX IF NOT EXISTS idx_multi_account_patterns_type ON multi_account_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_multi_account_patterns_status ON multi_account_patterns(status);
CREATE INDEX IF NOT EXISTS idx_multi_account_patterns_severity ON multi_account_patterns(severity);
CREATE INDEX IF NOT EXISTS idx_multi_account_patterns_detected_at ON multi_account_patterns(detected_at DESC);

-- Health score history for family aggregation
CREATE TABLE IF NOT EXISTS family_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_customer_id UUID REFERENCES customers(id) NOT NULL,
  aggregated_health_score INTEGER NOT NULL,
  child_scores JSONB NOT NULL, -- { customerId: { score, weight, trend } }
  total_arr NUMERIC NOT NULL,
  at_risk_count INTEGER DEFAULT 0,
  healthy_count INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_health_history_parent ON family_health_history(parent_customer_id);
CREATE INDEX IF NOT EXISTS idx_family_health_history_calculated_at ON family_health_history(calculated_at DESC);

-- Pattern alerts (for notification tracking)
CREATE TABLE IF NOT EXISTS multi_account_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID REFERENCES multi_account_patterns(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  channel VARCHAR(50) NOT NULL, -- slack, email, in_app
  message_id VARCHAR(255), -- External message ID (Slack ts, email ID)
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, acknowledged
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multi_account_alerts_pattern ON multi_account_alerts(pattern_id);
CREATE INDEX IF NOT EXISTS idx_multi_account_alerts_user ON multi_account_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_multi_account_alerts_status ON multi_account_alerts(status);

-- Successful playbook executions (for replication opportunity detection)
CREATE TABLE IF NOT EXISTS playbook_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  playbook_id VARCHAR(100) NOT NULL,
  playbook_name VARCHAR(255) NOT NULL,
  outcome VARCHAR(50) NOT NULL, -- success, partial, failed
  metrics_before JSONB,
  metrics_after JSONB,
  improvement_summary TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbook_executions_customer ON playbook_executions(customer_id);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_outcome ON playbook_executions(outcome);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_playbook ON playbook_executions(playbook_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_multi_account_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_update_multi_account_patterns_updated_at ON multi_account_patterns;
CREATE TRIGGER trigger_update_multi_account_patterns_updated_at
  BEFORE UPDATE ON multi_account_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_multi_account_patterns_updated_at();

-- Comments for documentation
COMMENT ON TABLE multi_account_patterns IS 'Stores detected patterns across related customer accounts (PRD-105)';
COMMENT ON COLUMN multi_account_patterns.pattern_type IS 'Type of pattern: risk_contagion, replication_opportunity, synchronized_change, cross_expansion';
COMMENT ON COLUMN multi_account_patterns.affected_customers IS 'Array of customer IDs affected by this pattern';
COMMENT ON COLUMN multi_account_patterns.details IS 'JSON with pattern-specific details like health changes, feature adoption, etc.';
COMMENT ON TABLE family_health_history IS 'Aggregated health scores for customer families over time';
COMMENT ON TABLE playbook_executions IS 'Tracks playbook outcomes for replication opportunity detection';
