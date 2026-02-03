-- PRD-092: Invoice Overdue - Collections Alert
-- Migration for invoice tracking, overdue detection, and collections workflow

-- ============================================
-- Invoices Table
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,

  -- Invoice details
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'USD',
  description TEXT,
  line_items JSONB DEFAULT '[]', -- [{description, quantity, unit_price, total}]

  -- Dates
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,

  -- Status tracking
  status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'paid', 'partially_paid', 'overdue', 'void', 'disputed'
  days_overdue INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN status = 'paid' OR status = 'void' THEN 0
      WHEN CURRENT_DATE > due_date THEN CURRENT_DATE - due_date
      ELSE 0
    END
  ) STORED,

  -- Payment tracking
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  payment_method VARCHAR(50), -- 'ach', 'wire', 'credit_card', 'check'
  payment_reference VARCHAR(200),

  -- External integration
  stripe_invoice_id VARCHAR(100),
  external_invoice_id VARCHAR(200),
  source VARCHAR(50) DEFAULT 'manual', -- 'stripe', 'salesforce', 'manual', 'csv_import'

  -- Metadata
  metadata JSONB DEFAULT '{}',
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_days_overdue ON invoices(days_overdue);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id);

-- ============================================
-- Invoice Overdue Alerts Table
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_overdue_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- Alert classification
  alert_type VARCHAR(50) NOT NULL, -- 'overdue_7d', 'overdue_14d', 'overdue_30d', 'overdue_60d'
  severity VARCHAR(20) NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  days_overdue INTEGER NOT NULL,

  -- Financial context
  invoice_amount DECIMAL(15, 2) NOT NULL,
  total_outstanding DECIMAL(15, 2) NOT NULL, -- Sum of all unpaid invoices
  total_overdue_invoices INTEGER DEFAULT 1,

  -- Payment history context
  payment_history JSONB DEFAULT '{}', -- {"on_time": 4, "late": 1, "avg_days_to_pay": 12}
  is_first_time_overdue BOOLEAN DEFAULT TRUE,

  -- Customer health context
  health_score INTEGER,
  last_meeting_date DATE,
  open_support_tickets INTEGER DEFAULT 0,
  recent_nps INTEGER,

  -- Correlation with issues
  related_tickets JSONB DEFAULT '[]', -- [{id, subject, status, created_at}]
  potential_dispute BOOLEAN DEFAULT FALSE,
  dispute_reason TEXT,

  -- Recommended action
  recommended_action TEXT,
  action_urgency VARCHAR(20) DEFAULT 'standard', -- 'immediate', 'urgent', 'standard'
  suggested_outreach_template TEXT,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'acknowledged', 'in_progress', 'resolved', 'escalated'
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  resolution_type VARCHAR(30), -- 'paid', 'payment_plan', 'disputed', 'write_off', 'admin_issue'

  -- Notifications
  csm_notified BOOLEAN DEFAULT FALSE,
  csm_notified_at TIMESTAMPTZ,
  finance_notified BOOLEAN DEFAULT FALSE,
  finance_notified_at TIMESTAMPTZ,
  manager_notified BOOLEAN DEFAULT FALSE,
  manager_notified_at TIMESTAMPTZ,
  slack_message_ts VARCHAR(100),
  email_sent BOOLEAN DEFAULT FALSE,

  -- Task tracking
  task_created BOOLEAN DEFAULT FALSE,
  task_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_alerts_customer ON invoice_overdue_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_alerts_invoice ON invoice_overdue_alerts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_alerts_status ON invoice_overdue_alerts(status);
CREATE INDEX IF NOT EXISTS idx_invoice_alerts_severity ON invoice_overdue_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_invoice_alerts_created ON invoice_overdue_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_alerts_type ON invoice_overdue_alerts(alert_type);

-- Prevent duplicate alerts for same invoice at same milestone
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_alerts_unique_milestone
  ON invoice_overdue_alerts(invoice_id, alert_type)
  WHERE status != 'resolved';

