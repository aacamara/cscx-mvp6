-- Migration: Customer Journey Map Tables
-- PRD-159: Customer Journey Map Report
--
-- Creates tables for tracking customer journey stages, events, milestones, and friction points.

-- ============================================
-- JOURNEY STAGES TABLE
-- ============================================
-- Tracks when customers enter and exit each journey stage
CREATE TABLE IF NOT EXISTS journey_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  duration_days INTEGER,
  health_score_at_entry INTEGER,
  health_score_at_exit INTEGER,
  exit_reason TEXT,
  next_stage VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journey_stages_customer ON journey_stages(customer_id);
CREATE INDEX IF NOT EXISTS idx_journey_stages_stage ON journey_stages(stage);
CREATE INDEX IF NOT EXISTS idx_journey_stages_entered ON journey_stages(entered_at);

-- Constraint for valid stages
ALTER TABLE journey_stages
ADD CONSTRAINT valid_journey_stage CHECK (
  stage IN ('prospect', 'onboarding', 'adoption', 'growth', 'maturity', 'renewal', 'at_risk', 'churned')
);

-- ============================================
-- JOURNEY EVENTS TABLE
-- ============================================
-- Records all significant events in a customer's journey
CREATE TABLE IF NOT EXISTS journey_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  stage VARCHAR(50) NOT NULL,
  sentiment VARCHAR(20),
  importance VARCHAR(20) DEFAULT 'medium',
  metadata JSONB DEFAULT '{}',
  participants TEXT[],
  outcome TEXT,
  linked_event_ids UUID[],
  source VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journey_events_customer ON journey_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_journey_events_type ON journey_events(type);
CREATE INDEX IF NOT EXISTS idx_journey_events_timestamp ON journey_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_journey_events_stage ON journey_events(stage);

-- Constraint for valid event types
ALTER TABLE journey_events
ADD CONSTRAINT valid_event_type CHECK (
  type IN (
    'milestone', 'meeting', 'email', 'call', 'support_ticket',
    'health_change', 'risk_signal', 'contract_event', 'usage_event',
    'nps_response', 'expansion', 'escalation', 'note', 'stage_change'
  )
);

-- Constraint for valid sentiment
ALTER TABLE journey_events
ADD CONSTRAINT valid_sentiment CHECK (
  sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative')
);

-- Constraint for valid importance
ALTER TABLE journey_events
ADD CONSTRAINT valid_importance CHECK (
  importance IN ('high', 'medium', 'low')
);

-- ============================================
-- JOURNEY MILESTONES TABLE
-- ============================================
-- Tracks key milestones in the customer journey
CREATE TABLE IF NOT EXISTS journey_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  target_date DATE NOT NULL,
  achieved_date DATE,
  stage VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  impact VARCHAR(20) DEFAULT 'medium',
  related_event_ids UUID[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journey_milestones_customer ON journey_milestones(customer_id);
CREATE INDEX IF NOT EXISTS idx_journey_milestones_status ON journey_milestones(status);
CREATE INDEX IF NOT EXISTS idx_journey_milestones_target ON journey_milestones(target_date);

-- Constraint for valid status
ALTER TABLE journey_milestones
ADD CONSTRAINT valid_milestone_status CHECK (
  status IN ('pending', 'achieved', 'missed', 'at_risk')
);

-- Constraint for valid impact
ALTER TABLE journey_milestones
ADD CONSTRAINT valid_milestone_impact CHECK (
  impact IN ('critical', 'high', 'medium', 'low')
);

-- ============================================
-- JOURNEY FRICTION POINTS TABLE
-- ============================================
-- Tracks friction points and bottlenecks in the journey
CREATE TABLE IF NOT EXISTS journey_friction_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE, -- NULL for aggregate friction points
  stage VARCHAR(50) NOT NULL,
  friction_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  avg_delay_days DECIMAL(10, 2) DEFAULT 0,
  impact VARCHAR(20) DEFAULT 'medium',
  recommendations JSONB DEFAULT '[]',
  affected_customer_ids UUID[],
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_friction_points_customer ON journey_friction_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_friction_points_stage ON journey_friction_points(stage);
CREATE INDEX IF NOT EXISTS idx_friction_points_type ON journey_friction_points(friction_type);

-- ============================================
-- HEALTH SCORE HISTORY TABLE
-- ============================================
-- Extended to include stage information for journey tracking
-- Note: This may already exist, so we add columns if missing
DO $$
BEGIN
  -- Check if health_score_history table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'health_score_history') THEN
    -- Add stage column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'health_score_history' AND column_name = 'stage') THEN
      ALTER TABLE health_score_history ADD COLUMN stage VARCHAR(50);
    END IF;
    -- Add change_reason column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'health_score_history' AND column_name = 'change_reason') THEN
      ALTER TABLE health_score_history ADD COLUMN change_reason TEXT;
    END IF;
  ELSE
    -- Create the table if it doesn't exist
    CREATE TABLE health_score_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      health_score INTEGER NOT NULL,
      stage VARCHAR(50),
      change_reason TEXT,
      recorded_at TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'
    );
    CREATE INDEX idx_health_history_customer ON health_score_history(customer_id);
    CREATE INDEX idx_health_history_recorded ON health_score_history(recorded_at);
  END IF;
