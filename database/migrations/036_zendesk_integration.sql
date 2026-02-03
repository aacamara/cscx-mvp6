-- ============================================
-- PRD-184: Zendesk Ticket Integration
-- Migration: 036_zendesk_integration.sql
-- ============================================

-- Add Zendesk organization ID to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS zendesk_org_id BIGINT,
ADD COLUMN IF NOT EXISTS domain TEXT,
ADD COLUMN IF NOT EXISTS email_domains TEXT[];

CREATE INDEX IF NOT EXISTS idx_customers_zendesk_org ON customers(zendesk_org_id);
CREATE INDEX IF NOT EXISTS idx_customers_domain ON customers(domain);

-- ============================================
-- ZENDESK TICKETS
-- Stores synced support tickets from Zendesk
-- ============================================
CREATE TABLE IF NOT EXISTS zendesk_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zendesk_ticket_id BIGINT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  organization_id BIGINT,

  -- Ticket details
  subject TEXT,
  description TEXT,
  status VARCHAR(20) CHECK (status IN ('new', 'open', 'pending', 'hold', 'solved', 'closed')),
  priority VARCHAR(20) CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  ticket_type VARCHAR(20) CHECK (ticket_type IN ('problem', 'incident', 'question', 'task')),

  -- People
  requester_email TEXT,
  assignee_name TEXT,

  -- Metadata
  tags TEXT[],
  satisfaction_rating VARCHAR(20),
  custom_fields JSONB DEFAULT '{}',

  -- Timestamps
  zendesk_created_at TIMESTAMPTZ,
  zendesk_updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- CSCX timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zendesk_tickets_customer ON zendesk_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_zendesk_tickets_status ON zendesk_tickets(status);
CREATE INDEX IF NOT EXISTS idx_zendesk_tickets_priority ON zendesk_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_zendesk_tickets_org ON zendesk_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_zendesk_tickets_created ON zendesk_tickets(zendesk_created_at);
CREATE INDEX IF NOT EXISTS idx_zendesk_tickets_updated ON zendesk_tickets(zendesk_updated_at);

-- Auto-update timestamp trigger
CREATE TRIGGER update_zendesk_tickets_timestamp
  BEFORE UPDATE ON zendesk_tickets
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- ZENDESK METRICS
-- Daily support metrics per customer
-- ============================================
CREATE TABLE IF NOT EXISTS zendesk_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  metric_date DATE NOT NULL,

  -- Ticket counts
  open_tickets INTEGER DEFAULT 0,
  pending_tickets INTEGER DEFAULT 0,
  escalations INTEGER DEFAULT 0,

  -- Performance metrics
  avg_resolution_hours NUMERIC,

  -- Satisfaction
  csat_score NUMERIC CHECK (csat_score >= 0 AND csat_score <= 100),
  csat_responses INTEGER DEFAULT 0,

  -- Volume metrics
  ticket_volume_7d INTEGER DEFAULT 0,
  ticket_volume_30d INTEGER DEFAULT 0,

  -- SLA
  sla_breaches INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_zendesk_metrics_customer ON zendesk_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_zendesk_metrics_date ON zendesk_metrics(metric_date);

-- Auto-update timestamp trigger
CREATE TRIGGER update_zendesk_metrics_timestamp
  BEFORE UPDATE ON zendesk_metrics
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- ZENDESK SYNC LOG
-- Track sync operations for auditing
-- ============================================
CREATE TABLE IF NOT EXISTS zendesk_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID,

  -- Sync details
  object_type VARCHAR(50) NOT NULL, -- 'tickets', 'organizations'
  sync_type VARCHAR(50) NOT NULL,   -- 'full', 'incremental'
  status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),

  -- Counts
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Error tracking
  error_details TEXT[],

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_zendesk_sync_log_user ON zendesk_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_zendesk_sync_log_started ON zendesk_sync_log(started_at);

