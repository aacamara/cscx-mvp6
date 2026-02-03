-- ============================================
-- PRD-205: DocuSign Contract Management Integration
-- Database schema for DocuSign envelope tracking
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DocuSign Envelopes Table
-- Stores synced envelope data from DocuSign
-- ============================================

CREATE TABLE IF NOT EXISTS public.docusign_envelopes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  envelope_id TEXT UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'created', 'sent', 'delivered', 'signed', 'completed', 'declined', 'voided'
  )),
  subject TEXT NOT NULL,
  documents JSONB DEFAULT '[]',
  recipients JSONB DEFAULT '[]',
  custom_fields JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_docusign_envelopes_customer_id ON public.docusign_envelopes(customer_id);
CREATE INDEX IF NOT EXISTS idx_docusign_envelopes_envelope_id ON public.docusign_envelopes(envelope_id);
CREATE INDEX IF NOT EXISTS idx_docusign_envelopes_status ON public.docusign_envelopes(status);
CREATE INDEX IF NOT EXISTS idx_docusign_envelopes_sent_at ON public.docusign_envelopes(sent_at);
CREATE INDEX IF NOT EXISTS idx_docusign_envelopes_completed_at ON public.docusign_envelopes(completed_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_docusign_envelopes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_docusign_envelopes_updated_at ON public.docusign_envelopes;
CREATE TRIGGER trigger_docusign_envelopes_updated_at
  BEFORE UPDATE ON public.docusign_envelopes
  FOR EACH ROW
  EXECUTE FUNCTION update_docusign_envelopes_updated_at();

-- ============================================
-- DocuSign Events Table
-- Tracks webhook events and status changes
-- ============================================

CREATE TABLE IF NOT EXISTS public.docusign_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  envelope_id TEXT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  recipient_email TEXT,
  metadata JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_docusign_events_envelope_id ON public.docusign_events(envelope_id);
CREATE INDEX IF NOT EXISTS idx_docusign_events_event_type ON public.docusign_events(event_type);
CREATE INDEX IF NOT EXISTS idx_docusign_events_occurred_at ON public.docusign_events(occurred_at);

-- ============================================
-- DocuSign Sync Log Table
-- Tracks sync operations for audit and debugging
-- ============================================

CREATE TABLE IF NOT EXISTS public.docusign_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  integration_id UUID,
  object_type VARCHAR(50) NOT NULL DEFAULT 'envelopes',
  sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'webhook')),
  status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for sync log
CREATE INDEX IF NOT EXISTS idx_docusign_sync_log_user_id ON public.docusign_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_docusign_sync_log_started_at ON public.docusign_sync_log(started_at);
CREATE INDEX IF NOT EXISTS idx_docusign_sync_log_status ON public.docusign_sync_log(status);

-- ============================================
-- DocuSign Customer Mapping Table
-- Manual mappings for customers without auto-match
-- ============================================

CREATE TABLE IF NOT EXISTS public.docusign_customer_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email_domain TEXT,
  docusign_custom_field TEXT,
  docusign_custom_field_value TEXT,
  match_priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, email_domain)
);

-- Index for mapping lookups
CREATE INDEX IF NOT EXISTS idx_docusign_customer_mappings_customer_id ON public.docusign_customer_mappings(customer_id);
CREATE INDEX IF NOT EXISTS idx_docusign_customer_mappings_email_domain ON public.docusign_customer_mappings(email_domain);

-- ============================================
-- DocuSign Alerts Table
-- CSM notifications for contract events
-- ============================================

CREATE TABLE IF NOT EXISTS public.docusign_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  envelope_id TEXT NOT NULL,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
    'contract_completed', 'contract_stalled', 'contract_voided', 'contract_declined', 'signature_required'
  )),
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  csm_id UUID,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_docusign_alerts_customer_id ON public.docusign_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_docusign_alerts_csm_id ON public.docusign_alerts(csm_id);
CREATE INDEX IF NOT EXISTS idx_docusign_alerts_is_read ON public.docusign_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_docusign_alerts_alert_type ON public.docusign_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_docusign_alerts_triggered_at ON public.docusign_alerts(triggered_at);

