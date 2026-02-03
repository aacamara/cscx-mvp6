-- PRD-083: Risk Factor Weights Migration
-- Creates tables for risk factor configuration and historical tracking

-- ============================================
-- RISK FACTOR WEIGHTS TABLE
-- Stores configurable weights for different risk factors
-- ============================================
CREATE TABLE IF NOT EXISTS risk_factor_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_type VARCHAR(50) NOT NULL UNIQUE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('usage', 'engagement', 'financial', 'relationship', 'support')),
  weight DECIMAL(3,2) NOT NULL DEFAULT 0.10 CHECK (weight >= 0 AND weight <= 1),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for active factors
CREATE INDEX IF NOT EXISTS idx_risk_factor_weights_active ON risk_factor_weights(is_active) WHERE is_active = true;

-- ============================================
-- RISK DEEP DIVE HISTORY TABLE
-- Stores historical risk deep dive analyses for trend tracking
-- ============================================
CREATE TABLE IF NOT EXISTS risk_deep_dive_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  factors JSONB NOT NULL DEFAULT '[]',
  primary_concerns JSONB DEFAULT '[]',
  data_completeness INTEGER DEFAULT 100,
  confidence VARCHAR(20) DEFAULT 'medium',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_risk_deep_dive_customer ON risk_deep_dive_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_deep_dive_recorded ON risk_deep_dive_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_deep_dive_customer_recorded ON risk_deep_dive_history(customer_id, recorded_at DESC);

-- ============================================
-- MITIGATION PLANS TABLE
-- Stores generated mitigation plans
-- ============================================
CREATE TABLE IF NOT EXISTS mitigation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_data JSONB NOT NULL,
  total_actions INTEGER NOT NULL DEFAULT 0,
  urgent_actions INTEGER NOT NULL DEFAULT 0,
  expected_risk_reduction INTEGER DEFAULT 0,
  estimated_time VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mitigation_plans_customer ON mitigation_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_mitigation_plans_status ON mitigation_plans(status);

-- ============================================
-- MITIGATION ACTIONS TABLE
-- Tracks individual mitigation action status
-- ============================================
CREATE TABLE IF NOT EXISTS mitigation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES mitigation_plans(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  action_text TEXT NOT NULL,
  description TEXT,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  category VARCHAR(20) NOT NULL,
  estimated_impact VARCHAR(20),
  estimated_effort VARCHAR(20),
  timeline_recommendation VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  assigned_to UUID,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mitigation_actions_plan ON mitigation_actions(plan_id);
CREATE INDEX IF NOT EXISTS idx_mitigation_actions_customer ON mitigation_actions(customer_id);
CREATE INDEX IF NOT EXISTS idx_mitigation_actions_status ON mitigation_actions(status);
CREATE INDEX IF NOT EXISTS idx_mitigation_actions_assigned ON mitigation_actions(assigned_to) WHERE assigned_to IS NOT NULL;

-- ============================================
-- SEED DEFAULT FACTOR WEIGHTS
-- ============================================
INSERT INTO risk_factor_weights (factor_type, category, weight, description) VALUES
  ('usage_decline', 'usage', 0.25, 'Overall decline in product usage metrics'),
  ('dau_drop', 'usage', 0.15, 'Drop in daily active users'),
  ('feature_adoption', 'usage', 0.10, 'Low adoption of key features'),
  ('login_frequency', 'usage', 0.08, 'Decreased login frequency'),
  ('champion_departure', 'relationship', 0.20, 'Primary champion has left the company'),
  ('exec_sponsor_gap', 'relationship', 0.12, 'No executive sponsor engagement'),
  ('stakeholder_churn', 'relationship', 0.08, 'Multiple stakeholders have departed'),
  ('support_escalations', 'support', 0.15, 'High-priority support tickets'),
  ('ticket_volume', 'support', 0.08, 'Elevated support ticket volume'),
  ('csat_decline', 'support', 0.10, 'Declining customer satisfaction scores'),
  ('engagement_gap', 'engagement', 0.12, 'Extended period without customer contact'),
  ('qbr_missed', 'engagement', 0.08, 'Missed or delayed QBR meetings'),
  ('response_rate', 'engagement', 0.06, 'Low email/communication response rate'),
  ('payment_issues', 'financial', 0.10, 'Late or missed payments'),
  ('contract_risk', 'financial', 0.08, 'Contract terms under dispute'),
  ('renewal_proximity', 'financial', 0.15, 'Approaching renewal with low health')
ON CONFLICT (factor_type) DO UPDATE SET
  weight = EXCLUDED.weight,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================
-- UPDATE TRIGGER FOR TIMESTAMPS
-- ============================================
CREATE OR REPLACE FUNCTION update_risk_tables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_risk_factor_weights_timestamp ON risk_factor_weights;
CREATE TRIGGER update_risk_factor_weights_timestamp
  BEFORE UPDATE ON risk_factor_weights
  FOR EACH ROW EXECUTE FUNCTION update_risk_tables_timestamp();

DROP TRIGGER IF EXISTS update_mitigation_plans_timestamp ON mitigation_plans;
CREATE TRIGGER update_mitigation_plans_timestamp
  BEFORE UPDATE ON mitigation_plans
  FOR EACH ROW EXECUTE FUNCTION update_risk_tables_timestamp();

DROP TRIGGER IF EXISTS update_mitigation_actions_timestamp ON mitigation_actions;
CREATE TRIGGER update_mitigation_actions_timestamp
  BEFORE UPDATE ON mitigation_actions
  FOR EACH ROW EXECUTE FUNCTION update_risk_tables_timestamp();

-- ============================================
-- ROW LEVEL SECURITY (if needed)
-- ============================================
ALTER TABLE risk_factor_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_deep_dive_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitigation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitigation_actions ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (adjust based on your auth setup)
CREATE POLICY "Allow all operations on risk_factor_weights" ON risk_factor_weights
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on risk_deep_dive_history" ON risk_deep_dive_history
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on mitigation_plans" ON mitigation_plans
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on mitigation_actions" ON mitigation_actions
  FOR ALL USING (true);
