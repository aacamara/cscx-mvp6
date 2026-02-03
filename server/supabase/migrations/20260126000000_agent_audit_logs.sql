-- ================================================
-- AGENT AUDIT LOGS TABLE
-- Production audit logging for agentic actions
-- Migration: 20260126_agent_audit_logs.sql
-- ================================================

-- Create the agent_audit_logs table
CREATE TABLE IF NOT EXISTS agent_audit_logs (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  agent_type VARCHAR(50),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  input JSONB,
  output JSONB,
  status VARCHAR(50) NOT NULL,
  duration_ms INTEGER,
  error JSONB,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON agent_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON agent_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_agent_type ON agent_audit_logs(agent_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_customer_id ON agent_audit_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON agent_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON agent_audit_logs(created_at);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON agent_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON agent_audit_logs(action, created_at DESC);

-- Partial index for error logs (faster error analysis)
CREATE INDEX IF NOT EXISTS idx_audit_logs_errors ON agent_audit_logs(created_at DESC)
  WHERE status = 'failure';

-- Comment on table
COMMENT ON TABLE agent_audit_logs IS 'Audit logs for all agentic actions including executions, approvals, and configuration changes';

-- Comments on columns
COMMENT ON COLUMN agent_audit_logs.id IS 'Unique identifier for the audit log entry';
COMMENT ON COLUMN agent_audit_logs.user_id IS 'ID of the user who triggered the action';
COMMENT ON COLUMN agent_audit_logs.action IS 'Type of action (e.g., agent_execute_start, approval_approved)';
COMMENT ON COLUMN agent_audit_logs.agent_type IS 'Type of agent involved (e.g., orchestrator, scheduler)';
COMMENT ON COLUMN agent_audit_logs.customer_id IS 'Reference to the customer if applicable';
COMMENT ON COLUMN agent_audit_logs.input IS 'Input data for the action (JSON)';
COMMENT ON COLUMN agent_audit_logs.output IS 'Output/result of the action (JSON)';
COMMENT ON COLUMN agent_audit_logs.status IS 'Status of the action (success, failure, pending, cancelled)';
COMMENT ON COLUMN agent_audit_logs.duration_ms IS 'Duration of the action in milliseconds';
COMMENT ON COLUMN agent_audit_logs.error IS 'Error details if the action failed (JSON with message, code, stack)';
COMMENT ON COLUMN agent_audit_logs.metadata IS 'Additional metadata (JSON)';
COMMENT ON COLUMN agent_audit_logs.ip_address IS 'IP address of the request origin';
COMMENT ON COLUMN agent_audit_logs.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN agent_audit_logs.created_at IS 'Timestamp when the log entry was created';

-- ================================================
-- RETENTION POLICY (Optional)
-- Automatically delete old audit logs after 90 days
-- Uncomment to enable
-- ================================================
/*
-- Create a function to delete old audit logs
CREATE OR REPLACE FUNCTION delete_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM agent_audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule the cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-audit-logs', '0 3 * * *', 'SELECT delete_old_audit_logs()');
*/

-- ================================================
-- VIEWS FOR AUDIT LOG ANALYSIS
-- ================================================

-- View: Recent audit log summary
CREATE OR REPLACE VIEW v_audit_log_summary AS
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  action,
  agent_type,
  status,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms
FROM agent_audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), action, agent_type, status
ORDER BY hour DESC, count DESC;

-- View: User activity summary
CREATE OR REPLACE VIEW v_user_audit_activity AS
SELECT
  user_id,
  COUNT(*) as total_actions,
  COUNT(*) FILTER (WHERE status = 'success') as successful_actions,
  COUNT(*) FILTER (WHERE status = 'failure') as failed_actions,
  COUNT(DISTINCT action) as distinct_actions,
  AVG(duration_ms) as avg_duration_ms,
  MAX(created_at) as last_activity
FROM agent_audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY total_actions DESC;

-- View: Error analysis
CREATE OR REPLACE VIEW v_audit_log_errors AS
SELECT
  id,
  user_id,
  action,
  agent_type,
  error->>'message' as error_message,
  error->>'code' as error_code,
  created_at
FROM agent_audit_logs
WHERE status = 'failure'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- View: Approval decision metrics
CREATE OR REPLACE VIEW v_approval_metrics AS
SELECT
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) FILTER (WHERE action = 'approval_requested') as requested,
  COUNT(*) FILTER (WHERE action = 'approval_approved') as approved,
  COUNT(*) FILTER (WHERE action = 'approval_rejected') as rejected,
  ROUND(
    COUNT(*) FILTER (WHERE action = 'approval_approved')::decimal /
    NULLIF(COUNT(*) FILTER (WHERE action IN ('approval_approved', 'approval_rejected')), 0) * 100,
    2
  ) as approval_rate_percent
FROM agent_audit_logs
WHERE action IN ('approval_requested', 'approval_approved', 'approval_rejected')
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- ================================================
-- GRANTS
-- ================================================
-- Grant permissions to service role (typically handled by Supabase)
-- GRANT ALL ON agent_audit_logs TO service_role;
-- GRANT SELECT ON v_audit_log_summary TO service_role;
-- GRANT SELECT ON v_user_audit_activity TO service_role;
-- GRANT SELECT ON v_audit_log_errors TO service_role;
-- GRANT SELECT ON v_approval_metrics TO service_role;
