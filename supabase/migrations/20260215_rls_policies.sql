-- ============================================
-- CSCX.AI Row Level Security Policies
-- PRD-007: Phase 2 — Data Isolation Between Orgs
-- ============================================

-- Helper function: get user's active organization IDs
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id
  FROM org_members
  WHERE user_id = auth.uid()
  AND status = 'active';
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- ORGANIZATIONS — members can see their own org
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_view_org" ON organizations
  FOR SELECT USING (
    id IN (SELECT get_user_org_ids())
  );

CREATE POLICY "admins_can_update_org" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  );

-- Service role bypasses RLS (for backend operations)
-- Supabase service_role key automatically bypasses RLS

-- ============================================
-- ORG MEMBERS — members can see their org's members
-- ============================================
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_view_org_members" ON org_members
  FOR SELECT USING (
    organization_id IN (SELECT get_user_org_ids())
  );

CREATE POLICY "admins_can_manage_members" ON org_members
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM org_members m
      WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'admin'
    )
  );

-- ============================================
-- CUSTOMERS — org isolation + CSM assignment
-- ============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_customers" ON customers
  FOR ALL USING (
    -- Null org_id = demo/legacy data, visible in dev only
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

CREATE POLICY "csm_sees_assigned_customers" ON customers
  FOR SELECT USING (
    csm_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid()
      AND organization_id = customers.organization_id
      AND role IN ('admin', 'viewer')
      AND status = 'active'
    )
    OR organization_id IS NULL  -- demo data
  );

-- ============================================
-- STAKEHOLDERS — follows customer org isolation
-- ============================================
ALTER TABLE stakeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_stakeholders" ON stakeholders
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- CONTRACTS — follows customer org isolation
-- ============================================
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_contracts" ON contracts
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- AGENT SESSIONS — org isolation
-- ============================================
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_agent_sessions" ON agent_sessions
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- AGENT MESSAGES — org isolation
-- ============================================
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_agent_messages" ON agent_messages
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- APPROVALS — org isolation
-- ============================================
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_approvals" ON approvals
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- MEETINGS — org isolation
-- ============================================
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_meetings" ON meetings
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- TRANSCRIPTS — org isolation
-- ============================================
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_transcripts" ON transcripts
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- INSIGHTS — org isolation
-- ============================================
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_insights" ON insights
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- TRAINING MODULES — org isolation
-- ============================================
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_training_modules" ON training_modules
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- TRAINING PROGRESS — org isolation
-- ============================================
ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_training_progress" ON training_progress
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- KNOWLEDGE BASE — org isolation
-- ============================================
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_knowledge_base" ON knowledge_base
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- ACTIVITY LOG — org isolation
-- ============================================
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_activity_log" ON activity_log
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- ENTITLEMENTS — org isolation
-- ============================================
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_entitlements" ON entitlements
  FOR ALL USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================
-- INVITE CODES — admins can manage their org's codes
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invite_codes') THEN
    ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

    -- Anyone can validate an invite code (needed for signup flow)
    EXECUTE 'CREATE POLICY "anyone_can_validate_invites" ON invite_codes FOR SELECT USING (true)';

    -- Only admins can create/update invite codes for their org
    EXECUTE 'CREATE POLICY "admins_manage_invite_codes" ON invite_codes FOR ALL USING (
      organization_id IN (
        SELECT organization_id FROM org_members
        WHERE user_id = auth.uid() AND status = ''active'' AND role = ''admin''
      )
    )';
  END IF;
END $$;
