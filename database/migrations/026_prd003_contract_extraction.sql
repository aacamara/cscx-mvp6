-- Migration 026: PRD-003 - Enhanced PDF Contract Upload with Key Terms Extraction
-- Adds enhanced contract extraction fields, SLA tracking, and confidence scores

-- ============================================
-- Enhance contracts table with extraction metadata
-- ============================================

DO $$
BEGIN
  -- sla_terms: Array of SLA commitments from the contract
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'sla_terms') THEN
    ALTER TABLE public.contracts ADD COLUMN sla_terms JSONB DEFAULT '[]';
  END IF;

  -- auto_renewal_clause: Structured auto-renewal information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'auto_renewal') THEN
    ALTER TABLE public.contracts ADD COLUMN auto_renewal JSONB DEFAULT NULL;
  END IF;

  -- termination_clause: Termination terms and conditions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'termination_clause') THEN
    ALTER TABLE public.contracts ADD COLUMN termination_clause TEXT;
  END IF;

  -- payment_terms: Payment terms (Net 30, Net 45, etc.)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'payment_terms') THEN
    ALTER TABLE public.contracts ADD COLUMN payment_terms TEXT;
  END IF;

  -- billing_frequency: Annual, Monthly, Quarterly, etc.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'billing_frequency') THEN
    ALTER TABLE public.contracts ADD COLUMN billing_frequency TEXT;
  END IF;

  -- extraction_confidence: Per-field confidence scores from AI
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'extraction_confidence') THEN
    ALTER TABLE public.contracts ADD COLUMN extraction_confidence JSONB DEFAULT '{}';
  END IF;

  -- extraction_warnings: Array of items requiring attention
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'extraction_warnings') THEN
    ALTER TABLE public.contracts ADD COLUMN extraction_warnings JSONB DEFAULT '[]';
  END IF;

  -- page_count: Number of pages in the PDF
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'page_count') THEN
    ALTER TABLE public.contracts ADD COLUMN page_count INTEGER;
  END IF;

  -- is_ocr_processed: Flag if OCR was needed for scanned PDF
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'is_ocr_processed') THEN
    ALTER TABLE public.contracts ADD COLUMN is_ocr_processed BOOLEAN DEFAULT FALSE;
  END IF;

  -- source: How the contract was uploaded (chat_upload, onboarding, api, etc.)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'source') THEN
    ALTER TABLE public.contracts ADD COLUMN source TEXT DEFAULT 'onboarding';
  END IF;

  -- google_drive_file_id: Reference to Google Drive if uploaded there
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'google_drive_file_id') THEN
    ALTER TABLE public.contracts ADD COLUMN google_drive_file_id TEXT;
  END IF;

  -- google_drive_url: Direct URL to Google Drive file
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'google_drive_url') THEN
    ALTER TABLE public.contracts ADD COLUMN google_drive_url TEXT;
  END IF;

  -- Make customer_id nullable for pending contracts
  ALTER TABLE public.contracts ALTER COLUMN customer_id DROP NOT NULL;
END $$;

-- ============================================
-- Create contract_extractions table for versioned extractions
-- Allows tracking corrections and re-extractions
-- ============================================

CREATE TABLE IF NOT EXISTS public.contract_extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,

  -- Extracted fields
  company_name TEXT,
  arr NUMERIC(12, 2),
  contract_period TEXT,
  start_date DATE,
  end_date DATE,
  payment_terms TEXT,
  billing_frequency TEXT,

  -- SLA terms (structured array)
  sla_terms JSONB DEFAULT '[]',

  -- Auto-renewal details
  auto_renewal JSONB DEFAULT NULL,

  -- Termination clause
  termination_clause TEXT,

  -- Raw extracted data (full AI response)
  full_extraction JSONB NOT NULL,

  -- Confidence scores per field
  confidence_scores JSONB DEFAULT '{}',

  -- Warnings/items requiring attention
  warnings JSONB DEFAULT '[]',

  -- User corrections applied
  corrections JSONB DEFAULT '{}',

  -- Extraction metadata
  model_used TEXT,
  extraction_time_ms INTEGER,
  is_current BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Ensure only one current extraction per contract
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_extractions_current
ON public.contract_extractions(contract_id)
WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_contract_extractions_contract
ON public.contract_extractions(contract_id);

-- ============================================
-- Create sla_commitments table for normalized SLA tracking
-- ============================================

