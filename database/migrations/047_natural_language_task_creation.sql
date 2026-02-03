-- PRD-234: Natural Language Task Creation
-- Migration to add source tracking columns to tasks table

-- Add source tracking columns to plan_tasks table
ALTER TABLE plan_tasks
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_input TEXT,
ADD COLUMN IF NOT EXISTS parse_confidence DECIMAL(3,2);

-- Add task type column if not exists
ALTER TABLE plan_tasks
ADD COLUMN IF NOT EXISTS task_type VARCHAR(50) DEFAULT 'other';

-- Add completed_at and completion_notes columns
ALTER TABLE plan_tasks
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completion_notes TEXT;

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_plan_tasks_source ON plan_tasks(source);

-- Add index for filtering by task type
CREATE INDEX IF NOT EXISTS idx_plan_tasks_task_type ON plan_tasks(task_type);

-- Add index for filtering by parse confidence (for analytics)
CREATE INDEX IF NOT EXISTS idx_plan_tasks_parse_confidence ON plan_tasks(parse_confidence) WHERE parse_confidence IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN plan_tasks.source IS 'How the task was created: manual, natural_language, automation, meeting_notes, voice';
COMMENT ON COLUMN plan_tasks.source_input IS 'Original natural language input used to create the task';
COMMENT ON COLUMN plan_tasks.parse_confidence IS 'AI confidence score (0-1) when created from natural language';
COMMENT ON COLUMN plan_tasks.task_type IS 'Type of task: follow_up, send, schedule, review, call, email, research, meeting, documentation, other';
COMMENT ON COLUMN plan_tasks.completed_at IS 'Timestamp when task was marked as completed';
COMMENT ON COLUMN plan_tasks.completion_notes IS 'Notes added when completing the task';

-- Create task_parse_history table for tracking NL parsing accuracy
CREATE TABLE IF NOT EXISTS task_parse_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES plan_tasks(id) ON DELETE SET NULL,
    raw_input TEXT NOT NULL,
    parsed_data JSONB NOT NULL,
    suggested_task JSONB NOT NULL,
    confidence DECIMAL(3,2) NOT NULL,
    was_modified BOOLEAN DEFAULT false,
    modifications JSONB,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for task_parse_history
CREATE INDEX IF NOT EXISTS idx_task_parse_history_task_id ON task_parse_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_parse_history_confidence ON task_parse_history(confidence);
CREATE INDEX IF NOT EXISTS idx_task_parse_history_created_at ON task_parse_history(created_at);

-- Comment on table
COMMENT ON TABLE task_parse_history IS 'Tracks natural language task parsing for accuracy improvement';

-- Create view for NL task creation analytics
CREATE OR REPLACE VIEW nl_task_analytics AS
SELECT
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_nl_tasks,
    AVG(parse_confidence) as avg_confidence,
    COUNT(*) FILTER (WHERE parse_confidence >= 0.8) as high_confidence_count,
    COUNT(*) FILTER (WHERE parse_confidence >= 0.6 AND parse_confidence < 0.8) as medium_confidence_count,
    COUNT(*) FILTER (WHERE parse_confidence < 0.6) as low_confidence_count,
    COUNT(DISTINCT customer_id) as unique_customers,
    COUNT(DISTINCT task_type) as task_types_used
FROM plan_tasks
WHERE source = 'natural_language'
AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

COMMENT ON VIEW nl_task_analytics IS 'Analytics view for natural language task creation metrics';

-- Enable RLS on task_parse_history
ALTER TABLE task_parse_history ENABLE ROW LEVEL SECURITY;

-- RLS policy for task_parse_history (users can see their own parse history)
CREATE POLICY "Users can view own parse history" ON task_parse_history
    FOR SELECT
    USING (created_by = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can insert own parse history" ON task_parse_history
    FOR INSERT
    WITH CHECK (created_by = auth.uid() OR auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT ON task_parse_history TO authenticated;
GRANT SELECT ON nl_task_analytics TO authenticated;
