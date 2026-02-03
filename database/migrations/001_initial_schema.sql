-- ============================================
-- CSCX.AI Production Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Core Tables
-- ============================================

-- Users (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'csm' CHECK (role IN ('admin', 'csm', 'manager', 'viewer')),
  team_id UUID,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  arr NUMERIC(12, 2),
  health_score INTEGER DEFAULT 70 CHECK (health_score >= 0 AND health_score <= 100),
  tier TEXT DEFAULT 'standard' CHECK (tier IN ('enterprise', 'strategic', 'standard', 'growth')),
  csm_id UUID REFERENCES public.user_profiles(id),
  renewal_date DATE,
  contract_start DATE,
  contract_end DATE,
  logo_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stakeholders (customer contacts)
CREATE TABLE IF NOT EXISTS public.stakeholders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  title TEXT,
  is_champion BOOLEAN DEFAULT FALSE,
  is_decision_maker BOOLEAN DEFAULT FALSE,
  is_primary BOOLEAN DEFAULT FALSE,
  sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative', 'unknown')),
  linkedin_url TEXT,
  notes TEXT,
  last_contacted TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  file_url TEXT,
  file_name TEXT,
  parsed_data JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'renewed')),
  start_date DATE,
  end_date DATE,
  total_value NUMERIC(12, 2),
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entitlements
CREATE TABLE IF NOT EXISTS public.entitlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER,
  unit TEXT,
  usage_current INTEGER DEFAULT 0,
  usage_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Agent Observability Tables
-- ============================================

-- Agent Runs (traces)
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('orchestrator', 'specialist', 'support')),
  user_id UUID REFERENCES public.user_profiles(id),
  session_id UUID,
  customer_id UUID REFERENCES public.customers(id),
  customer_context JSONB,
  parent_run_id UUID REFERENCES public.agent_runs(id),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'waiting_approval')),
  input TEXT NOT NULL,
  output TEXT,
  error TEXT,
  total_tokens_input INTEGER DEFAULT 0,
  total_tokens_output INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  langsmith_run_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Agent Steps
CREATE TABLE IF NOT EXISTS public.agent_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  parent_step_id UUID REFERENCES public.agent_steps(id),
  type TEXT NOT NULL CHECK (type IN ('thinking', 'tool_call', 'tool_result', 'llm_call', 'llm_response', 'decision', 'handoff', 'approval', 'response', 'error')),
  name TEXT NOT NULL,
  description TEXT,
  input JSONB,
  output JSONB,
  duration_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Sessions (chat sessions)
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id),
  customer_id UUID REFERENCES public.customers(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Messages
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.agent_runs(id),
  agent_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  thinking BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT FALSE,
  deployed_agent TEXT,
  tool_calls JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approvals (HITL)
CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.agent_sessions(id),
  run_id UUID REFERENCES public.agent_runs(id),
  message_id UUID REFERENCES public.agent_messages(id),
  action_type TEXT NOT NULL,
  action_description TEXT,
  action_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  decided_by UUID REFERENCES public.user_profiles(id),
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Feature Flags
-- ============================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT FALSE,
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  targeting_rules JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Meetings & Tasks
-- ============================================

CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id),
  session_id UUID REFERENCES public.agent_sessions(id),
  title TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT DEFAULT 'general' CHECK (meeting_type IN ('kickoff', 'qbr', 'check_in', 'training', 'escalation', 'general')),
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 30,
  attendees JSONB DEFAULT '[]',
  location TEXT,
  meeting_url TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  notes TEXT,
  action_items JSONB DEFAULT '[]',
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id),
  session_id UUID REFERENCES public.agent_sessions(id),
  assignee_id UUID REFERENCES public.user_profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'agent', 'system')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Insights & Analytics
-- ============================================

CREATE TABLE IF NOT EXISTS public.insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id),
  session_id UUID REFERENCES public.agent_sessions(id),
  type TEXT NOT NULL CHECK (type IN ('risk', 'opportunity', 'recommendation', 'trend', 'alert')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  source TEXT DEFAULT 'agent' CHECK (source IN ('agent', 'system', 'user')),
  is_actionable BOOLEAN DEFAULT TRUE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Agent runs indexes
CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON public.agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_customer ON public.agent_runs(customer_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON public.agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started ON public.agent_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_parent ON public.agent_runs(parent_run_id);

-- Agent steps indexes
CREATE INDEX IF NOT EXISTS idx_agent_steps_run ON public.agent_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_steps_type ON public.agent_steps(type);
CREATE INDEX IF NOT EXISTS idx_agent_steps_created ON public.agent_steps(created_at);

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_csm ON public.customers(csm_id);
CREATE INDEX IF NOT EXISTS idx_customers_health ON public.customers(health_score);

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON public.agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_customer ON public.agent_sessions(customer_id);

-- Feature flags index
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(key);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- Policies: Service role can do everything (for backend)
-- These allow the service key to bypass RLS

CREATE POLICY "Service role full access on user_profiles" ON public.user_profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on customers" ON public.customers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on stakeholders" ON public.stakeholders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on contracts" ON public.contracts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on entitlements" ON public.entitlements FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on agent_runs" ON public.agent_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on agent_steps" ON public.agent_steps FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on agent_sessions" ON public.agent_sessions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on agent_messages" ON public.agent_messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on approvals" ON public.approvals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on feature_flags" ON public.feature_flags FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on meetings" ON public.meetings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on tasks" ON public.tasks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on insights" ON public.insights FOR ALL USING (auth.role() = 'service_role');

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- Functions & Triggers
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_stakeholders_updated_at BEFORE UPDATE ON public.stakeholders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_agent_sessions_updated_at BEFORE UPDATE ON public.agent_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON public.feature_flags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to calculate run duration on completion
CREATE OR REPLACE FUNCTION public.calculate_run_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed') AND NEW.ended_at IS NOT NULL THEN
    -- Duration is calculated on read, no need to store
    NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Initial Data: Default Feature Flags
-- ============================================

INSERT INTO public.feature_flags (key, name, description, enabled, rollout_percentage) VALUES
  ('enhanced_health_checks', 'Enhanced Health Checks', 'Deep connectivity tests for AI services', true, 100),
  ('ai_fallback_to_gemini', 'AI Fallback to Gemini', 'Auto-failover from Claude to Gemini', true, 100),
  ('circuit_breaker_enabled', 'Circuit Breaker', 'Enable circuit breakers for external services', true, 100),
  ('langsmith_tracing', 'LangSmith Tracing', 'Send traces to LangSmith', false, 100),
  ('hitl_approvals', 'HITL Approvals', 'Require human approval for sensitive actions', true, 100),
  ('agent_analytics', 'Agent Analytics', 'Collect detailed agent execution analytics', true, 100)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Grant permissions
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
