-- Migration: 024_escalation_response_tracking.sql
-- Description: Add escalation response tracking columns to risk_signals table
-- PRD: PRD-029 - Escalation Response Drafting
-- Created: 2026-01-29

-- ============================================
-- RISK SIGNALS - Add Response Tracking
-- ============================================
-- Add columns to track when and how escalation responses were sent

ALTER TABLE risk_signals
ADD COLUMN IF NOT EXISTS response_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS response_email_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS response_time_minutes INT,
ADD COLUMN IF NOT EXISTS escalation_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS reported_by_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS reported_by_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS reported_by_title VARCHAR(255);

-- Add index for response tracking analytics
CREATE INDEX IF NOT EXISTS idx_risk_signals_response
ON risk_signals(response_sent_at)
WHERE signal_type = 'support_escalation' AND response_sent_at IS NOT NULL;

-- Add index for unresponded escalations
CREATE INDEX IF NOT EXISTS idx_risk_signals_pending_response
ON risk_signals(detected_at DESC)
WHERE signal_type = 'support_escalation' AND response_sent_at IS NULL AND resolved_at IS NULL;

-- ============================================
-- ESCALATION RESPONSES TABLE
-- ============================================
-- Track all escalation response drafts and sends

CREATE TABLE IF NOT EXISTS escalation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_signal_id UUID REFERENCES risk_signals(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Response details
  draft_subject VARCHAR(500),
  draft_body TEXT,

  -- Recipients
  to_email VARCHAR(255) NOT NULL,
  to_name VARCHAR(255),
  cc_emails TEXT[], -- Array of CC recipients
  suggested_ccs TEXT[], -- AI-suggested internal CCs

  -- Status tracking
  status VARCHAR(50) DEFAULT 'draft', -- draft, pending_approval, approved, sent, rejected

  -- Sending details
  gmail_message_id VARCHAR(255),
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),

  -- Response metrics
  escalation_detected_at TIMESTAMPTZ,
  response_time_minutes INT,

  -- Approval workflow
  approval_requested_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  rejection_reason TEXT,

  -- AI generation metadata
  escalation_type VARCHAR(50), -- technical, billing, service, executive_complaint
  escalation_severity VARCHAR(20), -- low, medium, high, critical
  ai_confidence_score DECIMAL(3,2),
  template_used VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_responses_customer ON escalation_responses(customer_id);
CREATE INDEX IF NOT EXISTS idx_escalation_responses_status ON escalation_responses(status) WHERE status != 'sent';
CREATE INDEX IF NOT EXISTS idx_escalation_responses_risk_signal ON escalation_responses(risk_signal_id);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_escalation_responses_updated_at
  BEFORE UPDATE ON escalation_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE escalation_responses IS 'Tracks escalation response drafts and sends for PRD-029';
COMMENT ON COLUMN risk_signals.response_sent_at IS 'Timestamp when escalation response was sent';
COMMENT ON COLUMN risk_signals.response_email_id IS 'Gmail message ID of the escalation response';
COMMENT ON COLUMN risk_signals.response_time_minutes IS 'Minutes between escalation detection and response';
COMMENT ON COLUMN risk_signals.escalation_type IS 'Type of escalation: technical, billing, service, executive_complaint';
