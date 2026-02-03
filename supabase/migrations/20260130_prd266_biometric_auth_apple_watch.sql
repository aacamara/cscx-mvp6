-- PRD-266: Apple Watch Integration & Biometric Authentication
-- Database schema for device management, biometric credentials, and watch sync

-- ============================================
-- Device Registrations
-- ============================================

CREATE TABLE IF NOT EXISTS device_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_token TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('iphone', 'apple_watch', 'ipad', 'android', 'android_wear')),
  os_version TEXT,
  app_version TEXT,
  push_token TEXT,
  paired_watch_id TEXT,
  biometric_enabled BOOLEAN DEFAULT false,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only register one instance of each device
  UNIQUE(user_id, device_id)
);

-- Indexes for device lookups
CREATE INDEX IF NOT EXISTS idx_device_registrations_user_id ON device_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_device_registrations_device_id ON device_registrations(device_id);
CREATE INDEX IF NOT EXISTS idx_device_registrations_device_type ON device_registrations(device_type);
CREATE INDEX IF NOT EXISTS idx_device_registrations_push_token ON device_registrations(push_token) WHERE push_token IS NOT NULL;

-- ============================================
-- Biometric Credentials (WebAuthn/Passkey style)
-- ============================================

CREATE TABLE IF NOT EXISTS biometric_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('iphone', 'apple_watch', 'ipad', 'android', 'android_wear')),
  authenticator_type VARCHAR(20) NOT NULL CHECK (authenticator_type IN ('face_id', 'touch_id', 'passcode', 'pin', 'pattern')),
  counter INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,

  -- Each credential ID should be unique
  UNIQUE(credential_id)
);

-- Indexes for credential lookups
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_user_id ON biometric_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_device_id ON biometric_credentials(device_id);
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_credential_id ON biometric_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_active ON biometric_credentials(user_id, is_active) WHERE is_active = true;

-- ============================================
-- Mobile Sessions
-- ============================================

CREATE TABLE IF NOT EXISTS mobile_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Indexes for session lookups
CREATE INDEX IF NOT EXISTS idx_mobile_sessions_token_hash ON mobile_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_mobile_sessions_refresh_token ON mobile_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_mobile_sessions_user_device ON mobile_sessions(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_mobile_sessions_expires ON mobile_sessions(expires_at);

-- ============================================
-- Apple Watch Pairings
-- ============================================

CREATE TABLE IF NOT EXISTS watch_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  iphone_device_id TEXT NOT NULL,
  watch_device_id TEXT NOT NULL UNIQUE,
  watch_name TEXT NOT NULL,
  watch_os_version TEXT,
  paired_at TIMESTAMPTZ DEFAULT NOW(),
  unpaired_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,

  -- Each watch can only be paired to one iPhone at a time
  UNIQUE(user_id, watch_device_id)
);

-- Indexes for pairing lookups
CREATE INDEX IF NOT EXISTS idx_watch_pairings_user_id ON watch_pairings(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_pairings_iphone ON watch_pairings(iphone_device_id);
CREATE INDEX IF NOT EXISTS idx_watch_pairings_watch ON watch_pairings(watch_device_id);
CREATE INDEX IF NOT EXISTS idx_watch_pairings_active ON watch_pairings(user_id, is_active) WHERE is_active = true;

-- ============================================
-- Watch Complication Cache
-- ============================================

CREATE TABLE IF NOT EXISTS watch_complication_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  complication_type VARCHAR(20) NOT NULL CHECK (complication_type IN ('circular', 'rectangular', 'corner', 'inline', 'graphic')),
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One cache entry per user per complication type
  UNIQUE(user_id, complication_type)
);

-- Index for complication lookups
CREATE INDEX IF NOT EXISTS idx_watch_complication_cache_user_type ON watch_complication_cache(user_id, complication_type);

-- ============================================
-- Health Score History (for trend calculations)
-- ============================================

-- Add health_score_history if it doesn't exist (may already exist from other PRDs)
CREATE TABLE IF NOT EXISTS health_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  customer_id UUID,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  score_type VARCHAR(20) DEFAULT 'portfolio' CHECK (score_type IN ('portfolio', 'customer')),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_score_history_user_date ON health_score_history(user_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_health_score_history_customer ON health_score_history(customer_id) WHERE customer_id IS NOT NULL;

-- ============================================
-- Notes table enhancement (for watch quick notes)
-- ============================================

-- Ensure notes table has the source column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'source'
  ) THEN
    ALTER TABLE notes ADD COLUMN source VARCHAR(30) DEFAULT 'web';
  END IF;
