-- Migration: 008_agent_data_tables.sql
-- Description: Add tables for full agent functionality (Adoption, Renewal, Risk, Strategic)
-- Created: 2026-01-22

-- ============================================
-- USAGE METRICS (Adoption Agent)
-- ============================================
-- Stores daily/weekly/monthly usage data per customer
-- Used for: usage_analysis, adoption tracking, champion identification

CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,

  -- Core metrics
  dau INT DEFAULT 0,                          -- Daily Active Users
  wau INT DEFAULT 0,                          -- Weekly Active Users
  mau INT DEFAULT 0,                          -- Monthly Active Users

  -- Engagement metrics
  login_count INT DEFAULT 0,                  -- Total logins
  api_calls INT DEFAULT 0,                    -- API usage
  session_duration_avg INT DEFAULT 0,         -- Average session (minutes)
  active_users INT DEFAULT 0,                 -- Unique active users

  -- Feature adoption (JSON: { feature_name: { adopted: boolean, usage_count: int } })
  feature_adoption JSONB DEFAULT '{}',

  -- Trends
  usage_trend VARCHAR(20) DEFAULT 'stable',   -- growing, stable, declining
  adoption_score INT DEFAULT 0 CHECK (adoption_score BETWEEN 0 AND 100),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_customer_date ON usage_metrics(customer_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_trend ON usage_metrics(usage_trend) WHERE usage_trend = 'declining';

-- ============================================
-- RENEWAL PIPELINE (Renewal Agent)
-- ============================================
-- Tracks renewal status and progression for each customer
-- Used for: renewal_forecast, value_summary, expansion_analysis

CREATE TABLE IF NOT EXISTS renewal_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Renewal details
  renewal_date DATE NOT NULL,
  current_arr DECIMAL(12,2),
  proposed_arr DECIMAL(12,2),
  probability INT DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),

  -- Pipeline stage
  stage VARCHAR(50) DEFAULT 'early',          -- early, mid, late, final, closed_won, closed_lost

  -- Risk & opportunity
  risk_factors JSONB DEFAULT '[]',            -- Array of risk factor strings
  expansion_potential DECIMAL(12,2) DEFAULT 0,

  -- Engagement tracking
  champion_engaged BOOLEAN DEFAULT FALSE,
  exec_sponsor_engaged BOOLEAN DEFAULT FALSE,

  -- Checklist items
  qbr_completed BOOLEAN DEFAULT FALSE,
  value_summary_sent BOOLEAN DEFAULT FALSE,
  proposal_sent BOOLEAN DEFAULT FALSE,
  verbal_commit BOOLEAN DEFAULT FALSE,
  contract_signed BOOLEAN DEFAULT FALSE,

  -- Notes & next steps
  notes TEXT,
  last_contact_date DATE,
  next_action TEXT,
  next_action_date DATE,

  -- Ownership
  owner_id UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renewal_pipeline_date ON renewal_pipeline(renewal_date);
CREATE INDEX IF NOT EXISTS idx_renewal_pipeline_stage ON renewal_pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_renewal_pipeline_customer ON renewal_pipeline(customer_id);

-- ============================================
-- EXPANSION OPPORTUNITIES (Renewal Agent)
-- ============================================
-- Tracks upsell/cross-sell opportunities
-- Used for: expansion_analysis, renewal_playbook

CREATE TABLE IF NOT EXISTS expansion_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Opportunity details
  opportunity_type VARCHAR(50) NOT NULL,      -- upsell, cross-sell, add-seats, new-product
  product_line VARCHAR(100),
  estimated_value DECIMAL(12,2),
  probability INT DEFAULT 25 CHECK (probability BETWEEN 0 AND 100),

  -- Pipeline stage
  stage VARCHAR(50) DEFAULT 'identified',     -- identified, qualified, proposed, negotiating, closed_won, closed_lost

  -- Stakeholder
  champion_id UUID REFERENCES stakeholders(id),

  -- Context
  use_case TEXT,
  competitive_threat VARCHAR(100),
  timeline VARCHAR(50),                       -- immediate, this_quarter, next_quarter, next_year
  blockers JSONB DEFAULT '[]',
  next_steps TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expansion_customer ON expansion_opportunities(customer_id);
CREATE INDEX IF NOT EXISTS idx_expansion_stage ON expansion_opportunities(stage);

-- ============================================
-- RISK SIGNALS (Risk Agent)
-- ============================================
-- Tracks detected risk signals for each customer
-- Used for: risk_assessment, save_play, escalation

