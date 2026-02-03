-- PRD-107: Health Score Threshold Alert
-- Migration for health score zone tracking and threshold-based alerting

-- ============================================
-- Health Score Alert Configuration
-- ============================================

-- Allow custom threshold configurations per segment
CREATE TABLE IF NOT EXISTS health_score_alert_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  segment_filter JSONB DEFAULT '{}', -- {"arr_min": 50000, "arr_max": null, "stage": "active"}
  thresholds JSONB NOT NULL DEFAULT '{
    "zones": {
      "healthy": {"min": 71, "max": 100, "color": "green"},
      "at_risk": {"min": 50, "max": 70, "color": "yellow"},
      "critical": {"min": 0, "max": 49, "color": "red"}
    },
    "rapid_decline_threshold": 15,
    "rapid_decline_window_days": 7,
    "recovery_enabled": true
  }',
  enabled BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_alert_configs_enabled ON health_score_alert_configs(enabled);

-- ============================================
-- Health Score Alerts Table
-- ============================================

CREATE TABLE IF NOT EXISTS health_score_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- 'zone_entry_at_risk', 'zone_entry_critical', 'rapid_decline', 'recovery'
  severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'

  -- Score details
  current_score INTEGER NOT NULL CHECK (current_score >= 0 AND current_score <= 100),
  previous_score INTEGER CHECK (previous_score >= 0 AND previous_score <= 100),
  score_change INTEGER, -- Computed: current - previous
  previous_zone VARCHAR(20), -- 'healthy', 'at_risk', 'critical'
  current_zone VARCHAR(20) NOT NULL, -- 'healthy', 'at_risk', 'critical'

  -- Score breakdown
  score_components JSONB DEFAULT '{}', -- {"usage": 35, "engagement": 55, "risk": 80, "business": 65}
  score_component_changes JSONB DEFAULT '{}', -- {"usage": -20, "engagement": -12, "risk": -5, "business": 0}

  -- Primary drivers
  primary_drivers JSONB DEFAULT '[]', -- [{"type": "usage_drop", "description": "DAU dropped 50%", "severity": "high"}]

  -- Context
  days_since_previous_score INTEGER,
  account_context JSONB DEFAULT '{}', -- {"arr": 180000, "days_to_renewal": 75, "segment": "enterprise"}

  -- Suggested actions
  recommended_actions JSONB DEFAULT '[]', -- [{"action": "outreach", "description": "Immediate outreach to champion"}]
  suggested_playbook_id UUID,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'acknowledged', 'in_progress', 'resolved', 'ignored'
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,

  -- Manager notification
  manager_notified BOOLEAN DEFAULT FALSE,
  manager_notified_at TIMESTAMPTZ,

  -- Task creation
  task_created BOOLEAN DEFAULT FALSE,
  task_id UUID,

  -- Notification tracking
  slack_notification_sent BOOLEAN DEFAULT FALSE,
  email_notification_sent BOOLEAN DEFAULT FALSE,
  in_app_notification_id UUID,

  -- Config reference
  config_id UUID REFERENCES health_score_alert_configs(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_alerts_customer ON health_score_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_health_alerts_type ON health_score_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_health_alerts_severity ON health_score_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_health_alerts_status ON health_score_alerts(status);
CREATE INDEX IF NOT EXISTS idx_health_alerts_created ON health_score_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_alerts_customer_zone ON health_score_alerts(customer_id, current_zone);

-- ============================================
-- Add zone tracking to customers table
-- ============================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS health_zone VARCHAR(20) DEFAULT 'healthy';
-- Values: 'healthy', 'at_risk', 'critical'

ALTER TABLE customers ADD COLUMN IF NOT EXISTS health_zone_changed_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS previous_health_zone VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS health_score_7d_ago INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consecutive_decline_days INTEGER DEFAULT 0;

-- ============================================
-- Health Score Alert Statistics
-- ============================================

CREATE TABLE IF NOT EXISTS health_score_alert_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_date DATE NOT NULL,
  total_alerts INTEGER DEFAULT 0,
  alerts_by_type JSONB DEFAULT '{}', -- {"zone_entry_at_risk": 5, "zone_entry_critical": 2, "rapid_decline": 3}
  alerts_by_severity JSONB DEFAULT '{}', -- {"high": 5, "critical": 2, "medium": 3}
  resolved_within_24h INTEGER DEFAULT 0,
  avg_resolution_hours DECIMAL(10, 2),
  recovery_rate DECIMAL(5, 2), -- Percentage of at-risk that recovered
  total_arr_at_risk DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_date)
);

CREATE INDEX IF NOT EXISTS idx_health_alert_stats_date ON health_score_alert_stats(period_date DESC);

-- ============================================
-- Functions
-- ============================================

