-- Migration: 028_mixpanel_integration.sql
-- Purpose: Mixpanel product analytics integration (PRD-197)

-- ============================================
-- MIXPANEL METRICS TABLE
-- Stores aggregated event data per customer
-- ============================================
CREATE TABLE IF NOT EXISTS mixpanel_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  mixpanel_group_id TEXT, -- Mixpanel group/project identifier for this customer
  metric_date DATE NOT NULL,
  total_events INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  avg_events_per_user NUMERIC(10, 2) DEFAULT 0,
  avg_session_duration_seconds INTEGER DEFAULT 0,
  top_events JSONB DEFAULT '[]', -- [{name, count}]
  property_breakdowns JSONB DEFAULT '{}', -- {property: {value: count}}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_mixpanel_metrics_customer ON mixpanel_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_mixpanel_metrics_date ON mixpanel_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_mixpanel_metrics_customer_date ON mixpanel_metrics(customer_id, metric_date DESC);

-- ============================================
-- MIXPANEL FUNNELS TABLE
-- Stores funnel performance data per customer
-- ============================================
CREATE TABLE IF NOT EXISTS mixpanel_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  funnel_id TEXT NOT NULL,
  funnel_name TEXT NOT NULL,
  metric_date DATE NOT NULL,
  conversion_rate NUMERIC(5, 2) DEFAULT 0, -- Percentage 0-100
  completed_users INTEGER DEFAULT 0,
  started_users INTEGER DEFAULT 0,
  drop_off_step INTEGER, -- Step where most users drop off
  steps JSONB DEFAULT '[]', -- [{step_name, entered, completed, conversion_rate}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, funnel_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_mixpanel_funnels_customer ON mixpanel_funnels(customer_id);
CREATE INDEX IF NOT EXISTS idx_mixpanel_funnels_funnel ON mixpanel_funnels(funnel_id);
CREATE INDEX IF NOT EXISTS idx_mixpanel_funnels_date ON mixpanel_funnels(metric_date DESC);

-- ============================================
-- MIXPANEL USER PROPERTIES TABLE
-- Stores aggregated user profile data per customer
-- ============================================
CREATE TABLE IF NOT EXISTS mixpanel_user_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_users INTEGER DEFAULT 0,
  active_users_7d INTEGER DEFAULT 0,
  active_users_30d INTEGER DEFAULT 0,
  new_users_7d INTEGER DEFAULT 0,
  churned_users_30d INTEGER DEFAULT 0,
  power_users INTEGER DEFAULT 0, -- Users in top 10% by activity
  avg_lifetime_events NUMERIC(10, 2) DEFAULT 0,
  user_segments JSONB DEFAULT '{}', -- {segment_name: count}
  custom_properties JSONB DEFAULT '{}', -- Aggregated custom property stats
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_mixpanel_users_customer ON mixpanel_user_aggregates(customer_id);
CREATE INDEX IF NOT EXISTS idx_mixpanel_users_date ON mixpanel_user_aggregates(snapshot_date DESC);

-- ============================================
-- MIXPANEL SYNC LOG TABLE
-- Tracks all sync operations
-- ============================================
CREATE TABLE IF NOT EXISTS mixpanel_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integration_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sync_type VARCHAR(20) NOT NULL, -- 'events', 'funnels', 'users', 'full'
  customer_ids UUID[] DEFAULT '{}', -- Customers included in this sync
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB DEFAULT '[]',
  sync_metadata JSONB DEFAULT '{}', -- {date_range, filters, etc.}
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mixpanel_sync_log_integration ON mixpanel_sync_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_mixpanel_sync_log_user ON mixpanel_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mixpanel_sync_log_status ON mixpanel_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_mixpanel_sync_log_started ON mixpanel_sync_log(started_at DESC);

-- ============================================
-- ADD MIXPANEL MAPPING TO CUSTOMERS
-- ============================================
DO $$
BEGIN
  -- Mixpanel group ID for customer mapping
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'mixpanel_group_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN mixpanel_group_id TEXT;
  END IF;

  -- Mixpanel engagement score (calculated from Mixpanel data)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'mixpanel_engagement_score'
  ) THEN
    ALTER TABLE customers ADD COLUMN mixpanel_engagement_score INTEGER;
  END IF;

  -- Last Mixpanel sync timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'last_mixpanel_sync'
  ) THEN
    ALTER TABLE customers ADD COLUMN last_mixpanel_sync TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_mixpanel_group ON customers(mixpanel_group_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate engagement score from Mixpanel metrics
CREATE OR REPLACE FUNCTION calculate_mixpanel_engagement_score(p_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_avg_events NUMERIC;
  v_unique_users INTEGER;
  v_sessions INTEGER;
  v_funnel_conversion NUMERIC;
BEGIN
  -- Get latest metrics (last 30 days average)
  SELECT
    COALESCE(AVG(total_events), 0),
    COALESCE(AVG(unique_users), 0),
    COALESCE(AVG(sessions), 0)
  INTO v_avg_events, v_unique_users, v_sessions
  FROM mixpanel_metrics
  WHERE customer_id = p_customer_id
    AND metric_date > CURRENT_DATE - INTERVAL '30 days';

  -- Get average funnel conversion
  SELECT COALESCE(AVG(conversion_rate), 0)
  INTO v_funnel_conversion
  FROM mixpanel_funnels
  WHERE customer_id = p_customer_id
    AND metric_date > CURRENT_DATE - INTERVAL '30 days';

  -- Calculate score components (each out of 25, total 100)
  -- Event activity score (0-25)
  v_score := v_score + LEAST(25, (v_avg_events / 100)::INTEGER);

  -- User engagement score (0-25)
  v_score := v_score + LEAST(25, (v_unique_users / 10)::INTEGER);

  -- Session depth score (0-25)
  v_score := v_score + LEAST(25, (v_sessions / 20)::INTEGER);

  -- Funnel conversion score (0-25)
  v_score := v_score + LEAST(25, (v_funnel_conversion / 4)::INTEGER);

  RETURN LEAST(100, v_score);
END;
$$ LANGUAGE plpgsql;

-- Function to get Mixpanel sync statistics
CREATE OR REPLACE FUNCTION get_mixpanel_sync_stats(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_syncs BIGINT,
  successful_syncs BIGINT,
  failed_syncs BIGINT,
  total_records_processed BIGINT,
  customers_synced BIGINT,
  avg_sync_duration_seconds NUMERIC,
  last_sync_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_syncs,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as successful_syncs,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_syncs,
    COALESCE(SUM(records_processed), 0)::BIGINT as total_records_processed,
    COUNT(DISTINCT UNNEST(customer_ids))::BIGINT as customers_synced,
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::NUMERIC,
      0
    ) as avg_sync_duration_seconds,
    MAX(completed_at) as last_sync_at
  FROM mixpanel_sync_log
  WHERE user_id = p_user_id
    AND started_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to get customer engagement trends
CREATE OR REPLACE FUNCTION get_mixpanel_engagement_trend(p_customer_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  metric_date DATE,
  total_events INTEGER,
  unique_users INTEGER,
  sessions INTEGER,
  avg_events_per_user NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.metric_date,
    m.total_events,
    m.unique_users,
    m.sessions,
    m.avg_events_per_user
  FROM mixpanel_metrics m
  WHERE m.customer_id = p_customer_id
    AND m.metric_date > CURRENT_DATE - (p_days || ' days')::INTERVAL
  ORDER BY m.metric_date ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE mixpanel_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mixpanel_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE mixpanel_user_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE mixpanel_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can access data for customers they own)
CREATE POLICY mixpanel_metrics_access ON mixpanel_metrics
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE csm_id = auth.uid())
  );

CREATE POLICY mixpanel_funnels_access ON mixpanel_funnels
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE csm_id = auth.uid())
  );

CREATE POLICY mixpanel_user_aggregates_access ON mixpanel_user_aggregates
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE csm_id = auth.uid())
  );

CREATE POLICY mixpanel_sync_log_access ON mixpanel_sync_log
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE mixpanel_metrics IS 'Aggregated Mixpanel event metrics per customer per day (PRD-197)';
COMMENT ON TABLE mixpanel_funnels IS 'Mixpanel funnel conversion data per customer (PRD-197)';
COMMENT ON TABLE mixpanel_user_aggregates IS 'Aggregated Mixpanel user statistics per customer (PRD-197)';
COMMENT ON TABLE mixpanel_sync_log IS 'Audit log for Mixpanel sync operations (PRD-197)';
