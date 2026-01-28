-- ================================================
-- ENABLE ROW LEVEL SECURITY ON TASKS TABLE
-- Migration: 20260128_enable_rls_tasks.sql
-- User Story: US-004 - Enable RLS on tasks table
-- Purpose: CSMs should only see tasks for their customers
-- ================================================

-- Step 1: Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policy for CSMs to see tasks for their customers
-- Tasks link through customer_id -> customers -> csm_user_id
CREATE POLICY tasks_csm_select_policy ON tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = tasks.customer_id
        AND customers.csm_user_id = auth.uid()
    )
  );

-- Step 3: Create policy for CSMs to update tasks for their customers
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

-- Step 4: Create policy for CSMs to insert tasks for their customers
CREATE POLICY tasks_csm_insert_policy ON tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = tasks.customer_id
        AND customers.csm_user_id = auth.uid()
    )
  );

-- Step 5: Create policy for CSMs to delete tasks for their customers
CREATE POLICY tasks_csm_delete_policy ON tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = tasks.customer_id
        AND customers.csm_user_id = auth.uid()
    )
  );

-- Step 6: Create admin policies - admins can access all tasks
CREATE POLICY tasks_admin_select_policy ON tasks
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY tasks_admin_update_policy ON tasks
  FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY tasks_admin_insert_policy ON tasks
  FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY tasks_admin_delete_policy ON tasks
  FOR DELETE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- To undo this migration, run:
-- ================================================
/*
DROP POLICY IF EXISTS tasks_admin_delete_policy ON tasks;
DROP POLICY IF EXISTS tasks_admin_insert_policy ON tasks;
DROP POLICY IF EXISTS tasks_admin_update_policy ON tasks;
DROP POLICY IF EXISTS tasks_admin_select_policy ON tasks;
DROP POLICY IF EXISTS tasks_csm_delete_policy ON tasks;
DROP POLICY IF EXISTS tasks_csm_insert_policy ON tasks;
DROP POLICY IF EXISTS tasks_csm_update_policy ON tasks;
DROP POLICY IF EXISTS tasks_csm_select_policy ON tasks;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
*/

-- ================================================
-- COMMENTS
-- ================================================
COMMENT ON TABLE tasks IS 'Onboarding tasks with RLS enabled. CSMs can only access tasks for their assigned customers (via customer_id -> customers.csm_user_id = auth.uid()). Admins have full access.';
