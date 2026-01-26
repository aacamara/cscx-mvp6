-- Migration: Agent Schedules and Memory Tables
-- Date: 2025-01-26
-- Description: Creates tables for scheduled agent runs and agent memory/context persistence

-- ============================================
-- Agent Schedules Table
-- Stores scheduled agent runs with cron expressions
-- ============================================

CREATE TABLE IF NOT EXISTS agent_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'failed', 'running')),
  last_run_error TEXT,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for agent_schedules
CREATE INDEX IF NOT EXISTS idx_agent_schedules_user_id ON agent_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_schedules_customer_id ON agent_schedules(customer_id);
CREATE INDEX IF NOT EXISTS idx_agent_schedules_enabled ON agent_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_agent_schedules_next_run ON agent_schedules(next_run_at) WHERE enabled = true;

-- ============================================
-- Agent Schedule Runs Table
-- Logs each execution of a scheduled agent run
-- ============================================

CREATE TABLE IF NOT EXISTS agent_schedule_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES agent_schedules(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'running')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  steps_executed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for agent_schedule_runs
CREATE INDEX IF NOT EXISTS idx_agent_schedule_runs_schedule_id ON agent_schedule_runs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_agent_schedule_runs_started_at ON agent_schedule_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_schedule_runs_status ON agent_schedule_runs(status);

-- ============================================
-- Agent Memory Table
-- Stores persistent memory and context for agents per customer
-- ============================================

CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('conversation', 'action', 'insight', 'preference', 'context', 'summary')),
  content TEXT NOT NULL,
  metadata JSONB,
  embedding vector(1536),  -- For semantic search (if pgvector is enabled)
  importance INTEGER NOT NULL DEFAULT 50 CHECK (importance >= 0 AND importance <= 100),
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for agent_memory
CREATE INDEX IF NOT EXISTS idx_agent_memory_customer_id ON agent_memory(customer_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_user_id ON agent_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_importance ON agent_memory(importance DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_expires_at ON agent_memory(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_memory_created_at ON agent_memory(created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_agent_memory_customer_type_importance
  ON agent_memory(customer_id, type, importance DESC);

-- ============================================
-- Function to increment memory access count
-- Called when a memory is retrieved
-- ============================================

CREATE OR REPLACE FUNCTION increment_memory_access(memory_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE agent_memory
  SET
    access_count = access_count + 1,
    last_accessed_at = NOW(),
    updated_at = NOW()
  WHERE id = memory_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger to update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to agent_schedules
DROP TRIGGER IF EXISTS trigger_agent_schedules_updated_at ON agent_schedules;
CREATE TRIGGER trigger_agent_schedules_updated_at
  BEFORE UPDATE ON agent_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to agent_memory
DROP TRIGGER IF EXISTS trigger_agent_memory_updated_at ON agent_memory;
CREATE TRIGGER trigger_agent_memory_updated_at
  BEFORE UPDATE ON agent_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) Policies
-- Ensures users can only access their own data
-- ============================================

-- Enable RLS on tables
ALTER TABLE agent_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_schedule_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_schedules
CREATE POLICY "Users can view their own schedules"
  ON agent_schedules FOR SELECT
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can create their own schedules"
  ON agent_schedules FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can update their own schedules"
  ON agent_schedules FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can delete their own schedules"
  ON agent_schedules FOR DELETE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

-- RLS policies for agent_schedule_runs (based on schedule ownership)
CREATE POLICY "Users can view runs for their schedules"
  ON agent_schedule_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_schedules
      WHERE agent_schedules.id = agent_schedule_runs.schedule_id
      AND (agent_schedules.user_id = auth.uid()::text OR agent_schedules.user_id = 'demo-user')
    )
  );

-- RLS policies for agent_memory
CREATE POLICY "Users can view their own memories"
  ON agent_memory FOR SELECT
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can create their own memories"
  ON agent_memory FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can update their own memories"
  ON agent_memory FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can delete their own memories"
  ON agent_memory FOR DELETE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

-- ============================================
-- Service role bypass for RLS
-- Allows backend service to access all data
-- ============================================

CREATE POLICY "Service role can access all schedules"
  ON agent_schedules FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all runs"
  ON agent_schedule_runs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all memories"
  ON agent_memory FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON TABLE agent_schedules IS 'Stores scheduled agent runs with cron-based timing';
COMMENT ON TABLE agent_schedule_runs IS 'Logs each execution of a scheduled agent run';
COMMENT ON TABLE agent_memory IS 'Persistent memory and context for agents per customer';

COMMENT ON COLUMN agent_schedules.cron_expression IS 'Standard cron expression (minute hour day month weekday)';
COMMENT ON COLUMN agent_schedules.frequency IS 'Human-readable frequency: daily, weekly, monthly, or custom';
COMMENT ON COLUMN agent_memory.importance IS 'Priority score 0-100, used for context prioritization';
COMMENT ON COLUMN agent_memory.embedding IS 'Optional vector embedding for semantic search';
COMMENT ON COLUMN agent_memory.expires_at IS 'Optional TTL - memory auto-expires after this time';
