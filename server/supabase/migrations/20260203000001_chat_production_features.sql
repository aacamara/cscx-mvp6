-- Migration: Chat Production-Ready Features
-- Date: 2026-02-03
-- Features: Message status tracking, offline queue, message actions

-- ================================================
-- CHAT_MESSAGES TABLE UPDATES
-- Add status field for optimistic updates
-- ================================================

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'status'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN status VARCHAR(20) DEFAULT 'sent';
  END IF;
END $$;

-- Add client_id for deduplication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN client_id VARCHAR(100);
  END IF;
END $$;

-- Add retry_count for failed messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON chat_messages(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_client_id ON chat_messages(client_id);

-- ================================================
-- MESSAGE_QUEUE TABLE
-- Stores messages queued during offline mode
-- ================================================
CREATE TABLE IF NOT EXISTS message_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  client_id VARCHAR(100) UNIQUE, -- Prevent duplicate sends
  message TEXT NOT NULL,
  agent_type VARCHAR(50),
  attachment_data JSONB,
  status VARCHAR(20) DEFAULT 'queued', -- queued, sending, sent, failed
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('queued', 'sending', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_message_queue_user ON message_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_customer ON message_queue(customer_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status);
CREATE INDEX IF NOT EXISTS idx_message_queue_created ON message_queue(created_at);

-- ================================================
-- MESSAGE_ACTIONS_LOG TABLE
-- Tracks user actions on messages (copy, retry, delete)
-- ================================================
CREATE TABLE IF NOT EXISTS message_actions_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  message_id UUID,
  action_type VARCHAR(50) NOT NULL, -- copy, retry, delete, report
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_actions_user ON message_actions_log(user_id);
CREATE INDEX IF NOT EXISTS idx_message_actions_type ON message_actions_log(action_type);

-- ================================================
-- USER_PREFERENCES TABLE
-- Store user preferences for chat features
-- ================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE,
  keyboard_shortcuts_enabled BOOLEAN DEFAULT TRUE,
  auto_scroll BOOLEAN DEFAULT TRUE,
  offline_mode_enabled BOOLEAN DEFAULT TRUE,
  message_history_size INTEGER DEFAULT 50,
  theme VARCHAR(20) DEFAULT 'dark',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- ================================================
-- ENABLE RLS ON NEW TABLES
-- ================================================

-- message_queue RLS
ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queued messages" ON message_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queued messages" ON message_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queued messages" ON message_queue
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own queued messages" ON message_queue
  FOR DELETE USING (auth.uid() = user_id);

-- message_actions_log RLS
ALTER TABLE message_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own action logs" ON message_actions_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own action logs" ON message_actions_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_preferences RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- ================================================
-- FUNCTION: Process offline queue
-- Call this when user comes back online
-- ================================================
CREATE OR REPLACE FUNCTION process_message_queue(p_user_id UUID)
RETURNS TABLE (
  queue_id UUID,
  message TEXT,
  customer_id UUID,
  status VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE message_queue mq
  SET status = 'sending'
  WHERE mq.user_id = p_user_id
    AND mq.status = 'queued'
  RETURNING mq.id, mq.message, mq.customer_id, mq.status;
END;
$$;

-- ================================================
-- FUNCTION: Mark queue item as sent
-- ================================================
CREATE OR REPLACE FUNCTION mark_queue_sent(p_queue_id UUID, p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE message_queue
  SET status = 'sent', sent_at = NOW()
  WHERE id = p_queue_id;

  -- Update the actual message with the client_id reference
  UPDATE chat_messages
  SET client_id = (SELECT client_id FROM message_queue WHERE id = p_queue_id)
  WHERE id = p_message_id;
END;
$$;

-- ================================================
-- FUNCTION: Mark queue item as failed
-- ================================================
CREATE OR REPLACE FUNCTION mark_queue_failed(p_queue_id UUID, p_error TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE message_queue
  SET
    status = CASE WHEN retry_count >= max_retries THEN 'failed' ELSE 'queued' END,
    retry_count = retry_count + 1,
    error_message = p_error
  WHERE id = p_queue_id;
END;
$$;

-- ================================================
-- GRANT PERMISSIONS
-- ================================================
GRANT ALL ON message_queue TO authenticated;
GRANT ALL ON message_actions_log TO authenticated;
GRANT ALL ON user_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION process_message_queue TO authenticated;
GRANT EXECUTE ON FUNCTION mark_queue_sent TO authenticated;
GRANT EXECUTE ON FUNCTION mark_queue_failed TO authenticated;

-- ================================================
-- COMMENTS
-- ================================================
COMMENT ON TABLE message_queue IS 'Stores messages queued during offline mode for later processing';
COMMENT ON TABLE message_actions_log IS 'Tracks user interactions with messages (copy, retry, delete)';
COMMENT ON TABLE user_preferences IS 'Stores user preferences for chat features like keyboard shortcuts';
COMMENT ON COLUMN chat_messages.status IS 'Message status: pending, sent, failed';
COMMENT ON COLUMN chat_messages.client_id IS 'Client-generated ID for deduplication';
