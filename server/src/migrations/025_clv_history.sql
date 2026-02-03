-- Migration: Customer Lifetime Value (CLV) History (PRD-173)
-- Created: 2026-01-30
-- Description: Tables for tracking CLV calculations and history

-- CLV calculation history table
CREATE TABLE IF NOT EXISTS clv_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Historical component
  historical_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
  months_as_customer INTEGER NOT NULL DEFAULT 0,

  -- Current component
  current_arr DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_mrr DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Prediction component
  predicted_remaining_months INTEGER NOT NULL DEFAULT 36,
  churn_probability DECIMAL(5,4) NOT NULL DEFAULT 0.15,
  expansion_probability DECIMAL(5,4) NOT NULL DEFAULT 0.20,
  predicted_clv DECIMAL(15,2) NOT NULL DEFAULT 0,
  clv_range_low DECIMAL(15,2),
  clv_range_high DECIMAL(15,2),

  -- Totals
  total_clv DECIMAL(15,2) NOT NULL DEFAULT 0,
  clv_tier VARCHAR(20) NOT NULL CHECK (clv_tier IN ('platinum', 'gold', 'silver', 'bronze')),
  clv_percentile INTEGER CHECK (clv_percentile >= 0 AND clv_percentile <= 100),

  -- Calculation metadata
  calculation_method VARCHAR(50) DEFAULT 'standard' CHECK (calculation_method IN ('standard', 'cohort_based', 'ml_predicted')),
  calculation_inputs JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clv_history_customer ON clv_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_clv_history_calculated_at ON clv_history(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_clv_history_tier ON clv_history(clv_tier);
CREATE INDEX IF NOT EXISTS idx_clv_history_total_clv ON clv_history(total_clv DESC);

-- CLV drivers table (tracks what affects CLV for each customer)
CREATE TABLE IF NOT EXISTS clv_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  driver_type VARCHAR(100) NOT NULL,
  driver_name VARCHAR(255) NOT NULL,
  impact_amount DECIMAL(15,2) NOT NULL,
  impact_direction VARCHAR(10) NOT NULL CHECK (impact_direction IN ('positive', 'negative')),
  description TEXT,

  -- Source of the driver calculation
  source VARCHAR(50) DEFAULT 'calculated',
  confidence_score DECIMAL(5,4),

  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clv_drivers_customer ON clv_drivers(customer_id);
CREATE INDEX IF NOT EXISTS idx_clv_drivers_type ON clv_drivers(driver_type);
CREATE INDEX IF NOT EXISTS idx_clv_drivers_calculated_at ON clv_drivers(calculated_at DESC);

-- CLV cohort analysis table
CREATE TABLE IF NOT EXISTS clv_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cohort_dimension VARCHAR(50) NOT NULL, -- signup_quarter, segment, industry, etc.
  cohort_name VARCHAR(100) NOT NULL,
  cohort_period VARCHAR(50), -- e.g., "Q1 2024"

  customer_count INTEGER NOT NULL DEFAULT 0,
  total_clv DECIMAL(15,2) NOT NULL DEFAULT 0,
  avg_clv DECIMAL(15,2) NOT NULL DEFAULT 0,
  median_clv DECIMAL(15,2),

  avg_lifetime_months DECIMAL(10,2),
  retention_rate DECIMAL(5,4),
  expansion_rate DECIMAL(5,4),

  -- Breakdown by tier
  platinum_count INTEGER DEFAULT 0,
  gold_count INTEGER DEFAULT 0,
  silver_count INTEGER DEFAULT 0,
  bronze_count INTEGER DEFAULT 0,

  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clv_cohorts_dimension ON clv_cohorts(cohort_dimension);
CREATE INDEX IF NOT EXISTS idx_clv_cohorts_calculated_at ON clv_cohorts(calculated_at DESC);

-- CLV snapshots for portfolio-level trends
CREATE TABLE IF NOT EXISTS clv_portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  snapshot_date DATE NOT NULL,

  -- Totals
  total_customers INTEGER NOT NULL DEFAULT 0,
  total_clv DECIMAL(15,2) NOT NULL DEFAULT 0,
  avg_clv DECIMAL(15,2) NOT NULL DEFAULT 0,
  median_clv DECIMAL(15,2),

  -- CLV/CAC metrics
  avg_cac DECIMAL(15,2),
  clv_cac_ratio DECIMAL(10,2),

  -- Tier distribution
  platinum_customers INTEGER DEFAULT 0,
  platinum_clv DECIMAL(15,2) DEFAULT 0,
  gold_customers INTEGER DEFAULT 0,
  gold_clv DECIMAL(15,2) DEFAULT 0,
  silver_customers INTEGER DEFAULT 0,
  silver_clv DECIMAL(15,2) DEFAULT 0,
  bronze_customers INTEGER DEFAULT 0,
  bronze_clv DECIMAL(15,2) DEFAULT 0,

  -- Movement from previous snapshot
  new_customers_clv DECIMAL(15,2) DEFAULT 0,
  churned_customers_clv DECIMAL(15,2) DEFAULT 0,
  clv_change_amount DECIMAL(15,2) DEFAULT 0,
  clv_change_percent DECIMAL(10,4) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clv_portfolio_snapshots_date ON clv_portfolio_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_clv_portfolio_snapshots_created ON clv_portfolio_snapshots(created_at DESC);

-- Add CLV-related columns to customers table
DO $$
BEGIN
  -- Add total_clv
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'total_clv'
  ) THEN
    ALTER TABLE customers ADD COLUMN total_clv DECIMAL(15,2);
  END IF;

  -- Add clv_tier
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'clv_tier'
  ) THEN
    ALTER TABLE customers ADD COLUMN clv_tier VARCHAR(20);
  END IF;

  -- Add clv_percentile
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'clv_percentile'
  ) THEN
    ALTER TABLE customers ADD COLUMN clv_percentile INTEGER;
  END IF;

  -- Add churn_probability
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'churn_probability'
  ) THEN
    ALTER TABLE customers ADD COLUMN churn_probability DECIMAL(5,4);
  END IF;

  -- Add expansion_probability
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'expansion_probability'
  ) THEN
    ALTER TABLE customers ADD COLUMN expansion_probability DECIMAL(5,4);
  END IF;

  -- Add clv_last_calculated
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'clv_last_calculated'
  ) THEN
    ALTER TABLE customers ADD COLUMN clv_last_calculated TIMESTAMPTZ;
  END IF;
