-- ============================================
-- PRD: Email Integration & Summarization
-- Database schema for email storage and indexing
-- ============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- EMAILS TABLE
-- Main table for storing synced Gmail emails
-- ============================================

CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Gmail identifiers
  gmail_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,

  -- Email metadata
  subject TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[] DEFAULT '{}',
  cc_emails TEXT[] DEFAULT '{}',
  bcc_emails TEXT[] DEFAULT '{}',
  date TIMESTAMPTZ NOT NULL,

  -- Email content
  body_text TEXT,
  body_html TEXT,
  snippet TEXT, -- Gmail's snippet preview

  -- Gmail labels and flags
  labels TEXT[] DEFAULT '{}',
  is_read BOOLEAN DEFAULT TRUE,
  is_important BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  has_attachments BOOLEAN DEFAULT FALSE,

  -- AI-generated content
  summary TEXT,
  key_points JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  sentiment TEXT, -- positive, neutral, negative
  priority TEXT DEFAULT 'normal', -- high, normal, low

  -- Customer matching
  matched_by TEXT, -- 'domain', 'stakeholder', 'mention', 'manual'
  match_confidence NUMERIC(3,2), -- 0.00 to 1.00

  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per user per gmail_id
  UNIQUE(user_id, gmail_id)
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_emails_user ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_customer ON emails(customer_id);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);

-- Thread grouping
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);

-- Gmail ID lookup
CREATE INDEX IF NOT EXISTS idx_emails_gmail ON emails(gmail_id);

-- Search optimization
CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_email);
CREATE INDEX IF NOT EXISTS idx_emails_important ON emails(is_important) WHERE is_important = TRUE;
CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails(priority) WHERE priority = 'high';

-- Full text search on subject and body
CREATE INDEX IF NOT EXISTS idx_emails_subject_gin ON emails USING GIN (to_tsvector('english', COALESCE(subject, '')));
CREATE INDEX IF NOT EXISTS idx_emails_body_gin ON emails USING GIN (to_tsvector('english', COALESCE(body_text, '')));

-- Labels array search
CREATE INDEX IF NOT EXISTS idx_emails_labels ON emails USING GIN (labels);

-- ============================================
-- EMAIL SYNC STATUS TABLE
-- Track sync status per user
-- ============================================

CREATE TABLE IF NOT EXISTS email_sync_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,

  -- Connection status
  connected BOOLEAN DEFAULT FALSE,
  last_connected_at TIMESTAMPTZ,

  -- OAuth tokens (encrypted in practice)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Sync status
  last_sync_at TIMESTAMPTZ,
  last_sync_success BOOLEAN,
  last_sync_error TEXT,
  emails_synced INTEGER DEFAULT 0,

  -- Sync configuration
  sync_days INTEGER DEFAULT 30, -- How many days back to sync
  auto_sync BOOLEAN DEFAULT TRUE,

  -- Metadata
  gmail_email TEXT,
  gmail_profile JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_sync_user ON email_sync_status(user_id);
CREATE INDEX IF NOT EXISTS idx_email_sync_connected ON email_sync_status(connected) WHERE connected = TRUE;

-- ============================================
-- EMAIL THREADS TABLE
-- Group emails by thread for context
-- ============================================

CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Thread identifiers
  thread_id TEXT NOT NULL,

  -- Thread metadata
  subject TEXT,
  participant_emails TEXT[] DEFAULT '{}',
  participant_names TEXT[] DEFAULT '{}',

  -- Thread stats
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  first_message_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_response_from TEXT, -- 'customer' or 'us'
  awaiting_response BOOLEAN DEFAULT FALSE,

  -- AI summary
  thread_summary TEXT,
  topic TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, thread_id)
);

CREATE INDEX IF NOT EXISTS idx_email_threads_user ON email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_customer ON email_threads(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_active ON email_threads(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_email_threads_awaiting ON email_threads(awaiting_response) WHERE awaiting_response = TRUE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own emails
CREATE POLICY emails_user_policy ON emails
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can only access their own sync status
CREATE POLICY email_sync_user_policy ON email_sync_status
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can only access their own threads
CREATE POLICY email_threads_user_policy ON email_threads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

CREATE TRIGGER update_emails_timestamp
  BEFORE UPDATE ON emails
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_email_sync_timestamp
  BEFORE UPDATE ON email_sync_status
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_email_threads_timestamp
  BEFORE UPDATE ON email_threads
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to search emails by text
CREATE OR REPLACE FUNCTION search_emails(
  p_user_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  subject TEXT,
  from_email TEXT,
  from_name TEXT,
  date TIMESTAMPTZ,
  snippet TEXT,
  customer_id UUID,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.subject,
    e.from_email,
    e.from_name,
    e.date,
    e.snippet,
    e.customer_id,
    ts_rank(
      setweight(to_tsvector('english', COALESCE(e.subject, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(e.body_text, '')), 'B'),
      plainto_tsquery('english', p_query)
    ) as rank
  FROM emails e
  WHERE e.user_id = p_user_id
    AND (
      to_tsvector('english', COALESCE(e.subject, '')) ||
      to_tsvector('english', COALESCE(e.body_text, ''))
    ) @@ plainto_tsquery('english', p_query)
  ORDER BY rank DESC, e.date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get email priority score
CREATE OR REPLACE FUNCTION calculate_email_priority(
  p_is_important BOOLEAN,
  p_from_email TEXT,
  p_customer_health INTEGER
) RETURNS TEXT AS $$
BEGIN
  -- High priority: important flag, known customer with low health, or urgent keywords
  IF p_is_important THEN
    RETURN 'high';
  END IF;

  -- Medium priority: known customer
  IF p_customer_health IS NOT NULL AND p_customer_health < 50 THEN
    RETURN 'high';
  END IF;

  RETURN 'normal';
END;
$$ LANGUAGE plpgsql;
