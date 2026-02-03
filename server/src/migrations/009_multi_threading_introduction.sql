-- ============================================
-- PRD-044: Multi-Threading Introduction
-- Database Migration
-- ============================================

-- Add introduction tracking columns to stakeholders table
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS introduced_by UUID REFERENCES stakeholders(id);
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS introduction_date TIMESTAMP WITH TIME ZONE;

-- Add threading score column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS threading_score INTEGER DEFAULT 0;

-- Create introduction requests table
CREATE TABLE IF NOT EXISTS introduction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  champion_id UUID NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  target_stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,

  -- Target info (may not have stakeholder record yet)
  target_name VARCHAR(255) NOT NULL,
  target_title VARCHAR(255),
  target_email VARCHAR(255),
  target_department VARCHAR(100),

  -- Request status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending: created but not sent
  -- sent: email sent to champion
  -- introduced: champion made the introduction
  -- declined: champion declined to introduce
  -- no_response: no response after follow-up

  -- Email content
  email_subject VARCHAR(500),
  email_body TEXT,
  draft_intro_subject VARCHAR(500),
  draft_intro_body TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  introduced_at TIMESTAMP WITH TIME ZONE,
  response_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Additional context
  reason TEXT,
  notes TEXT,
  priority VARCHAR(20) DEFAULT 'high',

  -- Who initiated the request
  created_by UUID
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_introduction_requests_customer ON introduction_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_introduction_requests_champion ON introduction_requests(champion_id);
CREATE INDEX IF NOT EXISTS idx_introduction_requests_status ON introduction_requests(status);
CREATE INDEX IF NOT EXISTS idx_introduction_requests_created_at ON introduction_requests(created_at DESC);

-- Create stakeholder gaps tracking table
CREATE TABLE IF NOT EXISTS stakeholder_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  gap_type VARCHAR(50) NOT NULL,
  -- executive_sponsor
  -- technical_champion
  -- business_champion
  -- end_user_leader
  -- finance_procurement
  -- decision_maker
  -- influencer

  importance VARCHAR(20) NOT NULL DEFAULT 'medium',
  -- critical, high, medium

  reason TEXT,
  suggested_action TEXT,

  -- Resolution tracking
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by_stakeholder_id UUID REFERENCES stakeholders(id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one gap per type per customer
  UNIQUE(customer_id, gap_type)
);

