-- Migration: 045_notion_documentation_sync
-- PRD-203: Notion Documentation Sync
-- Created: 2026-01-30
--
-- This migration creates tables for storing Notion documentation data
-- including pages, embeddings, and customer linkings.

-- ============================================
-- NOTION PAGES TABLE
-- Stores synced Notion pages linked to customers
-- ============================================
CREATE TABLE IF NOT EXISTS notion_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id TEXT,

  -- Page metadata
  title TEXT NOT NULL,
  content_markdown TEXT,
  page_url TEXT NOT NULL,
  icon TEXT,
  cover TEXT,

  -- Parent information
  parent_type TEXT CHECK (parent_type IN ('database', 'page', 'workspace')),
  parent_id TEXT,

  -- Timestamps from Notion
  last_edited_at TIMESTAMPTZ,
  last_edited_by TEXT,

  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT CHECK (sync_status IN ('synced', 'pending', 'failed')) DEFAULT 'synced',

  -- Properties from Notion (stored as JSONB for flexibility)
  properties JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying by customer
CREATE INDEX IF NOT EXISTS idx_notion_pages_customer
  ON notion_pages(customer_id);

-- Index for querying by Notion page ID
CREATE INDEX IF NOT EXISTS idx_notion_pages_notion_id
  ON notion_pages(notion_page_id);

-- Index for full-text search on title and content
CREATE INDEX IF NOT EXISTS idx_notion_pages_search
  ON notion_pages USING gin(to_tsvector('english', title || ' ' || COALESCE(content_markdown, '')));

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_notion_pages_user
  ON notion_pages(user_id);

-- ============================================
-- NOTION EMBEDDINGS TABLE
-- Stores vector embeddings for semantic search (FR-6)
-- ============================================
CREATE TABLE IF NOT EXISTS notion_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT NOT NULL REFERENCES notion_pages(notion_page_id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,

  -- Vector embedding (1536 dimensions for OpenAI ada-002)
  embedding VECTOR(1536),

  -- Metadata for the chunk
  heading TEXT,
  start_offset INTEGER,
  end_offset INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique chunks per page
  UNIQUE(notion_page_id, chunk_index)
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_notion_embeddings_vector
  ON notion_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for page lookup
CREATE INDEX IF NOT EXISTS idx_notion_embeddings_page
  ON notion_embeddings(notion_page_id);

-- ============================================
-- NOTION DATABASES TABLE
-- Stores accessible Notion databases for mapping
-- ============================================
CREATE TABLE IF NOT EXISTS notion_databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_database_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  url TEXT,

  -- Database schema (properties)
  properties JSONB,

  -- Configuration for customer mapping
  customer_property_name TEXT,
  is_enabled BOOLEAN DEFAULT true,

  -- Timestamps
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_notion_databases_user
  ON notion_databases(user_id);

-- ============================================
-- NOTION SYNC LOG TABLE
-- Tracks sync operations history
-- ============================================
CREATE TABLE IF NOT EXISTS notion_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  integration_id UUID,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Sync details
  object_type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'pull',
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),

  -- Results
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for querying sync logs by user
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_user
  ON notion_sync_log(user_id, started_at DESC);

-- Index for querying by customer
CREATE INDEX IF NOT EXISTS idx_notion_sync_log_customer
  ON notion_sync_log(customer_id);

-- ============================================
-- NOTION PAGE TEMPLATES TABLE
-- Stores custom templates for page creation
-- ============================================
CREATE TABLE IF NOT EXISTS notion_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('success_plan', 'meeting_notes', 'project_brief', 'custom')),
  description TEXT,

  -- Template configuration
  database_id TEXT,
  default_properties JSONB DEFAULT '{}',
  content_blocks JSONB NOT NULL DEFAULT '[]',

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user templates
CREATE INDEX IF NOT EXISTS idx_notion_templates_user
  ON notion_templates(user_id);

-- ============================================
-- UPDATE INTEGRATION_CONNECTIONS FOR NOTION
-- ============================================
DO $$
BEGIN
  -- Add workspace_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN workspace_id TEXT;
  END IF;

  -- Add workspace_name column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'workspace_name'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN workspace_name TEXT;
  END IF;

  -- Add bot_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_connections' AND column_name = 'bot_id'
  ) THEN
    ALTER TABLE integration_connections ADD COLUMN bot_id TEXT;
  END IF;
