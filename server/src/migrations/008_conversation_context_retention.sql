-- Migration: Conversation Context Retention (PRD-223)
-- Date: 2026-01-30
-- Description: Creates tables for conversation memories, customer contexts, and user preferences
--              with vector embeddings for semantic search

-- ============================================
-- Conversation Memories Table
-- Stores individual conversation turns with embeddings for semantic search
-- ============================================

CREATE TABLE IF NOT EXISTS conversation_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  summary TEXT,
  importance_score INTEGER DEFAULT 50 CHECK (importance_score >= 0 AND importance_score <= 100),
  embedding vector(768),  -- Using 768 for Gemini text-embedding-004
  metadata JSONB DEFAULT '{}',
  key_topics TEXT[] DEFAULT '{}',
  action_items TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for conversation_memories
CREATE INDEX IF NOT EXISTS idx_conv_memories_user_customer
  ON conversation_memories(user_id, customer_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_conv_memories_session
  ON conversation_memories(session_id, timestamp ASC);

CREATE INDEX IF NOT EXISTS idx_conv_memories_timestamp
  ON conversation_memories(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_conv_memories_importance
  ON conversation_memories(importance_score DESC)
  WHERE importance_score >= 70;

-- Vector similarity search index (IVFFlat for performance)
CREATE INDEX IF NOT EXISTS idx_conv_memories_embedding
  ON conversation_memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- GIN index for array columns
CREATE INDEX IF NOT EXISTS idx_conv_memories_topics
  ON conversation_memories USING gin(key_topics);

CREATE INDEX IF NOT EXISTS idx_conv_memories_actions
  ON conversation_memories USING gin(action_items);

-- ============================================
-- Customer Contexts Table
-- Stores aggregated context per customer
-- ============================================

CREATE TABLE IF NOT EXISTS customer_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  last_discussed TIMESTAMPTZ,
  recent_topics TEXT[] DEFAULT '{}',
  pending_actions JSONB DEFAULT '[]',
  key_decisions JSONB DEFAULT '[]',
  relationship_notes TEXT,
  sentiment_history JSONB DEFAULT '[]',  -- Array of {score, timestamp}
  communication_preferences JSONB DEFAULT '{}',
  last_interaction_summary TEXT,
  conversation_count INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, customer_id)
);

-- Indexes for customer_contexts
CREATE INDEX IF NOT EXISTS idx_customer_contexts_user
  ON customer_contexts(user_id);

CREATE INDEX IF NOT EXISTS idx_customer_contexts_customer
  ON customer_contexts(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_contexts_last_discussed
  ON customer_contexts(last_discussed DESC);

-- ============================================
-- User Memories Table
-- Stores explicit user-created memories and preferences
-- ============================================

CREATE TABLE IF NOT EXISTS user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,  -- NULL for global memories
  memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN ('note', 'preference', 'decision', 'shortcut', 'workflow')),
  content TEXT NOT NULL,
  importance VARCHAR(20) DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high', 'critical')),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes for user_memories
CREATE INDEX IF NOT EXISTS idx_user_memories_user
  ON user_memories(user_id);

