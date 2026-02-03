-- ============================================
-- PRD-062: Customer Journey Timeline
-- Migration for timeline events tracking
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TIMELINE EVENTS TABLE
-- Unified storage for all customer journey events
-- ============================================
CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Event classification
  event_type TEXT NOT NULL, -- meeting, email_sent, email_received, call, support_ticket, etc.
  event_category TEXT NOT NULL, -- customer_facing, contract, health, usage, internal

  -- Event details
  title TEXT NOT NULL,
  description TEXT,

  -- Temporal data
  occurred_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,

  -- Participants and references
  participants JSONB DEFAULT '[]', -- Array of {name, email, role}
  stakeholder_ids UUID[], -- References to stakeholders table

  -- Source tracking
  source_type TEXT NOT NULL, -- gmail, calendar, zoom, internal, salesforce, zendesk, etc.
  source_id TEXT, -- External reference ID
  source_url TEXT, -- Link to source system

  -- Sentiment and significance
  sentiment TEXT, -- positive, neutral, negative
  importance TEXT DEFAULT 'normal', -- high, normal, low
  is_milestone BOOLEAN DEFAULT FALSE,

  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  tags TEXT[],

  -- Internal tracking
  is_internal BOOLEAN DEFAULT FALSE, -- CSM notes, internal discussions
  created_by UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_timeline_events_customer ON timeline_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_occurred ON timeline_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_events_type ON timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_timeline_events_category ON timeline_events(event_category);
CREATE INDEX IF NOT EXISTS idx_timeline_events_source ON timeline_events(source_type);
CREATE INDEX IF NOT EXISTS idx_timeline_events_milestone ON timeline_events(is_milestone) WHERE is_milestone = TRUE;

-- GIN index for JSONB search
CREATE INDEX IF NOT EXISTS idx_timeline_events_metadata ON timeline_events USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_timeline_events_tags ON timeline_events USING GIN(tags);

