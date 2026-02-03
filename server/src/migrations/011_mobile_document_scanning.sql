-- PRD-267: Mobile Document Scanning
-- Migration for scanned documents, OCR results, and search indexing

-- ============================================
-- Scanned Documents Table
-- ============================================
CREATE TABLE IF NOT EXISTS scanned_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  file_name TEXT NOT NULL,
  document_type VARCHAR(50) NOT NULL DEFAULT 'other', -- contract, business_card, meeting_notes, invoice, other
  page_count INTEGER NOT NULL DEFAULT 1,
  extracted_text TEXT,
  ocr_confidence NUMERIC(5,4) DEFAULT 0,
  structured_data JSONB,
  file_url TEXT,
  thumbnail_url TEXT,
  is_searchable BOOLEAN DEFAULT false,
  linked_contact_id UUID,
  linked_contract_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_scanned_documents_user
  ON scanned_documents(user_id, created_at DESC);

-- Index for customer queries
CREATE INDEX IF NOT EXISTS idx_scanned_documents_customer
  ON scanned_documents(customer_id, created_at DESC);

-- Index for document type filtering
CREATE INDEX IF NOT EXISTS idx_scanned_documents_type
  ON scanned_documents(document_type, created_at DESC);

-- Full-text search index on extracted text
CREATE INDEX IF NOT EXISTS idx_scanned_documents_text_search
  ON scanned_documents USING gin(to_tsvector('english', COALESCE(extracted_text, '')));

-- ============================================
-- Scanned Pages Table (for multi-page documents)
-- ============================================
CREATE TABLE IF NOT EXISTS scanned_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES scanned_documents(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  image_url TEXT,
  thumbnail_url TEXT,
  ocr_text TEXT,
  ocr_confidence NUMERIC(5,4) DEFAULT 0,
  text_blocks JSONB DEFAULT '[]', -- Array of text blocks with bounding boxes
  processing_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, complete, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, page_number)
);

-- Index for document page queries
CREATE INDEX IF NOT EXISTS idx_scanned_pages_document
  ON scanned_pages(document_id, page_number);

-- ============================================
-- Document Classifications History
-- ============================================
CREATE TABLE IF NOT EXISTS document_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES scanned_documents(id) ON DELETE CASCADE NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  confidence NUMERIC(5,4) NOT NULL,
  extracted_data JSONB,
  model_version TEXT,
  is_user_corrected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for classification queries
CREATE INDEX IF NOT EXISTS idx_document_classifications_document
  ON document_classifications(document_id, created_at DESC);

-- ============================================
-- Business Cards Extracted Data
-- ============================================
CREATE TABLE IF NOT EXISTS extracted_business_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES scanned_documents(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  contact_id UUID, -- Link to created contact
  name TEXT,
  title TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  linkedin_url TEXT,
  website TEXT,
  raw_data JSONB,
  extraction_confidence NUMERIC(5,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id)
);

-- Index for business card queries
CREATE INDEX IF NOT EXISTS idx_extracted_business_cards_customer
  ON extracted_business_cards(customer_id);

-- ============================================
-- Contract Extractions
-- ============================================
CREATE TABLE IF NOT EXISTS extracted_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES scanned_documents(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  contract_value NUMERIC(15,2),
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  terms TEXT[],
  key_provisions TEXT[],
  raw_data JSONB,
  extraction_confidence NUMERIC(5,4) DEFAULT 0,
  is_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id)
);

-- Index for contract queries
CREATE INDEX IF NOT EXISTS idx_extracted_contracts_customer
  ON extracted_contracts(customer_id);

-- ============================================
-- Meeting Notes Extractions
-- ============================================
CREATE TABLE IF NOT EXISTS extracted_meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES scanned_documents(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  meeting_date DATE,
  attendees TEXT[],
  topics TEXT[],
  action_items TEXT[],
  decisions TEXT[],
  next_steps TEXT[],
  raw_data JSONB,
  extraction_confidence NUMERIC(5,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id)
);

-- Index for meeting notes queries
CREATE INDEX IF NOT EXISTS idx_extracted_meeting_notes_customer
  ON extracted_meeting_notes(customer_id);

-- ============================================
-- Scan Processing Queue (for async processing)
-- ============================================
CREATE TABLE IF NOT EXISTS scan_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES scanned_documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, complete, failed
  step VARCHAR(50), -- ocr, classification, extraction, indexing
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for queue processing
CREATE INDEX IF NOT EXISTS idx_scan_processing_queue_status
  ON scan_processing_queue(status, scheduled_for)
  WHERE status IN ('pending', 'processing');

-- ============================================
-- Scanning Statistics (aggregated daily)
-- ============================================
CREATE TABLE IF NOT EXISTS scan_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stat_date DATE NOT NULL,
  total_scans INTEGER DEFAULT 0,
  contracts_scanned INTEGER DEFAULT 0,
  business_cards_scanned INTEGER DEFAULT 0,
  meeting_notes_scanned INTEGER DEFAULT 0,
  invoices_scanned INTEGER DEFAULT 0,
  other_scanned INTEGER DEFAULT 0,
  avg_ocr_confidence NUMERIC(5,4) DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  contacts_created INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stat_date)
);

-- Index for statistics queries
CREATE INDEX IF NOT EXISTS idx_scan_statistics_user
  ON scan_statistics(user_id, stat_date DESC);

-- ============================================
-- Functions
-- ============================================