-- ============================================
-- Payment Records Table
-- ============================================

CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Payment details
  amount DECIMAL(15, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50),
  reference VARCHAR(200),

  -- Timing
  days_from_due INTEGER, -- Negative = early, 0 = on time, positive = late
  was_on_time BOOLEAN GENERATED ALWAYS AS (days_from_due <= 0) STORED,

  -- External integration
  stripe_payment_id VARCHAR(100),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payment_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payment_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payment_records(payment_date DESC);

-- ============================================
-- Collections Actions Log
-- ============================================

CREATE TABLE IF NOT EXISTS collections_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES invoice_overdue_alerts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- Action details
  action_type VARCHAR(50) NOT NULL, -- 'email_sent', 'call_made', 'meeting_scheduled', 'payment_plan', 'escalated', 'dispute_filed'
  action_by VARCHAR(50) NOT NULL, -- 'csm', 'finance', 'system', 'manager'
  performed_by UUID, -- User ID

  -- Details
  description TEXT NOT NULL,
  outcome VARCHAR(50), -- 'success', 'no_response', 'promise_to_pay', 'dispute', 'escalate'
  next_step TEXT,
  next_action_date DATE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_actions_alert ON collections_actions(alert_id);
CREATE INDEX IF NOT EXISTS idx_collections_actions_customer ON collections_actions(customer_id);
CREATE INDEX IF NOT EXISTS idx_collections_actions_created ON collections_actions(created_at DESC);

-- ============================================
-- Overdue Alert Statistics (Daily Roll-up)
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_overdue_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_date DATE NOT NULL,

  -- Invoice counts
  total_overdue_invoices INTEGER DEFAULT 0,
  new_overdue_today INTEGER DEFAULT 0,
  resolved_today INTEGER DEFAULT 0,

  -- By aging bucket
  overdue_7d_count INTEGER DEFAULT 0,
  overdue_14d_count INTEGER DEFAULT 0,
  overdue_30d_count INTEGER DEFAULT 0,
  overdue_60d_plus_count INTEGER DEFAULT 0,

  -- Financial impact
  total_overdue_amount DECIMAL(15, 2) DEFAULT 0,
  amount_by_bucket JSONB DEFAULT '{}', -- {"7d": 50000, "14d": 25000, "30d": 10000, "60d": 5000}

  -- Resolution metrics
  avg_days_to_resolution DECIMAL(10, 2),
  resolution_by_type JSONB DEFAULT '{}', -- {"paid": 10, "payment_plan": 2, "write_off": 1}

  -- CSM metrics
  alerts_per_csm JSONB DEFAULT '{}', -- {"csm_id_1": 5, "csm_id_2": 3}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_date)
);

CREATE INDEX IF NOT EXISTS idx_overdue_stats_date ON invoice_overdue_stats(period_date DESC);

