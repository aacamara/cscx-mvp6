-- ============================================
-- Fix user_id columns for development flexibility
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop foreign key constraints that reference user_profiles
ALTER TABLE public.agent_runs DROP CONSTRAINT IF EXISTS agent_runs_user_id_fkey;
ALTER TABLE public.agent_sessions DROP CONSTRAINT IF EXISTS agent_sessions_user_id_fkey;
ALTER TABLE public.approvals DROP CONSTRAINT IF EXISTS approvals_decided_by_fkey;
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_created_by_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;

-- Change user_id columns to TEXT type for flexibility
ALTER TABLE public.agent_runs ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.agent_sessions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.approvals ALTER COLUMN decided_by TYPE TEXT USING decided_by::TEXT;
ALTER TABLE public.meetings ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.tasks ALTER COLUMN assignee_id TYPE TEXT USING assignee_id::TEXT;

-- Add indexes for the text user_id columns
DROP INDEX IF EXISTS idx_agent_runs_user;
CREATE INDEX idx_agent_runs_user ON public.agent_runs(user_id);

DROP INDEX IF EXISTS idx_agent_sessions_user;
CREATE INDEX idx_agent_sessions_user ON public.agent_sessions(user_id);

-- Done!
SELECT 'Migration 003 completed: user_id columns converted to TEXT' AS status;
