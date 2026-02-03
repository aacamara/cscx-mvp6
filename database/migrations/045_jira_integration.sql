-- ============================================
-- PRD-201: Jira Issue Tracking Integration
-- Migration: 045_jira_integration.sql
-- ============================================

-- Add Jira customer ID to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS jira_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_jira_id ON customers(jira_customer_id);

-- ============================================
-- JIRA ISSUES
-- Stores synced issues from Jira
-- ============================================
CREATE TABLE IF NOT EXISTS jira_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_key TEXT UNIQUE NOT NULL,
  jira_id TEXT NOT NULL,
  project_key TEXT NOT NULL,

  -- Issue details
  summary TEXT,
  description TEXT,
  issue_type VARCHAR(50),
  status VARCHAR(50),
  status_category VARCHAR(20), -- 'new', 'indeterminate', 'done'
  priority VARCHAR(50),
  resolution VARCHAR(50),

  -- People
  assignee TEXT,
  assignee_email TEXT,
  reporter TEXT,

  -- Categorization
  labels TEXT[],
  components TEXT[],

  -- Timestamps
  jira_created_at TIMESTAMPTZ,
  jira_updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- CSCX timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jira_issues_key ON jira_issues(jira_key);
CREATE INDEX IF NOT EXISTS idx_jira_issues_project ON jira_issues(project_key);
CREATE INDEX IF NOT EXISTS idx_jira_issues_status ON jira_issues(status);
CREATE INDEX IF NOT EXISTS idx_jira_issues_status_cat ON jira_issues(status_category);
CREATE INDEX IF NOT EXISTS idx_jira_issues_priority ON jira_issues(priority);
CREATE INDEX IF NOT EXISTS idx_jira_issues_type ON jira_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_jira_issues_created ON jira_issues(jira_created_at);
CREATE INDEX IF NOT EXISTS idx_jira_issues_updated ON jira_issues(jira_updated_at);