-- Function to update scan statistics
CREATE OR REPLACE FUNCTION update_scan_statistics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO scan_statistics (
    user_id,
    stat_date,
    total_scans,
    contracts_scanned,
    business_cards_scanned,
    meeting_notes_scanned,
    invoices_scanned,
    other_scanned,
    avg_ocr_confidence,
    total_pages
  ) VALUES (
    NEW.user_id,
    CURRENT_DATE,
    1,
    CASE WHEN NEW.document_type = 'contract' THEN 1 ELSE 0 END,
    CASE WHEN NEW.document_type = 'business_card' THEN 1 ELSE 0 END,
    CASE WHEN NEW.document_type = 'meeting_notes' THEN 1 ELSE 0 END,
    CASE WHEN NEW.document_type = 'invoice' THEN 1 ELSE 0 END,
    CASE WHEN NEW.document_type = 'other' THEN 1 ELSE 0 END,
    NEW.ocr_confidence,
    NEW.page_count
  )
  ON CONFLICT (user_id, stat_date) DO UPDATE SET
    total_scans = scan_statistics.total_scans + 1,
    contracts_scanned = scan_statistics.contracts_scanned + CASE WHEN NEW.document_type = 'contract' THEN 1 ELSE 0 END,
    business_cards_scanned = scan_statistics.business_cards_scanned + CASE WHEN NEW.document_type = 'business_card' THEN 1 ELSE 0 END,
    meeting_notes_scanned = scan_statistics.meeting_notes_scanned + CASE WHEN NEW.document_type = 'meeting_notes' THEN 1 ELSE 0 END,
    invoices_scanned = scan_statistics.invoices_scanned + CASE WHEN NEW.document_type = 'invoice' THEN 1 ELSE 0 END,
    other_scanned = scan_statistics.other_scanned + CASE WHEN NEW.document_type = 'other' THEN 1 ELSE 0 END,
    avg_ocr_confidence = (scan_statistics.avg_ocr_confidence * scan_statistics.total_scans + NEW.ocr_confidence) / (scan_statistics.total_scans + 1),
    total_pages = scan_statistics.total_pages + NEW.page_count,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update statistics on new scan
DROP TRIGGER IF EXISTS update_scan_statistics_trigger ON scanned_documents;
CREATE TRIGGER update_scan_statistics_trigger
  AFTER INSERT ON scanned_documents
  FOR EACH ROW EXECUTE FUNCTION update_scan_statistics();

-- Function to search documents by text
CREATE OR REPLACE FUNCTION search_scanned_documents(
  p_user_id UUID,
  p_query TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_document_type VARCHAR(50) DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  file_name TEXT,
  document_type VARCHAR(50),
  customer_id UUID,
  customer_name TEXT,
  ocr_confidence NUMERIC,
  page_count INTEGER,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sd.id,
    sd.file_name,
    sd.document_type,
    sd.customer_id,
    sd.customer_name,
    sd.ocr_confidence,
    sd.page_count,
    sd.created_at,
    ts_rank(to_tsvector('english', COALESCE(sd.extracted_text, '')), plainto_tsquery('english', p_query)) AS rank
  FROM scanned_documents sd
  WHERE sd.user_id = p_user_id
    AND sd.is_searchable = true
    AND (p_customer_id IS NULL OR sd.customer_id = p_customer_id)
    AND (p_document_type IS NULL OR sd.document_type = p_document_type)
    AND (p_query IS NULL OR p_query = '' OR to_tsvector('english', COALESCE(sd.extracted_text, '')) @@ plainto_tsquery('english', p_query))
  ORDER BY rank DESC, sd.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Timestamp Update Triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_scanned_documents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_scanned_documents_timestamp ON scanned_documents;
CREATE TRIGGER update_scanned_documents_timestamp
  BEFORE UPDATE ON scanned_documents
  FOR EACH ROW EXECUTE FUNCTION update_scanned_documents_timestamp();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE scanned_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_business_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_statistics ENABLE ROW LEVEL SECURITY;

-- Policies (users can only see their own data)
CREATE POLICY scanned_documents_policy ON scanned_documents
  FOR ALL USING (auth.uid() = user_id OR user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID);

CREATE POLICY scanned_pages_policy ON scanned_pages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scanned_documents sd
      WHERE sd.id = scanned_pages.document_id
      AND (auth.uid() = sd.user_id OR sd.user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID)
    )
  );

CREATE POLICY document_classifications_policy ON document_classifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scanned_documents sd
      WHERE sd.id = document_classifications.document_id
      AND (auth.uid() = sd.user_id OR sd.user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID)
    )
  );

CREATE POLICY extracted_business_cards_policy ON extracted_business_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scanned_documents sd
      WHERE sd.id = extracted_business_cards.document_id
      AND (auth.uid() = sd.user_id OR sd.user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID)
    )
  );

CREATE POLICY extracted_contracts_policy ON extracted_contracts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scanned_documents sd
      WHERE sd.id = extracted_contracts.document_id
      AND (auth.uid() = sd.user_id OR sd.user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID)
    )
  );

CREATE POLICY extracted_meeting_notes_policy ON extracted_meeting_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scanned_documents sd
      WHERE sd.id = extracted_meeting_notes.document_id
      AND (auth.uid() = sd.user_id OR sd.user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID)
    )
  );

CREATE POLICY scan_processing_queue_policy ON scan_processing_queue
  FOR ALL USING (auth.uid() = user_id OR user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID);

CREATE POLICY scan_statistics_policy ON scan_statistics
  FOR ALL USING (auth.uid() = user_id OR user_id = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131'::UUID);

-- ============================================
-- Grant Permissions
-- ============================================

GRANT ALL ON scanned_documents TO authenticated;
GRANT ALL ON scanned_pages TO authenticated;
GRANT ALL ON document_classifications TO authenticated;
GRANT ALL ON extracted_business_cards TO authenticated;
GRANT ALL ON extracted_contracts TO authenticated;
GRANT ALL ON extracted_meeting_notes TO authenticated;
GRANT ALL ON scan_processing_queue TO authenticated;
GRANT ALL ON scan_statistics TO authenticated;
