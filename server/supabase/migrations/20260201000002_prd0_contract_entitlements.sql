-- ================================================
-- PRD-0: Contract Parsing + Entitlements Normalization
-- Migration: 20260201_prd0_contract_entitlements.sql
-- Purpose: Add missing columns for contract parsing and entitlements
-- ================================================

-- ================================================
-- CONTRACTS TABLE ENHANCEMENTS
-- ================================================

-- Add contract_type column if it doesn't exist
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_type TEXT;
COMMENT ON COLUMN contracts.contract_type IS 'Type: msa, sow, order_form, amendment';

-- Add file_type column for document format
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS file_type TEXT;
COMMENT ON COLUMN contracts.file_type IS 'Document format: pdf, docx, gdoc, txt';

-- Add file_size column
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS file_size INTEGER;
COMMENT ON COLUMN contracts.file_size IS 'File size in bytes';

-- Add extracted_text column for parsed content
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS extracted_text TEXT;
COMMENT ON COLUMN contracts.extracted_text IS 'Full text extracted from document';

-- Add parsed_at timestamp
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMPTZ;
COMMENT ON COLUMN contracts.parsed_at IS 'When the contract was parsed';

-- Add error_message for parse failures
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS error_message TEXT;
COMMENT ON COLUMN contracts.error_message IS 'Error message if parsing failed';

-- ================================================
-- ENTITLEMENTS TABLE ENHANCEMENTS
-- ================================================

-- Core product fields
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS sku TEXT;
COMMENT ON COLUMN entitlements.sku IS 'Product SKU or identifier';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS product_name TEXT;
COMMENT ON COLUMN entitlements.product_name IS 'Product or service name';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS quantity_unit TEXT;
COMMENT ON COLUMN entitlements.quantity_unit IS 'Unit for quantity (users, seats, etc)';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS usage_limit INTEGER;
COMMENT ON COLUMN entitlements.usage_limit IS 'Maximum usage allowed';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS usage_unit TEXT;
COMMENT ON COLUMN entitlements.usage_unit IS 'Unit for usage (api_calls, gb, etc)';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS usage_current INTEGER DEFAULT 0;
COMMENT ON COLUMN entitlements.usage_current IS 'Current usage count';

-- Support fields
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS support_tier TEXT;
COMMENT ON COLUMN entitlements.support_tier IS 'Support tier (basic, premium, enterprise)';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS sla_response_time TEXT;
COMMENT ON COLUMN entitlements.sla_response_time IS 'SLA response time';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS sla_resolution_time TEXT;
COMMENT ON COLUMN entitlements.sla_resolution_time IS 'SLA resolution time';

-- Date fields
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS effective_date DATE;
COMMENT ON COLUMN entitlements.effective_date IS 'When entitlement becomes effective';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS renewal_date DATE;
COMMENT ON COLUMN entitlements.renewal_date IS 'Next renewal date';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS renewal_terms TEXT;
COMMENT ON COLUMN entitlements.renewal_terms IS 'Renewal terms description';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;
COMMENT ON COLUMN entitlements.auto_renew IS 'Whether contract auto-renews';

-- Pricing fields
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,2);
COMMENT ON COLUMN entitlements.unit_price IS 'Price per unit';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2);
COMMENT ON COLUMN entitlements.total_price IS 'Total price';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
COMMENT ON COLUMN entitlements.currency IS 'Currency code';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS billing_frequency TEXT;
COMMENT ON COLUMN entitlements.billing_frequency IS 'Billing frequency (monthly, annual, etc)';

-- Confidence scores (0-1)
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS confidence_sku DECIMAL(3,2);
COMMENT ON COLUMN entitlements.confidence_sku IS 'Confidence score for SKU extraction';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS confidence_quantity DECIMAL(3,2);
COMMENT ON COLUMN entitlements.confidence_quantity IS 'Confidence score for quantity extraction';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS confidence_dates DECIMAL(3,2);
COMMENT ON COLUMN entitlements.confidence_dates IS 'Confidence score for date extraction';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS confidence_pricing DECIMAL(3,2);
COMMENT ON COLUMN entitlements.confidence_pricing IS 'Confidence score for pricing extraction';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS confidence_overall DECIMAL(3,2);
COMMENT ON COLUMN entitlements.confidence_overall IS 'Overall confidence score';

-- Special fields
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS special_clauses TEXT[];
COMMENT ON COLUMN entitlements.special_clauses IS 'Array of special contract clauses';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS exclusions TEXT[];
COMMENT ON COLUMN entitlements.exclusions IS 'Array of exclusions';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS notes TEXT;
COMMENT ON COLUMN entitlements.notes IS 'Additional notes';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS source_section TEXT;
COMMENT ON COLUMN entitlements.source_section IS 'Source section in contract document';

-- Version and status
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
COMMENT ON COLUMN entitlements.version IS 'Version number for history tracking';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
COMMENT ON COLUMN entitlements.is_active IS 'Whether this is the active version';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
COMMENT ON COLUMN entitlements.finalized_at IS 'When entitlement was finalized';

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS finalized_by UUID;
COMMENT ON COLUMN entitlements.finalized_by IS 'User who finalized the entitlement';

-- ================================================
-- ENTITLEMENT_EDITS TABLE (NEW)
-- For HITL edit history tracking
-- ================================================

