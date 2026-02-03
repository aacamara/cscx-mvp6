-- Migration: 014_seed_metrics_data.sql
-- Description: Seed sample usage metrics for all customers
-- Created: 2026-01-23

-- ============================================
-- USAGE METRICS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  dau INT DEFAULT 0,
  wau INT DEFAULT 0,
  mau INT DEFAULT 0,
  feature_adoption JSONB DEFAULT '{}',
  login_count INT DEFAULT 0,
  api_calls INT DEFAULT 0,
  session_duration_avg INT DEFAULT 0,
  active_users INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_customer_date ON usage_metrics(customer_id, metric_date);

-- ============================================
-- SEED USAGE METRICS FOR ALL CUSTOMERS
-- ============================================

-- Helper function to generate random metrics
CREATE OR REPLACE FUNCTION generate_usage_metrics(
  p_customer_id UUID,
  p_base_dau INT,
  p_base_health INT
) RETURNS VOID AS $$
DECLARE
  d DATE;
  variance DECIMAL;
BEGIN
  -- Generate 90 days of metrics
  FOR d IN SELECT generate_series(CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE, INTERVAL '1 day')::DATE
  LOOP
    -- Add some variance based on day of week and random factor
    variance := 0.7 + (random() * 0.6); -- 0.7 to 1.3
    IF EXTRACT(DOW FROM d) IN (0, 6) THEN
      variance := variance * 0.6; -- Lower on weekends
    END IF;

    INSERT INTO usage_metrics (
      customer_id,
      metric_date,
      dau,
      wau,
      mau,
      login_count,
      api_calls,
      session_duration_avg,
      active_users,
      feature_adoption
    ) VALUES (
      p_customer_id,
      d,
      GREATEST(1, (p_base_dau * variance)::INT),
      GREATEST(5, (p_base_dau * 3.5 * variance)::INT),
      GREATEST(20, (p_base_dau * 12 * variance)::INT),
      GREATEST(1, (p_base_dau * 2.5 * variance)::INT),
      GREATEST(10, (p_base_dau * 150 * variance)::INT),
      GREATEST(5, (15 + random() * 45)::INT), -- 5-60 minutes avg session
      GREATEST(1, (p_base_dau * 1.2 * variance)::INT),
      jsonb_build_object(
        'dashboard', LEAST(100, 50 + (p_base_health * 0.5) + (random() * 20)),
        'reports', LEAST(100, 30 + (p_base_health * 0.4) + (random() * 25)),
        'integrations', LEAST(100, 20 + (p_base_health * 0.3) + (random() * 30)),
        'automation', LEAST(100, 15 + (p_base_health * 0.35) + (random() * 25)),
        'api', LEAST(100, 10 + (p_base_health * 0.25) + (random() * 20))
      )
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Clear existing metrics (for clean seed)
DELETE FROM usage_metrics WHERE metric_date >= CURRENT_DATE - INTERVAL '90 days';

-- Seed metrics for each customer based on their ARR and health
-- Higher ARR = more users, higher health = more engagement

-- Acme Corporation (c1000000-0000-0000-0000-000000000001) - $150K ARR, 85 health
SELECT generate_usage_metrics('c1000000-0000-0000-0000-000000000001'::UUID, 25, 85);

-- Acme Corporation duplicate (8b1add53-0233-46f3-aa86-458a37cbeaad) - $150K ARR, 92 health
SELECT generate_usage_metrics('8b1add53-0233-46f3-aa86-458a37cbeaad'::UUID, 28, 92);

-- Global Finance Ltd (c1000000-0000-0000-0000-000000000003) - $280K ARR, 35 health (AT RISK!)
SELECT generate_usage_metrics('c1000000-0000-0000-0000-000000000003'::UUID, 8, 35);

-- GlobalTech Solutions (018c3daf-e293-4c12-8e91-508bf9bfdba5) - $450K ARR, 78 health
SELECT generate_usage_metrics('018c3daf-e293-4c12-8e91-508bf9bfdba5'::UUID, 45, 78);

-- HealthCare Plus (c1000000-0000-0000-0000-000000000004) - $95K ARR, 78 health
SELECT generate_usage_metrics('c1000000-0000-0000-0000-000000000004'::UUID, 15, 78);

-- Meridian Capital Partners (ac910c3c-fadd-40e0-bbdd-40b17c9652f5) - $900K ARR, 87 health
SELECT generate_usage_metrics('ac910c3c-fadd-40e0-bbdd-40b17c9652f5'::UUID, 85, 87);

-- Pacific Healthcare Group (3ac638d4-3686-47cb-9b28-2bfe5df41bd0) - $750K ARR, 85 health
SELECT generate_usage_metrics('3ac638d4-3686-47cb-9b28-2bfe5df41bd0'::UUID, 70, 85);

-- Retail Giants (c1000000-0000-0000-0000-000000000005) - $520K ARR, 91 health
SELECT generate_usage_metrics('c1000000-0000-0000-0000-000000000005'::UUID, 55, 91);

-- Summit Financial Services (313f165f-5a6a-49fb-85a0-ebcbb714ccd4) - $1.2M ARR, 91 health
SELECT generate_usage_metrics('313f165f-5a6a-49fb-85a0-ebcbb714ccd4'::UUID, 120, 91);

-- TechStart Inc (c1000000-0000-0000-0000-000000000002) - $45K ARR, 62 health
SELECT generate_usage_metrics('c1000000-0000-0000-0000-000000000002'::UUID, 8, 62);

-- Drop the helper function
DROP FUNCTION IF EXISTS generate_usage_metrics;

-- ============================================
-- VERIFY SEED DATA
-- ============================================
-- SELECT
--   c.name,
--   COUNT(um.id) as metric_days,
--   AVG(um.dau)::INT as avg_dau,
--   AVG(um.mau)::INT as avg_mau
-- FROM customers c
-- LEFT JOIN usage_metrics um ON um.customer_id = c.id
-- GROUP BY c.name
-- ORDER BY avg_dau DESC;
