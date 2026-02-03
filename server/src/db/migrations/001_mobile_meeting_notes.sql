-- PRD-269: Mobile Meeting Notes
-- Database migration for mobile meeting notes feature
-- Creates tables for meeting notes, action items, and related functionality

-- ============================================
-- Mobile Meeting Notes Table
-- ============================================

CREATE TABLE IF NOT EXISTS mobile_meeting_notes (
  id TEXT PRIMARY KEY,
  meeting_id TEXT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  attendees JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  highlights JSONB DEFAULT '[]'::jsonb,
  voice_notes JSONB DEFAULT '[]'::jsonb,
  risks JSONB DEFAULT '[]'::jsonb,
  opportunities JSONB DEFAULT '[]'::jsonb,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  template_type TEXT CHECK (template_type IN ('discovery', 'qbr', 'kickoff', 'check_in', 'escalation', 'renewal', 'training', 'general')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'processing', 'completed')),
  created_by TEXT NOT NULL,
  collaborators TEXT[] DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_mobile_meeting_notes_created_by ON mobile_meeting_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_mobile_meeting_notes_customer_id ON mobile_meeting_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_mobile_meeting_notes_status ON mobile_meeting_notes(status);
CREATE INDEX IF NOT EXISTS idx_mobile_meeting_notes_started_at ON mobile_meeting_notes(started_at DESC);

-- GIN index for collaborators array search
CREATE INDEX IF NOT EXISTS idx_mobile_meeting_notes_collaborators ON mobile_meeting_notes USING GIN(collaborators);

-- ============================================
-- Calendar Events Table (for meeting detection)
-- ============================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  attendees TEXT[] DEFAULT '{}',
  location TEXT,
  source TEXT CHECK (source IN ('google', 'outlook', 'manual')),
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for meeting detection queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time ON calendar_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer_id ON calendar_events(customer_id);

-- ============================================
-- Tasks Table (if not exists)
-- For creating tasks from action items
-- ============================================

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  owner_id TEXT,
  due_date TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  source TEXT,
  source_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_customer_id ON tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- ============================================
-- Meeting Notes Processed Results
-- Stores AI-processed summaries separately for analytics
-- ============================================