END $$;

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_notion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS notion_pages_updated_at ON notion_pages;
CREATE TRIGGER notion_pages_updated_at
  BEFORE UPDATE ON notion_pages
  FOR EACH ROW EXECUTE FUNCTION update_notion_updated_at();

DROP TRIGGER IF EXISTS notion_embeddings_updated_at ON notion_embeddings;
CREATE TRIGGER notion_embeddings_updated_at
  BEFORE UPDATE ON notion_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_notion_updated_at();

DROP TRIGGER IF EXISTS notion_databases_updated_at ON notion_databases;
CREATE TRIGGER notion_databases_updated_at
  BEFORE UPDATE ON notion_databases
  FOR EACH ROW EXECUTE FUNCTION update_notion_updated_at();

DROP TRIGGER IF EXISTS notion_templates_updated_at ON notion_templates;
CREATE TRIGGER notion_templates_updated_at
  BEFORE UPDATE ON notion_templates
  FOR EACH ROW EXECUTE FUNCTION update_notion_updated_at();

-- ============================================
-- SEMANTIC SEARCH FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION search_notion_pages(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  customer_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  page_id UUID,
  notion_page_id TEXT,
  title TEXT,
  page_url TEXT,
  chunk_text TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    np.id AS page_id,
    np.notion_page_id,
    np.title,
    np.page_url,
    ne.chunk_text,
    1 - (ne.embedding <=> query_embedding) AS similarity
  FROM notion_embeddings ne
  JOIN notion_pages np ON ne.notion_page_id = np.notion_page_id
  WHERE 1 - (ne.embedding <=> query_embedding) > match_threshold
    AND (customer_filter IS NULL OR np.customer_id = customer_filter)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FULL-TEXT SEARCH FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION search_notion_pages_text(
  search_query TEXT,
  customer_filter UUID DEFAULT NULL,
  match_limit INT DEFAULT 20
)
RETURNS TABLE (
  page_id UUID,
  notion_page_id TEXT,
  title TEXT,
  page_url TEXT,
  content_snippet TEXT,
  rank FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    np.id AS page_id,
    np.notion_page_id,
    np.title,
    np.page_url,
    ts_headline('english', np.content_markdown, plainto_tsquery('english', search_query),
      'MaxWords=50, MinWords=25, StartSel=<mark>, StopSel=</mark>') AS content_snippet,
    ts_rank(to_tsvector('english', np.title || ' ' || COALESCE(np.content_markdown, '')),
      plainto_tsquery('english', search_query)) AS rank
  FROM notion_pages np
  WHERE to_tsvector('english', np.title || ' ' || COALESCE(np.content_markdown, ''))
    @@ plainto_tsquery('english', search_query)
    AND (customer_filter IS NULL OR np.customer_id = customer_filter)
  ORDER BY rank DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all Notion tables
ALTER TABLE notion_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_templates ENABLE ROW LEVEL SECURITY;

-- Policies for service role (full access)
CREATE POLICY "Service role has full access to notion_pages"
  ON notion_pages FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to notion_embeddings"
  ON notion_embeddings FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to notion_databases"
  ON notion_databases FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to notion_sync_log"
  ON notion_sync_log FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to notion_templates"
  ON notion_templates FOR ALL
  TO service_role
  USING (true);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE notion_pages IS 'PRD-203: Stores synced Notion pages with customer linking';
COMMENT ON TABLE notion_embeddings IS 'PRD-203: Stores vector embeddings for semantic search of Notion content';
COMMENT ON TABLE notion_databases IS 'PRD-203: Stores accessible Notion databases for data mapping';
COMMENT ON TABLE notion_sync_log IS 'PRD-203: Tracks Notion sync operations history';
COMMENT ON TABLE notion_templates IS 'PRD-203: Stores custom templates for Notion page creation';

COMMENT ON COLUMN notion_pages.content_markdown IS 'Page content converted to Markdown for indexing and display';
COMMENT ON COLUMN notion_embeddings.embedding IS 'Vector embedding for semantic search using OpenAI ada-002 (1536 dimensions)';
COMMENT ON FUNCTION search_notion_pages IS 'Semantic search across Notion pages using vector similarity';
COMMENT ON FUNCTION search_notion_pages_text IS 'Full-text search across Notion pages using PostgreSQL tsvector';
