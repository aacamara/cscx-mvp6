-- Migration: 029_login_pattern_change.sql
-- Description: PRD-100 - Login Pattern Change Alert
-- Created: 2026-01-29

-- ============================================
-- USER LOGIN PATTERNS TABLE
-- ============================================
-- Tracks login patterns per user per customer
-- Used for detecting frequency changes that signal disengagement

CREATE TABLE IF NOT EXISTS user_login_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_email TEXT,
  user_name TEXT,
  user_role TEXT,
  is_power_user BOOLEAN DEFAULT false,

  -- Login frequency categorization
  historical_frequency VARCHAR(20) CHECK (historical_frequency IN ('daily', 'weekly', 'monthly', 'inactive')),
  current_frequency VARCHAR(20) CHECK (current_frequency IN ('daily', 'weekly', 'monthly', 'inactive')),

  -- Login tracking
  last_login_at TIMESTAMPTZ,
  days_since_login INTEGER DEFAULT 0,
  login_count_30d INTEGER DEFAULT 0,
  login_count_7d INTEGER DEFAULT 0,

  -- Pattern change detection
  pattern_changed_at TIMESTAMPTZ,
  pattern_change_type VARCHAR(50) CHECK (pattern_change_type IN ('downgraded', 'stopped', 'resumed', 'improved', NULL)),

  -- Metrics
  avg_logins_per_week_historical DECIMAL(5,2) DEFAULT 0,
  avg_logins_per_week_current DECIMAL(5,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id, user_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_login_patterns_customer
  ON user_login_patterns(customer_id);

CREATE INDEX IF NOT EXISTS idx_user_login_patterns_last_login
  ON user_login_patterns(last_login_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_login_patterns_power_users
  ON user_login_patterns(customer_id, is_power_user)
  WHERE is_power_user = true;

CREATE INDEX IF NOT EXISTS idx_user_login_patterns_changed
  ON user_login_patterns(pattern_changed_at DESC)
  WHERE pattern_change_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_login_patterns_inactive
  ON user_login_patterns(customer_id, days_since_login)
  WHERE days_since_login >= 14;

-- ============================================
-- LOGIN PATTERN CHANGE ALERTS TABLE
-- ============================================
-- Stores detected login pattern change alerts

CREATE TABLE IF NOT EXISTS login_pattern_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Alert classification
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
    'individual_downgrade',      -- Single user frequency downgrade
    'individual_stopped',        -- Single user stopped logging in (14+ days)
    'power_user_disengagement', -- Power user reducing activity
    'account_level_decline',    -- Overall account login decline >30%
    'bulk_downgrade'            -- Multiple users downgraded
  )),

  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),

  -- Metrics
  total_users INTEGER,
  affected_users INTEGER,
  previous_avg_logins_per_week DECIMAL(10,2),
  current_avg_logins_per_week DECIMAL(10,2),
  change_percent DECIMAL(5,2),

  -- Affected users list (JSON array)
  affected_user_details JSONB DEFAULT '[]',

  -- Account context
  account_context JSONB DEFAULT '{}',

  -- Suggested actions
  suggested_actions JSONB DEFAULT '[]',

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  detected_at TIMESTAMPTZ DEFAULT NOW(),
  cooldown_expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for login pattern alerts
