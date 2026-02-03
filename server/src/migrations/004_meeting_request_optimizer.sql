-- Migration: Meeting Request Optimizer (PRD-036)
-- Created: 2026-01-29
-- Description: Tables for meeting pattern analysis and stakeholder scheduling preferences

-- Meeting requests tracking table
CREATE TABLE IF NOT EXISTS meeting_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  requested_by UUID, -- CSM user ID
  meeting_type VARCHAR(50) NOT NULL DEFAULT 'general' CHECK (meeting_type IN ('qbr', 'check_in', 'kickoff', 'training', 'escalation', 'renewal', 'general')),
  subject VARCHAR(255) NOT NULL,
  body_html TEXT,
  body_text TEXT,
  proposed_times JSONB DEFAULT '[]'::jsonb,
  -- Proposed times format:
  -- [{ "date": "2026-01-30", "time": "09:00", "timezone": "America/Los_Angeles", "duration_minutes": 30 }]
  suggested_duration INTEGER DEFAULT 30,
  suggested_format VARCHAR(20) DEFAULT 'video' CHECK (suggested_format IN ('video', 'phone', 'in_person')),
  calendar_link TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'rescheduled', 'cancelled')),
  sent_at TIMESTAMPTZ,
  response_at TIMESTAMPTZ,
  response_time_hours NUMERIC(10, 2),
  accepted_time JSONB, -- The time that was accepted
  meeting_google_event_id VARCHAR(255),
  optimization_data JSONB DEFAULT '{}'::jsonb,
  -- Optimization data format:
  -- {
  --   "pattern_analysis": { "best_day": "tuesday", "best_time": "10:00", "avg_duration": 30 },
  --   "stakeholder_timezone": "America/Los_Angeles",
  --   "csm_availability_checked": true,
  --   "optimization_score": 85
  -- }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_requests_customer ON meeting_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_stakeholder ON meeting_requests(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_status ON meeting_requests(status);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_sent_at ON meeting_requests(sent_at DESC);

-- Stakeholder scheduling preferences
CREATE TABLE IF NOT EXISTS stakeholder_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id UUID NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  timezone VARCHAR(100) DEFAULT 'America/New_York',
  preferred_days JSONB DEFAULT '["tuesday", "wednesday", "thursday"]'::jsonb,
  preferred_time_start TIME DEFAULT '09:00',
  preferred_time_end TIME DEFAULT '17:00',
  preferred_duration_minutes INTEGER DEFAULT 30,
  preferred_format VARCHAR(20) DEFAULT 'video' CHECK (preferred_format IN ('video', 'phone', 'in_person')),
  avoid_days JSONB DEFAULT '[]'::jsonb,
  avoid_times JSONB DEFAULT '[]'::jsonb,
  -- Avoid times format: [{ "day": "friday", "start": "14:00", "end": "17:00", "reason": "All-hands meeting" }]
  notes TEXT,
  last_updated_from VARCHAR(50), -- 'manual', 'auto_learned', 'stated'
  confidence_score NUMERIC(3, 2) DEFAULT 0.5, -- 0-1 confidence in preferences
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stakeholder_id)
);

CREATE INDEX IF NOT EXISTS idx_stakeholder_preferences_stakeholder ON stakeholder_preferences(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_preferences_customer ON stakeholder_preferences(customer_id);

-- Meeting pattern history for learning
CREATE TABLE IF NOT EXISTS meeting_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  -- Aggregate pattern data
  total_meetings INTEGER DEFAULT 0,
  accepted_meetings INTEGER DEFAULT 0,
  declined_meetings INTEGER DEFAULT 0,
  rescheduled_meetings INTEGER DEFAULT 0,
  avg_response_time_hours NUMERIC(10, 2),
  -- Day of week patterns (0=Sunday, 1=Monday, etc.)
  day_acceptance_rates JSONB DEFAULT '{}'::jsonb,
  -- Format: { "0": 0.2, "1": 0.7, "2": 0.85, "3": 0.8, "4": 0.6, "5": 0.3, "6": 0.1 }
  -- Hour patterns
  hour_acceptance_rates JSONB DEFAULT '{}'::jsonb,
  -- Format: { "9": 0.9, "10": 0.85, "11": 0.7, "14": 0.8, "15": 0.75 }
  -- Duration patterns
  duration_preferences JSONB DEFAULT '{}'::jsonb,
  -- Format: { "15": 0.5, "30": 0.9, "45": 0.7, "60": 0.6 }
  -- Format preferences
  format_preferences JSONB DEFAULT '{}'::jsonb,
  -- Format: { "video": 0.9, "phone": 0.6, "in_person": 0.3 }
  -- Most successful subject lines
  successful_subjects JSONB DEFAULT '[]'::jsonb,
  -- Format: ["Quick Sync", "30-min Check-in", "Product Update Discussion"]
  last_meeting_at TIMESTAMPTZ,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, stakeholder_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_patterns_customer ON meeting_patterns(customer_id);
CREATE INDEX IF NOT EXISTS idx_meeting_patterns_stakeholder ON meeting_patterns(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_meeting_patterns_last_meeting ON meeting_patterns(last_meeting_at DESC);

-- Meeting request A/B testing
CREATE TABLE IF NOT EXISTS meeting_request_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_name VARCHAR(100) NOT NULL,
  description TEXT,
  variant_type VARCHAR(50) NOT NULL CHECK (variant_type IN ('subject_line', 'body_template', 'time_options', 'cta_style')),
  variants JSONB NOT NULL,
  -- Format: { "control": "Let's schedule a call", "variant_a": "Quick sync this week?", "variant_b": "30 min to discuss [topic]" }
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track which variant was used for each request
CREATE TABLE IF NOT EXISTS meeting_request_experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES meeting_request_experiments(id) ON DELETE CASCADE,
  meeting_request_id UUID NOT NULL REFERENCES meeting_requests(id) ON DELETE CASCADE,
  variant_name VARCHAR(100) NOT NULL,
  outcome VARCHAR(20) CHECK (outcome IN ('accepted', 'declined', 'no_response', 'rescheduled')),
  response_time_hours NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_request_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_results_experiment ON meeting_request_experiment_results(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_results_outcome ON meeting_request_experiment_results(outcome);

-- Add timezone to stakeholders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stakeholders' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE stakeholders ADD COLUMN timezone VARCHAR(100) DEFAULT 'America/New_York';
  END IF;
END $$;

-- Add last_meeting_at to stakeholders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stakeholders' AND column_name = 'last_meeting_at'
  ) THEN
    ALTER TABLE stakeholders ADD COLUMN last_meeting_at TIMESTAMPTZ;
  END IF;
END $$;

-- Comments on tables
COMMENT ON TABLE meeting_requests IS 'Tracks meeting requests with optimization data and response tracking (PRD-036)';
COMMENT ON TABLE stakeholder_preferences IS 'Learned and stated stakeholder scheduling preferences';
COMMENT ON TABLE meeting_patterns IS 'Aggregated meeting acceptance patterns for ML-based optimization';
COMMENT ON TABLE meeting_request_experiments IS 'A/B testing experiments for meeting request optimization';
COMMENT ON TABLE meeting_request_experiment_results IS 'Results of A/B testing for meeting requests';
