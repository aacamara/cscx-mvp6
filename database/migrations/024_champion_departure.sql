-- PRD-088: Champion Departure Alert
-- Migration for stakeholder status tracking and departure detection

-- ============================================
-- Stakeholder Status Fields
-- ============================================

-- Add status tracking columns to stakeholders table
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
-- Values: 'active', 'departed', 'inactive', 'unknown'

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS departure_detected_at TIMESTAMPTZ;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS departure_destination TEXT; -- New company
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS departure_destination_role TEXT; -- New role
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS departure_confidence INTEGER; -- 0-100
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS is_champion BOOLEAN DEFAULT FALSE;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS is_exec_sponsor BOOLEAN DEFAULT FALSE;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 50;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_stakeholders_status ON stakeholders(status);
CREATE INDEX IF NOT EXISTS idx_stakeholders_champion ON stakeholders(is_champion) WHERE is_champion = TRUE;
CREATE INDEX IF NOT EXISTS idx_stakeholders_exec_sponsor ON stakeholders(is_exec_sponsor) WHERE is_exec_sponsor = TRUE;

-- ============================================
-- Champion Departure Signals Table
-- ============================================

CREATE TABLE IF NOT EXISTS champion_departure_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  signal_type VARCHAR(50) NOT NULL,
  -- Values: 'email_bounce', 'linkedin_change', 'login_stopped', 'meeting_declines', 'ooo_mention', 'manual'
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  evidence TEXT,
  evidence_data JSONB DEFAULT '{}',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departure_signals_stakeholder ON champion_departure_signals(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_departure_signals_customer ON champion_departure_signals(customer_id);
CREATE INDEX IF NOT EXISTS idx_departure_signals_type ON champion_departure_signals(signal_type);

-- ============================================
-- Risk Signals Table (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS risk_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  signal_type VARCHAR(50) NOT NULL,
  -- Types: 'champion_left', 'health_drop', 'churn_risk', 'engagement_drop', etc.
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  -- Values: 'critical', 'high', 'medium', 'low'
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_signals_customer ON risk_signals(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_signals_type ON risk_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_risk_signals_severity ON risk_signals(severity);
CREATE INDEX IF NOT EXISTS idx_risk_signals_resolved ON risk_signals(resolved);

-- ============================================
-- Champion Departure Response Tasks
-- ============================================

CREATE TABLE IF NOT EXISTS champion_departure_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  risk_signal_id UUID REFERENCES risk_signals(id) ON DELETE SET NULL,
  task_type VARCHAR(50) NOT NULL,
  -- Types: 'establish_contact', 'identify_champion', 'outreach_email', 'internal_review', 'update_stakeholder_map'
  title TEXT NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'high',
  status VARCHAR(20) DEFAULT 'pending',
  -- Status: 'pending', 'in_progress', 'completed', 'cancelled'
  due_at TIMESTAMPTZ,
  assigned_to UUID,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departure_tasks_customer ON champion_departure_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_departure_tasks_stakeholder ON champion_departure_tasks(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_departure_tasks_status ON champion_departure_tasks(status);

-- ============================================
-- Stakeholder Interactions History
-- ============================================

CREATE TABLE IF NOT EXISTS stakeholder_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL,
  -- Types: 'email_sent', 'email_received', 'meeting', 'call', 'login', 'support_ticket'
  title TEXT,
  description TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stakeholder_interactions_stakeholder ON stakeholder_interactions(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_interactions_customer ON stakeholder_interactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_interactions_type ON stakeholder_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_stakeholder_interactions_date ON stakeholder_interactions(occurred_at);

-- ============================================
-- Draft Emails for Multi-threading
-- ============================================

CREATE TABLE IF NOT EXISTS draft_outreach_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  triggered_by UUID REFERENCES risk_signals(id) ON DELETE SET NULL,
  template_type VARCHAR(50) NOT NULL,
  -- Types: 'champion_transition', 'introduction', 'reengagement', 'multi_threading'
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_email TEXT,
  recipient_name TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  -- Status: 'draft', 'approved', 'sent', 'cancelled'
  sent_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draft_emails_customer ON draft_outreach_emails(customer_id);
CREATE INDEX IF NOT EXISTS idx_draft_emails_status ON draft_outreach_emails(status);

-- ============================================
-- Update Triggers for Updated Timestamps
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_risk_signals_timestamp
  BEFORE UPDATE ON risk_signals
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER IF NOT EXISTS update_departure_tasks_timestamp
  BEFORE UPDATE ON champion_departure_tasks
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER IF NOT EXISTS update_draft_emails_timestamp
  BEFORE UPDATE ON draft_outreach_emails
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- Functions
-- ============================================

-- Function to evaluate champion departure status
CREATE OR REPLACE FUNCTION evaluate_champion_departure(
  p_stakeholder_id UUID
) RETURNS TABLE (
  is_departed BOOLEAN,
  confidence INTEGER,
  recommended_action TEXT
) AS $$
DECLARE
  total_confidence INTEGER := 0;
  signal_count INTEGER := 0;
  signal_weight RECORD;
BEGIN
  -- Weight signals by reliability
  FOR signal_weight IN
    SELECT
      signal_type,
      confidence,
      CASE signal_type
        WHEN 'linkedin_change' THEN 0.4
        WHEN 'email_bounce' THEN 0.3
        WHEN 'login_stopped' THEN 0.15
        WHEN 'meeting_declines' THEN 0.1
        WHEN 'ooo_mention' THEN 0.05
        ELSE 0.1
      END as weight
    FROM champion_departure_signals
    WHERE stakeholder_id = p_stakeholder_id
      AND detected_at > NOW() - INTERVAL '30 days'
  LOOP
    total_confidence := total_confidence + (signal_weight.confidence * signal_weight.weight);
    signal_count := signal_count + 1;
  END LOOP;

  -- Normalize confidence
  IF signal_count > 0 THEN
    total_confidence := LEAST(total_confidence, 100);
  END IF;

  -- Return evaluation
  RETURN QUERY SELECT
    total_confidence >= 70 AS is_departed,
    total_confidence AS confidence,
    CASE
      WHEN total_confidence >= 70 THEN 'trigger_alert'
      WHEN total_confidence >= 40 THEN 'monitor_closely'
      ELSE 'no_action'
    END AS recommended_action;
END;
$$ LANGUAGE plpgsql;

-- Function to get champion candidates for a customer
CREATE OR REPLACE FUNCTION get_champion_candidates(
  p_customer_id UUID,
  p_limit INTEGER DEFAULT 5
) RETURNS TABLE (
  stakeholder_id UUID,
  name TEXT,
  role TEXT,
  email TEXT,
  score INTEGER,
  reasons TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS stakeholder_id,
    s.name,
    s.role,
    s.email,
    (
      COALESCE(s.engagement_score, 0) +
      COALESCE(s.interaction_count, 0) * 2 +
      CASE WHEN s.is_primary THEN 20 ELSE 0 END +
      CASE WHEN s.role ILIKE '%director%' OR s.role ILIKE '%vp%' OR s.role ILIKE '%head%' THEN 15 ELSE 0 END +
      CASE WHEN s.last_contact_at > NOW() - INTERVAL '30 days' THEN 10 ELSE 0 END
    ) AS score,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN s.engagement_score >= 70 THEN 'High engagement score' END,
      CASE WHEN s.interaction_count >= 5 THEN format('%s interactions', s.interaction_count) END,
      CASE WHEN s.is_primary THEN 'Primary contact' END,
      CASE WHEN s.role ILIKE '%director%' OR s.role ILIKE '%vp%' OR s.role ILIKE '%head%' THEN 'Senior role' END,
      CASE WHEN s.last_contact_at > NOW() - INTERVAL '30 days' THEN 'Recent contact' END
    ], NULL) AS reasons
  FROM stakeholders s
  WHERE s.customer_id = p_customer_id
    AND s.status = 'active'
    AND s.is_champion = FALSE
  ORDER BY score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Sample Data for Testing
-- ============================================

-- Update some existing stakeholders to be champions (if they exist)
UPDATE stakeholders
SET is_champion = TRUE,
    is_primary = TRUE,
    engagement_score = 85,
    interaction_count = 12
WHERE is_primary = TRUE
  AND is_champion = FALSE;

-- Grant permissions
GRANT ALL ON champion_departure_signals TO authenticated;
GRANT ALL ON risk_signals TO authenticated;
GRANT ALL ON champion_departure_tasks TO authenticated;
GRANT ALL ON stakeholder_interactions TO authenticated;
GRANT ALL ON draft_outreach_emails TO authenticated;
