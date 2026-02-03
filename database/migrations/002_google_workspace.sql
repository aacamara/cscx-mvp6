-- CSCX.AI Google Workspace Integration Migration
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,

  -- Organization (for future multi-tenant)
  organization_id UUID,
  role TEXT DEFAULT 'csm', -- 'csm', 'manager', 'admin'

  -- Preferences
  preferences JSONB DEFAULT '{}',
  timezone TEXT DEFAULT 'America/New_York',

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GOOGLE OAUTH TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Tokens (encrypted at application level)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,

  -- Scopes granted
  granted_scopes TEXT[] NOT NULL DEFAULT '{}',

  -- Google account info
  google_email TEXT NOT NULL,
  google_user_id TEXT NOT NULL,
  google_picture_url TEXT,

  -- Status
  is_valid BOOLEAN DEFAULT true,
  last_refresh_at TIMESTAMPTZ,
  last_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================
-- GMAIL THREADS
-- ============================================================
CREATE TABLE IF NOT EXISTS gmail_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Gmail identifiers
  gmail_thread_id TEXT NOT NULL,
  gmail_history_id TEXT,

  -- Thread data
  subject TEXT,
  snippet TEXT,
  participants TEXT[] DEFAULT '{}',
  labels TEXT[] DEFAULT '{}',

  -- Analysis (AI-generated)
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  action_items JSONB DEFAULT '[]',
  requires_response BOOLEAN DEFAULT false,
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
  summary TEXT,

  -- Metadata
  message_count INTEGER DEFAULT 0,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  is_unread BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,

  -- Sync tracking
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, gmail_thread_id)
);

-- Gmail messages (individual messages in threads)
CREATE TABLE IF NOT EXISTS gmail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES gmail_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Gmail identifiers
  gmail_message_id TEXT NOT NULL,

  -- Message data
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[] DEFAULT '{}',
  cc_emails TEXT[] DEFAULT '{}',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,

  -- Metadata
  sent_at TIMESTAMPTZ NOT NULL,
  is_inbound BOOLEAN NOT NULL, -- true = customer sent, false = CSM sent
  has_attachments BOOLEAN DEFAULT false,
  attachment_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, gmail_message_id)
);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Google identifiers
  google_event_id TEXT NOT NULL,
  google_calendar_id TEXT NOT NULL DEFAULT 'primary',

  -- Event data
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT,
  is_all_day BOOLEAN DEFAULT false,

  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,

  -- Attendees
  attendees JSONB DEFAULT '[]',
  organizer_email TEXT,
  response_status TEXT, -- 'accepted', 'declined', 'tentative', 'needsAction'

  -- Meeting link
  meet_link TEXT,
  conference_id TEXT,

  -- AI-generated content
  meeting_type TEXT CHECK (meeting_type IN ('kickoff', 'check_in', 'qbr', 'training', 'escalation', 'internal', 'other')),
  prep_brief JSONB,           -- Generated 24h before
  prep_generated_at TIMESTAMPTZ,
  summary JSONB,              -- Generated after meeting
  action_items JSONB DEFAULT '[]',

  -- Recording (if available via Meet)
  recording_url TEXT,
  transcript TEXT,

  -- Status
  status TEXT DEFAULT 'confirmed', -- 'confirmed', 'tentative', 'cancelled'

  -- Sync tracking
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, google_event_id)
);

-- ============================================================
-- DRIVE FILES
-- ============================================================
CREATE TABLE IF NOT EXISTS drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Google identifiers
  google_file_id TEXT NOT NULL,
  google_folder_id TEXT,

  -- File data
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  web_view_link TEXT,
  web_content_link TEXT,
  icon_link TEXT,
  thumbnail_link TEXT,

  -- Classification
  file_type TEXT CHECK (file_type IN ('doc', 'sheet', 'slide', 'pdf', 'image', 'video', 'other')),
  category TEXT CHECK (category IN ('contract', 'success_plan', 'qbr', 'meeting_notes', 'proposal', 'report', 'other')),

  -- Indexing for RAG
  is_indexed BOOLEAN DEFAULT false,
  indexed_at TIMESTAMPTZ,
  chunk_count INTEGER DEFAULT 0,

  -- Metadata
  size_bytes BIGINT,
  created_time TIMESTAMPTZ,
  modified_time TIMESTAMPTZ,
  last_modifying_user TEXT,

  -- Ownership
  owner_email TEXT,
  shared_with TEXT[] DEFAULT '{}',

  -- Sync tracking
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, google_file_id)
);

