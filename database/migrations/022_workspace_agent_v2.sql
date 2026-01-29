-- WorkspaceAgent V2: MCP, Triggers, Playbooks, Meeting Intelligence, Skills, Automations
-- Migration 022

-- ============================================
-- MCP TOOL REGISTRY
-- Stores available MCP tools with schemas
-- ============================================
CREATE TABLE IF NOT EXISTS mcp_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  provider TEXT DEFAULT 'internal',
  input_schema JSONB,
  output_schema JSONB,
  requires_auth BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  approval_policy TEXT DEFAULT 'auto_approve',
  rate_limit INTEGER,
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tools_category ON mcp_tools(category);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_provider ON mcp_tools(provider);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_enabled ON mcp_tools(enabled) WHERE enabled = true;

-- ============================================
-- MCP TOOL EXECUTIONS
-- Audit log for tool executions
-- ============================================
CREATE TABLE IF NOT EXISTS mcp_tool_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_name TEXT NOT NULL,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  input JSONB,
  output JSONB,
  success BOOLEAN,
  error_message TEXT,
  execution_time_ms INTEGER,
  approval_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_executions_tool ON mcp_tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_user ON mcp_tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_customer ON mcp_tool_executions(customer_id);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_created ON mcp_tool_executions(created_at DESC);

-- ============================================
-- TRIGGERS
-- Proactive automation triggers
-- ============================================
CREATE TABLE IF NOT EXISTS triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  condition JSONB NOT NULL,
  actions JSONB NOT NULL,
  cooldown_minutes INTEGER DEFAULT 60,
  max_fires_per_day INTEGER DEFAULT 10,
  enabled BOOLEAN DEFAULT true,
  last_fired_at TIMESTAMPTZ,
  fire_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_user ON triggers(user_id);
CREATE INDEX IF NOT EXISTS idx_triggers_customer ON triggers(customer_id);
CREATE INDEX IF NOT EXISTS idx_triggers_type ON triggers(type);
CREATE INDEX IF NOT EXISTS idx_triggers_enabled ON triggers(enabled) WHERE enabled = true;

