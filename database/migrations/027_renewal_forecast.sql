-- ============================================
-- PRD-163: RENEWAL FORECAST REPORT
-- Migration for renewal tracking and forecasting
-- ============================================

-- Renewal Pipeline Table
CREATE TABLE IF NOT EXISTS renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Renewal details
  renewal_date DATE NOT NULL,
  current_arr DECIMAL(12,2) NOT NULL DEFAULT 0,
  proposed_arr DECIMAL(12,2),

  -- Stage tracking
  stage TEXT CHECK (stage IN (
    'not_started',
    'prep',
    'value_review',
    'proposal_sent',
    'negotiation',
    'verbal_commit',
    'closed'
  )) DEFAULT 'not_started',

  -- Probability and risk
  probability INT CHECK (probability >= 0 AND probability <= 100) DEFAULT 50,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',

  -- Scores for risk calculation
  health_score INT,
  engagement_score INT,
  nps_score INT,

  -- Readiness
  readiness_score INT DEFAULT 0,

  -- Outcome tracking (when closed)
  outcome TEXT CHECK (outcome IN ('renewed', 'churned', 'downgraded', 'expanded')),
  outcome_arr DECIMAL(12,2),
  outcome_date DATE,

  -- Ownership
  csm_id UUID,
  owner_name TEXT,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Renewal Checklist Items Table
CREATE TABLE IF NOT EXISTS renewal_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_id UUID REFERENCES renewals(id) ON DELETE CASCADE,

  -- Item details
  item_key TEXT NOT NULL, -- e.g., 'value_summary', 'qbr_completed'
  item_label TEXT NOT NULL,
  timing_days INT, -- Days before renewal this should be done

  -- Status
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID,

  -- Ordering
  sort_order INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Renewal History Table (for tracking changes and forecast accuracy)
CREATE TABLE IF NOT EXISTS renewal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_id UUID REFERENCES renewals(id) ON DELETE CASCADE,

  -- Snapshot data
  stage TEXT,
  probability INT,
  risk_level TEXT,
  proposed_arr DECIMAL(12,2),

  -- Change metadata
  changed_by UUID,
  change_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Renewal Forecast Snapshots (for tracking forecast accuracy over time)
CREATE TABLE IF NOT EXISTS renewal_forecast_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Forecast data
  total_renewals INT,
  total_arr DECIMAL(12,2),
  weighted_arr DECIMAL(12,2),

  -- Breakdown
  commit_arr DECIMAL(12,2),    -- >90% probability
  likely_arr DECIMAL(12,2),    -- 70-90% probability
  at_risk_arr DECIMAL(12,2),   -- <70% probability

  -- Risk distribution
  low_risk_count INT,
  medium_risk_count INT,
  high_risk_count INT,
  critical_risk_count INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_renewals_customer ON renewals(customer_id);
CREATE INDEX IF NOT EXISTS idx_renewals_date ON renewals(renewal_date);
CREATE INDEX IF NOT EXISTS idx_renewals_stage ON renewals(stage);
CREATE INDEX IF NOT EXISTS idx_renewals_risk ON renewals(risk_level);
CREATE INDEX IF NOT EXISTS idx_renewal_checklist_renewal ON renewal_checklist_items(renewal_id);
CREATE INDEX IF NOT EXISTS idx_renewal_history_renewal ON renewal_history(renewal_id);
CREATE INDEX IF NOT EXISTS idx_forecast_snapshots_period ON renewal_forecast_snapshots(period_start, period_end);

-- Update trigger for renewals
CREATE OR REPLACE FUNCTION update_renewal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_renewals_timestamp
  BEFORE UPDATE ON renewals
  FOR EACH ROW EXECUTE FUNCTION update_renewal_timestamp();

-- Function to calculate renewal risk
CREATE OR REPLACE FUNCTION calculate_renewal_risk(
  p_health_score INT,
  p_engagement_score INT,
  p_nps_score INT,
  p_days_to_renewal INT,
  p_stage TEXT
) RETURNS TEXT AS $$
DECLARE
  risk_score INT := 0;
BEGIN
  -- Health score factor (0-40 points)
  IF p_health_score < 40 THEN
    risk_score := risk_score + 40;
  ELSIF p_health_score < 60 THEN
    risk_score := risk_score + 25;
  ELSIF p_health_score < 70 THEN
    risk_score := risk_score + 10;
  END IF;

  -- Engagement factor (0-25 points)
  IF p_engagement_score < 40 THEN
    risk_score := risk_score + 25;
  ELSIF p_engagement_score < 60 THEN
    risk_score := risk_score + 15;
  ELSIF p_engagement_score < 70 THEN
    risk_score := risk_score + 5;
  END IF;

  -- Time factor (0-20 points)
  IF p_days_to_renewal < 30 AND p_stage = 'not_started' THEN
    risk_score := risk_score + 20;
  ELSIF p_days_to_renewal < 60 AND p_stage = 'not_started' THEN
    risk_score := risk_score + 10;
  END IF;

  -- NPS factor (0-15 points)
  IF p_nps_score IS NOT NULL THEN
    IF p_nps_score < 7 THEN
      risk_score := risk_score + 15;
    ELSIF p_nps_score < 8 THEN
      risk_score := risk_score + 5;
    END IF;
  END IF;

  -- Categorize
  IF risk_score >= 60 THEN
    RETURN 'critical';
  ELSIF risk_score >= 40 THEN
    RETURN 'high';
  ELSIF risk_score >= 20 THEN
    RETURN 'medium';
  ELSE
    RETURN 'low';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Insert default checklist template items
INSERT INTO renewal_checklist_items (id, renewal_id, item_key, item_label, timing_days, sort_order)
SELECT
  gen_random_uuid(),
  r.id,
  i.item_key,
  i.item_label,
  i.timing_days,
  i.sort_order
FROM renewals r
CROSS JOIN (
  VALUES
    ('value_summary', 'Value summary created', 90, 1),
    ('qbr_completed', 'QBR completed', 60, 2),
    ('exec_sponsor_engaged', 'Executive sponsor engaged', 60, 3),
    ('proposal_drafted', 'Renewal proposal drafted', 45, 4),
    ('proposal_sent', 'Proposal sent to customer', 30, 5),
    ('verbal_commit', 'Verbal commitment received', 14, 6),
    ('contract_signed', 'Contract signed', 0, 7)
) AS i(item_key, item_label, timing_days, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM renewal_checklist_items rci
  WHERE rci.renewal_id = r.id AND rci.item_key = i.item_key
);

-- Sync existing customers with renewal dates to renewals table
INSERT INTO renewals (customer_id, renewal_date, current_arr, health_score, csm_id)
SELECT
  c.id,
  c.renewal_date,
  COALESCE(c.arr, 0),
  c.health_score,
  c.csm_id
FROM customers c
WHERE c.renewal_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM renewals r WHERE r.customer_id = c.id AND r.renewal_date = c.renewal_date
  );
