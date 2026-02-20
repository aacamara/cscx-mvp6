-- ============================================
-- Add organization_id to CSM core tables missed
-- by the multi-tenant migration (20260215)
-- ============================================
-- Tables affected: playbooks, playbook_executions,
-- health_scores, success_plans, objectives, ctas,
-- timeline_activities, glossary
-- Also creates: nps_responses (new table)

-- Playbooks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'playbooks' AND column_name = 'organization_id') THEN
    ALTER TABLE playbooks ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_playbooks_org ON playbooks(organization_id);
  END IF;
END $$;

-- Playbook Executions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'playbook_executions' AND column_name = 'organization_id') THEN
    ALTER TABLE playbook_executions ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_playbook_executions_org ON playbook_executions(organization_id);
  END IF;
END $$;

-- Health Scores
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_scores' AND column_name = 'organization_id') THEN
    ALTER TABLE health_scores ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_health_scores_org ON health_scores(organization_id);
  END IF;
END $$;

-- Success Plans
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'success_plans' AND column_name = 'organization_id') THEN
    ALTER TABLE success_plans ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_success_plans_org ON success_plans(organization_id);
  END IF;
END $$;

-- Objectives
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'objectives' AND column_name = 'organization_id') THEN
    ALTER TABLE objectives ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_objectives_org ON objectives(organization_id);
  END IF;
END $$;

-- CTAs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ctas' AND column_name = 'organization_id') THEN
    ALTER TABLE ctas ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_ctas_org ON ctas(organization_id);
  END IF;
END $$;

-- Timeline Activities
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timeline_activities' AND column_name = 'organization_id') THEN
    ALTER TABLE timeline_activities ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_timeline_activities_org ON timeline_activities(organization_id);
  END IF;
END $$;

-- Glossary
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'glossary' AND column_name = 'organization_id') THEN
    ALTER TABLE glossary ADD COLUMN organization_id UUID REFERENCES organizations(id);
    CREATE INDEX idx_glossary_org ON glossary(organization_id);
  END IF;
END $$;

-- ============================================
-- NPS Responses (new table — PRD-091)
-- ============================================
CREATE TABLE IF NOT EXISTS nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  customer_id UUID REFERENCES customers(id),
  respondent_email TEXT,
  respondent_name TEXT,
  respondent_role TEXT,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  category VARCHAR(20) GENERATED ALWAYS AS (
    CASE
      WHEN score >= 9 THEN 'promoter'
      WHEN score >= 7 THEN 'passive'
      ELSE 'detractor'
    END
  ) STORED,
  feedback TEXT,
  feedback_analysis JSONB,
  survey_id TEXT,
  survey_campaign TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  recovery_initiated BOOLEAN DEFAULT false,
  recovery_status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nps_responses_org ON nps_responses(organization_id);
CREATE INDEX IF NOT EXISTS idx_nps_responses_customer ON nps_responses(customer_id);
CREATE INDEX IF NOT EXISTS idx_nps_responses_score ON nps_responses(score);
