-- PRD-1: Gated Login + Onboarding Database Schema
-- Migration: 20260202000001_prd1_gated_login.sql
-- Author: Claude Code (Principal Engineer)
-- Date: 2026-02-02

-- =====================================================
-- WORKSPACES TABLE
-- Multi-tenant workspace isolation
-- =====================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);

-- =====================================================
-- USER PROFILES TABLE
-- Extended user data beyond Supabase auth.users
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL, -- References Supabase auth.users
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  default_workspace_id UUID REFERENCES public.workspaces(id),
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_checklist JSONB DEFAULT '{
    "google_connected": false,
    "customers_imported": false,
    "first_success_plan": false
  }',
  first_login_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user ON public.user_profiles(auth_user_id);

-- =====================================================
-- WORKSPACE MEMBERS TABLE
-- Links users to workspaces with roles
-- =====================================================

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member', -- admin, member, viewer
  invited_by_invite_id UUID,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

-- =====================================================
-- INVITE CODES TABLE
-- Gated access via invite codes
-- =====================================================

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE, -- SHA256 hash of the code
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  max_uses INTEGER DEFAULT 1,
  uses_remaining INTEGER DEFAULT 1,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.user_profiles(id),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}', -- For tracking source, campaign, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_workspace ON public.invite_codes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_active ON public.invite_codes(is_active) WHERE is_active = true;

-- =====================================================
-- INVITE CODE ATTEMPTS TABLE
-- Security audit logging for invite attempts
-- =====================================================

CREATE TABLE IF NOT EXISTS public.invite_code_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT, -- Hash of attempted code (for matching)
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT false,
  user_id UUID REFERENCES public.user_profiles(id),
  error_code VARCHAR(50), -- INVALID_CODE, EXPIRED_CODE, CODE_EXHAUSTED, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_attempts_ip ON public.invite_code_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_invite_attempts_created ON public.invite_code_attempts(created_at);

-- =====================================================
-- CUSTOMER IMPORTS TABLE
-- Track bulk import operations
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customer_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id),
  user_id UUID REFERENCES public.user_profiles(id),
  source_type VARCHAR(50) NOT NULL, -- 'google_sheets', 'csv', 'hubspot'
  source_ref TEXT, -- Spreadsheet ID, filename, etc.
  source_name TEXT, -- Human-readable name
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  total_rows INTEGER DEFAULT 0,
  created_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_details JSONB DEFAULT '[]', -- Array of {row, reason}
  column_mapping JSONB, -- {name: 'A', arr: 'B', ...}
  dedup_action VARCHAR(50) DEFAULT 'skip', -- update, skip, create_duplicate
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_imports_workspace ON public.customer_imports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_customer_imports_status ON public.customer_imports(status);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_code_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_imports ENABLE ROW LEVEL SECURITY;

-- Workspaces: Users can only see workspaces they're members of
CREATE POLICY workspace_access ON public.workspaces
  FOR ALL USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members wm
      JOIN public.user_profiles up ON wm.user_id = up.id
      WHERE up.auth_user_id = auth.uid()
    )
  );

-- User Profiles: Users can read their own profile
CREATE POLICY user_profile_read ON public.user_profiles
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY user_profile_update ON public.user_profiles
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Workspace Members: Users can see members of their workspaces
CREATE POLICY workspace_members_access ON public.workspace_members
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members wm
      JOIN public.user_profiles up ON wm.user_id = up.id
      WHERE up.auth_user_id = auth.uid()
    )
  );

-- Invite Codes: Workspace admins can manage
CREATE POLICY invite_codes_admin ON public.invite_codes
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members wm
      JOIN public.user_profiles up ON wm.user_id = up.id
      WHERE up.auth_user_id = auth.uid() AND wm.role = 'admin'
    )
  );

-- Invite Code Attempts: Service role only (for audit)
CREATE POLICY invite_attempts_service ON public.invite_code_attempts
  FOR ALL USING (false);

-- Customer Imports: Users can see imports in their workspace
CREATE POLICY customer_imports_access ON public.customer_imports
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members wm
      JOIN public.user_profiles up ON wm.user_id = up.id
      WHERE up.auth_user_id = auth.uid()
    )
  );

-- =====================================================
-- SERVICE ROLE BYPASS FOR API
-- =====================================================

-- These policies allow the service role to bypass RLS
-- The backend API uses the service role key

CREATE POLICY workspaces_service ON public.workspaces
  FOR ALL TO service_role USING (true);

CREATE POLICY user_profiles_service ON public.user_profiles
  FOR ALL TO service_role USING (true);

CREATE POLICY workspace_members_service ON public.workspace_members
  FOR ALL TO service_role USING (true);

CREATE POLICY invite_codes_service ON public.invite_codes
  FOR ALL TO service_role USING (true);

CREATE POLICY invite_attempts_service_role ON public.invite_code_attempts
  FOR ALL TO service_role USING (true);

CREATE POLICY customer_imports_service ON public.customer_imports
  FOR ALL TO service_role USING (true);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_members_updated_at
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invite_codes_updated_at
  BEFORE UPDATE ON public.invite_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_imports_updated_at
  BEFORE UPDATE ON public.customer_imports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA: Default Workspace for Development
-- =====================================================

INSERT INTO public.workspaces (id, name, slug, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'CSCX Design Partners',
  'cscx-partners',
  '{"tier": "enterprise", "features": ["all"]}'
)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- ROLLBACK INSTRUCTIONS
-- =====================================================
-- To rollback this migration:
--
-- DROP TRIGGER IF EXISTS update_customer_imports_updated_at ON public.customer_imports;
-- DROP TRIGGER IF EXISTS update_invite_codes_updated_at ON public.invite_codes;
-- DROP TRIGGER IF EXISTS update_workspace_members_updated_at ON public.workspace_members;
-- DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
-- DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS public.customer_imports;
-- DROP TABLE IF EXISTS public.invite_code_attempts;
-- DROP TABLE IF EXISTS public.invite_codes;
-- DROP TABLE IF EXISTS public.workspace_members;
-- DROP TABLE IF EXISTS public.user_profiles;
-- DROP TABLE IF EXISTS public.workspaces;
