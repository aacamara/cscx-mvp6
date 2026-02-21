-- ============================================
-- Production Readiness: Ensure all org/auth tables exist
-- Safe to run multiple times (all IF NOT EXISTS)
-- Combines: 20260202 gated login + 20260215 multi-tenant
-- DEFENSIVE: handles pre-existing tables with missing columns
-- ============================================

-- Enable UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORGANIZATIONS (PRD-007)
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- ============================================
-- ORG MEMBERS (PRD-007)
-- ============================================
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'csm' CHECK (role IN ('admin', 'csm', 'viewer')),
  invited_by UUID,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'deactivated')),
  UNIQUE(organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON org_members(status);

-- ============================================
-- WORKSPACES (PRD-1 gated login)
-- ============================================
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

-- ============================================
-- USER PROFILES (defensive: add missing columns)
-- ============================================
DO $$ BEGIN
  -- Create table with minimal columns if it doesn't exist at all
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    CREATE TABLE public.user_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      auth_user_id UUID UNIQUE NOT NULL,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      avatar_url TEXT,
      default_workspace_id UUID REFERENCES public.workspaces(id),
      onboarding_completed BOOLEAN DEFAULT false,
      onboarding_checklist JSONB DEFAULT '{"google_connected": false, "customers_imported": false, "first_success_plan": false}',
      first_login_at TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      preferences JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    -- Table exists — add any missing columns
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS default_workspace_id UUID;
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT '{"google_connected": false, "customers_imported": false, "first_success_plan": false}';
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ;
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Indexes (only if columns exist)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'auth_user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user ON public.user_profiles(auth_user_id);
  END IF;
END $$;

-- ============================================
-- WORKSPACE MEMBERS (defensive)
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspace_members') THEN
    CREATE TABLE public.workspace_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      role VARCHAR(50) DEFAULT 'member',
      invited_by_invite_id UUID,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(workspace_id, user_id)
    );
  ELSE
    ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'member';
    ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS invited_by_invite_id UUID;
    ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

-- ============================================
-- INVITE CODES (defensive)
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invite_codes') THEN
    CREATE TABLE public.invite_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code_hash TEXT NOT NULL UNIQUE,
      workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
      max_uses INTEGER DEFAULT 1,
      uses_remaining INTEGER DEFAULT 1,
      expires_at TIMESTAMPTZ,
      created_by UUID,
      revoked_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT true,
      metadata JSONB DEFAULT '{}',
      organization_id UUID,
      role TEXT DEFAULT 'csm',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS organization_id UUID;
    ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'csm';
    ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 1;
    ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS uses_remaining INTEGER DEFAULT 1;
    ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
    ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_invite_codes_workspace ON public.invite_codes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_active ON public.invite_codes(is_active) WHERE is_active = true;

-- ============================================
-- INVITE CODE ATTEMPTS (audit log)
-- ============================================
CREATE TABLE IF NOT EXISTS public.invite_code_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT false,
  user_id UUID,
  error_code VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invite_attempts_ip ON public.invite_code_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_invite_attempts_created ON public.invite_code_attempts(created_at);

-- ============================================
-- CUSTOMER IMPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.customer_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  user_id UUID,
  source_type VARCHAR(50) NOT NULL DEFAULT 'csv',
  source_ref TEXT,
  source_name TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  total_rows INTEGER DEFAULT 0,
  created_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_details JSONB DEFAULT '[]',
  column_mapping JSONB,
  dedup_action VARCHAR(50) DEFAULT 'skip',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_imports_workspace ON public.customer_imports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_customer_imports_status ON public.customer_imports(status);

-- ============================================
-- RLS + SERVICE ROLE POLICIES
-- ============================================
DO $$ BEGIN
  ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.invite_code_attempts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.customer_imports ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS enable skipped (tables may already have RLS): %', SQLERRM;
END $$;

-- Service role bypass policies (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'workspaces_service') THEN
    EXECUTE 'CREATE POLICY workspaces_service ON public.workspaces FOR ALL TO service_role USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_service') THEN
    EXECUTE 'CREATE POLICY user_profiles_service ON public.user_profiles FOR ALL TO service_role USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'workspace_members_service') THEN
    EXECUTE 'CREATE POLICY workspace_members_service ON public.workspace_members FOR ALL TO service_role USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invite_codes' AND policyname = 'invite_codes_service') THEN
    EXECUTE 'CREATE POLICY invite_codes_service ON public.invite_codes FOR ALL TO service_role USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invite_code_attempts' AND policyname = 'invite_attempts_service_role') THEN
    EXECUTE 'CREATE POLICY invite_attempts_service_role ON public.invite_code_attempts FOR ALL TO service_role USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_imports' AND policyname = 'customer_imports_service') THEN
    EXECUTE 'CREATE POLICY customer_imports_service ON public.customer_imports FOR ALL TO service_role USING (true)';
  END IF;
END $$;

-- ============================================
-- SEED: Default workspace for design partners
-- ============================================
INSERT INTO public.workspaces (id, name, slug, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'CSCX Design Partners',
  'cscx-partners',
  '{"tier": "enterprise", "features": ["all"]}'
)
ON CONFLICT (slug) DO NOTHING;
