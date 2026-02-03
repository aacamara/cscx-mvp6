-- PRD-102: Support Satisfaction Drop Alert
-- Migration to add support satisfaction tracking tables

-- ================================================
-- SUPPORT SATISFACTION TABLE
-- Tracks CSAT scores from support ticket closures
-- ================================================
CREATE TABLE IF NOT EXISTS support_satisfaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  ticket_id TEXT NOT NULL,
  ticket_subject TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  ticket_category VARCHAR(100),
  resolution_time_hours INTEGER,
  was_escalated BOOLEAN DEFAULT false,
  survey_sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  csm_notified BOOLEAN DEFAULT false,
  csm_followed_up BOOLEAN DEFAULT false,
  follow_up_at TIMESTAMPTZ,
  follow_up_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique ticket_id per customer
  UNIQUE(customer_id, ticket_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_support_satisfaction_customer ON support_satisfaction(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_satisfaction_rating ON support_satisfaction(rating);
CREATE INDEX IF NOT EXISTS idx_support_satisfaction_created ON support_satisfaction(created_at);
CREATE INDEX IF NOT EXISTS idx_support_satisfaction_poor_ratings ON support_satisfaction(customer_id, rating) WHERE rating <= 2;

-- ================================================
-- SUPPORT SATISFACTION TRENDS TABLE
-- Stores calculated trends for monitoring
-- ================================================
CREATE TABLE IF NOT EXISTS support_satisfaction_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  average_csat DECIMAL(3,2),
  response_count INTEGER DEFAULT 0,
  poor_rating_count INTEGER DEFAULT 0,
  recent_average DECIMAL(3,2),  -- Last 30 days
  previous_average DECIMAL(3,2), -- 30-60 days ago
  trend_direction VARCHAR(20), -- 'improving', 'stable', 'declining', 'critical'
  trend_percentage DECIMAL(5,2),
  last_poor_rating_at TIMESTAMPTZ,
  poor_ratings_last_30_days INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_satisfaction_trends_customer ON support_satisfaction_trends(customer_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_trends_direction ON support_satisfaction_trends(trend_direction);

-- ================================================
-- SUPPORT SATISFACTION ALERTS TABLE
-- Tracks alerts generated for satisfaction issues
-- ================================================
CREATE TABLE IF NOT EXISTS support_satisfaction_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  satisfaction_id UUID REFERENCES support_satisfaction(id) ON DELETE SET NULL,
  alert_type VARCHAR(50) NOT NULL, -- 'poor_rating', 'trend_decline', 'repeat_dissatisfaction'
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  title TEXT NOT NULL,
  description TEXT,
  ticket_id TEXT,
  rating INTEGER,
  previous_avg_csat DECIMAL(3,2),
  customer_arr DECIMAL(12,2),
  metadata JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'dismissed'
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  notified_at TIMESTAMPTZ,
  notification_channel VARCHAR(50), -- 'slack', 'email', 'in_app'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_satisfaction_alerts_customer ON support_satisfaction_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_alerts_status ON support_satisfaction_alerts(status);
CREATE INDEX IF NOT EXISTS idx_satisfaction_alerts_type ON support_satisfaction_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_satisfaction_alerts_active ON support_satisfaction_alerts(status) WHERE status = 'active';

-- ================================================
-- TRIGGER: Auto-update updated_at
-- ================================================
DROP TRIGGER IF EXISTS update_support_satisfaction_updated_at ON support_satisfaction;
CREATE TRIGGER update_support_satisfaction_updated_at
  BEFORE UPDATE ON support_satisfaction
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_satisfaction_trends_updated_at ON support_satisfaction_trends;
CREATE TRIGGER update_satisfaction_trends_updated_at
  BEFORE UPDATE ON support_satisfaction_trends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_satisfaction_alerts_updated_at ON support_satisfaction_alerts;
CREATE TRIGGER update_satisfaction_alerts_updated_at
  BEFORE UPDATE ON support_satisfaction_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- VIEW: Support Satisfaction Summary
-- ================================================
CREATE OR REPLACE VIEW v_support_satisfaction_summary AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  c.arr,
  c.health_score,
  COALESCE(t.average_csat, 0) AS average_csat,
  COALESCE(t.response_count, 0) AS total_responses,
  COALESCE(t.poor_rating_count, 0) AS poor_ratings,
  COALESCE(t.recent_average, 0) AS recent_csat,
  COALESCE(t.trend_direction, 'unknown') AS trend,
  COALESCE(t.trend_percentage, 0) AS trend_change,
  t.last_poor_rating_at,
  (
    SELECT COUNT(*)
    FROM support_satisfaction_alerts a
    WHERE a.customer_id = c.id AND a.status = 'active'
  ) AS active_alerts
FROM customers c
LEFT JOIN support_satisfaction_trends t ON t.customer_id = c.id;

-- ================================================
-- FUNCTION: Calculate satisfaction trend for customer
-- ================================================
CREATE OR REPLACE FUNCTION calculate_satisfaction_trend(p_customer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_avg_csat DECIMAL(3,2);
  v_response_count INTEGER;
  v_poor_count INTEGER;
  v_recent_avg DECIMAL(3,2);
  v_prev_avg DECIMAL(3,2);
  v_trend VARCHAR(20);
  v_trend_pct DECIMAL(5,2);
  v_last_poor TIMESTAMPTZ;
  v_poor_30d INTEGER;
BEGIN
  -- Overall average
  SELECT
    AVG(rating)::DECIMAL(3,2),
    COUNT(*),
    COUNT(*) FILTER (WHERE rating <= 2)
  INTO v_avg_csat, v_response_count, v_poor_count
  FROM support_satisfaction
  WHERE customer_id = p_customer_id;

  -- Recent 30 days average
  SELECT AVG(rating)::DECIMAL(3,2)
  INTO v_recent_avg
  FROM support_satisfaction
  WHERE customer_id = p_customer_id
    AND created_at >= NOW() - INTERVAL '30 days';

  -- Previous 30-60 days average
  SELECT AVG(rating)::DECIMAL(3,2)
  INTO v_prev_avg
  FROM support_satisfaction
  WHERE customer_id = p_customer_id
    AND created_at >= NOW() - INTERVAL '60 days'
    AND created_at < NOW() - INTERVAL '30 days';

  -- Last poor rating
  SELECT MAX(created_at)
  INTO v_last_poor
  FROM support_satisfaction
  WHERE customer_id = p_customer_id AND rating <= 2;

  -- Poor ratings in last 30 days
  SELECT COUNT(*)
  INTO v_poor_30d
  FROM support_satisfaction
  WHERE customer_id = p_customer_id
    AND rating <= 2
    AND created_at >= NOW() - INTERVAL '30 days';

  -- Calculate trend
  IF v_prev_avg IS NULL OR v_prev_avg = 0 THEN
    v_trend := 'stable';
    v_trend_pct := 0;
  ELSE
    v_trend_pct := ((v_recent_avg - v_prev_avg) / v_prev_avg * 100)::DECIMAL(5,2);

    IF v_trend_pct <= -20 THEN
      v_trend := 'critical';
    ELSIF v_trend_pct < -10 THEN
      v_trend := 'declining';
    ELSIF v_trend_pct > 10 THEN
      v_trend := 'improving';
    ELSE
      v_trend := 'stable';
    END IF;
  END IF;

  -- Upsert trend record
  INSERT INTO support_satisfaction_trends (
    customer_id, average_csat, response_count, poor_rating_count,
    recent_average, previous_average, trend_direction, trend_percentage,
    last_poor_rating_at, poor_ratings_last_30_days, calculated_at
  ) VALUES (
    p_customer_id, v_avg_csat, v_response_count, v_poor_count,
    v_recent_avg, v_prev_avg, v_trend, v_trend_pct,
    v_last_poor, v_poor_30d, NOW()
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    average_csat = EXCLUDED.average_csat,
    response_count = EXCLUDED.response_count,
    poor_rating_count = EXCLUDED.poor_rating_count,
    recent_average = EXCLUDED.recent_average,
    previous_average = EXCLUDED.previous_average,
    trend_direction = EXCLUDED.trend_direction,
    trend_percentage = EXCLUDED.trend_percentage,
    last_poor_rating_at = EXCLUDED.last_poor_rating_at,
    poor_ratings_last_30_days = EXCLUDED.poor_ratings_last_30_days,
    calculated_at = NOW();
END;
$$ LANGUAGE plpgsql;
