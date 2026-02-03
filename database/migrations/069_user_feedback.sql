-- Migration: 069_user_feedback
-- Description: Create user_feedback table for collecting user feedback
-- PRD: Compound Product Launch (CP-006, CP-007)

-- Create feedback type enum
DO $$ BEGIN
  CREATE TYPE feedback_type AS ENUM ('general', 'feature_request', 'bug', 'praise');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- User feedback table
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type feedback_type NOT NULL DEFAULT 'general',
  context TEXT, -- Where in app feedback was given (e.g., '/customers', '/onboarding')
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating, optional
  metadata JSONB DEFAULT '{}', -- Additional context like browser, page state
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE public.user_feedback IS 'Collects user feedback for compound product launch';
COMMENT ON COLUMN public.user_feedback.type IS 'Type of feedback: general, feature_request, bug, or praise';
COMMENT ON COLUMN public.user_feedback.context IS 'Page or feature where feedback was submitted';
COMMENT ON COLUMN public.user_feedback.rating IS 'Optional 1-5 star rating';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON public.user_feedback(type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON public.user_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating ON public.user_feedback(rating) WHERE rating IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert feedback
CREATE POLICY user_feedback_insert ON public.user_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Admins can read all feedback
CREATE POLICY user_feedback_admin_read ON public.user_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Policy: Users can read their own feedback
CREATE POLICY user_feedback_own_read ON public.user_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT ON public.user_feedback TO authenticated;
GRANT SELECT ON public.user_feedback TO service_role;
