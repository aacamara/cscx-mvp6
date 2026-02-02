-- ============================================
-- PRD-0: Contract Parsing + Entitlements Normalization
-- Migration: 067_prd0_contract_parsing.sql
-- Created: 2026-02-01
-- ============================================

-- ============================================
-- 1. Enhance contracts table
-- ============================================

-- Add new columns to contracts table
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS contract_type TEXT,
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add constraint for contract_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_contract_type_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_contract_type_check
      CHECK (contract_type IS NULL OR contract_type IN ('msa', 'sow', 'order_form', 'amendment'));
  END IF;
END $$;

-- Update status constraint to include new states
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_status_check
  CHECK (status IN ('pending', 'parsing', 'parsed', 'error', 'draft', 'active', 'expired', 'renewed'));

-- ============================================
-- 2. Enhance entitlements table
-- ============================================

-- Add new columns to entitlements table
ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS quantity_unit TEXT,
  ADD COLUMN IF NOT EXISTS usage_unit TEXT,
  ADD COLUMN IF NOT EXISTS support_tier TEXT,
  ADD COLUMN IF NOT EXISTS sla_response_time TEXT,
  ADD COLUMN IF NOT EXISTS sla_resolution_time TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS renewal_date DATE,
  ADD COLUMN IF NOT EXISTS renewal_terms TEXT,
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN,
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS billing_frequency TEXT,
  ADD COLUMN IF NOT EXISTS confidence_sku DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS confidence_quantity DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS confidence_dates DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS confidence_pricing DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS confidence_overall DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS special_clauses TEXT[],
  ADD COLUMN IF NOT EXISTS exclusions TEXT[],
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS source_section TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES public.user_profiles(id);

-- Add constraint for entitlement status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entitlements_status_check'
  ) THEN
    ALTER TABLE public.entitlements
      ADD CONSTRAINT entitlements_status_check
      CHECK (status IN ('draft', 'pending_review', 'finalized'));
  END IF;
END $$;

-- ============================================
-- 3. Create entitlement_edits table (HITL audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS public.entitlement_edits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entitlement_id UUID NOT NULL REFERENCES public.entitlements(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edited_by UUID REFERENCES public.user_profiles(id),
  edited_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Create indexes for performance
-- ============================================

-- Contract indexes
CREATE INDEX IF NOT EXISTS idx_contracts_customer ON public.contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON public.contracts(contract_type);
CREATE INDEX IF NOT EXISTS idx_contracts_parsed_at ON public.contracts(parsed_at);

-- Entitlement indexes
CREATE INDEX IF NOT EXISTS idx_entitlements_customer ON public.entitlements(customer_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_contract ON public.entitlements(contract_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_status ON public.entitlements(status);
CREATE INDEX IF NOT EXISTS idx_entitlements_active ON public.entitlements(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_entitlements_sku ON public.entitlements(sku);
CREATE INDEX IF NOT EXISTS idx_entitlements_renewal ON public.entitlements(renewal_date);

-- Entitlement edits indexes
CREATE INDEX IF NOT EXISTS idx_entitlement_edits_entitlement ON public.entitlement_edits(entitlement_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_edits_edited_at ON public.entitlement_edits(edited_at);

-- ============================================
-- 5. Add trigger for entitlements updated_at
-- ============================================

CREATE TRIGGER update_entitlements_updated_at
  BEFORE UPDATE ON public.entitlements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 6. Enable RLS on new table
-- ============================================

ALTER TABLE public.entitlement_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on entitlement_edits"
  ON public.entitlement_edits FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 7. Grant permissions
-- ============================================

GRANT ALL ON public.entitlement_edits TO anon, authenticated, service_role;

-- ============================================
-- Done
-- ============================================
