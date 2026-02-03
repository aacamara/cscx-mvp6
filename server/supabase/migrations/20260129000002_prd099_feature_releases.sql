-- PRD-099: High-Value Feature Released Alert
-- Database schema for product releases and customer matching

-- ================================================
-- PRODUCT RELEASES TABLE
-- Stores released features and their metadata
-- ================================================
CREATE TABLE IF NOT EXISTS product_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id VARCHAR(100) NOT NULL UNIQUE,
  feature_name VARCHAR(255) NOT NULL,
  description TEXT,
  release_date DATE DEFAULT CURRENT_DATE,
  tier_availability TEXT[] DEFAULT ARRAY['starter', 'professional', 'enterprise'],
  keywords TEXT[] DEFAULT '{}',
  documentation_url TEXT,
  video_url TEXT,
  announcement_content TEXT,
  enablement_resources JSONB DEFAULT '{}',
  -- Enablement resources structure:
  -- {
  --   "videos": [{"title": "...", "url": "...", "duration_minutes": 5}],
  --   "docs": [{"title": "...", "url": "..."}],
  --   "trainings": [{"title": "...", "date": "...", "registration_url": "..."}]
  -- }
  category VARCHAR(100), -- 'analytics', 'integrations', 'reporting', 'automation', etc.
  status VARCHAR(50) DEFAULT 'active', -- 'draft', 'active', 'deprecated'
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for product_releases
CREATE INDEX IF NOT EXISTS idx_product_releases_feature_id ON product_releases(feature_id);
CREATE INDEX IF NOT EXISTS idx_product_releases_release_date ON product_releases(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_product_releases_status ON product_releases(status);
CREATE INDEX IF NOT EXISTS idx_product_releases_category ON product_releases(category);

-- ================================================
-- FEATURE REQUESTS TABLE
-- Stores customer feature requests for matching
-- ================================================
CREATE TABLE IF NOT EXISTS feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(100) NOT NULL UNIQUE, -- External ID like 'FR-2024-089'
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  requester_name VARCHAR(255),
  requester_email VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  keywords TEXT[] DEFAULT '{}',
  priority VARCHAR(50) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'under_review', 'planned', 'in_progress', 'released', 'declined'
  votes INTEGER DEFAULT 1,
  linked_release_id UUID REFERENCES product_releases(id),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for feature_requests
CREATE INDEX IF NOT EXISTS idx_feature_requests_customer ON feature_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_request_id ON feature_requests(request_id);

-- ================================================
-- RELEASE CUSTOMER MATCHES TABLE
-- Links releases to customers with match metadata
-- ================================================
CREATE TABLE IF NOT EXISTS release_customer_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES product_releases(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  match_reason VARCHAR(100) NOT NULL, -- 'feature_request', 'use_case', 'usage_pattern', 'keyword_match'
  match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100), -- 1-100
  match_details JSONB DEFAULT '{}',
  -- match_details structure:
  -- {
  --   "feature_request_id": "uuid",
  --   "usage_metrics": {...},
  --   "matched_keywords": ["export", "api"],
  --   "customer_goals": ["data analysis", "automation"]
  -- }
  feature_request_id UUID REFERENCES feature_requests(id),
  csm_user_id UUID, -- Assigned CSM

  -- Tracking
  alert_sent_at TIMESTAMPTZ,
  announced_at TIMESTAMPTZ,
  announcement_method VARCHAR(50), -- 'email', 'call', 'meeting', 'slack'
  adopted_at TIMESTAMPTZ,
  adoption_notes TEXT,

  -- Task tracking
  outreach_task_id UUID,
  outreach_task_created_at TIMESTAMPTZ,
  outreach_task_due_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per release-customer pair
  UNIQUE(release_id, customer_id)
);

-- Indexes for release_customer_matches
CREATE INDEX IF NOT EXISTS idx_release_matches_release ON release_customer_matches(release_id);
CREATE INDEX IF NOT EXISTS idx_release_matches_customer ON release_customer_matches(customer_id);
CREATE INDEX IF NOT EXISTS idx_release_matches_csm ON release_customer_matches(csm_user_id);
CREATE INDEX IF NOT EXISTS idx_release_matches_score ON release_customer_matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_release_matches_pending ON release_customer_matches(announced_at)
  WHERE announced_at IS NULL;

-- ================================================
-- VIEWS
-- ================================================

