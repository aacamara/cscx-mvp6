-- Migration: 017_integrations_table.sql
-- Purpose: Store CRM integration connections and sync history

-- Integration connections table
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'salesforce', 'hubspot', etc.
  access_token TEXT,
  refresh_token TEXT,
  instance_url TEXT,
  token_expires_at TIMESTAMPTZ,
  field_mappings JSONB DEFAULT '[]',
  sync_enabled BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_user ON integration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider ON integration_connections(provider);

-- Sync logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES integration_connections(id) ON DELETE CASCADE,
  provider VARCHAR(50),
  sync_type VARCHAR(50), -- 'accounts', 'contacts', 'health_scores', etc.
  records_synced INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_connection ON sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_completed ON sync_logs(completed_at DESC);

-- Add external_id and external_source to customers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN external_id VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'external_source'
  ) THEN
    ALTER TABLE customers ADD COLUMN external_source VARCHAR(50);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_external ON customers(external_id, external_source);
