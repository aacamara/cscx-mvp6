-- PRD-198: Segment Data Sync
-- Migration: 004_segment_integration.sql
-- Created: 2026-01-29

-- ============================================
-- Segment Events Table
-- Stores all incoming Segment events for processing
-- ============================================
CREATE TABLE IF NOT EXISTS segment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Event identification
  event_type VARCHAR(50) NOT NULL, -- 'track', 'identify', 'group'
  event_name TEXT, -- For track events, the event name
  message_id TEXT UNIQUE, -- Segment's messageId for deduplication

  -- User/Account identification
  user_id TEXT, -- Segment userId
  anonymous_id TEXT, -- Segment anonymousId
  group_id TEXT, -- Segment groupId (for group calls)

  -- Event data
  properties JSONB DEFAULT '{}',
  traits JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',

  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  retry_count INT DEFAULT 0,

  -- Mapping results
  mapped_signal_type VARCHAR(50),
  mapped_data JSONB,

  -- Timestamps
  original_timestamp TIMESTAMPTZ, -- When event occurred
  sent_at TIMESTAMPTZ, -- When Segment received it
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_segment_events_customer_id ON segment_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_segment_events_user_id ON segment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_segment_events_group_id ON segment_events(group_id);
CREATE INDEX IF NOT EXISTS idx_segment_events_event_type ON segment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_segment_events_event_name ON segment_events(event_name);
CREATE INDEX IF NOT EXISTS idx_segment_events_processed ON segment_events(processed);
CREATE INDEX IF NOT EXISTS idx_segment_events_received_at ON segment_events(received_at DESC);

-- ============================================
-- Segment Event Mappings Table
-- Configuration for mapping Segment events to CSCX signals
-- ============================================
CREATE TABLE IF NOT EXISTS segment_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Mapping definition
  segment_event TEXT NOT NULL, -- e.g., 'Feature Used', 'Upgrade Started'
  cscx_signal_type VARCHAR(50) NOT NULL, -- e.g., 'adoption', 'expansion', 'risk'

  -- Property mappings (Segment property -> CSCX field)
  property_mappings JSONB DEFAULT '{}',

  -- Conditions for when this mapping applies
  conditions JSONB DEFAULT '{}', -- e.g., {"property": "feature_name", "operator": "equals", "value": "Dashboard"}

  -- Signal configuration
  signal_priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  trigger_health_update BOOLEAN DEFAULT true,
  trigger_alert BOOLEAN DEFAULT false,

  -- Status
  enabled BOOLEAN DEFAULT true,

  -- Audit
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for event-signal combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_segment_mappings_unique
ON segment_mappings(segment_event, cscx_signal_type)
WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_segment_mappings_event ON segment_mappings(segment_event);
CREATE INDEX IF NOT EXISTS idx_segment_mappings_enabled ON segment_mappings(enabled);

-- ============================================
-- Segment Connection Configuration
-- Stores webhook credentials and settings per user/org
-- ============================================
CREATE TABLE IF NOT EXISTS segment_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- Webhook configuration
  write_key TEXT NOT NULL, -- Generated write key for this connection
  webhook_secret TEXT NOT NULL, -- For signature verification

  -- Settings
  enabled BOOLEAN DEFAULT true,
  process_identify BOOLEAN DEFAULT true,
  process_group BOOLEAN DEFAULT true,
  process_track BOOLEAN DEFAULT true,

  -- Identity resolution settings
  match_by_email BOOLEAN DEFAULT true,
  match_by_user_id BOOLEAN DEFAULT true,
  match_by_group_id BOOLEAN DEFAULT true,
  create_unknown_users BOOLEAN DEFAULT false,

  -- Statistics
  events_received INT DEFAULT 0,
  events_processed INT DEFAULT 0,
  events_failed INT DEFAULT 0,
  last_event_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================
-- Segment Dead Letter Queue
-- Events that failed processing after max retries
-- ============================================
CREATE TABLE IF NOT EXISTS segment_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id UUID REFERENCES segment_events(id) ON DELETE SET NULL,

  -- Original event data
  raw_payload JSONB NOT NULL,

  -- Failure details
  error_message TEXT NOT NULL,
  error_details JSONB,
  failed_at TIMESTAMPTZ DEFAULT NOW(),
  retry_count INT DEFAULT 0,

  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_segment_dlq_resolved ON segment_dead_letter_queue(resolved);
