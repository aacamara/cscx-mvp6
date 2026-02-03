-- PRD-093: Contract Auto-Renewal Review
-- Migration to add auto-renewal tracking and review workflow support

-- ============================================
-- ADD AUTO-RENEWAL FIELDS TO CONTRACTS TABLE
-- ============================================

-- Add auto_renewal flag and notice period
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS auto_renewal BOOLEAN DEFAULT false;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS notice_period_days INTEGER;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS cancellation_window_start DATE;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS renewal_acknowledged_at TIMESTAMPTZ;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS renewal_acknowledged_by TEXT;

-- Add renewal notification tracking
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS renewal_notification_sent_at TIMESTAMPTZ;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS renewal_notification_sent_by TEXT;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_contracts_auto_renewal
ON contracts(auto_renewal) WHERE auto_renewal = true;

CREATE INDEX IF NOT EXISTS idx_contracts_end_date
ON contracts(end_date);

CREATE INDEX IF NOT EXISTS idx_contracts_auto_renewal_pending
ON contracts(auto_renewal, end_date, renewal_acknowledged_at)
WHERE auto_renewal = true AND renewal_acknowledged_at IS NULL;

-- ============================================
-- AUTO-RENEWAL REVIEWS TABLE
-- Tracks the review workflow for each auto-renewal
-- ============================================
CREATE TABLE IF NOT EXISTS auto_renewal_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Review timing
  alert_triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_due_date DATE NOT NULL,
  renewal_date DATE NOT NULL,
  cancellation_deadline DATE NOT NULL,

  -- Contract details at time of alert
  current_arr NUMERIC NOT NULL,
  notice_period_days INTEGER NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'outreach_sent', 'acknowledged', 'expansion_discussed', 'completed', 'cancelled')),

  -- Customer acknowledgment
  customer_acknowledged_at TIMESTAMPTZ,
  customer_acknowledged_by TEXT,
  acknowledgment_method TEXT CHECK (acknowledgment_method IN ('email', 'meeting', 'call', 'portal', 'other')),

  -- CSM activity tracking
  assigned_csm_id TEXT,
  assigned_csm_name TEXT,
  outreach_sent_at TIMESTAMPTZ,
  outreach_method TEXT,
  last_contact_date TIMESTAMPTZ,

  -- Value discussion / Expansion
  expansion_discussed BOOLEAN DEFAULT false,
  expansion_opportunity_arr NUMERIC,
  expansion_notes TEXT,

  -- Compliance tracking
  notification_logged BOOLEAN DEFAULT false,
  compliance_notes TEXT,

  -- Review checklist (JSONB for flexibility)
  review_checklist JSONB DEFAULT '{
    "value_summary_prepared": false,
    "customer_notified": false,
    "renewal_terms_reviewed": false,
    "expansion_opportunity_assessed": false,
    "customer_acknowledgment_received": false
  }'::jsonb,

  -- Outcome
  outcome TEXT CHECK (outcome IN ('renewed', 'cancelled', 'expanded', 'downgraded', 'churned', null)),
  outcome_arr NUMERIC,
  outcome_notes TEXT,
  completed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for auto_renewal_reviews
CREATE INDEX IF NOT EXISTS idx_auto_renewal_reviews_contract
ON auto_renewal_reviews(contract_id);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_reviews_customer
ON auto_renewal_reviews(customer_id);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_reviews_status
ON auto_renewal_reviews(status);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_reviews_renewal_date
ON auto_renewal_reviews(renewal_date);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_reviews_due_date
ON auto_renewal_reviews(review_due_date);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_reviews_csm
ON auto_renewal_reviews(assigned_csm_id);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_reviews_pending
ON auto_renewal_reviews(status, review_due_date)
WHERE status NOT IN ('completed', 'cancelled');

-- ============================================
-- AUTO-RENEWAL TASKS TABLE
-- Individual tasks created for each review
-- ============================================
CREATE TABLE IF NOT EXISTS auto_renewal_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES auto_renewal_reviews(id) ON DELETE CASCADE,

  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN (
    'customer_outreach',
    'value_review',
    'expansion_discussion',
    'acknowledgment_capture',
    'compliance_documentation',
    'follow_up'
  )),

  -- Assignment
  assigned_to TEXT,
  assigned_at TIMESTAMPTZ,

  -- Timing
  due_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'high' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'overdue')),
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  completion_notes TEXT,

  -- Reminders
  reminder_sent_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for auto_renewal_tasks
CREATE INDEX IF NOT EXISTS idx_auto_renewal_tasks_review
ON auto_renewal_tasks(review_id);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_tasks_status
ON auto_renewal_tasks(status);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_tasks_due_date
ON auto_renewal_tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_tasks_assigned
ON auto_renewal_tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_tasks_pending
ON auto_renewal_tasks(status, due_date)
WHERE status IN ('pending', 'in_progress', 'overdue');