-- ============================================================
-- GOOGLE TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS google_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Google identifiers
  google_task_id TEXT NOT NULL,
  google_tasklist_id TEXT NOT NULL,

  -- Task data
  title TEXT NOT NULL,
  notes TEXT,
  due_date DATE,
  status TEXT DEFAULT 'needsAction' CHECK (status IN ('needsAction', 'completed')),
  completed_at TIMESTAMPTZ,

  -- CSCX metadata
  task_type TEXT CHECK (task_type IN ('follow_up', 'onboarding', 'renewal', 'health_check', 'meeting_prep', 'other')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  source TEXT CHECK (source IN ('agent', 'user', 'email', 'meeting', 'system')),

  -- Sync tracking
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, google_task_id)
);

-- ============================================================
-- KNOWLEDGE BASE - DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Classification
  layer TEXT NOT NULL CHECK (layer IN ('universal', 'company', 'customer')),
  category TEXT NOT NULL,

  -- Content
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'gdrive', 'url', 'email', 'system')),
  source_url TEXT,
  source_id TEXT, -- e.g., google_file_id
  content TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'indexed', 'failed')),
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  word_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- KNOWLEDGE BASE - CHUNKS (for RAG)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,

  -- Content
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL,

  -- Vector embedding (768 dimensions for Gemini)
  embedding vector(768),

  -- Metadata for retrieval
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- CSM PLAYBOOKS (pre-seeded best practices)
-- ============================================================
CREATE TABLE IF NOT EXISTS csm_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  category TEXT NOT NULL,
  subcategory TEXT,

  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,

  -- Use cases and tags
  use_cases TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- Vector embedding for search
  embedding vector(768),

  -- Metadata
  source TEXT, -- 'internal', 'gainsight', 'totango', etc.
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,

  -- Template info
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('onboarding', 'check_in', 'qbr', 'renewal', 'escalation', 'follow_up', 'introduction', 'other')),

  -- Template content
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}', -- ['customer_name', 'product', etc.]

  -- Performance tracking
  times_used INTEGER DEFAULT 0,
  avg_response_rate DECIMAL(5,2),
  avg_sentiment_score DECIMAL(3,2),

  -- Sharing
  is_shared BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AGENT EXECUTIONS (enhanced)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Agent info
  agent_type TEXT NOT NULL,
  agent_version TEXT DEFAULT '1.0',

  -- Trigger
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('user', 'schedule', 'event', 'webhook')),
  trigger_data JSONB DEFAULT '{}',

  -- Execution
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'awaiting_approval')),

  -- Plan and actions
  plan JSONB,
  actions_taken JSONB[] DEFAULT '{}',

  -- HITL (Human in the Loop)
  requires_approval BOOLEAN DEFAULT false,
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected', 'modified')),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,

  -- Output
  output JSONB,
  error TEXT,

  -- Metrics
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPROVAL QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES agent_executions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Action details
  action_type TEXT NOT NULL CHECK (action_type IN ('send_email', 'schedule_meeting', 'create_task', 'share_document', 'other')),
  action_data JSONB NOT NULL,

  -- Content for review
  original_content TEXT,
  modified_content TEXT,

  -- Review
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified', 'expired')),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,

  -- Expiration
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FEEDBACK EVENTS (for learning)
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES agent_executions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- What was evaluated
  content_type TEXT NOT NULL CHECK (content_type IN ('email_draft', 'meeting_brief', 'task', 'document', 'response')),

  -- Feedback
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('approved', 'edited', 'rejected', 'rated')),
  original_output TEXT,
  modified_output TEXT,
  edit_distance INTEGER, -- Levenshtein distance
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),

  -- Outcome tracking (filled later)
  outcome_tracked BOOLEAN DEFAULT false,
  outcome_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_events ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own oauth tokens" ON google_oauth_tokens FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own gmail threads" ON gmail_threads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own gmail messages" ON gmail_messages FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own calendar events" ON calendar_events FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own drive files" ON drive_files FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tasks" ON google_tasks FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view universal and own knowledge" ON knowledge_documents
  FOR SELECT USING (layer = 'universal' OR auth.uid() = user_id);
