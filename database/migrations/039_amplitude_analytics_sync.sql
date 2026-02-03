-- Migration: 039_amplitude_analytics_sync
-- PRD-196: Amplitude Analytics Sync
-- Created: 2026-01-29
--
-- This migration creates tables for storing Amplitude product analytics data
-- including metrics, funnels, cohorts, and customer-org mappings.

-- ============================================
-- AMPLITUDE METRICS TABLE
-- Stores aggregated daily metrics per customer
-- ============================================
CREATE TABLE IF NOT EXISTS amplitude_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amplitude_org_id TEXT NOT NULL,
  metric_date DATE NOT NULL,

  -- Active users metrics (FR-2)
  dau INTEGER NOT NULL DEFAULT 0,
  wau INTEGER NOT NULL DEFAULT 0,
  mau INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,

  -- Session metrics
  session_count INTEGER NOT NULL DEFAULT 0,
  events_count INTEGER NOT NULL DEFAULT 0,
  avg_session_duration NUMERIC,

  -- Retention rates (FR-2)
  retention_d1 NUMERIC,
  retention_d7 NUMERIC,
  retention_d30 NUMERIC,

  -- Stickiness metrics (FR-5)
  stickiness_ratio NUMERIC NOT NULL DEFAULT 0,

  -- Feature adoption
  unique_features_used INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one metric entry per customer per day
  UNIQUE(customer_id, metric_date)
);

-- Index for efficient querying by customer and date range
CREATE INDEX IF NOT EXISTS idx_amplitude_metrics_customer_date
  ON amplitude_metrics(customer_id, metric_date DESC);

-- Index for finding customers by org ID
CREATE INDEX IF NOT EXISTS idx_amplitude_metrics_org_id
  ON amplitude_metrics(amplitude_org_id);

-- ============================================
-- AMPLITUDE FUNNELS TABLE
-- Stores funnel analytics per customer (FR-4)
-- ============================================
CREATE TABLE IF NOT EXISTS amplitude_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  funnel_id TEXT NOT NULL,
  funnel_name TEXT NOT NULL,

  -- Funnel data (stored as JSONB for flexibility)
  steps JSONB NOT NULL DEFAULT '[]',

  -- Calculated metrics
  overall_conversion_rate NUMERIC NOT NULL DEFAULT 0,
  biggest_drop_off TEXT,

  -- Metric date
  metric_date DATE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one funnel entry per customer per funnel per day
  UNIQUE(customer_id, funnel_id, metric_date)
);

-- Index for querying funnels by customer
CREATE INDEX IF NOT EXISTS idx_amplitude_funnels_customer
  ON amplitude_funnels(customer_id, metric_date DESC);

-- ============================================
-- AMPLITUDE COHORTS TABLE
-- Stores behavioral cohort data (FR-3)
-- ============================================
CREATE TABLE IF NOT EXISTS amplitude_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  cohort_id TEXT NOT NULL,
  cohort_name TEXT NOT NULL,
  description TEXT,

  -- Cohort data
  user_count INTEGER NOT NULL DEFAULT 0,
  definition JSONB,

  -- Cohort type
  cohort_type TEXT CHECK (cohort_type IN ('power_users', 'at_risk', 'new_users', 'churned', 'custom')),

  -- Last sync
  synced_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id, cohort_id)
);

-- Index for querying cohorts by customer
CREATE INDEX IF NOT EXISTS idx_amplitude_cohorts_customer
  ON amplitude_cohorts(customer_id);

-- ============================================
-- AMPLITUDE CUSTOMER MAPPING TABLE
-- Maps CSCX customers to Amplitude org IDs (FR-2)
-- ============================================
CREATE TABLE IF NOT EXISTS amplitude_customer_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  amplitude_org_id TEXT NOT NULL,

  -- Optional: API key override per customer
  api_key_override TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up by org ID
CREATE INDEX IF NOT EXISTS idx_amplitude_mapping_org
  ON amplitude_customer_mapping(amplitude_org_id);

-- ============================================
-- AMPLITUDE SYNC LOG TABLE
-- Tracks sync operations history
-- ============================================
CREATE TABLE IF NOT EXISTS amplitude_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  integration_id UUID,

  -- Sync details
  object_type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'pull',
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),

  -- Results
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for querying sync logs by user
CREATE INDEX IF NOT EXISTS idx_amplitude_sync_log_user
  ON amplitude_sync_log(user_id, started_at DESC);