CREATE TABLE IF NOT EXISTS meeting_notes_processed (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  note_id TEXT REFERENCES mobile_meeting_notes(id) ON DELETE CASCADE,
  summary TEXT,
  key_topics TEXT[] DEFAULT '{}',
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  follow_up_email TEXT,
  next_steps TEXT[] DEFAULT '{}',
  ai_extracted_action_items JSONB DEFAULT '[]'::jsonb,
  ai_extracted_risks JSONB DEFAULT '[]'::jsonb,
  ai_extracted_opportunities JSONB DEFAULT '[]'::jsonb,
  processing_time_ms INTEGER,
  model_used TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_notes_processed_note_id ON meeting_notes_processed(note_id);

-- ============================================
-- Voice Transcriptions Table
-- Stores individual voice note transcriptions
-- ============================================

CREATE TABLE IF NOT EXISTS voice_transcriptions (
  id TEXT PRIMARY KEY,
  note_id TEXT REFERENCES mobile_meeting_notes(id) ON DELETE CASCADE,
  audio_uri TEXT NOT NULL,
  transcription TEXT,
  duration_seconds INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'transcribing', 'completed', 'failed')),
  error_message TEXT,
  recorded_at TIMESTAMPTZ NOT NULL,
  transcribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_note_id ON voice_transcriptions(note_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_status ON voice_transcriptions(status);

-- ============================================
-- Offline Sync Queue
-- Tracks changes made offline for conflict resolution
-- ============================================

CREATE TABLE IF NOT EXISTS meeting_notes_sync_queue (
  id TEXT PRIMARY KEY,
  note_id TEXT REFERENCES mobile_meeting_notes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  change_timestamp TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ,
  conflict_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_note_user ON meeting_notes_sync_queue(note_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON meeting_notes_sync_queue(synced_at) WHERE synced_at IS NULL;

-- ============================================
-- Real-time Collaboration Sessions
-- Tracks active collaborators on a note
-- ============================================

CREATE TABLE IF NOT EXISTS meeting_note_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  note_id TEXT REFERENCES mobile_meeting_notes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  cursor_position INTEGER,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_note_sessions_note_id ON meeting_note_sessions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_sessions_active ON meeting_note_sessions(note_id, disconnected_at) WHERE disconnected_at IS NULL;

-- ============================================
-- Meeting Templates (user-customizable)
-- ============================================

CREATE TABLE IF NOT EXISTS meeting_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  default_topics TEXT[] DEFAULT '{}',
  suggested_duration INTEGER DEFAULT 30,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_templates_user ON meeting_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_templates_type ON meeting_templates(type);

-- ============================================
-- Insert default templates
-- ============================================

INSERT INTO meeting_templates (id, name, type, description, default_topics, suggested_duration, is_system)
VALUES
  ('tpl_discovery', 'Discovery Call', 'discovery', 'Initial call to understand customer needs and goals', ARRAY['Current challenges', 'Goals and objectives', 'Timeline', 'Budget', 'Decision makers'], 45, true),
  ('tpl_qbr', 'Quarterly Business Review', 'qbr', 'Review of progress, metrics, and strategic planning', ARRAY['Health score review', 'Usage metrics', 'ROI discussion', 'Goals for next quarter', 'Expansion opportunities'], 60, true),
  ('tpl_kickoff', 'Kickoff Meeting', 'kickoff', 'Project/implementation kickoff with new customer', ARRAY['Team introductions', 'Project scope', 'Timeline', 'Communication plan', 'Success criteria'], 60, true),
  ('tpl_check_in', 'Regular Check-in', 'check_in', 'Routine status update and relationship maintenance', ARRAY['Recent updates', 'Open issues', 'Upcoming needs', 'Feedback'], 30, true),
  ('tpl_escalation', 'Escalation Meeting', 'escalation', 'Address urgent issues or concerns', ARRAY['Issue summary', 'Impact assessment', 'Root cause', 'Resolution plan', 'Prevention measures'], 45, true),
  ('tpl_renewal', 'Renewal Discussion', 'renewal', 'Contract renewal negotiation and planning', ARRAY['Value delivered', 'Pricing discussion', 'Contract terms', 'Growth plans', 'Competitive considerations'], 45, true),
  ('tpl_training', 'Training Session', 'training', 'Product training or enablement session', ARRAY['Training objectives', 'Features covered', 'Q&A', 'Follow-up resources', 'Feedback'], 60, true),
  ('tpl_general', 'General Meeting', 'general', 'General purpose meeting notes', ARRAY[]::TEXT[], 30, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Row Level Security Policies
-- ============================================

-- Enable RLS
ALTER TABLE mobile_meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_notes_processed ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_notes_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_note_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for backend operations)
CREATE POLICY "Service role has full access to mobile_meeting_notes"
ON mobile_meeting_notes FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to calendar_events"
ON calendar_events FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to tasks"
ON tasks FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to meeting_notes_processed"
ON meeting_notes_processed FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to voice_transcriptions"
ON voice_transcriptions FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to meeting_notes_sync_queue"
ON meeting_notes_sync_queue FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to meeting_note_sessions"
ON meeting_note_sessions FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- Functions for real-time updates
-- ============================================

-- Function to update timestamp on record change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_mobile_meeting_notes_updated_at ON mobile_meeting_notes;
CREATE TRIGGER update_mobile_meeting_notes_updated_at
  BEFORE UPDATE ON mobile_meeting_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON TABLE mobile_meeting_notes IS 'PRD-269: Mobile meeting notes with voice capture, action items, and AI processing';
COMMENT ON TABLE calendar_events IS 'Calendar events synced from Google/Outlook for meeting detection';
COMMENT ON TABLE tasks IS 'Tasks created from meeting action items and other sources';
COMMENT ON TABLE meeting_notes_processed IS 'AI-processed meeting summaries and insights';
COMMENT ON TABLE voice_transcriptions IS 'Voice recordings and their transcriptions';
COMMENT ON TABLE meeting_notes_sync_queue IS 'Offline changes pending synchronization';
COMMENT ON TABLE meeting_note_sessions IS 'Active real-time collaboration sessions';
COMMENT ON TABLE meeting_templates IS 'Meeting note templates (system and user-defined)';
