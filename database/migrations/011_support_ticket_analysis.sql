-- Migration: Support Ticket Analysis
-- PRD-156: Support Metrics Dashboard
-- Adds tables for comprehensive support ticket analytics

-- Support ticket CSAT ratings
CREATE TABLE IF NOT EXISTS support_ticket_csat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  feedback TEXT,
  survey_sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLA configurations per customer/tier
CREATE TABLE IF NOT EXISTS support_sla_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  tier VARCHAR(50) DEFAULT 'standard', -- 'standard', 'premium', 'enterprise'
  -- First response targets (in hours)
  p1_first_response_hours INTEGER DEFAULT 1,
  p2_first_response_hours INTEGER DEFAULT 4,
  p3_first_response_hours INTEGER DEFAULT 8,
  p4_first_response_hours INTEGER DEFAULT 24,
  -- Resolution targets (in hours)
  p1_resolution_hours INTEGER DEFAULT 4,
  p2_resolution_hours INTEGER DEFAULT 24,
  p3_resolution_hours INTEGER DEFAULT 48,
  p4_resolution_hours INTEGER DEFAULT 72,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support metrics snapshots (for trend tracking)
CREATE TABLE IF NOT EXISTS support_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  period_type VARCHAR(20) NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'

  -- Ticket counts
  total_tickets INTEGER DEFAULT 0,
  open_tickets INTEGER DEFAULT 0,
  pending_tickets INTEGER DEFAULT 0,
  resolved_tickets INTEGER DEFAULT 0,
  closed_tickets INTEGER DEFAULT 0,

  -- Priority breakdown
  p1_tickets INTEGER DEFAULT 0,
  p2_tickets INTEGER DEFAULT 0,
  p3_tickets INTEGER DEFAULT 0,
  p4_tickets INTEGER DEFAULT 0,

  -- Category breakdown (stored as JSONB)
  category_breakdown JSONB DEFAULT '{}',

  -- SLA metrics
  first_response_met_count INTEGER DEFAULT 0,
  first_response_breached_count INTEGER DEFAULT 0,
  resolution_met_count INTEGER DEFAULT 0,
  resolution_breached_count INTEGER DEFAULT 0,
  avg_first_response_hours DECIMAL(10, 2),
  avg_resolution_hours DECIMAL(10, 2),

  -- Satisfaction metrics
  csat_responses INTEGER DEFAULT 0,
  csat_total_score INTEGER DEFAULT 0,
  avg_csat DECIMAL(3, 2),

  -- Escalations
  escalated_tickets INTEGER DEFAULT 0,
  escalation_rate DECIMAL(5, 2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id, snapshot_date, period_type)
);

-- Portfolio-level support metrics (aggregate across all customers)
CREATE TABLE IF NOT EXISTS portfolio_support_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  csm_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL,
  period_type VARCHAR(20) NOT NULL DEFAULT 'daily',

  -- Portfolio totals
  total_customers INTEGER DEFAULT 0,
  customers_with_tickets INTEGER DEFAULT 0,
  total_tickets INTEGER DEFAULT 0,
  open_tickets INTEGER DEFAULT 0,
  escalated_tickets INTEGER DEFAULT 0,

  -- SLA performance
  sla_first_response_met_pct DECIMAL(5, 2),
  sla_resolution_met_pct DECIMAL(5, 2),

  -- Satisfaction
  portfolio_avg_csat DECIMAL(3, 2),
  low_csat_customers INTEGER DEFAULT 0, -- customers with CSAT < 3.5

  -- Alerts
  customers_needing_attention INTEGER DEFAULT 0, -- spike or low CSAT

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(csm_id, snapshot_date, period_type)
);

-- Support alerts configuration
CREATE TABLE IF NOT EXISTS support_alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  csm_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Alert thresholds
  ticket_spike_multiplier DECIMAL(3, 1) DEFAULT 3.0,
  low_csat_threshold DECIMAL(3, 2) DEFAULT 3.5,
  escalation_alert_enabled BOOLEAN DEFAULT TRUE,
  sla_breach_alert_enabled BOOLEAN DEFAULT TRUE,

  -- Notification preferences
  notify_email BOOLEAN DEFAULT TRUE,
  notify_slack BOOLEAN DEFAULT FALSE,
  notify_in_app BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_ticket_csat_customer ON support_ticket_csat(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_csat_ticket ON support_ticket_csat(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_metrics_snapshots_customer_date ON support_metrics_snapshots(customer_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_support_metrics_snapshots_date ON support_metrics_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_portfolio_support_metrics_csm_date ON portfolio_support_metrics(csm_id, snapshot_date);

-- Insert default SLA config
INSERT INTO support_sla_configs (is_default, tier)
VALUES (TRUE, 'standard')
ON CONFLICT DO NOTHING;

-- Add columns to support_tickets if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'sla_first_response_target_hours') THEN
    ALTER TABLE support_tickets ADD COLUMN sla_first_response_target_hours INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'sla_resolution_target_hours') THEN
    ALTER TABLE support_tickets ADD COLUMN sla_resolution_target_hours INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'sla_first_response_met') THEN
    ALTER TABLE support_tickets ADD COLUMN sla_first_response_met BOOLEAN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'sla_resolution_met') THEN
    ALTER TABLE support_tickets ADD COLUMN sla_resolution_met BOOLEAN;
  END IF;
END $$;

-- Function to calculate support metrics for a customer
CREATE OR REPLACE FUNCTION calculate_customer_support_metrics(
  p_customer_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS TABLE (
  total_tickets INTEGER,
  open_tickets INTEGER,
  resolved_tickets INTEGER,
  escalated_tickets INTEGER,
  avg_first_response_hours DECIMAL,
  avg_resolution_hours DECIMAL,
  sla_first_response_pct DECIMAL,
  sla_resolution_pct DECIMAL,
  avg_csat DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH ticket_stats AS (
    SELECT
      COUNT(*)::INTEGER as total,
      COUNT(*) FILTER (WHERE status IN ('open', 'pending'))::INTEGER as open_count,
      COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::INTEGER as resolved_count,
      COUNT(*) FILTER (WHERE is_escalated = TRUE)::INTEGER as escalated_count,
      AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600) FILTER (WHERE first_response_at IS NOT NULL) as avg_fr_hours,
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE resolved_at IS NOT NULL) as avg_res_hours,
      (COUNT(*) FILTER (WHERE sla_first_response_met = TRUE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE first_response_at IS NOT NULL), 0) * 100) as fr_pct,
      (COUNT(*) FILTER (WHERE sla_resolution_met = TRUE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE resolved_at IS NOT NULL), 0) * 100) as res_pct
    FROM support_tickets
    WHERE customer_id = p_customer_id
      AND created_at >= p_start_date
      AND created_at < p_end_date
  ),
  csat_stats AS (
    SELECT
      AVG(score)::DECIMAL as avg_score
    FROM support_ticket_csat
    WHERE customer_id = p_customer_id
      AND responded_at >= p_start_date
      AND responded_at < p_end_date
  )
  SELECT
    ts.total,
    ts.open_count,
    ts.resolved_count,
    ts.escalated_count,
    ROUND(ts.avg_fr_hours::DECIMAL, 2),
    ROUND(ts.avg_res_hours::DECIMAL, 2),
    ROUND(ts.fr_pct, 1),
    ROUND(ts.res_pct, 1),
    ROUND(cs.avg_score, 2)
  FROM ticket_stats ts, csat_stats cs;
END;
$$ LANGUAGE plpgsql;
