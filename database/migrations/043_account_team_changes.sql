-- ============================================
-- PRD-132: Account Team Change Update Propagation
-- Migration: 043_account_team_changes.sql
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ACCOUNT TEAM CHANGES TABLE
-- Main table tracking all team member changes
-- ============================================
CREATE TABLE IF NOT EXISTS account_team_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Change details
  change_type TEXT NOT NULL CHECK (change_type IN ('csm', 'ae', 'support', 'executive_sponsor', 'tam', 'se', 'implementation', 'other')),
  previous_user_id UUID,
  new_user_id UUID NOT NULL,
  effective_date DATE NOT NULL,

  -- Reason and context
  reason TEXT NOT NULL,
  reason_category TEXT NOT NULL CHECK (reason_category IN ('reassignment', 'departure', 'promotion', 'restructure', 'territory_change', 'performance', 'other')),
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'immediate')),
  notes TEXT,

  -- Transition tracking
  transition_phase TEXT DEFAULT 'initiated' CHECK (transition_phase IN ('initiated', 'handoff_prep', 'handoff_meeting', 'knowledge_transfer', 'customer_notification', 'completed')),
  handoff_doc_id TEXT,
  handoff_doc_url TEXT,
  meeting_scheduled BOOLEAN DEFAULT FALSE,
  meeting_id TEXT,
  meeting_date TIMESTAMPTZ,
  tasks_transferred BOOLEAN DEFAULT FALSE,
  tasks_transferred_count INTEGER DEFAULT 0,
  customer_notified BOOLEAN DEFAULT FALSE,
  customer_notification_date TIMESTAMPTZ,
  customer_notification_approval_id UUID,

  -- Overall status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'partial_failure', 'failed')),

  -- Audit
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_team_changes_customer ON account_team_changes(customer_id);
CREATE INDEX IF NOT EXISTS idx_team_changes_status ON account_team_changes(status);
CREATE INDEX IF NOT EXISTS idx_team_changes_effective_date ON account_team_changes(effective_date);
CREATE INDEX IF NOT EXISTS idx_team_changes_new_user ON account_team_changes(new_user_id);
CREATE INDEX IF NOT EXISTS idx_team_changes_previous_user ON account_team_changes(previous_user_id);
CREATE INDEX IF NOT EXISTS idx_team_changes_created ON account_team_changes(created_at DESC);

-- ============================================
-- PROPAGATION STATUS TABLE
-- Tracks propagation to each system
-- ============================================
CREATE TABLE IF NOT EXISTS team_change_propagation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  change_id UUID NOT NULL REFERENCES account_team_changes(id) ON DELETE CASCADE,

  -- System details
  system_type TEXT NOT NULL CHECK (system_type IN (
    'cscx', 'salesforce', 'hubspot', 'slack', 'google_drive',
    'google_calendar', 'email_lists', 'support_system', 'zendesk',
    'intercom', 'automations'
  )),
  system_name TEXT NOT NULL,
  priority INTEGER DEFAULT 5,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,

  -- Details for logging
  request_payload JSONB,
  response_data JSONB,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(change_id, system_type)
);

CREATE INDEX IF NOT EXISTS idx_propagation_change ON team_change_propagation(change_id);
CREATE INDEX IF NOT EXISTS idx_propagation_status ON team_change_propagation(status);
CREATE INDEX IF NOT EXISTS idx_propagation_system ON team_change_propagation(system_type);

-- ============================================
-- TEAM MEMBER HISTORY TABLE
-- Complete history of team assignments
-- ============================================
CREATE TABLE IF NOT EXISTS account_team_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,

  -- Assignment period
  start_date DATE NOT NULL,
  end_date DATE,

  -- Context
  change_id UUID REFERENCES account_team_changes(id) ON DELETE SET NULL,
  change_reason TEXT,
  handoff_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_history_customer ON account_team_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_team_history_user ON account_team_history(user_id);
CREATE INDEX IF NOT EXISTS idx_team_history_role ON account_team_history(role);
CREATE INDEX IF NOT EXISTS idx_team_history_dates ON account_team_history(start_date, end_date);

-- ============================================
-- CUSTOMER NOTIFICATIONS TABLE
-- Tracks customer notifications for team changes
-- ============================================
CREATE TABLE IF NOT EXISTS team_change_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  change_id UUID NOT NULL REFERENCES account_team_changes(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Recipient
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,

  -- Content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_id TEXT,
  variables JSONB,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'rejected')),
  approval_id UUID,

  -- Scheduling
  scheduled_date TIMESTAMPTZ,
  sent_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_change ON team_change_notifications(change_id);
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON team_change_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON team_change_notifications(status);

-- ============================================
-- UPDATE TIMESTAMP TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_team_change_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_team_changes_timestamp ON account_team_changes;
CREATE TRIGGER update_team_changes_timestamp
  BEFORE UPDATE ON account_team_changes
  FOR EACH ROW EXECUTE FUNCTION update_team_change_timestamp();