-- ============================================
-- Views for Common Queries
-- ============================================

-- View: Active envelopes requiring attention
CREATE OR REPLACE VIEW public.docusign_pending_envelopes AS
SELECT
  de.id,
  de.envelope_id,
  de.subject,
  de.status,
  de.sent_at,
  de.customer_id,
  c.name AS customer_name,
  c.csm_id,
  EXTRACT(DAYS FROM NOW() - de.sent_at) AS days_pending,
  de.recipients,
  de.documents
FROM public.docusign_envelopes de
LEFT JOIN public.customers c ON de.customer_id = c.id
WHERE de.status IN ('sent', 'delivered')
  AND de.sent_at IS NOT NULL
ORDER BY de.sent_at ASC;

-- View: Contract completion metrics
CREATE OR REPLACE VIEW public.docusign_completion_metrics AS
SELECT
  de.customer_id,
  c.name AS customer_name,
  COUNT(*) AS total_envelopes,
  COUNT(*) FILTER (WHERE de.status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE de.status IN ('sent', 'delivered')) AS pending_count,
  COUNT(*) FILTER (WHERE de.status = 'voided') AS voided_count,
  COUNT(*) FILTER (WHERE de.status = 'declined') AS declined_count,
  AVG(EXTRACT(DAYS FROM de.completed_at - de.sent_at)) FILTER (WHERE de.status = 'completed') AS avg_completion_days,
  MAX(de.completed_at) AS last_completed_at
FROM public.docusign_envelopes de
LEFT JOIN public.customers c ON de.customer_id = c.id
WHERE de.customer_id IS NOT NULL
GROUP BY de.customer_id, c.name;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.docusign_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docusign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docusign_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docusign_customer_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docusign_alerts ENABLE ROW LEVEL SECURITY;

-- Service role policies (for server-side operations)
CREATE POLICY "Service role full access to docusign_envelopes"
  ON public.docusign_envelopes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to docusign_events"
  ON public.docusign_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to docusign_sync_log"
  ON public.docusign_sync_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to docusign_customer_mappings"
  ON public.docusign_customer_mappings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to docusign_alerts"
  ON public.docusign_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- User policies (CSMs can see their customers' envelopes)
CREATE POLICY "CSMs can view their customers' envelopes"
  ON public.docusign_envelopes
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE csm_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "CSMs can view their alerts"
  ON public.docusign_alerts
  FOR SELECT
  TO authenticated
  USING (
    csm_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "CSMs can update their alerts"
  ON public.docusign_alerts
  FOR UPDATE
  TO authenticated
  USING (csm_id = auth.uid())
  WITH CHECK (csm_id = auth.uid());

-- ============================================
-- Sample Data (for development)
-- ============================================

-- Insert sample data only if no data exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.docusign_envelopes LIMIT 1) THEN
    -- Sample data can be inserted here for development
    NULL; -- Placeholder
  END IF;
END
$$;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE public.docusign_envelopes IS 'Synced envelope data from DocuSign for contract tracking';
COMMENT ON TABLE public.docusign_events IS 'Webhook events and status change history for envelopes';
COMMENT ON TABLE public.docusign_sync_log IS 'Sync operation audit log for debugging and monitoring';
COMMENT ON TABLE public.docusign_customer_mappings IS 'Manual customer-to-envelope mappings when auto-match fails';
COMMENT ON TABLE public.docusign_alerts IS 'CSM notifications for contract events requiring attention';
COMMENT ON VIEW public.docusign_pending_envelopes IS 'Envelopes awaiting signature, ordered by age';
COMMENT ON VIEW public.docusign_completion_metrics IS 'Contract completion metrics by customer';
