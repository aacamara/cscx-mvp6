-- Migration 018: Add plan_tasks table and update contracts table
-- Required for P1 features: Plan Completion Tracking & Contract List

-- ============================================
-- Update contracts table with additional columns
-- ============================================

-- Add missing columns to contracts table (if they don't exist)
DO $$
BEGIN
  -- file_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'file_type') THEN
    ALTER TABLE public.contracts ADD COLUMN file_type TEXT;
  END IF;

  -- file_size column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'file_size') THEN
    ALTER TABLE public.contracts ADD COLUMN file_size INTEGER;
  END IF;

  -- company_name column (extracted from contract for quick queries)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'company_name') THEN
    ALTER TABLE public.contracts ADD COLUMN company_name TEXT;
  END IF;

  -- arr column (Annual Recurring Revenue)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'arr') THEN
    ALTER TABLE public.contracts ADD COLUMN arr NUMERIC(12, 2);
  END IF;

  -- contract_period column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'contract_period') THEN
    ALTER TABLE public.contracts ADD COLUMN contract_period TEXT;
  END IF;

  -- contract_term column (alias)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'contract_term') THEN
    ALTER TABLE public.contracts ADD COLUMN contract_term TEXT;
  END IF;

  -- raw_text column for storing extracted text
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'raw_text') THEN
    ALTER TABLE public.contracts ADD COLUMN raw_text TEXT;
  END IF;

  -- confidence column for AI extraction confidence
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'contracts'
                 AND column_name = 'confidence') THEN
    ALTER TABLE public.contracts ADD COLUMN confidence NUMERIC(3, 2);
  END IF;
END $$;

-- Create index for faster company name searches
CREATE INDEX IF NOT EXISTS idx_contracts_company_name ON public.contracts(company_name);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_customer_id ON public.contracts(customer_id);

-- ============================================
-- Create plan_tasks table for tracking onboarding progress
-- ============================================

CREATE TABLE IF NOT EXISTS public.plan_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID,

  -- Task identification within the plan
  phase_index INTEGER NOT NULL,
  task_index INTEGER NOT NULL,

  -- Task details (denormalized from plan for persistence)
  phase_name TEXT,
  task_title TEXT,
  task_description TEXT,
  owner TEXT, -- CSM, AE, SA, Customer, etc.

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'skipped')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one task per phase_index/task_index per customer
  UNIQUE(customer_id, phase_index, task_index)
);

-- Indexes for plan_tasks
CREATE INDEX IF NOT EXISTS idx_plan_tasks_customer_id ON public.plan_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_status ON public.plan_tasks(status);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_phase ON public.plan_tasks(customer_id, phase_index);

-- ============================================
-- Update trigger for updated_at
-- ============================================

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to plan_tasks
DROP TRIGGER IF EXISTS update_plan_tasks_updated_at ON public.plan_tasks;
CREATE TRIGGER update_plan_tasks_updated_at
  BEFORE UPDATE ON public.plan_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to contracts if not exists
DROP TRIGGER IF EXISTS update_contracts_updated_at ON public.contracts;
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE public.plan_tasks IS 'Tracks completion status of onboarding plan tasks per customer';
COMMENT ON COLUMN public.plan_tasks.phase_index IS 'Index of the phase in the onboarding plan (0-based)';
COMMENT ON COLUMN public.plan_tasks.task_index IS 'Index of the task within the phase (0-based)';
COMMENT ON COLUMN public.plan_tasks.status IS 'Current status: pending, in_progress, completed, blocked, skipped';
