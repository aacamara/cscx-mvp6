-- PRD-254: Best Practice Sharing
-- Database schema for knowledge sharing among CSMs

-- best_practices table - core content
CREATE TABLE IF NOT EXISTS best_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id TEXT NOT NULL,

  -- Content
  title VARCHAR(500) NOT NULL,
  problem_statement TEXT NOT NULL,
  solution TEXT NOT NULL,
  expected_outcomes TEXT,
  variations TEXT,
  pitfalls TEXT,

  -- Classification
  category VARCHAR(100), -- 'onboarding', 'renewal', 'expansion', 'risk', 'communication', 'adoption'
  tags TEXT[] DEFAULT '{}',
  customer_segment VARCHAR(50), -- Applicable segment (Enterprise, SMB, etc.)
  applicable_industries TEXT[] DEFAULT '{}',

  -- Proof points
  linked_customer_ids UUID[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]', -- [{type, name, url, mimeType}]

  -- Status & Publishing
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'pending_review', 'published', 'archived'
  published_at TIMESTAMPTZ,
  reviewed_by_user_id TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Engagement metrics (denormalized for performance)
  view_count INTEGER DEFAULT 0,
  upvote_count INTEGER DEFAULT 0,
  downvote_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,

  -- Featured
  is_featured BOOLEAN DEFAULT false,
  featured_at TIMESTAMPTZ,
  featured_reason TEXT,

  -- Versioning
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES best_practices(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- best_practice_votes - upvote/downvote tracking
CREATE TABLE IF NOT EXISTS best_practice_votes (
  user_id TEXT NOT NULL,
  best_practice_id UUID NOT NULL REFERENCES best_practices(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK (vote IN (1, -1)), -- 1 = upvote, -1 = downvote
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, best_practice_id)
);

-- best_practice_comments - Q&A and discussions
CREATE TABLE IF NOT EXISTS best_practice_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  best_practice_id UUID NOT NULL REFERENCES best_practices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  parent_comment_id UUID REFERENCES best_practice_comments(id),
  content TEXT NOT NULL,
  is_question BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by_user_id TEXT,
  resolved_at TIMESTAMPTZ,
  upvote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- best_practice_saves - personal collections
CREATE TABLE IF NOT EXISTS best_practice_saves (
  user_id TEXT NOT NULL,
  best_practice_id UUID NOT NULL REFERENCES best_practices(id) ON DELETE CASCADE,
  collection VARCHAR(100) DEFAULT 'default',
  notes TEXT,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, best_practice_id)
);

-- best_practice_usage - track when someone uses a best practice
CREATE TABLE IF NOT EXISTS best_practice_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  best_practice_id UUID NOT NULL REFERENCES best_practices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  customer_id UUID,
  outcome VARCHAR(50) CHECK (outcome IN ('helpful', 'somewhat_helpful', 'not_helpful')),
  notes TEXT,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- best_practice_views - track unique views
CREATE TABLE IF NOT EXISTS best_practice_views (
  user_id TEXT NOT NULL,
  best_practice_id UUID NOT NULL REFERENCES best_practices(id) ON DELETE CASCADE,
  first_viewed_at TIMESTAMPTZ DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INTEGER DEFAULT 1,
  PRIMARY KEY (user_id, best_practice_id)
);

-- Indexes for performance

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_best_practices_search ON best_practices
  USING GIN(to_tsvector('english', title || ' ' || problem_statement || ' ' || solution));

-- Tag and category indexes
CREATE INDEX IF NOT EXISTS idx_best_practices_tags ON best_practices USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_best_practices_category ON best_practices(category);
CREATE INDEX IF NOT EXISTS idx_best_practices_status ON best_practices(status);
CREATE INDEX IF NOT EXISTS idx_best_practices_category_status ON best_practices(category, status);

