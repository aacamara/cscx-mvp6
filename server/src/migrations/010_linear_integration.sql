-- PRD-202: Linear Issue Integration
-- Migration: 010_linear_integration.sql
-- Created: 2026-01-30

-- ============================================
-- Linear Connections Table
-- Stores OAuth credentials per user
-- ============================================
CREATE TABLE IF NOT EXISTS linear_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,

  -- OAuth tokens
  access_token TEXT NOT NULL,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_in INTEGER,
  scope TEXT,

  -- Configuration
  config JSONB DEFAULT '{
    "syncSchedule": "hourly",
    "customerLabelPrefix": "customer:",
    "includeInHealthScore": true,
    "notifyOnCompletion": true,
    "notifyOnPriorityChange": true
  }',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linear_connections_user_id ON linear_connections(user_id);

-- ============================================
-- Linear Issues Table
-- Stores synced issues from Linear
-- ============================================
CREATE TABLE IF NOT EXISTS linear_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id TEXT UNIQUE NOT NULL,

  -- Issue identification
  identifier TEXT NOT NULL, -- e.g., "ENG-123"
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,

  -- State
  state VARCHAR(50),
  state_type VARCHAR(20), -- 'backlog', 'unstarted', 'started', 'completed', 'canceled'

  -- Priority (0=No priority, 1=Urgent, 2=High, 3=Normal, 4=Low)
  priority INTEGER DEFAULT 0,
  priority_label VARCHAR(20),

  -- Assignment
  assignee TEXT,
  assignee_email TEXT,

  -- Team/Project/Cycle
  team TEXT,
  team_key VARCHAR(10),
  project TEXT,
  cycle TEXT,

  -- Labels (stored as array)
  labels TEXT[] DEFAULT '{}',

  -- Dates
  due_date DATE,
  estimate REAL,
  linear_created_at TIMESTAMPTZ,
  linear_updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_linear_issues_identifier ON linear_issues(identifier);