-- ============================================
-- TRIGGER EVENTS
-- Log of trigger fires
-- ============================================
CREATE TABLE IF NOT EXISTS trigger_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_id UUID REFERENCES triggers(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  actions_executed JSONB,
  success BOOLEAN,
  error_message TEXT,
  fired_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trigger_events_trigger ON trigger_events(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_customer ON trigger_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_fired ON trigger_events(fired_at DESC);

-- ============================================
-- PLAYBOOKS
-- Multi-step workflow templates
-- ============================================
CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  category TEXT,
  stages JSONB NOT NULL,
  triggers JSONB,
  variables JSONB,
  estimated_duration_days INTEGER,
  source TEXT DEFAULT 'system',
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_type ON playbooks(type);
CREATE INDEX IF NOT EXISTS idx_playbooks_category ON playbooks(category);
CREATE INDEX IF NOT EXISTS idx_playbooks_source ON playbooks(source);

-- ============================================
-- PLAYBOOK EXECUTIONS
-- Active playbook instances
-- ============================================
CREATE TABLE IF NOT EXISTS playbook_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playbook_id UUID REFERENCES playbooks(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  anchor_date DATE NOT NULL,
  current_stage TEXT,
  current_step INTEGER DEFAULT 0,
  stage_statuses JSONB DEFAULT '{}',
  action_results JSONB DEFAULT '[]',
  variables JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_playbook_executions_playbook ON playbook_executions(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_customer ON playbook_executions(customer_id);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_user ON playbook_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_status ON playbook_executions(status);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_active ON playbook_executions(status) WHERE status = 'active';

-- ============================================
-- SKILLS
-- Reusable automation skills
-- ============================================
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  trigger_patterns TEXT[],
  steps JSONB NOT NULL,
  variables JSONB,
  approval_policy JSONB,
  tags TEXT[],
  enabled BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'user',
  version INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_user ON skills(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_source ON skills(source);
CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_skills_tags ON skills USING GIN(tags);

-- ============================================
-- SKILL EXECUTIONS
-- Log of skill runs
-- ============================================
CREATE TABLE IF NOT EXISTS skill_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  input_variables JSONB,
  step_results JSONB DEFAULT '[]',
  status TEXT DEFAULT 'running',
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_skill_executions_skill ON skill_executions(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_user ON skill_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_status ON skill_executions(status);

-- ============================================
-- AUTOMATIONS
-- Natural language automations
-- ============================================
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  name TEXT,
  natural_language TEXT,
  parsed_definition JSONB,
  parse_confidence NUMERIC,
  schedule JSONB,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id);
CREATE INDEX IF NOT EXISTS idx_automations_next_run ON automations(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled) WHERE enabled = true;

-- ============================================
-- AUTOMATION RUNS
-- Log of automation executions
-- ============================================
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID REFERENCES automations(id) ON DELETE CASCADE,
  trigger_type TEXT,
  input_data JSONB,
  output_data JSONB,
  steps_executed INTEGER DEFAULT 0,
  success BOOLEAN,
  error_message TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_started ON automation_runs(started_at DESC);

-- ============================================
-- MEETING ANALYSES
-- AI analysis of meeting transcripts
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID,
  platform TEXT,
  meeting_title TEXT,
  meeting_date TIMESTAMPTZ,
  duration_minutes INTEGER,
  participants JSONB,
  transcript TEXT,
  summary TEXT,
  key_points JSONB,
  action_items JSONB,
  sentiment_analysis JSONB,
  customer_signals JSONB,
  topics JSONB,
  follow_up_draft TEXT,
  risk_indicators JSONB,
  engagement_score INTEGER,
  processing_status TEXT DEFAULT 'pending',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_analyses_meeting ON meeting_analyses(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_analyses_customer ON meeting_analyses(customer_id);
CREATE INDEX IF NOT EXISTS idx_meeting_analyses_user ON meeting_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_analyses_platform ON meeting_analyses(platform);
CREATE INDEX IF NOT EXISTS idx_meeting_analyses_date ON meeting_analyses(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_analyses_status ON meeting_analyses(processing_status);

-- ============================================
-- SLACK CONNECTIONS
-- OAuth connections to Slack workspaces
-- ============================================
CREATE TABLE IF NOT EXISTS slack_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  bot_user_id TEXT,
  bot_access_token TEXT,
  scopes TEXT[],
  authed_user_id TEXT,
  webhook_url TEXT,
  webhook_channel TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_connections_user_team ON slack_connections(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_slack_connections_team ON slack_connections(team_id);

-- ============================================
-- ZOOM CONNECTIONS
-- OAuth connections to Zoom
-- ============================================
CREATE TABLE IF NOT EXISTS zoom_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  zoom_user_id TEXT NOT NULL,
  email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  scopes TEXT[],
  token_expires_at TIMESTAMPTZ,
  account_id TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_zoom_connections_zoom_user ON zoom_connections(zoom_user_id);

-- ============================================
-- INTEGRATION WEBHOOKS
-- Webhook registrations for integrations
-- ============================================
CREATE TABLE IF NOT EXISTS integration_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_type TEXT NOT NULL,
  user_id UUID NOT NULL,
  webhook_id TEXT,
  webhook_secret TEXT,
  event_types TEXT[],
  endpoint_url TEXT,
  enabled BOOLEAN DEFAULT true,
  last_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_type ON integration_webhooks(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_user ON integration_webhooks(user_id);

-- ============================================
-- SEED MCP TOOLS
-- Register built-in tools
-- ============================================
INSERT INTO mcp_tools (name, description, category, provider, requires_auth, requires_approval, approval_policy) VALUES
  -- Gmail Tools
  ('gmail.list_threads', 'List recent email threads', 'communication', 'google', true, false, 'auto_approve'),
  ('gmail.get_thread', 'Get a specific email thread by ID', 'communication', 'google', true, false, 'auto_approve'),
  ('gmail.send_email', 'Send an email', 'communication', 'google', true, true, 'require_approval'),
  ('gmail.create_draft', 'Create an email draft', 'communication', 'google', true, false, 'auto_approve'),
  ('gmail.search', 'Search emails with query', 'communication', 'google', true, false, 'auto_approve'),

  -- Calendar Tools
  ('calendar.list_events', 'List upcoming calendar events', 'scheduling', 'google', true, false, 'auto_approve'),
  ('calendar.get_event', 'Get a specific calendar event', 'scheduling', 'google', true, false, 'auto_approve'),
  ('calendar.create_event', 'Create a calendar event', 'scheduling', 'google', true, true, 'require_approval'),
  ('calendar.check_availability', 'Check free/busy time slots', 'scheduling', 'google', true, false, 'auto_approve'),
  ('calendar.update_event', 'Update an existing event', 'scheduling', 'google', true, true, 'require_approval'),

  -- Drive Tools
  ('drive.list_files', 'List files in Drive', 'documents', 'google', true, false, 'auto_approve'),
  ('drive.get_file', 'Get file metadata', 'documents', 'google', true, false, 'auto_approve'),
  ('drive.create_folder', 'Create a folder', 'documents', 'google', true, false, 'auto_approve'),
  ('drive.upload_file', 'Upload a file', 'documents', 'google', true, false, 'auto_approve'),
  ('drive.share_file', 'Share a file with someone', 'documents', 'google', true, true, 'require_approval'),

  -- Slack Tools
  ('slack.send_message', 'Send a message to a Slack channel', 'communication', 'slack', true, true, 'require_approval'),
  ('slack.list_channels', 'List available Slack channels', 'communication', 'slack', true, false, 'auto_approve'),
  ('slack.get_user', 'Get Slack user info', 'communication', 'slack', true, false, 'auto_approve'),
  ('slack.post_thread_reply', 'Reply to a thread', 'communication', 'slack', true, true, 'require_approval'),

  -- Zoom Tools
  ('zoom.create_meeting', 'Create a Zoom meeting', 'scheduling', 'zoom', true, true, 'require_approval'),
  ('zoom.list_meetings', 'List scheduled meetings', 'scheduling', 'zoom', true, false, 'auto_approve'),
  ('zoom.get_recording', 'Get meeting recording', 'meeting_intelligence', 'zoom', true, false, 'auto_approve'),
  ('zoom.get_transcript', 'Get meeting transcript', 'meeting_intelligence', 'zoom', true, false, 'auto_approve')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SEED PLAYBOOK TEMPLATES
-- ============================================
INSERT INTO playbooks (name, description, type, category, stages, estimated_duration_days) VALUES
  (
    '90-Day Renewal Playbook',
    'Structured approach to drive successful renewals starting 90 days before expiration',
    'renewal',
    'retention',
    '[
      {"id": "day_90", "name": "Renewal Kickoff", "day_offset": -90, "actions": [
        {"type": "email", "tool": "gmail.send_email", "description": "Send renewal kickoff email"},
        {"type": "task", "description": "Schedule executive check-in"}
      ]},
      {"id": "day_60", "name": "Value Review", "day_offset": -60, "actions": [
        {"type": "meeting", "tool": "calendar.create_event", "description": "QBR/Value review meeting"},
        {"type": "document", "tool": "drive.create_file", "description": "Generate ROI report"}
      ]},
      {"id": "day_30", "name": "Commercial Discussion", "day_offset": -30, "actions": [
        {"type": "email", "tool": "gmail.send_email", "description": "Send renewal proposal"},
        {"type": "task", "description": "Schedule negotiation call"}
      ]},
      {"id": "day_14", "name": "Final Push", "day_offset": -14, "actions": [
        {"type": "email", "tool": "gmail.send_email", "description": "Send reminder with deadline"},
        {"type": "slack", "tool": "slack.send_message", "description": "Alert CSM team"}
      ]},
      {"id": "day_0", "name": "Close or Escalate", "day_offset": 0, "actions": [
        {"type": "task", "description": "Close deal or escalate to management"}
      ]}
    ]'::jsonb,
    90
  ),
  (
    'Risk Mitigation Playbook',
    'Proactive intervention when customer health score drops significantly',
    'risk',
    'retention',
    '[
      {"id": "immediate", "name": "Immediate Response", "day_offset": 0, "actions": [
        {"type": "task", "description": "Review account health dashboard"},
        {"type": "email", "tool": "gmail.send_email", "description": "Personalized check-in email"}
      ]},
      {"id": "week_1", "name": "Deep Dive", "day_offset": 7, "actions": [
        {"type": "meeting", "tool": "calendar.create_event", "description": "Discovery call to understand issues"},
        {"type": "task", "description": "Document all concerns and blockers"}
      ]},
      {"id": "week_2", "name": "Action Plan", "day_offset": 14, "actions": [
        {"type": "document", "tool": "drive.create_file", "description": "Create remediation plan"},
        {"type": "email", "tool": "gmail.send_email", "description": "Share action plan with customer"}
      ]},
      {"id": "week_4", "name": "Follow Up", "day_offset": 28, "actions": [
        {"type": "meeting", "tool": "calendar.create_event", "description": "Progress review meeting"},
        {"type": "task", "description": "Update health score if improved"}
      ]}
    ]'::jsonb,
    30
  ),
  (
    'Expansion Opportunity Playbook',
    'Capitalize on expansion signals with structured approach',
    'expansion',
    'growth',
    '[
      {"id": "qualify", "name": "Qualify Opportunity", "day_offset": 0, "actions": [
        {"type": "task", "description": "Review usage data and expansion signals"},
        {"type": "task", "description": "Identify expansion champions"}
      ]},
      {"id": "engage", "name": "Engage Stakeholders", "day_offset": 7, "actions": [
        {"type": "email", "tool": "gmail.send_email", "description": "Reach out to expansion champion"},
        {"type": "meeting", "tool": "calendar.create_event", "description": "Discovery call for expansion"}
      ]},
      {"id": "propose", "name": "Build Business Case", "day_offset": 21, "actions": [
        {"type": "document", "tool": "drive.create_file", "description": "Create expansion proposal"},
        {"type": "meeting", "tool": "calendar.create_event", "description": "Present proposal"}
      ]},
      {"id": "close", "name": "Close Deal", "day_offset": 35, "actions": [
        {"type": "email", "tool": "gmail.send_email", "description": "Send final proposal"},
        {"type": "task", "description": "Coordinate with sales for contract"}
      ]}
    ]'::jsonb,
    45
  ),
  (
    '30-60-90 Onboarding Playbook',
    'Structured onboarding to drive time-to-value',
    'onboarding',
    'activation',
    '[
      {"id": "day_0", "name": "Kickoff", "day_offset": 0, "actions": [
        {"type": "meeting", "tool": "calendar.create_event", "description": "Kickoff meeting"},
        {"type": "email", "tool": "gmail.send_email", "description": "Welcome email with resources"},
        {"type": "document", "tool": "drive.create_file", "description": "Create onboarding folder"}
      ]},
      {"id": "day_30", "name": "First Value Milestone", "day_offset": 30, "actions": [
        {"type": "meeting", "tool": "calendar.create_event", "description": "30-day check-in"},
        {"type": "task", "description": "Verify initial use cases working"}
      ]},
      {"id": "day_60", "name": "Expansion Check", "day_offset": 60, "actions": [
        {"type": "meeting", "tool": "calendar.create_event", "description": "60-day review"},
        {"type": "task", "description": "Identify additional use cases"}
      ]},
      {"id": "day_90", "name": "Success Review", "day_offset": 90, "actions": [
        {"type": "meeting", "tool": "calendar.create_event", "description": "90-day success review"},
        {"type": "document", "tool": "drive.create_file", "description": "Generate success report"},
        {"type": "task", "description": "Transition to maintenance mode"}
      ]}
    ]'::jsonb,
    90
  ),
  (
    'QBR Preparation Playbook',
    'Automated preparation workflow for quarterly business reviews',
    'qbr',
    'engagement',
    '[
      {"id": "week_minus_3", "name": "Data Gathering", "day_offset": -21, "actions": [
        {"type": "task", "description": "Pull usage metrics for the quarter"},
        {"type": "task", "description": "Compile support ticket summary"}
      ]},
      {"id": "week_minus_2", "name": "Analysis", "day_offset": -14, "actions": [
        {"type": "document", "tool": "drive.create_file", "description": "Generate QBR deck"},
        {"type": "task", "description": "Calculate ROI metrics"}
      ]},
      {"id": "week_minus_1", "name": "Scheduling", "day_offset": -7, "actions": [
        {"type": "email", "tool": "gmail.send_email", "description": "Send QBR agenda and invite"},
        {"type": "meeting", "tool": "calendar.create_event", "description": "Schedule QBR meeting"}
      ]},
      {"id": "day_0", "name": "QBR Day", "day_offset": 0, "actions": [
        {"type": "task", "description": "Conduct QBR meeting"},
        {"type": "email", "tool": "gmail.send_email", "description": "Send follow-up summary"}
      ]}
    ]'::jsonb,
    21
  )
ON CONFLICT DO NOTHING;