CREATE TABLE IF NOT EXISTS risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Signal details
  signal_type VARCHAR(50) NOT NULL,           -- usage_drop, champion_left, support_escalation, nps_detractor, payment_issue, competitor_threat
  severity VARCHAR(20) DEFAULT 'medium',      -- low, medium, high, critical
  description TEXT,

  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Source
  auto_detected BOOLEAN DEFAULT FALSE,
  source VARCHAR(50),                         -- system, manual, integration, agent

  -- Additional context
  metadata JSONB DEFAULT '{}',

  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_risk_signals_customer ON risk_signals(customer_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_signals_unresolved ON risk_signals(customer_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_risk_signals_severity ON risk_signals(severity) WHERE resolved_at IS NULL;

-- ============================================
-- SAVE PLAYS (Risk Agent)
-- ============================================
-- Tracks churn prevention efforts
-- Used for: save_play, escalation, recovery

CREATE TABLE IF NOT EXISTS save_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  playbook_id UUID REFERENCES playbooks(id),

  -- Status tracking
  status VARCHAR(50) DEFAULT 'active',        -- active, paused, completed, cancelled
  risk_level VARCHAR(20),                     -- low, medium, high, critical

  -- Issue details
  primary_issue TEXT NOT NULL,
  root_cause TEXT,
  action_plan JSONB DEFAULT '[]',             -- Array of action items with status
  success_criteria TEXT,
  deadline DATE,

  -- Ownership & escalation
  owner_id UUID REFERENCES users(id),
  escalation_level INT DEFAULT 0,             -- 0=CSM, 1=Manager, 2=Director, 3=VP

  -- Outcome
  outcome VARCHAR(50),                        -- saved, churned, downgraded, in_progress
  outcome_notes TEXT,

  -- Financial impact
  arr_at_risk DECIMAL(12,2),
  arr_saved DECIMAL(12,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_save_plays_customer ON save_plays(customer_id);
CREATE INDEX IF NOT EXISTS idx_save_plays_status ON save_plays(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_save_plays_risk ON save_plays(risk_level) WHERE status = 'active';

-- ============================================
-- QBR RECORDS (Strategic Agent)
-- ============================================
-- Tracks Quarterly Business Reviews
-- Used for: qbr_prep, exec_briefing, strategic planning

CREATE TABLE IF NOT EXISTS qbrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- QBR details
  quarter VARCHAR(10) NOT NULL,               -- Q1 2026, Q2 2026, etc.
  scheduled_date DATE,
  completed_date DATE,
  status VARCHAR(50) DEFAULT 'planned',       -- planned, scheduled, completed, cancelled, rescheduled

  -- Attendees
  attendees JSONB DEFAULT '[]',               -- Array of { name, email, role, attended }
  exec_sponsor_attended BOOLEAN DEFAULT FALSE,

  -- Materials
  presentation_url TEXT,                      -- Google Slides link
  recording_url TEXT,

  -- Content
  summary TEXT,
  wins JSONB DEFAULT '[]',                    -- Array of achievements
  challenges JSONB DEFAULT '[]',              -- Array of challenges discussed
  action_items JSONB DEFAULT '[]',            -- Array of { task, owner, due_date, status }

  -- Metrics at time of QBR
  nps_score INT,
  health_score_at_qbr INT,

  -- Topics covered
  expansion_discussed BOOLEAN DEFAULT FALSE,
  renewal_discussed BOOLEAN DEFAULT FALSE,

  -- Ownership
  created_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qbrs_customer ON qbrs(customer_id);
CREATE INDEX IF NOT EXISTS idx_qbrs_quarter ON qbrs(quarter);
CREATE INDEX IF NOT EXISTS idx_qbrs_status ON qbrs(status);

-- ============================================
-- ACCOUNT PLANS (Strategic Agent)
-- ============================================
-- Tracks strategic account plans
-- Used for: account_plan, success_plan, strategic planning

CREATE TABLE IF NOT EXISTS account_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Plan details
  fiscal_year VARCHAR(10) NOT NULL,           -- FY2026, FY2027
  status VARCHAR(50) DEFAULT 'draft',         -- draft, active, archived

  -- Strategic content
  strategic_objectives JSONB DEFAULT '[]',    -- Array of { objective, target_date, status, progress }
  success_metrics JSONB DEFAULT '[]',         -- Array of { metric, baseline, target, current }
  stakeholder_map JSONB DEFAULT '{}',         -- Nested stakeholder relationships
  relationship_goals JSONB DEFAULT '[]',      -- Array of relationship objectives

  -- Growth strategy
  expansion_targets JSONB DEFAULT '[]',       -- Array of expansion opportunities
  risk_mitigation JSONB DEFAULT '[]',         -- Array of risk mitigation plans

  -- Engagement cadence
  qbr_schedule JSONB DEFAULT '[]',            -- Planned QBR dates
  resource_allocation JSONB DEFAULT '{}',     -- Team assignments

  -- Context
  competitive_landscape TEXT,
  notes TEXT,

  -- Ownership & approval
  owner_id UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_account_plans_customer ON account_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_account_plans_year ON account_plans(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_account_plans_status ON account_plans(status);

-- ============================================
-- AGENT ACTIVITY LOG
-- ============================================
-- Tracks all agent actions for audit and analytics
-- Used for: observability, debugging, learning

CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),

  -- Agent details
  agent_type VARCHAR(50) NOT NULL,            -- onboarding, adoption, renewal, risk, strategic
  action_type VARCHAR(100) NOT NULL,          -- e.g., kickoff, usage_analysis, renewal_forecast

  -- Action details
  action_data JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',

  -- Status
  status VARCHAR(20) DEFAULT 'completed',     -- pending, completed, failed, cancelled
  error_message TEXT,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,

  -- Tracing
  session_id VARCHAR(100),
  parent_action_id UUID REFERENCES agent_activity_log(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_customer ON agent_activity_log(customer_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_activity_type ON agent_activity_log(agent_type, action_type);
CREATE INDEX IF NOT EXISTS idx_agent_activity_session ON agent_activity_log(session_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
    AND table_schema = 'public'
    AND table_name IN ('renewal_pipeline', 'expansion_opportunities', 'account_plans')
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END;
$$ language 'plpgsql';

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================

-- Insert sample usage metrics for existing customers
-- Uses only columns that exist in customers table
INSERT INTO usage_metrics (customer_id, metric_date, dau, wau, mau, login_count, active_users, usage_trend, adoption_score)
SELECT
  c.id,
  CURRENT_DATE - (n * INTERVAL '1 day'),
  (random() * 50 + 10)::int,
  (random() * 100 + 50)::int,
  (random() * 200 + 100)::int,
  (random() * 100 + 20)::int,
  (random() * 30 + 5)::int,
  CASE WHEN random() > 0.7 THEN 'growing' WHEN random() > 0.3 THEN 'stable' ELSE 'declining' END,
  (random() * 40 + 50)::int
FROM customers c, generate_series(0, 29) n
ON CONFLICT (customer_id, metric_date) DO NOTHING;

-- Insert renewal pipeline entries for customers
INSERT INTO renewal_pipeline (customer_id, renewal_date, current_arr, proposed_arr, probability, stage)
SELECT
  c.id,
  COALESCE(c.renewal_date, CURRENT_DATE + INTERVAL '90 days'),
  c.arr,
  c.arr * 1.1, -- 10% uplift target
  CASE
    WHEN c.health_score >= 80 THEN 85
    WHEN c.health_score >= 60 THEN 65
    ELSE 40
  END,
  CASE
    WHEN COALESCE(c.renewal_date, CURRENT_DATE + INTERVAL '90 days') <= CURRENT_DATE + INTERVAL '30 days' THEN 'late'
    WHEN COALESCE(c.renewal_date, CURRENT_DATE + INTERVAL '90 days') <= CURRENT_DATE + INTERVAL '60 days' THEN 'mid'
    ELSE 'early'
  END
FROM customers c
WHERE c.arr > 0
ON CONFLICT DO NOTHING;

COMMENT ON TABLE usage_metrics IS 'Daily usage metrics per customer for Adoption Agent analysis';
COMMENT ON TABLE renewal_pipeline IS 'Renewal tracking and forecasting for Renewal Agent';
COMMENT ON TABLE expansion_opportunities IS 'Upsell/cross-sell opportunities for Renewal Agent';
COMMENT ON TABLE risk_signals IS 'Detected risk signals for Risk Agent monitoring';
COMMENT ON TABLE save_plays IS 'Churn prevention campaigns for Risk Agent';
COMMENT ON TABLE qbrs IS 'Quarterly Business Review records for Strategic Agent';
COMMENT ON TABLE account_plans IS 'Strategic account plans for Strategic Agent';
COMMENT ON TABLE agent_activity_log IS 'Audit log of all agent actions';
