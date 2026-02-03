-- ============================================
-- PRD-237: Customer Journey Optimization
-- Database tables for journey stage tracking and friction detection
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- JOURNEY STAGES TABLE
-- Track customer progression through journey stages
-- ============================================
CREATE TABLE IF NOT EXISTS journey_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Stage information
  stage VARCHAR(50) NOT NULL, -- prospect, onboarding, adoption, growth, maturity, renewal, at_risk, churned

  -- Timing
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  duration_days INTEGER, -- Calculated on exit

  -- Performance metrics
  success_score INTEGER CHECK (success_score >= 0 AND success_score <= 100),

  -- Context
  entry_reason TEXT,
  exit_reason TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_journey_stages_customer ON journey_stages(customer_id);
CREATE INDEX IF NOT EXISTS idx_journey_stages_stage ON journey_stages(stage);
CREATE INDEX IF NOT EXISTS idx_journey_stages_entered ON journey_stages(entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_stages_active ON journey_stages(customer_id, stage) WHERE exited_at IS NULL;

-- ============================================
-- JOURNEY FRICTION POINTS TABLE
-- Track detected friction points and patterns
-- ============================================
CREATE TABLE IF NOT EXISTS journey_friction_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Classification
  stage VARCHAR(50) NOT NULL,
  friction_type VARCHAR(50) NOT NULL, -- technical_setup, user_adoption, value_realization, champion_engagement, stakeholder_access, support_dependency

  -- Metrics
  occurrence_count INTEGER DEFAULT 1,
  avg_delay_days DECIMAL(10, 2),

  -- Recommendations
  recommendations JSONB DEFAULT '[]',

  -- Analysis metadata
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_friction_points_stage ON journey_friction_points(stage);
CREATE INDEX IF NOT EXISTS idx_friction_points_type ON journey_friction_points(friction_type);
CREATE INDEX IF NOT EXISTS idx_friction_points_analyzed ON journey_friction_points(analyzed_at DESC);

-- ============================================
-- CUSTOMER FRICTION INSTANCES TABLE
-- Track friction detected for specific customers
-- ============================================
CREATE TABLE IF NOT EXISTS customer_friction_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  friction_point_id UUID REFERENCES journey_friction_points(id) ON DELETE SET NULL,

  -- Details
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- critical, high, medium, low
  title TEXT NOT NULL,
  description TEXT,

  -- Impact
  impact_score INTEGER CHECK (impact_score >= 0 AND impact_score <= 100),
  arr_impact DECIMAL(12, 2),

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, monitoring, resolved
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  -- Actions
  suggested_actions JSONB DEFAULT '[]',
  actions_taken JSONB DEFAULT '[]',

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_friction_customer ON customer_friction_instances(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_friction_status ON customer_friction_instances(status);
CREATE INDEX IF NOT EXISTS idx_customer_friction_severity ON customer_friction_instances(severity);
CREATE INDEX IF NOT EXISTS idx_customer_friction_detected ON customer_friction_instances(detected_at DESC);

-- ============================================
-- JOURNEY INTERVENTIONS TABLE
-- Track recommended and executed interventions
-- ============================================
CREATE TABLE IF NOT EXISTS journey_interventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to friction
  friction_instance_id UUID REFERENCES customer_friction_instances(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Intervention details
  intervention_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Expected impact
  expected_time_reduction INTEGER, -- days
  expected_retention_improvement DECIMAL(5, 2), -- percentage
  expected_nps_improvement INTEGER,

  -- Execution
  effort VARCHAR(20), -- low, medium, high
  priority VARCHAR(20), -- critical, high, medium, low
  status VARCHAR(20) DEFAULT 'recommended', -- recommended, in_progress, completed, declined

  -- Results
  actual_time_reduction INTEGER,
  actual_retention_improvement DECIMAL(5, 2),
  actual_nps_improvement INTEGER,

  -- Timing
  recommended_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  implementation_steps JSONB DEFAULT '[]',
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interventions_customer ON journey_interventions(customer_id);
CREATE INDEX IF NOT EXISTS idx_interventions_status ON journey_interventions(status);
CREATE INDEX IF NOT EXISTS idx_interventions_priority ON journey_interventions(priority);

-- ============================================
-- JOURNEY OPTIMIZATION ANALYSIS TABLE
-- Store analysis results for reference
-- ============================================
CREATE TABLE IF NOT EXISTS journey_optimization_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Scope
  segment VARCHAR(100),

  -- Performance snapshot
  customers_analyzed INTEGER,
  avg_time_to_value INTEGER,
  target_time_to_value INTEGER,

  -- Results
  friction_points_count INTEGER,
  interventions_count INTEGER,

  -- Projected impact
  projected_time_reduction INTEGER,
  projected_retention_improvement DECIMAL(5, 2),
  projected_nps_improvement INTEGER,

  -- Full analysis data
  analysis_data JSONB,

  analyzed_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_optimization_analyses_segment ON journey_optimization_analyses(segment);
CREATE INDEX IF NOT EXISTS idx_optimization_analyses_analyzed ON journey_optimization_analyses(analyzed_at DESC);

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

-- Update journey_stages duration when exited
CREATE OR REPLACE FUNCTION update_journey_stage_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.exited_at IS NOT NULL AND OLD.exited_at IS NULL THEN
    NEW.duration_days := EXTRACT(DAY FROM (NEW.exited_at - NEW.entered_at));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_journey_stage_duration
  BEFORE UPDATE ON journey_stages
  FOR EACH ROW EXECUTE FUNCTION update_journey_stage_duration();

-- Standard update timestamp triggers
CREATE TRIGGER update_journey_stages_timestamp
  BEFORE UPDATE ON journey_stages
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_friction_points_timestamp
  BEFORE UPDATE ON journey_friction_points
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_customer_friction_timestamp
  BEFORE UPDATE ON customer_friction_instances
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_interventions_timestamp
  BEFORE UPDATE ON journey_interventions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get customer's current journey stage
CREATE OR REPLACE FUNCTION get_customer_journey_stage(p_customer_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_stage VARCHAR(50);
BEGIN
  SELECT stage INTO v_stage
  FROM journey_stages
  WHERE customer_id = p_customer_id
    AND exited_at IS NULL
  ORDER BY entered_at DESC
  LIMIT 1;

  RETURN COALESCE(v_stage, 'unknown');
END;
$$ LANGUAGE plpgsql;

-- Function to calculate average time in stage
CREATE OR REPLACE FUNCTION get_avg_stage_duration(p_stage VARCHAR(50))
RETURNS DECIMAL AS $$
DECLARE
  v_avg DECIMAL;
BEGIN
  SELECT AVG(duration_days) INTO v_avg
  FROM journey_stages
  WHERE stage = p_stage
    AND duration_days IS NOT NULL;

  RETURN COALESCE(v_avg, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get active friction count for customer
CREATE OR REPLACE FUNCTION get_customer_friction_count(p_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM customer_friction_instances
  WHERE customer_id = p_customer_id
    AND status = 'active';

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE DATA (for demo purposes)
-- ============================================
DO $$
DECLARE
  v_customer_id UUID;
BEGIN
  -- Get first customer
  SELECT id INTO v_customer_id FROM customers LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    -- Insert sample journey stages
    INSERT INTO journey_stages (customer_id, stage, entered_at, exited_at, duration_days, success_score)
    VALUES
      (v_customer_id, 'prospect', NOW() - INTERVAL '180 days', NOW() - INTERVAL '175 days', 5, 85),
      (v_customer_id, 'onboarding', NOW() - INTERVAL '175 days', NOW() - INTERVAL '155 days', 20, 75),
      (v_customer_id, 'adoption', NOW() - INTERVAL '155 days', NOW() - INTERVAL '90 days', 65, 80),
      (v_customer_id, 'growth', NOW() - INTERVAL '90 days', NULL, NULL, 78)
    ON CONFLICT DO NOTHING;

    -- Insert sample friction point
    INSERT INTO journey_friction_points (stage, friction_type, occurrence_count, avg_delay_days, recommendations)
    VALUES
      ('onboarding', 'technical_setup', 15, 5.5, '["Add integration wizard", "Offer office hours support", "Provide API documentation review"]'),
      ('adoption', 'user_adoption', 12, 8.2, '["Schedule training sessions", "Create feature discovery tours", "Identify champions"]')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY (Optional - can enable later)
-- ============================================
-- ALTER TABLE journey_stages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE journey_friction_points ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customer_friction_instances ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE journey_interventions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE journey_optimization_analyses ENABLE ROW LEVEL SECURITY;