-- ============================================
-- STAKEHOLDER ENGAGEMENT HISTORY
-- Track engagement metrics over time per stakeholder
-- ============================================
CREATE TABLE IF NOT EXISTS stakeholder_engagement_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Engagement metrics
  meetings_count INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_received INTEGER DEFAULT 0,
  calls_count INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,

  -- Derived scores
  engagement_score INTEGER, -- 0-100
  response_rate NUMERIC(5,2), -- Percentage
  avg_response_time_hours NUMERIC(10,2),

  -- Sentiment tracking
  sentiment_trend TEXT, -- improving, stable, declining
  sentiment_score INTEGER, -- 0-100

  -- Activity breakdown
  activity_breakdown JSONB DEFAULT '{}', -- {meeting: 5, email: 12, ...}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(stakeholder_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_stakeholder_engagement_stakeholder ON stakeholder_engagement_history(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_engagement_customer ON stakeholder_engagement_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_engagement_period ON stakeholder_engagement_history(period_start, period_end);

-- ============================================
-- CUSTOMER MILESTONES
-- Track key customer journey milestones
-- ============================================
CREATE TABLE IF NOT EXISTS customer_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  milestone_type TEXT NOT NULL, -- onboarding_complete, first_value, renewal, expansion, champion_identified, etc.
  title TEXT NOT NULL,
  description TEXT,

  achieved_at TIMESTAMPTZ NOT NULL,

  -- Associated data
  related_event_id UUID REFERENCES timeline_events(id) ON DELETE SET NULL,
  related_contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,

  -- Value tracking
  value_impact NUMERIC, -- ARR impact if applicable

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_customer ON customer_milestones(customer_id);
CREATE INDEX IF NOT EXISTS idx_milestones_type ON customer_milestones(milestone_type);
CREATE INDEX IF NOT EXISTS idx_milestones_achieved ON customer_milestones(achieved_at DESC);

-- ============================================
-- HEALTH SCORE HISTORY
-- Track health score changes over time
-- ============================================
CREATE TABLE IF NOT EXISTS health_score_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  previous_score INTEGER,
  change_amount INTEGER,

  -- Score components
  engagement_component INTEGER,
  adoption_component INTEGER,
  sentiment_component INTEGER,
  support_component INTEGER,

  -- Change context
  change_reason TEXT,
  change_triggers JSONB DEFAULT '[]', -- Array of {type, description}

  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_history_customer ON health_score_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_health_history_recorded ON health_score_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_history_score ON health_score_history(score);

-- ============================================
-- COMMUNICATION THREADS
-- Track email thread context
-- ============================================
CREATE TABLE IF NOT EXISTS communication_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  thread_id TEXT NOT NULL, -- External thread ID (Gmail, etc.)
  subject TEXT NOT NULL,

  -- Thread stats
  message_count INTEGER DEFAULT 1,
  participant_count INTEGER DEFAULT 1,
  participants JSONB DEFAULT '[]',

  -- Timeline
  first_message_at TIMESTAMPTZ NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL,

  -- Classification
  thread_type TEXT, -- inquiry, support, negotiation, general
  sentiment TEXT,
  status TEXT DEFAULT 'active', -- active, closed, pending

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_threads_customer ON communication_threads(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_threads_external ON communication_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_comm_threads_last_message ON communication_threads(last_message_at DESC);

-- ============================================
-- UPDATE TRIGGER
-- ============================================
CREATE TRIGGER update_timeline_events_timestamp
  BEFORE UPDATE ON timeline_events
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_stakeholder_engagement_timestamp
  BEFORE UPDATE ON stakeholder_engagement_history
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_comm_threads_timestamp
  BEFORE UPDATE ON communication_threads
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get timeline event counts by type for a customer
CREATE OR REPLACE FUNCTION get_timeline_event_counts(p_customer_id UUID)
RETURNS TABLE(event_type TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT te.event_type, COUNT(*) as count
  FROM timeline_events te
  WHERE te.customer_id = p_customer_id
  GROUP BY te.event_type
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate stakeholder engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(
  p_meetings INTEGER,
  p_emails_sent INTEGER,
  p_emails_received INTEGER,
  p_calls INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER;
BEGIN
  -- Weighted scoring: meetings (3x), calls (2x), emails (1x)
  v_score := LEAST(100,
    (p_meetings * 15) +
    (p_calls * 10) +
    (p_emails_sent * 3) +
    (p_emails_received * 5)
  );
  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE DATA
-- ============================================
-- Sample timeline events for existing customers
DO $$
DECLARE
  v_customer_id UUID;
  v_stakeholder_id UUID;
BEGIN
  -- Get first customer
  SELECT id INTO v_customer_id FROM customers LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    -- Get first stakeholder for this customer
    SELECT id INTO v_stakeholder_id FROM stakeholders WHERE customer_id = v_customer_id LIMIT 1;

    -- Insert sample timeline events
    INSERT INTO timeline_events (customer_id, event_type, event_category, title, description, occurred_at, source_type, sentiment, importance)
    VALUES
      (v_customer_id, 'contract_signed', 'contract', 'Initial Contract Signed', 'Customer signed initial contract worth $150,000 ARR', NOW() - INTERVAL '365 days', 'internal', 'positive', 'high'),
      (v_customer_id, 'meeting', 'customer_facing', 'Kickoff Meeting', 'Initial kickoff meeting with implementation team', NOW() - INTERVAL '360 days', 'calendar', 'positive', 'high'),
      (v_customer_id, 'training', 'customer_facing', 'Admin Training Session', 'Completed admin training for Sarah Chen', NOW() - INTERVAL '350 days', 'calendar', 'positive', 'normal'),
      (v_customer_id, 'email_sent', 'customer_facing', 'Welcome Email', 'Sent welcome email with onboarding resources', NOW() - INTERVAL '358 days', 'gmail', 'neutral', 'normal'),
      (v_customer_id, 'usage_milestone', 'usage', '100 Active Users', 'Customer reached 100 active users milestone', NOW() - INTERVAL '300 days', 'internal', 'positive', 'high'),
      (v_customer_id, 'qbr', 'customer_facing', 'Q2 Quarterly Business Review', 'Quarterly business review covering adoption metrics', NOW() - INTERVAL '180 days', 'calendar', 'positive', 'high'),
      (v_customer_id, 'health_change', 'health', 'Health Score Improved', 'Health score increased from 75 to 85', NOW() - INTERVAL '90 days', 'internal', 'positive', 'normal'),
      (v_customer_id, 'meeting', 'customer_facing', 'Monthly Check-In', 'Regular monthly check-in call', NOW() - INTERVAL '30 days', 'calendar', 'positive', 'normal'),
      (v_customer_id, 'email_received', 'customer_facing', 'Feature Request', 'Customer submitted feature request for reporting', NOW() - INTERVAL '14 days', 'gmail', 'neutral', 'normal'),
      (v_customer_id, 'support_ticket', 'customer_facing', 'API Integration Issue', 'Support ticket for API integration question - resolved', NOW() - INTERVAL '7 days', 'zendesk', 'neutral', 'normal')
    ON CONFLICT DO NOTHING;

    -- Insert milestone
    INSERT INTO customer_milestones (customer_id, milestone_type, title, description, achieved_at)
    VALUES
      (v_customer_id, 'onboarding_complete', 'Onboarding Completed', 'Customer successfully completed onboarding program', NOW() - INTERVAL '340 days'),
      (v_customer_id, 'first_value', 'First Value Milestone', 'Customer reported measurable ROI from platform', NOW() - INTERVAL '270 days'),
      (v_customer_id, 'champion_identified', 'Champion Identified', 'Sarah Chen identified as product champion', NOW() - INTERVAL '300 days')
    ON CONFLICT DO NOTHING;

    -- Insert health score history
    INSERT INTO health_score_history (customer_id, score, previous_score, change_amount, engagement_component, adoption_component, sentiment_component, recorded_at)
    VALUES
      (v_customer_id, 70, NULL, NULL, 65, 70, 75, NOW() - INTERVAL '365 days'),
      (v_customer_id, 75, 70, 5, 70, 75, 80, NOW() - INTERVAL '270 days'),
      (v_customer_id, 78, 75, 3, 75, 78, 81, NOW() - INTERVAL '180 days'),
      (v_customer_id, 85, 78, 7, 82, 85, 88, NOW() - INTERVAL '90 days'),
      (v_customer_id, 87, 85, 2, 85, 87, 90, NOW() - INTERVAL '30 days')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY (Optional)
-- ============================================
-- ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stakeholder_engagement_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customer_milestones ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE health_score_history ENABLE ROW LEVEL SECURITY;
