-- ============================================
-- PRD: Demo Customer Data Seeding
-- Migration: 063_demo_engagement.sql
-- Description: Insert 30 days of daily engagement metrics per demo customer
-- ============================================

-- ============================================
-- ENGAGEMENT METRICS
-- ============================================
-- Acme: high engagement (dau 50+)
-- TechStart: declining engagement
-- Global Logistics: improving engagement
-- HealthFirst: onboarding ramp-up
-- RetailMax: sporadic usage
-- ============================================

-- Clear existing demo engagement metrics
DELETE FROM usage_metrics
WHERE customer_id IN (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000005'
);

-- ============================================
-- Acme Corporation: High engagement (dau 50+)
-- Healthy, consistent usage patterns
-- ============================================
INSERT INTO usage_metrics (customer_id, metric_date, dau, wau, mau, login_count, api_calls, session_duration_avg, active_users, usage_trend, adoption_score)
SELECT
  'd0000000-0000-0000-0000-000000000001'::UUID,
  CURRENT_DATE - (n || ' days')::INTERVAL,
  50 + FLOOR(RANDOM() * 20)::INT,      -- DAU: 50-70
  120 + FLOOR(RANDOM() * 30)::INT,     -- WAU: 120-150
  180 + FLOOR(RANDOM() * 40)::INT,     -- MAU: 180-220
  150 + FLOOR(RANDOM() * 50)::INT,     -- Logins: 150-200
  2000 + FLOOR(RANDOM() * 500)::INT,   -- API calls: 2000-2500
  25 + FLOOR(RANDOM() * 10)::INT,      -- Session: 25-35 min
  55 + FLOOR(RANDOM() * 15)::INT,      -- Active users: 55-70
  'growing',
  82 + FLOOR(RANDOM() * 10)::INT       -- Adoption: 82-92
FROM generate_series(0, 29) n
ON CONFLICT (customer_id, metric_date) DO NOTHING;

-- ============================================
-- TechStart Inc: Declining engagement
-- Started decent, now dropping
-- ============================================
INSERT INTO usage_metrics (customer_id, metric_date, dau, wau, mau, login_count, api_calls, session_duration_avg, active_users, usage_trend, adoption_score)
SELECT
  'd0000000-0000-0000-0000-000000000002'::UUID,
  CURRENT_DATE - (n || ' days')::INTERVAL,
  -- DAU declining from 25 to 8
  GREATEST(8, 25 - FLOOR(n * 0.6)::INT + FLOOR(RANDOM() * 5)::INT),
  -- WAU declining from 35 to 15
  GREATEST(15, 35 - FLOOR(n * 0.7)::INT + FLOOR(RANDOM() * 5)::INT),
  -- MAU declining from 50 to 25
  GREATEST(25, 50 - FLOOR(n * 0.8)::INT + FLOOR(RANDOM() * 8)::INT),
  -- Logins declining
  GREATEST(10, 40 - FLOOR(n * 1)::INT + FLOOR(RANDOM() * 5)::INT),
  -- API calls declining
  GREATEST(100, 500 - FLOOR(n * 12)::INT + FLOOR(RANDOM() * 50)::INT),
  -- Session duration declining
  GREATEST(5, 18 - FLOOR(n * 0.4)::INT + FLOOR(RANDOM() * 3)::INT),
  -- Active users declining
  GREATEST(8, 25 - FLOOR(n * 0.5)::INT + FLOOR(RANDOM() * 3)::INT),
  'declining',
  -- Adoption score declining from 55 to 35
  GREATEST(35, 55 - FLOOR(n * 0.7)::INT + FLOOR(RANDOM() * 5)::INT)
FROM generate_series(0, 29) n
ON CONFLICT (customer_id, metric_date) DO NOTHING;

-- ============================================
-- Global Logistics: Improving engagement
-- Expansion scenario - growing usage
-- ============================================
INSERT INTO usage_metrics (customer_id, metric_date, dau, wau, mau, login_count, api_calls, session_duration_avg, active_users, usage_trend, adoption_score)
SELECT
  'd0000000-0000-0000-0000-000000000003'::UUID,
  CURRENT_DATE - (n || ' days')::INTERVAL,
  -- DAU improving from 30 to 45
  LEAST(45, 30 + FLOOR(n * 0.5)::INT + FLOOR(RANDOM() * 5)::INT),
  -- WAU improving from 70 to 100
  LEAST(100, 70 + FLOOR(n * 1)::INT + FLOOR(RANDOM() * 8)::INT),
  -- MAU improving from 120 to 160
  LEAST(160, 120 + FLOOR(n * 1.3)::INT + FLOOR(RANDOM() * 10)::INT),
  -- Logins improving
  LEAST(120, 70 + FLOOR(n * 1.5)::INT + FLOOR(RANDOM() * 10)::INT),
  -- API calls improving
  LEAST(1800, 1000 + FLOOR(n * 25)::INT + FLOOR(RANDOM() * 100)::INT),
  -- Session duration stable/improving
  20 + FLOOR(n * 0.2)::INT + FLOOR(RANDOM() * 5)::INT,
  -- Active users improving
  LEAST(50, 35 + FLOOR(n * 0.5)::INT + FLOOR(RANDOM() * 3)::INT),
  'growing',
  -- Adoption score improving from 65 to 78
  LEAST(78, 65 + FLOOR(n * 0.45)::INT + FLOOR(RANDOM() * 4)::INT)
