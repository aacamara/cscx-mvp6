-- PRD: Email Integration
-- Create emails table for Gmail sync
-- Create email_sync_status table for tracking sync state

-- emails table: stores synced Gmail messages
CREATE TABLE IF NOT EXISTS public.emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  gmail_id text NOT NULL,
  thread_id text NOT NULL,
  subject text,
  from_email text NOT NULL,
  from_name text,
  to_emails text[] DEFAULT '{}',
  cc_emails text[] DEFAULT '{}',
  bcc_emails text[] DEFAULT '{}',
  date timestamptz NOT NULL,
  body_text text,
  body_html text,
  snippet text,
  labels text[] DEFAULT '{}',
  is_read boolean DEFAULT true,
  is_important boolean DEFAULT false,
  is_starred boolean DEFAULT false,
  has_attachments boolean DEFAULT false,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  matched_by text,
  match_confidence float,
  summary text,
  key_points jsonb,
  action_items jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, gmail_id)
);

-- email_sync_status table: tracks sync state per user
CREATE TABLE IF NOT EXISTS public.email_sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  connected boolean DEFAULT false,
  last_sync_at timestamptz,
  last_sync_success boolean,
  last_sync_error text,
  emails_synced integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for emails table
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_customer_id ON public.emails(customer_id);
CREATE INDEX IF NOT EXISTS idx_emails_date ON public.emails(date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON public.emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_from_email ON public.emails(from_email);
CREATE INDEX IF NOT EXISTS idx_emails_is_read ON public.emails(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_emails_is_important ON public.emails(is_important) WHERE is_important = true;

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_emails_fts ON public.emails USING gin(
  to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body_text, ''))
);

-- Enable RLS
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for emails
CREATE POLICY "Users can view their own emails"
  ON public.emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own emails"
  ON public.emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own emails"
  ON public.emails FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own emails"
  ON public.emails FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for email_sync_status
CREATE POLICY "Users can view their own sync status"
  ON public.email_sync_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own sync status"
  ON public.email_sync_status FOR ALL
  USING (auth.uid() = user_id);

-- Function for full-text search
CREATE OR REPLACE FUNCTION search_emails(
  p_user_id uuid,
  p_query text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(id uuid, rank real) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, ts_rank(
    to_tsvector('english', coalesce(e.subject, '') || ' ' || coalesce(e.body_text, '')),
    plainto_tsquery('english', p_query)
  ) AS rank
  FROM public.emails e
  WHERE e.user_id = p_user_id
    AND to_tsvector('english', coalesce(e.subject, '') || ' ' || coalesce(e.body_text, ''))
        @@ plainto_tsquery('english', p_query)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.emails IS 'Gmail emails synced for CSMs';
COMMENT ON TABLE public.email_sync_status IS 'Email sync status per user';
