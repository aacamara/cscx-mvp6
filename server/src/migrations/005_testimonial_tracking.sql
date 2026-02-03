-- Migration: Testimonial Tracking (PRD-037)
-- Created: 2026-01-29
-- Description: Tables for testimonial request and advocacy tracking

-- Testimonial requests tracking table
CREATE TABLE IF NOT EXISTS testimonial_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  stakeholder_email VARCHAR(255) NOT NULL,
  stakeholder_name VARCHAR(255) NOT NULL,

  -- Request details
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
    'testimonial', 'quote', 'review', 'case_study', 'reference', 'video'
  )),
  request_status VARCHAR(50) DEFAULT 'pending' CHECK (request_status IN (
    'pending', 'sent', 'opened', 'responded', 'accepted', 'declined', 'completed', 'expired'
  )),

  -- Timing and context
  trigger_reason VARCHAR(100), -- 'high_nps', 'milestone', 'health_score', 'manual', 'qbr_success'
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Email tracking
  email_subject VARCHAR(500),
  email_message_id VARCHAR(255),
  gmail_thread_id VARCHAR(255),
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,

  -- Request metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "wins": ["45% efficiency improvement", "98% user adoption"],
  --   "nps_score": 9,
  --   "health_score": 92,
  --   "csm_id": "uuid",
  --   "csm_name": "Sarah Johnson",
  --   "template_used": "testimonial-request",
  --   "options_offered": ["quote", "review", "testimonial", "case_study"]
  -- }

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for testimonial requests
CREATE INDEX IF NOT EXISTS idx_testimonial_requests_customer ON testimonial_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_testimonial_requests_status ON testimonial_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_testimonial_requests_type ON testimonial_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_testimonial_requests_sent ON testimonial_requests(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonial_requests_expires ON testimonial_requests(expires_at);

-- Customer testimonials (received testimonials)
CREATE TABLE IF NOT EXISTS customer_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  request_id UUID REFERENCES testimonial_requests(id) ON DELETE SET NULL,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,

  -- Testimonial content
  testimonial_type VARCHAR(50) NOT NULL CHECK (testimonial_type IN (
    'quote', 'written_testimonial', 'video', 'case_study', 'review', 'reference_available'
  )),
  title VARCHAR(255),
  content TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),

  -- Source details
  source_platform VARCHAR(100), -- 'g2', 'capterra', 'trustradius', 'direct', 'linkedin'
  source_url TEXT,
  source_id VARCHAR(255), -- External review ID

  -- Attribution
  stakeholder_name VARCHAR(255),
  stakeholder_title VARCHAR(255),
  stakeholder_company VARCHAR(255),
  approved_for_use BOOLEAN DEFAULT false,
  approved_use_cases JSONB DEFAULT '[]'::jsonb, -- ['website', 'case_study', 'sales_deck', 'social_media']

  -- Metrics and impact
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  impact_score INTEGER, -- Calculated based on views, shares, conversions

  -- Dates
  received_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "video_url": "https://...",
  --   "thumbnail_url": "https://...",
  --   "tags": ["enterprise", "efficiency", "roi"],
  --   "industry": "Technology",
  --   "use_case": "Process automation"
  -- }

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for customer testimonials
CREATE INDEX IF NOT EXISTS idx_customer_testimonials_customer ON customer_testimonials(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_testimonials_type ON customer_testimonials(testimonial_type);
CREATE INDEX IF NOT EXISTS idx_customer_testimonials_approved ON customer_testimonials(approved_for_use);
CREATE INDEX IF NOT EXISTS idx_customer_testimonials_received ON customer_testimonials(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_testimonials_source ON customer_testimonials(source_platform);

-- Reference availability tracking
CREATE TABLE IF NOT EXISTS customer_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,

  -- Reference details
  stakeholder_name VARCHAR(255) NOT NULL,
  stakeholder_email VARCHAR(255) NOT NULL,
  stakeholder_title VARCHAR(255),

  -- Availability
  is_active BOOLEAN DEFAULT true,
  availability_status VARCHAR(50) DEFAULT 'available' CHECK (availability_status IN (
    'available', 'busy', 'limited', 'inactive', 'declined'
  )),
  max_calls_per_month INTEGER DEFAULT 2,
  current_month_calls INTEGER DEFAULT 0,

  -- Preferences
  preferred_format VARCHAR(50) DEFAULT 'either' CHECK (preferred_format IN ('phone', 'video', 'either')),
  preferred_duration VARCHAR(50) DEFAULT '30min' CHECK (preferred_duration IN ('15min', '30min', '45min', '60min')),
  topics JSONB DEFAULT '[]'::jsonb, -- Topics they're comfortable discussing
  industries JSONB DEFAULT '[]'::jsonb, -- Industries they prefer to speak with

  -- History
  total_calls_completed INTEGER DEFAULT 0,
  last_call_date TIMESTAMPTZ,
  average_rating NUMERIC(3,2),

  -- Dates
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id, stakeholder_email)
);