CREATE INDEX IF NOT EXISTS idx_stakeholder_gaps_customer ON stakeholder_gaps(customer_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_gaps_type ON stakeholder_gaps(gap_type);
CREATE INDEX IF NOT EXISTS idx_stakeholder_gaps_resolved ON stakeholder_gaps(resolved);

-- Create threading score history table for trend analysis
CREATE TABLE IF NOT EXISTS threading_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,

  -- Component scores for analysis
  has_champion BOOLEAN,
  has_exec_sponsor BOOLEAN,
  decision_makers_covered INTEGER,
  total_decision_makers INTEGER,
  departments_covered INTEGER,
  total_departments INTEGER,
  avg_sentiment_score INTEGER,
  engagement_gap_count INTEGER,

  -- Snapshot of gaps at this point
  critical_gaps INTEGER DEFAULT 0,
  high_gaps INTEGER DEFAULT 0,
  medium_gaps INTEGER DEFAULT 0,

  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threading_score_history_customer ON threading_score_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_threading_score_history_recorded_at ON threading_score_history(recorded_at DESC);

-- Function to calculate and update threading score
CREATE OR REPLACE FUNCTION calculate_customer_threading_score(p_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_has_champion BOOLEAN := FALSE;
  v_has_exec_sponsor BOOLEAN := FALSE;
  v_stakeholder_count INTEGER := 0;
  v_decision_makers INTEGER := 0;
  v_departments INTEGER := 0;
BEGIN
  -- Count stakeholders and key roles
  SELECT
    COUNT(*),
    BOOL_OR(is_champion OR stakeholder_role = 'champion'),
    BOOL_OR(is_exec_sponsor OR stakeholder_role = 'sponsor'),
    COUNT(DISTINCT CASE WHEN decision_maker THEN id END),
    COUNT(DISTINCT department)
  INTO v_stakeholder_count, v_has_champion, v_has_exec_sponsor, v_decision_makers, v_departments
  FROM stakeholders
  WHERE customer_id = p_customer_id AND status = 'active';

  -- Calculate score (0-100)
  -- Champion: 20 points
  IF v_has_champion THEN
    v_score := v_score + 20;
  END IF;

  -- Exec sponsor: 20 points
  IF v_has_exec_sponsor THEN
    v_score := v_score + 20;
  END IF;

  -- Stakeholder count: up to 20 points (5 points per stakeholder, max 4)
  v_score := v_score + LEAST(v_stakeholder_count * 5, 20);

  -- Decision makers: up to 20 points
  v_score := v_score + LEAST(v_decision_makers * 10, 20);

  -- Department coverage: up to 20 points
  v_score := v_score + LEAST(v_departments * 4, 20);

  -- Update customer record
  UPDATE customers
  SET threading_score = v_score, updated_at = NOW()
  WHERE id = p_customer_id;

  -- Record in history
  INSERT INTO threading_score_history (
    customer_id, score, has_champion, has_exec_sponsor,
    decision_makers_covered, total_decision_makers,
    departments_covered, total_departments
  ) VALUES (
    p_customer_id, v_score, v_has_champion, v_has_exec_sponsor,
    v_decision_makers, v_decision_makers,
    v_departments, 7
  );

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate threading score when stakeholders change
CREATE OR REPLACE FUNCTION trigger_recalculate_threading_score()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_customer_threading_score(OLD.customer_id);
  ELSE
    PERFORM calculate_customer_threading_score(NEW.customer_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stakeholder_threading_score ON stakeholders;
CREATE TRIGGER trg_stakeholder_threading_score
AFTER INSERT OR UPDATE OR DELETE ON stakeholders
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_threading_score();

-- Function to update introduction request timestamps
CREATE OR REPLACE FUNCTION update_introduction_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_introduction_request_updated ON introduction_requests;
CREATE TRIGGER trg_introduction_request_updated
BEFORE UPDATE ON introduction_requests
FOR EACH ROW
EXECUTE FUNCTION update_introduction_request_timestamp();

-- Add RLS policies for multi-tenant security
ALTER TABLE introduction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE threading_score_history ENABLE ROW LEVEL SECURITY;

-- Policies for introduction_requests
CREATE POLICY "Users can view introduction requests for their customers"
ON introduction_requests FOR SELECT
USING (customer_id IN (
  SELECT id FROM customers WHERE organization_id = auth.uid()
));

CREATE POLICY "Users can create introduction requests for their customers"
ON introduction_requests FOR INSERT
WITH CHECK (customer_id IN (
  SELECT id FROM customers WHERE organization_id = auth.uid()
));

CREATE POLICY "Users can update their introduction requests"
ON introduction_requests FOR UPDATE
USING (customer_id IN (
  SELECT id FROM customers WHERE organization_id = auth.uid()
));

-- Policies for stakeholder_gaps
CREATE POLICY "Users can view stakeholder gaps for their customers"
ON stakeholder_gaps FOR SELECT
USING (customer_id IN (
  SELECT id FROM customers WHERE organization_id = auth.uid()
));

CREATE POLICY "Users can manage stakeholder gaps for their customers"
ON stakeholder_gaps FOR ALL
USING (customer_id IN (
  SELECT id FROM customers WHERE organization_id = auth.uid()
));

-- Policies for threading_score_history
CREATE POLICY "Users can view threading score history for their customers"
ON threading_score_history FOR SELECT
USING (customer_id IN (
  SELECT id FROM customers WHERE organization_id = auth.uid()
));

-- Create views for reporting
CREATE OR REPLACE VIEW v_multi_threading_overview AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  c.arr,
  c.health_score,
  c.threading_score,
  c.renewal_date,
  COUNT(DISTINCT s.id) AS total_stakeholders,
  COUNT(DISTINCT CASE WHEN s.is_champion OR s.stakeholder_role = 'champion' THEN s.id END) AS champions,
  COUNT(DISTINCT CASE WHEN s.is_exec_sponsor OR s.stakeholder_role = 'sponsor' THEN s.id END) AS exec_sponsors,
  COUNT(DISTINCT CASE WHEN s.decision_maker THEN s.id END) AS decision_makers,
  COUNT(DISTINCT s.department) AS departments_covered,
  COUNT(DISTINCT CASE WHEN s.last_contact_at > NOW() - INTERVAL '30 days' THEN s.id END) AS recently_engaged,
  COUNT(DISTINCT ir.id) FILTER (WHERE ir.status = 'pending') AS pending_intros,
  COUNT(DISTINCT ir.id) FILTER (WHERE ir.status = 'introduced') AS successful_intros,
  CASE
    WHEN c.threading_score < 30 THEN 'critical'
    WHEN c.threading_score < 50 THEN 'high'
    WHEN c.threading_score < 70 THEN 'medium'
    ELSE 'low'
  END AS risk_level
FROM customers c
LEFT JOIN stakeholders s ON s.customer_id = c.id AND s.status = 'active'
LEFT JOIN introduction_requests ir ON ir.customer_id = c.id
GROUP BY c.id, c.name, c.arr, c.health_score, c.threading_score, c.renewal_date;

-- Grant access to the view
GRANT SELECT ON v_multi_threading_overview TO authenticated;

-- Initialize threading scores for existing customers
DO $$
DECLARE
  customer_record RECORD;
BEGIN
  FOR customer_record IN SELECT id FROM customers LOOP
    PERFORM calculate_customer_threading_score(customer_record.id);
  END LOOP;
END $$;

COMMENT ON TABLE introduction_requests IS 'PRD-044: Tracks introduction requests for multi-threading';
COMMENT ON TABLE stakeholder_gaps IS 'PRD-044: Tracks identified stakeholder coverage gaps';
COMMENT ON TABLE threading_score_history IS 'PRD-044: Historical threading scores for trend analysis';
COMMENT ON COLUMN stakeholders.introduced_by IS 'PRD-044: References stakeholder who made the introduction';
COMMENT ON COLUMN stakeholders.introduction_date IS 'PRD-044: Date when the introduction was made';
COMMENT ON COLUMN customers.threading_score IS 'PRD-044: Multi-threading depth score (0-100)';