CREATE TABLE IF NOT EXISTS entitlement_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id UUID REFERENCES entitlements(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edited_by UUID,
  edited_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE entitlement_edits IS 'Audit log of edits to entitlements for HITL review';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entitlement_edits_entitlement ON entitlement_edits(entitlement_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_edits_edited_at ON entitlement_edits(edited_at);

-- Enable RLS on entitlement_edits
ALTER TABLE entitlement_edits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS entitlement_edits_csm_select ON entitlement_edits;
DROP POLICY IF EXISTS entitlement_edits_csm_insert ON entitlement_edits;
DROP POLICY IF EXISTS entitlement_edits_admin_all ON entitlement_edits;

-- CSMs can see edits for entitlements they have access to
CREATE POLICY entitlement_edits_csm_select ON entitlement_edits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM entitlements e
      WHERE e.id = entitlement_edits.entitlement_id
    )
  );

-- CSMs can insert edits for entitlements they have access to
CREATE POLICY entitlement_edits_csm_insert ON entitlement_edits
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entitlements e
      WHERE e.id = entitlement_edits.entitlement_id
    )
  );

-- Admins have full access
CREATE POLICY entitlement_edits_admin_all ON entitlement_edits
  FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ================================================
-- INDEXES FOR ENTITLEMENTS (only if columns exist)
-- ================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entitlements' AND column_name = 'sku') THEN
    CREATE INDEX IF NOT EXISTS idx_entitlements_sku ON entitlements(sku);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entitlements' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_entitlements_status ON entitlements(status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entitlements' AND column_name = 'is_active') THEN
    CREATE INDEX IF NOT EXISTS idx_entitlements_is_active ON entitlements(is_active) WHERE is_active = true;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entitlements' AND column_name = 'renewal_date') THEN
    CREATE INDEX IF NOT EXISTS idx_entitlements_renewal_date ON entitlements(renewal_date);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entitlements' AND column_name = 'customer_id') THEN
    CREATE INDEX IF NOT EXISTS idx_entitlements_customer_status ON entitlements(customer_id, status);
  END IF;
END $$;

-- ================================================
-- INDEXES FOR CONTRACTS (only if columns exist)
-- ================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'contract_type') THEN
    CREATE INDEX IF NOT EXISTS idx_contracts_contract_type ON contracts(contract_type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'parsed_at') THEN
    CREATE INDEX IF NOT EXISTS idx_contracts_parsed_at ON contracts(parsed_at);
  END IF;
END $$;

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- ================================================
/*
To rollback, run:

-- Drop entitlement_edits table and policies
DROP POLICY IF EXISTS entitlement_edits_admin_all ON entitlement_edits;
DROP POLICY IF EXISTS entitlement_edits_csm_insert ON entitlement_edits;
DROP POLICY IF EXISTS entitlement_edits_csm_select ON entitlement_edits;
DROP TABLE IF EXISTS entitlement_edits;

-- Drop indexes
DROP INDEX IF EXISTS idx_contracts_parsed_at;
DROP INDEX IF EXISTS idx_contracts_contract_type;
DROP INDEX IF EXISTS idx_entitlements_customer_status;
DROP INDEX IF EXISTS idx_entitlements_renewal_date;
DROP INDEX IF EXISTS idx_entitlements_is_active;
DROP INDEX IF EXISTS idx_entitlements_status;
DROP INDEX IF EXISTS idx_entitlements_sku;

-- Remove entitlements columns (carefully)
ALTER TABLE entitlements
  DROP COLUMN IF EXISTS sku,
  DROP COLUMN IF EXISTS product_name,
  DROP COLUMN IF EXISTS quantity_unit,
  DROP COLUMN IF EXISTS usage_limit,
  DROP COLUMN IF EXISTS usage_unit,
  DROP COLUMN IF EXISTS usage_current,
  DROP COLUMN IF EXISTS support_tier,
  DROP COLUMN IF EXISTS sla_response_time,
  DROP COLUMN IF EXISTS sla_resolution_time,
  DROP COLUMN IF EXISTS effective_date,
  DROP COLUMN IF EXISTS renewal_date,
  DROP COLUMN IF EXISTS renewal_terms,
  DROP COLUMN IF EXISTS auto_renew,
  DROP COLUMN IF EXISTS unit_price,
  DROP COLUMN IF EXISTS total_price,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS billing_frequency,
  DROP COLUMN IF EXISTS confidence_sku,
  DROP COLUMN IF EXISTS confidence_quantity,
  DROP COLUMN IF EXISTS confidence_dates,
  DROP COLUMN IF EXISTS confidence_pricing,
  DROP COLUMN IF EXISTS confidence_overall,
  DROP COLUMN IF EXISTS special_clauses,
  DROP COLUMN IF EXISTS exclusions,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS source_section,
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS finalized_at,
  DROP COLUMN IF EXISTS finalized_by;

-- Remove contracts columns
ALTER TABLE contracts
  DROP COLUMN IF EXISTS contract_type,
  DROP COLUMN IF EXISTS file_type,
  DROP COLUMN IF EXISTS file_size,
  DROP COLUMN IF EXISTS extracted_text,
  DROP COLUMN IF EXISTS parsed_at,
  DROP COLUMN IF EXISTS error_message;
*/
