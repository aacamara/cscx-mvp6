-- Migration: Email Suggestion Feedback
-- PRD-215: Smart Email Response Suggestions
-- Stores feedback on AI-generated email suggestions for continuous learning

-- ============================================
-- Email Suggestion Feedback Table
-- ============================================

CREATE TABLE IF NOT EXISTS email_suggestion_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User who received the suggestion
  user_id TEXT NOT NULL,

  -- Suggestion identification
  suggestion_id TEXT NOT NULL,
  email_id TEXT NOT NULL,

  -- Context at time of suggestion (for analysis)
  email_context JSONB DEFAULT '{}',

  -- The original suggestion text
  suggestion_text TEXT,

  -- What the user actually sent (if different)
  final_text TEXT,

  -- Feedback type: used, edited, rejected
  feedback VARCHAR(20) NOT NULL CHECK (feedback IN ('used', 'edited', 'rejected')),

  -- Optional rating 1-5
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),

  -- Optional notes/comments
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for efficient queries
  CONSTRAINT valid_feedback CHECK (feedback IN ('used', 'edited', 'rejected'))
);

-- Index for user-specific feedback queries
CREATE INDEX IF NOT EXISTS idx_email_suggestion_feedback_user
  ON email_suggestion_feedback(user_id);

-- Index for analyzing feedback by time
CREATE INDEX IF NOT EXISTS idx_email_suggestion_feedback_created
  ON email_suggestion_feedback(created_at DESC);

-- Index for analyzing feedback patterns
CREATE INDEX IF NOT EXISTS idx_email_suggestion_feedback_type
  ON email_suggestion_feedback(feedback);

-- Composite index for user + time queries
CREATE INDEX IF NOT EXISTS idx_email_suggestion_feedback_user_time
  ON email_suggestion_feedback(user_id, created_at DESC);

-- ============================================
-- Email Suggestion Cache Table (Optional)
-- For persistent caching across server restarts
-- ============================================

CREATE TABLE IF NOT EXISTS email_suggestion_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cache key (typically emailId-customerId)
  cache_key TEXT NOT NULL UNIQUE,

  -- The generated suggestions
  suggestions JSONB NOT NULL,

  -- Analysis results
  detected_intent TEXT,
  urgency TEXT,
  recommended_action TEXT,
  context_summary TEXT,

  -- Timestamps
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Auto-cleanup expired entries
  CONSTRAINT valid_expiry CHECK (expires_at > generated_at)
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_email_suggestion_cache_key
  ON email_suggestion_cache(cache_key);

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_email_suggestion_cache_expires
  ON email_suggestion_cache(expires_at);

-- ============================================
-- Support Tables (if not existing)
-- ============================================

-- Support tickets table (referenced in context gathering)
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_customer
  ON support_tickets(customer_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status);

-- Risk signals table (referenced in context gathering)
CREATE TABLE IF NOT EXISTS risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_risk_signals_customer
  ON risk_signals(customer_id);

CREATE INDEX IF NOT EXISTS idx_risk_signals_active
  ON risk_signals(is_active) WHERE is_active = true;

-- Customer events table (referenced in context gathering)
CREATE TABLE IF NOT EXISTS customer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('renewal', 'qbr', 'meeting', 'milestone', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_events_customer
  ON customer_events(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_events_date
  ON customer_events(date);

-- ============================================
-- Views for Analytics
-- ============================================

-- Aggregated feedback statistics view
CREATE OR REPLACE VIEW email_suggestion_feedback_stats AS
SELECT
  user_id,
  COUNT(*) as total_suggestions,
  COUNT(CASE WHEN feedback = 'used' THEN 1 END) as used_count,
  COUNT(CASE WHEN feedback = 'edited' THEN 1 END) as edited_count,
  COUNT(CASE WHEN feedback = 'rejected' THEN 1 END) as rejected_count,
  ROUND(AVG(rating)::numeric, 2) as avg_rating,
  ROUND(
    (COUNT(CASE WHEN feedback IN ('used', 'edited') THEN 1 END)::numeric /
     NULLIF(COUNT(*)::numeric, 0)) * 100,
    1
  ) as acceptance_rate,
  MIN(created_at) as first_feedback_at,
  MAX(created_at) as last_feedback_at
FROM email_suggestion_feedback
GROUP BY user_id;

-- Daily feedback trends
CREATE OR REPLACE VIEW email_suggestion_feedback_daily AS
SELECT
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as total,
  COUNT(CASE WHEN feedback = 'used' THEN 1 END) as used,
  COUNT(CASE WHEN feedback = 'edited' THEN 1 END) as edited,
  COUNT(CASE WHEN feedback = 'rejected' THEN 1 END) as rejected,
  ROUND(AVG(rating)::numeric, 2) as avg_rating
FROM email_suggestion_feedback
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- ============================================
-- Functions
-- ============================================

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_email_suggestion_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM email_suggestion_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-email-suggestion-cache', '*/15 * * * *', 'SELECT cleanup_email_suggestion_cache()');

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on feedback table
ALTER TABLE email_suggestion_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own feedback
CREATE POLICY email_suggestion_feedback_user_policy
  ON email_suggestion_feedback
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE email_suggestion_feedback IS 'Stores user feedback on AI-generated email suggestions for continuous improvement';
COMMENT ON COLUMN email_suggestion_feedback.feedback IS 'User action: used (as-is), edited (modified before sending), or rejected (not used)';
COMMENT ON COLUMN email_suggestion_feedback.rating IS 'Optional 1-5 star rating of suggestion quality';
COMMENT ON COLUMN email_suggestion_feedback.email_context IS 'JSON snapshot of customer context at suggestion time for analysis';

COMMENT ON TABLE email_suggestion_cache IS 'Persistent cache for email suggestions (optional, primary cache is in-memory)';
COMMENT ON TABLE support_tickets IS 'Customer support tickets for email context enrichment';
COMMENT ON TABLE risk_signals IS 'Active risk signals for email context enrichment';
COMMENT ON TABLE customer_events IS 'Upcoming customer events (renewals, QBRs, meetings) for email context';
