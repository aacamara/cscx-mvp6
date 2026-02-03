-- ============================================
-- PRD-035: Thank You Note Generator
-- Thank you note tracking and personalization
-- ============================================

-- Create thank_you_log table to track sent thank you notes
CREATE TABLE IF NOT EXISTS public.thank_you_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES public.stakeholders(id) ON DELETE SET NULL,

  -- Thank you occasion details
  occasion TEXT NOT NULL CHECK (occasion IN (
    'referral',
    'case_study',
    'positive_feedback',
    'renewal',
    'onboarding_complete',
    'speaking_event',
    'product_feedback',
    'general'
  )),
  occasion_details JSONB DEFAULT '{}', -- Specific details about what they're being thanked for

  -- Email details
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_preview TEXT, -- First 500 chars of email body
  email_message_id TEXT, -- Gmail message ID for tracking

  -- Appreciation gesture
  gesture_offered TEXT, -- 'early_access', 'gift_card', 'charity_donation', 'swag', etc.
  gesture_accepted BOOLEAN,
  gesture_details JSONB DEFAULT '{}',

  -- Tracking
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  csm_id UUID REFERENCES public.user_profiles(id),

  -- Response tracking
  response_received BOOLEAN DEFAULT FALSE,
  response_received_at TIMESTAMPTZ,
  response_sentiment TEXT CHECK (response_sentiment IN ('positive', 'neutral', 'negative')),

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_thank_you_customer ON public.thank_you_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_thank_you_stakeholder ON public.thank_you_log(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_thank_you_occasion ON public.thank_you_log(occasion);
CREATE INDEX IF NOT EXISTS idx_thank_you_sent_at ON public.thank_you_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_thank_you_csm ON public.thank_you_log(csm_id);

-- Composite index for checking recent thank yous
CREATE INDEX IF NOT EXISTS idx_thank_you_customer_recent
  ON public.thank_you_log(customer_id, stakeholder_id, sent_at DESC);

-- Enable RLS
ALTER TABLE public.thank_you_log ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "Service role full access on thank_you_log"
  ON public.thank_you_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update trigger
CREATE TRIGGER update_thank_you_log_updated_at
  BEFORE UPDATE ON public.thank_you_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- View for recent thank you activity
CREATE OR REPLACE VIEW public.thank_you_summary AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  c.arr,
  c.health_score,
  COUNT(tyl.id) as total_thank_yous,
  MAX(tyl.sent_at) as last_thank_you_at,
  EXTRACT(DAY FROM NOW() - MAX(tyl.sent_at))::INTEGER as days_since_last_thank_you,
  (
    SELECT ARRAY_AGG(DISTINCT occasion)
    FROM public.thank_you_log
    WHERE customer_id = c.id
    AND sent_at > NOW() - INTERVAL '90 days'
  ) as recent_occasions,
  COUNT(CASE WHEN tyl.sent_at > NOW() - INTERVAL '30 days' THEN 1 END) as thank_yous_last_30_days,
  COUNT(CASE WHEN tyl.response_received = true THEN 1 END) as responses_received
FROM public.customers c
LEFT JOIN public.thank_you_log tyl ON tyl.customer_id = c.id
GROUP BY c.id, c.name, c.arr, c.health_score;

-- Function to check if we should throttle thank yous
CREATE OR REPLACE FUNCTION public.should_throttle_thank_you(
  p_customer_id UUID,
  p_stakeholder_id UUID DEFAULT NULL,
  p_occasion TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_last_thank_you TIMESTAMPTZ;
  v_thank_yous_30_days INTEGER;
  v_same_occasion_recent INTEGER;
  v_result JSONB;
BEGIN
  -- Check last thank you to this stakeholder
  SELECT MAX(sent_at) INTO v_last_thank_you
  FROM public.thank_you_log
  WHERE customer_id = p_customer_id
    AND (p_stakeholder_id IS NULL OR stakeholder_id = p_stakeholder_id);

  -- Count thank yous in last 30 days
  SELECT COUNT(*) INTO v_thank_yous_30_days
  FROM public.thank_you_log
  WHERE customer_id = p_customer_id
    AND (p_stakeholder_id IS NULL OR stakeholder_id = p_stakeholder_id)
    AND sent_at > NOW() - INTERVAL '30 days';

  -- Count same occasion in last 60 days
  SELECT COUNT(*) INTO v_same_occasion_recent
  FROM public.thank_you_log
  WHERE customer_id = p_customer_id
    AND (p_stakeholder_id IS NULL OR stakeholder_id = p_stakeholder_id)
    AND occasion = p_occasion
    AND sent_at > NOW() - INTERVAL '60 days';

  -- Build result
  v_result = jsonb_build_object(
    'should_throttle',
    CASE
      -- Throttle if sent thank you to same person in last 7 days
      WHEN v_last_thank_you > NOW() - INTERVAL '7 days' THEN true
      -- Throttle if more than 3 thank yous in 30 days
      WHEN v_thank_yous_30_days >= 3 THEN true
      -- Throttle if same occasion already thanked in 60 days
      WHEN v_same_occasion_recent > 0 THEN true
      ELSE false
    END,
    'reason',
    CASE
      WHEN v_last_thank_you > NOW() - INTERVAL '7 days' THEN 'recent_thank_you'
      WHEN v_thank_yous_30_days >= 3 THEN 'too_many_recent'
      WHEN v_same_occasion_recent > 0 THEN 'same_occasion_recent'
      ELSE NULL
    END,
    'last_thank_you_at', v_last_thank_you,
    'thank_yous_last_30_days', v_thank_yous_30_days,
    'same_occasion_recent', v_same_occasion_recent,
    'days_since_last', EXTRACT(DAY FROM NOW() - v_last_thank_you)::INTEGER
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON public.thank_you_log TO anon, authenticated, service_role;
GRANT ALL ON public.thank_you_summary TO anon, authenticated, service_role;

-- Insert feature flag for thank you notes
INSERT INTO public.feature_flags (key, name, description, enabled, rollout_percentage)
VALUES (
  'thank_you_notes',
  'Thank You Note Generator',
  'PRD-035: Generate personalized thank you notes for customer contributions',
  true,
  100
)
ON CONFLICT (key) DO NOTHING;
