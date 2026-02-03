-- ============================================
-- PRD-034: Check-In Email After Silence
-- Silence tracking and check-in email support
-- ============================================

-- Add silence tracking columns to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS last_meaningful_contact TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS silence_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS silence_severity TEXT DEFAULT 'none' CHECK (silence_severity IN ('none', 'light', 'moderate', 'severe'));

-- Create index for silence queries
CREATE INDEX IF NOT EXISTS idx_customers_silence_days ON public.customers(silence_days);
CREATE INDEX IF NOT EXISTS idx_customers_last_contact ON public.customers(last_meaningful_contact);

-- Table to track check-in attempts and responses
CREATE TABLE IF NOT EXISTS public.check_in_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES public.stakeholders(id),
  check_in_type TEXT NOT NULL CHECK (check_in_type IN ('light', 'concerned', 'value_add')),
  approach TEXT, -- 'value_add', 'industry_news', 'feature_update', etc.
  silence_days_at_attempt INTEGER NOT NULL,
  email_subject TEXT,
  email_sent_at TIMESTAMPTZ,
  email_message_id TEXT, -- Gmail message ID for tracking
  response_received BOOLEAN DEFAULT FALSE,
  response_received_at TIMESTAMPTZ,
  response_sentiment TEXT CHECK (response_sentiment IN ('positive', 'neutral', 'negative', 'unknown')),
  csm_id UUID REFERENCES public.user_profiles(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for check-in tracking
CREATE INDEX IF NOT EXISTS idx_check_in_customer ON public.check_in_attempts(customer_id);
CREATE INDEX IF NOT EXISTS idx_check_in_response ON public.check_in_attempts(response_received);
CREATE INDEX IF NOT EXISTS idx_check_in_created ON public.check_in_attempts(created_at DESC);

-- Enable RLS
ALTER TABLE public.check_in_attempts ENABLE ROW LEVEL SECURITY;

-- Service role policy
CREATE POLICY "Service role full access on check_in_attempts"
  ON public.check_in_attempts
  FOR ALL
  USING (auth.role() = 'service_role');

-- View for silent customers (customers with > 14 days silence)
CREATE OR REPLACE VIEW public.silent_customers AS
SELECT
  c.id,
  c.name,
  c.arr,
  c.health_score,
  c.silence_days,
  c.silence_severity,
  c.last_meaningful_contact,
  c.tier,
  c.csm_id,
  CASE
    WHEN c.silence_days >= 60 THEN 'critical'
    WHEN c.silence_days >= 30 THEN 'high'
    WHEN c.silence_days >= 14 THEN 'medium'
    ELSE 'low'
  END as silence_priority,
  (SELECT COUNT(*) FROM public.check_in_attempts ca WHERE ca.customer_id = c.id) as total_check_in_attempts,
  (SELECT COUNT(*) FROM public.check_in_attempts ca WHERE ca.customer_id = c.id AND ca.response_received = true) as successful_check_ins,
  (SELECT MAX(created_at) FROM public.check_in_attempts ca WHERE ca.customer_id = c.id) as last_check_in_attempt
FROM public.customers c
WHERE c.silence_days > 14
ORDER BY c.silence_days DESC, c.arr DESC;

-- Function to update silence days (call periodically or via trigger)
CREATE OR REPLACE FUNCTION public.update_customer_silence_days()
RETURNS void AS $$
BEGIN
  UPDATE public.customers
  SET
    silence_days = COALESCE(
      EXTRACT(DAY FROM NOW() - last_meaningful_contact)::INTEGER,
      0
    ),
    silence_severity = CASE
      WHEN last_meaningful_contact IS NULL THEN 'none'
      WHEN EXTRACT(DAY FROM NOW() - last_meaningful_contact) >= 60 THEN 'severe'
      WHEN EXTRACT(DAY FROM NOW() - last_meaningful_contact) >= 30 THEN 'moderate'
      WHEN EXTRACT(DAY FROM NOW() - last_meaningful_contact) >= 14 THEN 'light'
      ELSE 'none'
    END,
    updated_at = NOW()
  WHERE last_meaningful_contact IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to record meaningful contact
CREATE OR REPLACE FUNCTION public.record_meaningful_contact(
  p_customer_id UUID,
  p_contact_type TEXT DEFAULT 'email'
)
RETURNS void AS $$
BEGIN
  UPDATE public.customers
  SET
    last_meaningful_contact = NOW(),
    silence_days = 0,
    silence_severity = 'none',
    updated_at = NOW()
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-update trigger for check_in_attempts
CREATE TRIGGER update_check_in_attempts_updated_at
  BEFORE UPDATE ON public.check_in_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Grant permissions
GRANT ALL ON public.check_in_attempts TO anon, authenticated, service_role;
GRANT ALL ON public.silent_customers TO anon, authenticated, service_role;

-- Insert feature flag for check-in emails
INSERT INTO public.feature_flags (key, name, description, enabled, rollout_percentage)
VALUES (
  'check_in_emails',
  'Check-In Emails After Silence',
  'PRD-034: Generate thoughtful check-in emails for silent customers',
  true,
  100
)
ON CONFLICT (key) DO NOTHING;
