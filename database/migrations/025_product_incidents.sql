-- PRD-097: Product Issue Alert
-- Database tables for incident management and customer impact tracking

-- ============================================
-- PRODUCT INCIDENTS
-- Main table for tracking product issues/outages
-- ============================================
CREATE TABLE IF NOT EXISTS product_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,                              -- From incident management system (PagerDuty, Opsgenie)
  title TEXT NOT NULL,
  description TEXT,
  severity VARCHAR(10) NOT NULL,                 -- P1, P2, P3, P4
  status VARCHAR(50) NOT NULL DEFAULT 'investigating', -- investigating, identified, monitoring, resolved
  affected_components TEXT[] DEFAULT '{}',       -- Array of affected service components
  affected_regions TEXT[] DEFAULT '{}',          -- Array of affected geographic regions
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  identified_at TIMESTAMPTZ,                     -- When root cause was identified
  monitoring_at TIMESTAMPTZ,                     -- When fix was deployed, monitoring
  resolved_at TIMESTAMPTZ,
  status_page_url TEXT,
  incident_commander TEXT,                       -- Who is leading the response
  root_cause TEXT,                               -- Post-incident root cause
  resolution_summary TEXT,                       -- How it was fixed
  metadata JSONB DEFAULT '{}',                   -- Additional incident data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON product_incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON product_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_started ON product_incidents(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_external_id ON product_incidents(external_id);

-- ============================================
-- INCIDENT CUSTOMER IMPACT
-- Maps incidents to affected customers
-- ============================================
CREATE TABLE IF NOT EXISTS incident_customer_impact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES product_incidents(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  impact_level VARCHAR(20) NOT NULL,             -- critical, high, medium, low, none
  reason TEXT,                                   -- Why this customer is affected
  affected_features TEXT[] DEFAULT '{}',         -- Which features are impacted for this customer
  estimated_revenue_impact NUMERIC,              -- Estimated $ impact
  csm_id UUID,                                   -- Assigned CSM for this customer
  csm_notified_at TIMESTAMPTZ,                   -- When CSM was notified
  customer_notified_at TIMESTAMPTZ,              -- When customer was notified
  outreach_status VARCHAR(50) DEFAULT 'pending', -- pending, draft_ready, sent, acknowledged, followed_up
  outreach_method VARCHAR(50),                   -- email, phone, slack
  outreach_notes TEXT,                           -- Notes from CSM outreach
  resolution_notified_at TIMESTAMPTZ,            -- When resolution notification was sent
  follow_up_scheduled_at TIMESTAMPTZ,            -- Scheduled follow-up call
  customer_sentiment VARCHAR(50),                -- positive, neutral, negative (after outreach)
  customer_feedback TEXT,                        -- Feedback from customer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(incident_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_impact_incident ON incident_customer_impact(incident_id);
CREATE INDEX IF NOT EXISTS idx_impact_customer ON incident_customer_impact(customer_id);
CREATE INDEX IF NOT EXISTS idx_impact_csm ON incident_customer_impact(csm_id);
CREATE INDEX IF NOT EXISTS idx_impact_outreach_status ON incident_customer_impact(outreach_status);
CREATE INDEX IF NOT EXISTS idx_impact_level ON incident_customer_impact(impact_level);

-- ============================================
-- INCIDENT STATUS UPDATES
-- Timeline of incident status changes
-- ============================================
CREATE TABLE IF NOT EXISTS incident_status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES product_incidents(id) ON DELETE CASCADE,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,                         -- Public update message
  internal_notes TEXT,                           -- Internal notes (not shared)
  updated_by TEXT,                               -- Who made the update
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_updates_incident ON incident_status_updates(incident_id);
CREATE INDEX IF NOT EXISTS idx_status_updates_created ON incident_status_updates(created_at DESC);

-- ============================================
-- INCIDENT MESSAGE TEMPLATES
-- Pre-approved messaging for incident communications
-- ============================================
CREATE TABLE IF NOT EXISTS incident_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,                     -- initial_notification, update, resolution, follow_up
  severity VARCHAR(10),                          -- P1, P2, P3, P4 (null = all severities)
  channel VARCHAR(50) NOT NULL,                  -- email, slack, sms
  subject_template TEXT,                         -- For emails
  body_template TEXT NOT NULL,                   -- Message body with {{placeholders}}
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO incident_message_templates (name, type, severity, channel, subject_template, body_template)
VALUES
  (
    'P1 Initial Alert - Email',
    'initial_notification',
    'P1',
    'email',
    'Service Alert: {{incident_title}} - {{company_name}}',
    'Dear {{contact_name}},

We wanted to proactively reach out to let you know about a service issue we''re currently experiencing.

**Incident Summary:**
- Issue: {{incident_title}}
- Status: {{incident_status}}
- Started: {{started_at}}
- Affected Services: {{affected_components}}

**Impact to Your Account:**
{{impact_reason}}

**What We''re Doing:**
Our engineering team is actively investigating and working to resolve this issue. We''ll provide updates every 30 minutes until the issue is resolved.

**Status Page:**
You can monitor real-time updates at: {{status_page_url}}

We sincerely apologize for any inconvenience this may cause. Please don''t hesitate to reach out if you have any questions.

Best regards,
{{csm_name}}
Your Customer Success Manager'
  ),
  (
    'P1 Resolution - Email',
    'resolution',
    'P1',
    'email',
    'RESOLVED: {{incident_title}} - {{company_name}}',
    'Dear {{contact_name}},

Good news! The service issue we reported earlier has been resolved.

**Incident Summary:**
- Issue: {{incident_title}}
- Duration: {{incident_duration}}
- Resolution: {{resolution_summary}}

**Next Steps:**
- I''d like to schedule a brief call to discuss the incident and address any concerns
- We''ll be sharing a detailed post-mortem within 48 hours

Thank you for your patience during this incident. We''re committed to learning from this and improving our service reliability.

Best regards,
{{csm_name}}
Your Customer Success Manager'
  ),
  (
    'P1 Initial Alert - Slack',
    'initial_notification',
    'P1',
    'slack',
    NULL,
    ':rotating_light: *P1 INCIDENT: {{incident_title}}*

*Incident:* {{incident_id}}
*Status:* {{incident_status}}
*Started:* {{started_at}}

*Affected Components:*
{{affected_components_list}}

*Your Affected Customers ({{affected_count}}):*
{{affected_customers_list}}

*Total ARR at Risk:* ${{total_arr_at_risk}}

*Approved Messaging:*
> "We''re currently experiencing {{incident_title}}. Our engineering team is actively investigating. We''ll provide updates every 30 minutes."

<{{status_page_url}}|View Status Page> | <{{draft_emails_url}}|Draft Customer Emails> | <{{war_room_url}}|Join War Room>'
  ),
  (
    'Resolution Alert - Slack',
    'resolution',
    NULL,
    'slack',
    NULL,
    ':white_check_mark: *INCIDENT RESOLVED: {{incident_title}}*

*Incident:* {{incident_id}}
*Duration:* {{incident_duration}}
*Resolution:* {{resolution_summary}}

*Affected Customers:* {{affected_count}}

*Next Steps:*
1. Send resolution notification to affected customers
2. Schedule follow-up calls for high-impact customers
3. Prepare post-mortem summary

<{{send_resolution_url}}|Send Resolution Emails> | <{{schedule_followups_url}}|Schedule Follow-ups> | <{{postmortem_url}}|View Post-Mortem>'
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- COMPONENT CUSTOMER MAPPING
-- Maps product components to customers using them
-- ============================================
CREATE TABLE IF NOT EXISTS component_customer_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name TEXT NOT NULL,                  -- e.g., "API Gateway", "Data Processing Pipeline"
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  usage_level VARCHAR(20) DEFAULT 'standard',    -- critical, heavy, standard, light
  is_integration_dependent BOOLEAN DEFAULT FALSE, -- True if customer relies on integrations
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(component_name, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_component_mapping_component ON component_customer_mapping(component_name);
CREATE INDEX IF NOT EXISTS idx_component_mapping_customer ON component_customer_mapping(customer_id);
CREATE INDEX IF NOT EXISTS idx_component_mapping_usage ON component_customer_mapping(usage_level);

-- ============================================
-- REGION CUSTOMER MAPPING
-- Maps geographic regions to customers
-- ============================================
CREATE TABLE IF NOT EXISTS region_customer_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_name TEXT NOT NULL,                     -- e.g., "us-east-1", "eu-west-1"
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  is_primary_region BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_name, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_region_mapping_region ON region_customer_mapping(region_name);
CREATE INDEX IF NOT EXISTS idx_region_mapping_customer ON region_customer_mapping(customer_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to auto-update timestamps
CREATE OR REPLACE FUNCTION update_incident_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_product_incidents_timestamp ON product_incidents;
CREATE TRIGGER update_product_incidents_timestamp
  BEFORE UPDATE ON product_incidents
  FOR EACH ROW EXECUTE FUNCTION update_incident_timestamp();

DROP TRIGGER IF EXISTS update_incident_customer_impact_timestamp ON incident_customer_impact;
CREATE TRIGGER update_incident_customer_impact_timestamp
  BEFORE UPDATE ON incident_customer_impact
  FOR EACH ROW EXECUTE FUNCTION update_incident_timestamp();

DROP TRIGGER IF EXISTS update_component_customer_mapping_timestamp ON component_customer_mapping;
CREATE TRIGGER update_component_customer_mapping_timestamp
  BEFORE UPDATE ON component_customer_mapping
  FOR EACH ROW EXECUTE FUNCTION update_incident_timestamp();

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Sample component mappings for existing customers
INSERT INTO component_customer_mapping (component_name, customer_id, usage_level, is_integration_dependent)
SELECT
  'API Gateway',
  c.id,
  CASE
    WHEN c.arr > 500000 THEN 'critical'
    WHEN c.arr > 200000 THEN 'heavy'
    WHEN c.arr > 50000 THEN 'standard'
    ELSE 'light'
  END,
  TRUE
FROM customers c
WHERE c.industry = 'Technology'
ON CONFLICT DO NOTHING;

INSERT INTO component_customer_mapping (component_name, customer_id, usage_level, is_integration_dependent)
SELECT
  'Data Processing Pipeline',
  c.id,
  'standard',
  FALSE
FROM customers c
ON CONFLICT DO NOTHING;

-- Sample region mappings
INSERT INTO region_customer_mapping (region_name, customer_id, is_primary_region)
SELECT 'us-east-1', c.id, TRUE
FROM customers c
WHERE c.industry IN ('Finance', 'Healthcare')
ON CONFLICT DO NOTHING;

INSERT INTO region_customer_mapping (region_name, customer_id, is_primary_region)
SELECT 'us-west-2', c.id, TRUE
FROM customers c
WHERE c.industry = 'Technology'
ON CONFLICT DO NOTHING;

-- ============================================
-- VIEWS
-- ============================================

-- View for active incidents with customer counts
CREATE OR REPLACE VIEW active_incidents_summary AS
SELECT
  i.id,
  i.external_id,
  i.title,
  i.severity,
  i.status,
  i.affected_components,
  i.affected_regions,
  i.started_at,
  i.status_page_url,
  EXTRACT(EPOCH FROM (COALESCE(i.resolved_at, NOW()) - i.started_at)) / 60 AS duration_minutes,
  COUNT(DISTINCT ici.customer_id) AS affected_customer_count,
  COUNT(DISTINCT CASE WHEN ici.impact_level = 'critical' THEN ici.customer_id END) AS critical_impact_count,
  COUNT(DISTINCT CASE WHEN ici.impact_level = 'high' THEN ici.customer_id END) AS high_impact_count,
  SUM(CASE WHEN c.arr IS NOT NULL THEN c.arr ELSE 0 END) AS total_arr_at_risk,
  COUNT(DISTINCT CASE WHEN ici.outreach_status = 'sent' THEN ici.customer_id END) AS customers_notified,
  COUNT(DISTINCT CASE WHEN ici.outreach_status = 'pending' THEN ici.customer_id END) AS customers_pending
FROM product_incidents i
LEFT JOIN incident_customer_impact ici ON i.id = ici.incident_id
LEFT JOIN customers c ON ici.customer_id = c.id
WHERE i.status != 'resolved'
GROUP BY i.id;

-- View for CSM incident dashboard
CREATE OR REPLACE VIEW csm_incident_dashboard AS
SELECT
  ici.csm_id,
  i.id AS incident_id,
  i.title AS incident_title,
  i.severity,
  i.status,
  i.started_at,
  c.id AS customer_id,
  c.name AS customer_name,
  c.arr,
  c.health_score,
  ici.impact_level,
  ici.reason AS impact_reason,
  ici.outreach_status,
  ici.csm_notified_at,
  ici.customer_notified_at
FROM incident_customer_impact ici
JOIN product_incidents i ON ici.incident_id = i.id
JOIN customers c ON ici.customer_id = c.id
WHERE i.status != 'resolved'
ORDER BY
  CASE i.severity WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
  CASE ici.impact_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
  c.arr DESC;
