-- PRD-001: CSV Upload -> Churn Analysis -> Rescue Emails
-- Migration for uploaded files, bulk operations, and risk signals tracking

-- ============================================
-- UPLOADED FILES TABLE
-- Tracks CSV and other file uploads for processing
-- ============================================
CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- File metadata
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'csv',
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,

  -- Parsing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'parsing', 'parsed', 'analyzed', 'failed')),

  -- Parsed data
  row_count INTEGER,
  column_count INTEGER,
  headers JSONB DEFAULT '[]',
  column_mapping JSONB DEFAULT '{}',
  preview_data JSONB DEFAULT '[]', -- First 10 rows for preview

  -- Encoding detection
  detected_encoding TEXT DEFAULT 'UTF-8',

  -- Error handling
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  parsed_at TIMESTAMPTZ,
  analyzed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_user ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_status ON uploaded_files(status);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_created ON uploaded_files(created_at DESC);

-- ============================================
-- BULK OPERATIONS TABLE
-- Tracks batch operations like bulk email sends
-- ============================================
CREATE TABLE IF NOT EXISTS bulk_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Operation type
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'churn_analysis',
    'bulk_email_draft',
    'bulk_email_send',
    'bulk_task_create',
    'bulk_meeting_schedule'
  )),

  -- Source reference
  source_file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,

  -- Operation status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'awaiting_approval', 'approved', 'completed', 'failed', 'cancelled'
  )),

  -- Progress tracking
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  successful_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,

  -- Configuration
  config JSONB DEFAULT '{}',

  -- Results
  results JSONB DEFAULT '[]', -- Array of individual operation results
  summary JSONB DEFAULT '{}', -- Aggregate statistics

  -- Error handling
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bulk_operations_user ON bulk_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_status ON bulk_operations(status);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_type ON bulk_operations(operation_type);

-- ============================================
-- CHURN RISK SCORES TABLE
-- Stores calculated churn risk scores from CSV analysis
-- ============================================
CREATE TABLE IF NOT EXISTS churn_risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Source reference
  source_file_id UUID REFERENCES uploaded_files(id) ON DELETE CASCADE,
  bulk_operation_id UUID REFERENCES bulk_operations(id) ON DELETE SET NULL,

  -- Customer reference (may be null if customer not in system)
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Data from CSV
  row_index INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  raw_data JSONB DEFAULT '{}', -- Original row data

  -- Risk scoring
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Risk factors
  risk_factors JSONB DEFAULT '[]', -- Array of {factor, weight, value, contribution}

  -- Primary concerns (for email personalization)
  primary_concerns TEXT[],

  -- Usage metrics from CSV
  usage_metrics JSONB DEFAULT '{}',

  -- Email status
  email_drafted BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  email_approval_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_churn_scores_file ON churn_risk_scores(source_file_id);
CREATE INDEX IF NOT EXISTS idx_churn_scores_risk ON churn_risk_scores(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_churn_scores_level ON churn_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_churn_scores_customer ON churn_risk_scores(customer_id);

-- ============================================
-- ADD SOURCE_FILE_ID TO RISK_SIGNALS TABLE
-- Links detected risk signals back to uploaded files
-- ============================================
DO $$
BEGIN
  -- Add source_file_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risk_signals' AND column_name = 'source_file_id'
  ) THEN
    ALTER TABLE risk_signals ADD COLUMN source_file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_risk_signals_source_file ON risk_signals(source_file_id);
  END IF;
END $$;

-- ============================================
-- DRAFT EMAILS TABLE
-- Stores bulk-generated email drafts for review
-- ============================================
CREATE TABLE IF NOT EXISTS draft_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Source references
  bulk_operation_id UUID REFERENCES bulk_operations(id) ON DELETE CASCADE,
  churn_score_id UUID REFERENCES churn_risk_scores(id) ON DELETE SET NULL,

  -- Recipient info
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,

  -- Email content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,

  -- Personalization context
  risk_level TEXT,
  primary_concern TEXT,
  talking_points JSONB DEFAULT '[]',

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'edited', 'approved', 'sent', 'failed'
  )),

  -- Approval reference
  approval_id UUID,

  -- User edits
  edited_subject TEXT,
  edited_body_html TEXT,
  edited_body_text TEXT,
  edited_at TIMESTAMPTZ,

  -- Send tracking
  sent_at TIMESTAMPTZ,
  gmail_message_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draft_emails_user ON draft_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_draft_emails_operation ON draft_emails(bulk_operation_id);
CREATE INDEX IF NOT EXISTS idx_draft_emails_status ON draft_emails(status);

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to new tables
DROP TRIGGER IF EXISTS update_uploaded_files_timestamp ON uploaded_files;
CREATE TRIGGER update_uploaded_files_timestamp
  BEFORE UPDATE ON uploaded_files
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_bulk_operations_timestamp ON bulk_operations;
CREATE TRIGGER update_bulk_operations_timestamp
  BEFORE UPDATE ON bulk_operations
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_churn_scores_timestamp ON churn_risk_scores;
CREATE TRIGGER update_churn_scores_timestamp
  BEFORE UPDATE ON churn_risk_scores
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_draft_emails_timestamp ON draft_emails;
CREATE TRIGGER update_draft_emails_timestamp
  BEFORE UPDATE ON draft_emails
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- ADD 'bulk_email' to approval action types
-- ============================================
-- Note: The approval_queue table uses TEXT for action_type, so no ALTER needed
-- Just document that 'bulk_email' is now a valid action type

COMMENT ON TABLE uploaded_files IS 'Tracks CSV and other file uploads for processing (PRD-001)';
COMMENT ON TABLE bulk_operations IS 'Tracks batch operations like bulk email sends (PRD-001)';
COMMENT ON TABLE churn_risk_scores IS 'Stores calculated churn risk scores from CSV analysis (PRD-001)';
COMMENT ON TABLE draft_emails IS 'Stores bulk-generated email drafts for review (PRD-001)';