-- Auto-update timestamp trigger
CREATE TRIGGER update_jira_issues_timestamp
  BEFORE UPDATE ON jira_issues
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- JIRA CUSTOMER LINKS
-- Links issues to customers (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS jira_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_key TEXT REFERENCES jira_issues(jira_key) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  link_type VARCHAR(20) CHECK (link_type IN ('affected', 'requested', 'watching')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(jira_key, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_jira_links_key ON jira_customer_links(jira_key);
CREATE INDEX IF NOT EXISTS idx_jira_links_customer ON jira_customer_links(customer_id);
CREATE INDEX IF NOT EXISTS idx_jira_links_type ON jira_customer_links(link_type);

-- ============================================
-- JIRA METRICS
-- Daily issue metrics per customer
-- ============================================
CREATE TABLE IF NOT EXISTS jira_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  metric_date DATE NOT NULL,

  -- Issue counts
  open_bugs INTEGER DEFAULT 0,
  open_feature_requests INTEGER DEFAULT 0,
  total_open_issues INTEGER DEFAULT 0,
  resolved_last_7d INTEGER DEFAULT 0,
  resolved_last_30d INTEGER DEFAULT 0,

  -- Performance metrics
  avg_resolution_days NUMERIC,

  -- Priority counts
  critical_issues INTEGER DEFAULT 0,
  high_priority_issues INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_jira_metrics_customer ON jira_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_jira_metrics_date ON jira_metrics(metric_date);

-- Auto-update timestamp trigger
CREATE TRIGGER update_jira_metrics_timestamp
  BEFORE UPDATE ON jira_metrics
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- JIRA SYNC LOG
-- Track sync operations for auditing
-- ============================================
CREATE TABLE IF NOT EXISTS jira_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID,

  -- Sync details
  object_type VARCHAR(50) NOT NULL, -- 'issues'
  sync_type VARCHAR(50) NOT NULL,   -- 'full', 'incremental'
  status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),

  -- Counts
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Error tracking
  error_details TEXT[],

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jira_sync_log_user ON jira_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_jira_sync_log_started ON jira_sync_log(started_at);

-- ============================================
-- JIRA ALERTS
-- Store triggered alerts for CSM notification
-- ============================================
CREATE TABLE IF NOT EXISTS jira_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  jira_key TEXT REFERENCES jira_issues(jira_key) ON DELETE CASCADE,

  -- Alert details
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('issue_resolved', 'priority_escalated', 'critical_issue', 'sla_breach')),
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT,
  metadata JSONB DEFAULT '{}',

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jira_alerts_customer ON jira_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_jira_alerts_type ON jira_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_jira_alerts_status ON jira_alerts(status);
CREATE INDEX IF NOT EXISTS idx_jira_alerts_created ON jira_alerts(created_at);

-- ============================================
-- UPDATE integration_connections TABLE
-- Add Jira-specific columns
-- ============================================
ALTER TABLE integration_connections
ADD COLUMN IF NOT EXISTS base_url TEXT,
ADD COLUMN IF NOT EXISTS cloud_id TEXT,
ADD COLUMN IF NOT EXISTS customer_link_config JSONB DEFAULT '{"type": "label", "labelPrefix": "customer_"}',
ADD COLUMN IF NOT EXISTS sync_closed_issues BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS project_keys TEXT[];

-- ============================================
-- FUNCTION: Calculate Jira issue health impact
-- Returns a score modifier based on issue metrics
-- ============================================
CREATE OR REPLACE FUNCTION calculate_jira_health_impact(p_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_metrics RECORD;
  v_impact INTEGER := 0;
  v_weight INTEGER;
BEGIN
  -- Get latest metrics for customer
  SELECT * INTO v_metrics
  FROM jira_metrics
  WHERE customer_id = p_customer_id
  ORDER BY metric_date DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Get health score weight from integration config (default 10)
  SELECT COALESCE(health_score_weight, 10) INTO v_weight
  FROM integration_connections
  WHERE provider = 'jira'
  LIMIT 1;

  -- Calculate impact based on metrics
  -- Open bugs: -2 per bug (max -15)
  v_impact := v_impact - LEAST(v_metrics.open_bugs * 2, 15);

  -- Critical issues: -5 per issue (max -20)
  v_impact := v_impact - LEAST(v_metrics.critical_issues * 5, 20);

  -- High priority issues: -2 per issue (max -10)
  v_impact := v_impact - LEAST(v_metrics.high_priority_issues * 2, 10);

  -- Recently resolved issues: +1 per issue (max +10)
  v_impact := v_impact + LEAST(v_metrics.resolved_last_7d, 10);

  -- Scale by weight factor
  v_impact := (v_impact * v_weight) / 100;

  RETURN v_impact;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Customer Issue Summary
-- Aggregated issue view for customer detail
-- ============================================
CREATE OR REPLACE VIEW customer_issue_summary AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  COALESCE(m.open_bugs, 0) as open_bugs,
  COALESCE(m.open_feature_requests, 0) as open_feature_requests,
  COALESCE(m.total_open_issues, 0) as total_open_issues,
  COALESCE(m.critical_issues, 0) as critical_issues,
  COALESCE(m.high_priority_issues, 0) as high_priority_issues,
  COALESCE(m.resolved_last_7d, 0) as resolved_last_7d,
  COALESCE(m.resolved_last_30d, 0) as resolved_last_30d,
  m.avg_resolution_days,
  m.metric_date as last_updated,
  calculate_jira_health_impact(c.id) as health_impact
FROM customers c
LEFT JOIN LATERAL (
  SELECT *
  FROM jira_metrics jm
  WHERE jm.customer_id = c.id
  ORDER BY metric_date DESC
  LIMIT 1
) m ON true;

-- ============================================
-- VIEW: Issue Impact Analysis
-- Shows which customers are affected by each issue
-- ============================================
CREATE OR REPLACE VIEW issue_impact_analysis AS
SELECT
  ji.jira_key,
  ji.summary,
  ji.issue_type,
  ji.status,
  ji.priority,
  COUNT(DISTINCT jcl.customer_id) as affected_customer_count,
  ARRAY_AGG(DISTINCT c.name) as affected_customers,
  SUM(c.health_score) / COUNT(DISTINCT jcl.customer_id) as avg_customer_health,
  SUM(c.arr) as total_affected_arr
FROM jira_issues ji
JOIN jira_customer_links jcl ON ji.jira_key = jcl.jira_key
JOIN customers c ON jcl.customer_id = c.id
WHERE ji.status_category != 'done'
GROUP BY ji.jira_key, ji.summary, ji.issue_type, ji.status, ji.priority
ORDER BY affected_customer_count DESC, total_affected_arr DESC;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE jira_issues IS 'PRD-201: Synced issues from Jira';
COMMENT ON TABLE jira_customer_links IS 'PRD-201: Links between Jira issues and CSCX customers';
COMMENT ON TABLE jira_metrics IS 'PRD-201: Daily aggregated issue metrics per customer';
COMMENT ON TABLE jira_sync_log IS 'PRD-201: Audit log for Jira sync operations';
COMMENT ON TABLE jira_alerts IS 'PRD-201: Issue alerts for CSM notification';
COMMENT ON FUNCTION calculate_jira_health_impact IS 'PRD-201: Calculate health score modifier from issue metrics';
COMMENT ON VIEW customer_issue_summary IS 'PRD-201: Aggregated issue summary for customer views';
COMMENT ON VIEW issue_impact_analysis IS 'PRD-201: Shows customer impact per issue for prioritization';