DROP TRIGGER IF EXISTS update_propagation_timestamp ON team_change_propagation;
CREATE TRIGGER update_propagation_timestamp
  BEFORE UPDATE ON team_change_propagation
  FOR EACH ROW EXECUTE FUNCTION update_team_change_timestamp();

DROP TRIGGER IF EXISTS update_notifications_timestamp ON team_change_notifications;
CREATE TRIGGER update_notifications_timestamp
  BEFORE UPDATE ON team_change_notifications
  FOR EACH ROW EXECUTE FUNCTION update_team_change_timestamp();

-- ============================================
-- HELPER FUNCTION: Get propagation summary
-- ============================================
CREATE OR REPLACE FUNCTION get_propagation_summary(p_change_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_systems', COUNT(*),
    'completed', COUNT(*) FILTER (WHERE status = 'completed'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
    'skipped', COUNT(*) FILTER (WHERE status = 'skipped'),
    'overall_status', CASE
      WHEN COUNT(*) FILTER (WHERE status = 'pending' OR status = 'in_progress') = COUNT(*) THEN 'pending'
      WHEN COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')) > 0 THEN 'in_progress'
      WHEN COUNT(*) FILTER (WHERE status = 'failed') > 0 AND COUNT(*) FILTER (WHERE status = 'completed') > 0 THEN 'partial_failure'
      WHEN COUNT(*) FILTER (WHERE status = 'failed') = COUNT(*) FILTER (WHERE status NOT IN ('skipped')) THEN 'failed'
      ELSE 'completed'
    END,
    'last_updated', MAX(updated_at)
  ) INTO result
  FROM team_change_propagation
  WHERE change_id = p_change_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTION: Calculate team tenure
-- ============================================
CREATE OR REPLACE FUNCTION calculate_tenure(p_start_date DATE, p_end_date DATE DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  end_dt DATE := COALESCE(p_end_date, CURRENT_DATE);
  days_count INTEGER;
  months_count INTEGER;
BEGIN
  days_count := end_dt - p_start_date;
  months_count := EXTRACT(YEAR FROM age(end_dt, p_start_date)) * 12 +
                  EXTRACT(MONTH FROM age(end_dt, p_start_date));

  RETURN jsonb_build_object(
    'days', days_count,
    'months', months_count,
    'formatted', CASE
      WHEN months_count >= 12 THEN (months_count / 12)::TEXT || ' year' || CASE WHEN months_count / 12 > 1 THEN 's' ELSE '' END
      WHEN months_count > 0 THEN months_count::TEXT || ' month' || CASE WHEN months_count > 1 THEN 's' ELSE '' END
      ELSE days_count::TEXT || ' day' || CASE WHEN days_count > 1 THEN 's' ELSE '' END
    END
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Active team changes with details
-- ============================================
CREATE OR REPLACE VIEW v_team_changes_detail AS
SELECT
  tc.id,
  tc.customer_id,
  c.name AS customer_name,
  c.arr AS customer_arr,
  c.health_score AS customer_health,
  c.industry AS customer_industry,
  tc.change_type,
  tc.previous_user_id,
  tc.new_user_id,
  tc.effective_date,
  tc.reason,
  tc.reason_category,
  tc.urgency,
  tc.notes,
  tc.transition_phase,
  tc.handoff_doc_id,
  tc.handoff_doc_url,
  tc.meeting_scheduled,
  tc.meeting_id,
  tc.meeting_date,
  tc.tasks_transferred,
  tc.tasks_transferred_count,
  tc.customer_notified,
  tc.customer_notification_date,
  tc.status,
  tc.created_by,
  tc.created_at,
  tc.updated_at,
  tc.completed_at,
  get_propagation_summary(tc.id) AS propagation_summary
FROM account_team_changes tc
JOIN customers c ON tc.customer_id = c.id;

-- ============================================
-- VIEW: Team history with tenure
-- ============================================
CREATE OR REPLACE VIEW v_team_history_detail AS
SELECT
  th.id,
  th.customer_id,
  c.name AS customer_name,
  th.user_id,
  th.role,
  th.start_date,
  th.end_date,
  calculate_tenure(th.start_date, th.end_date) AS tenure,
  th.change_reason,
  th.handoff_notes,
  th.created_at
FROM account_team_history th
JOIN customers c ON th.customer_id = c.id;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE account_team_changes IS 'PRD-132: Tracks account team member changes and propagation';
COMMENT ON TABLE team_change_propagation IS 'PRD-132: Tracks propagation status to each integrated system';
COMMENT ON TABLE account_team_history IS 'PRD-132: Complete history of team assignments for reporting';
COMMENT ON TABLE team_change_notifications IS 'PRD-132: Customer notifications for team changes';