-- Indexes for customer references
CREATE INDEX IF NOT EXISTS idx_customer_references_customer ON customer_references(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_references_active ON customer_references(is_active);
CREATE INDEX IF NOT EXISTS idx_customer_references_availability ON customer_references(availability_status);

-- Reference call history
CREATE TABLE IF NOT EXISTS reference_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES customer_references(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Prospect details
  prospect_company VARCHAR(255) NOT NULL,
  prospect_contact_name VARCHAR(255),
  prospect_contact_email VARCHAR(255),
  prospect_industry VARCHAR(100),

  -- Call details
  call_status VARCHAR(50) DEFAULT 'scheduled' CHECK (call_status IN (
    'requested', 'scheduled', 'completed', 'no_show', 'cancelled', 'rescheduled'
  )),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  call_format VARCHAR(50) CHECK (call_format IN ('phone', 'video')),

  -- Feedback
  reference_rating INTEGER CHECK (reference_rating >= 1 AND reference_rating <= 5),
  prospect_rating INTEGER CHECK (prospect_rating >= 1 AND prospect_rating <= 5),
  reference_feedback TEXT,
  prospect_feedback TEXT,

  -- Outcome
  outcome VARCHAR(50), -- 'positive', 'neutral', 'negative', 'deal_won', 'deal_lost'
  deal_influenced BOOLEAN DEFAULT false,
  deal_value NUMERIC(12,2),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reference calls
CREATE INDEX IF NOT EXISTS idx_reference_calls_reference ON reference_calls(reference_id);
CREATE INDEX IF NOT EXISTS idx_reference_calls_customer ON reference_calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_reference_calls_status ON reference_calls(call_status);
CREATE INDEX IF NOT EXISTS idx_reference_calls_scheduled ON reference_calls(scheduled_at);

-- Add last_testimonial_request column to customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'last_testimonial_request'
  ) THEN
    ALTER TABLE customers ADD COLUMN last_testimonial_request TIMESTAMPTZ;
  END IF;
END $$;

-- Add advocacy_status column to customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'advocacy_status'
  ) THEN
    ALTER TABLE customers ADD COLUMN advocacy_status VARCHAR(50) DEFAULT 'none'
      CHECK (advocacy_status IN ('none', 'requested', 'testimonial', 'reference', 'case_study', 'advocate'));
  END IF;
END $$;

-- Index for advocacy queries
CREATE INDEX IF NOT EXISTS idx_customers_last_testimonial ON customers(last_testimonial_request);
CREATE INDEX IF NOT EXISTS idx_customers_advocacy_status ON customers(advocacy_status);

-- Comments on tables
COMMENT ON TABLE testimonial_requests IS 'Tracks all testimonial/feedback requests sent to customers (PRD-037)';
COMMENT ON TABLE customer_testimonials IS 'Stores received testimonials, quotes, and reviews from customers';
COMMENT ON TABLE customer_references IS 'Tracks customers available for reference calls';
COMMENT ON TABLE reference_calls IS 'History of reference calls with prospects';

-- Trigger to update customers.last_testimonial_request
CREATE OR REPLACE FUNCTION update_last_testimonial_request()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers
  SET last_testimonial_request = NEW.sent_at,
      updated_at = NOW()
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_last_testimonial_request ON testimonial_requests;
CREATE TRIGGER trigger_update_last_testimonial_request
  AFTER UPDATE OF sent_at ON testimonial_requests
  FOR EACH ROW
  WHEN (NEW.sent_at IS NOT NULL)
  EXECUTE FUNCTION update_last_testimonial_request();

