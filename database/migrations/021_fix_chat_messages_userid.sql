-- ==============================================================================
-- MIGRATION: 021_fix_chat_messages_userid.sql
-- Description: Fix chat_messages user_id to work with Supabase auth.uid() directly
-- Date: 2026-01-29
-- User Story: US-001 - Fix chat_messages table schema for Supabase auth
-- ==============================================================================
--
-- Problem:
--   chat_messages.user_id references public.users(id), but chat messages are
--   saved using auth.uid() directly. If the user doesn't exist in public.users,
--   the insert fails with a foreign key constraint error.
--
-- Solution:
--   1. Drop the foreign key constraint on user_id
--   2. Keep user_id as UUID type (stores auth.uid() directly)
--   3. Enable RLS so users can only access their own messages
--   4. Add index on user_id for performance
--
-- ==============================================================================

-- ==============================================================================
-- PART 1: DROP FOREIGN KEY CONSTRAINT (if exists)
-- ==============================================================================
-- We need to find and drop the FK constraint. In PostgreSQL, we can do this
-- by querying the constraint name or using a DO block.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find the foreign key constraint on user_id referencing users table
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'chat_messages'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.column_name = 'user_id';

  -- Drop the constraint if it exists
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE chat_messages DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped foreign key constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'No foreign key constraint found on chat_messages.user_id';
  END IF;
END $$;

-- ==============================================================================
-- PART 2: ENSURE USER_ID IS UUID TYPE (should already be, but verify)
-- ==============================================================================
-- The column should already be UUID from the original migration.
-- No changes needed here, but we add a comment for clarity.

COMMENT ON COLUMN chat_messages.user_id IS 'UUID of the user who sent this message. Stores auth.uid() directly without FK to public.users for flexibility with Supabase auth.';

-- ==============================================================================
-- PART 3: ENSURE INDEX EXISTS ON USER_ID
-- ==============================================================================
-- Create index if not exists (original migration may have created it)
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, created_at DESC);

-- ==============================================================================
-- PART 4: ENABLE ROW LEVEL SECURITY
-- ==============================================================================
-- Enable RLS on chat_messages table
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS chat_messages_user_select_policy ON chat_messages;
DROP POLICY IF EXISTS chat_messages_user_insert_policy ON chat_messages;
DROP POLICY IF EXISTS chat_messages_user_update_policy ON chat_messages;
DROP POLICY IF EXISTS chat_messages_user_delete_policy ON chat_messages;
DROP POLICY IF EXISTS chat_messages_admin_select_policy ON chat_messages;
DROP POLICY IF EXISTS chat_messages_admin_all_policy ON chat_messages;

-- User policies: Users can only read/write their own messages
CREATE POLICY chat_messages_user_select_policy ON chat_messages
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY chat_messages_user_insert_policy ON chat_messages
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY chat_messages_user_update_policy ON chat_messages
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY chat_messages_user_delete_policy ON chat_messages
  FOR DELETE
  USING (user_id = auth.uid());

-- Admin policies: Full access to all messages
CREATE POLICY chat_messages_admin_select_policy ON chat_messages
  FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY chat_messages_admin_all_policy ON chat_messages
  FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

COMMENT ON TABLE chat_messages IS 'Chat message history with RLS. Users can only access their own messages. user_id stores auth.uid() directly.';

-- ==============================================================================
-- ROLLBACK INSTRUCTIONS
-- ==============================================================================
-- To undo this migration, run:
--
-- -- Remove RLS policies
-- DROP POLICY IF EXISTS chat_messages_admin_all_policy ON chat_messages;
-- DROP POLICY IF EXISTS chat_messages_admin_select_policy ON chat_messages;
-- DROP POLICY IF EXISTS chat_messages_user_delete_policy ON chat_messages;
-- DROP POLICY IF EXISTS chat_messages_user_update_policy ON chat_messages;
-- DROP POLICY IF EXISTS chat_messages_user_insert_policy ON chat_messages;
-- DROP POLICY IF EXISTS chat_messages_user_select_policy ON chat_messages;
-- ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
--
-- -- Re-add foreign key constraint (if you want to restore it)
-- ALTER TABLE chat_messages
--   ADD CONSTRAINT chat_messages_user_id_fkey
--   FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
--
-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
