-- ============================================
-- PRD: Demo Customer Data Seeding
-- Migration: 062_demo_stakeholders.sql
-- Description: Insert 3-5 stakeholders per demo customer
-- ============================================

-- Add engagement_level and is_active columns if they don't exist
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS engagement_level TEXT DEFAULT 'medium';
ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_stakeholders_engagement ON stakeholders(engagement_level);
CREATE INDEX IF NOT EXISTS idx_stakeholders_active ON stakeholders(is_active);

-- ============================================
-- STAKEHOLDER DATA
-- ============================================
-- Acme: strong champion, engaged sponsor
-- TechStart: champion left (is_active=false), new contact
-- Global Logistics: multiple champions across departments
-- HealthFirst: single point of contact (risk)
-- RetailMax: disengaged sponsor, frustrated users
-- ============================================

-- Clear existing demo stakeholders to avoid duplicates
DELETE FROM stakeholders
WHERE customer_id IN (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000005'
);

-- ============================================
-- Acme Corporation Stakeholders (5)
-- Strong champion, engaged sponsor - healthy relationships
-- ============================================
INSERT INTO stakeholders (id, customer_id, name, title, email, role, engagement_level, is_primary, is_active, is_champion, is_decision_maker, sentiment)
VALUES
(
  's0000000-0001-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'Sarah Mitchell',
  'VP of Operations',
  'sarah.mitchell@acmecorp.com',
  'sponsor',
  'high',
  TRUE,
  TRUE,
  FALSE,
  TRUE,
  'positive'
),
(
  's0000000-0001-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000001',
  'James Chen',
  'Director of Customer Success',
  'james.chen@acmecorp.com',
  'champion',
  'high',
  FALSE,
  TRUE,
  TRUE,
  FALSE,
  'positive'
),
(
  's0000000-0001-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000001',
  'Emily Rodriguez',
  'Senior CS Manager',
  'emily.rodriguez@acmecorp.com',
  'user',
  'high',
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  'positive'
),
(
  's0000000-0001-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000001',
  'Michael Thompson',
  'CS Operations Lead',
  'michael.thompson@acmecorp.com',
  'user',
  'medium',
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  'positive'
),
(
  's0000000-0001-0000-0000-000000000005',
  'd0000000-0000-0000-0000-000000000001',
  'Lisa Park',
  'CFO',
  'lisa.park@acmecorp.com',
  'sponsor',
  'medium',
  FALSE,
  TRUE,
  FALSE,
  TRUE,
  'neutral'
);

-- ============================================
-- TechStart Inc Stakeholders (4)
-- Champion left, new inexperienced contact
-- ============================================
INSERT INTO stakeholders (id, customer_id, name, title, email, role, engagement_level, is_primary, is_active, is_champion, is_decision_maker, sentiment)
VALUES
(
  's0000000-0002-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'David Kim',
  'Former Head of CS',
  'david.kim@techstart.io',
  'champion',
  'low',
  FALSE,
  FALSE,  -- LEFT THE COMPANY
  TRUE,
  TRUE,
  'positive'
),
(
  's0000000-0002-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000002',
  'Ashley Brooks',
  'Junior CS Coordinator',
  'ashley.brooks@techstart.io',
  'user',
  'low',
  TRUE,
  TRUE,
  FALSE,
  FALSE,
  'neutral'
),
(
  's0000000-0002-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000002',
  'Ryan Patel',
  'Co-Founder',
  'ryan.patel@techstart.io',
  'sponsor',
  'low',
  FALSE,
  TRUE,
  FALSE,
  TRUE,
  'negative'
),
(
  's0000000-0002-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000002',
  'Jen Nguyen',
  'Operations Analyst',
  'jen.nguyen@techstart.io',
  'user',
  'medium',
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  'neutral'
);

