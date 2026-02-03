-- ============================================
-- PRD-087: Support Ticket Spike Escalation
-- Migration for support tickets and risk signals
-- ============================================

-- ============================================
-- SUPPORT TICKETS
-- Stores incoming tickets from external support systems
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT NOT NULL,  -- ID from external system (Zendesk, Intercom, etc.)
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',  -- technical, billing, training, feature_request, general
  severity TEXT DEFAULT 'P3',  -- P1, P2, P3, P4
  status TEXT DEFAULT 'open',  -- open, pending, resolved, closed
  assignee TEXT,
  reporter_email TEXT,
  reporter_name TEXT,
  escalation_level INTEGER DEFAULT 0,
  escalation_count INTEGER DEFAULT 0,
  is_escalated BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'webhook',  -- webhook, manual, sync
  external_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_customer ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_external_id ON support_tickets(external_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_severity ON support_tickets(severity);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_external_unique ON support_tickets(external_id, customer_id);

-- ============================================
-- RISK SIGNALS
-- Generic table for various risk/alert signals
-- ============================================
CREATE TABLE IF NOT EXISTS risk_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,  -- ticket_spike, health_drop, usage_decline, etc.
  severity TEXT NOT NULL,  -- low, medium, high, critical
  title TEXT NOT NULL,
  description TEXT,
  score_impact INTEGER DEFAULT 0,  -- Health score impact (negative = decrease)
  metadata JSONB NOT NULL DEFAULT '{}',  -- Type-specific data
  status TEXT DEFAULT 'active',  -- active, acknowledged, resolved, dismissed
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  auto_resolved BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'system',  -- system, manual, trigger
  trigger_id UUID,  -- Reference to trigger that created this
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_customer ON risk_signals(customer_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON risk_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_signals_severity ON risk_signals(severity);
CREATE INDEX IF NOT EXISTS idx_signals_status ON risk_signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_created ON risk_signals(created_at);

-- ============================================
-- TICKET BASELINES
-- Stores calculated baseline metrics per customer
-- ============================================
CREATE TABLE IF NOT EXISTS ticket_baselines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  baseline_daily_avg NUMERIC(10,2) DEFAULT 0,
  baseline_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  baseline_days INTEGER DEFAULT 30,  -- Number of days used for calculation
  total_tickets_in_period INTEGER DEFAULT 0,
  category_breakdown JSONB DEFAULT '{}',  -- { "technical": 5, "billing": 2 }
  severity_breakdown JSONB DEFAULT '{}',  -- { "P1": 1, "P2": 3 }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_baselines_customer ON ticket_baselines(customer_id);

-- ============================================
-- ESCALATION WORKFLOWS
-- Tracks escalation workflow executions
-- ============================================
CREATE TABLE IF NOT EXISTS escalation_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  risk_signal_id UUID REFERENCES risk_signals(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL,  -- support_spike_escalation
  status TEXT DEFAULT 'pending',  -- pending, in_progress, completed, failed
  steps_completed JSONB DEFAULT '[]',
  current_step TEXT,
  csm_notified BOOLEAN DEFAULT FALSE,
  csm_notified_at TIMESTAMPTZ,
  manager_notified BOOLEAN DEFAULT FALSE,
  manager_notified_at TIMESTAMPTZ,
  task_created_id UUID,
  email_draft_id TEXT,
  slack_thread_ts TEXT,
  health_score_adjusted BOOLEAN DEFAULT FALSE,
  health_score_previous INTEGER,
  health_score_new INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflows_signal ON escalation_workflows(risk_signal_id);
CREATE INDEX IF NOT EXISTS idx_workflows_customer ON escalation_workflows(customer_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON escalation_workflows(status);

-- ============================================
-- EMAIL DRAFTS TABLE
-- Stores generated email drafts for approval
-- ============================================
CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  risk_signal_id UUID REFERENCES risk_signals(id),
  draft_type TEXT NOT NULL,  -- spike_acknowledgment, follow_up, etc.
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT NOT NULL,
  template_used TEXT,
  variables JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft',  -- draft, approved, sent, rejected
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  gmail_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_customer ON email_drafts(customer_id);
CREATE INDEX IF NOT EXISTS idx_drafts_signal ON email_drafts(risk_signal_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON email_drafts(status);

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER update_tickets_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_signals_timestamp
  BEFORE UPDATE ON risk_signals
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_baselines_timestamp
  BEFORE UPDATE ON ticket_baselines
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_workflows_timestamp
  BEFORE UPDATE ON escalation_workflows
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_drafts_timestamp
  BEFORE UPDATE ON email_drafts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate ticket baseline for a customer
CREATE OR REPLACE FUNCTION calculate_ticket_baseline(p_customer_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  daily_avg NUMERIC,
  total_tickets INTEGER,
  category_breakdown JSONB,
  severity_breakdown JSONB
) AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
BEGIN
  v_cutoff := NOW() - (p_days || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    COALESCE(COUNT(*)::NUMERIC / NULLIF(p_days, 0), 0) AS daily_avg,
    COUNT(*)::INTEGER AS total_tickets,
    COALESCE(
      jsonb_object_agg(category, cat_count) FILTER (WHERE category IS NOT NULL),
      '{}'::jsonb
    ) AS category_breakdown,
    COALESCE(
      jsonb_object_agg(severity, sev_count) FILTER (WHERE severity IS NOT NULL),
      '{}'::jsonb
    ) AS severity_breakdown
  FROM (
    SELECT
      t.category,
      COUNT(*) AS cat_count,
      t.severity,
      COUNT(*) OVER (PARTITION BY t.severity) AS sev_count
    FROM support_tickets t
    WHERE t.customer_id = p_customer_id
      AND t.created_at >= v_cutoff
    GROUP BY t.category, t.severity
  ) subq;
END;
$$ LANGUAGE plpgsql;

-- Function to check for ticket spike
CREATE OR REPLACE FUNCTION check_ticket_spike(
  p_customer_id UUID,
  p_lookback_hours INTEGER DEFAULT 24,
  p_threshold NUMERIC DEFAULT 3.0
)
RETURNS TABLE (
  is_spike BOOLEAN,
  ticket_count INTEGER,
  baseline_avg NUMERIC,
  spike_multiplier NUMERIC,
  severity TEXT
) AS $$
DECLARE
  v_recent_count INTEGER;
  v_baseline NUMERIC;
  v_normalized_current NUMERIC;
  v_multiplier NUMERIC;
BEGIN
  -- Get recent ticket count
  SELECT COUNT(*)::INTEGER INTO v_recent_count
  FROM support_tickets
  WHERE customer_id = p_customer_id
    AND created_at >= NOW() - (p_lookback_hours || ' hours')::INTERVAL;

  -- Get baseline from stored value or calculate
  SELECT tb.baseline_daily_avg INTO v_baseline
  FROM ticket_baselines tb
  WHERE tb.customer_id = p_customer_id;

  -- Use industry default if no baseline exists
  IF v_baseline IS NULL OR v_baseline = 0 THEN
    v_baseline := 2.0;  -- Default baseline
  END IF;

  -- Normalize current count to daily rate
  v_normalized_current := v_recent_count::NUMERIC / (p_lookback_hours::NUMERIC / 24);

  -- Calculate multiplier
  v_multiplier := CASE
    WHEN v_baseline > 0 THEN v_normalized_current / v_baseline
    ELSE v_normalized_current
  END;

  RETURN QUERY
  SELECT
    v_multiplier >= p_threshold AS is_spike,
    v_recent_count AS ticket_count,
    v_baseline AS baseline_avg,
    ROUND(v_multiplier, 2) AS spike_multiplier,
    CASE
      WHEN v_multiplier >= 5 THEN 'critical'
      WHEN v_multiplier >= 3 THEN 'high'
      WHEN v_multiplier >= 2 THEN 'medium'
      ELSE 'low'
    END AS severity;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE TRIGGER CONFIGURATION
-- ============================================
INSERT INTO triggers (
  name,
  description,
  type,
  condition,
  actions,
  cooldown_minutes,
  max_fires_per_day,
  enabled,
  metadata
) VALUES (
  'Support Spike Alert',
  'Triggers when a customer experiences an unusual spike in support tickets (3x+ normal rate)',
  'ticket_spike',
  '{
    "type": "ticket_spike",
    "params": {
      "spikeThreshold": 3.0,
      "lookbackHours": 24,
      "baselineDays": 30,
      "minTickets": 3
    }
  }'::jsonb,
  '[
    {
      "id": "notify_csm",
      "type": "send_slack",
      "tool": "slack_dm",
      "params": {
        "template": "support_spike_alert",
        "urgency": "high"
      }
    },
    {
      "id": "create_task",
      "type": "create_task",
      "params": {
        "title": "URGENT: Support spike for {{customerName}} - {{ticketCount}} tickets",
        "priority": "critical",
        "dueHours": 4
      }
    },
    {
      "id": "update_health",
      "type": "update_health_score",
      "params": {
        "adjustment": -15,
        "reason": "Support ticket spike detected"
      }
    }
  ]'::jsonb,
  240,  -- 4 hour cooldown
  3,    -- Max 3 times per day
  true,
  '{
    "category": "D - Alerts & Triggers",
    "prd": "PRD-087",
    "version": "1.0"
  }'::jsonb
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE support_tickets IS 'PRD-087: Stores support tickets from external systems for spike detection';
COMMENT ON TABLE risk_signals IS 'PRD-087: Generic risk signals including ticket_spike type';
COMMENT ON TABLE ticket_baselines IS 'PRD-087: Calculated baseline metrics for ticket spike detection';
COMMENT ON TABLE escalation_workflows IS 'PRD-087: Tracks escalation workflow execution status';
COMMENT ON TABLE email_drafts IS 'PRD-087: Email drafts generated for spike acknowledgment';
