-- Migration: 068_analytics_events
-- Description: Create analytics_events table for tracking user behavior and feature engagement
-- PRD: Compound Product Launch (CP-001)

-- Analytics events table for tracking user behavior
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE public.analytics_events IS 'Tracks user behavior and feature engagement for compound product launch analytics';

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON public.analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON public.analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON public.analytics_events(session_id);

-- Composite index for user journey analysis
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_timestamp ON public.analytics_events(user_id, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own events
CREATE POLICY analytics_events_insert_own ON public.analytics_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Admins can read all events
CREATE POLICY analytics_events_admin_read ON public.analytics_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Policy: Users can read their own events
CREATE POLICY analytics_events_own_read ON public.analytics_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT SELECT ON public.analytics_events TO service_role;
