-- PRD-235: AI-Powered Account Planning
-- Database migration to add AI-related fields to account_plans table

-- Add AI generation fields to account_plans table
ALTER TABLE account_plans ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;
ALTER TABLE account_plans ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);
ALTER TABLE account_plans ADD COLUMN IF NOT EXISTS generation_context JSONB;

-- Add executive summary field (using notes column for summary)
-- Notes column already exists, no change needed

-- Add 90-day action plan field
ALTER TABLE account_plans ADD COLUMN IF NOT EXISTS action_plan_90day JSONB DEFAULT '[]'::JSONB;

-- Add business context field
ALTER TABLE account_plans ADD COLUMN IF NOT EXISTS business_context JSONB DEFAULT '{}'::JSONB;

-- Add benchmark comparison field
ALTER TABLE account_plans ADD COLUMN IF NOT EXISTS benchmark_comparison JSONB;

-- Create index for AI-generated plans
CREATE INDEX IF NOT EXISTS idx_account_plans_ai_generated ON account_plans(ai_generated) WHERE ai_generated = true;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_account_plans_status_active ON account_plans(status) WHERE status IN ('draft', 'pending_review', 'approved', 'active');

-- Create index for fiscal year lookups
CREATE INDEX IF NOT EXISTS idx_account_plans_fiscal_year ON account_plans(fiscal_year);

-- Add constraint for AI confidence range
ALTER TABLE account_plans ADD CONSTRAINT IF NOT EXISTS check_ai_confidence
  CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1));

-- Update the updated_at trigger if not exists
CREATE OR REPLACE FUNCTION update_account_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_account_plans_updated_at ON account_plans;
CREATE TRIGGER update_account_plans_updated_at
  BEFORE UPDATE ON account_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_account_plans_updated_at();

-- Add RLS policies for account plans (if RLS is enabled)
DO $$
BEGIN
  -- Enable RLS
  ALTER TABLE account_plans ENABLE ROW LEVEL SECURITY;

  -- Service role has full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'account_plans' AND policyname = 'Service role has full access to account plans'
  ) THEN
    CREATE POLICY "Service role has full access to account plans"
      ON account_plans FOR ALL
      USING (auth.role() = 'service_role');
  END IF;

  -- Users can view plans for their customers
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'account_plans' AND policyname = 'Users can view account plans'
  ) THEN
    CREATE POLICY "Users can view account plans"
      ON account_plans FOR SELECT
      USING (true);
  END IF;

EXCEPTION WHEN OTHERS THEN
  -- RLS might not be available in all environments
  RAISE NOTICE 'RLS policies could not be created: %', SQLERRM;
END;
$$;

-- Add comments for documentation
COMMENT ON COLUMN account_plans.ai_generated IS 'Whether this plan was AI-generated (PRD-235)';
COMMENT ON COLUMN account_plans.ai_confidence IS 'AI confidence score 0-1 for generated plans (PRD-235)';
COMMENT ON COLUMN account_plans.generation_context IS 'Metadata about AI generation: model, sources, timestamp (PRD-235)';
COMMENT ON COLUMN account_plans.action_plan_90day IS 'Array of 90-day action items with week, action, owner, completed (PRD-235)';
COMMENT ON COLUMN account_plans.business_context IS 'Business context: industry trends, customer goals, competitive landscape (PRD-235)';
COMMENT ON COLUMN account_plans.benchmark_comparison IS 'Comparison with similar successful accounts (PRD-235)';
