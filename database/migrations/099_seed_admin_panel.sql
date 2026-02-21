-- ============================================
-- Seed: Admin Panel Demo Data
-- Organization + team members + activity log
-- Safe to re-run (all ON CONFLICT DO NOTHING)
-- ============================================

-- ============================================
-- 1. DEMO ORGANIZATION
-- ============================================
INSERT INTO organizations (id, name, slug, plan, settings)
VALUES (
  'd0000000-0000-0000-0000-0a9000000001',
  'Acme Corp CS Team',
  'acme-cs',
  'pro',
  '{"features": ["all"], "maxSeats": 10}'
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 2. TEAM MEMBERS (1 admin + 3 CSMs)
-- ============================================
-- Demo user = admin
INSERT INTO org_members (id, organization_id, user_id, role, status, joined_at)
VALUES (
  'd0000000-0000-0000-0000-0b1000000001',
  'd0000000-0000-0000-0000-0a9000000001',
  'df2dc7be-ece0-40b2-a9d7-0f6c45b75131',
  'admin',
  'active',
  NOW() - INTERVAL '30 days'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- CSM 1: Sarah Chen
INSERT INTO org_members (id, organization_id, user_id, role, status, joined_at)
VALUES (
  'd0000000-0000-0000-0000-0b1000000002',
  'd0000000-0000-0000-0000-0a9000000001',
  'd0000000-0000-0000-0000-c00000000001',
  'csm',
  'active',
  NOW() - INTERVAL '25 days'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- CSM 2: Marcus Rodriguez
INSERT INTO org_members (id, organization_id, user_id, role, status, joined_at)
VALUES (
  'd0000000-0000-0000-0000-0b1000000003',
  'd0000000-0000-0000-0000-0a9000000001',
  'd0000000-0000-0000-0000-c00000000002',
  'csm',
  'active',
  NOW() - INTERVAL '20 days'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- CSM 3: Priya Patel
INSERT INTO org_members (id, organization_id, user_id, role, status, joined_at)
VALUES (
  'd0000000-0000-0000-0000-0b1000000004',
  'd0000000-0000-0000-0000-0a9000000001',
  'd0000000-0000-0000-0000-c00000000003',
  'csm',
  'active',
  NOW() - INTERVAL '15 days'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- CSM 4: Jordan Taylor (viewer)
INSERT INTO org_members (id, organization_id, user_id, role, status, joined_at)
VALUES (
  'd0000000-0000-0000-0000-0b1000000005',
  'd0000000-0000-0000-0000-0a9000000001',
  'd0000000-0000-0000-0000-c00000000004',
  'viewer',
  'active',
  NOW() - INTERVAL '10 days'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ============================================
-- 3. ASSIGN CUSTOMERS TO CSMs
-- Distribute 33 demo customers across 3 CSMs
-- ============================================
DO $$ BEGIN
  -- Add csm_id column if missing
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS csm_id UUID;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS csm_name TEXT;
END $$;

-- Sarah Chen: first 11 customers
UPDATE customers SET
  csm_id = 'd0000000-0000-0000-0000-c00000000001',
  csm_name = 'Sarah Chen'
WHERE id IN (
  SELECT id FROM customers WHERE is_demo = true ORDER BY name LIMIT 11
) AND (csm_id IS NULL OR csm_id = 'd0000000-0000-0000-0000-c00000000001');

-- Marcus Rodriguez: next 11
UPDATE customers SET
  csm_id = 'd0000000-0000-0000-0000-c00000000002',
  csm_name = 'Marcus Rodriguez'
WHERE id IN (
  SELECT id FROM customers WHERE is_demo = true ORDER BY name OFFSET 11 LIMIT 11
) AND (csm_id IS NULL OR csm_id = 'd0000000-0000-0000-0000-c00000000002');

-- Priya Patel: remaining 11
UPDATE customers SET
  csm_id = 'd0000000-0000-0000-0000-c00000000003',
  csm_name = 'Priya Patel'
WHERE id IN (
  SELECT id FROM customers WHERE is_demo = true ORDER BY name OFFSET 22 LIMIT 11
) AND (csm_id IS NULL OR csm_id = 'd0000000-0000-0000-0000-c00000000003');

-- ============================================
-- 4. AGENT ACTIVITY LOG (last 7 days)
-- Realistic activity for metrics dashboard
-- ============================================

-- Seed today's activity (varied action types)
INSERT INTO agent_activity_log (customer_id, agent_type, action_type, status, started_at, completed_at, duration_ms)
SELECT
  c.id,
  (ARRAY['renewal', 'risk', 'adoption', 'strategic', 'email'])[floor(random() * 5 + 1)],
  (ARRAY['agent_run', 'agentic_execution', 'analysis', 'recommendation', 'email_draft'])[floor(random() * 5 + 1)],
  CASE WHEN random() < 0.95 THEN 'completed' ELSE 'failed' END,
  NOW() - (random() * INTERVAL '8 hours'),
  NOW() - (random() * INTERVAL '7 hours'),
  floor(random() * 3000 + 200)::int
FROM customers c
WHERE c.is_demo = true
ORDER BY random()
LIMIT 25;

-- Seed yesterday's activity
INSERT INTO agent_activity_log (customer_id, agent_type, action_type, status, started_at, completed_at, duration_ms)
SELECT
  c.id,
  (ARRAY['renewal', 'risk', 'adoption', 'strategic'])[floor(random() * 4 + 1)],
  (ARRAY['agent_run', 'agentic_execution', 'analysis', 'recommendation'])[floor(random() * 4 + 1)],
  CASE WHEN random() < 0.93 THEN 'completed' ELSE 'failed' END,
  NOW() - INTERVAL '1 day' - (random() * INTERVAL '10 hours'),
  NOW() - INTERVAL '1 day' - (random() * INTERVAL '9 hours'),
  floor(random() * 4000 + 150)::int
FROM customers c
WHERE c.is_demo = true
ORDER BY random()
LIMIT 20;

-- Seed 2-7 days ago (10-15 entries per day)
INSERT INTO agent_activity_log (customer_id, agent_type, action_type, status, started_at, completed_at, duration_ms)
SELECT
  c.id,
  (ARRAY['renewal', 'risk', 'adoption', 'strategic', 'email'])[floor(random() * 5 + 1)],
  (ARRAY['agent_run', 'agentic_execution', 'analysis', 'recommendation', 'email_draft'])[floor(random() * 5 + 1)],
  CASE WHEN random() < 0.92 THEN 'completed' ELSE 'failed' END,
  NOW() - (floor(random() * 5 + 2) * INTERVAL '1 day') - (random() * INTERVAL '10 hours'),
  NOW() - (floor(random() * 5 + 2) * INTERVAL '1 day') - (random() * INTERVAL '9 hours'),
  floor(random() * 5000 + 100)::int
FROM customers c
WHERE c.is_demo = true
ORDER BY random()
LIMIT 80;

-- ============================================
-- 5. APPROVAL REQUESTS (pending queue)
-- ============================================
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  customer_id UUID,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO approval_requests (agent_type, action_type, customer_id, description, status)
VALUES
  ('renewal', 'send_renewal_proposal', 'd0000000-0000-0000-0000-000000000003'::uuid, 'Auto-generated renewal proposal for TechFlow Inc — 15% uplift recommended', 'pending'),
  ('risk', 'escalate_to_manager', 'd0000000-0000-0000-0000-000000000005'::uuid, 'Critical risk alert: DataStream Pro usage dropped 40% — executive escalation drafted', 'pending'),
  ('strategic', 'send_qbr_invite', 'd0000000-0000-0000-0000-000000000001'::uuid, 'QBR scheduled with Acme Corp — agenda and deck auto-generated', 'pending')
ON CONFLICT DO NOTHING;
