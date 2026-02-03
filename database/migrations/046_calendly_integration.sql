-- PRD-208: Calendly Scheduling Integration
-- This migration creates the tables needed for Calendly integration

-- ============================================
-- Calendly Connections Table
-- ============================================
-- Stores OAuth tokens and user info for Calendly connections

CREATE TABLE IF NOT EXISTS calendly_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendly_user_id TEXT NOT NULL,
  calendly_user_uri TEXT NOT NULL,
  organization_uri TEXT,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  timezone TEXT,
  is_active BOOLEAN DEFAULT true,
  last_error TEXT,
  webhook_subscription_uri TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for faster lookups
CREATE INDEX idx_calendly_connections_user_id ON calendly_connections(user_id);
CREATE INDEX idx_calendly_connections_calendly_user_uri ON calendly_connections(calendly_user_uri);

-- ============================================
-- Calendly Events Table
-- ============================================
-- Stores synced Calendly scheduled events (bookings)

CREATE TABLE IF NOT EXISTS calendly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendly_event_id TEXT NOT NULL UNIQUE,
  calendly_event_uri TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  event_type TEXT,
  event_name TEXT NOT NULL,
  invitee_email TEXT,
  invitee_name TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'completed', 'no_show')),
  location JSONB,
  cancel_url TEXT,
  reschedule_url TEXT,
  questions_and_answers JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_calendly_events_customer_id ON calendly_events(customer_id);
CREATE INDEX idx_calendly_events_user_id ON calendly_events(user_id);
CREATE INDEX idx_calendly_events_start_time ON calendly_events(start_time);
CREATE INDEX idx_calendly_events_status ON calendly_events(status);
CREATE INDEX idx_calendly_events_invitee_email ON calendly_events(invitee_email);

-- ============================================
-- Calendly Scheduling Links Table
-- ============================================
-- Tracks one-time scheduling links generated for customers

CREATE TABLE IF NOT EXISTS calendly_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  booking_url TEXT NOT NULL,
  event_type TEXT NOT NULL,
  max_event_count INTEGER DEFAULT 1,
  events_created INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB
);

-- Index for tracking link usage
CREATE INDEX idx_calendly_links_customer_id ON calendly_links(customer_id);
CREATE INDEX idx_calendly_links_user_id ON calendly_links(user_id);
CREATE INDEX idx_calendly_links_created_at ON calendly_links(created_at);

-- ============================================
-- Calendly Webhook Events Table
-- ============================================
-- Stores incoming webhook events from Calendly

CREATE TABLE IF NOT EXISTS calendly_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_uri TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding unprocessed events
CREATE INDEX idx_calendly_webhook_events_processed ON calendly_webhook_events(processed);
CREATE INDEX idx_calendly_webhook_events_event_type ON calendly_webhook_events(event_type);

-- ============================================
-- Calendly Sync Log Table
-- ============================================
-- Tracks sync operations for debugging and monitoring

CREATE TABLE IF NOT EXISTS calendly_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL, -- 'events', 'event_types', etc.
  status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  records_synced INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for finding recent syncs
CREATE INDEX idx_calendly_sync_log_user_id ON calendly_sync_log(user_id);
CREATE INDEX idx_calendly_sync_log_started_at ON calendly_sync_log(started_at);

-- ============================================
-- Engagement Metrics View
-- ============================================
-- Provides a view of Calendly engagement metrics per customer

CREATE OR REPLACE VIEW calendly_customer_metrics AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  COUNT(ce.id) AS total_bookings,
  COUNT(CASE WHEN ce.status = 'active' AND ce.start_time < NOW() THEN 1 END) AS completed_meetings,
  COUNT(CASE WHEN ce.status = 'canceled' THEN 1 END) AS canceled_meetings,
  COUNT(CASE WHEN ce.status = 'no_show' THEN 1 END) AS no_shows,
  ROUND(
    CASE
      WHEN COUNT(ce.id) > 0 THEN
        COUNT(CASE WHEN ce.status = 'canceled' THEN 1 END)::NUMERIC / COUNT(ce.id) * 100
      ELSE 0
    END,
    1
  ) AS cancellation_rate,
  MIN(ce.start_time) AS first_meeting,
  MAX(CASE WHEN ce.start_time < NOW() THEN ce.start_time END) AS last_meeting,
  MIN(CASE WHEN ce.start_time > NOW() THEN ce.start_time END) AS next_meeting,
  CASE
    WHEN COUNT(ce.id) = 0 THEN 'none'
    WHEN COUNT(ce.id)::NUMERIC / GREATEST(
      EXTRACT(EPOCH FROM (NOW() - MIN(ce.start_time))) / (30 * 24 * 60 * 60),
      1
    ) >= 4 THEN 'high'
    WHEN COUNT(ce.id)::NUMERIC / GREATEST(
      EXTRACT(EPOCH FROM (NOW() - MIN(ce.start_time))) / (30 * 24 * 60 * 60),
      1
    ) >= 1 THEN 'medium'
    ELSE 'low'
  END AS meeting_frequency
FROM customers c
LEFT JOIN calendly_events ce ON ce.customer_id = c.id
GROUP BY c.id, c.name;

-- ============================================
-- Row Level Security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE calendly_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendly_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendly_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendly_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendly_sync_log ENABLE ROW LEVEL SECURITY;

