-- PRD-028: Email Sequences Schema
-- Creates tables for managing email sequences, items, and runs

-- ============================================
-- EMAIL SEQUENCES
-- Stores sequence definitions/templates
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sequence_type TEXT NOT NULL DEFAULT 'welcome', -- welcome, renewal, re-engagement, expansion, custom
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, active, paused, completed, cancelled
  start_date TIMESTAMPTZ,
  total_emails INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_sequences_customer ON email_sequences(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_sequences_status ON email_sequences(status);
CREATE INDEX IF NOT EXISTS idx_email_sequences_user ON email_sequences(user_id);

-- ============================================
-- EMAIL SEQUENCE ITEMS
-- Individual emails within a sequence
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequence_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL,
  day_offset INTEGER NOT NULL, -- Days from sequence start (0 = day 1)
  send_time TIME DEFAULT '09:00:00', -- Preferred send time
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  purpose TEXT, -- welcome, kickoff_prep, resources, check_in, milestone
  to_email TEXT,
  cc_emails TEXT[],
  status TEXT NOT NULL DEFAULT 'pending', -- pending, scheduled, sent, failed, skipped
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  gmail_message_id TEXT,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_items_sequence ON email_sequence_items(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_items_status ON email_sequence_items(status);
CREATE INDEX IF NOT EXISTS idx_sequence_items_scheduled ON email_sequence_items(scheduled_at);

-- ============================================
-- EMAIL SEQUENCE RUNS
-- Tracks execution history of sequences
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequence_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
  sequence_item_id UUID REFERENCES email_sequence_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  gmail_message_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_runs_sequence ON email_sequence_runs(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_item ON email_sequence_runs(sequence_item_id);
CREATE INDEX IF NOT EXISTS idx_sequence_runs_status ON email_sequence_runs(status);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_email_sequences_timestamp
  BEFORE UPDATE ON email_sequences
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_email_sequence_items_timestamp
  BEFORE UPDATE ON email_sequence_items
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE email_sequences IS 'Stores email sequence definitions for customer communication workflows';
COMMENT ON TABLE email_sequence_items IS 'Individual emails within a sequence with scheduling and tracking';
COMMENT ON TABLE email_sequence_runs IS 'Execution history and status tracking for sequence emails';
