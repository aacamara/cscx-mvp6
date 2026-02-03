-- ================================================
-- ENABLE ROW LEVEL SECURITY ON CONTRACTS TABLE
-- Migration: 20260128_enable_rls_contracts.sql
-- User Story: US-002 - Enable RLS on contracts table
-- Purpose: CSMs should only see contracts for their assigned customers
-- ================================================

-- Step 1: Enable Row Level Security
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policy for CSMs to see contracts for their assigned customers
-- Joins through customer_id to customers table to check csm_user_id
CREATE POLICY contracts_csm_select_policy ON contracts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contracts.customer_id
      AND customers.csm_user_id = auth.uid()
    )
  );

-- Step 3: Create policy for CSMs to update contracts for their customers
CREATE POLICY contracts_csm_update_policy ON contracts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contracts.customer_id
      AND customers.csm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contracts.customer_id
      AND customers.csm_user_id = auth.uid()
    )
  );

-- Step 4: Create policy for CSMs to insert contracts for their customers
CREATE POLICY contracts_csm_insert_policy ON contracts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contracts.customer_id
      AND customers.csm_user_id = auth.uid()
    )
  );

-- Step 5: Create policy for CSMs to delete contracts for their customers
CREATE POLICY contracts_csm_delete_policy ON contracts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contracts.customer_id
      AND customers.csm_user_id = auth.uid()
    )
  );

-- Step 6: Create admin policies - admins can access all contracts
CREATE POLICY contracts_admin_select_policy ON contracts
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY contracts_admin_update_policy ON contracts
  FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY contracts_admin_insert_policy ON contracts
  FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY contracts_admin_delete_policy ON contracts
  FOR DELETE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- To undo this migration, run:
-- ================================================
/*
DROP POLICY IF EXISTS contracts_admin_delete_policy ON contracts;
DROP POLICY IF EXISTS contracts_admin_insert_policy ON contracts;
DROP POLICY IF EXISTS contracts_admin_update_policy ON contracts;
DROP POLICY IF EXISTS contracts_admin_select_policy ON contracts;
DROP POLICY IF EXISTS contracts_csm_delete_policy ON contracts;
DROP POLICY IF EXISTS contracts_csm_insert_policy ON contracts;
DROP POLICY IF EXISTS contracts_csm_update_policy ON contracts;
DROP POLICY IF EXISTS contracts_csm_select_policy ON contracts;
ALTER TABLE contracts DISABLE ROW LEVEL SECURITY;
*/

-- ================================================
-- COMMENTS
-- ================================================
COMMENT ON TABLE contracts IS 'Contracts table with RLS enabled. CSMs can only access contracts for customers assigned to them (via customers.csm_user_id). Admins have full access.';