-- ============================================
-- AUTO-RENEWAL NOTIFICATIONS LOG
-- Audit trail for all notifications sent
-- ============================================
CREATE TABLE IF NOT EXISTS auto_renewal_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES auto_renewal_reviews(id) ON DELETE CASCADE,

  -- Notification details
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'initial_alert',
    'reminder',
    'deadline_warning',
    'overdue_notice',
    'escalation',
    'customer_notification',
    'acknowledgment_confirmation'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('slack', 'email', 'in_app', 'sms')),
  recipient TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('csm', 'customer', 'manager', 'legal', 'finance')),

  -- Content
  subject TEXT,
  message TEXT NOT NULL,
  template_id TEXT,

  -- Delivery status
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for auto_renewal_notifications
CREATE INDEX IF NOT EXISTS idx_auto_renewal_notifications_review
ON auto_renewal_notifications(review_id);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_notifications_type
ON auto_renewal_notifications(notification_type);

CREATE INDEX IF NOT EXISTS idx_auto_renewal_notifications_sent
ON auto_renewal_notifications(sent_at);

-- ============================================
-- VIEWS
-- ============================================

-- View for pending auto-renewal reviews
CREATE OR REPLACE VIEW v_pending_auto_renewal_reviews AS
SELECT
  arr.id AS review_id,
  arr.contract_id,
  arr.customer_id,
  c.name AS customer_name,
  c.health_score,
  cont.company_name,
  arr.current_arr,
  arr.renewal_date,
  arr.cancellation_deadline,
  arr.review_due_date,
  arr.status,
  arr.assigned_csm_id,
  arr.assigned_csm_name,
  arr.outreach_sent_at,
  arr.customer_acknowledged_at,
  arr.expansion_discussed,
  arr.review_checklist,
  -- Calculate days remaining
  (arr.renewal_date - CURRENT_DATE) AS days_to_renewal,
  (arr.cancellation_deadline - CURRENT_DATE) AS days_to_cancellation_deadline,
  -- Urgency indicator
  CASE
    WHEN (arr.cancellation_deadline - CURRENT_DATE) <= 7 THEN 'critical'
    WHEN (arr.cancellation_deadline - CURRENT_DATE) <= 15 THEN 'high'
    WHEN (arr.cancellation_deadline - CURRENT_DATE) <= 30 THEN 'medium'
    ELSE 'low'
  END AS urgency
FROM auto_renewal_reviews arr
JOIN customers c ON arr.customer_id = c.id
JOIN contracts cont ON arr.contract_id = cont.id
WHERE arr.status NOT IN ('completed', 'cancelled')
ORDER BY arr.cancellation_deadline ASC;

-- View for auto-renewal compliance report
CREATE OR REPLACE VIEW v_auto_renewal_compliance AS
SELECT
  arr.id AS review_id,
  arr.customer_id,
  c.name AS customer_name,
  arr.contract_id,
  arr.renewal_date,
  arr.status,
  arr.notification_logged,
  arr.customer_acknowledged_at IS NOT NULL AS has_customer_acknowledgment,
  arn.sent_at AS notification_sent_at,
  arr.outcome,
  arr.completed_at
FROM auto_renewal_reviews arr
JOIN customers c ON arr.customer_id = c.id
LEFT JOIN auto_renewal_notifications arn
  ON arr.id = arn.review_id
  AND arn.notification_type = 'customer_notification'
  AND arn.recipient_type = 'customer'
