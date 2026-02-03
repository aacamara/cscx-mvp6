-- PRD-257: Cross-Functional Alignment Migration
-- Created: 2026-01-30
-- Description: Tables for unified activity timeline, account team members, and coordination

-- ============================================
-- cross_functional_activities table
-- Aggregated activities from all integrated systems
-- ============================================
CREATE TABLE IF NOT EXISTS cross_functional_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,

  -- Source system
  source_system VARCHAR(50) NOT NULL, -- 'salesforce', 'zendesk', 'jira', 'slack', 'cscx'
  source_id VARCHAR(200), -- ID in source system
  source_url TEXT, -- Link to source system

  -- Activity details
  activity_type VARCHAR(100) NOT NULL,
  title VARCHAR(500),
  description TEXT,
  team VARCHAR(50), -- 'sales', 'support', 'product', 'engineering', 'cs', 'executive'

  -- People
  performed_by_name VARCHAR(200),
  performed_by_email VARCHAR(200),
  performed_by_user_id UUID REFERENCES users(id), -- If internal user
  contact_name VARCHAR(200), -- Customer contact involved
  contact_email VARCHAR(200),

  -- Timing
  activity_date TIMESTAMPTZ NOT NULL,
  is_planned BOOLEAN DEFAULT false, -- Future activity

  -- Status
  status VARCHAR(50), -- Source-specific status
  outcome VARCHAR(100), -- Result if applicable

  -- Metadata
  metadata JSONB DEFAULT '{}',

  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- account_team_members table
-- Internal/external team members working on customer accounts
-- ============================================
CREATE TABLE IF NOT EXISTS account_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  user_id UUID REFERENCES users(id),
  external_email VARCHAR(200), -- For non-CSCX users
  name VARCHAR(200) NOT NULL,
  team VARCHAR(50) NOT NULL, -- 'sales', 'support', 'product', 'engineering', 'cs', 'executive'
  role VARCHAR(100) NOT NULL,
  responsibilities TEXT,
  source_system VARCHAR(50), -- Where this came from
  source_id VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, user_id),
  UNIQUE(customer_id, external_email)
);

-- ============================================
-- coordination_requests table
-- Hold-off requests and alignment coordination
-- ============================================
CREATE TABLE IF NOT EXISTS coordination_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  requested_by_user_id UUID REFERENCES users(id),
  request_type VARCHAR(50) NOT NULL, -- 'hold_off', 'alignment_call', 'context_share'
  target_team VARCHAR(50),
  target_email VARCHAR(200),
  reason TEXT NOT NULL,
  context_notes TEXT,
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'acknowledged', 'completed', 'expired', 'declined'
  response_notes TEXT,
  responded_by_user_id UUID REFERENCES users(id),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- activity_conflicts table
-- Detected conflicts in cross-functional activities
-- ============================================
CREATE TABLE IF NOT EXISTS activity_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  conflict_type VARCHAR(50) NOT NULL, -- 'multiple_outreach', 'message_conflict', 'overlap', 'gap'
  severity VARCHAR(20) DEFAULT 'warning', -- 'info', 'warning', 'critical'
  description TEXT,
  activities JSONB DEFAULT '[]', -- Array of conflicting activity IDs
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id),
  resolution_notes TEXT,
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- sync_status table
-- Track integration sync status
-- ============================================
CREATE TABLE IF NOT EXISTS integration_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(50) NOT NULL UNIQUE,
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(50) DEFAULT 'never', -- 'never', 'success', 'partial', 'failed'
  last_error TEXT,
  records_synced INTEGER DEFAULT 0,
  next_sync_at TIMESTAMPTZ,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cf_activities_customer ON cross_functional_activities(customer_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_cf_activities_source ON cross_functional_activities(source_system, source_id);
CREATE INDEX IF NOT EXISTS idx_cf_activities_team ON cross_functional_activities(team);
CREATE INDEX IF NOT EXISTS idx_cf_activities_date ON cross_functional_activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_cf_activities_contact ON cross_functional_activities(contact_email);
CREATE INDEX IF NOT EXISTS idx_cf_activities_planned ON cross_functional_activities(is_planned, activity_date) WHERE is_planned = true;

CREATE INDEX IF NOT EXISTS idx_account_team_customer ON account_team_members(customer_id);
CREATE INDEX IF NOT EXISTS idx_account_team_user ON account_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_account_team_active ON account_team_members(customer_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_coordination_customer ON coordination_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_coordination_status ON coordination_requests(status);
CREATE INDEX IF NOT EXISTS idx_coordination_target ON coordination_requests(target_team, target_email);

CREATE INDEX IF NOT EXISTS idx_conflicts_customer ON activity_conflicts(customer_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON activity_conflicts(customer_id, resolved_at) WHERE resolved_at IS NULL;

-- ============================================
-- Insert default sync status for known systems
-- ============================================
INSERT INTO integration_sync_status (source_system, is_enabled)
VALUES
  ('salesforce', true),
  ('zendesk', true),
  ('jira', true),
  ('slack', true),
  ('cscx', true)
ON CONFLICT (source_system) DO NOTHING;

-- ============================================
-- Trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cross_functional_activities_updated_at
  BEFORE UPDATE ON cross_functional_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_team_members_updated_at
  BEFORE UPDATE ON account_team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coordination_requests_updated_at
  BEFORE UPDATE ON coordination_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activity_conflicts_updated_at
  BEFORE UPDATE ON activity_conflicts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_sync_status_updated_at
  BEFORE UPDATE ON integration_sync_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
