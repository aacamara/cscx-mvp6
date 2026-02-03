-- PRD-172: Activity Feed Analysis
-- Database schema for customer activity tracking and analysis

-- ============================================
-- CUSTOMER ACTIVITIES TABLE
-- ============================================
-- Stores all customer-related activities for tracking engagement

CREATE TABLE IF NOT EXISTS customer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'meeting', 'call', 'note', 'task', 'document')),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  csm_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT NOT NULL,
  outcome TEXT,
  duration_minutes INTEGER,
  participants TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::JSONB,
  source VARCHAR(50) DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_customer_activities_customer_id ON customer_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_activities_csm_id ON customer_activities(csm_id);
CREATE INDEX IF NOT EXISTS idx_customer_activities_timestamp ON customer_activities(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_customer_activities_type ON customer_activities(type);
CREATE INDEX IF NOT EXISTS idx_customer_activities_customer_timestamp ON customer_activities(customer_id, timestamp DESC);

-- Composite index for activity feed queries
CREATE INDEX IF NOT EXISTS idx_customer_activities_feed ON customer_activities(timestamp DESC, type, customer_id);

-- ============================================
-- ACTIVITY METRICS CACHE TABLE
-- ============================================
-- Caches calculated activity metrics for performance

CREATE TABLE IF NOT EXISTS activity_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_activities INTEGER DEFAULT 0,
  by_type JSONB DEFAULT '{}'::JSONB,
  by_csm JSONB DEFAULT '{}'::JSONB,
  customers_with_activity INTEGER DEFAULT 0,
  customers_without_activity INTEGER DEFAULT 0,
  total_customers INTEGER DEFAULT 0,
  avg_per_customer NUMERIC(10,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(period, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_activity_metrics_cache_period ON activity_metrics_cache(period, period_start DESC);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

DROP TRIGGER IF EXISTS update_customer_activities_updated_at ON customer_activities;
CREATE TRIGGER update_customer_activities_updated_at
  BEFORE UPDATE ON customer_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE customer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_metrics_cache ENABLE ROW LEVEL SECURITY;

-- Users can view activities for their customers
CREATE POLICY "Users can view customer activities"
  ON customer_activities FOR SELECT
  USING (true); -- Adjust based on your auth model

CREATE POLICY "Users can insert customer activities"
  ON customer_activities FOR INSERT
  WITH CHECK (true); -- Adjust based on your auth model

CREATE POLICY "Users can update customer activities"
  ON customer_activities FOR UPDATE
  USING (true); -- Adjust based on your auth model

CREATE POLICY "Users can view activity metrics cache"
  ON activity_metrics_cache FOR SELECT
  USING (true);

-- Service role bypass for backend operations
CREATE POLICY "Service role has full access to customer activities"
  ON customer_activities FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to activity metrics cache"
  ON activity_metrics_cache FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================

-- Insert sample activities for existing customers
INSERT INTO customer_activities (type, customer_id, csm_id, timestamp, description, duration_minutes)
SELECT
  (ARRAY['email', 'meeting', 'call', 'note', 'task'])[floor(random() * 5 + 1)],
  c.id,
  'csm-' || (floor(random() * 3 + 1)::int)::text,
  NOW() - (random() * 30)::int * INTERVAL '1 day' - (random() * 8)::int * INTERVAL '1 hour',
  CASE (floor(random() * 5 + 1)::int)
    WHEN 1 THEN 'Follow-up email sent'
    WHEN 2 THEN 'Quarterly business review meeting'
    WHEN 3 THEN 'Check-in call completed'
    WHEN 4 THEN 'Internal notes updated'
    ELSE 'Task completed'
  END,
  CASE (floor(random() * 5 + 1)::int)
    WHEN 2 THEN 60
    WHEN 3 THEN 30
    ELSE NULL
  END
FROM customers c, generate_series(1, 5) n
ON CONFLICT DO NOTHING;

-- ============================================
-- FUNCTION: Get Customer Last Activity
-- ============================================

CREATE OR REPLACE FUNCTION get_customer_last_activity(p_customer_id UUID)
RETURNS TABLE (
  activity_id UUID,
  activity_type VARCHAR(20),
  activity_timestamp TIMESTAMPTZ,
  days_since_activity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id,
    ca.type,
    ca.timestamp,
    EXTRACT(DAY FROM NOW() - ca.timestamp)::INTEGER
  FROM customer_activities ca
  WHERE ca.customer_id = p_customer_id
  ORDER BY ca.timestamp DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Get Activity Gaps
-- ============================================

CREATE OR REPLACE FUNCTION get_activity_gaps(p_threshold_days INTEGER DEFAULT 7)
RETURNS TABLE (
  customer_id UUID,
  customer_name TEXT,
  arr NUMERIC,
  health_color VARCHAR,
  days_since_activity INTEGER,
  last_activity_date TIMESTAMPTZ,
  last_activity_type VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  WITH last_activities AS (
    SELECT DISTINCT ON (ca.customer_id)
      ca.customer_id,
      ca.timestamp,
      ca.type,
      EXTRACT(DAY FROM NOW() - ca.timestamp)::INTEGER as days_ago
    FROM customer_activities ca
    ORDER BY ca.customer_id, ca.timestamp DESC
  )
  SELECT
    c.id,
    c.name,
    c.arr,
    c.health_color,
    COALESCE(la.days_ago, 999) as days_since_activity,
    la.timestamp,
    la.type
  FROM customers c
  LEFT JOIN last_activities la ON c.id = la.customer_id
  WHERE COALESCE(la.days_ago, 999) >= p_threshold_days
  ORDER BY days_since_activity DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE customer_activities IS 'Stores all customer engagement activities for activity feed analysis (PRD-172)';
COMMENT ON TABLE activity_metrics_cache IS 'Cached activity metrics for performance optimization (PRD-172)';
COMMENT ON FUNCTION get_customer_last_activity(UUID) IS 'Returns the most recent activity for a customer (PRD-172)';
COMMENT ON FUNCTION get_activity_gaps(INTEGER) IS 'Returns customers with activity gaps exceeding threshold days (PRD-172)';
