-- STEP 3: Insert data - workspace and invite code
-- Run this AFTER step2_tables.sql

-- Insert default workspace
INSERT INTO public.workspaces (id, name, slug, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'CSCX Design Partners',
  'cscx-partners',
  '{"tier": "enterprise", "features": ["all"]}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Insert invite code "2362369"
-- SHA256 hash of "2362369" = 6e34f8caf41708595b6e1af5db87761123068f23505a3b959560bb548f333409
INSERT INTO public.invite_codes (
  code_hash,
  workspace_id,
  max_uses,
  uses_remaining,
  expires_at,
  is_active,
  metadata
) VALUES (
  '6e34f8caf41708595b6e1af5db87761123068f23505a3b959560bb548f333409',
  'a0000000-0000-0000-0000-000000000001',
  1000,
  1000,
  NOW() + INTERVAL '1 year',
  true,
  '{"description": "Beta access code", "created_for": "design_partners"}'::jsonb
)
ON CONFLICT (code_hash) DO UPDATE SET
  uses_remaining = 1000,
  expires_at = NOW() + INTERVAL '1 year',
  is_active = true;

-- Verify data
SELECT 'Data inserted. Invite code 2362369 is ready.' as status;
SELECT code_hash, workspace_id, uses_remaining, is_active, expires_at
FROM public.invite_codes
WHERE code_hash = '6e34f8caf41708595b6e1af5db87761123068f23505a3b959560bb548f333409';
