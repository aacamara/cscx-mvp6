-- Fix CADG table foreign key constraints
-- The original migration referenced 'users' table but the user_id comes from auth.users

-- Drop existing FK constraints on execution_plans
ALTER TABLE execution_plans DROP CONSTRAINT IF EXISTS execution_plans_user_id_fkey;
ALTER TABLE execution_plans DROP CONSTRAINT IF EXISTS execution_plans_approved_by_fkey;
ALTER TABLE execution_plans DROP CONSTRAINT IF EXISTS execution_plans_customer_id_fkey;

-- Drop existing FK constraints on generated_artifacts (if exists)
ALTER TABLE generated_artifacts DROP CONSTRAINT IF EXISTS generated_artifacts_user_id_fkey;
ALTER TABLE generated_artifacts DROP CONSTRAINT IF EXISTS generated_artifacts_plan_id_fkey;

-- Keep user_id and approved_by as UUID columns without FK constraint
-- This allows Supabase auth user IDs to be stored directly
COMMENT ON COLUMN execution_plans.user_id IS 'Supabase auth user UUID - no FK to allow auth.users IDs';
COMMENT ON COLUMN execution_plans.approved_by IS 'Supabase auth user UUID who approved the plan - no FK to allow auth.users IDs';
COMMENT ON COLUMN execution_plans.customer_id IS 'Customer UUID - FK dropped to allow flexibility';
