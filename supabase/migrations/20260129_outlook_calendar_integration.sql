-- PRD-189: Outlook Calendar Integration
-- Database schema for Microsoft OAuth tokens and calendar sync

-- Microsoft OAuth tokens table
CREATE TABLE IF NOT EXISTS microsoft_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  granted_scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  microsoft_email TEXT,
  microsoft_user_id TEXT,
  microsoft_display_name TEXT,
  tenant_id TEXT,
  is_valid BOOLEAN DEFAULT true,
  last_refresh_at TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by user
CREATE INDEX IF NOT EXISTS idx_microsoft_oauth_tokens_user_id ON microsoft_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_microsoft_oauth_tokens_email ON microsoft_oauth_tokens(microsoft_email);

-- Outlook calendar sync table (tracks synced events)
CREATE TABLE IF NOT EXISTS outlook_calendar_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  outlook_event_id TEXT NOT NULL,
  calendar_id TEXT DEFAULT 'calendar',
  subject TEXT,
  body_preview TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT,
  is_all_day BOOLEAN DEFAULT false,
  attendees JSONB DEFAULT '[]'::JSONB,
  organizer_email TEXT,
  response_status TEXT,
  teams_join_url TEXT,
  show_as TEXT DEFAULT 'busy',
  is_recurring BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_direction VARCHAR(10) DEFAULT 'inbound',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for event per user
  UNIQUE(user_id, outlook_event_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_outlook_calendar_sync_user_id ON outlook_calendar_sync(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_calendar_sync_customer_id ON outlook_calendar_sync(customer_id);
CREATE INDEX IF NOT EXISTS idx_outlook_calendar_sync_start_time ON outlook_calendar_sync(start_time);
CREATE INDEX IF NOT EXISTS idx_outlook_calendar_sync_event_id ON outlook_calendar_sync(outlook_event_id);
CREATE INDEX IF NOT EXISTS idx_outlook_calendar_sync_organizer ON outlook_calendar_sync(organizer_email);

-- Meeting metrics cache table (for health score calculations)
CREATE TABLE IF NOT EXISTS outlook_meeting_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_meetings INTEGER DEFAULT 0,
  total_duration_minutes INTEGER DEFAULT 0,
  average_duration_minutes NUMERIC(10,2) DEFAULT 0,
  meeting_frequency NUMERIC(10,4) DEFAULT 0, -- meetings per week
  attendance_rate NUMERIC(5,4) DEFAULT 0, -- 0 to 1
  last_meeting_date TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for metrics per customer per period
  UNIQUE(user_id, customer_id, period_start, period_end)
);

-- Index for metrics queries
CREATE INDEX IF NOT EXISTS idx_outlook_meeting_metrics_customer ON outlook_meeting_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_outlook_meeting_metrics_period ON outlook_meeting_metrics(period_start, period_end);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DROP TRIGGER IF EXISTS update_microsoft_oauth_tokens_updated_at ON microsoft_oauth_tokens;
CREATE TRIGGER update_microsoft_oauth_tokens_updated_at
  BEFORE UPDATE ON microsoft_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outlook_calendar_sync_updated_at ON outlook_calendar_sync;
CREATE TRIGGER update_outlook_calendar_sync_updated_at
  BEFORE UPDATE ON outlook_calendar_sync
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE microsoft_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlook_calendar_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlook_meeting_metrics ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can view own Microsoft tokens"
  ON microsoft_oauth_tokens FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own Microsoft tokens"
  ON microsoft_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own Microsoft tokens"
  ON microsoft_oauth_tokens FOR UPDATE
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete own Microsoft tokens"
  ON microsoft_oauth_tokens FOR DELETE
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can view own calendar sync"
  ON outlook_calendar_sync FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own calendar sync"
  ON outlook_calendar_sync FOR ALL
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can view own meeting metrics"
  ON outlook_meeting_metrics FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own meeting metrics"
  ON outlook_meeting_metrics FOR ALL
  USING (auth.uid()::TEXT = user_id);

-- Service role bypass for backend operations
CREATE POLICY "Service role has full access to Microsoft tokens"
  ON microsoft_oauth_tokens FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to calendar sync"
  ON outlook_calendar_sync FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to meeting metrics"
  ON outlook_meeting_metrics FOR ALL
  USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE microsoft_oauth_tokens IS 'Stores Microsoft OAuth tokens for Outlook Calendar integration (PRD-189)';
COMMENT ON TABLE outlook_calendar_sync IS 'Tracks synced Outlook calendar events for customer meeting tracking (PRD-189)';
COMMENT ON TABLE outlook_meeting_metrics IS 'Cached meeting metrics per customer for health score calculations (PRD-189)';
