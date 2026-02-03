-- PRD-204: Confluence Knowledge Base Integration
-- Database schema for Confluence content sync, search, and customer linking

-- ============================================
-- CONFLUENCE PAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS confluence_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confluence_page_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  space_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content_text TEXT,
  labels TEXT[] DEFAULT ARRAY[]::TEXT[],
  page_url TEXT,
  last_modified_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per user per page
  UNIQUE(user_id, confluence_page_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_confluence_pages_user_id ON confluence_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_confluence_pages_space_key ON confluence_pages(space_key);
CREATE INDEX IF NOT EXISTS idx_confluence_pages_page_id ON confluence_pages(confluence_page_id);
CREATE INDEX IF NOT EXISTS idx_confluence_pages_title ON confluence_pages USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_confluence_pages_content ON confluence_pages USING gin(to_tsvector('english', content_text));
CREATE INDEX IF NOT EXISTS idx_confluence_pages_labels ON confluence_pages USING gin(labels);
CREATE INDEX IF NOT EXISTS idx_confluence_pages_last_modified ON confluence_pages(last_modified_at);

-- ============================================
-- CONFLUENCE EMBEDDINGS TABLE (FR-5: AI Knowledge Base)
-- ============================================
CREATE TABLE IF NOT EXISTS confluence_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confluence_page_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Reference to pages table
  CONSTRAINT fk_confluence_page
    FOREIGN KEY (user_id, confluence_page_id)
    REFERENCES confluence_pages(user_id, confluence_page_id)
    ON DELETE CASCADE
);

-- Index for similarity search
CREATE INDEX IF NOT EXISTS idx_confluence_embeddings_vector ON confluence_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_confluence_embeddings_page ON confluence_embeddings(confluence_page_id);
CREATE INDEX IF NOT EXISTS idx_confluence_embeddings_user ON confluence_embeddings(user_id);

-- ============================================
-- CONFLUENCE CUSTOMER LINKS TABLE (FR-6)
-- ============================================
CREATE TABLE IF NOT EXISTS confluence_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confluence_page_id TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  link_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint - one link per page-customer pair
  UNIQUE(confluence_page_id, customer_id)
);

-- Indexes for customer page lookups
CREATE INDEX IF NOT EXISTS idx_confluence_customer_links_customer ON confluence_customer_links(customer_id);
CREATE INDEX IF NOT EXISTS idx_confluence_customer_links_page ON confluence_customer_links(confluence_page_id);
CREATE INDEX IF NOT EXISTS idx_confluence_customer_links_user ON confluence_customer_links(user_id);

-- ============================================
-- CONFLUENCE SPACE CONFIGURATION TABLE (FR-3)
-- ============================================
CREATE TABLE IF NOT EXISTS confluence_space_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  space_key TEXT NOT NULL,
  space_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  sync_frequency VARCHAR(20) DEFAULT 'daily',
  last_sync_at TIMESTAMPTZ,
  page_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per user per space
  UNIQUE(user_id, space_key)
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_confluence_space_config_user ON confluence_space_config(user_id);
CREATE INDEX IF NOT EXISTS idx_confluence_space_config_enabled ON confluence_space_config(enabled) WHERE enabled = true;

-- ============================================
-- CONFLUENCE SYNC LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS confluence_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  integration_id UUID,
  object_type VARCHAR(50) NOT NULL,
  sync_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  pages_processed INTEGER DEFAULT 0,
  pages_created INTEGER DEFAULT 0,
  pages_updated INTEGER DEFAULT 0,
  pages_skipped INTEGER DEFAULT 0,
  pages_failed INTEGER DEFAULT 0,
  error_details TEXT[],
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for sync history queries
CREATE INDEX IF NOT EXISTS idx_confluence_sync_log_user ON confluence_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_confluence_sync_log_started ON confluence_sync_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_confluence_sync_log_status ON confluence_sync_log(status);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_confluence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_confluence_pages_updated_at ON confluence_pages;
CREATE TRIGGER update_confluence_pages_updated_at
  BEFORE UPDATE ON confluence_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_confluence_updated_at();

DROP TRIGGER IF EXISTS update_confluence_space_config_updated_at ON confluence_space_config;
CREATE TRIGGER update_confluence_space_config_updated_at
  BEFORE UPDATE ON confluence_space_config
  FOR EACH ROW
  EXECUTE FUNCTION update_confluence_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE confluence_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE confluence_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE confluence_customer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE confluence_space_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE confluence_sync_log ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can view own Confluence pages"
  ON confluence_pages FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own Confluence pages"
  ON confluence_pages FOR ALL
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can view own Confluence embeddings"
  ON confluence_embeddings FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own Confluence embeddings"
  ON confluence_embeddings FOR ALL
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can view own Confluence customer links"
  ON confluence_customer_links FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own Confluence customer links"
  ON confluence_customer_links FOR ALL
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can view own Confluence space config"
  ON confluence_space_config FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own Confluence space config"
  ON confluence_space_config FOR ALL
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can view own Confluence sync logs"
  ON confluence_sync_log FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own Confluence sync logs"
  ON confluence_sync_log FOR ALL
  USING (auth.uid()::TEXT = user_id);

-- Service role bypass for backend operations
CREATE POLICY "Service role has full access to Confluence pages"
  ON confluence_pages FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to Confluence embeddings"
  ON confluence_embeddings FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to Confluence customer links"
  ON confluence_customer_links FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to Confluence space config"
  ON confluence_space_config FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to Confluence sync logs"
  ON confluence_sync_log FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- FUNCTIONS FOR SEMANTIC SEARCH (FR-5)
-- ============================================

-- Function to search pages using vector similarity
CREATE OR REPLACE FUNCTION search_confluence_pages(
  p_user_id TEXT,
  p_query_embedding VECTOR(1536),
  p_match_threshold FLOAT DEFAULT 0.7,
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  page_id TEXT,
  title TEXT,
  space_key TEXT,
  content_snippet TEXT,
  similarity FLOAT,
  page_url TEXT,
  labels TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.confluence_page_id,
    cp.title,
    cp.space_key,
    LEFT(ce.chunk_text, 300) as content_snippet,
    1 - (ce.embedding <=> p_query_embedding) as similarity,
    cp.page_url,
    cp.labels
  FROM confluence_embeddings ce
  JOIN confluence_pages cp
    ON ce.user_id = cp.user_id
    AND ce.confluence_page_id = cp.confluence_page_id
  WHERE ce.user_id = p_user_id
    AND 1 - (ce.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY ce.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE confluence_pages IS 'Stores synced Confluence pages for knowledge base (PRD-204)';
COMMENT ON TABLE confluence_embeddings IS 'Vector embeddings for semantic search of Confluence content (PRD-204)';
COMMENT ON TABLE confluence_customer_links IS 'Links between Confluence pages and customers (PRD-204)';
COMMENT ON TABLE confluence_space_config IS 'Configuration for which Confluence spaces to index (PRD-204)';
COMMENT ON TABLE confluence_sync_log IS 'Sync history for Confluence content (PRD-204)';
COMMENT ON FUNCTION search_confluence_pages IS 'Semantic search across Confluence content using vector embeddings (PRD-204)';