-- Author and date indexes
CREATE INDEX IF NOT EXISTS idx_best_practices_author ON best_practices(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_best_practices_created ON best_practices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_best_practices_published ON best_practices(published_at DESC);

-- Engagement sorting indexes
CREATE INDEX IF NOT EXISTS idx_best_practices_popular ON best_practices(upvote_count DESC, view_count DESC)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_best_practices_featured ON best_practices(featured_at DESC)
  WHERE is_featured = true AND status = 'published';

-- Comment indexes
CREATE INDEX IF NOT EXISTS idx_best_practice_comments_practice ON best_practice_comments(best_practice_id);
CREATE INDEX IF NOT EXISTS idx_best_practice_comments_parent ON best_practice_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_best_practice_comments_user ON best_practice_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_best_practice_comments_questions ON best_practice_comments(best_practice_id, is_question)
  WHERE is_question = true;

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_best_practice_usage_practice ON best_practice_usage(best_practice_id);
CREATE INDEX IF NOT EXISTS idx_best_practice_usage_user ON best_practice_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_best_practice_usage_customer ON best_practice_usage(customer_id);

-- Views tracking indexes
CREATE INDEX IF NOT EXISTS idx_best_practice_views_practice ON best_practice_views(best_practice_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_best_practice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_best_practices_updated_at ON best_practices;
CREATE TRIGGER update_best_practices_updated_at
  BEFORE UPDATE ON best_practices
  FOR EACH ROW
  EXECUTE FUNCTION update_best_practice_updated_at();

DROP TRIGGER IF EXISTS update_best_practice_comments_updated_at ON best_practice_comments;
CREATE TRIGGER update_best_practice_comments_updated_at
  BEFORE UPDATE ON best_practice_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_best_practice_updated_at();

DROP TRIGGER IF EXISTS update_best_practice_votes_updated_at ON best_practice_votes;
CREATE TRIGGER update_best_practice_votes_updated_at
  BEFORE UPDATE ON best_practice_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_best_practice_updated_at();

-- Function to update engagement counts
CREATE OR REPLACE FUNCTION update_best_practice_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update counts on the best_practices table
  IF TG_TABLE_NAME = 'best_practice_votes' THEN
    UPDATE best_practices SET
      upvote_count = (SELECT COUNT(*) FROM best_practice_votes WHERE best_practice_id = COALESCE(NEW.best_practice_id, OLD.best_practice_id) AND vote = 1),
      downvote_count = (SELECT COUNT(*) FROM best_practice_votes WHERE best_practice_id = COALESCE(NEW.best_practice_id, OLD.best_practice_id) AND vote = -1),
      updated_at = NOW()
    WHERE id = COALESCE(NEW.best_practice_id, OLD.best_practice_id);
  ELSIF TG_TABLE_NAME = 'best_practice_saves' THEN
    UPDATE best_practices SET
      save_count = (SELECT COUNT(*) FROM best_practice_saves WHERE best_practice_id = COALESCE(NEW.best_practice_id, OLD.best_practice_id)),
      updated_at = NOW()
    WHERE id = COALESCE(NEW.best_practice_id, OLD.best_practice_id);
  ELSIF TG_TABLE_NAME = 'best_practice_usage' THEN
    UPDATE best_practices SET
      use_count = (SELECT COUNT(*) FROM best_practice_usage WHERE best_practice_id = COALESCE(NEW.best_practice_id, OLD.best_practice_id)),
      updated_at = NOW()
    WHERE id = COALESCE(NEW.best_practice_id, OLD.best_practice_id);
  ELSIF TG_TABLE_NAME = 'best_practice_comments' THEN
    UPDATE best_practices SET
      comment_count = (SELECT COUNT(*) FROM best_practice_comments WHERE best_practice_id = COALESCE(NEW.best_practice_id, OLD.best_practice_id)),
      updated_at = NOW()
    WHERE id = COALESCE(NEW.best_practice_id, OLD.best_practice_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for count updates
DROP TRIGGER IF EXISTS update_votes_count ON best_practice_votes;
CREATE TRIGGER update_votes_count
  AFTER INSERT OR UPDATE OR DELETE ON best_practice_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_best_practice_counts();

DROP TRIGGER IF EXISTS update_saves_count ON best_practice_saves;
CREATE TRIGGER update_saves_count
  AFTER INSERT OR DELETE ON best_practice_saves
  FOR EACH ROW
  EXECUTE FUNCTION update_best_practice_counts();

DROP TRIGGER IF EXISTS update_usage_count ON best_practice_usage;
CREATE TRIGGER update_usage_count
  AFTER INSERT ON best_practice_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_best_practice_counts();

DROP TRIGGER IF EXISTS update_comments_count ON best_practice_comments;
CREATE TRIGGER update_comments_count
  AFTER INSERT OR DELETE ON best_practice_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_best_practice_counts();

-- Function for full-text search
CREATE OR REPLACE FUNCTION search_best_practices(
  search_query TEXT,
  category_filter TEXT DEFAULT NULL,
  status_filter TEXT DEFAULT 'published',
  tags_filter TEXT[] DEFAULT NULL,
  author_filter TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(500),
  problem_statement TEXT,
  solution TEXT,
  category VARCHAR(100),
  tags TEXT[],
  status VARCHAR(50),
  created_by_user_id TEXT,
  upvote_count INTEGER,
  downvote_count INTEGER,
  view_count INTEGER,
  comment_count INTEGER,
  is_featured BOOLEAN,
  created_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  relevance_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bp.id,
    bp.title,
    bp.problem_statement,
    bp.solution,
    bp.category,
    bp.tags,
    bp.status,
    bp.created_by_user_id,
    bp.upvote_count,
    bp.downvote_count,
    bp.view_count,
    bp.comment_count,
    bp.is_featured,
    bp.created_at,
    bp.published_at,
    CASE
      WHEN search_query IS NOT NULL AND search_query != '' THEN
        ts_rank(
          to_tsvector('english', bp.title || ' ' || bp.problem_statement || ' ' || bp.solution),
          plainto_tsquery('english', search_query)
        )
      ELSE 1.0
    END::REAL as relevance_score
  FROM best_practices bp
  WHERE
    (status_filter IS NULL OR bp.status = status_filter)
    AND (category_filter IS NULL OR bp.category = category_filter)
    AND (tags_filter IS NULL OR bp.tags && tags_filter)
    AND (author_filter IS NULL OR bp.created_by_user_id = author_filter)
    AND (
      search_query IS NULL
      OR search_query = ''
      OR to_tsvector('english', bp.title || ' ' || bp.problem_statement || ' ' || bp.solution) @@ plainto_tsquery('english', search_query)
    )
  ORDER BY
    bp.is_featured DESC,
    CASE
      WHEN search_query IS NOT NULL AND search_query != '' THEN
        ts_rank(
          to_tsvector('english', bp.title || ' ' || bp.problem_statement || ' ' || bp.solution),
          plainto_tsquery('english', search_query)
        )
      ELSE 0
    END DESC,
    (bp.upvote_count - bp.downvote_count) DESC,
    bp.published_at DESC NULLS LAST,
    bp.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE best_practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_practice_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_practice_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_practice_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_practice_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_practice_views ENABLE ROW LEVEL SECURITY;

-- Policies: All authenticated users can view published best practices
CREATE POLICY "Anyone can view published best practices"
  ON best_practices FOR SELECT
  USING (status = 'published' OR auth.uid()::TEXT = created_by_user_id);

CREATE POLICY "Users can create best practices"
  ON best_practices FOR INSERT
  WITH CHECK (auth.uid()::TEXT = created_by_user_id);

CREATE POLICY "Users can update own best practices"
  ON best_practices FOR UPDATE
  USING (auth.uid()::TEXT = created_by_user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can delete own draft best practices"
  ON best_practices FOR DELETE
  USING (auth.uid()::TEXT = created_by_user_id AND status = 'draft');

-- Vote policies
CREATE POLICY "Users can view all votes"
  ON best_practice_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own votes"
  ON best_practice_votes FOR ALL
  USING (auth.uid()::TEXT = user_id);

-- Comment policies
CREATE POLICY "Users can view all comments"
  ON best_practice_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create comments"
  ON best_practice_comments FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own comments"
  ON best_practice_comments FOR UPDATE
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete own comments"
  ON best_practice_comments FOR DELETE
  USING (auth.uid()::TEXT = user_id);

-- Save policies
CREATE POLICY "Users can view own saves"
  ON best_practice_saves FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own saves"
  ON best_practice_saves FOR ALL
  USING (auth.uid()::TEXT = user_id);

-- Usage policies
CREATE POLICY "Users can view all usage"
  ON best_practice_usage FOR SELECT
  USING (true);

CREATE POLICY "Users can create usage records"
  ON best_practice_usage FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

-- View policies
CREATE POLICY "Users can manage own views"
  ON best_practice_views FOR ALL
  USING (auth.uid()::TEXT = user_id);

-- Service role bypass for backend operations
CREATE POLICY "Service role has full access to best_practices"
  ON best_practices FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to votes"
  ON best_practice_votes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to comments"
  ON best_practice_comments FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to saves"
  ON best_practice_saves FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to usage"
  ON best_practice_usage FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to views"
  ON best_practice_views FOR ALL
  USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE best_practices IS 'Best practices shared among CSMs for knowledge sharing (PRD-254)';
COMMENT ON TABLE best_practice_votes IS 'Upvotes and downvotes on best practices (PRD-254)';
COMMENT ON TABLE best_practice_comments IS 'Comments and Q&A on best practices (PRD-254)';
COMMENT ON TABLE best_practice_saves IS 'User personal collections of saved best practices (PRD-254)';
COMMENT ON TABLE best_practice_usage IS 'Tracks when users apply best practices to customers (PRD-254)';
COMMENT ON TABLE best_practice_views IS 'Tracks unique views per user per best practice (PRD-254)';
COMMENT ON FUNCTION search_best_practices IS 'Full-text search with filtering for best practices (PRD-254)';