-- Function to determine health zone from score
CREATE OR REPLACE FUNCTION get_health_zone(score INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF score >= 71 THEN
    RETURN 'healthy';
  ELSIF score >= 50 THEN
    RETURN 'at_risk';
  ELSE
    RETURN 'critical';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get zone severity
CREATE OR REPLACE FUNCTION get_zone_severity(zone VARCHAR(20))
RETURNS VARCHAR(20) AS $$
BEGIN
  CASE zone
    WHEN 'critical' THEN RETURN 'critical';
    WHEN 'at_risk' THEN RETURN 'high';
    ELSE RETURN 'medium';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to evaluate health score thresholds
CREATE OR REPLACE FUNCTION evaluate_health_score_threshold(
  p_customer_id UUID,
  p_current_score INTEGER,
  p_previous_score INTEGER,
  p_score_components JSONB DEFAULT '{}',
  p_days_since_previous INTEGER DEFAULT 1
) RETURNS TABLE (
  should_alert BOOLEAN,
  alert_type VARCHAR(50),
  severity VARCHAR(20),
  current_zone VARCHAR(20),
  previous_zone VARCHAR(20),
  score_change INTEGER,
  is_rapid_decline BOOLEAN
) AS $$
DECLARE
  v_current_zone VARCHAR(20);
  v_previous_zone VARCHAR(20);
  v_score_change INTEGER;
  v_is_rapid_decline BOOLEAN := FALSE;
  v_should_alert BOOLEAN := FALSE;
  v_alert_type VARCHAR(50) := NULL;
  v_severity VARCHAR(20) := 'medium';
BEGIN
  -- Calculate zones
  v_current_zone := get_health_zone(p_current_score);
  v_previous_zone := get_health_zone(COALESCE(p_previous_score, p_current_score));
  v_score_change := COALESCE(p_previous_score, p_current_score) - p_current_score;

  -- Check for rapid decline (>15 points in 7 days)
  IF v_score_change >= 15 AND p_days_since_previous <= 7 THEN
    v_is_rapid_decline := TRUE;
  END IF;

  -- Determine alert type
  -- Zone entry to at_risk
  IF v_previous_zone = 'healthy' AND v_current_zone = 'at_risk' THEN
    v_should_alert := TRUE;
    v_alert_type := 'zone_entry_at_risk';
    v_severity := 'high';
  -- Zone entry to critical
  ELSIF (v_previous_zone = 'healthy' OR v_previous_zone = 'at_risk') AND v_current_zone = 'critical' THEN
    v_should_alert := TRUE;
    v_alert_type := 'zone_entry_critical';
    v_severity := 'critical';
  -- Rapid decline (regardless of zone change)
  ELSIF v_is_rapid_decline THEN
    v_should_alert := TRUE;
    v_alert_type := 'rapid_decline';
    v_severity := CASE
      WHEN v_current_zone = 'critical' THEN 'critical'
      WHEN v_current_zone = 'at_risk' THEN 'high'
      ELSE 'medium'
    END;
  -- Recovery alert (moved from at_risk/critical to healthy)
  ELSIF (v_previous_zone = 'at_risk' OR v_previous_zone = 'critical') AND v_current_zone = 'healthy' THEN
    v_should_alert := TRUE;
    v_alert_type := 'recovery';
    v_severity := 'low';
  END IF;

  RETURN QUERY SELECT
    v_should_alert,
    v_alert_type,
    v_severity,
    v_current_zone,
    v_previous_zone,
    v_score_change,
    v_is_rapid_decline;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_health_alert_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_health_alerts_timestamp ON health_score_alerts;
CREATE TRIGGER update_health_alerts_timestamp
  BEFORE UPDATE ON health_score_alerts
  FOR EACH ROW EXECUTE FUNCTION update_health_alert_timestamp();

DROP TRIGGER IF EXISTS update_health_alert_configs_timestamp ON health_score_alert_configs;
CREATE TRIGGER update_health_alert_configs_timestamp
  BEFORE UPDATE ON health_score_alert_configs
  FOR EACH ROW EXECUTE FUNCTION update_health_alert_timestamp();

-- ============================================
-- Insert Default Configuration
-- ============================================

INSERT INTO health_score_alert_configs (
  name,
  description,
  segment_filter,
  thresholds,
  enabled
) VALUES (
  'Default Health Score Thresholds',
  'Standard health score zones and alert thresholds for all customers',
  '{}',
  '{
    "zones": {
      "healthy": {"min": 71, "max": 100, "color": "green"},
      "at_risk": {"min": 50, "max": 70, "color": "yellow"},
      "critical": {"min": 0, "max": 49, "color": "red"}
    },
    "rapid_decline_threshold": 15,
    "rapid_decline_window_days": 7,
    "recovery_enabled": true,
    "manager_notification_threshold": "critical",
    "task_creation": {
      "enabled": true,
      "due_hours": {
        "critical": 4,
        "high": 24,
        "medium": 48
      }
    }
  }',
  TRUE
) ON CONFLICT DO NOTHING;

-- ============================================
-- Grant Permissions
-- ============================================

GRANT ALL ON health_score_alert_configs TO authenticated;
GRANT ALL ON health_score_alerts TO authenticated;
GRANT ALL ON health_score_alert_stats TO authenticated;
