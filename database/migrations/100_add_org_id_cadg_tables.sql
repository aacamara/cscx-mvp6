-- ============================================
-- Add organization_id to CADG tables
-- execution_plans, generated_artifacts, agent_activity_log
-- (Migration 074 targeted wrong table names)
-- ============================================

-- execution_plans
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'execution_plans')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'execution_plans' AND column_name = 'organization_id') THEN
    ALTER TABLE execution_plans ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_execution_plans_org ON execution_plans(organization_id);
  END IF;
END $$;

-- generated_artifacts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'generated_artifacts')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generated_artifacts' AND column_name = 'organization_id') THEN
    ALTER TABLE generated_artifacts ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_generated_artifacts_org ON generated_artifacts(organization_id);
  END IF;
END $$;

-- agent_activity_log
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_activity_log')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_activity_log' AND column_name = 'organization_id') THEN
    ALTER TABLE agent_activity_log ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_agent_activity_log_org ON agent_activity_log(organization_id);
  END IF;
END $$;
