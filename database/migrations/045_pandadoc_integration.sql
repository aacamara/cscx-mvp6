-- ============================================
-- PRD-206: PandaDoc Integration
-- Migration: 045_pandadoc_integration.sql
-- ============================================

-- ============================================
-- PANDADOC DOCUMENTS
-- Stores synced documents from PandaDoc
-- ============================================
CREATE TABLE IF NOT EXISTS pandadoc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pandadoc_id TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Document details
  name TEXT NOT NULL,
  status VARCHAR(30) CHECK (status IN (
    'document.draft',
    'document.sent',
    'document.viewed',
    'document.waiting_approval',
    'document.approved',
    'document.waiting_pay',
    'document.paid',
    'document.completed',
    'document.voided',
    'document.declined'
  )),
  document_type VARCHAR(30) CHECK (document_type IN (
    'proposal', 'contract', 'quote', 'sow', 'nda', 'renewal', 'amendment', 'other'
  )),

  -- Recipients (JSON array)
  recipients JSONB DEFAULT '[]',

  -- Timestamps from PandaDoc
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Payment information (if using PandaDoc payments)
  payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  amount NUMERIC(12,2),
  currency VARCHAR(3),

  -- Additional metadata
  metadata JSONB DEFAULT '{}',

  -- Sync tracking
  synced_at TIMESTAMPTZ,

  -- CSCX timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pandadoc_documents_customer ON pandadoc_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_pandadoc_documents_status ON pandadoc_documents(status);
CREATE INDEX IF NOT EXISTS idx_pandadoc_documents_type ON pandadoc_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_pandadoc_documents_sent ON pandadoc_documents(sent_at);
CREATE INDEX IF NOT EXISTS idx_pandadoc_documents_completed ON pandadoc_documents(completed_at);
CREATE INDEX IF NOT EXISTS idx_pandadoc_documents_synced ON pandadoc_documents(synced_at);

-- Auto-update timestamp trigger
CREATE TRIGGER update_pandadoc_documents_timestamp
  BEFORE UPDATE ON pandadoc_documents
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- PANDADOC EVENTS
-- Tracks individual events (viewing, signing)
-- ============================================
CREATE TABLE IF NOT EXISTS pandadoc_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pandadoc_id TEXT NOT NULL,
  document_id UUID REFERENCES pandadoc_documents(id) ON DELETE CASCADE,

  -- Event details
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'document_created',
    'document_sent',
    'document_viewed',
    'document_completed',
    'document_paid',
    'document_declined',
    'document_voided',
    'recipient_completed',
    'recipient_viewed'
  )),
  recipient_email TEXT,

  -- Event metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pandadoc_events_document ON pandadoc_events(document_id);
CREATE INDEX IF NOT EXISTS idx_pandadoc_events_pandadoc_id ON pandadoc_events(pandadoc_id);
CREATE INDEX IF NOT EXISTS idx_pandadoc_events_type ON pandadoc_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pandadoc_events_occurred ON pandadoc_events(occurred_at);

-- ============================================
-- PANDADOC SYNC LOG
-- Track sync operations for auditing
-- ============================================
CREATE TABLE IF NOT EXISTS pandadoc_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID,

  -- Sync details
  object_type VARCHAR(50) NOT NULL, -- 'documents', 'templates'
  sync_type VARCHAR(50) NOT NULL,   -- 'full', 'incremental'
  status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),

  -- Counts
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Error tracking
  error_details TEXT[],

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pandadoc_sync_log_user ON pandadoc_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_pandadoc_sync_log_started ON pandadoc_sync_log(started_at);

-- ============================================
-- UPDATE integration_connections TABLE
-- Add PandaDoc-specific columns
-- ============================================
ALTER TABLE integration_connections
ADD COLUMN IF NOT EXISTS workspace_id TEXT,
ADD COLUMN IF NOT EXISTS sync_config JSONB DEFAULT '{}';

