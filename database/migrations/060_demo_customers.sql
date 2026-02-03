-- ============================================
-- PRD: Demo Customer Data Seeding
-- Migration: 060_demo_customers.sql
-- Description: Insert 5 demo customers with varying profiles for realistic demos
-- ============================================

-- Add status and nps_score columns if they don't exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nps_score INT;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- ============================================
-- DEMO CUSTOMERS
-- ============================================
-- 1. Acme Corporation - healthy, $450K ARR
-- 2. TechStart Inc - at-risk, $85K ARR
-- 3. Global Logistics - expansion, $320K ARR
-- 4. HealthFirst Medical - onboarding, $150K ARR
-- 5. RetailMax - churning, $200K ARR
-- ============================================

INSERT INTO customers (
  id,
  name,
  arr,
  tier,
  status,
  health_score,
  health_color,
  nps_score,
  industry,
  segment,
  renewal_date,
  contract_start_date
) VALUES
-- Acme Corporation: Healthy flagship customer
(
  'd0000000-0000-0000-0000-000000000001',
  'Acme Corporation',
  450000.00,
  'platinum',
  'healthy',
  82,
  'green',
  72,
  'Technology',
  'enterprise',
  '2026-09-15',
  '2024-09-15'
),
-- TechStart Inc: At-risk startup, declining engagement
(
  'd0000000-0000-0000-0000-000000000002',
  'TechStart Inc',
  85000.00,
  'silver',
  'at-risk',
  45,
  'red',
  28,
  'SaaS',
  'commercial',
  '2026-05-01',
  '2025-05-01'
),
-- Global Logistics: Expansion opportunity, growing usage
(
  'd0000000-0000-0000-0000-000000000003',
  'Global Logistics',
  320000.00,
  'gold',
  'expansion',
  78,
  'yellow',
  65,
  'Logistics',
  'enterprise',
  '2026-11-30',
  '2024-11-30'
),
-- HealthFirst Medical: Onboarding, new customer
(
  'd0000000-0000-0000-0000-000000000004',
  'HealthFirst Medical',
  150000.00,
  'gold',
  'onboarding',
  65,
  'yellow',
  NULL,
  'Healthcare',
  'commercial',
  '2027-01-15',
  '2026-01-15'
),
-- RetailMax: Churning customer, volatile metrics
(
  'd0000000-0000-0000-0000-000000000005',
  'RetailMax',
  200000.00,
  'gold',
  'churning',
  52,
  'red',
  15,
  'Retail',
  'enterprise',
  '2026-04-30',
  '2025-04-30'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Verify insertion
-- ============================================
DO $$
DECLARE
  customer_count INT;
BEGIN
  SELECT COUNT(*) INTO customer_count
  FROM customers
  WHERE id IN (
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000005'
  );

  RAISE NOTICE 'Demo customers inserted: %', customer_count;
END $$;
