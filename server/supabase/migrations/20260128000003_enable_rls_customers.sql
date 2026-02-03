-- ================================================
-- ENABLE ROW LEVEL SECURITY ON CUSTOMERS TABLE
-- Migration: 20260128_enable_rls_customers.sql
-- User Story: US-001 - Enable RLS on customers table
-- Purpose: CSMs should only see customers assigned to them
-- ================================================

-- Step 1: Add csm_user_id column if not exists
-- This links each customer to the CSM responsible for them
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS csm_user_id UUID REFERENCES auth.users(id);

-- Index for faster RLS policy evaluation
CREATE INDEX IF NOT EXISTS idx_customers_csm_user_id ON customers(csm_user_id);

-- Step 2: Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policy for CSMs to see only their assigned customers
-- Uses auth.uid() to get the currently authenticated user's ID
CREATE POLICY customers_csm_select_policy ON customers
  FOR SELECT
  USING (csm_user_id = auth.uid());

-- Step 4: Create policy for CSMs to update their assigned customers
CREATE POLICY customers_csm_update_policy ON customers
  FOR UPDATE
  USING (csm_user_id = auth.uid())
  WITH CHECK (csm_user_id = auth.uid());

-- Step 5: Create policy for CSMs to insert customers (assigned to themselves)
CREATE POLICY customers_csm_insert_policy ON customers
  FOR INSERT
  WITH CHECK (csm_user_id = auth.uid());

-- Step 6: Create admin policy - admins can see all customers
-- Admins are identified by raw_user_meta_data->>'role' = 'admin'
CREATE POLICY customers_admin_select_policy ON customers
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admin update policy
CREATE POLICY customers_admin_update_policy ON customers
  FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admin insert policy
CREATE POLICY customers_admin_insert_policy ON customers
  FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Admin delete policy
CREATE POLICY customers_admin_delete_policy ON customers
  FOR DELETE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- To undo this migration, run:
-- ================================================
/*
DROP POLICY IF EXISTS customers_admin_delete_policy ON customers;
DROP POLICY IF EXISTS customers_admin_insert_policy ON customers;
DROP POLICY IF EXISTS customers_admin_update_policy ON customers;
DROP POLICY IF EXISTS customers_admin_select_policy ON customers;
DROP POLICY IF EXISTS customers_csm_insert_policy ON customers;
DROP POLICY IF EXISTS customers_csm_update_policy ON customers;
DROP POLICY IF EXISTS customers_csm_select_policy ON customers;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
DROP INDEX IF EXISTS idx_customers_csm_user_id;
ALTER TABLE customers DROP COLUMN IF EXISTS csm_user_id;
*/

-- ================================================
-- COMMENTS
-- ================================================
COMMENT ON COLUMN customers.csm_user_id IS 'UUID of the CSM (Customer Success Manager) responsible for this customer. References auth.users(id) for RLS policy enforcement.';
