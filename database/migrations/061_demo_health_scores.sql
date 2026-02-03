-- ============================================
-- PRD: Demo Customer Data Seeding
-- Migration: 061_demo_health_scores.sql
-- Description: Insert 90 days of health score history for demo customers
-- ============================================

-- ============================================
-- HEALTH SCORE HISTORY
-- ============================================
-- Acme: stable 75-82 range
-- TechStart: declining from 70 to 45
-- Global Logistics: improving from 60 to 78
-- HealthFirst: starting at 65, slight improvement
-- RetailMax: volatile, recent drop to 52
-- ============================================

-- Clear existing demo health scores to avoid duplicates
DELETE FROM health_scores
WHERE customer_id IN (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000005'
);

-- Acme Corporation: Stable healthy scores (75-82)
INSERT INTO health_scores (customer_id, overall, overall_color, product, risk, outcomes, voice, engagement, calculated_at)
SELECT
  'd0000000-0000-0000-0000-000000000001'::UUID,
  -- Stable between 75-82, small random variation
  75 + FLOOR(RANDOM() * 8)::INT,
  'green',
  80 + FLOOR(RANDOM() * 10)::INT,  -- Product: 80-90
  75 + FLOOR(RANDOM() * 10)::INT,  -- Risk: 75-85
  75 + FLOOR(RANDOM() * 10)::INT,  -- Outcomes: 75-85
  70 + FLOOR(RANDOM() * 15)::INT,  -- Voice: 70-85
  75 + FLOOR(RANDOM() * 10)::INT,  -- Engagement: 75-85
  CURRENT_DATE - (n || ' days')::INTERVAL
FROM generate_series(0, 89) n;

-- TechStart Inc: Declining from 70 to 45
INSERT INTO health_scores (customer_id, overall, overall_color, product, risk, outcomes, voice, engagement, calculated_at)
SELECT
  'd0000000-0000-0000-0000-000000000002'::UUID,
  -- Linear decline from 70 to 45 over 90 days
  GREATEST(45, 70 - FLOOR(n * 0.28)::INT + FLOOR(RANDOM() * 5)::INT - 2),
  CASE
    WHEN (70 - FLOOR(n * 0.28)::INT) >= 70 THEN 'yellow'
    WHEN (70 - FLOOR(n * 0.28)::INT) >= 50 THEN 'yellow'
    ELSE 'red'
  END,
  GREATEST(30, 65 - FLOOR(n * 0.35)::INT + FLOOR(RANDOM() * 5)::INT),
  GREATEST(20, 60 - FLOOR(n * 0.4)::INT + FLOOR(RANDOM() * 5)::INT),
  GREATEST(35, 55 - FLOOR(n * 0.2)::INT + FLOOR(RANDOM() * 5)::INT),
  GREATEST(40, 70 - FLOOR(n * 0.3)::INT + FLOOR(RANDOM() * 5)::INT),
  GREATEST(25, 55 - FLOOR(n * 0.35)::INT + FLOOR(RANDOM() * 5)::INT),
  CURRENT_DATE - (n || ' days')::INTERVAL
FROM generate_series(0, 89) n;

-- Global Logistics: Improving from 60 to 78
INSERT INTO health_scores (customer_id, overall, overall_color, product, risk, outcomes, voice, engagement, calculated_at)
SELECT
  'd0000000-0000-0000-0000-000000000003'::UUID,
  -- Linear improvement from 60 to 78 over 90 days
  LEAST(78, 60 + FLOOR(n * 0.2)::INT + FLOOR(RANDOM() * 4)::INT - 2),
  CASE
    WHEN (60 + FLOOR(n * 0.2)::INT) >= 75 THEN 'yellow'
    WHEN (60 + FLOOR(n * 0.2)::INT) >= 50 THEN 'yellow'
    ELSE 'red'
  END,
  LEAST(85, 55 + FLOOR(n * 0.3)::INT + FLOOR(RANDOM() * 5)::INT),
  LEAST(80, 60 + FLOOR(n * 0.2)::INT + FLOOR(RANDOM() * 5)::INT),
  LEAST(80, 58 + FLOOR(n * 0.25)::INT + FLOOR(RANDOM() * 5)::INT),
  LEAST(75, 62 + FLOOR(n * 0.15)::INT + FLOOR(RANDOM() * 5)::INT),
  LEAST(82, 60 + FLOOR(n * 0.25)::INT + FLOOR(RANDOM() * 5)::INT),
  CURRENT_DATE - (n || ' days')::INTERVAL
