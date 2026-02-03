-- Migration: NRR Reporting Tables
-- Date: 2026-01-30
-- PRD: PRD-174 - Net Revenue Retention Report
-- Description: Creates tables for tracking NRR metrics, cohort analysis, and revenue movements

-- ============================================
-- NRR Snapshots Table
-- Stores periodic NRR calculations for historical tracking
-- ============================================

CREATE TABLE IF NOT EXISTS nrr_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label TEXT NOT NULL,

  -- NRR Components
  starting_arr DECIMAL(15, 2) NOT NULL DEFAULT 0,
  expansion DECIMAL(15, 2) NOT NULL DEFAULT 0,
  contraction DECIMAL(15, 2) NOT NULL DEFAULT 0,
  churn DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ending_arr DECIMAL(15, 2) NOT NULL DEFAULT 0,

  -- Calculated Rates
  nrr DECIMAL(6, 2) NOT NULL DEFAULT 100,
  grr DECIMAL(6, 2) NOT NULL DEFAULT 100,
  expansion_rate DECIMAL(6, 2) NOT NULL DEFAULT 0,
  contraction_rate DECIMAL(6, 2) NOT NULL DEFAULT 0,
  churn_rate DECIMAL(6, 2) NOT NULL DEFAULT 0,

  -- Customer Counts
  starting_customer_count INTEGER NOT NULL DEFAULT 0,
  ending_customer_count INTEGER NOT NULL DEFAULT 0,
  new_customer_count INTEGER NOT NULL DEFAULT 0,
  churned_customer_count INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  segment TEXT, -- NULL for overall, or 'enterprise', 'mid-market', 'smb'
  csm_id TEXT, -- NULL for overall, or specific CSM
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (period_type, period_start, segment, csm_id)
);

-- Indexes for nrr_snapshots
CREATE INDEX IF NOT EXISTS idx_nrr_snapshots_period ON nrr_snapshots(period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_nrr_snapshots_segment ON nrr_snapshots(segment) WHERE segment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nrr_snapshots_csm ON nrr_snapshots(csm_id) WHERE csm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nrr_snapshots_calculated ON nrr_snapshots(calculated_at DESC);

-- ============================================
-- Revenue Movements Table (if not exists)
-- Tracks individual revenue changes for NRR calculation
-- ============================================

CREATE TABLE IF NOT EXISTS revenue_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  movement_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new', 'expansion', 'contraction', 'churn', 'reactivation')),

  -- Revenue Amounts
  previous_arr DECIMAL(15, 2) NOT NULL DEFAULT 0,
  new_arr DECIMAL(15, 2) NOT NULL DEFAULT 0,
  change_amount DECIMAL(15, 2) NOT NULL,

  -- Categorization
  category TEXT, -- e.g., 'Seat growth', 'Tier upgrade', 'Budget cuts'
  reason TEXT,
  source TEXT, -- 'upsell', 'cross-sell', 'downsell', 'new_business', 'churn'

  -- Attribution
  csm_id TEXT,
  csm_name TEXT,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for revenue_movements
CREATE INDEX IF NOT EXISTS idx_revenue_movements_customer ON revenue_movements(customer_id);
CREATE INDEX IF NOT EXISTS idx_revenue_movements_date ON revenue_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_movements_type ON revenue_movements(type);
CREATE INDEX IF NOT EXISTS idx_revenue_movements_category ON revenue_movements(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_revenue_movements_csm ON revenue_movements(csm_id) WHERE csm_id IS NOT NULL;

-- ============================================
-- Customer Cohorts Table
-- Tracks customer cohort assignments for cohort-based NRR analysis
-- ============================================

CREATE TABLE IF NOT EXISTS customer_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  cohort TEXT NOT NULL, -- e.g., '2024-Q1', '2025-Q2'
  cohort_start_date DATE NOT NULL,
  initial_arr DECIMAL(15, 2) NOT NULL DEFAULT 0,

  -- Cohort-specific tracking
  months_in_cohort INTEGER NOT NULL DEFAULT 0,
  current_arr DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_expansion DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_contraction DECIMAL(15, 2) NOT NULL DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  churned_at DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (customer_id, cohort)
);

-- Indexes for customer_cohorts
CREATE INDEX IF NOT EXISTS idx_customer_cohorts_customer ON customer_cohorts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_cohorts_cohort ON customer_cohorts(cohort);
CREATE INDEX IF NOT EXISTS idx_customer_cohorts_active ON customer_cohorts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_customer_cohorts_start_date ON customer_cohorts(cohort_start_date DESC);

-- ============================================
-- NRR Targets Table
-- Stores NRR targets for comparison and goal tracking
-- ============================================

CREATE TABLE IF NOT EXISTS nrr_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  period_start DATE NOT NULL,

  -- Target Values
  nrr_target DECIMAL(6, 2) NOT NULL DEFAULT 110,
  grr_target DECIMAL(6, 2) NOT NULL DEFAULT 92,
  expansion_target DECIMAL(6, 2) NOT NULL DEFAULT 15,
  churn_target DECIMAL(6, 2) NOT NULL DEFAULT 5,

  -- Segment-specific targets
  segment TEXT, -- NULL for overall

  -- Metadata
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (period_type, period_start, segment)
);