-- Trigger to update advocacy_status when testimonial received
CREATE OR REPLACE FUNCTION update_advocacy_status_on_testimonial()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers
  SET advocacy_status = CASE
    WHEN NEW.testimonial_type = 'case_study' THEN 'case_study'
    WHEN NEW.testimonial_type = 'reference_available' THEN 'reference'
    ELSE 'testimonial'
  END,
  updated_at = NOW()
  WHERE id = NEW.customer_id
    AND advocacy_status NOT IN ('case_study', 'advocate');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_advocacy_status ON customer_testimonials;
CREATE TRIGGER trigger_update_advocacy_status
  AFTER INSERT ON customer_testimonials
  FOR EACH ROW
  EXECUTE FUNCTION update_advocacy_status_on_testimonial();

-- Function to check request fatigue (prevent over-asking)
CREATE OR REPLACE FUNCTION check_testimonial_request_eligibility(
  p_customer_id UUID,
  p_cooldown_days INTEGER DEFAULT 180
)
RETURNS TABLE (
  eligible BOOLEAN,
  reason TEXT,
  last_request TIMESTAMPTZ,
  pending_requests INTEGER,
  days_since_last INTEGER
) AS $$
DECLARE
  v_last_request TIMESTAMPTZ;
  v_pending INTEGER;
  v_days INTEGER;
BEGIN
  -- Get last request date
  SELECT sent_at INTO v_last_request
  FROM testimonial_requests
  WHERE customer_id = p_customer_id
    AND sent_at IS NOT NULL
  ORDER BY sent_at DESC
  LIMIT 1;

  -- Count pending requests
  SELECT COUNT(*) INTO v_pending
  FROM testimonial_requests
  WHERE customer_id = p_customer_id
    AND request_status IN ('pending', 'sent', 'opened');

  -- Calculate days since last request
  v_days := COALESCE(EXTRACT(DAY FROM (NOW() - v_last_request))::INTEGER, 999);

  -- Return eligibility
  RETURN QUERY SELECT
    (v_days >= p_cooldown_days AND v_pending = 0)::BOOLEAN AS eligible,
    CASE
      WHEN v_pending > 0 THEN 'Pending request exists'
      WHEN v_days < p_cooldown_days THEN 'Cooldown period not elapsed'
      ELSE 'Eligible'
    END AS reason,
    v_last_request AS last_request,
    v_pending AS pending_requests,
    v_days AS days_since_last;
END;
$$ LANGUAGE plpgsql;

-- View for advocacy-ready customers
CREATE OR REPLACE VIEW advocacy_ready_customers AS
SELECT
  c.id,
  c.name,
  c.health_score,
  c.arr,
  c.last_testimonial_request,
  c.advocacy_status,
  COALESCE(EXTRACT(DAY FROM (NOW() - c.last_testimonial_request))::INTEGER, 999) AS days_since_request,
  COALESCE(nps.score, 0) AS latest_nps_score,
  (SELECT COUNT(*) FROM customer_testimonials ct WHERE ct.customer_id = c.id) AS testimonial_count,
  (SELECT COUNT(*) FROM customer_references cr WHERE cr.customer_id = c.id AND cr.is_active = true) AS active_references,
  CASE
    WHEN c.health_score >= 80
      AND COALESCE(nps.score, 0) >= 8
      AND COALESCE(EXTRACT(DAY FROM (NOW() - c.last_testimonial_request))::INTEGER, 999) >= 180
    THEN 'high'
    WHEN c.health_score >= 70
      AND COALESCE(nps.score, 0) >= 7
      AND COALESCE(EXTRACT(DAY FROM (NOW() - c.last_testimonial_request))::INTEGER, 999) >= 120
    THEN 'medium'
    ELSE 'low'
  END AS advocacy_readiness
FROM customers c
LEFT JOIN LATERAL (
  SELECT score
  FROM nps_responses
  WHERE customer_id = c.id
  ORDER BY created_at DESC
  LIMIT 1
) nps ON true
WHERE c.health_score >= 70
  AND c.stage NOT IN ('churned', 'at_risk')
ORDER BY
  c.health_score DESC,
  COALESCE(nps.score, 0) DESC;

COMMENT ON VIEW advocacy_ready_customers IS 'Customers ready for testimonial/reference requests based on health, NPS, and request history';