-- ============================================
-- Global Logistics Stakeholders (5)
-- Multiple champions across departments
-- ============================================
INSERT INTO stakeholders (id, customer_id, name, title, email, role, engagement_level, is_primary, is_active, is_champion, is_decision_maker, sentiment)
VALUES
(
  's0000000-0003-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000003',
  'Marcus Williams',
  'Director of Supply Chain',
  'marcus.williams@globallogistics.com',
  'champion',
  'high',
  TRUE,
  TRUE,
  TRUE,
  FALSE,
  'positive'
),
(
  's0000000-0003-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003',
  'Diana Santos',
  'Head of Customer Experience',
  'diana.santos@globallogistics.com',
  'champion',
  'high',
  FALSE,
  TRUE,
  TRUE,
  FALSE,
  'positive'
),
(
  's0000000-0003-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000003',
  'Robert Chen',
  'SVP of Operations',
  'robert.chen@globallogistics.com',
  'sponsor',
  'medium',
  FALSE,
  TRUE,
  FALSE,
  TRUE,
  'positive'
),
(
  's0000000-0003-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000003',
  'Alicia Foster',
  'Warehouse Manager - East',
  'alicia.foster@globallogistics.com',
  'user',
  'high',
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  'positive'
),
(
  's0000000-0003-0000-0000-000000000005',
  'd0000000-0000-0000-0000-000000000003',
  'Tom Ramirez',
  'Warehouse Manager - West',
  'tom.ramirez@globallogistics.com',
  'user',
  'medium',
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  'neutral'
);

-- ============================================
-- HealthFirst Medical Stakeholders (3)
-- Single point of contact (risk) - onboarding
-- ============================================
INSERT INTO stakeholders (id, customer_id, name, title, email, role, engagement_level, is_primary, is_active, is_champion, is_decision_maker, sentiment)
VALUES
(
  's0000000-0004-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000004',
  'Dr. Katherine Hayes',
  'Chief Medical Officer',
  'katherine.hayes@healthfirst.org',
  'sponsor',
  'medium',
  TRUE,
  TRUE,
  FALSE,
  TRUE,
  'positive'
),
(
  's0000000-0004-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000004',
  'Brandon Lee',
  'IT Director',
  'brandon.lee@healthfirst.org',
  'user',
  'high',
  FALSE,
  TRUE,
  TRUE,
  FALSE,
  'positive'
),
(
  's0000000-0004-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000004',
  'Nancy Cooper',
  'Clinical Coordinator',
  'nancy.cooper@healthfirst.org',
  'user',
  'medium',
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  'neutral'
);

-- ============================================
-- RetailMax Stakeholders (4)
-- Disengaged sponsor, frustrated users
-- ============================================
INSERT INTO stakeholders (id, customer_id, name, title, email, role, engagement_level, is_primary, is_active, is_champion, is_decision_maker, sentiment)
VALUES
(
  's0000000-0005-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000005',
  'Victoria Chang',
  'VP of Retail Operations',
  'victoria.chang@retailmax.com',
  'sponsor',
  'low',
  TRUE,
  TRUE,
  FALSE,
  TRUE,
  'negative'
),
(
  's0000000-0005-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000005',
  'Derek Johnson',
  'Store Manager - Flagship',
  'derek.johnson@retailmax.com',
  'user',
  'low',
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  'negative'
),
(
  's0000000-0005-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000005',
  'Amanda White',
  'Regional Director',
  'amanda.white@retailmax.com',
  'champion',
  'medium',
  FALSE,
  TRUE,
  TRUE,
  FALSE,
  'neutral'
),
(
  's0000000-0005-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000005',
  'Carlos Rivera',
  'E-commerce Lead',
  'carlos.rivera@retailmax.com',
  'user',
  'low',
  FALSE,
  TRUE,
  FALSE,
  FALSE,
  'negative'
);

-- ============================================
-- Verify insertion
-- ============================================
DO $$
DECLARE
  stakeholder_count INT;
BEGIN
  SELECT COUNT(*) INTO stakeholder_count
  FROM stakeholders
  WHERE customer_id IN (
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000005'
  );

  RAISE NOTICE 'Demo stakeholders inserted: % (expected 21)', stakeholder_count;
END $$;
