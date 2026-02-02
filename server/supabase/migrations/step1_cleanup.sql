-- STEP 1: Clean up any existing objects that might reference auth_user_id
-- Run this FIRST in Supabase SQL Editor

-- Drop existing policies if they exist
DROP POLICY IF EXISTS workspace_access ON public.workspaces;
DROP POLICY IF EXISTS user_profile_read ON public.user_profiles;
DROP POLICY IF EXISTS user_profile_update ON public.user_profiles;
DROP POLICY IF EXISTS workspace_members_access ON public.workspace_members;
DROP POLICY IF EXISTS invite_codes_admin ON public.invite_codes;
DROP POLICY IF EXISTS invite_attempts_service ON public.invite_code_attempts;
DROP POLICY IF EXISTS customer_imports_access ON public.customer_imports;
DROP POLICY IF EXISTS workspaces_service ON public.workspaces;
DROP POLICY IF EXISTS user_profiles_service ON public.user_profiles;
DROP POLICY IF EXISTS workspace_members_service ON public.workspace_members;
DROP POLICY IF EXISTS invite_codes_service ON public.invite_codes;
DROP POLICY IF EXISTS invite_attempts_service_role ON public.invite_code_attempts;
DROP POLICY IF EXISTS customer_imports_service ON public.customer_imports;

-- Drop triggers
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
DROP TRIGGER IF EXISTS update_workspace_members_updated_at ON public.workspace_members;
DROP TRIGGER IF EXISTS update_invite_codes_updated_at ON public.invite_codes;
DROP TRIGGER IF EXISTS update_customer_imports_updated_at ON public.customer_imports;

-- Now check what exists
SELECT 'Cleanup complete. Run step2_tables.sql next.' as status;