FROM generate_series(0, 89) n;

-- HealthFirst Medical: Starting at 65, slight improvement (onboarding)
INSERT INTO health_scores (customer_id, overall, overall_color, product, risk, outcomes, voice, engagement, calculated_at)
SELECT
  'd0000000-0000-0000-0000-000000000004'::UUID,
  -- Gradual improvement from 55 to 68 over 90 days (onboarding curve)
  LEAST(68, 55 + FLOOR(n * 0.15)::INT + FLOOR(RANDOM() * 6)::INT - 3),
  CASE
    WHEN (55 + FLOOR(n * 0.15)::INT) >= 70 THEN 'yellow'
    ELSE 'yellow'
  END,
  LEAST(72, 50 + FLOOR(n * 0.25)::INT + FLOOR(RANDOM() * 5)::INT),
  65 + FLOOR(RANDOM() * 10)::INT,  -- Risk stable
  LEAST(70, 45 + FLOOR(n * 0.28)::INT + FLOOR(RANDOM() * 5)::INT),
  60 + FLOOR(RANDOM() * 10)::INT,  -- Voice stable (new customer)
  LEAST(75, 55 + FLOOR(n * 0.22)::INT + FLOOR(RANDOM() * 5)::INT),
  CURRENT_DATE - (n || ' days')::INTERVAL
FROM generate_series(0, 89) n;

-- RetailMax: Volatile with recent drop to 52
INSERT INTO health_scores (customer_id, overall, overall_color, product, risk, outcomes, voice, engagement, calculated_at)
SELECT
  'd0000000-0000-0000-0000-000000000005'::UUID,
  -- Volatile: started at 72, fluctuated, then dropped to 52 in last 30 days
  CASE
    WHEN n < 30 THEN 52 + FLOOR(RANDOM() * 8)::INT  -- Recent: 52-60
    WHEN n < 60 THEN 62 + FLOOR(RANDOM() * 15)::INT - 7  -- Middle: 55-70
    ELSE 65 + FLOOR(RANDOM() * 12)::INT  -- Earlier: 65-77
  END,
  CASE
    WHEN n < 30 THEN 'red'
    WHEN n < 60 THEN 'yellow'
    ELSE 'yellow'
  END,
  CASE WHEN n < 30 THEN 45 + FLOOR(RANDOM() * 15)::INT ELSE 60 + FLOOR(RANDOM() * 15)::INT END,
  CASE WHEN n < 30 THEN 35 + FLOOR(RANDOM() * 15)::INT ELSE 55 + FLOOR(RANDOM() * 15)::INT END,
  CASE WHEN n < 30 THEN 50 + FLOOR(RANDOM() * 10)::INT ELSE 60 + FLOOR(RANDOM() * 15)::INT END,
  CASE WHEN n < 30 THEN 30 + FLOOR(RANDOM() * 15)::INT ELSE 55 + FLOOR(RANDOM() * 15)::INT END,
  CASE WHEN n < 30 THEN 40 + FLOOR(RANDOM() * 15)::INT ELSE 60 + FLOOR(RANDOM() * 15)::INT END,
  CURRENT_DATE - (n || ' days')::INTERVAL
FROM generate_series(0, 89) n;

-- ============================================
-- Verify insertion
-- ============================================
DO $$
DECLARE
  score_count INT;
BEGIN
  SELECT COUNT(*) INTO score_count
  FROM health_scores
  WHERE customer_id IN (
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000005'
  );

  RAISE NOTICE 'Demo health scores inserted: % (expected ~450)', score_count;
END $$;
