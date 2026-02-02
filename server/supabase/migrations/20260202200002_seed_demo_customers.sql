-- Seed 3 demo customers for design partner experience
-- These customers are visible to design partners (is_demo = true)

-- Demo Customer 1: Acme Corp (Healthy)
INSERT INTO public.customers (
  id, name, industry, arr, health_score, stage, is_demo, created_at, updated_at
) VALUES (
  'demo-0001-0001-0001-000000000001',
  'Acme Corp',
  'Technology',
  250000,
  85,
  'active',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  health_score = EXCLUDED.health_score,
  is_demo = true;

-- Demo Customer 2: TechStart Inc (At Risk)
INSERT INTO public.customers (
  id, name, industry, arr, health_score, stage, is_demo, created_at, updated_at
) VALUES (
  'demo-0002-0002-0002-000000000002',
  'TechStart Inc',
  'SaaS',
  85000,
  42,
  'at_risk',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  health_score = EXCLUDED.health_score,
  stage = EXCLUDED.stage,
  is_demo = true;

-- Demo Customer 3: GlobalTech (Expanding)
INSERT INTO public.customers (
  id, name, industry, arr, health_score, stage, is_demo, created_at, updated_at
) VALUES (
  'demo-0003-0003-0003-000000000003',
  'GlobalTech',
  'Enterprise Software',
  480000,
  92,
  'expanding',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  health_score = EXCLUDED.health_score,
  stage = EXCLUDED.stage,
  is_demo = true;

-- Verify
SELECT name, arr, health_score, stage, is_demo FROM public.customers WHERE is_demo = true;