FROM generate_series(0, 29) n
ON CONFLICT (customer_id, metric_date) DO NOTHING;

-- ============================================
-- HealthFirst Medical: Onboarding ramp-up
-- New customer, building momentum
-- ============================================
INSERT INTO usage_metrics (customer_id, metric_date, dau, wau, mau, login_count, api_calls, session_duration_avg, active_users, usage_trend, adoption_score)
SELECT
  'd0000000-0000-0000-0000-000000000004'::UUID,
  CURRENT_DATE - (n || ' days')::INTERVAL,
  -- DAU: Starting low (10), ramping up to 22
  LEAST(22, 10 + FLOOR(n * 0.4)::INT + FLOOR(RANDOM() * 5)::INT),
  -- WAU: Starting at 25, ramping to 45
  LEAST(45, 25 + FLOOR(n * 0.65)::INT + FLOOR(RANDOM() * 5)::INT),
  -- MAU: Starting at 40, ramping to 70
  LEAST(70, 40 + FLOOR(n * 1)::INT + FLOOR(RANDOM() * 8)::INT),
  -- Logins: ramping up
  LEAST(60, 30 + FLOOR(n * 1)::INT + FLOOR(RANDOM() * 8)::INT),
  -- API calls: low but growing
  LEAST(600, 200 + FLOOR(n * 13)::INT + FLOOR(RANDOM() * 50)::INT),
  -- Session duration: learning curve, starts long
  GREATEST(15, 30 - FLOOR(n * 0.3)::INT + FLOOR(RANDOM() * 5)::INT),
  -- Active users: ramping
  LEAST(25, 12 + FLOOR(n * 0.45)::INT + FLOOR(RANDOM() * 3)::INT),
  'stable',
  -- Adoption score: starting low, improving
  LEAST(58, 40 + FLOOR(n * 0.6)::INT + FLOOR(RANDOM() * 5)::INT)
FROM generate_series(0, 29) n
ON CONFLICT (customer_id, metric_date) DO NOTHING;

-- ============================================
-- RetailMax: Sporadic usage
-- Volatile, unpredictable patterns
-- ============================================
INSERT INTO usage_metrics (customer_id, metric_date, dau, wau, mau, login_count, api_calls, session_duration_avg, active_users, usage_trend, adoption_score)
SELECT
  'd0000000-0000-0000-0000-000000000005'::UUID,
  CURRENT_DATE - (n || ' days')::INTERVAL,
  -- DAU: volatile 15-35, with occasional spikes and drops
  CASE
    WHEN n % 7 = 0 THEN 35 + FLOOR(RANDOM() * 10)::INT  -- Weekly spike
    WHEN n % 3 = 0 THEN 10 + FLOOR(RANDOM() * 8)::INT   -- Periodic low
    ELSE 20 + FLOOR(RANDOM() * 12)::INT                  -- Normal variation
  END,
  -- WAU: volatile
  55 + FLOOR(RANDOM() * 25)::INT - 12,
  -- MAU: volatile
  90 + FLOOR(RANDOM() * 40)::INT - 20,
  -- Logins: unpredictable
  CASE
    WHEN n % 5 = 0 THEN 100 + FLOOR(RANDOM() * 30)::INT
    ELSE 40 + FLOOR(RANDOM() * 30)::INT
  END,
  -- API calls: sporadic
  CASE
    WHEN n % 4 = 0 THEN 1200 + FLOOR(RANDOM() * 300)::INT
    ELSE 400 + FLOOR(RANDOM() * 300)::INT
  END,
  -- Session duration: short
  8 + FLOOR(RANDOM() * 10)::INT,
  -- Active users: volatile
  25 + FLOOR(RANDOM() * 20)::INT - 10,
  CASE
    WHEN n < 10 THEN 'declining'
    WHEN n < 20 THEN 'stable'
    ELSE 'declining'
  END,
  -- Adoption score: dropping overall
  GREATEST(42, 60 - FLOOR(n * 0.4)::INT + FLOOR(RANDOM() * 10)::INT - 5)
FROM generate_series(0, 29) n
ON CONFLICT (customer_id, metric_date) DO NOTHING;

-- ============================================
-- Verify insertion
-- ============================================
DO $$
DECLARE
  metrics_count INT;
BEGIN
  SELECT COUNT(*) INTO metrics_count
  FROM usage_metrics
  WHERE customer_id IN (
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000005'
  );

  RAISE NOTICE 'Demo engagement metrics inserted: % (expected ~150)', metrics_count;
END $$;