CREATE TABLE IF NOT EXISTS public.sla_commitments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,

  -- SLA details
  type TEXT NOT NULL, -- uptime, response_time, resolution_time, data_retention, etc.
  metric TEXT NOT NULL, -- e.g., "99.9%", "4 hours", "7 years"
  description TEXT,
  scope TEXT, -- What the SLA covers

  -- Penalties/Credits if breached
  penalty_terms TEXT,
  credit_amount NUMERIC(12, 2),
  credit_type TEXT, -- percentage, fixed, service_credit

  -- Exclusions
  exclusions JSONB DEFAULT '[]',

  -- Source reference
  source_page INTEGER, -- Page number in contract
  source_text TEXT, -- Exact text that was extracted
  confidence NUMERIC(3, 2), -- AI confidence (0-1)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_commitments_contract
ON public.sla_commitments(contract_id);

CREATE INDEX IF NOT EXISTS idx_sla_commitments_customer
ON public.sla_commitments(customer_id);

CREATE INDEX IF NOT EXISTS idx_sla_commitments_type
ON public.sla_commitments(type);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_sla_commitments_updated_at ON public.sla_commitments;
CREATE TRIGGER update_sla_commitments_updated_at
  BEFORE UPDATE ON public.sla_commitments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Update entitlements table with additional fields
-- ============================================

DO $$
BEGIN
  -- unit_price column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'entitlements'
                 AND column_name = 'unit_price') THEN
    ALTER TABLE public.entitlements ADD COLUMN unit_price NUMERIC(12, 2);
  END IF;

  -- total_value column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'entitlements'
                 AND column_name = 'total_value') THEN
    ALTER TABLE public.entitlements ADD COLUMN total_value NUMERIC(12, 2);
  END IF;

  -- payment_terms column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'entitlements'
                 AND column_name = 'payment_terms') THEN
    ALTER TABLE public.entitlements ADD COLUMN payment_terms TEXT;
  END IF;

  -- extraction_confidence column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'entitlements'
                 AND column_name = 'extraction_confidence') THEN
    ALTER TABLE public.entitlements ADD COLUMN extraction_confidence NUMERIC(3, 2);
  END IF;

  -- start_date column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'entitlements'
                 AND column_name = 'start_date') THEN
    ALTER TABLE public.entitlements ADD COLUMN start_date DATE;
  END IF;

  -- end_date column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'entitlements'
                 AND column_name = 'end_date') THEN
    ALTER TABLE public.entitlements ADD COLUMN end_date DATE;
  END IF;
END $$;

-- ============================================
-- Update stakeholders table for contract-extracted contacts
-- ============================================

DO $$
BEGIN
  -- department column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'stakeholders'
                 AND column_name = 'department') THEN
    ALTER TABLE public.stakeholders ADD COLUMN department TEXT;
  END IF;

  -- responsibilities column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'stakeholders'
                 AND column_name = 'responsibilities') THEN
    ALTER TABLE public.stakeholders ADD COLUMN responsibilities TEXT;
  END IF;

  -- approval_required column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'stakeholders'
                 AND column_name = 'approval_required') THEN
    ALTER TABLE public.stakeholders ADD COLUMN approval_required BOOLEAN DEFAULT FALSE;
  END IF;

  -- contract_id column (link to source contract)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'stakeholders'
                 AND column_name = 'contract_id') THEN
    ALTER TABLE public.stakeholders ADD COLUMN contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL;
  END IF;

  -- extraction_confidence column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'stakeholders'
                 AND column_name = 'extraction_confidence') THEN
    ALTER TABLE public.stakeholders ADD COLUMN extraction_confidence NUMERIC(3, 2);
  END IF;
END $$;

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.contract_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_commitments ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role full access on contract_extractions"
ON public.contract_extractions FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on sla_commitments"
ON public.sla_commitments FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE public.contract_extractions IS 'Versioned AI extractions from contract documents with confidence scores';
COMMENT ON TABLE public.sla_commitments IS 'Normalized SLA commitments extracted from contracts';
COMMENT ON COLUMN public.contracts.sla_terms IS 'Array of SLA commitments extracted from the contract';
COMMENT ON COLUMN public.contracts.auto_renewal IS 'Structured auto-renewal clause details: enabled, period, notice_days, terms';
COMMENT ON COLUMN public.contracts.extraction_confidence IS 'Per-field confidence scores from AI extraction (0-1)';
COMMENT ON COLUMN public.contracts.extraction_warnings IS 'Items flagged for manual review during extraction';
