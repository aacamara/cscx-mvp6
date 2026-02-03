-- Migration: Zoom Meeting Management Tables
-- PRD-209: Zoom Meeting Management - Store Zoom meeting data with customer linking

-- Zoom connections table (for OAuth storage)
CREATE TABLE IF NOT EXISTS zoom_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) UNIQUE NOT NULL,
  zoom_user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  account_id VARCHAR(255),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT[] DEFAULT '{}',
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for zoom connections
CREATE INDEX IF NOT EXISTS idx_zoom_connections_user ON zoom_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_zoom_connections_email ON zoom_connections(email);

-- Zoom meetings table - links Zoom meetings to internal meetings/customers
CREATE TABLE IF NOT EXISTS zoom_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Zoom identifiers
  zoom_meeting_id BIGINT UNIQUE NOT NULL,
  zoom_uuid VARCHAR(255),

  -- Meeting details
  topic VARCHAR(500),
  agenda TEXT,
  meeting_type INTEGER, -- 1=instant, 2=scheduled, 3=recurring, 8=recurring_fixed
  start_time TIMESTAMPTZ,
  scheduled_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  timezone VARCHAR(50),
  status VARCHAR(50), -- 'waiting', 'started', 'ended'

  -- Host and join info
  host_email VARCHAR(255),
  host_id VARCHAR(255),
  join_url TEXT,
  start_url TEXT,

  -- Recording info
  recording_url TEXT,
  recording_download_url TEXT,
  recording_file_size BIGINT,
  recording_duration_minutes INTEGER,
  recording_expires_at TIMESTAMPTZ,
  has_transcript BOOLEAN DEFAULT FALSE,

  -- Transcript info
  transcript_file_url TEXT,
  transcript_content TEXT,
  transcript_vtt TEXT,
  transcript_processed_at TIMESTAMPTZ,

  -- Meeting intelligence (from AI analysis)
  analysis_status VARCHAR(50), -- 'pending', 'processing', 'completed', 'failed'
  analysis_result_id UUID REFERENCES post_call_processing_results(id) ON DELETE SET NULL,

  -- Participant summary
  participant_count INTEGER DEFAULT 0,
  internal_participant_count INTEGER DEFAULT 0,
  external_participant_count INTEGER DEFAULT 0,
  participants JSONB DEFAULT '[]'::jsonb,

  -- Customer matching
  customer_match_method VARCHAR(50), -- 'email', 'topic', 'manual', 'none'
  customer_match_confidence DECIMAL(3, 2), -- 0.00 to 1.00

  -- Sync tracking
  synced_at TIMESTAMPTZ,
  last_updated_from_zoom TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for zoom meetings
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_customer ON zoom_meetings(customer_id);
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_user ON zoom_meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_zoom_id ON zoom_meetings(zoom_meeting_id);
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_start_time ON zoom_meetings(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_status ON zoom_meetings(status);
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_host ON zoom_meetings(host_email);
CREATE INDEX IF NOT EXISTS idx_zoom_meetings_analysis ON zoom_meetings(analysis_status);

-- Zoom participants table - tracks attendance for each meeting
CREATE TABLE IF NOT EXISTS zoom_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_meeting_id BIGINT NOT NULL,
  zoom_meetings_table_id UUID REFERENCES zoom_meetings(id) ON DELETE CASCADE,

  -- Participant info
  participant_id VARCHAR(255),
  participant_email VARCHAR(255),
  participant_name VARCHAR(255),

  -- Link to stakeholder if matched
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Participant type
  is_host BOOLEAN DEFAULT FALSE,
  is_internal BOOLEAN DEFAULT FALSE, -- Our team vs external

  -- Attendance tracking
  join_time TIMESTAMPTZ,
  leave_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  attended BOOLEAN DEFAULT TRUE,
  was_no_show BOOLEAN DEFAULT FALSE,

  -- Engagement metrics (if available from Zoom)
  attentiveness_score INTEGER, -- 0-100

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for zoom participants
CREATE INDEX IF NOT EXISTS idx_zoom_participants_meeting ON zoom_participants(zoom_meeting_id);
CREATE INDEX IF NOT EXISTS idx_zoom_participants_email ON zoom_participants(participant_email);
CREATE INDEX IF NOT EXISTS idx_zoom_participants_stakeholder ON zoom_participants(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_zoom_participants_customer ON zoom_participants(customer_id);
CREATE INDEX IF NOT EXISTS idx_zoom_participants_table_id ON zoom_participants(zoom_meetings_table_id);

-- Zoom webhook events log for audit
CREATE TABLE IF NOT EXISTS zoom_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  event_ts BIGINT,
  account_id VARCHAR(255),
  zoom_meeting_id BIGINT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for webhook events
CREATE INDEX IF NOT EXISTS idx_zoom_webhook_event_type ON zoom_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_zoom_webhook_meeting ON zoom_webhook_events(zoom_meeting_id);
CREATE INDEX IF NOT EXISTS idx_zoom_webhook_processed ON zoom_webhook_events(processed, created_at DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_zoom_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_zoom_meetings_timestamp ON zoom_meetings;
CREATE TRIGGER update_zoom_meetings_timestamp
  BEFORE UPDATE ON zoom_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_zoom_timestamp();

DROP TRIGGER IF EXISTS update_zoom_participants_timestamp ON zoom_participants;
CREATE TRIGGER update_zoom_participants_timestamp
  BEFORE UPDATE ON zoom_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_zoom_timestamp();

DROP TRIGGER IF EXISTS update_zoom_connections_timestamp ON zoom_connections;
CREATE TRIGGER update_zoom_connections_timestamp
  BEFORE UPDATE ON zoom_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_zoom_timestamp();

-- Enable RLS
ALTER TABLE zoom_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for zoom_connections
CREATE POLICY "Users can view their own zoom connections" ON zoom_connections
  FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can manage their own zoom connections" ON zoom_connections
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for zoom_meetings
CREATE POLICY "Users can view their own zoom meetings" ON zoom_meetings
  FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can manage their own zoom meetings" ON zoom_meetings
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for zoom_participants (based on meeting ownership)
CREATE POLICY "Users can view participants of their meetings" ON zoom_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM zoom_meetings zm
      WHERE zm.id = zoom_participants.zoom_meetings_table_id
      AND zm.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Service role bypass
CREATE POLICY "Service role can access all zoom data" ON zoom_connections
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "Service role can access all zoom meetings" ON zoom_meetings
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "Service role can access all zoom participants" ON zoom_participants
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "Service role can access all zoom webhook events" ON zoom_webhook_events
  FOR ALL USING (current_setting('role', true) = 'service_role');

-- Comments
COMMENT ON TABLE zoom_connections IS 'PRD-209: Stores OAuth connections to Zoom accounts';
COMMENT ON TABLE zoom_meetings IS 'PRD-209: Stores Zoom meeting data with customer linking and recording info';
COMMENT ON TABLE zoom_participants IS 'PRD-209: Tracks participant attendance and links to stakeholders';
COMMENT ON TABLE zoom_webhook_events IS 'PRD-209: Audit log for incoming Zoom webhooks';
