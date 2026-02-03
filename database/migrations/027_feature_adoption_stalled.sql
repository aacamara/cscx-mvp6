-- ============================================
-- PRD-090: Feature Adoption Stalled - Enablement
-- Migration: 027_feature_adoption_stalled.sql
-- Created: 2026-01-29
-- ============================================

-- Feature catalog with training resources
CREATE TABLE IF NOT EXISTS feature_catalog (
  feature_id VARCHAR(100) PRIMARY KEY,
  feature_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  importance_score INTEGER DEFAULT 50 CHECK (importance_score >= 0 AND importance_score <= 100),
  expected_adoption_days INTEGER DEFAULT 30,
  training_resources JSONB DEFAULT '[]',
  tips TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature adoption tracking per customer
CREATE TABLE IF NOT EXISTS feature_adoption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  feature_id VARCHAR(100) REFERENCES feature_catalog(feature_id) ON DELETE CASCADE,
  feature_name VARCHAR(255) NOT NULL,
  activated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  usage_score INTEGER DEFAULT 0 CHECK (usage_score >= 0 AND usage_score <= 100),
  stage VARCHAR(50) DEFAULT 'not_started' CHECK (stage IN ('not_started', 'started', 'engaged', 'adopted', 'churned')),
  expected_adoption_days INTEGER DEFAULT 30,
  stall_detected_at TIMESTAMPTZ,
  intervention_sent_at TIMESTAMPTZ,
  intervention_type VARCHAR(50) CHECK (intervention_type IN ('email', 'call', 'training', 'resource_share', 'in_app_tip')),
  adoption_after_intervention INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, feature_id)
);