-- Indexes for nrr_targets
CREATE INDEX IF NOT EXISTS idx_nrr_targets_period ON nrr_targets(period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_nrr_targets_segment ON nrr_targets(segment) WHERE segment IS NOT NULL;

-- ============================================
-- NRR Driver Categories Table
-- Standardized categories for expansion/contraction/churn reasons
-- ============================================

CREATE TABLE IF NOT EXISTS nrr_driver_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expansion', 'contraction', 'churn')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (name, type)
);

-- Pre-populate common NRR driver categories
INSERT INTO nrr_driver_categories (name, type, description, sort_order) VALUES
  -- Expansion drivers
  ('Seat growth', 'expansion', 'Additional user licenses purchased', 1),
  ('Tier upgrade', 'expansion', 'Upgraded to higher pricing tier', 2),
  ('Add-on module', 'expansion', 'Purchased additional product modules', 3),
  ('Price increase', 'expansion', 'Annual price increase applied', 4),
  ('Usage overage', 'expansion', 'Exceeded usage limits', 5),

  -- Contraction drivers
  ('Seat reduction', 'contraction', 'Reduced user licenses', 1),
  ('Tier downgrade', 'contraction', 'Downgraded to lower pricing tier', 2),
  ('Module removal', 'contraction', 'Removed product modules', 3),
  ('Negotiated discount', 'contraction', 'Applied discount at renewal', 4),
  ('Partial churn', 'contraction', 'Reduced product usage significantly', 5),

  -- Churn drivers
  ('Budget constraints', 'churn', 'Customer budget cuts', 1),
  ('Competitor switch', 'churn', 'Switched to competing product', 2),
  ('Business closure', 'churn', 'Company went out of business', 3),
  ('M&A activity', 'churn', 'Merger or acquisition impact', 4),
  ('Product fit', 'churn', 'Product no longer fits needs', 5),
  ('Poor adoption', 'churn', 'Failed to achieve adoption', 6),
  ('Champion departure', 'churn', 'Key stakeholder left', 7),
  ('Unresolved issues', 'churn', 'Ongoing support/product issues', 8)
ON CONFLICT (name, type) DO NOTHING;

-- ============================================
-- Functions
-- ============================================

