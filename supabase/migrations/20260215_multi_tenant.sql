-- ============================================
-- CSCX.AI Multi-Tenant Architecture Migration
-- PRD-007: Phase 2 — Organizations, Members, RLS
-- ============================================

-- Enable UUID extension (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORGANIZATIONS
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
-- ORG MEMBERS
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
-- INVITE CODES (new multi-tenant version)
-- Keep existing invite_codes table if it exists,
-- add organization_id column
-- ============================================
DO $$
BEGIN
  -- Add organization_id to invite_codes if column doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invite_codes')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invite_codes' AND column_name = 'organization_id') THEN
    ALTER TABLE invite_codes ADD COLUMN organization_id UUID REFERENCES organizations(id);
  END IF;

  -- Add role column to invite_codes if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invite_codes')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invite_codes' AND column_name = 'role') THEN
    ALTER TABLE invite_codes ADD COLUMN role TEXT DEFAULT 'csm';
  END IF;
END $$;

-- ============================================
-- ADD organization_id TO ALL DATA TABLES
-- ============================================

-- Customers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'organization_id') THEN
    ALTER TABLE customers ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_customers_org ON customers(organization_id);
  END IF;
END $$;

-- Stakeholders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stakeholders' AND column_name = 'organization_id') THEN
    ALTER TABLE stakeholders ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_stakeholders_org ON stakeholders(organization_id);
  END IF;
END $$;

-- Contracts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'organization_id') THEN
    ALTER TABLE contracts ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_contracts_org ON contracts(organization_id);
  END IF;
END $$;

-- Agent Sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_sessions' AND column_name = 'organization_id') THEN
    ALTER TABLE agent_sessions ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_agent_sessions_org ON agent_sessions(organization_id);
  END IF;
END $$;

-- Agent Messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'organization_id') THEN
    ALTER TABLE agent_messages ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_agent_messages_org ON agent_messages(organization_id);
  END IF;
END $$;

-- Approvals
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approvals' AND column_name = 'organization_id') THEN
    ALTER TABLE approvals ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_approvals_org ON approvals(organization_id);
  END IF;
END $$;

-- Meetings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'organization_id') THEN
    ALTER TABLE meetings ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_meetings_org ON meetings(organization_id);
  END IF;
END $$;

-- Transcripts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcripts' AND column_name = 'organization_id') THEN
    ALTER TABLE transcripts ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_transcripts_org ON transcripts(organization_id);
  END IF;
END $$;

-- Insights
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'insights' AND column_name = 'organization_id') THEN
    ALTER TABLE insights ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_insights_org ON insights(organization_id);
  END IF;
END $$;

-- Training Modules
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_modules' AND column_name = 'organization_id') THEN
    ALTER TABLE training_modules ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_training_modules_org ON training_modules(organization_id);
  END IF;
END $$;

-- Training Progress
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_progress' AND column_name = 'organization_id') THEN
    ALTER TABLE training_progress ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_training_progress_org ON training_progress(organization_id);
  END IF;
END $$;

-- Knowledge Base
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_base' AND column_name = 'organization_id') THEN
    ALTER TABLE knowledge_base ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_knowledge_base_org ON knowledge_base(organization_id);
  END IF;
END $$;

-- Activity Log
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_log' AND column_name = 'organization_id') THEN
    ALTER TABLE activity_log ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_activity_log_org ON activity_log(organization_id);
  END IF;
END $$;

-- Entitlements (via contract, but add direct reference for query efficiency)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entitlements' AND column_name = 'organization_id') THEN
    ALTER TABLE entitlements ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_entitlements_org ON entitlements(organization_id);
  END IF;
END $$;