CREATE POLICY "Users can manage own knowledge" ON knowledge_documents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view chunks of accessible docs" ON knowledge_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM knowledge_documents
      WHERE knowledge_documents.id = knowledge_chunks.document_id
      AND (knowledge_documents.layer = 'universal' OR knowledge_documents.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own templates" ON email_templates FOR ALL USING (auth.uid() = user_id OR is_shared = true);

CREATE POLICY "Users can view own executions" ON agent_executions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own approvals" ON approval_queue FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own feedback" ON feedback_events FOR ALL USING (auth.uid() = user_id);

-- CSM Playbooks are readable by all authenticated users
ALTER TABLE csm_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users can view playbooks" ON csm_playbooks FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Gmail
CREATE INDEX IF NOT EXISTS idx_gmail_threads_user ON gmail_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_threads_customer ON gmail_threads(customer_id);
CREATE INDEX IF NOT EXISTS idx_gmail_threads_last_message ON gmail_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_thread ON gmail_messages(thread_id);

-- Calendar
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer ON calendar_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);

-- Drive
CREATE INDEX IF NOT EXISTS idx_drive_files_user ON drive_files(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_customer ON drive_files(customer_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_folder ON drive_files(google_folder_id);

-- Knowledge
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_user ON knowledge_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_layer ON knowledge_documents(layer);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(document_id);

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_gmail_threads_subject_trgm ON gmail_threads USING gin(subject gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_title_trgm ON knowledge_documents USING gin(title gin_trgm_ops);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to search knowledge base with vector similarity
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_layer text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  document_title text,
  document_layer text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity,
    kd.title as document_title,
    kd.layer as document_layer
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE
    1 - (kc.embedding <=> query_embedding) > match_threshold
    AND kd.status = 'indexed'
    AND (filter_layer IS NULL OR kd.layer = filter_layer)
    AND (filter_user_id IS NULL OR kd.user_id = filter_user_id OR kd.layer = 'universal')
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get customer context
CREATE OR REPLACE FUNCTION get_customer_context(p_customer_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'customer', (SELECT row_to_json(c) FROM customers c WHERE c.id = p_customer_id),
    'recent_emails', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT subject, snippet, sentiment, last_message_at
        FROM gmail_threads
        WHERE customer_id = p_customer_id AND user_id = p_user_id
        ORDER BY last_message_at DESC
        LIMIT 5
      ) t
    ),
    'upcoming_meetings', (
      SELECT jsonb_agg(row_to_json(e))
      FROM (
        SELECT title, start_time, meeting_type, attendees
        FROM calendar_events
        WHERE customer_id = p_customer_id AND user_id = p_user_id AND start_time > NOW()
        ORDER BY start_time
        LIMIT 5
      ) e
    ),
    'recent_documents', (
      SELECT jsonb_agg(row_to_json(d))
      FROM (
        SELECT name, category, modified_time, web_view_link
        FROM drive_files
        WHERE customer_id = p_customer_id AND user_id = p_user_id
        ORDER BY modified_time DESC
        LIMIT 5
      ) d
    ),
    'open_tasks', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT title, due_date, priority, task_type
        FROM google_tasks
        WHERE customer_id = p_customer_id AND user_id = p_user_id AND status = 'needsAction'
        ORDER BY due_date
        LIMIT 10
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_google_oauth_tokens_updated_at ON google_oauth_tokens;
CREATE TRIGGER update_google_oauth_tokens_updated_at BEFORE UPDATE ON google_oauth_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_gmail_threads_updated_at ON gmail_threads;
CREATE TRIGGER update_gmail_threads_updated_at BEFORE UPDATE ON gmail_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_drive_files_updated_at ON drive_files;
CREATE TRIGGER update_drive_files_updated_at BEFORE UPDATE ON drive_files FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED CSM PLAYBOOKS (sample)
-- ============================================================
INSERT INTO csm_playbooks (category, subcategory, title, content, use_cases, tags) VALUES
(
  'onboarding',
  'kickoff',
  'Customer Kickoff Meeting Best Practices',
  E'# Customer Kickoff Meeting Framework\n\n## Pre-Meeting Preparation\n1. Review contract and entitlements\n2. Research company background\n3. Identify stakeholders and their roles\n4. Prepare agenda and share in advance\n5. Set up technical environment\n\n## Meeting Structure (60 minutes)\n\n### Opening (5 min)\n- Introductions\n- Meeting objectives\n- Agenda review\n\n### Discovery (15 min)\n- Business objectives and success criteria\n- Current challenges and pain points\n- Previous solution experience\n- Timeline expectations\n\n### Solution Overview (15 min)\n- High-level product walkthrough\n- Map features to their objectives\n- Integration possibilities\n\n### Implementation Planning (15 min)\n- Onboarding phases and milestones\n- Resource requirements\n- Training plan\n- Communication cadence\n\n### Next Steps (10 min)\n- Immediate action items\n- Schedule follow-up meetings\n- Assign owners to tasks\n- Share documentation\n\n## Post-Meeting\n1. Send summary email within 24 hours\n2. Create success plan document\n3. Set up project tracking\n4. Schedule training sessions',
  ARRAY['First customer meeting', 'New customer onboarding', 'Implementation kickoff'],
  ARRAY['onboarding', 'kickoff', 'meeting', 'best-practice']
),
(
  'health',
  'risk-detection',
  'Customer Health Risk Indicators',
  E'# Customer Health Risk Detection\n\n## Red Flag Indicators\n\n### Engagement Signals\n- No login activity for 14+ days\n- Declined meeting invitations\n- Delayed email responses (5+ days)\n- Reduced stakeholder participation\n- Champion goes silent\n\n### Usage Signals\n- Usage drop >30% month-over-month\n- Key features not adopted\n- Support tickets increasing\n- Integration disconnected\n\n### Business Signals\n- Budget cuts announced\n- Key stakeholder departure\n- Merger/acquisition news\n- Competitor mentions\n- Delayed payments\n\n## Response Playbook\n\n### Low Risk (Score 70-80)\n- Increase touchpoint frequency\n- Share relevant content/tips\n- Offer training refresh\n\n### Medium Risk (Score 50-70)\n- Executive check-in call\n- Business value review\n- Success plan reassessment\n- Identify new champions\n\n### High Risk (Score <50)\n- Immediate escalation to manager\n- Executive sponsor engagement\n- Rescue plan creation\n- Consider concessions if needed\n\n## Recovery Strategies\n1. Re-establish value proposition\n2. Address specific concerns\n3. Create quick wins\n4. Rebuild relationships\n5. Document learnings',
  ARRAY['At-risk customer', 'Churn prevention', 'Health monitoring', 'Risk assessment'],
  ARRAY['health', 'risk', 'churn', 'playbook']
),
(
  'communication',
  'email-templates',
  'Check-in Email Templates',
  E'# Customer Check-in Email Templates\n\n## Monthly Check-in\n\nSubject: Monthly Sync - {customer_name} & {company_name}\n\nHi {first_name},\n\nI hope this message finds you well! I wanted to reach out for our monthly check-in.\n\n**Quick Updates:**\n- [Recent product updates relevant to them]\n- [Any action items from previous conversations]\n\n**Questions for You:**\n1. How is the team finding [specific feature]?\n2. Any challenges or roadblocks I can help with?\n3. Upcoming initiatives where we can support?\n\nWould you have 20 minutes this week for a quick sync? Here are some times that work:\n[Calendar link]\n\nBest,\n{csm_name}\n\n---\n\n## Quarterly Business Review Invitation\n\nSubject: Q{quarter} Business Review - Let''s Celebrate Your Success!\n\nHi {first_name},\n\nAs we wrap up Q{quarter}, I''d love to schedule our Quarterly Business Review to:\n\n✅ Celebrate wins and progress\n📊 Review key metrics and ROI\n🎯 Align on Q{next_quarter} goals\n🚀 Preview upcoming features\n\nI''ve put together some initial insights showing [teaser of positive metrics].\n\nCould we schedule 45 minutes in the next two weeks? I''d recommend including {stakeholder_names} as well.\n\n[Calendar link]\n\nLooking forward to it!\n{csm_name}\n\n---\n\n## Re-engagement (Silent Customer)\n\nSubject: Checking In - Here to Help!\n\nHi {first_name},\n\nI noticed it''s been a few weeks since we last connected, and I wanted to reach out.\n\nIs everything going smoothly with {product}? I''m here to help with:\n\n- Any questions or challenges\n- Training for new team members\n- Optimization recommendations\n- Upcoming feature previews\n\nNo pressure - just want to make sure you''re getting maximum value.\n\nWould a quick 15-minute call be helpful?\n\nBest,\n{csm_name}\n\nP.S. If there''s a better person for me to connect with, please let me know!',
  ARRAY['Customer communication', 'Check-in emails', 'QBR invitation', 'Re-engagement'],
  ARRAY['email', 'template', 'communication', 'check-in', 'qbr']
),
(
  'renewal',
  'strategy',
  'Renewal Conversation Framework',
  E'# Renewal Conversation Framework\n\n## Timeline\n\n| Days Before | Action |\n|-------------|--------|\n| 120 days | Internal review, risk assessment |\n| 90 days | Customer value review meeting |\n| 60 days | Renewal proposal presentation |\n| 30 days | Negotiation and finalization |\n| 14 days | Contract execution |\n| 0 days | Renewal complete |\n\n## Pre-Renewal Analysis\n\n### Value Delivered\n- Calculate ROI and time saved\n- Document success stories\n- Gather usage metrics\n- Collect testimonials\n\n### Risk Assessment\n- Budget situation\n- Stakeholder changes\n- Competitive threats\n- Unresolved issues\n\n## Renewal Meeting Agenda\n\n### Part 1: Value Review (20 min)\n- Journey recap\n- Success metrics\n- ROI demonstration\n- Customer testimonials\n\n### Part 2: Future Vision (15 min)\n- Upcoming product roadmap\n- Expansion opportunities\n- Additional use cases\n- Industry trends\n\n### Part 3: Renewal Discussion (20 min)\n- Pricing review\n- Contract terms\n- Multi-year options\n- Expansion conversation\n\n### Part 4: Next Steps (5 min)\n- Timeline agreement\n- Required approvals\n- Follow-up actions\n\n## Objection Handling\n\n### "Budget is tight"\n- Emphasize ROI and cost avoidance\n- Offer payment flexibility\n- Propose scaled-down option\n- Connect with executive sponsor\n\n### "We''re looking at competitors"\n- Request fair evaluation opportunity\n- Highlight switching costs\n- Offer competitive analysis\n- Propose enhanced terms\n\n### "Key stakeholder left"\n- Build relationships with new contacts\n- Re-demonstrate value\n- Offer fresh training\n- Create new champions',
  ARRAY['Renewal preparation', 'Contract renewal', 'Retention strategy', 'Negotiation'],
  ARRAY['renewal', 'retention', 'negotiation', 'strategy']
),
(
  'expansion',
  'upsell',
  'Expansion Opportunity Identification',
  E'# Expansion & Upsell Framework\n\n## Opportunity Signals\n\n### Usage-Based Signals\n- Approaching license/usage limits\n- High adoption of core features\n- Requests for advanced features\n- Multiple department usage\n\n### Business Signals\n- Company growth (funding, hiring)\n- New initiatives announced\n- Positive ROI demonstrated\n- Executive sponsorship strong\n\n### Relationship Signals\n- High NPS/CSAT scores\n- Customer referrals given\n- Case study participation\n- Speaking at events\n\n## Expansion Playbook\n\n### Step 1: Discovery\n- Map current usage vs. entitlements\n- Identify unused capabilities\n- Understand growth plans\n- Find new use cases\n\n### Step 2: Value Proposition\n- Build business case\n- Calculate projected ROI\n- Reference similar customers\n- Prepare demo/trial\n\n### Step 3: Stakeholder Alignment\n- Identify economic buyer\n- Build champion support\n- Address objections early\n- Create urgency\n\n### Step 4: Proposal\n- Clear pricing structure\n- Implementation timeline\n- Success metrics\n- Risk mitigation\n\n## Expansion Conversation Starters\n\n- "I noticed your team has grown significantly. Have you considered adding more licenses?"\n- "You''re getting great results with [feature]. Have you explored [advanced feature]?"\n- "Other customers in your industry are seeing great results with [product]. Would you like to learn more?"\n- "Based on your Q{quarter} goals, [solution] could help accelerate [outcome]."',
  ARRAY['Upsell opportunity', 'Account expansion', 'Growth strategy', 'Revenue growth'],
  ARRAY['expansion', 'upsell', 'growth', 'revenue']
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- GRANT PERMISSIONS FOR SERVICE ROLE
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
