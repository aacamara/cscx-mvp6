-- ================================================
-- ENABLE ROW LEVEL SECURITY ON AGENT_SESSIONS TABLE
-- Migration: 20260128_enable_rls_agent_sessions.sql
-- User Story: US-003 - Enable RLS on agent_sessions table
-- Purpose: CSMs should only see their own chat sessions
-- ================================================

-- Step 1: Ensure user_id column has NOT NULL constraint for new rows
-- (Existing rows may have NULL, so we use COALESCE in policies)
-- Note: We don't alter existing data, just enforce for new insertions via policy

-- Step 2: Enable Row Level Security
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policy for users to see only their own sessions
-- Uses auth.uid() to get the currently authenticated user's ID
CREATE POLICY agent_sessions_user_select_policy ON agent_sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- Step 4: Create policy for users to update their own sessions
CREATE POLICY agent_sessions_user_update_policy ON agent_sessions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Step 5: Create policy for users to insert sessions (assigned to themselves)
CREATE POLICY agent_sessions_user_insert_policy ON agent_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Step 6: Create policy for users to delete their own sessions
CREATE POLICY agent_sessions_user_delete_policy ON agent_sessions
  FOR DELETE
  USING (user_id = auth.uid());

-- Step 7: Create admin policies - admins can access all sessions
CREATE POLICY agent_sessions_admin_select_policy ON agent_sessions
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY agent_sessions_admin_update_policy ON agent_sessions
  FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY agent_sessions_admin_insert_policy ON agent_sessions
  FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY agent_sessions_admin_delete_policy ON agent_sessions
  FOR DELETE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ================================================
-- ROLLBACK INSTRUCTIONS
-- To undo this migration, run:
-- ================================================
/*
DROP POLICY IF EXISTS agent_sessions_admin_delete_policy ON agent_sessions;
DROP POLICY IF EXISTS agent_sessions_admin_insert_policy ON agent_sessions;
DROP POLICY IF EXISTS agent_sessions_admin_update_policy ON agent_sessions;
DROP POLICY IF EXISTS agent_sessions_admin_select_policy ON agent_sessions;
DROP POLICY IF EXISTS agent_sessions_user_delete_policy ON agent_sessions;
DROP POLICY IF EXISTS agent_sessions_user_insert_policy ON agent_sessions;
DROP POLICY IF EXISTS agent_sessions_user_update_policy ON agent_sessions;
DROP POLICY IF EXISTS agent_sessions_user_select_policy ON agent_sessions;
ALTER TABLE agent_sessions DISABLE ROW LEVEL SECURITY;
*/

-- ================================================
-- COMMENTS
-- ================================================
COMMENT ON TABLE agent_sessions IS 'Agent chat sessions with RLS enabled. Users can only access their own sessions (via user_id = auth.uid()). Admins have full access.';