CREATE INDEX IF NOT EXISTS idx_login_pattern_alerts_customer
  ON login_pattern_alerts(customer_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_pattern_alerts_status
  ON login_pattern_alerts(status)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_login_pattern_alerts_severity
  ON login_pattern_alerts(severity, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_pattern_alerts_cooldown
  ON login_pattern_alerts(customer_id, cooldown_expires_at);

-- ============================================
-- UPDATE TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS update_user_login_patterns_updated_at ON user_login_patterns;
CREATE TRIGGER update_user_login_patterns_updated_at
  BEFORE UPDATE ON user_login_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_login_pattern_alerts_updated_at ON login_pattern_alerts;
CREATE TRIGGER update_login_pattern_alerts_updated_at
  BEFORE UPDATE ON login_pattern_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS FOR LOGIN PATTERN ANALYSIS
-- ============================================

-- Function to calculate login frequency category
CREATE OR REPLACE FUNCTION calculate_login_frequency(logins_per_week DECIMAL)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF logins_per_week >= 4 THEN
    RETURN 'daily';
  ELSIF logins_per_week >= 1 THEN
    RETURN 'weekly';
  ELSIF logins_per_week >= 0.25 THEN
    RETURN 'monthly';
  ELSE
    RETURN 'inactive';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update user login patterns from usage events
CREATE OR REPLACE FUNCTION update_user_login_pattern(
  p_customer_id UUID,
  p_user_id TEXT,
  p_user_email TEXT DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL,
  p_is_power_user BOOLEAN DEFAULT false
)
RETURNS user_login_patterns AS $$
DECLARE
  v_result user_login_patterns;
  v_now TIMESTAMPTZ := NOW();
  v_30_days_ago TIMESTAMPTZ := v_now - INTERVAL '30 days';
  v_7_days_ago TIMESTAMPTZ := v_now - INTERVAL '7 days';
  v_14_days_ago TIMESTAMPTZ := v_now - INTERVAL '14 days';
  v_login_count_30d INTEGER;
  v_login_count_7d INTEGER;
  v_historical_logins_per_week DECIMAL(5,2);
  v_current_logins_per_week DECIMAL(5,2);
  v_historical_frequency VARCHAR(20);
  v_current_frequency VARCHAR(20);
  v_existing_frequency VARCHAR(20);
BEGIN
  -- Count logins in last 30 days
  SELECT COUNT(*) INTO v_login_count_30d
  FROM usage_events
  WHERE customer_id = p_customer_id
    AND user_id = p_user_id
    AND event_type = 'login'
    AND timestamp >= v_30_days_ago;

  -- Count logins in last 7 days
  SELECT COUNT(*) INTO v_login_count_7d
  FROM usage_events
  WHERE customer_id = p_customer_id
    AND user_id = p_user_id
    AND event_type = 'login'
    AND timestamp >= v_7_days_ago;

  -- Calculate logins per week
  v_historical_logins_per_week := v_login_count_30d::DECIMAL / 4.0;
  v_current_logins_per_week := v_login_count_7d::DECIMAL;

  -- Calculate frequencies
  v_historical_frequency := calculate_login_frequency(v_historical_logins_per_week);
  v_current_frequency := calculate_login_frequency(v_current_logins_per_week);

  -- Get existing frequency for comparison
  SELECT current_frequency INTO v_existing_frequency
  FROM user_login_patterns
  WHERE customer_id = p_customer_id AND user_id = p_user_id;

  -- Upsert the pattern record
  INSERT INTO user_login_patterns (
    customer_id,
    user_id,
    user_email,
    user_name,
    user_role,
    is_power_user,
    historical_frequency,
    current_frequency,
    last_login_at,
    days_since_login,
    login_count_30d,
    login_count_7d,
    avg_logins_per_week_historical,
    avg_logins_per_week_current,
    pattern_changed_at,
    pattern_change_type
  )
  VALUES (
    p_customer_id,
    p_user_id,
    COALESCE(p_user_email, ''),
    COALESCE(p_user_name, ''),
    COALESCE(p_user_role, ''),
    p_is_power_user,
    v_historical_frequency,
    v_current_frequency,
    v_now,
    0,
    v_login_count_30d,
    v_login_count_7d,
    v_historical_logins_per_week,
    v_current_logins_per_week,
    CASE WHEN v_existing_frequency IS NOT NULL AND v_existing_frequency != v_current_frequency
         THEN v_now ELSE NULL END,
    CASE
      WHEN v_existing_frequency IS NULL THEN NULL
      WHEN v_existing_frequency = 'inactive' AND v_current_frequency != 'inactive' THEN 'resumed'
      WHEN v_current_frequency = 'inactive' THEN 'stopped'
      WHEN v_current_frequency < v_existing_frequency THEN 'downgraded'
      WHEN v_current_frequency > v_existing_frequency THEN 'improved'
      ELSE NULL
    END
  )
  ON CONFLICT (customer_id, user_id)
  DO UPDATE SET
    user_email = COALESCE(EXCLUDED.user_email, user_login_patterns.user_email),
    user_name = COALESCE(EXCLUDED.user_name, user_login_patterns.user_name),
    user_role = COALESCE(EXCLUDED.user_role, user_login_patterns.user_role),
    is_power_user = COALESCE(p_is_power_user, user_login_patterns.is_power_user),
    historical_frequency = EXCLUDED.historical_frequency,
    current_frequency = EXCLUDED.current_frequency,
    last_login_at = EXCLUDED.last_login_at,
    days_since_login = 0,
    login_count_30d = EXCLUDED.login_count_30d,
    login_count_7d = EXCLUDED.login_count_7d,
    avg_logins_per_week_historical = EXCLUDED.avg_logins_per_week_historical,
    avg_logins_per_week_current = EXCLUDED.avg_logins_per_week_current,
    pattern_changed_at = CASE
      WHEN user_login_patterns.current_frequency != EXCLUDED.current_frequency
      THEN v_now
      ELSE user_login_patterns.pattern_changed_at
    END,
    pattern_change_type = CASE
      WHEN user_login_patterns.current_frequency = EXCLUDED.current_frequency THEN user_login_patterns.pattern_change_type
      WHEN user_login_patterns.current_frequency = 'inactive' AND EXCLUDED.current_frequency != 'inactive' THEN 'resumed'
      WHEN EXCLUDED.current_frequency = 'inactive' THEN 'stopped'
      WHEN EXCLUDED.current_frequency < user_login_patterns.current_frequency THEN 'downgraded'
      WHEN EXCLUDED.current_frequency > user_login_patterns.current_frequency THEN 'improved'
      ELSE NULL
    END,
    updated_at = v_now
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to update days_since_login for all users (run daily)
CREATE OR REPLACE FUNCTION update_all_days_since_login()
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE user_login_patterns
  SET
    days_since_login = EXTRACT(DAY FROM (NOW() - COALESCE(last_login_at, created_at)))::INTEGER,
    current_frequency = CASE
      WHEN EXTRACT(DAY FROM (NOW() - COALESCE(last_login_at, created_at))) >= 30 THEN 'inactive'
      ELSE current_frequency
    END,
    pattern_change_type = CASE
      WHEN current_frequency != 'inactive' AND EXTRACT(DAY FROM (NOW() - COALESCE(last_login_at, created_at))) >= 30 THEN 'stopped'
      ELSE pattern_change_type
    END,
    pattern_changed_at = CASE
      WHEN current_frequency != 'inactive' AND EXTRACT(DAY FROM (NOW() - COALESCE(last_login_at, created_at))) >= 30 THEN NOW()
      ELSE pattern_changed_at
    END,
    updated_at = NOW();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE user_login_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_pattern_alerts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view login patterns
CREATE POLICY "Users can view login patterns"
  ON user_login_patterns FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage login patterns
CREATE POLICY "Users can manage login patterns"
  ON user_login_patterns FOR ALL
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to view alerts
CREATE POLICY "Users can view login pattern alerts"
  ON login_pattern_alerts FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage alerts
CREATE POLICY "Users can manage login pattern alerts"
  ON login_pattern_alerts FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE user_login_patterns IS 'PRD-100: Tracks login patterns per user per customer for detecting behavioral changes';
COMMENT ON TABLE login_pattern_alerts IS 'PRD-100: Stores detected login pattern change alerts';
COMMENT ON FUNCTION calculate_login_frequency IS 'Categorizes logins per week into daily/weekly/monthly/inactive';
COMMENT ON FUNCTION update_user_login_pattern IS 'Updates or creates a user login pattern record based on usage events';
COMMENT ON FUNCTION update_all_days_since_login IS 'Daily job to update days_since_login for all users';
