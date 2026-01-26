-- CSCX.AI Database Schema for Supabase
-- Run this in the Supabase SQL Editor to set up your database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- CUSTOMERS TABLE
-- Core customer information extracted from contracts
-- ================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  arr DECIMAL(12,2),
  contract_start DATE,
  contract_end DATE,
  stage VARCHAR(50) DEFAULT 'onboarding',
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  industry VARCHAR(100),
  employee_count INTEGER,
  domain VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_stage ON customers(stage);

-- ================================================
-- CONTRACTS TABLE
-- Stores uploaded contracts and parsed data
-- ================================================
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  file_type VARCHAR(100),
  file_size INTEGER,
  file_url TEXT,
  raw_text TEXT,
  company_name VARCHAR(255),
  arr DECIMAL(12,2),
  contract_period VARCHAR(100),
  parsed_data JSONB,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_name);

-- ================================================
-- STAKEHOLDERS TABLE
-- Customer stakeholders extracted from contracts
-- ================================================
CREATE TABLE IF NOT EXISTS stakeholders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  department VARCHAR(100),
  role VARCHAR(50), -- 'champion', 'decision_maker', 'end_user', 'technical', 'executive'
  responsibilities TEXT,
  approval_required BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stakeholders_customer ON stakeholders(customer_id);
CREATE INDEX IF NOT EXISTS idx_stakeholders_role ON stakeholders(role);

-- ================================================
-- ENTITLEMENTS TABLE
-- Products/services included in contracts
-- ================================================
CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  type VARCHAR(255) NOT NULL,
  description TEXT,
  quantity VARCHAR(100),
  start_date DATE,
  end_date DATE,
  dependencies TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entitlements_customer ON entitlements(customer_id);

-- ================================================
-- ONBOARDING PLANS TABLE
-- Generated onboarding plans for customers
-- ================================================
CREATE TABLE IF NOT EXISTS onboarding_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  timeline_days INTEGER DEFAULT 90,
  phases JSONB,
  risk_factors JSONB,
  opportunities JSONB,
  recommended_touchpoints JSONB,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_customer ON onboarding_plans(customer_id);

-- ================================================
-- TASKS TABLE
-- Individual tasks within onboarding plans
-- ================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES onboarding_plans(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID,
  assigned_agent VARCHAR(50),
  owner VARCHAR(50), -- 'CSM', 'AE', 'SA', 'Customer'
  due_date DATE,
  due_days INTEGER,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'blocked'
  priority VARCHAR(20) DEFAULT 'Medium', -- 'High', 'Medium', 'Low'
  phase VARCHAR(100),
  success_criteria TEXT,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_customer ON tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_plan ON tasks(plan_id);

-- ================================================
-- AGENT SESSIONS TABLE
-- Tracks conversations with AI agents
-- ================================================
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID, -- CSM user (for future auth integration)
  status VARCHAR(50) DEFAULT 'active',
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_customer ON agent_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON agent_sessions(user_id);

-- ================================================
-- AGENT MESSAGES TABLE
-- Individual messages in agent conversations
-- ================================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  agent_id VARCHAR(50), -- 'onboarding', 'meeting', 'training', 'intelligence'
  role VARCHAR(20) NOT NULL, -- 'user', 'agent', 'system'
  content TEXT NOT NULL,
  thinking BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT FALSE,
  deployed_agent VARCHAR(50),
  tool_calls JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON agent_messages(created_at);

-- ================================================
-- AGENT ACTIONS TABLE
-- Actions proposed by agents (for HITL approval)
-- ================================================
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  agent_id VARCHAR(50),
  action_type VARCHAR(100) NOT NULL, -- 'send_email', 'schedule_meeting', 'create_task', etc.
  action_data JSONB NOT NULL,
  description TEXT,
  requires_approval BOOLEAN DEFAULT TRUE,
  approval_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  execution_result JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actions_session ON agent_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON agent_actions(approval_status);
CREATE INDEX IF NOT EXISTS idx_actions_pending ON agent_actions(approval_status) WHERE approval_status = 'pending';

-- ================================================
-- MEETINGS TABLE
-- Scheduled and completed meetings
-- ================================================
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  meeting_type VARCHAR(50), -- 'kickoff', 'check_in', 'training', 'qbr'
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  attendees JSONB, -- Array of {name, email, role}
  agenda JSONB,
  meeting_link TEXT,
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
  notes TEXT,
  action_items JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_customer ON meetings(customer_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at);

-- ================================================
-- INSIGHTS TABLE
-- AI-generated insights about customers
-- ================================================
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  insight_type VARCHAR(100) NOT NULL, -- 'health', 'risk', 'opportunity', 'milestone'
  title VARCHAR(255),
  content TEXT NOT NULL,
  severity VARCHAR(20), -- 'high', 'medium', 'low'
  data JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_customer ON insights(customer_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(insight_type);

-- ================================================
-- APPROVALS TABLE (Legacy - using agent_actions now)
-- Kept for backwards compatibility
-- ================================================
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  action_type VARCHAR(100),
  action_data JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

-- ================================================
-- UPDATED_AT TRIGGER FUNCTION
-- Automatically updates the updated_at column
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contracts_updated_at ON contracts;
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plans_updated_at ON onboarding_plans;
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON onboarding_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON agent_sessions;
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- Enable for multi-tenant setup (future)
-- ================================================
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
-- ... etc (uncomment and add policies when adding auth)

-- ================================================
-- SAMPLE DATA (Optional - for testing)
-- Uncomment to add test data
-- ================================================
/*
INSERT INTO customers (name, arr, stage, health_score, industry) VALUES
  ('Acme Corporation', 150000, 'onboarding', 85, 'Technology'),
  ('Global Industries', 500000, 'active', 92, 'Manufacturing'),
  ('StartupXYZ', 75000, 'onboarding', 78, 'SaaS');
*/

-- ================================================
-- VIEWS (Optional - useful queries)
-- ================================================

-- View: Active onboarding customers with plan progress
CREATE OR REPLACE VIEW v_onboarding_progress AS
SELECT
  c.id,
  c.name,
  c.arr,
  c.health_score,
  p.timeline_days,
  COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed_tasks,
  COUNT(t.id) as total_tasks,
  ROUND(
    COALESCE(
      COUNT(t.id) FILTER (WHERE t.status = 'completed')::decimal / NULLIF(COUNT(t.id), 0) * 100,
      0
    ),
    1
  ) as progress_percent
FROM customers c
LEFT JOIN onboarding_plans p ON p.customer_id = c.id
LEFT JOIN tasks t ON t.plan_id = p.id
WHERE c.stage = 'onboarding'
GROUP BY c.id, c.name, c.arr, c.health_score, p.timeline_days;

-- View: Pending approvals by session
CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT
  aa.id,
  aa.session_id,
  aa.agent_id,
  aa.action_type,
  aa.description,
  aa.action_data,
  aa.created_at,
  c.name as customer_name,
  c.arr as customer_arr
FROM agent_actions aa
JOIN agent_sessions s ON s.id = aa.session_id
LEFT JOIN customers c ON c.id = s.customer_id
WHERE aa.approval_status = 'pending'
ORDER BY aa.created_at DESC;

-- ================================================
-- GRANTS (for service role)
-- These are typically handled by Supabase automatically
-- ================================================
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
