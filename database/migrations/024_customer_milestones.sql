-- Migration: 024_customer_milestones.sql
-- PRD-114: Customer Milestone Alert
-- Purpose: Track and celebrate customer milestones

-- ============================================
-- Milestone definitions table
-- Configures what milestones to track
-- ============================================
CREATE TABLE IF NOT EXISTS milestone_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- 'time', 'usage', 'adoption', 'business', 'custom'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  condition JSONB NOT NULL, -- e.g., {"metric": "api_calls", "threshold": 1000000}
  celebration_template TEXT, -- Default email template for this milestone
  celebration_suggestions JSONB DEFAULT '[]', -- Suggested celebration actions
  enabled BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 100, -- Lower number = higher priority
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestone_definitions_type ON milestone_definitions(type);
CREATE INDEX IF NOT EXISTS idx_milestone_definitions_enabled ON milestone_definitions(enabled) WHERE enabled = TRUE;

-- ============================================
-- Customer milestones table
-- Records achieved milestones
-- ============================================
CREATE TABLE IF NOT EXISTS customer_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  definition_id UUID REFERENCES milestone_definitions(id) ON DELETE SET NULL,
  milestone_type VARCHAR(50) NOT NULL,
  milestone_name VARCHAR(255) NOT NULL,
  milestone_value TEXT, -- The actual value when milestone was achieved
  threshold_value TEXT, -- The threshold that was crossed
  time_to_milestone INTEGER, -- Days from customer start to achievement
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  celebrated BOOLEAN DEFAULT FALSE,
  celebrated_at TIMESTAMPTZ,
  celebration_type VARCHAR(50), -- 'email', 'social', 'gift', 'case_study', 'internal_only'
  celebration_notes TEXT,
  csm_notified BOOLEAN DEFAULT FALSE,
  csm_notified_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}', -- Additional context about the milestone
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_milestones_customer ON customer_milestones(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_milestones_type ON customer_milestones(milestone_type);
CREATE INDEX IF NOT EXISTS idx_customer_milestones_achieved ON customer_milestones(achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_milestones_uncelebrated ON customer_milestones(celebrated) WHERE celebrated = FALSE;
CREATE INDEX IF NOT EXISTS idx_customer_milestones_pending_notification ON customer_milestones(csm_notified) WHERE csm_notified = FALSE;

-- ============================================
-- Customer usage metrics table
-- Track metrics that can trigger milestones
-- ============================================
CREATE TABLE IF NOT EXISTS customer_usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit VARCHAR(50),
  period_start DATE,
  period_end DATE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(customer_id, metric_name, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_customer_usage_metrics_customer ON customer_usage_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_usage_metrics_name ON customer_usage_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_customer_usage_metrics_recorded ON customer_usage_metrics(recorded_at DESC);

-- ============================================
-- Seed default milestone definitions
-- ============================================
INSERT INTO milestone_definitions (type, name, description, condition, celebration_template, celebration_suggestions, priority)
VALUES
  -- Time milestones
  ('time', '1 Year Anniversary', 'Customer has been with us for 1 year',
   '{"metric": "customer_age_days", "operator": ">=", "threshold": 365}',
   'Congratulations on 1 year with us! We''re thrilled to have you as a valued customer.',
   '["Send congratulations email", "Social media shoutout", "Anniversary gift", "Case study invitation"]',
   10),

  ('time', '2 Year Anniversary', 'Customer has been with us for 2 years',
   '{"metric": "customer_age_days", "operator": ">=", "threshold": 730}',
   'Celebrating 2 amazing years together! Thank you for your continued partnership.',
   '["Executive thank you call", "VIP customer recognition", "Loyalty discount offer"]',
   10),

  ('time', '5 Year Anniversary', 'Customer has been with us for 5 years',
   '{"metric": "customer_age_days", "operator": ">=", "threshold": 1825}',
   'Five incredible years of partnership! Your loyalty means everything to us.',
   '["Executive dinner invitation", "Premium gift", "Feature naming opportunity", "Advisory board invitation"]',
   5),

  -- Usage milestones
  ('usage', '1 Million API Calls', 'Customer has made 1 million API calls',
   '{"metric": "api_calls", "operator": ">=", "threshold": 1000000}',
   'You''ve just crossed 1 million API calls! This milestone shows the incredible value you''re getting.',
   '["Send congratulations email", "Technical achievement badge", "Case study invitation"]',
   20),

  ('usage', '100 Active Users', 'Customer has 100 active users',
   '{"metric": "active_users", "operator": ">=", "threshold": 100}',
   'Congratulations on reaching 100 active users! Your team adoption is impressive.',
   '["Send congratulations email", "Offer admin training", "Share best practices guide"]',
   25),

  ('usage', '1,000 Active Users', 'Customer has 1,000 active users',
   '{"metric": "active_users", "operator": ">=", "threshold": 1000}',
   'Amazing! 1,000 users are now active on the platform. This is a significant achievement.',
   '["Executive recognition", "Enterprise tier review", "Custom training program"]',
   15),

  -- Adoption milestones
  ('adoption', 'Full Feature Adoption', 'Customer has used all core features',
   '{"metric": "features_adopted_percent", "operator": ">=", "threshold": 100}',
   'You''ve unlocked 100% of our features! You''re a power user.',
   '["Power user badge", "Beta feature access", "Customer advisory board invitation"]',
   20),

  ('adoption', 'First Integration Connected', 'Customer has connected their first integration',
   '{"metric": "integrations_connected", "operator": ">=", "threshold": 1}',
   'Great job connecting your first integration! You''re on your way to a fully connected workflow.',
   '["Send integration guide", "Recommend additional integrations"]',
   50),

  ('adoption', 'All Integrations Connected', 'Customer has connected all available integrations',
   '{"metric": "integrations_connected_percent", "operator": ">=", "threshold": 100}',
   'You''ve connected all available integrations! Your workflow is fully optimized.',
   '["Integration master badge", "Feature request priority"]',
   30),

  -- Business milestones
  ('business', 'ROI Goal Achieved', 'Customer has achieved their stated ROI goal',
   '{"metric": "roi_achieved", "operator": ">=", "threshold": 100}',
   'Congratulations! You''ve achieved your ROI goal. We''d love to share your success story.',
   '["Case study invitation", "Reference program", "Success story video"]',
   10),

  ('business', 'Expansion Customer', 'Customer has expanded their contract',
   '{"metric": "contract_expansions", "operator": ">=", "threshold": 1}',
   'Thank you for expanding your partnership with us! We''re committed to your continued success.',
   '["Executive thank you", "Strategic account review", "Custom success plan"]',
   15)
ON CONFLICT DO NOTHING;

-- ============================================
-- Function to check milestones
-- ============================================
CREATE OR REPLACE FUNCTION check_customer_milestones(p_customer_id UUID)
RETURNS TABLE (
  milestone_definition_id UUID,
  milestone_type VARCHAR(50),
  milestone_name VARCHAR(255),
  current_value NUMERIC,
  threshold_value NUMERIC
) AS $$
BEGIN
  -- This is a placeholder function
  -- Actual milestone checking will be done in application code
  -- for more complex logic and external data integration
  RETURN QUERY
  SELECT
    md.id,
    md.type,
    md.name,
    0::NUMERIC as current_value,
    (md.condition->>'threshold')::NUMERIC as threshold_value
  FROM milestone_definitions md
  WHERE md.enabled = TRUE
  LIMIT 0; -- Return empty by default, app handles logic
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Add milestone notification preferences
-- ============================================
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS milestone_alerts BOOLEAN DEFAULT TRUE;

-- ============================================
-- Trigger to update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_milestone_definition_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_milestone_definitions_timestamp ON milestone_definitions;
CREATE TRIGGER update_milestone_definitions_timestamp
  BEFORE UPDATE ON milestone_definitions
  FOR EACH ROW EXECUTE FUNCTION update_milestone_definition_timestamp();
