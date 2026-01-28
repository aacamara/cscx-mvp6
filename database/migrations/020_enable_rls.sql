-- ==============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) FOR MULTI-TENANT SAFETY
-- Migration: 020_enable_rls.sql
-- Date: 2026-01-28
-- User Stories: US-001, US-002, US-003, US-004
-- Purpose: Production security hardening - ensure CSMs only see their own data
-- ==============================================================================
--
-- This migration enables RLS on the following tables:
--   1. customers     - CSMs see only customers assigned to them
--   2. contracts     - CSMs see only contracts for their customers
--   3. agent_sessions - Users see only their own chat sessions
--   4. tasks         - CSMs see only tasks for their customers
--
-- Policy Pattern:
--   - CSM/User policies: Use auth.uid() to filter by ownership
--   - Admin policies: Check (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
--   - Child tables: Use EXISTS subquery to join to parent for ownership check
--
-- ==============================================================================

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- PART 1: CUSTOMERS TABLE
-- ==============================================================================

-- Add csm_user_id column if not exists (links customer to responsible CSM)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS csm_user_id UUID REFERENCES auth.users(id);

-- Index for faster RLS policy evaluation
CREATE INDEX IF NOT EXISTS idx_customers_csm_user_id ON customers(csm_user_id);

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- CSM policies: Only see customers assigned to them
CREATE POLICY customers_csm_select_policy ON customers
  FOR SELECT
  USING (csm_user_id = auth.uid());

CREATE POLICY customers_csm_update_policy ON customers
  FOR UPDATE
  USING (csm_user_id = auth.uid())
  WITH CHECK (csm_user_id = auth.uid());

CREATE POLICY customers_csm_insert_policy ON customers
  FOR INSERT
  WITH CHECK (csm_user_id = auth.uid());

-- Admin policies: Full access to all customers
CREATE POLICY customers_admin_select_policy ON customers
  FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY customers_admin_update_policy ON customers
  FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY customers_admin_insert_policy ON customers
  FOR INSERT
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY customers_admin_delete_policy ON customers
  FOR DELETE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

COMMENT ON COLUMN customers.csm_user_id IS 'UUID of the CSM responsible for this customer. References auth.users(id) for RLS policy enforcement.';

-- ==============================================================================
-- PART 2: CONTRACTS TABLE
-- ==============================================================================

-- Enable Row Level Security
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- CSM policies: See contracts only for their assigned customers
-- Uses EXISTS subquery to join through customer_id -> customers.csm_user_id
CREATE POLICY contracts_csm_select_policy ON contracts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contracts.customer_id
        AND customers.csm_user_id = auth.uid()
    )
  );

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

CREATE POLICY contracts_csm_insert_policy ON contracts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contracts.customer_id
        AND customers.csm_user_id = auth.uid()
    )
  );

CREATE POLICY contracts_csm_delete_policy ON contracts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = contracts.customer_id
        AND customers.csm_user_id = auth.uid()
    )
  );

-- Admin policies: Full access to all contracts
CREATE POLICY contracts_admin_select_policy ON contracts
  FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY contracts_admin_update_policy ON contracts
  FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY contracts_admin_insert_policy ON contracts
  FOR INSERT
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY contracts_admin_delete_policy ON contracts
  FOR DELETE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

COMMENT ON TABLE contracts IS 'Contracts with RLS enabled. CSMs access only contracts for their customers.';

-- ==============================================================================
-- PART 3: AGENT_SESSIONS TABLE
-- ==============================================================================

-- Enable Row Level Security
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- User policies: Users can only access their own sessions
CREATE POLICY agent_sessions_user_select_policy ON agent_sessions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY agent_sessions_user_update_policy ON agent_sessions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY agent_sessions_user_insert_policy ON agent_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY agent_sessions_user_delete_policy ON agent_sessions
  FOR DELETE
  USING (user_id = auth.uid());

-- Admin policies: Full access to all sessions
CREATE POLICY agent_sessions_admin_select_policy ON agent_sessions
  FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY agent_sessions_admin_update_policy ON agent_sessions
  FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY agent_sessions_admin_insert_policy ON agent_sessions
  FOR INSERT
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY agent_sessions_admin_delete_policy ON agent_sessions
  FOR DELETE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

COMMENT ON TABLE agent_sessions IS 'Agent chat sessions with RLS. Users access only their own sessions.';

