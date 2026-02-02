-- STEP 0: Diagnostic - Run this FIRST to see what exists
-- This will help identify what's causing the auth_user_id error

-- Check if user_profiles table exists
SELECT 'user_profiles table exists: ' || EXISTS (
  SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles'
)::text as check1;

-- Check if user_profiles has auth_user_id column
SELECT 'auth_user_id column exists: ' || EXISTS (
  SELECT FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name = 'auth_user_id'
)::text as check2;

-- List all RLS policies that might reference auth_user_id
SELECT
  'Policy: ' || policyname || ' on ' || tablename as policy_info,
  pg_get_expr(qual, relid) as policy_definition
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname IN ('workspaces', 'user_profiles', 'workspace_members', 'invite_codes', 'customer_imports')
ORDER BY tablename, policyname;

-- List all triggers
SELECT
  'Trigger: ' || trigger_name || ' on ' || event_object_table as trigger_info
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table IN ('workspaces', 'user_profiles', 'workspace_members', 'invite_codes', 'customer_imports');

-- List all functions that might reference auth_user_id
SELECT
  'Function: ' || routine_name as func_info
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition LIKE '%auth_user_id%';

-- Show existing tables
SELECT 'Existing PRD-1 tables:' as info;
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('workspaces', 'user_profiles', 'workspace_members', 'invite_codes', 'invite_code_attempts', 'customer_imports');