END $$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update milestone updated_at
CREATE OR REPLACE FUNCTION update_journey_milestone_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_journey_milestone_timestamp ON journey_milestones;
CREATE TRIGGER update_journey_milestone_timestamp
  BEFORE UPDATE ON journey_milestones
  FOR EACH ROW EXECUTE FUNCTION update_journey_milestone_timestamp();

-- Trigger to record health score changes with stage
CREATE OR REPLACE FUNCTION record_health_score_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.health_score IS DISTINCT FROM NEW.health_score THEN
    INSERT INTO health_score_history (
      customer_id,
      health_score,
      stage,
      change_reason
    )
    VALUES (
      NEW.id,
      NEW.health_score,
      NEW.stage,
      'Health score updated'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS record_customer_health_change ON customers;
CREATE TRIGGER record_customer_health_change
  AFTER UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION record_health_score_change();

-- ============================================
-- VIEWS
-- ============================================

-- View for current stage per customer
CREATE OR REPLACE VIEW customer_current_stage AS
SELECT DISTINCT ON (customer_id)
  customer_id,
  stage,
  entered_at,
  health_score_at_entry
FROM journey_stages
WHERE exited_at IS NULL
ORDER BY customer_id, entered_at DESC;

-- View for milestone summary per customer
CREATE OR REPLACE VIEW customer_milestone_summary AS
SELECT
  customer_id,
  COUNT(*) AS total_milestones,
  COUNT(CASE WHEN status = 'achieved' THEN 1 END) AS achieved_count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN status = 'missed' THEN 1 END) AS missed_count,
  COUNT(CASE WHEN status = 'at_risk' THEN 1 END) AS at_risk_count,
  ROUND(
    COUNT(CASE WHEN status = 'achieved' THEN 1 END)::DECIMAL /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) AS completion_rate
FROM journey_milestones
GROUP BY customer_id;

-- View for journey health over time
CREATE OR REPLACE VIEW journey_health_timeline AS
SELECT
  customer_id,
  DATE_TRUNC('week', recorded_at) AS week,
  ROUND(AVG(health_score), 0) AS avg_health,
  MAX(health_score) AS max_health,
  MIN(health_score) AS min_health
FROM health_score_history
GROUP BY customer_id, DATE_TRUNC('week', recorded_at)
ORDER BY customer_id, week;

-- ============================================
-- SAMPLE DATA
-- ============================================
-- Insert sample journey stages for existing customers
INSERT INTO journey_stages (customer_id, stage, entered_at, health_score_at_entry)
SELECT
  id,
  stage,
  created_at,
  health_score
FROM customers
WHERE id NOT IN (SELECT DISTINCT customer_id FROM journey_stages)
ON CONFLICT DO NOTHING;

-- Insert sample milestones for active customers
INSERT INTO journey_milestones (customer_id, name, description, target_date, stage, status, impact)
SELECT
  c.id,
  'First QBR',
  'Complete first quarterly business review',
  c.created_at::DATE + INTERVAL '90 days',
  'adoption',
  CASE
    WHEN c.created_at < NOW() - INTERVAL '90 days' THEN 'achieved'
    ELSE 'pending'
  END,
  'high'
FROM customers c
WHERE c.stage IN ('adoption', 'growth', 'maturity')
  AND c.id NOT IN (SELECT customer_id FROM journey_milestones WHERE name = 'First QBR')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE journey_stages IS 'Tracks customer journey through lifecycle stages';
COMMENT ON TABLE journey_events IS 'Records significant events in customer journeys';
COMMENT ON TABLE journey_milestones IS 'Tracks key milestones and their completion status';
COMMENT ON TABLE journey_friction_points IS 'Identifies bottlenecks and friction in customer journeys';