END $$;

-- Ensure notes table has metadata column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notes ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

-- ============================================
-- Tasks table enhancements
-- ============================================

-- Add completion tracking columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'completion_source'
  ) THEN
    ALTER TABLE tasks ADD COLUMN completion_source VARCHAR(30);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================
-- Pending Approvals enhancements
-- ============================================

-- Add resolution tracking columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_approvals' AND column_name = 'resolution_source'
  ) THEN
    ALTER TABLE pending_approvals ADD COLUMN resolution_source VARCHAR(30);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_approvals' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE pending_approvals ADD COLUMN rejection_reason TEXT;
  END IF;
END $$;

-- ============================================
-- Reminders table (for snooze functionality)
-- ============================================

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  title TEXT NOT NULL,
  description TEXT,
  remind_at TIMESTAMPTZ NOT NULL,
  snooze_count INTEGER DEFAULT 0,
  last_snoozed_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user_remind ON reminders(user_id, remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders(user_id, completed, remind_at) WHERE completed = false;

-- ============================================
-- Triggers for updated_at
-- ============================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_device_registrations_updated_at ON device_registrations;
CREATE TRIGGER update_device_registrations_updated_at
  BEFORE UPDATE ON device_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_watch_complication_cache_updated_at ON watch_complication_cache;
CREATE TRIGGER update_watch_complication_cache_updated_at
  BEFORE UPDATE ON watch_complication_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_complication_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- User policies for device_registrations
CREATE POLICY "Users can view own devices" ON device_registrations
  FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can manage own devices" ON device_registrations
  FOR ALL USING (auth.uid()::TEXT = user_id);

-- User policies for biometric_credentials
CREATE POLICY "Users can view own credentials" ON biometric_credentials
  FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can manage own credentials" ON biometric_credentials
  FOR ALL USING (auth.uid()::TEXT = user_id);

-- User policies for mobile_sessions
CREATE POLICY "Users can view own sessions" ON mobile_sessions
  FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can manage own sessions" ON mobile_sessions
  FOR ALL USING (auth.uid()::TEXT = user_id);

-- User policies for watch_pairings
CREATE POLICY "Users can view own pairings" ON watch_pairings
  FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can manage own pairings" ON watch_pairings
  FOR ALL USING (auth.uid()::TEXT = user_id);

-- User policies for watch_complication_cache
CREATE POLICY "Users can view own cache" ON watch_complication_cache
  FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can manage own cache" ON watch_complication_cache
  FOR ALL USING (auth.uid()::TEXT = user_id);

-- User policies for health_score_history
CREATE POLICY "Users can view own history" ON health_score_history
  FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can manage own history" ON health_score_history
  FOR ALL USING (auth.uid()::TEXT = user_id);

-- User policies for reminders
CREATE POLICY "Users can view own reminders" ON reminders
  FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can manage own reminders" ON reminders
  FOR ALL USING (auth.uid()::TEXT = user_id);

-- Service role bypass policies
CREATE POLICY "Service role full access to device_registrations" ON device_registrations
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to biometric_credentials" ON biometric_credentials
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to mobile_sessions" ON mobile_sessions
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to watch_pairings" ON watch_pairings
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to watch_complication_cache" ON watch_complication_cache
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to health_score_history" ON health_score_history
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to reminders" ON reminders
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON TABLE device_registrations IS 'Mobile device registrations for CSCX apps (PRD-266)';
COMMENT ON TABLE biometric_credentials IS 'WebAuthn/passkey style biometric credentials for mobile auth (PRD-266)';
COMMENT ON TABLE mobile_sessions IS 'Session tokens for authenticated mobile devices (PRD-266)';
COMMENT ON TABLE watch_pairings IS 'Apple Watch to iPhone pairing relationships (PRD-266)';
COMMENT ON TABLE watch_complication_cache IS 'Cached data for Apple Watch complications (PRD-266)';
COMMENT ON TABLE health_score_history IS 'Historical health scores for trend analysis (PRD-266)';
COMMENT ON TABLE reminders IS 'User reminders with snooze support (PRD-266)';
