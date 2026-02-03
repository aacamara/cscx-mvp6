-- Migration: 023_salesforce_sync_log.sql
-- Purpose: Enhanced sync tracking for Salesforce bi-directional sync (PRD-181)

-- Drop and recreate salesforce_sync_log table with full tracking
DROP TABLE IF EXISTS salesforce_sync_log CASCADE;

CREATE TABLE salesforce_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integration_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sync_type VARCHAR(20) NOT NULL, -- 'full', 'incremental', 'push', 'webhook'
  direction VARCHAR(10) NOT NULL, -- 'pull', 'push', 'bidirectional'
  object_type VARCHAR(50), -- 'Account', 'Contact', etc.
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  error_details JSONB DEFAULT '[]',
  sync_metadata JSONB DEFAULT '{}', -- Additional context about the sync
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sf_sync_log_integration ON salesforce_sync_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_sf_sync_log_user ON salesforce_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sf_sync_log_status ON salesforce_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sf_sync_log_started ON salesforce_sync_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sf_sync_log_completed ON salesforce_sync_log(completed_at DESC);

-- Add sync configuration columns to integration_connections if not exists
DO $$
BEGIN
  -- Sync schedule configuration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'sync_schedule'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN sync_schedule VARCHAR(50) DEFAULT 'hourly';
  END IF;

  -- Conflict resolution strategy
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'conflict_resolution'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN conflict_resolution VARCHAR(50) DEFAULT 'salesforce_wins';
  END IF;

  -- Last incremental sync timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'last_incremental_sync_at'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN last_incremental_sync_at TIMESTAMPTZ;
  END IF;

  -- Health score field name in Salesforce
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'health_score_field'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN health_score_field VARCHAR(100) DEFAULT 'Health_Score__c';
  END IF;

  -- Health trend field name in Salesforce
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'health_trend_field'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN health_trend_field VARCHAR(100) DEFAULT 'Health_Trend__c';
  END IF;

  -- Sandbox mode flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'is_sandbox'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN is_sandbox BOOLEAN DEFAULT FALSE;
  END IF;

  -- Webhook configuration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'webhook_enabled'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN webhook_enabled BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'webhook_secret'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN webhook_secret VARCHAR(255);
  END IF;
END $$;

-- Add health_trend column to customers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'health_trend'
  ) THEN
    ALTER TABLE customers ADD COLUMN health_trend VARCHAR(20); -- 'growing', 'stable', 'declining'
  END IF;

  -- Add last_health_score_sync for tracking when health was last pushed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'last_health_score_sync'
  ) THEN
    ALTER TABLE customers ADD COLUMN last_health_score_sync TIMESTAMPTZ;
  END IF;
END $$;

-- Add title column to stakeholders if not exists (for Salesforce Contact mapping)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stakeholders' AND column_name = 'title'
  ) THEN
    ALTER TABLE stakeholders ADD COLUMN title VARCHAR(255);
  END IF;

  -- External ID for stakeholders (Salesforce Contact ID)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stakeholders' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE stakeholders ADD COLUMN external_id VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stakeholders' AND column_name = 'external_source'
  ) THEN
    ALTER TABLE stakeholders ADD COLUMN external_source VARCHAR(50);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stakeholders_external ON stakeholders(external_id, external_source);

-- Function to get sync statistics
CREATE OR REPLACE FUNCTION get_salesforce_sync_stats(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_syncs BIGINT,
  successful_syncs BIGINT,
  failed_syncs BIGINT,
  total_records_processed BIGINT,
  total_records_created BIGINT,
  total_records_updated BIGINT,
  avg_sync_duration_seconds NUMERIC,
  last_sync_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_syncs,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as successful_syncs,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_syncs,
    COALESCE(SUM(records_processed), 0)::BIGINT as total_records_processed,
    COALESCE(SUM(records_created), 0)::BIGINT as total_records_created,
    COALESCE(SUM(records_updated), 0)::BIGINT as total_records_updated,
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::NUMERIC,
      0
    ) as avg_sync_duration_seconds,
    MAX(completed_at) as last_sync_at
  FROM salesforce_sync_log
  WHERE user_id = p_user_id
    AND started_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE salesforce_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own sync logs
CREATE POLICY salesforce_sync_log_user_policy ON salesforce_sync_log
  FOR ALL USING (user_id = auth.uid());

COMMENT ON TABLE salesforce_sync_log IS 'Tracks all Salesforce sync operations for audit and debugging';
