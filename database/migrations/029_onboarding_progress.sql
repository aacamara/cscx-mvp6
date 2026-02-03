-- PRD-162: Onboarding Progress Report
-- Database schema for onboarding funnel tracking and reporting

-- ============================================
-- ONBOARDING STAGE DEFINITIONS
-- ============================================

-- Create enum for onboarding stages
DO $$ BEGIN
  CREATE TYPE onboarding_stage AS ENUM (
    'contract_signed',
    'kickoff_scheduled',
    'kickoff_completed',
    'technical_setup',
    'data_migration',
    'training_scheduled',
    'training_completed',
    'first_use',
    'value_realized',
    'onboarding_complete'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for stage status
DO $$ BEGIN
  CREATE TYPE stage_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'skipped',
    'blocked'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- CUSTOMER ONBOARDING PROGRESS
-- Main table tracking overall onboarding progress
-- ============================================

CREATE TABLE IF NOT EXISTS customer_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Current state
  current_stage TEXT DEFAULT 'contract_signed',
  overall_status TEXT DEFAULT 'in_progress', -- in_progress, completed, dropped, paused

  -- Timeline
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_completion TIMESTAMPTZ,
  actual_completion TIMESTAMPTZ,

  -- Progress metrics
  progress_pct INTEGER DEFAULT 0,

  -- Assignment
  csm_id TEXT,
  csm_name TEXT,

  -- Metadata
  segment TEXT,
  product TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one progress record per customer
  UNIQUE(customer_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_customer ON customer_onboarding_progress(customer_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_stage ON customer_onboarding_progress(current_stage);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_status ON customer_onboarding_progress(overall_status);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_csm ON customer_onboarding_progress(csm_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_started ON customer_onboarding_progress(started_at);

-- ============================================
-- ONBOARDING STAGE PROGRESS
-- Detailed tracking of each stage transition
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_stage_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onboarding_id UUID NOT NULL REFERENCES customer_onboarding_progress(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Stage info
  stage TEXT NOT NULL,
  stage_order INTEGER NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending',

  -- Timeline
  entered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_days INTEGER,

  -- Expected vs actual
  expected_duration_days INTEGER,
  is_overdue BOOLEAN DEFAULT FALSE,

  -- Blockers
  blockers TEXT[],
  blocker_details JSONB DEFAULT '{}',

  -- Notes
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per stage per onboarding
  UNIQUE(onboarding_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_stage_progress_onboarding ON onboarding_stage_progress(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_stage_progress_customer ON onboarding_stage_progress(customer_id);
CREATE INDEX IF NOT EXISTS idx_stage_progress_stage ON onboarding_stage_progress(stage);
CREATE INDEX IF NOT EXISTS idx_stage_progress_status ON onboarding_stage_progress(status);

-- ============================================
-- ONBOARDING MILESTONES
-- Track key milestones within onboarding
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onboarding_id UUID NOT NULL REFERENCES customer_onboarding_progress(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Milestone info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'kickoff', 'setup', 'training', 'adoption', 'value'

  -- Timeline
  target_date DATE,
  actual_date DATE,

  -- Status
  status TEXT DEFAULT 'pending', -- pending, completed, missed, skipped
  on_track BOOLEAN DEFAULT TRUE,

  -- Notes
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_onboarding ON onboarding_milestones(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_milestones_customer ON onboarding_milestones(customer_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON onboarding_milestones(status);

-- ============================================
-- ONBOARDING EVENTS / ACTIVITY LOG
-- Track all events during onboarding
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onboarding_id UUID NOT NULL REFERENCES customer_onboarding_progress(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Event info
  event_type TEXT NOT NULL, -- stage_entered, stage_completed, blocker_added, blocker_resolved, milestone_achieved, note_added
  event_description TEXT,

  -- Related entities
  stage TEXT,
  milestone_id UUID REFERENCES onboarding_milestones(id),

  -- Actor
  actor_id TEXT,
  actor_name TEXT,
  actor_type TEXT, -- 'csm', 'system', 'customer', 'agent'

  -- Data
  event_data JSONB DEFAULT '{}',

  -- Timestamp
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_onboarding ON onboarding_events(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_events_customer ON onboarding_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON onboarding_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_occurred ON onboarding_events(occurred_at);

-- ============================================
-- ONBOARDING ALERTS
-- Track alerts for stuck/at-risk onboardings
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onboarding_id UUID NOT NULL REFERENCES customer_onboarding_progress(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Alert info
  alert_type TEXT NOT NULL, -- stuck, overdue, at_risk, milestone_missed
  severity TEXT DEFAULT 'medium', -- high, medium, low

  -- Context
  stage TEXT,
  message TEXT NOT NULL,

  -- Status
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_onboarding ON onboarding_alerts(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_alerts_customer ON onboarding_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON onboarding_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON onboarding_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON onboarding_alerts(acknowledged);

-- ============================================
-- FUNNEL METRICS CACHE
-- Pre-computed funnel metrics for performance
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_funnel_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Segment (null for overall)
  segment TEXT,
  csm_id TEXT,

  -- Stage metrics (JSONB array)
  stage_metrics JSONB NOT NULL DEFAULT '[]',

  -- Overview metrics
  total_onboardings INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  in_progress INTEGER DEFAULT 0,
  dropped INTEGER DEFAULT 0,

  completion_rate NUMERIC(5,2),
  avg_duration_days NUMERIC(5,1),
  avg_ttv_days NUMERIC(5,1),

  -- Timestamps
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique per period/segment combination
  UNIQUE(period_start, period_end, segment, csm_id)
);

CREATE INDEX IF NOT EXISTS idx_funnel_metrics_period ON onboarding_funnel_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_funnel_metrics_segment ON onboarding_funnel_metrics(segment);

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- View: Active onboardings with current stage info
CREATE OR REPLACE VIEW v_active_onboardings AS
SELECT
  cop.id AS onboarding_id,
  cop.customer_id,
  c.name AS customer_name,
  c.arr,
  c.industry,
  cop.current_stage,
  cop.overall_status,
  cop.started_at,
  cop.target_completion,
  cop.progress_pct,
  cop.csm_id,
  cop.csm_name,
  cop.segment,
  -- Calculate days in current stage
  CASE
    WHEN sp.entered_at IS NOT NULL THEN
      EXTRACT(DAY FROM NOW() - sp.entered_at)::INTEGER
    ELSE 0
  END AS days_in_current_stage,
  sp.expected_duration_days,
  sp.blockers,
  sp.status AS stage_status
FROM customer_onboarding_progress cop
JOIN customers c ON c.id = cop.customer_id
LEFT JOIN onboarding_stage_progress sp ON sp.onboarding_id = cop.id AND sp.stage = cop.current_stage
WHERE cop.overall_status = 'in_progress';

-- View: Stuck customers (in stage longer than expected)
CREATE OR REPLACE VIEW v_stuck_onboardings AS
SELECT
  cop.id AS onboarding_id,
  cop.customer_id,
  c.name AS customer_name,
  c.arr,
  cop.current_stage,
  cop.csm_id,
  cop.csm_name,
  sp.entered_at,
  sp.expected_duration_days,
  EXTRACT(DAY FROM NOW() - sp.entered_at)::INTEGER AS days_in_stage,
  (EXTRACT(DAY FROM NOW() - sp.entered_at)::INTEGER - sp.expected_duration_days) AS overdue_by,
  sp.blockers,
  CASE
    WHEN (EXTRACT(DAY FROM NOW() - sp.entered_at)::INTEGER - sp.expected_duration_days) > 7 THEN 'high'
    WHEN (EXTRACT(DAY FROM NOW() - sp.entered_at)::INTEGER - sp.expected_duration_days) > 3 THEN 'medium'
    ELSE 'low'
  END AS priority
FROM customer_onboarding_progress cop
JOIN customers c ON c.id = cop.customer_id
JOIN onboarding_stage_progress sp ON sp.onboarding_id = cop.id AND sp.stage = cop.current_stage
WHERE cop.overall_status = 'in_progress'
  AND sp.status = 'in_progress'
  AND sp.entered_at IS NOT NULL
  AND sp.expected_duration_days IS NOT NULL
  AND EXTRACT(DAY FROM NOW() - sp.entered_at)::INTEGER > sp.expected_duration_days;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE TRIGGER update_onboarding_progress_timestamp
  BEFORE UPDATE ON customer_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_stage_progress_timestamp
  BEFORE UPDATE ON onboarding_stage_progress
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_milestones_timestamp
  BEFORE UPDATE ON onboarding_milestones
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_alerts_timestamp
  BEFORE UPDATE ON onboarding_alerts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to calculate progress percentage
CREATE OR REPLACE FUNCTION calculate_onboarding_progress(p_onboarding_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_stages INTEGER := 10;
  completed_stages INTEGER;
BEGIN
  SELECT COUNT(*) INTO completed_stages
  FROM onboarding_stage_progress
  WHERE onboarding_id = p_onboarding_id
    AND status = 'completed';

  RETURN ROUND((completed_stages::NUMERIC / total_stages) * 100)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create stage progress records for new onboarding
CREATE OR REPLACE FUNCTION create_stage_progress_records()
RETURNS TRIGGER AS $$
DECLARE
  stages TEXT[] := ARRAY[
    'contract_signed', 'kickoff_scheduled', 'kickoff_completed',
    'technical_setup', 'data_migration', 'training_scheduled',
    'training_completed', 'first_use', 'value_realized', 'onboarding_complete'
  ];
  expected_days INTEGER[] := ARRAY[0, 2, 1, 5, 7, 2, 3, 3, 5, 0];
  i INTEGER;
BEGIN
  -- Create a stage progress record for each stage
  FOR i IN 1..array_length(stages, 1) LOOP
    INSERT INTO onboarding_stage_progress (
      onboarding_id,
      customer_id,
      stage,
      stage_order,
      expected_duration_days,
      status
    ) VALUES (
      NEW.id,
      NEW.customer_id,
      stages[i],
      i,
      expected_days[i],
      CASE WHEN i = 1 THEN 'in_progress' ELSE 'pending' END
    );
  END LOOP;

  -- Mark first stage as entered
  UPDATE onboarding_stage_progress
  SET entered_at = NEW.started_at
  WHERE onboarding_id = NEW.id AND stage = 'contract_signed';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create stage records on new onboarding
CREATE TRIGGER create_stages_on_new_onboarding
  AFTER INSERT ON customer_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION create_stage_progress_records();

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Insert sample onboarding progress for existing customers
DO $$
DECLARE
  customer_record RECORD;
  onboarding_id UUID;
BEGIN
  FOR customer_record IN
    SELECT id, name, arr, industry
    FROM customers
    WHERE stage = 'onboarding'
    LIMIT 5
  LOOP
    -- Create onboarding progress record
    INSERT INTO customer_onboarding_progress (
      customer_id,
      current_stage,
      overall_status,
      started_at,
      target_completion,
      progress_pct,
      csm_name,
      segment
    ) VALUES (
      customer_record.id,
      CASE
        WHEN RANDOM() < 0.3 THEN 'technical_setup'
        WHEN RANDOM() < 0.5 THEN 'training_completed'
        WHEN RANDOM() < 0.7 THEN 'first_use'
        ELSE 'kickoff_completed'
      END,
      'in_progress',
      NOW() - INTERVAL '30 days' * RANDOM(),
      NOW() + INTERVAL '60 days',
      FLOOR(RANDOM() * 80 + 10)::INTEGER,
      CASE WHEN RANDOM() < 0.5 THEN 'Sarah Chen' ELSE 'Mike Torres' END,
      customer_record.industry
    )
    ON CONFLICT (customer_id) DO NOTHING
    RETURNING id INTO onboarding_id;

  END LOOP;
END $$;