-- ==============================================================================
-- PART 4: TASKS TABLE
-- ==============================================================================

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- CSM policies: See tasks only for their assigned customers
-- Uses EXISTS subquery to join through customer_id -> customers.csm_user_id
CREATE POLICY tasks_csm_select_policy ON tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = tasks.customer_id
        AND customers.csm_user_id = auth.uid()
    )
  );

CREATE POLICY tasks_csm_update_policy ON tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = tasks.customer_id
        AND customers.csm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = tasks.customer_id
        AND customers.csm_user_id = auth.uid()
    )
  );

CREATE POLICY tasks_csm_insert_policy ON tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = tasks.customer_id
        AND customers.csm_user_id = auth.uid()
    )
  );

CREATE POLICY tasks_csm_delete_policy ON tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = tasks.customer_id
        AND customers.csm_user_id = auth.uid()
    )
  );

-- Admin policies: Full access to all tasks
CREATE POLICY tasks_admin_select_policy ON tasks
  FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY tasks_admin_update_policy ON tasks
  FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY tasks_admin_insert_policy ON tasks
  FOR INSERT
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY tasks_admin_delete_policy ON tasks
  FOR DELETE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

COMMENT ON TABLE tasks IS 'Onboarding tasks with RLS. CSMs access only tasks for their customers.';

-- ==============================================================================
-- ROLLBACK INSTRUCTIONS
-- ==============================================================================
-- To undo this migration, run the following commands in order:
--
-- -- Part 4: Tasks rollback
-- DROP POLICY IF EXISTS tasks_admin_delete_policy ON tasks;
-- DROP POLICY IF EXISTS tasks_admin_insert_policy ON tasks;
-- DROP POLICY IF EXISTS tasks_admin_update_policy ON tasks;
-- DROP POLICY IF EXISTS tasks_admin_select_policy ON tasks;
-- DROP POLICY IF EXISTS tasks_csm_delete_policy ON tasks;
-- DROP POLICY IF EXISTS tasks_csm_insert_policy ON tasks;
-- DROP POLICY IF EXISTS tasks_csm_update_policy ON tasks;
-- DROP POLICY IF EXISTS tasks_csm_select_policy ON tasks;
-- ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
--
-- -- Part 3: Agent sessions rollback
-- DROP POLICY IF EXISTS agent_sessions_admin_delete_policy ON agent_sessions;
-- DROP POLICY IF EXISTS agent_sessions_admin_insert_policy ON agent_sessions;
-- DROP POLICY IF EXISTS agent_sessions_admin_update_policy ON agent_sessions;
-- DROP POLICY IF EXISTS agent_sessions_admin_select_policy ON agent_sessions;
-- DROP POLICY IF EXISTS agent_sessions_user_delete_policy ON agent_sessions;
-- DROP POLICY IF EXISTS agent_sessions_user_insert_policy ON agent_sessions;
-- DROP POLICY IF EXISTS agent_sessions_user_update_policy ON agent_sessions;
-- DROP POLICY IF EXISTS agent_sessions_user_select_policy ON agent_sessions;
-- ALTER TABLE agent_sessions DISABLE ROW LEVEL SECURITY;
--
-- -- Part 2: Contracts rollback
-- DROP POLICY IF EXISTS contracts_admin_delete_policy ON contracts;
-- DROP POLICY IF EXISTS contracts_admin_insert_policy ON contracts;
-- DROP POLICY IF EXISTS contracts_admin_update_policy ON contracts;
-- DROP POLICY IF EXISTS contracts_admin_select_policy ON contracts;
-- DROP POLICY IF EXISTS contracts_csm_delete_policy ON contracts;
-- DROP POLICY IF EXISTS contracts_csm_insert_policy ON contracts;
-- DROP POLICY IF EXISTS contracts_csm_update_policy ON contracts;
-- DROP POLICY IF EXISTS contracts_csm_select_policy ON contracts;
-- ALTER TABLE contracts DISABLE ROW LEVEL SECURITY;
--
-- -- Part 1: Customers rollback
-- DROP POLICY IF EXISTS customers_admin_delete_policy ON customers;
-- DROP POLICY IF EXISTS customers_admin_insert_policy ON customers;
-- DROP POLICY IF EXISTS customers_admin_update_policy ON customers;
-- DROP POLICY IF EXISTS customers_admin_select_policy ON customers;
-- DROP POLICY IF EXISTS customers_csm_insert_policy ON customers;
-- DROP POLICY IF EXISTS customers_csm_update_policy ON customers;
-- DROP POLICY IF EXISTS customers_csm_select_policy ON customers;
-- ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS idx_customers_csm_user_id;
-- ALTER TABLE customers DROP COLUMN IF EXISTS csm_user_id;
--
-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