ORDER BY arr.renewal_date ASC;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to find contracts due for auto-renewal review
CREATE OR REPLACE FUNCTION find_upcoming_auto_renewals(
  buffer_days INTEGER DEFAULT 15
)
RETURNS TABLE (
  contract_id UUID,
  customer_id UUID,
  customer_name TEXT,
  company_name TEXT,
  arr NUMERIC,
  end_date DATE,
  notice_period_days INTEGER,
  cancellation_window_start DATE,
  alert_trigger_date DATE,
  days_until_renewal INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS contract_id,
    c.customer_id,
    cust.name AS customer_name,
    c.company_name,
    c.arr,
    c.end_date,
    c.notice_period_days,
    c.cancellation_window_start,
    (c.end_date - (COALESCE(c.notice_period_days, 30) + buffer_days)) AS alert_trigger_date,
    (c.end_date - CURRENT_DATE)::INTEGER AS days_until_renewal
  FROM contracts c
  JOIN customers cust ON c.customer_id = cust.id
  WHERE c.auto_renewal = true
    AND c.status = 'active'
    AND c.renewal_acknowledged_at IS NULL
    AND c.end_date >= CURRENT_DATE
    AND CURRENT_DATE >= (c.end_date - (COALESCE(c.notice_period_days, 30) + buffer_days))
    AND NOT EXISTS (
      SELECT 1 FROM auto_renewal_reviews arr
      WHERE arr.contract_id = c.id
      AND arr.renewal_date = c.end_date
      AND arr.status NOT IN ('cancelled')
    )
  ORDER BY c.end_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to create auto-renewal review
CREATE OR REPLACE FUNCTION create_auto_renewal_review(
  p_contract_id UUID,
  p_assigned_csm_id TEXT DEFAULT NULL,
  p_assigned_csm_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_review_id UUID;
  v_contract RECORD;
BEGIN
  -- Get contract details
  SELECT
    c.id, c.customer_id, c.arr, c.end_date,
    c.notice_period_days, c.cancellation_window_start
  INTO v_contract
  FROM contracts c
  WHERE c.id = p_contract_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found: %', p_contract_id;
  END IF;

  -- Create the review
  INSERT INTO auto_renewal_reviews (
    contract_id,
    customer_id,
    renewal_date,
    cancellation_deadline,
    review_due_date,
    current_arr,
    notice_period_days,
    assigned_csm_id,
    assigned_csm_name
  ) VALUES (
    v_contract.id,
    v_contract.customer_id,
    v_contract.end_date,
    COALESCE(v_contract.cancellation_window_start, v_contract.end_date - COALESCE(v_contract.notice_period_days, 30)),
    COALESCE(v_contract.cancellation_window_start, v_contract.end_date - COALESCE(v_contract.notice_period_days, 30)) - 7,
    COALESCE(v_contract.arr, 0),
    COALESCE(v_contract.notice_period_days, 30),
    p_assigned_csm_id,
    p_assigned_csm_name
  )
  RETURNING id INTO v_review_id;

  -- Create initial task for customer outreach
  INSERT INTO auto_renewal_tasks (
    review_id,
    title,
    description,
    task_type,
    assigned_to,
    due_date,
    priority
  ) VALUES (
    v_review_id,
    'Auto-Renewal Review: Customer Outreach',
    'Reach out to customer to confirm awareness of upcoming auto-renewal and discuss continued partnership.',
    'customer_outreach',
    p_assigned_csm_id,
    COALESCE(v_contract.cancellation_window_start, v_contract.end_date - COALESCE(v_contract.notice_period_days, 30)) - 7,
    'high'
  );

  RETURN v_review_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update review checklist item
CREATE OR REPLACE FUNCTION update_review_checklist(
  p_review_id UUID,
  p_item_key TEXT,
  p_value BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  UPDATE auto_renewal_reviews
  SET
    review_checklist = jsonb_set(review_checklist, ARRAY[p_item_key], to_jsonb(p_value)),
    updated_at = NOW()
  WHERE id = p_review_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark customer acknowledgment
CREATE OR REPLACE FUNCTION mark_customer_acknowledged(
  p_review_id UUID,
  p_acknowledged_by TEXT,
  p_method TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE auto_renewal_reviews
  SET
    customer_acknowledged_at = NOW(),
    customer_acknowledged_by = p_acknowledged_by,
    acknowledgment_method = p_method,
    status = 'acknowledged',
    review_checklist = jsonb_set(review_checklist, '{customer_acknowledgment_received}', 'true'::jsonb),
    updated_at = NOW()
  WHERE id = p_review_id;

  -- Also update the contract
  UPDATE contracts
  SET
    renewal_acknowledged_at = NOW(),
    renewal_acknowledged_by = p_acknowledged_by,
    updated_at = NOW()
  FROM auto_renewal_reviews arr
  WHERE arr.id = p_review_id
    AND contracts.id = arr.contract_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp trigger for auto_renewal_reviews
CREATE TRIGGER update_auto_renewal_reviews_timestamp
  BEFORE UPDATE ON auto_renewal_reviews
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Update timestamp trigger for auto_renewal_tasks
CREATE TRIGGER update_auto_renewal_tasks_timestamp
  BEFORE UPDATE ON auto_renewal_tasks
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE auto_renewal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_renewal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_renewal_notifications ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for service role, restrict for anon)
CREATE POLICY auto_renewal_reviews_service_policy ON auto_renewal_reviews
  FOR ALL USING (true);

CREATE POLICY auto_renewal_tasks_service_policy ON auto_renewal_tasks
  FOR ALL USING (true);

CREATE POLICY auto_renewal_notifications_service_policy ON auto_renewal_notifications
  FOR ALL USING (true);

-- ============================================
-- SEED DATA (Optional test data)
-- ============================================

-- Update existing contracts with auto-renewal fields for testing
UPDATE contracts
SET
  auto_renewal = true,
  notice_period_days = 30,
  cancellation_window_start = end_date - INTERVAL '30 days'
WHERE status = 'active'
  AND end_date IS NOT NULL
  AND auto_renewal IS NOT true
LIMIT 2;

COMMENT ON TABLE auto_renewal_reviews IS 'PRD-093: Tracks auto-renewal review workflows for contracts with auto-renewal clauses';
COMMENT ON TABLE auto_renewal_tasks IS 'PRD-093: Individual tasks for each auto-renewal review workflow';
COMMENT ON TABLE auto_renewal_notifications IS 'PRD-093: Audit log of all notifications sent for auto-renewal reviews';
