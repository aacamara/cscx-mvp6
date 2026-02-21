-- ============================================
-- PRD-007: Add org-based RLS to remaining tables
-- Tables from migration 073 that have organization_id
-- but lack RLS policies
-- ============================================

-- Helper function (idempotent)
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id
  FROM org_members
  WHERE user_id = auth.uid()
  AND status = 'active';
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- PLAYBOOKS
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'playbooks') THEN
    ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'playbooks' AND policyname = 'org_isolation_playbooks') THEN
      EXECUTE 'CREATE POLICY org_isolation_playbooks ON playbooks FOR ALL USING (organization_id IS NULL OR organization_id IN (SELECT get_user_org_ids()))';
    END IF;
  END IF;
END $$;

-- ============================================
-- PLAYBOOK EXECUTIONS
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'playbook_executions') THEN
    ALTER TABLE playbook_executions ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'playbook_executions' AND policyname = 'org_isolation_playbook_executions') THEN
      EXECUTE 'CREATE POLICY org_isolation_playbook_executions ON playbook_executions FOR ALL USING (organization_id IS NULL OR organization_id IN (SELECT get_user_org_ids()))';
    END IF;
  END IF;
END $$;

-- ============================================
-- HEALTH SCORES
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'health_scores') THEN
    ALTER TABLE health_scores ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_scores' AND policyname = 'org_isolation_health_scores') THEN
      EXECUTE 'CREATE POLICY org_isolation_health_scores ON health_scores FOR ALL USING (organization_id IS NULL OR organization_id IN (SELECT get_user_org_ids()))';
    END IF;
  END IF;
END $$;

-- ============================================
-- SUCCESS PLANS
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'success_plans') THEN
    ALTER TABLE success_plans ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'success_plans' AND policyname = 'org_isolation_success_plans') THEN
      EXECUTE 'CREATE POLICY org_isolation_success_plans ON success_plans FOR ALL USING (organization_id IS NULL OR organization_id IN (SELECT get_user_org_ids()))';
    END IF;
  END IF;
END $$;

-- ============================================
-- OBJECTIVES
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'objectives') THEN
    ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objectives' AND policyname = 'org_isolation_objectives') THEN
      EXECUTE 'CREATE POLICY org_isolation_objectives ON objectives FOR ALL USING (organization_id IS NULL OR organization_id IN (SELECT get_user_org_ids()))';
    END IF;
  END IF;
END $$;

-- ============================================
-- CTAs
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ctas') THEN
    ALTER TABLE ctas ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ctas' AND policyname = 'org_isolation_ctas') THEN
      EXECUTE 'CREATE POLICY org_isolation_ctas ON ctas FOR ALL USING (organization_id IS NULL OR organization_id IN (SELECT get_user_org_ids()))';
    END IF;
  END IF;
END $$;

-- ============================================
-- TIMELINE ACTIVITIES
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'timeline_activities') THEN
    ALTER TABLE timeline_activities ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'timeline_activities' AND policyname = 'org_isolation_timeline_activities') THEN
      EXECUTE 'CREATE POLICY org_isolation_timeline_activities ON timeline_activities FOR ALL USING (organization_id IS NULL OR organization_id IN (SELECT get_user_org_ids()))';
    END IF;
  END IF;
END $$;

-- ============================================
-- GLOSSARY
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'glossary') THEN
    ALTER TABLE glossary ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'glossary' AND policyname = 'org_isolation_glossary') THEN
      EXECUTE 'CREATE POLICY org_isolation_glossary ON glossary FOR ALL USING (organization_id IS NULL OR organization_id IN (SELECT get_user_org_ids()))';
    END IF;
  END IF;
END $$;

-- ============================================
-- NPS RESPONSES
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nps_responses') THEN
    ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nps_responses' AND policyname = 'org_isolation_nps_responses') THEN
      EXECUTE 'CREATE POLICY org_isolation_nps_responses ON nps_responses FOR ALL USING (organization_id IS NULL OR organization_id IN (SELECT get_user_org_ids()))';
    END IF;
  END IF;
END $$;

-- ============================================
-- Add organization_id to remaining data tables
-- that were missed in earlier migrations
-- ============================================

-- Support tickets
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'organization_id') THEN
    ALTER TABLE support_tickets ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_support_tickets_org ON support_tickets(organization_id);
  END IF;
END $$;

-- User feedback
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_feedback')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_feedback' AND column_name = 'organization_id') THEN
    ALTER TABLE user_feedback ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_user_feedback_org ON user_feedback(organization_id);
  END IF;
END $$;

-- Feedback events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback_events')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feedback_events' AND column_name = 'organization_id') THEN
    ALTER TABLE feedback_events ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_feedback_events_org ON feedback_events(organization_id);
  END IF;
END $$;

-- Usage metrics
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_metrics')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usage_metrics' AND column_name = 'organization_id') THEN
    ALTER TABLE usage_metrics ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_usage_metrics_org ON usage_metrics(organization_id);
  END IF;
END $$;

-- Risk signals
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'risk_signals')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'risk_signals' AND column_name = 'organization_id') THEN
    ALTER TABLE risk_signals ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_risk_signals_org ON risk_signals(organization_id);
  END IF;
END $$;

-- Renewal pipeline
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'renewal_pipeline')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'renewal_pipeline' AND column_name = 'organization_id') THEN
    ALTER TABLE renewal_pipeline ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_renewal_pipeline_org ON renewal_pipeline(organization_id);
  END IF;
END $$;

-- Expansion opportunities
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expansion_opportunities')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expansion_opportunities' AND column_name = 'organization_id') THEN
    ALTER TABLE expansion_opportunities ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_expansion_opps_org ON expansion_opportunities(organization_id);
  END IF;
END $$;

-- CADG execution plans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cadg_execution_plans')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cadg_execution_plans' AND column_name = 'organization_id') THEN
    ALTER TABLE cadg_execution_plans ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_cadg_plans_org ON cadg_execution_plans(organization_id);
  END IF;
END $$;

-- CADG artifacts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cadg_artifacts')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cadg_artifacts' AND column_name = 'organization_id') THEN
    ALTER TABLE cadg_artifacts ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_cadg_artifacts_org ON cadg_artifacts(organization_id);
  END IF;
END $$;
