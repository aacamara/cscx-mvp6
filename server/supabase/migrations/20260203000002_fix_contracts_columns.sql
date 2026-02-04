-- Migration: Fix contracts table missing columns
-- Date: 2026-02-03
-- Issue: Backend expects total_value, start_date, end_date columns

-- Add missing columns to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS total_value DECIMAL(12,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON contracts(start_date, end_date);

-- Comment
COMMENT ON COLUMN contracts.total_value IS 'Total contract value (may differ from ARR for multi-year deals)';
COMMENT ON COLUMN contracts.start_date IS 'Contract start date extracted from document';
COMMENT ON COLUMN contracts.end_date IS 'Contract end date extracted from document';