-- Function to calculate NRR from components
CREATE OR REPLACE FUNCTION calculate_nrr(
  p_starting_arr DECIMAL,
  p_expansion DECIMAL,
  p_contraction DECIMAL,
  p_churn DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  IF p_starting_arr = 0 THEN
    RETURN 100;
  END IF;
  RETURN ROUND(((p_starting_arr + p_expansion - p_contraction - p_churn) / p_starting_arr) * 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate GRR (excludes expansion)
CREATE OR REPLACE FUNCTION calculate_grr(
  p_starting_arr DECIMAL,
  p_contraction DECIMAL,
  p_churn DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  IF p_starting_arr = 0 THEN
    RETURN 100;
  END IF;
  RETURN ROUND(((p_starting_arr - p_contraction - p_churn) / p_starting_arr) * 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get cohort from date
CREATE OR REPLACE FUNCTION get_cohort_from_date(p_date DATE)
RETURNS TEXT AS $$
DECLARE
  v_quarter INTEGER;
BEGIN
  v_quarter := EXTRACT(QUARTER FROM p_date);
  RETURN EXTRACT(YEAR FROM p_date)::TEXT || '-Q' || v_quarter::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Triggers
-- ============================================

-- Trigger to update customer cohort on revenue movement
CREATE OR REPLACE FUNCTION update_cohort_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Update cohort metrics when a revenue movement is recorded
  UPDATE customer_cohorts
  SET
    current_arr = NEW.new_arr,
    total_expansion = CASE
      WHEN NEW.type = 'expansion' THEN total_expansion + NEW.change_amount
      ELSE total_expansion
    END,
    total_contraction = CASE
      WHEN NEW.type IN ('contraction', 'churn') THEN total_contraction + ABS(NEW.change_amount)
      ELSE total_contraction
    END,
    is_active = CASE WHEN NEW.type = 'churn' THEN false ELSE is_active END,
    churned_at = CASE WHEN NEW.type = 'churn' THEN NEW.movement_date ELSE churned_at END,
    updated_at = NOW()
  WHERE customer_id = NEW.customer_id
    AND is_active = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_cohort_on_movement ON revenue_movements;
CREATE TRIGGER trg_update_cohort_on_movement
  AFTER INSERT ON revenue_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_cohort_on_movement();

-- Trigger to auto-assign cohort when customer is created
CREATE OR REPLACE FUNCTION auto_assign_cohort()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO customer_cohorts (customer_id, cohort, cohort_start_date, initial_arr, current_arr)
  VALUES (
    NEW.id,
    get_cohort_from_date(NEW.created_at::DATE),
    DATE_TRUNC('quarter', NEW.created_at)::DATE,
    COALESCE(NEW.arr, 0),
    COALESCE(NEW.arr, 0)
  )
  ON CONFLICT (customer_id, cohort) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_assign_cohort ON customers;
CREATE TRIGGER trg_auto_assign_cohort
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_cohort();

-- ============================================
-- Views
-- ============================================

-- View for current NRR summary
CREATE OR REPLACE VIEW nrr_current_summary AS
SELECT
  period_type,
  period_label,
  starting_arr,
  ending_arr,
  expansion,
  contraction,
  churn,
  nrr,
  grr,
  expansion_rate,
  contraction_rate,
  churn_rate,
  segment,
  csm_id,
  calculated_at
FROM nrr_snapshots
WHERE segment IS NULL AND csm_id IS NULL
ORDER BY period_start DESC
LIMIT 1;

-- View for cohort NRR performance
CREATE OR REPLACE VIEW cohort_nrr_performance AS
SELECT
  cohort,
  cohort_start_date,
  COUNT(*) AS customer_count,
  SUM(initial_arr) AS initial_arr,
  SUM(current_arr) AS current_arr,
  SUM(total_expansion) AS total_expansion,
  SUM(total_contraction) AS total_contraction,
  ROUND(
    (SUM(current_arr)::DECIMAL / NULLIF(SUM(initial_arr), 0)) * 100,
    2
  ) AS cohort_nrr,
  COUNT(*) FILTER (WHERE is_active) AS active_customers,
  COUNT(*) FILTER (WHERE NOT is_active) AS churned_customers
FROM customer_cohorts
GROUP BY cohort, cohort_start_date
ORDER BY cohort_start_date DESC;

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE nrr_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE nrr_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE nrr_driver_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read NRR snapshots
CREATE POLICY "read_nrr_snapshots" ON nrr_snapshots
  FOR SELECT USING (true);

-- Policy: Users can read revenue movements
CREATE POLICY "read_revenue_movements" ON revenue_movements
  FOR SELECT USING (true);

-- Policy: Users can insert revenue movements
CREATE POLICY "insert_revenue_movements" ON revenue_movements
  FOR INSERT WITH CHECK (true);

-- Policy: Users can read customer cohorts
CREATE POLICY "read_customer_cohorts" ON customer_cohorts
  FOR SELECT USING (true);

-- Policy: Users can read NRR targets
CREATE POLICY "read_nrr_targets" ON nrr_targets
  FOR SELECT USING (true);

-- Policy: Users can read driver categories
CREATE POLICY "read_nrr_driver_categories" ON nrr_driver_categories
  FOR SELECT USING (true);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE nrr_snapshots IS 'Periodic snapshots of NRR metrics for historical tracking and trend analysis';
COMMENT ON TABLE revenue_movements IS 'Individual revenue changes (expansion, contraction, churn) for NRR calculation';
COMMENT ON TABLE customer_cohorts IS 'Customer cohort assignments for cohort-based NRR analysis';
COMMENT ON TABLE nrr_targets IS 'NRR, GRR, and related targets for performance comparison';
COMMENT ON TABLE nrr_driver_categories IS 'Standardized categories for expansion/contraction/churn reasons';

COMMENT ON FUNCTION calculate_nrr IS 'Calculates Net Revenue Retention rate from component values';
COMMENT ON FUNCTION calculate_grr IS 'Calculates Gross Revenue Retention rate (excludes expansion)';
COMMENT ON FUNCTION get_cohort_from_date IS 'Returns cohort identifier (e.g., 2024-Q1) from a date';
