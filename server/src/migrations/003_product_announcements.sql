-- Migration: Product Update Announcements (PRD-033)
-- Created: 2026-01-29
-- Description: Tables for product updates, feature requests, and announcement tracking

-- Product updates/changelog repository
CREATE TABLE IF NOT EXISTS product_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  version VARCHAR(50),
  release_date DATE NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('feature', 'enhancement', 'bugfix', 'security', 'performance', 'deprecation')),
  description TEXT NOT NULL,
  key_benefits TEXT[] DEFAULT '{}',
  use_cases TEXT[] DEFAULT '{}',
  affected_products TEXT[] DEFAULT '{}',
  documentation_url TEXT,
  migration_guide_url TEXT,
  training_url TEXT,
  video_url TEXT,
  relevance_criteria JSONB DEFAULT '{}'::jsonb,
  target_segments TEXT[] DEFAULT '{}',
  target_entitlements TEXT[] DEFAULT '{}',
  is_major BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  announced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_product_updates_release_date ON product_updates(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_product_updates_category ON product_updates(category);
CREATE INDEX IF NOT EXISTS idx_product_updates_is_major ON product_updates(is_major) WHERE is_major = true;

-- Customer feature requests tracking
CREATE TABLE IF NOT EXISTS customer_feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(30) DEFAULT 'requested' CHECK (status IN ('requested', 'under_review', 'planned', 'in_progress', 'released', 'declined')),
  product_update_id UUID REFERENCES product_updates(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_requests_customer ON customer_feature_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON customer_feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_product_update ON customer_feature_requests(product_update_id) WHERE product_update_id IS NOT NULL;

-- Announcement campaigns
CREATE TABLE IF NOT EXISTS announcement_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_update_id UUID NOT NULL REFERENCES product_updates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  target_type VARCHAR(30) NOT NULL CHECK (target_type IN ('all', 'segment', 'entitlement', 'custom')),
  target_criteria JSONB DEFAULT '{}'::jsonb,
  customer_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcement_campaigns_update ON announcement_campaigns(product_update_id);
CREATE INDEX IF NOT EXISTS idx_announcement_campaigns_status ON announcement_campaigns(status);

-- Individual announcement sends (per customer)
CREATE TABLE IF NOT EXISTS announcement_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES announcement_campaigns(id) ON DELETE CASCADE,
  product_update_id UUID NOT NULL REFERENCES product_updates(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  csm_user_id UUID,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'draft', 'pending_approval', 'approved', 'sent', 'failed', 'bounced', 'opened', 'clicked')),
  approval_id UUID,
  personalization_data JSONB DEFAULT '{}'::jsonb,
  subject VARCHAR(500),
  body_html TEXT,
  body_text TEXT,
  relevance_score NUMERIC(3,2) DEFAULT 0.5,
  relevance_reasons TEXT[],
  gmail_message_id VARCHAR(255),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, customer_id, stakeholder_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_sends_campaign ON announcement_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_announcement_sends_customer ON announcement_sends(customer_id);
CREATE INDEX IF NOT EXISTS idx_announcement_sends_status ON announcement_sends(status);
CREATE INDEX IF NOT EXISTS idx_announcement_sends_sent ON announcement_sends(sent_at DESC) WHERE sent_at IS NOT NULL;

-- Feature adoption tracking (post-announcement)
CREATE TABLE IF NOT EXISTS feature_adoption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_update_id UUID NOT NULL REFERENCES product_updates(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  announcement_send_id UUID REFERENCES announcement_sends(id) ON DELETE SET NULL,
  adoption_status VARCHAR(30) DEFAULT 'not_started' CHECK (adoption_status IN ('not_started', 'exploring', 'piloting', 'adopted', 'heavy_usage')),
  first_used_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  adoption_score NUMERIC(3,2) DEFAULT 0,
  feedback TEXT,
  feedback_sentiment VARCHAR(20) CHECK (feedback_sentiment IN ('positive', 'neutral', 'negative')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_update_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_adoption_update ON feature_adoption(product_update_id);
CREATE INDEX IF NOT EXISTS idx_feature_adoption_customer ON feature_adoption(customer_id);
CREATE INDEX IF NOT EXISTS idx_feature_adoption_status ON feature_adoption(adoption_status);

-- Comments
COMMENT ON TABLE product_updates IS 'Product changelog and feature release tracking (PRD-033)';
COMMENT ON TABLE customer_feature_requests IS 'Customer feature requests linked to product updates';
COMMENT ON TABLE announcement_campaigns IS 'Product announcement campaigns for bulk email sending';
COMMENT ON TABLE announcement_sends IS 'Individual announcement email records per customer';
COMMENT ON TABLE feature_adoption IS 'Post-announcement feature adoption tracking';

-- Relevance criteria structure:
-- {
--   "min_usage_percentage": 50,
--   "required_entitlements": ["api", "enterprise"],
--   "required_segments": ["enterprise", "mid-market"],
--   "required_features_used": ["api_v2", "bulk_export"],
--   "exclude_segments": [],
--   "min_health_score": 60
-- }

-- Personalization data structure:
-- {
--   "usage_stats": {
--     "api_calls": 2300000,
--     "active_users": 150
--   },
--   "relevant_benefits": ["40% faster API", "New bulk endpoints"],
--   "specific_use_cases": ["Reduce sync latency for high-volume integration"],
--   "previous_requests": ["Asked for faster API in Q3 2025"],
--   "custom_cta": "Schedule migration walkthrough"
-- }
