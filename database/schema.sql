-- CSCX.AI Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOMERS
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  arr NUMERIC,
  industry TEXT,
  stage TEXT DEFAULT 'prospect',
  health_score INTEGER,
  csm_id UUID,
  salesforce_id TEXT,
  hubspot_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_stage ON customers(stage);

-- ============================================
-- STAKEHOLDERS
-- ============================================
CREATE TABLE IF NOT EXISTS stakeholders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  sentiment TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stakeholders_customer ON stakeholders(customer_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_email ON stakeholders(email);

-- ============================================
-- CONTRACTS
-- ============================================
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  file_url TEXT,
  file_name TEXT,
  raw_text TEXT,
  company_name TEXT,
  arr NUMERIC,
  contract_term TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active',
  parsed_data JSONB,
  pricing_terms JSONB,
  technical_requirements JSONB,
  missing_info JSONB,
  next_steps JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- ============================================
-- ENTITLEMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER,
  unit TEXT,
  price NUMERIC,
  category TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entitlements_contract ON entitlements(contract_id);

-- ============================================
-- AGENT SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID,
  status TEXT DEFAULT 'active',
  active_agent TEXT DEFAULT 'onboarding',
  deployed_agents TEXT[] DEFAULT '{}',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_customer ON agent_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON agent_sessions(status);

-- ============================================
-- AGENT MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  agent_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  thinking BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT FALSE,
  deployed_agent TEXT,
  tool_calls JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON agent_messages(created_at);

-- ============================================
-- APPROVALS (HITL)
-- ============================================
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  comment TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_session ON approvals(session_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

-- ============================================
-- MEETINGS
-- ============================================
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agent_sessions(id),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  duration INTEGER,
  status TEXT DEFAULT 'scheduled',
  meeting_url TEXT,
  calendar_event_id TEXT,
  attendees JSONB DEFAULT '[]',
  agenda JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_customer ON meetings(customer_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at);

-- ============================================
-- TRANSCRIPTS
-- ============================================
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  duration INTEGER,
  speakers JSONB DEFAULT '[]',
  word_count INTEGER,
  language TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON transcripts(meeting_id);

-- ============================================
-- INSIGHTS
-- ============================================
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id),
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  importance TEXT DEFAULT 'medium',
  owner TEXT,
  due_date DATE,
  status TEXT DEFAULT 'open',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_customer ON insights(customer_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(type);

-- ============================================
-- TRAINING MODULES
-- ============================================
CREATE TABLE IF NOT EXISTS training_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  duration INTEGER,
  level TEXT DEFAULT 'beginner',
  category TEXT,
  prerequisites UUID[],
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modules_category ON training_modules(category);

-- ============================================
-- TRAINING PROGRESS
-- ============================================
CREATE TABLE IF NOT EXISTS training_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id),
  module_id UUID REFERENCES training_modules(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started',
  progress INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_unique
ON training_progress(customer_id, stakeholder_id, module_id);

-- ============================================
-- KNOWLEDGE BASE
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  is_public BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_kb_tags ON knowledge_base USING GIN(tags);

-- ============================================
-- ACTIVITY LOG (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  customer_id UUID REFERENCES customers(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_customer ON activity_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);

-- ============================================
-- AUTO-UPDATE TIMESTAMPS TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_customers_timestamp
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_contracts_timestamp
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_sessions_timestamp
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_meetings_timestamp
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- ROW LEVEL SECURITY (Optional)
-- ============================================
-- Uncomment to enable RLS

-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stakeholders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY customers_policy ON customers
--   FOR ALL USING (csm_id = auth.uid());

-- ============================================
-- SAMPLE DATA
-- ============================================
INSERT INTO customers (name, arr, industry, stage, health_score)
VALUES
  ('Meridian Capital Partners', 900000, 'Finance', 'onboarding', 87),
  ('Acme Corporation', 150000, 'Technology', 'active', 92),
  ('GlobalTech Solutions', 450000, 'Technology', 'active', 78),
  ('Pacific Healthcare Group', 750000, 'Healthcare', 'onboarding', 85),
  ('Summit Financial Services', 1200000, 'Finance', 'active', 91)
ON CONFLICT DO NOTHING;

-- Sample stakeholders for Meridian Capital
INSERT INTO stakeholders (customer_id, name, role, email, is_primary)
SELECT c.id, 'Sarah Chen', 'VP of Operations', 'sarah.chen@meridian.com', true
FROM customers c WHERE c.name = 'Meridian Capital Partners'
ON CONFLICT DO NOTHING;

INSERT INTO stakeholders (customer_id, name, role, email, is_primary)
SELECT c.id, 'Michael Torres', 'IT Director', 'mtorres@meridian.com', false
FROM customers c WHERE c.name = 'Meridian Capital Partners'
ON CONFLICT DO NOTHING;

-- Sample stakeholders for Acme Corporation
INSERT INTO stakeholders (customer_id, name, role, email, is_primary)
SELECT c.id, 'Jennifer Williams', 'CEO', 'jwilliams@acme.com', true
FROM customers c WHERE c.name = 'Acme Corporation'
ON CONFLICT DO NOTHING;

INSERT INTO stakeholders (customer_id, name, role, email, is_primary)
SELECT c.id, 'David Park', 'CTO', 'dpark@acme.com', false
FROM customers c WHERE c.name = 'Acme Corporation'
ON CONFLICT DO NOTHING;
