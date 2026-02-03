-- PRD-253: Peer Review Workflow
-- Migration: 045_peer_review_workflow.sql
-- Purpose: Create tables for peer review workflow system

-- ============================================
-- REVIEW REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id),

  -- Content being reviewed
  content_type VARCHAR(50) NOT NULL, -- 'email_draft', 'proposal', 'document', 'action', 'escalation_response'
  content_id UUID, -- Link to specific content (email draft, document, etc.)
  content_snapshot TEXT, -- Snapshot of content at review time (immutable)
  content_metadata JSONB DEFAULT '{}', -- Additional context (recipient, subject, etc.)

  -- Request details
  review_type VARCHAR(50) NOT NULL DEFAULT 'quality', -- 'quality', 'accuracy', 'compliance', 'coaching'
  focus_areas TEXT, -- Specific areas reviewer should focus on
  urgency VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  due_at TIMESTAMPTZ, -- When review is needed by

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_review', 'approved', 'changes_requested', 'rejected', 'expired', 'cancelled'
  requires_approval BOOLEAN DEFAULT false, -- If true, content cannot be sent without approval
  auto_approve_at TIMESTAMPTZ, -- Auto-approve if no response by this time

  -- Consensus settings
  required_approvals INTEGER DEFAULT 1,
  approval_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REVIEW ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES review_requests(id) ON DELETE CASCADE NOT NULL,
  reviewer_user_id UUID NOT NULL,

  -- Assignment status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'declined'
  decision VARCHAR(50), -- 'approved', 'changes_requested', 'rejected' (null until completed)

  -- Feedback
  overall_feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 quality rating

  -- Timing
  started_at TIMESTAMPTZ, -- When reviewer started reviewing
  completed_at TIMESTAMPTZ, -- When reviewer submitted decision
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REVIEW COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES review_assignments(id) ON DELETE CASCADE NOT NULL,
  reviewer_user_id UUID NOT NULL,

  -- Comment location (for inline comments)
  comment_type VARCHAR(50) DEFAULT 'inline', -- 'inline', 'general'
  selection_start INTEGER, -- Character position start (for inline)
  selection_end INTEGER, -- Character position end (for inline)
  selection_text TEXT, -- The selected text being commented on

  -- Comment content
  comment TEXT NOT NULL,
  suggestion TEXT, -- Suggested replacement text
  severity VARCHAR(20) DEFAULT 'suggestion', -- 'critical', 'important', 'suggestion'

  -- Resolution tracking
  is_resolved BOOLEAN DEFAULT false,
  resolved_by_user_id UUID,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REVIEW AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS review_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES review_requests(id),
  assignment_id UUID REFERENCES review_assignments(id),
  user_id UUID NOT NULL,

  action VARCHAR(50) NOT NULL, -- 'requested', 'assigned', 'started', 'commented', 'resolved_comment', 'approved', 'changes_requested', 'rejected', 'declined', 'sent', 'expired', 'cancelled'
  details JSONB DEFAULT '{}', -- Additional action details

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_review_requests_author ON review_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_status ON review_requests(status);
CREATE INDEX IF NOT EXISTS idx_review_requests_customer ON review_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_due ON review_requests(due_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_review_requests_auto_approve ON review_requests(auto_approve_at) WHERE status = 'pending' AND auto_approve_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_assignments_reviewer ON review_assignments(reviewer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_review_assignments_request ON review_assignments(request_id);

CREATE INDEX IF NOT EXISTS idx_review_comments_assignment ON review_comments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_unresolved ON review_comments(assignment_id) WHERE is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_review_audit_log_request ON review_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_review_audit_log_user ON review_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_review_audit_log_action ON review_audit_log(action);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_review_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_review_requests_updated_at ON review_requests;
CREATE TRIGGER trigger_review_requests_updated_at
  BEFORE UPDATE ON review_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_review_requests_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies for review_requests
CREATE POLICY review_requests_select ON review_requests
  FOR SELECT USING (true); -- All authenticated users can view requests

CREATE POLICY review_requests_insert ON review_requests
  FOR INSERT WITH CHECK (true); -- Authenticated users can create requests

CREATE POLICY review_requests_update ON review_requests
  FOR UPDATE USING (true); -- Service-level updates

-- Policies for review_assignments
CREATE POLICY review_assignments_select ON review_assignments
  FOR SELECT USING (true);

CREATE POLICY review_assignments_insert ON review_assignments
  FOR INSERT WITH CHECK (true);

CREATE POLICY review_assignments_update ON review_assignments
  FOR UPDATE USING (true);

-- Policies for review_comments
CREATE POLICY review_comments_select ON review_comments
  FOR SELECT USING (true);

CREATE POLICY review_comments_insert ON review_comments
  FOR INSERT WITH CHECK (true);

CREATE POLICY review_comments_update ON review_comments
  FOR UPDATE USING (true);

-- Policies for review_audit_log
CREATE POLICY review_audit_log_select ON review_audit_log
  FOR SELECT USING (true);

CREATE POLICY review_audit_log_insert ON review_audit_log
  FOR INSERT WITH CHECK (true);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE review_requests IS 'PRD-253: Peer review requests for communications and actions';
COMMENT ON TABLE review_assignments IS 'PRD-253: Reviewer assignments for review requests';
COMMENT ON TABLE review_comments IS 'PRD-253: Inline and general comments on review content';
COMMENT ON TABLE review_audit_log IS 'PRD-253: Immutable audit trail for compliance';

COMMENT ON COLUMN review_requests.content_snapshot IS 'Immutable snapshot of content at review request time';
COMMENT ON COLUMN review_requests.requires_approval IS 'If true, content cannot be sent without at least one approval';
COMMENT ON COLUMN review_requests.auto_approve_at IS 'Optional time-based auto-approval for non-critical reviews';
COMMENT ON COLUMN review_comments.severity IS 'Comment priority: critical (must fix), important (should fix), suggestion (optional)';
