-- PRD-157: Engagement Metrics Report
-- Migration for engagement tracking and metrics

-- ============================================
-- ENGAGEMENT ACTIVITIES TABLE
-- Tracks all customer touchpoints and interactions
-- ============================================
CREATE TABLE IF NOT EXISTS engagement_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID, -- CSM who performed the activity

  -- Activity details
  type TEXT NOT NULL CHECK (type IN ('email', 'meeting', 'call', 'qbr', 'message', 'event')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INTEGER,

  -- Participants and context
  participants JSONB DEFAULT '[]', -- Array of participant names/emails
  stakeholder_level TEXT CHECK (stakeholder_level IN ('executive', 'champion', 'user', NULL)),

  -- Engagement quality indicators
  response_received BOOLEAN DEFAULT FALSE,
  response_time_hours NUMERIC,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', NULL)),

  -- Source tracking
  source TEXT NOT NULL DEFAULT 'manual', -- 'gmail', 'calendar', 'manual', 'zoom', 'slack'
  external_id TEXT, -- ID from external system (email thread ID, calendar event ID, etc.)

  -- Additional metadata
  subject TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_engagement_customer ON engagement_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_engagement_date ON engagement_activities(date);
CREATE INDEX IF NOT EXISTS idx_engagement_type ON engagement_activities(type);
CREATE INDEX IF NOT EXISTS idx_engagement_user ON engagement_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_source ON engagement_activities(source);

-- ============================================
-- ENGAGEMENT METRICS SNAPSHOTS TABLE
-- Stores calculated engagement scores over time for trending
-- ============================================
CREATE TABLE IF NOT EXISTS engagement_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Activity counts
  emails_sent INTEGER DEFAULT 0,
  emails_received INTEGER DEFAULT 0,
  meetings_held INTEGER DEFAULT 0,
  meeting_minutes INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  qbrs_completed INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  events_attended INTEGER DEFAULT 0,

  -- Quality metrics
  response_rate NUMERIC DEFAULT 0, -- 0-1
  avg_response_time_hours NUMERIC,
  stakeholders_engaged INTEGER DEFAULT 0,
  executive_touchpoints INTEGER DEFAULT 0,

  -- Calculated scores
  engagement_score INTEGER DEFAULT 0, -- 0-100
  category TEXT CHECK (category IN ('high', 'healthy', 'low', 'at_risk')),
  trend TEXT CHECK (trend IN ('improving', 'stable', 'declining')),
  change_from_last_period NUMERIC DEFAULT 0,

  -- Last contact info
  last_contact_date TIMESTAMPTZ,
  last_contact_type TEXT,
  days_since_contact INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicate snapshots for same period
CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_snapshot_unique
ON engagement_metrics_snapshots(customer_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_engagement_snapshot_customer ON engagement_metrics_snapshots(customer_id);
CREATE INDEX IF NOT EXISTS idx_engagement_snapshot_period ON engagement_metrics_snapshots(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_engagement_snapshot_score ON engagement_metrics_snapshots(engagement_score);

-- ============================================
-- ENGAGEMENT ALERTS TABLE
-- Stores engagement-related alerts for CSMs
-- ============================================
CREATE TABLE IF NOT EXISTS engagement_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID, -- CSM to notify

  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'low_engagement',
    'declining_engagement',
    'no_contact',
    'no_response',
    'executive_gap'
  )),

  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',

  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_alerts_customer ON engagement_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_engagement_alerts_user ON engagement_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_alerts_status ON engagement_alerts(status);
CREATE INDEX IF NOT EXISTS idx_engagement_alerts_type ON engagement_alerts(alert_type);

-- ============================================
-- ADD ENGAGEMENT FIELDS TO CUSTOMERS TABLE
-- ============================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS engagement_category TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS engagement_trend TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_contact_type TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS days_since_contact INTEGER DEFAULT 0;

-- ============================================
-- TRIGGER TO UPDATE TIMESTAMPS
-- ============================================
CREATE OR REPLACE FUNCTION update_engagement_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_engagement_activities_timestamp
  BEFORE UPDATE ON engagement_activities
  FOR EACH ROW EXECUTE FUNCTION update_engagement_timestamp();

CREATE TRIGGER update_engagement_alerts_timestamp
  BEFORE UPDATE ON engagement_alerts
  FOR EACH ROW EXECUTE FUNCTION update_engagement_timestamp();

-- ============================================
-- SAMPLE ENGAGEMENT DATA
-- ============================================
-- Insert sample activities for existing customers
DO $$
DECLARE
  cust_record RECORD;
  activity_date TIMESTAMPTZ;
  i INTEGER;
BEGIN
  FOR cust_record IN SELECT id, name FROM customers LIMIT 5 LOOP
    -- Generate sample activities for the last 90 days
    FOR i IN 1..10 LOOP
      activity_date := NOW() - (random() * 90 || ' days')::INTERVAL;

      -- Insert email activity
      INSERT INTO engagement_activities (
        customer_id, type, direction, date, participants,
        response_received, source, subject
      ) VALUES (
        cust_record.id,
        'email',
        CASE WHEN random() > 0.5 THEN 'outbound' ELSE 'inbound' END,
        activity_date,
        '["contact@example.com"]'::JSONB,
        random() > 0.3,
        'gmail',
        'Follow-up discussion'
      ) ON CONFLICT DO NOTHING;

      -- Insert meeting activity (less frequent)
      IF random() > 0.6 THEN
        INSERT INTO engagement_activities (
          customer_id, type, direction, date, duration_minutes,
          participants, stakeholder_level, source, subject
        ) VALUES (
          cust_record.id,
          'meeting',
          'outbound',
          activity_date,
          30 + floor(random() * 60)::INTEGER,
          '["contact@example.com", "csm@company.com"]'::JSONB,
          CASE
            WHEN random() > 0.7 THEN 'executive'
            WHEN random() > 0.4 THEN 'champion'
            ELSE 'user'
          END,
          'calendar',
          'Weekly sync meeting'
        ) ON CONFLICT DO NOTHING;
      END IF;

      -- Insert call activity (occasional)
      IF random() > 0.8 THEN
        INSERT INTO engagement_activities (
          customer_id, type, direction, date, duration_minutes,
          source, subject
        ) VALUES (
          cust_record.id,
          'call',
          CASE WHEN random() > 0.3 THEN 'outbound' ELSE 'inbound' END,
          activity_date,
          5 + floor(random() * 25)::INTEGER,
          'manual',
          'Quick check-in call'
        ) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    -- Insert a QBR for some customers
    IF random() > 0.5 THEN
      INSERT INTO engagement_activities (
        customer_id, type, direction, date, duration_minutes,
        participants, stakeholder_level, source, subject
      ) VALUES (
        cust_record.id,
        'qbr',
        'outbound',
        NOW() - (random() * 60 || ' days')::INTERVAL,
        60,
        '["exec@example.com", "champion@example.com"]'::JSONB,
        'executive',
        'calendar',
        'Q1 Quarterly Business Review'
      ) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