CREATE INDEX IF NOT EXISTS idx_linear_issues_state_type ON linear_issues(state_type);
CREATE INDEX IF NOT EXISTS idx_linear_issues_priority ON linear_issues(priority);
CREATE INDEX IF NOT EXISTS idx_linear_issues_team ON linear_issues(team);
CREATE INDEX IF NOT EXISTS idx_linear_issues_assignee ON linear_issues(assignee);
CREATE INDEX IF NOT EXISTS idx_linear_issues_linear_updated_at ON linear_issues(linear_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_linear_issues_labels ON linear_issues USING GIN(labels);

-- ============================================
-- Linear Customer Links Table
-- Many-to-many relationship between issues and customers
-- ============================================
CREATE TABLE IF NOT EXISTS linear_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id TEXT NOT NULL REFERENCES linear_issues(linear_id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Link metadata
  link_type VARCHAR(20) DEFAULT 'label', -- 'label', 'project', 'manual'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(linear_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_linear_customer_links_linear_id ON linear_customer_links(linear_id);
CREATE INDEX IF NOT EXISTS idx_linear_customer_links_customer_id ON linear_customer_links(customer_id);

-- ============================================
-- Linear Customer Labels Table
-- Maps customers to their Linear labels
-- ============================================
CREATE TABLE IF NOT EXISTS linear_customer_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  label_name TEXT NOT NULL, -- e.g., "customer:acmecorp"

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linear_customer_labels_customer_id ON linear_customer_labels(customer_id);
CREATE INDEX IF NOT EXISTS idx_linear_customer_labels_label_name ON linear_customer_labels(label_name);

-- ============================================
-- Linear Sync Logs Table
-- Track sync operations
-- ============================================
CREATE TABLE IF NOT EXISTS linear_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Sync details
  sync_type VARCHAR(20) NOT NULL, -- 'full', 'incremental', 'webhook'
  status VARCHAR(30) DEFAULT 'running', -- 'running', 'completed', 'completed_with_errors', 'failed'

  -- Counters
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Error tracking
  error_details TEXT[],

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_linear_sync_logs_user_id ON linear_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_linear_sync_logs_customer_id ON linear_sync_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_linear_sync_logs_status ON linear_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_linear_sync_logs_created_at ON linear_sync_logs(created_at DESC);

-- ============================================
-- Linear Webhook Events Table
-- Store incoming webhook events for processing
-- ============================================
CREATE TABLE IF NOT EXISTS linear_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Webhook metadata
  webhook_id TEXT,
  organization_id TEXT,

  -- Event details
  action VARCHAR(20) NOT NULL, -- 'create', 'update', 'remove'
  resource_type VARCHAR(50) NOT NULL, -- 'Issue', 'Comment', 'Project', etc.
  resource_id TEXT,

  -- Raw payload
  payload JSONB NOT NULL,

  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,

  -- Timestamps
  webhook_timestamp BIGINT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linear_webhook_events_resource_id ON linear_webhook_events(resource_id);
CREATE INDEX IF NOT EXISTS idx_linear_webhook_events_processed ON linear_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_linear_webhook_events_received_at ON linear_webhook_events(received_at DESC);

-- ============================================
-- Linear Notifications Table
-- Track notifications sent to CSMs
-- ============================================
CREATE TABLE IF NOT EXISTS linear_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  linear_id TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID, -- CSM user

  -- Notification details
  notification_type VARCHAR(30) NOT NULL, -- 'issue_completed', 'priority_elevated', 'cycle_changed'
  title TEXT NOT NULL,
  message TEXT,

  -- Status
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linear_notifications_customer_id ON linear_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_linear_notifications_user_id ON linear_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_linear_notifications_read ON linear_notifications(read);
CREATE INDEX IF NOT EXISTS idx_linear_notifications_created_at ON linear_notifications(created_at DESC);

-- ============================================
-- Add Linear to integration health types
-- ============================================
-- This is handled by the integration health service dynamically

-- ============================================
-- Insert default event mappings for Linear signals
-- ============================================
INSERT INTO segment_mappings (segment_event, cscx_signal_type, signal_priority, trigger_health_update, enabled)
VALUES
  ('linear_issue_completed', 'milestone', 'medium', true, true),
  ('linear_issue_priority_urgent', 'risk', 'high', true, true),
  ('linear_issue_created', 'engagement', 'low', false, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- Function to calculate issue impact
-- ============================================
CREATE OR REPLACE FUNCTION calculate_linear_issue_impact(p_linear_id TEXT)
RETURNS TABLE(customer_count INTEGER, total_arr NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT lcl.customer_id)::INTEGER as customer_count,
    COALESCE(SUM(c.arr), 0)::NUMERIC as total_arr
  FROM linear_customer_links lcl
  JOIN customers c ON c.id = lcl.customer_id
  WHERE lcl.linear_id = p_linear_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- View: Customer Issues Summary
-- ============================================
CREATE OR REPLACE VIEW linear_customer_summary AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  COUNT(DISTINCT li.id) FILTER (WHERE li.state_type IN ('backlog', 'unstarted', 'started')) as open_issues,
  COUNT(DISTINCT li.id) FILTER (WHERE li.state_type = 'completed') as completed_issues,
  COUNT(DISTINCT li.id) FILTER (WHERE li.priority <= 2) as high_priority_issues,
  MAX(li.linear_updated_at) as last_issue_update,
  ARRAY_AGG(DISTINCT li.team) FILTER (WHERE li.team IS NOT NULL) as teams
FROM customers c
LEFT JOIN linear_customer_links lcl ON lcl.customer_id = c.id
LEFT JOIN linear_issues li ON li.linear_id = lcl.linear_id
GROUP BY c.id, c.name;

COMMENT ON VIEW linear_customer_summary IS 'PRD-202: Summary of Linear issues per customer';

-- ============================================
-- Trigger: Update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_linear_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_linear_issues_updated_at
  BEFORE UPDATE ON linear_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_linear_updated_at();

CREATE TRIGGER trigger_linear_connections_updated_at
  BEFORE UPDATE ON linear_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_linear_updated_at();

CREATE TRIGGER trigger_linear_customer_labels_updated_at
  BEFORE UPDATE ON linear_customer_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_linear_updated_at();
