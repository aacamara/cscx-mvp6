-- PRD: Context-Aware Agentic Document Generation (CADG)
-- Migration to create execution_plans table for HITL approval workflow

-- Create execution_plans table
CREATE TABLE IF NOT EXISTS execution_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

    -- Task classification
    task_type VARCHAR(50) NOT NULL,
    user_query TEXT NOT NULL,

    -- Plan content
    plan_json JSONB NOT NULL,
    context_summary JSONB,

    -- Workflow status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed')),

    -- Approval tracking
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    modifications JSONB,

    -- Error tracking
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_execution_plans_user_id ON execution_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_plans_customer_id ON execution_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_execution_plans_status ON execution_plans(status);
CREATE INDEX IF NOT EXISTS idx_execution_plans_task_type ON execution_plans(task_type);
CREATE INDEX IF NOT EXISTS idx_execution_plans_created_at ON execution_plans(created_at);

-- Composite index for user dashboard queries
CREATE INDEX IF NOT EXISTS idx_execution_plans_user_status ON execution_plans(user_id, status);

-- GIN index for searching within plan_json
CREATE INDEX IF NOT EXISTS idx_execution_plans_plan_json ON execution_plans USING GIN(plan_json);

-- Comments
COMMENT ON TABLE execution_plans IS 'Stores execution plans for CADG human-in-the-loop approval workflow';
COMMENT ON COLUMN execution_plans.task_type IS 'Type of task: qbr_generation, data_analysis, presentation_creation, document_creation, email_drafting, meeting_prep, transcription_summary, health_analysis, expansion_planning, risk_assessment, custom';
COMMENT ON COLUMN execution_plans.plan_json IS 'Full ExecutionPlan object with inputs, structure, actions, and destination';
COMMENT ON COLUMN execution_plans.context_summary IS 'Summary of aggregated context used for the plan';
COMMENT ON COLUMN execution_plans.status IS 'Workflow status: pending (awaiting approval), approved (ready for execution), rejected (user declined), executing (in progress), completed (done), failed (error)';
COMMENT ON COLUMN execution_plans.modifications IS 'User modifications made to the plan before approval';

-- Enable RLS
ALTER TABLE execution_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own execution plans" ON execution_plans
    FOR SELECT
    USING (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can create own execution plans" ON execution_plans
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can update own execution plans" ON execution_plans
    FOR UPDATE
    USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON execution_plans TO authenticated;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_execution_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_execution_plans_updated_at
    BEFORE UPDATE ON execution_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_execution_plans_updated_at();