-- ============================================
-- VIEW: Customer Document Summary
-- Aggregated document view for customer detail
-- ============================================
CREATE OR REPLACE VIEW customer_document_summary AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  COUNT(pd.id) FILTER (WHERE pd.status != 'document.draft') as total_documents,
  COUNT(pd.id) FILTER (WHERE pd.status = 'document.sent') as pending_documents,
  COUNT(pd.id) FILTER (WHERE pd.status = 'document.completed') as completed_documents,
  COUNT(pd.id) FILTER (WHERE pd.status = 'document.paid') as paid_documents,
  COUNT(pd.id) FILTER (WHERE pd.status = 'document.declined') as declined_documents,
  COUNT(pd.id) FILTER (WHERE pd.document_type = 'proposal') as proposals,
  COUNT(pd.id) FILTER (WHERE pd.document_type = 'contract') as contracts,
  COUNT(pd.id) FILTER (WHERE pd.document_type = 'renewal') as renewals,
  SUM(pd.amount) FILTER (WHERE pd.status = 'document.paid') as total_paid_amount,
  MAX(pd.sent_at) as last_document_sent,
  MAX(pd.completed_at) as last_document_completed
FROM customers c
LEFT JOIN pandadoc_documents pd ON pd.customer_id = c.id
GROUP BY c.id, c.name;

-- ============================================
-- VIEW: Renewal Pipeline from Documents
-- Track renewal proposals in progress
-- ============================================
CREATE OR REPLACE VIEW pandadoc_renewal_pipeline AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  pd.id as document_id,
  pd.name as document_name,
  pd.status,
  pd.amount,
  pd.currency,
  pd.sent_at,
  pd.viewed_at,
  pd.completed_at,
  c.renewal_date,
  CASE
    WHEN pd.status = 'document.completed' THEN 'closed_won'
    WHEN pd.status = 'document.declined' THEN 'closed_lost'
    WHEN pd.status = 'document.viewed' THEN 'engaged'
    WHEN pd.status = 'document.sent' THEN 'sent'
    ELSE 'draft'
  END as pipeline_stage
FROM customers c
JOIN pandadoc_documents pd ON pd.customer_id = c.id
WHERE pd.document_type IN ('renewal', 'proposal', 'contract')
  AND pd.created_at > NOW() - INTERVAL '90 days'
ORDER BY pd.sent_at DESC NULLS LAST;

-- ============================================
-- FUNCTION: Get document engagement score
-- Returns engagement score based on viewing behavior
-- ============================================
CREATE OR REPLACE FUNCTION get_document_engagement_score(p_document_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_view_count INTEGER;
  v_recipients_completed INTEGER;
  v_total_recipients INTEGER;
  v_score INTEGER := 0;
BEGIN
  -- Count view events
  SELECT COUNT(*) INTO v_view_count
  FROM pandadoc_events
  WHERE document_id = p_document_id
    AND event_type IN ('document_viewed', 'recipient_viewed');

  -- Count recipient completions
  SELECT COUNT(*) INTO v_recipients_completed
  FROM pandadoc_events
  WHERE document_id = p_document_id
    AND event_type = 'recipient_completed';

  -- Get total recipients
  SELECT jsonb_array_length(recipients) INTO v_total_recipients
  FROM pandadoc_documents
  WHERE id = p_document_id;

  -- Calculate score (0-100)
  -- Views: up to 30 points (3 points per view, max 10 views)
  v_score := v_score + LEAST(v_view_count * 3, 30);

  -- Completion progress: up to 70 points
  IF v_total_recipients > 0 THEN
    v_score := v_score + (v_recipients_completed * 70 / v_total_recipients);
  END IF;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE pandadoc_documents IS 'PRD-206: Synced documents from PandaDoc (proposals, contracts, quotes)';
COMMENT ON TABLE pandadoc_events IS 'PRD-206: Individual document events (views, signatures, completions)';
COMMENT ON TABLE pandadoc_sync_log IS 'PRD-206: Audit log for PandaDoc sync operations';
COMMENT ON VIEW customer_document_summary IS 'PRD-206: Aggregated document summary for customer views';
COMMENT ON VIEW pandadoc_renewal_pipeline IS 'PRD-206: Renewal proposals in progress for pipeline tracking';
COMMENT ON FUNCTION get_document_engagement_score IS 'PRD-206: Calculate engagement score based on document viewing behavior';
