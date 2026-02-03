-- Migration: 013_customer_documents.sql
-- Description: Complete customer document tracking system with 10 core document types
-- Created: 2026-01-22

-- ============================================
-- CUSTOMER DOCUMENTS TABLE
-- ============================================
-- Tracks all documents per customer with their Google Drive locations
-- Enables agents to find and update the right documents

CREATE TABLE IF NOT EXISTS customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Document identification
  document_type VARCHAR(50) NOT NULL,
  google_file_id TEXT NOT NULL,
  google_folder_id TEXT,

  -- Metadata
  name TEXT NOT NULL,
  mime_type TEXT,
  file_type VARCHAR(20),  -- doc, sheet, slide, pdf, txt

  -- Status tracking
  status VARCHAR(20) DEFAULT 'active',  -- draft, active, archived
  version INT DEFAULT 1,

  -- For QBRs - which quarter
  period VARCHAR(20),  -- Q1 2026, Q2 2026, etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,

  -- Web URLs for quick access
  web_view_url TEXT,
  web_edit_url TEXT
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_customer_docs_customer ON customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_docs_type ON customer_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_customer_docs_customer_type ON customer_documents(customer_id, document_type);

-- Allow multiple QBR decks (one per quarter) but unique for other types
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_docs_unique
ON customer_documents(customer_id, document_type, COALESCE(period, ''))
WHERE document_type NOT IN ('meeting_notes', 'transcript');

COMMENT ON TABLE customer_documents IS 'Tracks all 10 core document types per customer with Google Drive locations';
COMMENT ON COLUMN customer_documents.document_type IS 'One of: contract, entitlements, onboarding_plan, onboarding_tracker, stakeholder_map, qbr_deck, health_tracker, usage_metrics, success_plan, renewal_tracker, meeting_notes, transcript';
COMMENT ON COLUMN customer_documents.period IS 'For periodic documents like QBRs: Q1 2026, Q2 2026, etc.';

-- ============================================
-- MEETING TRANSCRIPTS TABLE
-- ============================================
-- Stores meeting transcripts from Otter AI, Google Meet, or Zoom

CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Meeting reference
  calendar_event_id TEXT,  -- Google Calendar event ID
  meeting_title TEXT NOT NULL,

  -- Source information
  source VARCHAR(20) NOT NULL DEFAULT 'otter',  -- otter, google_meet, zoom, manual
  source_meeting_id TEXT,  -- External meeting ID from source
  source_url TEXT,  -- Link to original in Otter/Zoom

  -- Participants
  participants JSONB DEFAULT '[]',  -- [{name, email, role}]
  speakers JSONB DEFAULT '[]',  -- [{name, speaking_time_seconds, speaking_pct}]

  -- Content
  transcript_text TEXT,

  -- AI-generated analysis
  summary TEXT,
  key_topics JSONB DEFAULT '[]',  -- ["pricing", "timeline", "technical requirements"]
  action_items JSONB DEFAULT '[]',  -- [{item, assignee, due_date}]
  decisions JSONB DEFAULT '[]',  -- [{decision, context}]
  sentiment VARCHAR(20),  -- positive, neutral, negative, mixed
  sentiment_score DECIMAL(3,2),  -- -1.0 to 1.0

  -- Meeting metadata
  meeting_date TIMESTAMPTZ NOT NULL,
  duration_minutes INT,
  meeting_type VARCHAR(50),  -- kickoff, qbr, check_in, training, escalation, etc.

  -- Google Drive storage
  google_file_id TEXT,  -- Transcript file in Drive
  google_folder_id TEXT,
  notes_doc_id TEXT,  -- Generated meeting notes doc

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ  -- When AI analysis completed
);

CREATE INDEX IF NOT EXISTS idx_transcripts_customer ON meeting_transcripts(customer_id, meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_transcripts_source ON meeting_transcripts(source, source_meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_calendar ON meeting_transcripts(calendar_event_id);

COMMENT ON TABLE meeting_transcripts IS 'Meeting transcripts from Otter AI, Google Meet, or Zoom with AI-generated summaries';
COMMENT ON COLUMN meeting_transcripts.source IS 'Transcript source: otter, google_meet, zoom, or manual';
COMMENT ON COLUMN meeting_transcripts.action_items IS 'AI-extracted action items: [{item, assignee, due_date}]';

-- ============================================
-- CUSTOMER WORKSPACE FOLDERS TABLE
-- ============================================
-- Stores the folder structure IDs for each customer

CREATE TABLE IF NOT EXISTS customer_workspace_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Root folder
  root_folder_id TEXT NOT NULL,
  root_folder_url TEXT,

  -- Main folders (6 + subfolders)
  templates_folder_id TEXT,
  onboarding_folder_id TEXT,
  meetings_folder_id TEXT,
  meetings_notes_folder_id TEXT,
  meetings_transcripts_folder_id TEXT,
  meetings_recordings_folder_id TEXT,
  qbrs_folder_id TEXT,
  health_folder_id TEXT,
  success_folder_id TEXT,
  renewals_folder_id TEXT,
  risk_folder_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_folders_customer ON customer_workspace_folders(customer_id);

COMMENT ON TABLE customer_workspace_folders IS 'Google Drive folder structure IDs per customer';

-- ============================================
-- OTTER AI INTEGRATION TABLE
-- ============================================
-- Stores Otter AI connection settings and webhook data

CREATE TABLE IF NOT EXISTS otter_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- Otter credentials (encrypted in production)
  otter_api_key TEXT,
  otter_user_id TEXT,
  webhook_secret TEXT,

  -- Settings
  auto_join_meetings BOOLEAN DEFAULT true,
  auto_transcribe BOOLEAN DEFAULT true,
  auto_generate_notes BOOLEAN DEFAULT true,

  -- Status
  status VARCHAR(20) DEFAULT 'active',  -- active, paused, disconnected
  last_webhook_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE otter_integrations IS 'Otter AI integration settings per user';

-- ============================================
-- VIEWS FOR EASY QUERYING
-- ============================================

-- View: All documents for a customer with folder paths
CREATE OR REPLACE VIEW customer_document_summary AS
SELECT
  cd.id,
  cd.customer_id,
  c.name as customer_name,
  cd.document_type,
  cd.name as document_name,
  cd.file_type,
  cd.status,
  cd.period,
  cd.web_view_url,
  cd.web_edit_url,
  cd.created_at,
  cd.updated_at
FROM customer_documents cd
JOIN customers c ON c.id = cd.customer_id
ORDER BY cd.customer_id, cd.document_type;

-- View: Document completeness per customer
CREATE OR REPLACE VIEW customer_document_completeness AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  COUNT(cd.id) as documents_created,
  10 as documents_expected,
  ROUND(COUNT(cd.id)::DECIMAL / 10 * 100, 1) as completeness_pct,
  ARRAY_AGG(cd.document_type) as document_types_present,
  ARRAY(
    SELECT unnest(ARRAY['contract', 'entitlements', 'onboarding_plan', 'onboarding_tracker',
                        'stakeholder_map', 'qbr_deck', 'health_tracker', 'usage_metrics',
                        'success_plan', 'renewal_tracker'])
    EXCEPT
    SELECT unnest(ARRAY_AGG(cd.document_type))
  ) as document_types_missing
FROM customers c
LEFT JOIN customer_documents cd ON cd.customer_id = c.id
GROUP BY c.id, c.name;

COMMENT ON VIEW customer_document_completeness IS 'Shows which of the 10 core documents each customer has';