-- ============================================
-- AMPLITUDE HEALTH SCORE COMPONENTS TABLE
-- Stores calculated health score components (FR-6)
-- ============================================
CREATE TABLE IF NOT EXISTS amplitude_health_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Score components
  retention_score INTEGER NOT NULL DEFAULT 50,
  engagement_score INTEGER NOT NULL DEFAULT 50,
  feature_breadth_score INTEGER NOT NULL DEFAULT 50,
  overall_score INTEGER NOT NULL DEFAULT 50,

  -- Calculation metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_period_start DATE,
  data_period_end DATE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying health components by customer
CREATE INDEX IF NOT EXISTS idx_amplitude_health_customer
  ON amplitude_health_components(customer_id, calculated_at DESC);

-- ============================================
-- ADD INTEGRATION CONNECTION SUPPORT
-- Update integration_connections for Amplitude
-- ============================================
-- Add columns if they don't exist (for Amplitude-specific fields)
DO $$
BEGIN
  -- Add api_secret column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'api_secret'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN api_secret TEXT;
  END IF;

  -- Add org_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN org_id TEXT;
  END IF;

  -- Add sync_config column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'sync_config'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN sync_config JSONB;
  END IF;
END $$;

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_amplitude_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS amplitude_metrics_updated_at ON amplitude_metrics;
CREATE TRIGGER amplitude_metrics_updated_at
  BEFORE UPDATE ON amplitude_metrics
  FOR EACH ROW EXECUTE FUNCTION update_amplitude_updated_at();

DROP TRIGGER IF EXISTS amplitude_funnels_updated_at ON amplitude_funnels;
CREATE TRIGGER amplitude_funnels_updated_at
  BEFORE UPDATE ON amplitude_funnels
  FOR EACH ROW EXECUTE FUNCTION update_amplitude_updated_at();

DROP TRIGGER IF EXISTS amplitude_cohorts_updated_at ON amplitude_cohorts;
CREATE TRIGGER amplitude_cohorts_updated_at
  BEFORE UPDATE ON amplitude_cohorts
  FOR EACH ROW EXECUTE FUNCTION update_amplitude_updated_at();

DROP TRIGGER IF EXISTS amplitude_mapping_updated_at ON amplitude_customer_mapping;
CREATE TRIGGER amplitude_mapping_updated_at
  BEFORE UPDATE ON amplitude_customer_mapping
  FOR EACH ROW EXECUTE FUNCTION update_amplitude_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all Amplitude tables
ALTER TABLE amplitude_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE amplitude_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE amplitude_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE amplitude_customer_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE amplitude_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE amplitude_health_components ENABLE ROW LEVEL SECURITY;

-- Policies for service role (full access)
CREATE POLICY "Service role has full access to amplitude_metrics"
  ON amplitude_metrics FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to amplitude_funnels"
  ON amplitude_funnels FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to amplitude_cohorts"
  ON amplitude_cohorts FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to amplitude_customer_mapping"
  ON amplitude_customer_mapping FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to amplitude_sync_log"
  ON amplitude_sync_log FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to amplitude_health_components"
  ON amplitude_health_components FOR ALL
  TO service_role
  USING (true);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE amplitude_metrics IS 'PRD-196: Stores aggregated Amplitude metrics per customer per day';
COMMENT ON TABLE amplitude_funnels IS 'PRD-196: Stores funnel analytics data from Amplitude';
COMMENT ON TABLE amplitude_cohorts IS 'PRD-196: Stores behavioral cohort data from Amplitude';
COMMENT ON TABLE amplitude_customer_mapping IS 'PRD-196: Maps CSCX customers to Amplitude organization IDs';
COMMENT ON TABLE amplitude_sync_log IS 'PRD-196: Tracks Amplitude sync operations history';
COMMENT ON TABLE amplitude_health_components IS 'PRD-196: Stores calculated health score components from Amplitude data';

COMMENT ON COLUMN amplitude_metrics.stickiness_ratio IS 'DAU/MAU ratio - measures product stickiness';
COMMENT ON COLUMN amplitude_metrics.retention_d30 IS '30-day retention rate as percentage';
COMMENT ON COLUMN amplitude_funnels.steps IS 'JSONB array of funnel steps with conversion rates';
COMMENT ON COLUMN amplitude_cohorts.cohort_type IS 'Categorizes cohorts for quick filtering';