-- View: Pending feature announcements
CREATE OR REPLACE VIEW v_pending_feature_announcements AS
SELECT
  rcm.id as match_id,
  pr.id as release_id,
  pr.feature_name,
  pr.description as feature_description,
  pr.release_date,
  pr.tier_availability,
  pr.enablement_resources,
  c.id as customer_id,
  c.name as customer_name,
  c.arr,
  c.health_score,
  c.stage as customer_tier,
  rcm.match_reason,
  rcm.match_score,
  rcm.match_details,
  rcm.feature_request_id,
  fr.request_id as feature_request_number,
  fr.submitted_at as request_submitted_at,
  rcm.csm_user_id,
  rcm.created_at as match_created_at
FROM release_customer_matches rcm
JOIN product_releases pr ON pr.id = rcm.release_id
JOIN customers c ON c.id = rcm.customer_id
LEFT JOIN feature_requests fr ON fr.id = rcm.feature_request_id
WHERE rcm.announced_at IS NULL
  AND pr.status = 'active'
ORDER BY rcm.match_score DESC, c.arr DESC;

-- View: Feature adoption tracking
CREATE OR REPLACE VIEW v_feature_adoption_tracking AS
SELECT
  pr.id as release_id,
  pr.feature_name,
  pr.release_date,
  COUNT(DISTINCT rcm.id) as total_matches,
  COUNT(DISTINCT rcm.id) FILTER (WHERE rcm.announced_at IS NOT NULL) as announced_count,
  COUNT(DISTINCT rcm.id) FILTER (WHERE rcm.adopted_at IS NOT NULL) as adopted_count,
  ROUND(
    COUNT(DISTINCT rcm.id) FILTER (WHERE rcm.adopted_at IS NOT NULL)::decimal /
    NULLIF(COUNT(DISTINCT rcm.id) FILTER (WHERE rcm.announced_at IS NOT NULL), 0) * 100,
    1
  ) as adoption_rate,
  SUM(c.arr) FILTER (WHERE rcm.announced_at IS NOT NULL) as arr_announced,
  SUM(c.arr) FILTER (WHERE rcm.adopted_at IS NOT NULL) as arr_adopted
FROM product_releases pr
LEFT JOIN release_customer_matches rcm ON rcm.release_id = pr.id
LEFT JOIN customers c ON c.id = rcm.customer_id
GROUP BY pr.id, pr.feature_name, pr.release_date
ORDER BY pr.release_date DESC;

-- ================================================
-- TRIGGERS
-- ================================================

-- Update timestamp trigger for product_releases
DROP TRIGGER IF EXISTS update_product_releases_updated_at ON product_releases;
CREATE TRIGGER update_product_releases_updated_at
  BEFORE UPDATE ON product_releases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update timestamp trigger for feature_requests
DROP TRIGGER IF EXISTS update_feature_requests_updated_at ON feature_requests;
CREATE TRIGGER update_feature_requests_updated_at
  BEFORE UPDATE ON feature_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update timestamp trigger for release_customer_matches
DROP TRIGGER IF EXISTS update_release_matches_updated_at ON release_customer_matches;
CREATE TRIGGER update_release_matches_updated_at
  BEFORE UPDATE ON release_customer_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- SAMPLE DATA (for testing)
-- ================================================
-- Uncomment to add sample data
/*
INSERT INTO product_releases (feature_id, feature_name, description, tier_availability, keywords, enablement_resources, category)
VALUES
  ('ADV_EXPORT_2026', 'Advanced Export Options', 'Schedule exports, create custom format templates, and use the new API export endpoint for seamless data integration.',
   ARRAY['professional', 'enterprise'],
   ARRAY['export', 'api', 'data', 'integration', 'schedule', 'automation'],
   '{"videos": [{"title": "Feature Overview Video", "url": "https://example.com/video", "duration_minutes": 5}], "docs": [{"title": "Documentation", "url": "https://docs.example.com/export"}], "trainings": [{"title": "Live Training", "date": "2026-02-03", "registration_url": "https://example.com/training"}]}',
   'integrations'),
  ('AI_INSIGHTS_2026', 'AI-Powered Insights', 'Automatically surface actionable insights from your customer data using advanced machine learning.',
   ARRAY['enterprise'],
   ARRAY['ai', 'insights', 'analytics', 'machine learning', 'automation'],
   '{"videos": [{"title": "AI Insights Demo", "url": "https://example.com/ai-demo", "duration_minutes": 8}], "docs": [{"title": "AI Features Guide", "url": "https://docs.example.com/ai"}]}',
   'analytics');
*/