CREATE INDEX IF NOT EXISTS idx_segment_dlq_failed_at ON segment_dead_letter_queue(failed_at DESC);

-- ============================================
-- Segment Identity Links
-- Maps Segment user/group IDs to CSCX records
-- ============================================
CREATE TABLE IF NOT EXISTS segment_identity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Segment identifiers
  segment_user_id TEXT,
  segment_anonymous_id TEXT,
  segment_group_id TEXT,

  -- CSCX mappings
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE CASCADE,

  -- Confidence and source
  confidence DECIMAL(3,2) DEFAULT 1.0, -- 0.00 to 1.00
  source VARCHAR(50), -- 'identify_call', 'group_call', 'manual', 'inferred'

  -- Timestamps
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segment_identity_user ON segment_identity_links(segment_user_id);
CREATE INDEX IF NOT EXISTS idx_segment_identity_anon ON segment_identity_links(segment_anonymous_id);
CREATE INDEX IF NOT EXISTS idx_segment_identity_group ON segment_identity_links(segment_group_id);
CREATE INDEX IF NOT EXISTS idx_segment_identity_customer ON segment_identity_links(customer_id);

-- ============================================
-- Default Event Mappings
-- Pre-configured mappings for common Segment events
-- ============================================
INSERT INTO segment_mappings (segment_event, cscx_signal_type, property_mappings, signal_priority, trigger_health_update, trigger_alert)
VALUES
  -- Adoption signals
  ('Feature Used', 'adoption', '{"feature_name": "feature", "duration_seconds": "duration"}', 'medium', true, false),
  ('Login', 'adoption', '{"platform": "platform"}', 'low', true, false),
  ('Session Started', 'adoption', '{"device": "device", "platform": "platform"}', 'low', true, false),

  -- Expansion signals
  ('Upgrade Started', 'expansion', '{"plan": "target_plan", "current_plan": "current_plan"}', 'high', true, true),
  ('Pricing Page Viewed', 'expansion', '{"current_plan": "current_plan"}', 'medium', false, false),
  ('Add Users Clicked', 'expansion', '{"current_seats": "current_seats"}', 'medium', true, false),

  -- Risk signals
  ('Support Ticket Opened', 'risk', '{"priority": "priority", "category": "category"}', 'medium', true, true),
  ('Cancellation Requested', 'risk', '{"reason": "reason"}', 'critical', true, true),
  ('Export Data Requested', 'risk', '{}', 'high', true, true),
  ('Downgrade Started', 'risk', '{"target_plan": "target_plan", "reason": "reason"}', 'critical', true, true),

  -- Engagement signals
  ('Invite Sent', 'engagement', '{"invitee_role": "role"}', 'medium', true, false),
  ('Integration Connected', 'engagement', '{"integration_name": "integration"}', 'high', true, false),
  ('Report Generated', 'engagement', '{"report_type": "type"}', 'medium', true, false)
ON CONFLICT DO NOTHING;

-- ============================================
-- Update trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_segment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DROP TRIGGER IF EXISTS segment_events_updated_at ON segment_events;
CREATE TRIGGER segment_events_updated_at
  BEFORE UPDATE ON segment_events
  FOR EACH ROW
  EXECUTE FUNCTION update_segment_updated_at();

DROP TRIGGER IF EXISTS segment_mappings_updated_at ON segment_mappings;
CREATE TRIGGER segment_mappings_updated_at
  BEFORE UPDATE ON segment_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_segment_updated_at();

DROP TRIGGER IF EXISTS segment_connections_updated_at ON segment_connections;
CREATE TRIGGER segment_connections_updated_at
  BEFORE UPDATE ON segment_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_segment_updated_at();

DROP TRIGGER IF EXISTS segment_identity_links_updated_at ON segment_identity_links;
CREATE TRIGGER segment_identity_links_updated_at
  BEFORE UPDATE ON segment_identity_links
  FOR EACH ROW
  EXECUTE FUNCTION update_segment_updated_at();