-- Enablement interventions log
CREATE TABLE IF NOT EXISTS enablement_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_adoption_id UUID REFERENCES feature_adoption(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  feature_id VARCHAR(100) REFERENCES feature_catalog(feature_id) ON DELETE CASCADE,
  intervention_type VARCHAR(50) NOT NULL CHECK (intervention_type IN ('email', 'call', 'training', 'resource_share', 'in_app_tip')),
  details TEXT,
  resources_shared JSONB DEFAULT '[]',
  sent_by UUID,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  response_received BOOLEAN DEFAULT FALSE,
  response_at TIMESTAMPTZ,
  adoption_score_before INTEGER,
  adoption_score_after INTEGER,
  effectiveness_score INTEGER CHECK (effectiveness_score >= 0 AND effectiveness_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_adoption_customer ON feature_adoption(customer_id);
CREATE INDEX IF NOT EXISTS idx_feature_adoption_feature ON feature_adoption(feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_adoption_stage ON feature_adoption(stage);
CREATE INDEX IF NOT EXISTS idx_feature_adoption_stall ON feature_adoption(stall_detected_at) WHERE stall_detected_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feature_catalog_category ON feature_catalog(category);
CREATE INDEX IF NOT EXISTS idx_feature_catalog_importance ON feature_catalog(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_enablement_customer ON enablement_interventions(customer_id);
CREATE INDEX IF NOT EXISTS idx_enablement_feature ON enablement_interventions(feature_id);

-- Add trigger for updated_at on feature_adoption
CREATE TRIGGER update_feature_adoption_timestamp
  BEFORE UPDATE ON feature_adoption
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_feature_catalog_timestamp
  BEFORE UPDATE ON feature_catalog
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- Seed initial feature catalog
-- ============================================
INSERT INTO feature_catalog (feature_id, feature_name, category, importance_score, expected_adoption_days, training_resources, tips)
VALUES
  ('advanced_analytics', 'Advanced Analytics Dashboard', 'Analytics', 90, 30, '[
    {"type": "video", "title": "Getting Started with Advanced Analytics", "url": "https://training.example.com/advanced-analytics", "duration_minutes": 15, "level": "beginner"},
    {"type": "documentation", "title": "Advanced Analytics User Guide", "url": "https://docs.example.com/advanced-analytics"},
    {"type": "webinar", "title": "Advanced Analytics Best Practices", "url": "https://training.example.com/webinars/analytics-best-practices"}
  ]', 'Start by creating your first custom dashboard. Most users find value within the first week of regular use.'),

  ('api_integrations', 'API Integrations', 'Development', 85, 45, '[
    {"type": "video", "title": "API Integration Overview", "url": "https://training.example.com/api-overview", "duration_minutes": 20, "level": "intermediate"},
    {"type": "documentation", "title": "API Reference Guide", "url": "https://docs.example.com/api-reference"},
    {"type": "documentation", "title": "Integration Patterns", "url": "https://docs.example.com/integration-patterns"}
  ]', 'Begin with our pre-built connectors before building custom integrations.'),

  ('automated_workflows', 'Automated Workflows', 'Automation', 80, 30, '[
    {"type": "video", "title": "Workflow Automation 101", "url": "https://training.example.com/workflows-101", "duration_minutes": 12, "level": "beginner"},
    {"type": "documentation", "title": "Workflow Builder Guide", "url": "https://docs.example.com/workflow-builder"},
    {"type": "webinar", "title": "Automation Best Practices", "url": "https://training.example.com/webinars/automation"}
  ]', 'Start with a simple notification workflow, then expand to more complex automations.'),

  ('collaboration_tools', 'Collaboration Tools', 'Collaboration', 75, 21, '[
    {"type": "video", "title": "Team Collaboration Features", "url": "https://training.example.com/collaboration", "duration_minutes": 10, "level": "beginner"},
    {"type": "documentation", "title": "Collaboration Guide", "url": "https://docs.example.com/collaboration"}
  ]', 'Invite your team members and create your first shared workspace.'),

  ('custom_reports', 'Custom Reports', 'Analytics', 70, 30, '[
    {"type": "video", "title": "Building Custom Reports", "url": "https://training.example.com/custom-reports", "duration_minutes": 18, "level": "intermediate"},
    {"type": "documentation", "title": "Report Builder Reference", "url": "https://docs.example.com/reports"}
  ]', 'Use report templates as a starting point before creating fully custom reports.'),

  ('mobile_app', 'Mobile App', 'Platform', 65, 14, '[
    {"type": "video", "title": "Mobile App Tour", "url": "https://training.example.com/mobile-tour", "duration_minutes": 5, "level": "beginner"},
    {"type": "documentation", "title": "Mobile App Setup", "url": "https://docs.example.com/mobile-setup"}
  ]', 'Download from App Store or Google Play and enable notifications for important alerts.'),

  ('data_export', 'Data Export', 'Data', 60, 21, '[
    {"type": "documentation", "title": "Data Export Guide", "url": "https://docs.example.com/data-export"}
  ]', 'Schedule automated exports for regular data backup and analysis.'),

  ('sso_integration', 'SSO Integration', 'Security', 85, 14, '[
    {"type": "video", "title": "SSO Setup Guide", "url": "https://training.example.com/sso-setup", "duration_minutes": 8, "level": "intermediate"},
    {"type": "documentation", "title": "SSO Configuration", "url": "https://docs.example.com/sso"}
  ]', 'Contact your IT team to configure SAML or OIDC settings.'),

  ('alerts_notifications', 'Alerts & Notifications', 'Core', 75, 14, '[
    {"type": "video", "title": "Setting Up Alerts", "url": "https://training.example.com/alerts", "duration_minutes": 8, "level": "beginner"},
    {"type": "documentation", "title": "Notification Settings", "url": "https://docs.example.com/notifications"}
  ]', 'Start with threshold-based alerts for your most critical metrics.'),

  ('admin_console', 'Admin Console', 'Administration', 70, 21, '[
    {"type": "video", "title": "Admin Console Overview", "url": "https://training.example.com/admin-console", "duration_minutes": 15, "level": "intermediate"},
    {"type": "documentation", "title": "Admin Guide", "url": "https://docs.example.com/admin"}
  ]', 'Configure user roles and permissions to match your organization structure.')
ON CONFLICT (feature_id) DO NOTHING;

-- ============================================
-- Helper function to calculate adoption stage
-- ============================================
CREATE OR REPLACE FUNCTION calculate_adoption_stage(
  p_usage_score INTEGER,
  p_days_since_activation INTEGER
) RETURNS VARCHAR(50) AS $$
BEGIN
  IF p_usage_score IS NULL OR p_days_since_activation IS NULL THEN
    RETURN 'not_started';
  END IF;

  IF p_usage_score = 0 AND p_days_since_activation > 7 THEN
    RETURN 'not_started';
  ELSIF p_usage_score < 20 THEN
    RETURN 'started';
  ELSIF p_usage_score < 60 THEN
    RETURN 'engaged';
  ELSE
    RETURN 'adopted';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- View for customer adoption summary
-- ============================================
CREATE OR REPLACE VIEW customer_adoption_summary AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  c.arr,
  c.health_score,
  COUNT(fa.id) as total_features,
  COUNT(CASE WHEN fa.stage = 'adopted' THEN 1 END) as adopted_features,
  COUNT(CASE WHEN fa.stall_detected_at IS NOT NULL AND fa.stage != 'adopted' THEN 1 END) as stalled_features,
  ROUND(AVG(fa.usage_score)) as avg_usage_score,
  ROUND(
    (COUNT(CASE WHEN fa.stage = 'adopted' THEN 1 END)::DECIMAL / NULLIF(COUNT(fa.id), 0)) * 100
  ) as adoption_percentage
FROM customers c
LEFT JOIN feature_adoption fa ON c.id = fa.customer_id
GROUP BY c.id, c.name, c.arr, c.health_score;

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE feature_catalog IS 'PRD-090: Feature catalog with training resources and expected adoption timelines';
COMMENT ON TABLE feature_adoption IS 'PRD-090: Per-customer feature adoption tracking with stall detection';
COMMENT ON TABLE enablement_interventions IS 'PRD-090: Log of enablement interventions sent to customers';
COMMENT ON COLUMN feature_adoption.stage IS 'Adoption stages: not_started -> started -> engaged -> adopted (or churned)';
COMMENT ON COLUMN feature_adoption.stall_detected_at IS 'Set when adoption stalls - cleared when adoption resumes';
