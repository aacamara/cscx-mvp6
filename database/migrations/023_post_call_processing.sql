-- Migration: Post-Call Processing Tables
-- PRD-116: Automated post-call analysis, task creation, and follow-up email drafting

-- Post-call processing results table
CREATE TABLE IF NOT EXISTS post_call_processing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id VARCHAR(255) NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id VARCHAR(255) NOT NULL,

  -- Transcript reference
  transcript_id UUID REFERENCES meeting_transcripts(id) ON DELETE SET NULL,
  transcript_source VARCHAR(50), -- 'zoom', 'otter', 'google_meet', 'manual'
  transcript_text TEXT,

  -- Meeting info
  meeting_title VARCHAR(500),
  meeting_date TIMESTAMPTZ,
  duration_minutes INTEGER,
  participants JSONB DEFAULT '[]'::jsonb,

  -- AI Analysis Results
  summary TEXT,
  action_items JSONB DEFAULT '[]'::jsonb,
  -- Each: { description: string, owner: string, ownerType: 'internal'|'customer', dueDate?: string, priority: 'high'|'medium'|'low' }

  commitments JSONB DEFAULT '[]'::jsonb,
  -- Each: { description: string, party: 'us'|'customer', deadline?: string }

  risk_signals JSONB DEFAULT '[]'::jsonb,
  -- Each: { type: string, severity: 'low'|'medium'|'high', description: string }

  expansion_signals JSONB DEFAULT '[]'::jsonb,
  -- Each: { type: string, description: string, potential_value?: number }

  competitor_mentions TEXT[] DEFAULT '{}',

  sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative', 'mixed'
  sentiment_score DECIMAL(3, 2), -- -1.00 to 1.00

  -- Follow-up email
  follow_up_email_draft JSONB,
  -- { to: string[], cc?: string[], subject: string, bodyHtml: string, bodyText?: string }
  follow_up_email_approval_id VARCHAR(255),

  -- Created tasks
  tasks_created TEXT[] DEFAULT '{}', -- Array of task IDs

  -- CRM sync status
  crm_updated BOOLEAN DEFAULT FALSE,
  crm_activity_id VARCHAR(255),
  crm_sync_error TEXT,

  -- Processing status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'partial'
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_post_call_customer ON post_call_processing_results(customer_id);
CREATE INDEX IF NOT EXISTS idx_post_call_user ON post_call_processing_results(user_id);
CREATE INDEX IF NOT EXISTS idx_post_call_meeting_id ON post_call_processing_results(meeting_id);
CREATE INDEX IF NOT EXISTS idx_post_call_status ON post_call_processing_results(status);
CREATE INDEX IF NOT EXISTS idx_post_call_meeting_date ON post_call_processing_results(meeting_date DESC);

-- Add composite index for user + status queries
CREATE INDEX IF NOT EXISTS idx_post_call_user_status ON post_call_processing_results(user_id, status);

-- Post-call processing queue for retries and background processing
CREATE TABLE IF NOT EXISTS post_call_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processing_result_id UUID REFERENCES post_call_processing_results(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Trigger source
  trigger_source VARCHAR(50) NOT NULL, -- 'zoom_webhook', 'otter_webhook', 'calendar', 'manual'
  trigger_data JSONB,

  -- Queue status
  status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed', 'cancelled'
  priority INTEGER DEFAULT 0, -- Higher = more urgent

  -- Retry tracking
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for queue processing
CREATE INDEX IF NOT EXISTS idx_post_call_queue_status ON post_call_processing_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_post_call_queue_user ON post_call_processing_queue(user_id);

-- Webhook logs for debugging and audit
CREATE TABLE IF NOT EXISTS post_call_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL, -- 'zoom', 'otter', 'google_calendar'
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255),
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_result_id UUID REFERENCES post_call_processing_results(id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for webhook logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON post_call_webhook_logs(source, event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON post_call_webhook_logs(created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_post_call_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_post_call_processing_results_timestamp ON post_call_processing_results;
CREATE TRIGGER update_post_call_processing_results_timestamp
  BEFORE UPDATE ON post_call_processing_results
  FOR EACH ROW
  EXECUTE FUNCTION update_post_call_timestamp();

DROP TRIGGER IF EXISTS update_post_call_queue_timestamp ON post_call_processing_queue;
CREATE TRIGGER update_post_call_queue_timestamp
  BEFORE UPDATE ON post_call_processing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_post_call_timestamp();

-- Enable RLS
ALTER TABLE post_call_processing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_call_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_call_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own post-call results" ON post_call_processing_results
  FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own post-call results" ON post_call_processing_results
  FOR INSERT WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own post-call results" ON post_call_processing_results
  FOR UPDATE USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can view their own queue items" ON post_call_processing_queue
  FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Service role bypass for webhooks (using service key)
CREATE POLICY "Service role can access all post-call data" ON post_call_processing_results
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "Service role can access all queue items" ON post_call_processing_queue
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "Service role can access all webhook logs" ON post_call_webhook_logs
  FOR ALL USING (current_setting('role', true) = 'service_role');

COMMENT ON TABLE post_call_processing_results IS 'PRD-116: Stores results of automated post-call processing including transcript analysis, action items, and follow-up email drafts';
COMMENT ON TABLE post_call_processing_queue IS 'PRD-116: Queue for async post-call processing with retry support';
COMMENT ON TABLE post_call_webhook_logs IS 'PRD-116: Audit log for incoming webhooks from Zoom/Otter/Calendar';
