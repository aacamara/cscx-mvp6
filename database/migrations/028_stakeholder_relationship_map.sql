-- PRD-063: Stakeholder Relationship Map
-- Migration for stakeholder relationship mapping and multi-threading analysis

-- ============================================
-- Stakeholder Relationship Fields
-- ============================================

-- Add relationship and influence tracking columns to stakeholders table
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS stakeholder_role VARCHAR(20) DEFAULT 'user';
-- Values: 'champion', 'sponsor', 'influencer', 'user', 'detractor', 'blocker'

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS influence_level VARCHAR(10) DEFAULT 'medium';
-- Values: 'high', 'medium', 'low'

ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS decision_maker BOOLEAN DEFAULT FALSE;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS budget_authority BOOLEAN DEFAULT FALSE;

-- Engagement tracking
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS preferred_channel VARCHAR(20) DEFAULT 'email';
-- Values: 'email', 'phone', 'slack', 'in_person'

-- Organizational hierarchy
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES stakeholders(id) ON DELETE SET NULL;
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS title VARCHAR(200);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_stakeholders_role ON stakeholders(stakeholder_role);
CREATE INDEX IF NOT EXISTS idx_stakeholders_influence ON stakeholders(influence_level);
CREATE INDEX IF NOT EXISTS idx_stakeholders_decision_maker ON stakeholders(decision_maker) WHERE decision_maker = TRUE;
CREATE INDEX IF NOT EXISTS idx_stakeholders_reports_to ON stakeholders(reports_to);
CREATE INDEX IF NOT EXISTS idx_stakeholders_department ON stakeholders(department);

-- ============================================
-- Stakeholder Relationships Table
-- ============================================

