-- Migration: 012_chat_messages_table.sql
-- Description: Add chat_messages table for storing agent chat interactions per customer
-- Created: 2026-01-22

-- ============================================
-- CHAT MESSAGES TABLE
-- ============================================
-- Stores all chat messages between users and agents per customer
-- Used for: Agent inbox, conversation history, analytics

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Message content
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,

  -- Agent context
  agent_type VARCHAR(50),  -- onboarding, adoption, renewal, risk, strategic, orchestrator

  -- Tool calls (for assistant messages that invoke tools)
  tool_calls JSONB DEFAULT NULL,  -- Array of { name, arguments, result }

  -- Session tracking
  session_id VARCHAR(100),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chat_messages_customer ON chat_messages(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent ON chat_messages(agent_type);

COMMENT ON TABLE chat_messages IS 'Chat message history between users and AI agents, scoped to customers';
COMMENT ON COLUMN chat_messages.role IS 'Message sender: user, assistant, system, or tool';
COMMENT ON COLUMN chat_messages.agent_type IS 'Type of agent that handled this message (null for user messages)';
COMMENT ON COLUMN chat_messages.tool_calls IS 'JSON array of tool invocations for assistant messages';