END $$;

-- Create indexes for new customer columns
CREATE INDEX IF NOT EXISTS idx_customers_total_clv ON customers(total_clv DESC) WHERE total_clv IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_clv_tier ON customers(clv_tier) WHERE clv_tier IS NOT NULL;

-- Comments for documentation
COMMENT ON TABLE clv_history IS 'Historical CLV calculations for each customer (PRD-173)';
COMMENT ON TABLE clv_drivers IS 'Factors affecting CLV for each customer';
COMMENT ON TABLE clv_cohorts IS 'CLV analysis by customer cohorts';
COMMENT ON TABLE clv_portfolio_snapshots IS 'Daily snapshots of portfolio-level CLV metrics';

COMMENT ON COLUMN customers.total_clv IS 'Current calculated total CLV for the customer';
COMMENT ON COLUMN customers.clv_tier IS 'CLV tier: platinum (>$500K), gold ($200K-$500K), silver ($50K-$200K), bronze (<$50K)';
COMMENT ON COLUMN customers.clv_percentile IS 'Customer CLV percentile rank (0-100)';
COMMENT ON COLUMN customers.churn_probability IS 'Predicted probability of customer churning (0-1)';
COMMENT ON COLUMN customers.expansion_probability IS 'Predicted probability of expansion (0-1)';