-- Policy for calendly_connections: Users can only see their own connections
CREATE POLICY calendly_connections_user_policy ON calendly_connections
  FOR ALL USING (auth.uid()::TEXT = user_id::TEXT);

-- Policy for calendly_events: Users can see events they created or for their customers
CREATE POLICY calendly_events_user_policy ON calendly_events
  FOR ALL USING (
    auth.uid()::TEXT = user_id::TEXT OR
    customer_id IN (SELECT id FROM customers WHERE created_by = auth.uid()::TEXT)
  );

-- Policy for calendly_links: Users can only see links they created
CREATE POLICY calendly_links_user_policy ON calendly_links
  FOR ALL USING (auth.uid()::TEXT = user_id::TEXT);

-- Policy for calendly_webhook_events: Users can only see their webhook events
CREATE POLICY calendly_webhook_events_user_policy ON calendly_webhook_events
  FOR ALL USING (auth.uid()::TEXT = user_id::TEXT);

-- Policy for calendly_sync_log: Users can only see their sync logs
CREATE POLICY calendly_sync_log_user_policy ON calendly_sync_log
  FOR ALL USING (auth.uid()::TEXT = user_id::TEXT);

-- ============================================
-- Functions for Health Score Integration
-- ============================================

-- Function to calculate Calendly engagement score for a customer (0-100)
CREATE OR REPLACE FUNCTION calculate_calendly_engagement_score(p_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_meetings INTEGER;
  v_canceled_meetings INTEGER;
  v_last_meeting_days INTEGER;
  v_meeting_frequency NUMERIC;
  v_score INTEGER := 0;
BEGIN
  -- Get meeting stats
  SELECT
    COUNT(*),
    COUNT(CASE WHEN status = 'canceled' THEN 1 END),
    EXTRACT(DAY FROM NOW() - MAX(CASE WHEN start_time < NOW() THEN start_time END)),
    CASE
      WHEN COUNT(*) = 0 THEN 0
      WHEN MIN(start_time) IS NULL THEN 0
      ELSE COUNT(*)::NUMERIC / GREATEST(
        EXTRACT(EPOCH FROM (NOW() - MIN(start_time))) / (30 * 24 * 60 * 60),
        1
      )
    END
  INTO v_total_meetings, v_canceled_meetings, v_last_meeting_days, v_meeting_frequency
  FROM calendly_events
  WHERE customer_id = p_customer_id;

  -- No meetings = 0 score
  IF v_total_meetings = 0 THEN
    RETURN 0;
  END IF;

  -- Base score from meeting frequency (0-40 points)
  IF v_meeting_frequency >= 4 THEN
    v_score := v_score + 40;
  ELSIF v_meeting_frequency >= 2 THEN
    v_score := v_score + 30;
  ELSIF v_meeting_frequency >= 1 THEN
    v_score := v_score + 20;
  ELSIF v_meeting_frequency >= 0.5 THEN
    v_score := v_score + 10;
  END IF;

  -- Recency bonus (0-30 points)
  IF v_last_meeting_days IS NOT NULL THEN
    IF v_last_meeting_days <= 7 THEN
      v_score := v_score + 30;
    ELSIF v_last_meeting_days <= 14 THEN
      v_score := v_score + 25;
    ELSIF v_last_meeting_days <= 30 THEN
      v_score := v_score + 20;
    ELSIF v_last_meeting_days <= 60 THEN
      v_score := v_score + 10;
    ELSIF v_last_meeting_days <= 90 THEN
      v_score := v_score + 5;
    END IF;
  END IF;

  -- Low cancellation rate bonus (0-30 points)
  IF v_total_meetings > 0 THEN
    IF (v_canceled_meetings::NUMERIC / v_total_meetings) <= 0.05 THEN
      v_score := v_score + 30;
    ELSIF (v_canceled_meetings::NUMERIC / v_total_meetings) <= 0.10 THEN
      v_score := v_score + 25;
    ELSIF (v_canceled_meetings::NUMERIC / v_total_meetings) <= 0.20 THEN
      v_score := v_score + 15;
    ELSIF (v_canceled_meetings::NUMERIC / v_total_meetings) <= 0.30 THEN
      v_score := v_score + 5;
    END IF;
  END IF;

  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger for Updated At
-- ============================================

CREATE OR REPLACE FUNCTION update_calendly_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendly_connections_updated_at
  BEFORE UPDATE ON calendly_connections
  FOR EACH ROW EXECUTE FUNCTION update_calendly_updated_at();

CREATE TRIGGER calendly_events_updated_at
  BEFORE UPDATE ON calendly_events
  FOR EACH ROW EXECUTE FUNCTION update_calendly_updated_at();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE calendly_connections IS 'Stores Calendly OAuth connections for users';
COMMENT ON TABLE calendly_events IS 'Stores synced Calendly scheduled events (bookings)';
COMMENT ON TABLE calendly_links IS 'Tracks one-time scheduling links generated for customers';
COMMENT ON TABLE calendly_webhook_events IS 'Stores incoming webhook events from Calendly for processing';
COMMENT ON TABLE calendly_sync_log IS 'Tracks sync operations for debugging and monitoring';
COMMENT ON VIEW calendly_customer_metrics IS 'Aggregated Calendly engagement metrics per customer';
COMMENT ON FUNCTION calculate_calendly_engagement_score IS 'Calculates engagement score (0-100) based on Calendly meeting data';