CREATE INDEX IF NOT EXISTS idx_user_memories_customer
  ON user_memories(customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_memories_type
  ON user_memories(memory_type);

CREATE INDEX IF NOT EXISTS idx_user_memories_active
  ON user_memories(active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_user_memories_tags
  ON user_memories USING gin(tags);

-- ============================================
-- User Preferences Table
-- Stores user-level preferences and working patterns
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  communication_style VARCHAR(20) DEFAULT 'professional' CHECK (communication_style IN ('formal', 'casual', 'brief', 'professional')),
  preferred_actions TEXT[] DEFAULT '{}',
  timezone TEXT DEFAULT 'America/New_York',
  working_hours_start TIME DEFAULT '09:00',
  working_hours_end TIME DEFAULT '17:00',
  email_signature TEXT,
  common_shortcuts JSONB DEFAULT '{}',  -- {"alias": "expansion"}
  notification_preferences JSONB DEFAULT '{}',
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user
  ON user_preferences(user_id);

-- ============================================
-- Work State Table
-- Tracks active work context per user
-- ============================================

CREATE TABLE IF NOT EXISTS work_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  active_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  active_session_id TEXT,
  pending_drafts JSONB DEFAULT '[]',
  in_progress_tasks JSONB DEFAULT '[]',
  recent_searches TEXT[] DEFAULT '{}',
  recent_customers UUID[] DEFAULT '{}',
  context_switches INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for work_state
CREATE INDEX IF NOT EXISTS idx_work_state_user
  ON work_state(user_id);

-- ============================================
-- Conversation Summaries Table
-- Stores periodic summaries of conversation history
-- ============================================

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  key_topics TEXT[] DEFAULT '{}',
  action_items_resolved TEXT[] DEFAULT '{}',
  action_items_pending TEXT[] DEFAULT '{}',
  decisions_made TEXT[] DEFAULT '{}',
  sentiment_average NUMERIC(3,2),
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for conversation_summaries
CREATE INDEX IF NOT EXISTS idx_conv_summaries_user_customer
  ON conversation_summaries(user_id, customer_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_conv_summaries_period
  ON conversation_summaries(period_end DESC);

-- ============================================
-- Function: Search conversation memories by semantic similarity
-- ============================================

CREATE OR REPLACE FUNCTION search_conversation_memories(
  query_embedding vector(768),
  p_user_id TEXT,
  p_customer_id UUID DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  customer_id UUID,
  session_id TEXT,
  role VARCHAR(20),
  content TEXT,
  summary TEXT,
  importance_score INTEGER,
  key_topics TEXT[],
  timestamp TIMESTAMPTZ,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.customer_id,
    cm.session_id,
    cm.role,
    cm.content,
    cm.summary,
    cm.importance_score,
    cm.key_topics,
    cm.timestamp,
    1 - (cm.embedding <=> query_embedding) AS similarity
  FROM conversation_memories cm
  WHERE
    cm.user_id = p_user_id
    AND (p_customer_id IS NULL OR cm.customer_id = p_customer_id)
    AND cm.embedding IS NOT NULL
    AND 1 - (cm.embedding <=> query_embedding) > match_threshold
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Update customer context from conversation
-- ============================================

CREATE OR REPLACE FUNCTION update_customer_context_from_conversation(
  p_user_id TEXT,
  p_customer_id UUID,
  p_topics TEXT[],
  p_action_items TEXT[]
)
RETURNS void AS $$
BEGIN
  INSERT INTO customer_contexts (user_id, customer_id, last_discussed, recent_topics, pending_actions, conversation_count, total_messages)
  VALUES (p_user_id, p_customer_id, NOW(), p_topics, to_jsonb(p_action_items), 1, 1)
  ON CONFLICT (user_id, customer_id) DO UPDATE SET
    last_discussed = NOW(),
    recent_topics = (
      SELECT array_agg(DISTINCT topic)
      FROM (
        SELECT unnest(customer_contexts.recent_topics[1:7] || p_topics) AS topic
      ) t
      LIMIT 10
    ),
    pending_actions = (
      SELECT jsonb_agg(DISTINCT item)
      FROM (
        SELECT jsonb_array_elements(customer_contexts.pending_actions) AS item
        UNION
        SELECT to_jsonb(unnest(p_action_items)) AS item
      ) combined
    ),
    conversation_count = customer_contexts.conversation_count + 1,
    total_messages = customer_contexts.total_messages + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Get recent context for a customer
-- ============================================

CREATE OR REPLACE FUNCTION get_customer_recent_context(
  p_user_id TEXT,
  p_customer_id UUID,
  p_message_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  context_type TEXT,
  content TEXT,
  timestamp TIMESTAMPTZ,
  importance INTEGER
) AS $$
BEGIN
  -- Return recent messages
  RETURN QUERY
  SELECT
    'conversation'::TEXT AS context_type,
    cm.content,
    cm.timestamp,
    cm.importance_score AS importance
  FROM conversation_memories cm
  WHERE cm.user_id = p_user_id
    AND cm.customer_id = p_customer_id
  ORDER BY cm.timestamp DESC
  LIMIT p_message_limit;

  -- Return customer context summary
  RETURN QUERY
  SELECT
    'customer_context'::TEXT AS context_type,
    COALESCE(cc.last_interaction_summary, '') || ' Topics: ' || array_to_string(cc.recent_topics, ', ') AS content,
    cc.updated_at AS timestamp,
    90 AS importance
  FROM customer_contexts cc
  WHERE cc.user_id = p_user_id
    AND cc.customer_id = p_customer_id;

  -- Return explicit memories
  RETURN QUERY
  SELECT
    'memory'::TEXT AS context_type,
    um.content,
    um.created_at AS timestamp,
    CASE um.importance
      WHEN 'critical' THEN 100
      WHEN 'high' THEN 80
      WHEN 'medium' THEN 50
      ELSE 30
    END AS importance
  FROM user_memories um
  WHERE um.user_id = p_user_id
    AND (um.customer_id = p_customer_id OR um.customer_id IS NULL)
    AND um.active = true
  ORDER BY um.importance DESC, um.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_customer_contexts_updated_at ON customer_contexts;
CREATE TRIGGER trigger_customer_contexts_updated_at
  BEFORE UPDATE ON customer_contexts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trigger_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_work_state_updated_at ON work_state;
CREATE TRIGGER trigger_work_state_updated_at
  BEFORE UPDATE ON work_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE conversation_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversation_memories
CREATE POLICY "Users can view their own conversation memories"
  ON conversation_memories FOR SELECT
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can create their own conversation memories"
  ON conversation_memories FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can update their own conversation memories"
  ON conversation_memories FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can delete their own conversation memories"
  ON conversation_memories FOR DELETE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

-- RLS Policies for customer_contexts
CREATE POLICY "Users can view their own customer contexts"
  ON customer_contexts FOR SELECT
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can create their own customer contexts"
  ON customer_contexts FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can update their own customer contexts"
  ON customer_contexts FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can delete their own customer contexts"
  ON customer_contexts FOR DELETE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

-- RLS Policies for user_memories
CREATE POLICY "Users can view their own memories"
  ON user_memories FOR SELECT
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can create their own memories"
  ON user_memories FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can update their own memories"
  ON user_memories FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can delete their own memories"
  ON user_memories FOR DELETE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

-- RLS Policies for user_preferences
CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can create their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

-- RLS Policies for work_state
CREATE POLICY "Users can view their own work state"
  ON work_state FOR SELECT
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can create their own work state"
  ON work_state FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can update their own work state"
  ON work_state FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

-- RLS Policies for conversation_summaries
CREATE POLICY "Users can view their own summaries"
  ON conversation_summaries FOR SELECT
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can create their own summaries"
  ON conversation_summaries FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id = 'demo-user');

-- Service role bypass
CREATE POLICY "Service role can access all conversation_memories"
  ON conversation_memories FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all customer_contexts"
  ON customer_contexts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all user_memories"
  ON user_memories FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all user_preferences"
  ON user_preferences FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all work_state"
  ON work_state FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all conversation_summaries"
  ON conversation_summaries FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE conversation_memories IS 'Stores conversation turns with vector embeddings for semantic search (PRD-223)';
COMMENT ON TABLE customer_contexts IS 'Aggregated context per customer including topics, actions, and sentiment (PRD-223)';
COMMENT ON TABLE user_memories IS 'Explicit user-created memories and notes (PRD-223)';
COMMENT ON TABLE user_preferences IS 'User-level preferences and working patterns (PRD-223)';
COMMENT ON TABLE work_state IS 'Active work context and recent activity (PRD-223)';
COMMENT ON TABLE conversation_summaries IS 'Periodic summaries of conversation history (PRD-223)';

COMMENT ON FUNCTION search_conversation_memories IS 'Semantic search for relevant conversation memories using vector similarity';
COMMENT ON FUNCTION update_customer_context_from_conversation IS 'Updates customer context with new topics and action items';
COMMENT ON FUNCTION get_customer_recent_context IS 'Retrieves recent context for a customer including messages, context, and memories';
