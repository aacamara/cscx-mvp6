-- PRD-210: Zapier Webhook Integration
-- Migration: 010_zapier_webhooks.sql
-- Created: 2026-01-30

-- ============================================
-- Outbound Webhooks Table
-- Configuration for webhooks sent FROM CSCX.AI
-- ============================================
CREATE TABLE IF NOT EXISTS outbound_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Webhook configuration
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- Array of event types to trigger on
  headers JSONB DEFAULT '{}', -- Custom headers to include

  -- Status
  active BOOLEAN DEFAULT true,

  -- Security
  secret TEXT NOT NULL, -- For HMAC signature

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_webhooks_user_id ON outbound_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_outbound_webhooks_active ON outbound_webhooks(active);

-- ============================================
-- Webhook Deliveries Table
-- Log of all webhook delivery attempts
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES outbound_webhooks(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'delivered', 'failed', 'retrying'
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,

  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,

  -- Timestamps
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at)
  WHERE status = 'retrying';

-- ============================================
-- Inbound Webhook Tokens Table
-- Configuration for webhooks received BY CSCX.AI
-- ============================================
CREATE TABLE IF NOT EXISTS inbound_webhook_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Token for webhook URL
  token TEXT UNIQUE NOT NULL,

  -- Configuration
  name TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'create_customer', 'update_customer', 'log_activity', etc.
  field_mapping JSONB DEFAULT '{}', -- Maps incoming fields to CSCX fields

  -- Status
  active BOOLEAN DEFAULT true,

  -- Statistics
  events_received INT DEFAULT 0,
  events_processed INT DEFAULT 0,
  events_failed INT DEFAULT 0,
  last_event_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_tokens_user_id ON inbound_webhook_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_inbound_tokens_token ON inbound_webhook_tokens(token);
CREATE INDEX IF NOT EXISTS idx_inbound_tokens_active ON inbound_webhook_tokens(active);

-- ============================================
-- Inbound Webhook Logs Table
-- Log of all received webhooks
-- ============================================
CREATE TABLE IF NOT EXISTS inbound_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES inbound_webhook_tokens(id) ON DELETE SET NULL,

  -- Payload
  payload JSONB NOT NULL,
  headers JSONB DEFAULT '{}',

  -- Processing status
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  result_data JSONB, -- Store IDs of created/updated records

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inbound_logs_token_id ON inbound_webhook_logs(token_id);
CREATE INDEX IF NOT EXISTS idx_inbound_logs_processed ON inbound_webhook_logs(processed);
CREATE INDEX IF NOT EXISTS idx_inbound_logs_received_at ON inbound_webhook_logs(received_at DESC);

-- ============================================
-- API Keys Table
-- For REST API authentication
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Key details
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL, -- Hashed API key
  key_prefix TEXT NOT NULL, -- First 8 chars for display (cscx_xxx...)

  -- Permissions
  scopes TEXT[] DEFAULT ARRAY['read'], -- 'read', 'write', 'admin'

  -- Rate limiting
  rate_limit INTEGER DEFAULT 1000, -- Requests per minute

  -- Status
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ, -- Optional expiration

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  total_requests INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(active);

-- ============================================
-- API Request Logs Table
-- For auditing and rate limiting
-- ============================================
CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,

  -- Request details
  endpoint TEXT NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  request_body JSONB,
  response_body JSONB,

  -- Performance
  duration_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_key_id ON api_request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_request_logs(endpoint);

-- ============================================
-- Zapier Subscriptions Table
-- For Zapier trigger subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS zapier_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Subscription details
  target_url TEXT NOT NULL, -- Zapier's webhook URL
  event_type TEXT NOT NULL, -- Which event to subscribe to

  -- Status
  active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zapier_subs_user_id ON zapier_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_zapier_subs_event_type ON zapier_subscriptions(event_type);
CREATE INDEX IF NOT EXISTS idx_zapier_subs_active ON zapier_subscriptions(active);

-- ============================================
-- Update triggers for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outbound_webhooks_updated_at ON outbound_webhooks;
CREATE TRIGGER outbound_webhooks_updated_at
  BEFORE UPDATE ON outbound_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_webhooks_updated_at();

DROP TRIGGER IF EXISTS inbound_tokens_updated_at ON inbound_webhook_tokens;
CREATE TRIGGER inbound_tokens_updated_at
  BEFORE UPDATE ON inbound_webhook_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_webhooks_updated_at();

DROP TRIGGER IF EXISTS zapier_subs_updated_at ON zapier_subscriptions;
CREATE TRIGGER zapier_subs_updated_at
  BEFORE UPDATE ON zapier_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_webhooks_updated_at();