-- ============================================
-- Add billing fields to customers table
-- ============================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_outstanding DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS oldest_overdue_days INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS overdue_invoice_count INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_behavior VARCHAR(30) DEFAULT 'unknown'; -- 'excellent', 'good', 'fair', 'poor', 'unknown'
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avg_days_to_pay DECIMAL(10, 2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_payment_date DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_contact_email VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_contact_name VARCHAR(200);

-- ============================================
-- Functions
-- ============================================

-- Function to calculate severity based on days overdue
CREATE OR REPLACE FUNCTION get_overdue_severity(days INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF days >= 60 THEN
    RETURN 'critical';
  ELSIF days >= 30 THEN
    RETURN 'high';
  ELSIF days >= 14 THEN
    RETURN 'medium';
  ELSE
    RETURN 'low';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get alert type based on days overdue
CREATE OR REPLACE FUNCTION get_overdue_alert_type(days INTEGER)
RETURNS VARCHAR(50) AS $$
BEGIN
  IF days >= 60 THEN
    RETURN 'overdue_60d';
  ELSIF days >= 30 THEN
    RETURN 'overdue_30d';
  ELSIF days >= 14 THEN
    RETURN 'overdue_14d';
  ELSIF days >= 7 THEN
    RETURN 'overdue_7d';
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate recommended action based on context
CREATE OR REPLACE FUNCTION get_recommended_overdue_action(
  p_days_overdue INTEGER,
  p_is_first_time BOOLEAN,
  p_open_tickets INTEGER,
  p_health_score INTEGER
)
RETURNS TEXT AS $$
BEGIN
  -- If open support tickets, might be related issue
  IF p_open_tickets > 0 THEN
    RETURN 'Check open support tickets first - payment delay may be related to service issues.';
  END IF;

  -- First-time overdue with good health
  IF p_is_first_time AND p_health_score >= 70 THEN
    RETURN 'This is their first overdue invoice and health is good. Send a friendly reminder - likely administrative delay.';
  END IF;

  -- First-time but poor health
  IF p_is_first_time AND p_health_score < 50 THEN
    RETURN 'First overdue but health score is concerning. Schedule a check-in call to understand if there are underlying issues.';
  END IF;

  -- Repeat offender
  IF NOT p_is_first_time THEN
    IF p_days_overdue >= 30 THEN
      RETURN 'Repeat payment issue - escalate to finance and consider payment plan discussion.';
    ELSE
      RETURN 'Not their first late payment. Direct outreach recommended to understand payment timeline.';
    END IF;
  END IF;

  -- Default based on severity
  IF p_days_overdue >= 60 THEN
    RETURN 'Critical: Immediate outreach required. Coordinate with finance on collections process.';
  ELSIF p_days_overdue >= 30 THEN
    RETURN 'Escalate to manager. Direct call to billing contact recommended.';
  ELSE
    RETURN 'Send soft check-in email to understand payment timeline.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers
-- ============================================

-- Update customer billing stats when invoice changes
CREATE OR REPLACE FUNCTION update_customer_billing_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);

  UPDATE customers SET
    total_outstanding = (
      SELECT COALESCE(SUM(amount - amount_paid), 0)
      FROM invoices
      WHERE customer_id = v_customer_id
      AND status NOT IN ('paid', 'void')
    ),
    oldest_overdue_days = (
      SELECT COALESCE(MAX(days_overdue), 0)
      FROM invoices
      WHERE customer_id = v_customer_id
      AND status = 'overdue'
    ),
    overdue_invoice_count = (
      SELECT COUNT(*)
      FROM invoices
      WHERE customer_id = v_customer_id
      AND status = 'overdue'
    ),
    last_payment_date = (
      SELECT MAX(payment_date)
      FROM payment_records
      WHERE customer_id = v_customer_id
    ),
    updated_at = NOW()
  WHERE id = v_customer_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_billing_on_invoice ON invoices;
CREATE TRIGGER update_customer_billing_on_invoice
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_customer_billing_stats();

-- Auto-update invoice status to overdue
CREATE OR REPLACE FUNCTION auto_update_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_update_invoice_status ON invoices;
CREATE TRIGGER auto_update_invoice_status
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION auto_update_invoice_status();

-- Update timestamp trigger for alerts
CREATE OR REPLACE FUNCTION update_invoice_alert_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoice_alert_timestamp ON invoice_overdue_alerts;
CREATE TRIGGER update_invoice_alert_timestamp
  BEFORE UPDATE ON invoice_overdue_alerts
  FOR EACH ROW EXECUTE FUNCTION update_invoice_alert_timestamp();

-- ============================================
-- Grant Permissions
-- ============================================

GRANT ALL ON invoices TO authenticated;
GRANT ALL ON invoice_overdue_alerts TO authenticated;
GRANT ALL ON payment_records TO authenticated;
GRANT ALL ON collections_actions TO authenticated;
GRANT ALL ON invoice_overdue_stats TO authenticated;
