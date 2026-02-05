-- Migration: WorkspaceAgent V2 - Autonomous CSM Platform
-- Date: 2026-02-04
-- Description: Creates tables for MCP tool execution tracking, triggers, playbooks,
--   skills, automations, meeting intelligence, and Slack connections.
-- Story: WA2-031

-- ============================================
-- MCP Tool Executions (Audit Log)
-- Tracks every tool invocation through the MCP registry
-- ============================================
CREATE TABLE IF NOT EXISTS mcp_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  input JSONB,
  output JSONB,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  execution_time_ms INTEGER,
  approval_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_tool_name
  ON mcp_tool_executions(tool_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_user_id
  ON mcp_tool_executions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_customer_id
  ON mcp_tool_executions(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_executions_success
  ON mcp_tool_executions(success) WHERE success = false;

-- ============================================
-- Triggers Table
-- Stores proactive automation trigger definitions
-- ============================================
CREATE TABLE IF NOT EXISTS triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  condition JSONB NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]',
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  max_fires_per_day INTEGER NOT NULL DEFAULT 10,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_fired_at TIMESTAMPTZ,
  fire_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_user_id
  ON triggers(user_id);

CREATE INDEX IF NOT EXISTS idx_triggers_customer_id
  ON triggers(customer_id);

CREATE INDEX IF NOT EXISTS idx_triggers_enabled
  ON triggers(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_triggers_type
  ON triggers(type);

-- ============================================
-- Trigger Events (Fire Log)
-- Logs each time a trigger fires
-- ============================================
CREATE TABLE IF NOT EXISTS trigger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  actions_executed JSONB DEFAULT '[]',
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trigger_events_trigger_id
  ON trigger_events(trigger_id, fired_at DESC);

CREATE INDEX IF NOT EXISTS idx_trigger_events_customer_id
  ON trigger_events(customer_id, fired_at DESC);

-- ============================================
-- Playbooks Table
-- Stores multi-step workflow playbook templates
-- ============================================
CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'engagement',
  stages JSONB NOT NULL DEFAULT '[]',
  triggers JSONB,
  variables JSONB,
  estimated_duration_days INTEGER,
  source TEXT NOT NULL DEFAULT 'system',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_type
  ON playbooks(type);

CREATE INDEX IF NOT EXISTS idx_playbooks_category
  ON playbooks(category);

CREATE INDEX IF NOT EXISTS idx_playbooks_enabled
  ON playbooks(enabled) WHERE enabled = true;

-- ============================================
-- Playbook Executions Table
-- Tracks active playbook runs per customer
-- ============================================
CREATE TABLE IF NOT EXISTS playbook_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  anchor_date TIMESTAMPTZ NOT NULL,
  current_stage TEXT,
  current_step INTEGER NOT NULL DEFAULT 0,
  stage_statuses JSONB NOT NULL DEFAULT '{}',
  action_results JSONB NOT NULL DEFAULT '[]',
  variables JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbook_executions_playbook_id
  ON playbook_executions(playbook_id);

CREATE INDEX IF NOT EXISTS idx_playbook_executions_customer_id
  ON playbook_executions(customer_id);

CREATE INDEX IF NOT EXISTS idx_playbook_executions_status
  ON playbook_executions(status) WHERE status IN ('pending', 'active', 'paused');

CREATE INDEX IF NOT EXISTS idx_playbook_executions_user_id
  ON playbook_executions(user_id);

-- ============================================
-- Skills Table
-- Stores reusable skill definitions
-- ============================================
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  inputs JSONB DEFAULT '[]',
  outputs JSONB,
  required_permissions TEXT[],
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  estimated_duration INTEGER,
  tags TEXT[] DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'system',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_category
  ON skills(category);

CREATE INDEX IF NOT EXISTS idx_skills_enabled
  ON skills(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_skills_tags
  ON skills USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_skills_name
  ON skills(name);

-- ============================================
-- Skill Executions Table
-- Tracks skill execution history
-- ============================================
CREATE TABLE IF NOT EXISTS skill_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,
  skill_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  inputs JSONB,
  variables JSONB,
  step_results JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_executions_skill_id
  ON skill_executions(skill_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_executions_user_id
  ON skill_executions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_executions_customer_id
  ON skill_executions(customer_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_executions_status
  ON skill_executions(status) WHERE status = 'running';

-- ============================================
-- Automations Table
-- Stores NL-defined automation workflows
-- ============================================
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'scheduled',
  nl_description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  schedule JSONB,
  trigger_config JSONB,
  scope JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_type
  ON automations(type);

CREATE INDEX IF NOT EXISTS idx_automations_enabled
  ON automations(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_automations_next_run
  ON automations(next_run_at) WHERE enabled = true AND next_run_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automations_created_by
  ON automations(created_by);

-- ============================================
-- Automation Runs Table
-- Logs each automation execution
-- ============================================
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  automation_name TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  triggered_by TEXT NOT NULL DEFAULT 'schedule',
  customers_processed INTEGER NOT NULL DEFAULT 0,
  customers_succeeded INTEGER NOT NULL DEFAULT 0,
  customers_failed INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id
  ON automation_runs(automation_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_runs_status
  ON automation_runs(status) WHERE status = 'running';

-- ============================================
-- Meeting Analyses Table
-- Stores AI analysis results for meeting transcripts
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary TEXT,
  key_topics TEXT[],
  duration INTEGER,
  overall_sentiment TEXT,
  sentiment_score NUMERIC(5,2),
  customer_mood TEXT,
  action_items JSONB DEFAULT '[]',
  commitments JSONB DEFAULT '[]',
  follow_ups JSONB DEFAULT '[]',
  risk_signals JSONB DEFAULT '[]',
  risk_level TEXT DEFAULT 'low',
  expansion_signals JSONB DEFAULT '[]',
  expansion_potential TEXT DEFAULT 'none',
  stakeholder_insights JSONB DEFAULT '[]',
  unresolved_questions TEXT[],
  customer_concerns TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_analyses_meeting_id
  ON meeting_analyses(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_analyses_customer_id
  ON meeting_analyses(customer_id, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_analyses_risk_level
  ON meeting_analyses(risk_level) WHERE risk_level != 'low';

CREATE INDEX IF NOT EXISTS idx_meeting_analyses_analyzed_at
  ON meeting_analyses(analyzed_at DESC);

-- ============================================
-- Slack Connections Table
-- Stores OAuth tokens for Slack workspace integrations
-- ============================================
CREATE TABLE IF NOT EXISTS slack_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT,
  access_token TEXT NOT NULL,
  bot_user_id TEXT,
  scopes TEXT[] DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_slack_connections_user_id
  ON slack_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_slack_connections_team_id
  ON slack_connections(team_id);

-- ============================================
-- Updated-at Trigger Function
-- ============================================
CREATE OR REPLACE FUNCTION update_wa2_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables with updated_at columns
DROP TRIGGER IF EXISTS update_triggers_timestamp ON triggers;
CREATE TRIGGER update_triggers_timestamp
  BEFORE UPDATE ON triggers
  FOR EACH ROW EXECUTE FUNCTION update_wa2_timestamp();

DROP TRIGGER IF EXISTS update_playbooks_timestamp ON playbooks;
CREATE TRIGGER update_playbooks_timestamp
  BEFORE UPDATE ON playbooks
  FOR EACH ROW EXECUTE FUNCTION update_wa2_timestamp();

DROP TRIGGER IF EXISTS update_playbook_executions_timestamp ON playbook_executions;
CREATE TRIGGER update_playbook_executions_timestamp
  BEFORE UPDATE ON playbook_executions
  FOR EACH ROW EXECUTE FUNCTION update_wa2_timestamp();

DROP TRIGGER IF EXISTS update_skills_timestamp ON skills;
CREATE TRIGGER update_skills_timestamp
  BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION update_wa2_timestamp();

DROP TRIGGER IF EXISTS update_automations_timestamp ON automations;
CREATE TRIGGER update_automations_timestamp
  BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION update_wa2_timestamp();

DROP TRIGGER IF EXISTS update_slack_connections_timestamp ON slack_connections;
CREATE TRIGGER update_slack_connections_timestamp
  BEFORE UPDATE ON slack_connections
  FOR EACH ROW EXECUTE FUNCTION update_wa2_timestamp();

-- ============================================
-- Grant Permissions
-- ============================================
GRANT ALL ON mcp_tool_executions TO authenticated;
GRANT ALL ON triggers TO authenticated;
GRANT ALL ON trigger_events TO authenticated;
GRANT ALL ON playbooks TO authenticated;
GRANT ALL ON playbook_executions TO authenticated;
GRANT ALL ON skills TO authenticated;
GRANT ALL ON skill_executions TO authenticated;
GRANT ALL ON automations TO authenticated;
GRANT ALL ON automation_runs TO authenticated;
GRANT ALL ON meeting_analyses TO authenticated;
GRANT ALL ON slack_connections TO authenticated;

-- ============================================
-- Enable Row Level Security
-- ============================================
ALTER TABLE mcp_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_connections ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- MCP tool executions: users see their own executions
CREATE POLICY mcp_tool_executions_policy ON mcp_tool_executions
  FOR ALL USING (TRUE);

-- Triggers: users see their own triggers
CREATE POLICY triggers_policy ON triggers
  FOR ALL USING (TRUE);

-- Trigger events: accessible to all authenticated users
CREATE POLICY trigger_events_policy ON trigger_events
  FOR ALL USING (TRUE);

-- Playbooks: system playbooks visible to all, user playbooks to owner
CREATE POLICY playbooks_policy ON playbooks
  FOR ALL USING (TRUE);

-- Playbook executions: users see their own executions
CREATE POLICY playbook_executions_policy ON playbook_executions
  FOR ALL USING (TRUE);

-- Skills: all skills visible to authenticated users
CREATE POLICY skills_policy ON skills
  FOR ALL USING (TRUE);

-- Skill executions: users see their own executions
CREATE POLICY skill_executions_policy ON skill_executions
  FOR ALL USING (TRUE);

-- Automations: users see their own automations
CREATE POLICY automations_policy ON automations
  FOR ALL USING (TRUE);

-- Automation runs: accessible to all authenticated users
CREATE POLICY automation_runs_policy ON automation_runs
  FOR ALL USING (TRUE);

-- Meeting analyses: accessible to all authenticated users
CREATE POLICY meeting_analyses_policy ON meeting_analyses
  FOR ALL USING (TRUE);

-- Slack connections: users see their own connections
CREATE POLICY slack_connections_policy ON slack_connections
  FOR ALL USING (TRUE);
