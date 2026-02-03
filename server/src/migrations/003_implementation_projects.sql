-- ============================================
-- PRD-123: Contract Signed → Implementation
-- Database Schema for Implementation Projects
-- ============================================

-- Implementation Projects Table
CREATE TABLE IF NOT EXISTS implementation_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  user_id UUID,

  -- Status and Timeline
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'planning', 'executing', 'closing', 'completed', 'on_hold', 'cancelled')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_go_live_date TIMESTAMPTZ,
  actual_go_live_date TIMESTAMPTZ,

  -- Team Assignment
  csm_id UUID,
  implementation_lead_id UUID,
  technical_resource_ids UUID[] DEFAULT '{}',
  executive_sponsor_id UUID,

  -- Kickoff Meeting
  kickoff_scheduled_at TIMESTAMPTZ,
  kickoff_calendar_event_id TEXT,
  kickoff_deck_document_id TEXT,
  kickoff_agenda_document_id TEXT,

  -- Handoff Package
  handoff_package JSONB DEFAULT '{}',
  handoff_document_id TEXT,
  handoff_completed_at TIMESTAMPTZ,

  -- Provisioning
  provisioning_status TEXT DEFAULT 'pending' CHECK (provisioning_status IN ('pending', 'in_progress', 'completed', 'blocked')),
  provisioning_request_id TEXT,
  provisioning_notes TEXT,

  -- Communications
  welcome_email_sent_at TIMESTAMPTZ,
  welcome_email_draft_id TEXT,

  -- Metadata
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'docusign', 'pandadoc', 'salesforce', 'crm')),
  external_reference_id TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Implementation Milestones Table
CREATE TABLE IF NOT EXISTS implementation_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES implementation_projects(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'at_risk', 'blocked')),
  owner TEXT,
  owner_id UUID,

  -- Ordering
  sequence_number INTEGER DEFAULT 0,

  -- Dependencies
  depends_on UUID[], -- Other milestone IDs

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Implementation Tasks Table
CREATE TABLE IF NOT EXISTS implementation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES implementation_projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES implementation_milestones(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Assignment
  assignee_id UUID,
  assignee_name TEXT,

  -- External integration
  external_task_id TEXT, -- Asana, Jira, Monday.com
  external_system TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contract Signature Events Table (for tracking webhook events)
CREATE TABLE IF NOT EXISTS contract_signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source Information
  source TEXT NOT NULL CHECK (source IN ('docusign', 'pandadoc', 'salesforce', 'manual')),
  external_event_id TEXT,
  external_envelope_id TEXT,

  -- Event Details
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  signature_completed BOOLEAN DEFAULT FALSE,
  all_parties_signed BOOLEAN DEFAULT FALSE,

  -- Linking
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  implementation_project_id UUID REFERENCES implementation_projects(id) ON DELETE SET NULL,

  -- Processing Status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,

  -- Raw webhook payload
  raw_payload JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Handoff Package Templates Table
CREATE TABLE IF NOT EXISTS handoff_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,

  name TEXT NOT NULL,
  description TEXT,

  -- Template Sections
  sections JSONB NOT NULL DEFAULT '[]',
  -- Format: [{ "name": "Sales Notes", "required": true, "prompt": "..." }, ...]

  -- Template Settings
  auto_populate BOOLEAN DEFAULT TRUE,
  require_approval BOOLEAN DEFAULT TRUE,

  is_default BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_impl_projects_customer ON implementation_projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_impl_projects_contract ON implementation_projects(contract_id);
CREATE INDEX IF NOT EXISTS idx_impl_projects_status ON implementation_projects(status);
CREATE INDEX IF NOT EXISTS idx_impl_projects_source ON implementation_projects(source);
CREATE INDEX IF NOT EXISTS idx_impl_milestones_project ON implementation_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_impl_milestones_status ON implementation_milestones(status);
CREATE INDEX IF NOT EXISTS idx_impl_tasks_project ON implementation_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_impl_tasks_milestone ON implementation_tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_signature_events_source ON contract_signature_events(source);
CREATE INDEX IF NOT EXISTS idx_signature_events_processed ON contract_signature_events(processed);

-- Updated at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_implementation_projects_updated_at ON implementation_projects;
CREATE TRIGGER update_implementation_projects_updated_at
  BEFORE UPDATE ON implementation_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_implementation_milestones_updated_at ON implementation_milestones;
CREATE TRIGGER update_implementation_milestones_updated_at
  BEFORE UPDATE ON implementation_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_implementation_tasks_updated_at ON implementation_tasks;
CREATE TRIGGER update_implementation_tasks_updated_at
  BEFORE UPDATE ON implementation_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default handoff template
INSERT INTO handoff_templates (name, description, sections, is_default)
VALUES (
  'Standard Implementation Handoff',
  'Default template for implementation handoff from sales to CS',
  '[
    {"name": "Sales Notes", "required": true, "key": "salesNotes", "prompt": "Summarize key information from the sales process"},
    {"name": "Technical Requirements", "required": true, "key": "technicalRequirements", "prompt": "List all technical requirements and integrations needed"},
    {"name": "Stakeholder Map", "required": true, "key": "stakeholderMap", "prompt": "Identify all key stakeholders and their roles"},
    {"name": "Success Criteria", "required": true, "key": "successCriteria", "prompt": "Define what success looks like for this customer"},
    {"name": "Competitive Context", "required": false, "key": "competitiveContext", "prompt": "Note any competitive considerations or previous solutions"},
    {"name": "Customer Goals", "required": true, "key": "customerGoals", "prompt": "Document the customer primary goals and KPIs"},
    {"name": "Timeline Commitments", "required": false, "key": "timelineCommitments", "prompt": "List any timeline commitments made during sales"},
    {"name": "Special Terms", "required": false, "key": "specialTerms", "prompt": "Note any special contract terms or conditions"}
  ]'::JSONB,
  TRUE
) ON CONFLICT DO NOTHING;