-- ============================================
-- ZENDESK ALERTS
-- Store triggered alerts for CSM notification
-- ============================================
CREATE TABLE IF NOT EXISTS zendesk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  ticket_id UUID REFERENCES zendesk_tickets(id) ON DELETE CASCADE,

  -- Alert details
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('escalation', 'sla_breach', 'ticket_spike', 'negative_csat')),
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT,
  metadata JSONB DEFAULT '{}',

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zendesk_alerts_customer ON zendesk_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_zendesk_alerts_type ON zendesk_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_zendesk_alerts_status ON zendesk_alerts(status);
CREATE INDEX IF NOT EXISTS idx_zendesk_alerts_created ON zendesk_alerts(created_at);

-- ============================================
-- UPDATE integration_connections TABLE
-- Add Zendesk-specific columns
-- ============================================
ALTER TABLE integration_connections
ADD COLUMN IF NOT EXISTS subdomain TEXT,
ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS customer_mappings JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS sync_open_only BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS health_score_weight INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS alert_config JSONB DEFAULT '{}';

-- ============================================
-- FUNCTION: Calculate support health impact
-- Returns a score modifier based on support metrics
-- ============================================
CREATE OR REPLACE FUNCTION calculate_support_health_impact(p_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_metrics RECORD;
  v_impact INTEGER := 0;
  v_weight INTEGER;
BEGIN
  -- Get latest metrics for customer
  SELECT * INTO v_metrics
  FROM zendesk_metrics
  WHERE customer_id = p_customer_id
  ORDER BY metric_date DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Get health score weight from integration config (default 15)
  SELECT COALESCE(health_score_weight, 15) INTO v_weight
  FROM integration_connections
  WHERE provider = 'zendesk'
  LIMIT 1;

  -- Calculate impact based on metrics
  -- Open tickets: -2 per ticket (max -10)
  v_impact := v_impact - LEAST(v_metrics.open_tickets * 2, 10);

  -- Escalations: -3 per escalation (max -15)
  v_impact := v_impact - LEAST(v_metrics.escalations * 3, 15);

  -- CSAT score: +10 if > 80%, -10 if < 50%
  IF v_metrics.csat_score IS NOT NULL THEN
    IF v_metrics.csat_score > 80 THEN
      v_impact := v_impact + 10;
    ELSIF v_metrics.csat_score < 50 THEN
      v_impact := v_impact - 10;
    END IF;
  END IF;

  -- SLA breaches: -5 per breach (max -15)
  v_impact := v_impact - LEAST(v_metrics.sla_breaches * 5, 15);

  -- Scale by weight factor
  v_impact := (v_impact * v_weight) / 100;

  RETURN v_impact;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Customer Support Summary
-- Aggregated support view for customer detail
-- ============================================
CREATE OR REPLACE VIEW customer_support_summary AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  COALESCE(m.open_tickets, 0) as open_tickets,
  COALESCE(m.pending_tickets, 0) as pending_tickets,
  COALESCE(m.escalations, 0) as escalations,
  m.avg_resolution_hours,
  m.csat_score,
  COALESCE(m.ticket_volume_7d, 0) as recent_tickets,
  COALESCE(m.sla_breaches, 0) as sla_breaches,
  m.metric_date as last_updated,
  calculate_support_health_impact(c.id) as health_impact
FROM customers c
LEFT JOIN LATERAL (
  SELECT *
  FROM zendesk_metrics zm
  WHERE zm.customer_id = c.id
  ORDER BY metric_date DESC
  LIMIT 1
) m ON true;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE zendesk_tickets IS 'PRD-184: Synced support tickets from Zendesk';
COMMENT ON TABLE zendesk_metrics IS 'PRD-184: Daily aggregated support metrics per customer';
COMMENT ON TABLE zendesk_sync_log IS 'PRD-184: Audit log for Zendesk sync operations';
COMMENT ON TABLE zendesk_alerts IS 'PRD-184: Support alerts for CSM notification';
COMMENT ON FUNCTION calculate_support_health_impact IS 'PRD-184: Calculate health score modifier from support metrics';
COMMENT ON VIEW customer_support_summary IS 'PRD-184: Aggregated support summary for customer views';
