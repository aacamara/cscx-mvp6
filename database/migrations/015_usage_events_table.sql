-- Migration: 015_usage_events_table.sql
-- Purpose: Store customer product usage events for real-time analytics

-- Usage events table for tracking customer product interactions
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,  -- 'login', 'feature_used', 'api_call', etc.
  event_name VARCHAR(255),           -- Specific event name
  user_id VARCHAR(255),              -- Customer's end user ID (their user, not our user)
  user_email VARCHAR(255),           -- Optional user email
  metadata JSONB DEFAULT '{}',       -- Additional event data
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_usage_events_customer_id ON usage_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON usage_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_events_customer_timestamp ON usage_events(customer_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events(event_type);

-- Computed usage metrics table (aggregated from events)
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  dau INT DEFAULT 0,                 -- Daily Active Users
  wau INT DEFAULT 0,                 -- Weekly Active Users
  mau INT DEFAULT 0,                 -- Monthly Active Users
  total_events INT DEFAULT 0,
  total_logins INT DEFAULT 0,
  unique_features_used INT DEFAULT 0,
  feature_breakdown JSONB DEFAULT '{}',  -- { "dashboard": 10, "reports": 5, ... }
  api_calls INT DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_customer_id ON usage_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_period ON usage_metrics(period_start, period_end);

-- Health score history for tracking trends
CREATE TABLE IF NOT EXISTS health_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  previous_score INT,
  score_components JSONB DEFAULT '{}',  -- { "usage": 85, "engagement": 70, ... }
  calculation_reason VARCHAR(100),      -- 'scheduled', 'event_trigger', 'manual'
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_score_history_customer ON health_score_history(customer_id, calculated_at DESC);

-- API keys for customer usage ingestion
CREATE TABLE IF NOT EXISTS usage_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  api_key VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) DEFAULT 'Default Key',
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_api_keys_key ON usage_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_usage_api_keys_customer ON usage_api_keys(customer_id);

-- Grant permissions (if using RLS)
-- ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE health_score_history ENABLE ROW LEVEL SECURITY;