CREATE TABLE IF NOT EXISTS stakeholder_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_stakeholder_id UUID NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  to_stakeholder_id UUID NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  relationship_type VARCHAR(30) NOT NULL,
  -- Values: 'reports_to', 'collaborates_with', 'influences', 'blocks'
  strength VARCHAR(10) DEFAULT 'moderate',
  -- Values: 'strong', 'moderate', 'weak'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_relationship UNIQUE (from_stakeholder_id, to_stakeholder_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_relationships_from ON stakeholder_relationships(from_stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to ON stakeholder_relationships(to_stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON stakeholder_relationships(relationship_type);

-- ============================================
-- Multi-Threading Score History
-- ============================================

CREATE TABLE IF NOT EXISTS multi_threading_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  has_champion BOOLEAN DEFAULT FALSE,
  has_exec_sponsor BOOLEAN DEFAULT FALSE,
  decision_makers_covered INTEGER DEFAULT 0,
  total_decision_makers INTEGER DEFAULT 0,
  departments_covered INTEGER DEFAULT 0,
  total_departments INTEGER DEFAULT 0,
  avg_sentiment_score INTEGER DEFAULT 0,
  engagement_gap_count INTEGER DEFAULT 0,
  analysis JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threading_scores_customer ON multi_threading_scores(customer_id);
CREATE INDEX IF NOT EXISTS idx_threading_scores_date ON multi_threading_scores(calculated_at);

-- ============================================
-- Customer Departments Table (for tracking coverage)
-- ============================================

CREATE TABLE IF NOT EXISTS customer_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  is_covered BOOLEAN DEFAULT FALSE,
  priority VARCHAR(10) DEFAULT 'medium',
  -- Values: 'high', 'medium', 'low'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_customer_department UNIQUE (customer_id, name)
);

CREATE INDEX IF NOT EXISTS idx_departments_customer ON customer_departments(customer_id);

-- ============================================
-- Functions
-- ============================================

-- Function to calculate multi-threading score for a customer
CREATE OR REPLACE FUNCTION calculate_multi_threading_score(
  p_customer_id UUID
) RETURNS TABLE (
  score INTEGER,
  has_champion BOOLEAN,
  has_exec_sponsor BOOLEAN,
  decision_makers_covered INTEGER,
  total_decision_makers INTEGER,
  departments_covered INTEGER,
  total_departments INTEGER,
  avg_sentiment_score INTEGER,
  engagement_gap_count INTEGER
) AS $$
DECLARE
  v_has_champion BOOLEAN;
  v_has_exec_sponsor BOOLEAN;
  v_decision_makers_covered INTEGER;
  v_total_decision_makers INTEGER;
  v_departments_covered INTEGER;
  v_total_departments INTEGER;
  v_avg_sentiment INTEGER;
  v_engagement_gaps INTEGER;
  v_score INTEGER := 0;
BEGIN
  -- Check for champion
  SELECT EXISTS(
    SELECT 1 FROM stakeholders
    WHERE customer_id = p_customer_id
      AND status = 'active'
      AND (is_champion = TRUE OR stakeholder_role = 'champion')
  ) INTO v_has_champion;

  -- Check for exec sponsor
  SELECT EXISTS(
    SELECT 1 FROM stakeholders
    WHERE customer_id = p_customer_id
      AND status = 'active'
      AND (is_exec_sponsor = TRUE OR stakeholder_role = 'sponsor')
  ) INTO v_has_exec_sponsor;

  -- Count decision makers covered
  SELECT COUNT(*) INTO v_decision_makers_covered
  FROM stakeholders
  WHERE customer_id = p_customer_id
    AND status = 'active'
    AND decision_maker = TRUE
    AND last_contact_at > NOW() - INTERVAL '30 days';

  SELECT COUNT(*) INTO v_total_decision_makers
  FROM stakeholders
  WHERE customer_id = p_customer_id
    AND status = 'active'
    AND decision_maker = TRUE;

  -- Count departments covered
  SELECT COUNT(DISTINCT department) INTO v_departments_covered
  FROM stakeholders
  WHERE customer_id = p_customer_id
    AND status = 'active'
    AND department IS NOT NULL
    AND department != '';

  SELECT COUNT(*) INTO v_total_departments
  FROM customer_departments
  WHERE customer_id = p_customer_id;

  -- If no departments tracked, use 5 as default (standard org structure)
  IF v_total_departments = 0 THEN
    v_total_departments := 5;
  END IF;

  -- Calculate average sentiment score
  SELECT COALESCE(AVG(
    CASE sentiment
      WHEN 'positive' THEN 100
      WHEN 'neutral' THEN 50
      WHEN 'negative' THEN 0
      ELSE 50
    END
  )::INTEGER, 50) INTO v_avg_sentiment
  FROM stakeholders
  WHERE customer_id = p_customer_id
    AND status = 'active';

  -- Count engagement gaps (stakeholders not contacted in 30+ days)
  SELECT COUNT(*) INTO v_engagement_gaps
  FROM stakeholders
  WHERE customer_id = p_customer_id
    AND status = 'active'
    AND (
      last_contact_at IS NULL
      OR last_contact_at < NOW() - INTERVAL '30 days'
    )
    AND (decision_maker = TRUE OR is_champion = TRUE OR is_exec_sponsor = TRUE);

  -- Calculate score (matching PRD formula)
  v_score := 0;

  -- Champion: 20 points
  IF v_has_champion THEN
    v_score := v_score + 20;
  END IF;

  -- Exec Sponsor: 20 points
  IF v_has_exec_sponsor THEN
    v_score := v_score + 20;
  END IF;

  -- Decision Makers Coverage: 20 points
  IF v_total_decision_makers > 0 THEN
    v_score := v_score + ((v_decision_makers_covered::FLOAT / v_total_decision_makers::FLOAT) * 20)::INTEGER;
  ELSE
    v_score := v_score + 20; -- Full points if no decision makers defined
  END IF;

  -- Departments Coverage: 20 points
  v_score := v_score + ((LEAST(v_departments_covered, v_total_departments)::FLOAT / v_total_departments::FLOAT) * 20)::INTEGER;

  -- Sentiment Score: 10 points
  v_score := v_score + (v_avg_sentiment / 10);

  -- No Engagement Gaps: 10 points
  IF v_engagement_gaps = 0 THEN
    v_score := v_score + 10;
  ELSE
    v_score := v_score + GREATEST(10 - (v_engagement_gaps * 2), 0);
  END IF;

  RETURN QUERY SELECT
    LEAST(v_score, 100) AS score,
    v_has_champion AS has_champion,
    v_has_exec_sponsor AS has_exec_sponsor,
    v_decision_makers_covered AS decision_makers_covered,
    v_total_decision_makers AS total_decision_makers,
    v_departments_covered AS departments_covered,
    v_total_departments AS total_departments,
    v_avg_sentiment AS avg_sentiment_score,
    v_engagement_gaps AS engagement_gap_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get organizational hierarchy for a customer
CREATE OR REPLACE FUNCTION get_org_hierarchy(
  p_customer_id UUID
) RETURNS TABLE (
  id UUID,
  name TEXT,
  role TEXT,
  title TEXT,
  department VARCHAR(100),
  stakeholder_role VARCHAR(20),
  influence_level VARCHAR(10),
  sentiment TEXT,
  last_contact_at TIMESTAMPTZ,
  reports_to UUID,
  level INTEGER
) AS $$
WITH RECURSIVE org_tree AS (
  -- Base case: top-level stakeholders (no reports_to)
  SELECT
    s.id,
    s.name,
    s.role,
    s.title,
    s.department,
    s.stakeholder_role,
    s.influence_level,
    s.sentiment,
    s.last_contact_at,
    s.reports_to,
    0 AS level
  FROM stakeholders s
  WHERE s.customer_id = p_customer_id
    AND s.status = 'active'
    AND s.reports_to IS NULL

  UNION ALL

  -- Recursive case: stakeholders who report to someone
  SELECT
    s.id,
    s.name,
    s.role,
    s.title,
    s.department,
    s.stakeholder_role,
    s.influence_level,
    s.sentiment,
    s.last_contact_at,
    s.reports_to,
    ot.level + 1 AS level
  FROM stakeholders s
  INNER JOIN org_tree ot ON s.reports_to = ot.id
  WHERE s.customer_id = p_customer_id
    AND s.status = 'active'
)
SELECT * FROM org_tree ORDER BY level, name;
$$ LANGUAGE sql;

-- ============================================
-- Triggers
-- ============================================

CREATE OR REPLACE TRIGGER update_relationships_timestamp
  BEFORE UPDATE ON stakeholder_relationships
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE TRIGGER update_departments_timestamp
  BEFORE UPDATE ON customer_departments
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- Grant Permissions
-- ============================================

GRANT ALL ON stakeholder_relationships TO authenticated;
GRANT ALL ON multi_threading_scores TO authenticated;
GRANT ALL ON customer_departments TO authenticated;

-- ============================================
-- Seed Default Departments for Existing Customers
-- ============================================

INSERT INTO customer_departments (customer_id, name, priority)
SELECT DISTINCT c.id, dept.name, dept.priority
FROM customers c
CROSS JOIN (
  VALUES
    ('Engineering', 'high'),
    ('Product', 'high'),
    ('Operations', 'medium'),
    ('Finance', 'medium'),
    ('Sales', 'low'),
    ('Marketing', 'low'),
    ('HR', 'low')
) AS dept(name, priority)
ON CONFLICT (customer_id, name) DO NOTHING;

-- Update existing stakeholders with reasonable defaults based on role
UPDATE stakeholders
SET
  stakeholder_role = CASE
    WHEN is_champion = TRUE THEN 'champion'
    WHEN is_exec_sponsor = TRUE THEN 'sponsor'
    WHEN role ILIKE '%ceo%' OR role ILIKE '%cfo%' OR role ILIKE '%cto%' OR role ILIKE '%coo%' THEN 'sponsor'
    WHEN role ILIKE '%vp%' OR role ILIKE '%director%' OR role ILIKE '%head%' THEN 'influencer'
    ELSE 'user'
  END,
  influence_level = CASE
    WHEN is_champion = TRUE OR is_exec_sponsor = TRUE THEN 'high'
    WHEN role ILIKE '%ceo%' OR role ILIKE '%cfo%' OR role ILIKE '%cto%' OR role ILIKE '%coo%' THEN 'high'
    WHEN role ILIKE '%vp%' OR role ILIKE '%director%' THEN 'high'
    WHEN role ILIKE '%manager%' OR role ILIKE '%head%' THEN 'medium'
    ELSE 'low'
  END,
  decision_maker = CASE
    WHEN is_exec_sponsor = TRUE THEN TRUE
    WHEN role ILIKE '%ceo%' OR role ILIKE '%cfo%' OR role ILIKE '%cto%' OR role ILIKE '%coo%' THEN TRUE
    WHEN role ILIKE '%vp%' OR role ILIKE '%director%' THEN TRUE
    ELSE FALSE
  END,
  budget_authority = CASE
    WHEN role ILIKE '%ceo%' OR role ILIKE '%cfo%' OR role ILIKE '%coo%' THEN TRUE
    WHEN role ILIKE '%vp%' AND (role ILIKE '%finance%' OR role ILIKE '%operations%') THEN TRUE
    ELSE FALSE
  END
WHERE stakeholder_role IS NULL OR stakeholder_role = 'user';
