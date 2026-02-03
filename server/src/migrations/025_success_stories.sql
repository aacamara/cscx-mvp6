-- Migration: Success Stories (PRD-240)
-- Created: 2026-01-30
-- Description: Tables for AI-powered automated success story drafting

-- Success stories table
CREATE TABLE IF NOT EXISTS success_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  challenge TEXT,
  solution TEXT,
  results TEXT,
  narrative TEXT,
  metrics JSONB DEFAULT '{}'::jsonb,
  quotes JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'pending_approval', 'approved', 'published', 'archived')),
  tone VARCHAR(50) DEFAULT 'professional' CHECK (tone IN ('professional', 'conversational', 'executive', 'technical')),
  created_by UUID NOT NULL,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_success_stories_customer ON success_stories(customer_id);
CREATE INDEX IF NOT EXISTS idx_success_stories_status ON success_stories(status);
CREATE INDEX IF NOT EXISTS idx_success_stories_created_by ON success_stories(created_by);
CREATE INDEX IF NOT EXISTS idx_success_stories_created_at ON success_stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_success_stories_published_at ON success_stories(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_success_stories_tags ON success_stories USING GIN(tags);

-- Success story versions for tracking edits
CREATE TABLE IF NOT EXISTS success_story_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES success_stories(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL, -- Full snapshot of the story at this version
  changed_by UUID NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_versions_story ON success_story_versions(story_id);
CREATE INDEX IF NOT EXISTS idx_story_versions_number ON success_story_versions(story_id, version_number DESC);

-- Success story approval workflow
CREATE TABLE IF NOT EXISTS success_story_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES success_stories(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approver_email VARCHAR(255),
  approver_name VARCHAR(255),
  approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'expired')),
  response_at TIMESTAMPTZ,
  response_notes TEXT,
  token VARCHAR(255) UNIQUE, -- For external approval links
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_story_approvals_story ON success_story_approvals(story_id);
CREATE INDEX IF NOT EXISTS idx_story_approvals_status ON success_story_approvals(approval_status);
CREATE INDEX IF NOT EXISTS idx_story_approvals_token ON success_story_approvals(token);

-- Success story exports/publications
CREATE TABLE IF NOT EXISTS success_story_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES success_stories(id) ON DELETE CASCADE,
  format VARCHAR(50) NOT NULL CHECK (format IN ('pdf', 'slides', 'doc', 'web', 'email')),
  google_file_id VARCHAR(255),
  google_drive_url TEXT,
  download_url TEXT,
  exported_by UUID NOT NULL,
  exported_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_story_exports_story ON success_story_exports(story_id);
CREATE INDEX IF NOT EXISTS idx_story_exports_format ON success_story_exports(format);

-- Success story analytics
CREATE TABLE IF NOT EXISTS success_story_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES success_stories(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('view', 'download', 'share', 'click_cta', 'time_on_page')),
  event_data JSONB DEFAULT '{}'::jsonb,
  viewer_id VARCHAR(255), -- Could be user ID or anonymous session
  viewer_type VARCHAR(50), -- 'internal', 'customer', 'prospect', 'anonymous'
  source VARCHAR(100), -- 'web', 'email', 'pdf', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_analytics_story ON success_story_analytics(story_id);
CREATE INDEX IF NOT EXISTS idx_story_analytics_type ON success_story_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_story_analytics_created ON success_story_analytics(created_at DESC);

-- Template library for success story formats
CREATE TABLE IF NOT EXISTS success_story_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  industry VARCHAR(100),
  use_case VARCHAR(100),
  structure JSONB NOT NULL, -- Template structure with placeholders
  example_content JSONB, -- Sample content for preview
  tone VARCHAR(50) DEFAULT 'professional',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO success_story_templates (name, description, use_case, structure, is_default) VALUES
(
  'Standard Case Study',
  'Traditional case study format with challenge, solution, results sections',
  'general',
  '{"sections": ["title", "summary", "challenge", "solution", "results", "quote", "cta"]}',
  true
),
(
  'Executive Brief',
  'Concise one-pager for executive audiences',
  'executive',
  '{"sections": ["title", "key_metrics", "summary", "quote"]}',
  false
),
(
  'ROI Focused',
  'Emphasizes financial returns and business impact',
  'finance',
  '{"sections": ["title", "roi_summary", "metrics_table", "challenge", "solution", "financial_results", "testimonial"]}',
  false
),
(
  'Technical Deep Dive',
  'Detailed technical implementation story',
  'technical',
  '{"sections": ["title", "summary", "technical_challenge", "architecture", "implementation", "results", "lessons_learned"]}',
  false
)
ON CONFLICT DO NOTHING;

-- Function to auto-create version on story update
CREATE OR REPLACE FUNCTION create_story_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
  FROM success_story_versions
  WHERE story_id = OLD.id;

  -- Insert version snapshot
  INSERT INTO success_story_versions (
    story_id,
    version_number,
    content,
    changed_by,
    change_summary
  ) VALUES (
    OLD.id,
    next_version,
    jsonb_build_object(
      'title', OLD.title,
      'summary', OLD.summary,
      'challenge', OLD.challenge,
      'solution', OLD.solution,
      'results', OLD.results,
      'narrative', OLD.narrative,
      'metrics', OLD.metrics,
      'quotes', OLD.quotes,
      'tags', OLD.tags,
      'status', OLD.status,
      'tone', OLD.tone
    ),
    COALESCE(NEW.created_by, OLD.created_by),
    CASE
      WHEN OLD.status != NEW.status THEN 'Status changed to ' || NEW.status
      ELSE 'Content updated'
    END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create version on update
DROP TRIGGER IF EXISTS trigger_story_version ON success_stories;
CREATE TRIGGER trigger_story_version
  BEFORE UPDATE ON success_stories
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION create_story_version();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_story_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS trigger_story_timestamp ON success_stories;
CREATE TRIGGER trigger_story_timestamp
  BEFORE UPDATE ON success_stories
  FOR EACH ROW
  EXECUTE FUNCTION update_story_timestamp();

-- Comments on tables
COMMENT ON TABLE success_stories IS 'AI-generated customer success stories (PRD-240)';
COMMENT ON TABLE success_story_versions IS 'Version history for success story edits';
COMMENT ON TABLE success_story_approvals IS 'Customer approval workflow for success stories';
COMMENT ON TABLE success_story_exports IS 'Track exports to PDF, slides, etc.';
COMMENT ON TABLE success_story_analytics IS 'Track views, downloads, and engagement';
COMMENT ON TABLE success_story_templates IS 'Reusable templates for story formats';

-- Metrics JSONB structure example:
-- {
--   "healthScoreImprovement": 25,
--   "currentHealthScore": 85,
--   "retentionRate": 95,
--   "expansionRevenue": 50000,
--   "efficiencyGains": "40%",
--   "timeToValue": "2 weeks",
--   "costSavings": 100000,
--   "npsScore": 72,
--   "adoptionRate": 88,
--   "customMetrics": {
--     "support_tickets_reduced": "60%",
--     "onboarding_time_saved": "3 hours/customer"
--   }
-- }

-- Quotes JSONB structure example:
-- [
--   {
--     "text": "CSCX.AI transformed our customer success operations...",
--     "author": "Sarah Chen",
--     "role": "VP of Customer Success",
--     "source": "QBR Meeting - Jan 2026",
--     "date": "2026-01-15"
--   }
-- ]
