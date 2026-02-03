-- ============================================
-- PRD-180: Custom Report Builder
-- Migration: Create custom_reports table
-- ============================================

-- Custom Reports Table
-- Stores user-created report configurations with filters, columns, groupings, and visualizations
CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  created_by UUID NOT NULL,
  is_template BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  shared_with JSONB DEFAULT '[]'::jsonb,
  schedule JSONB,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_executed_at TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_custom_reports_created_by ON custom_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_reports_is_template ON custom_reports(is_template);
CREATE INDEX IF NOT EXISTS idx_custom_reports_is_public ON custom_reports(is_public);
CREATE INDEX IF NOT EXISTS idx_custom_reports_updated_at ON custom_reports(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_reports_data_source ON custom_reports((config->>'data_source'));
CREATE INDEX IF NOT EXISTS idx_custom_reports_tags ON custom_reports USING GIN(tags);

-- Full-text search index for name and description
CREATE INDEX IF NOT EXISTS idx_custom_reports_search ON custom_reports USING GIN(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
);

-- Enable Row Level Security
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see their own reports, public reports, and reports shared with them
CREATE POLICY custom_reports_select_policy ON custom_reports
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR is_public = true
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(shared_with) AS share
      WHERE (share->>'user_id')::uuid = auth.uid()
    )
  );

-- RLS Policy: Users can only insert their own reports
CREATE POLICY custom_reports_insert_policy ON custom_reports
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- RLS Policy: Users can update their own reports or reports where they have edit/admin permission
CREATE POLICY custom_reports_update_policy ON custom_reports
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(shared_with) AS share
      WHERE (share->>'user_id')::uuid = auth.uid()
        AND (share->>'permission') IN ('edit', 'admin')
    )
  );

-- RLS Policy: Users can only delete their own reports or reports where they have admin permission
CREATE POLICY custom_reports_delete_policy ON custom_reports
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(shared_with) AS share
      WHERE (share->>'user_id')::uuid = auth.uid()
        AND (share->>'permission') = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS custom_reports_updated_at_trigger ON custom_reports;
CREATE TRIGGER custom_reports_updated_at_trigger
  BEFORE UPDATE ON custom_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_reports_updated_at();

-- Function to increment execution count (used by service)
CREATE OR REPLACE FUNCTION increment_report_execution(report_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE custom_reports
  SET
    execution_count = execution_count + 1,
    last_executed_at = NOW()
  WHERE id = report_id;
END;
$$ LANGUAGE plpgsql;

-- Report Execution History Table (optional, for audit/analytics)
CREATE TABLE IF NOT EXISTS custom_report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES custom_reports(id) ON DELETE CASCADE,
  executed_by UUID NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  execution_time_ms INTEGER,
  row_count INTEGER,
  export_format VARCHAR(50),
  scheduled BOOLEAN DEFAULT false,
  error_message TEXT
);

-- Index for execution history queries
CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON custom_report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_executed_at ON custom_report_executions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_executions_executed_by ON custom_report_executions(executed_by);

-- Enable RLS on execution history
ALTER TABLE custom_report_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see executions for reports they have access to
CREATE POLICY report_executions_select_policy ON custom_report_executions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM custom_reports cr
      WHERE cr.id = custom_report_executions.report_id
        AND (
          cr.created_by = auth.uid()
          OR cr.is_public = true
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(cr.shared_with) AS share
            WHERE (share->>'user_id')::uuid = auth.uid()
          )
        )
    )
  );

-- RLS Policy: Users can insert executions for reports they have access to
CREATE POLICY report_executions_insert_policy ON custom_report_executions
  FOR INSERT
  WITH CHECK (
    executed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM custom_reports cr
      WHERE cr.id = custom_report_executions.report_id
        AND (
          cr.created_by = auth.uid()
          OR cr.is_public = true
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(cr.shared_with) AS share
            WHERE (share->>'user_id')::uuid = auth.uid()
          )
        )
    )
  );

-- Insert some default report templates
INSERT INTO custom_reports (id, name, description, config, created_by, is_template, is_public, tags)
VALUES
  (
    'template-at-risk-high-value',
    'At-Risk High-Value Accounts',
    'Identifies accounts with health score below 50 and ARR over $100K, grouped by CSM for immediate attention',
    '{
      "data_source": "customers",
      "columns": [
        {"id": "col-1", "field_id": "name", "field_name": "Customer Name", "field_type": "string", "display_name": "Customer", "visible": true, "order": 0},
        {"id": "col-2", "field_id": "arr", "field_name": "ARR", "field_type": "currency", "display_name": "ARR", "visible": true, "order": 1},
        {"id": "col-3", "field_id": "health_score", "field_name": "Health Score", "field_type": "number", "display_name": "Health", "visible": true, "order": 2},
        {"id": "col-4", "field_id": "csm_name", "field_name": "CSM Name", "field_type": "string", "display_name": "CSM", "visible": true, "order": 3},
        {"id": "col-5", "field_id": "days_since_contact", "field_name": "Days Since Last Contact", "field_type": "number", "display_name": "Days Silent", "visible": true, "order": 4}
      ],
      "filters": {
        "logic": "AND",
        "filters": [
          {"id": "f-1", "field_id": "health_score", "field_name": "Health Score", "operator": "less_than", "value": 50},
          {"id": "f-2", "field_id": "arr", "field_name": "ARR", "operator": "greater_than", "value": 100000}
        ]
      },
      "groupings": [{"field_id": "csm_name", "field_name": "CSM Name", "order": 0}],
      "sortings": [{"field_id": "arr", "field_name": "ARR", "direction": "desc", "order": 0}],
      "visualization": {"type": "table"},
      "limit": 100
    }'::jsonb,
    '00000000-0000-0000-0000-000000000000',
    true,
    true,
    ARRAY['risk', 'high-value', 'health-score']
  ),
  (
    'template-renewal-pipeline',
    'Renewal Pipeline by Month',
    'Shows upcoming renewals grouped by month with probability and forecasted ARR',
    '{
      "data_source": "renewals",
      "columns": [
        {"id": "col-1", "field_id": "customer_name", "field_name": "Customer Name", "field_type": "string", "display_name": "Customer", "visible": true, "order": 0},
        {"id": "col-2", "field_id": "renewal_date", "field_name": "Renewal Date", "field_type": "date", "display_name": "Renewal Date", "visible": true, "order": 1},
        {"id": "col-3", "field_id": "current_arr", "field_name": "Current ARR", "field_type": "currency", "display_name": "Current ARR", "visible": true, "order": 2},
        {"id": "col-4", "field_id": "forecasted_arr", "field_name": "Forecasted ARR", "field_type": "currency", "display_name": "Forecast", "visible": true, "order": 3},
        {"id": "col-5", "field_id": "renewal_probability", "field_name": "Renewal Probability", "field_type": "number", "display_name": "Probability", "visible": true, "order": 4},
        {"id": "col-6", "field_id": "risk_level", "field_name": "Risk Level", "field_type": "string", "display_name": "Risk", "visible": true, "order": 5}
      ],
      "filters": {
        "logic": "AND",
        "filters": [
          {"id": "f-1", "field_id": "days_to_renewal", "field_name": "Days to Renewal", "operator": "less_than_or_equal", "value": 90}
        ]
      },
      "groupings": [],
      "sortings": [{"field_id": "renewal_date", "field_name": "Renewal Date", "direction": "asc", "order": 0}],
      "visualization": {"type": "table"},
      "limit": 100
    }'::jsonb,
    '00000000-0000-0000-0000-000000000000',
    true,
    true,
    ARRAY['renewals', 'pipeline', 'forecast']
  ),
  (
    'template-csm-activity-summary',
    'CSM Activity Summary',
    'Shows activity metrics grouped by CSM for performance tracking',
    '{
      "data_source": "activities",
      "columns": [
        {"id": "col-1", "field_id": "csm_name", "field_name": "CSM Name", "field_type": "string", "display_name": "CSM", "visible": true, "order": 0},
        {"id": "col-2", "field_id": "activity_type", "field_name": "Activity Type", "field_type": "string", "display_name": "Type", "visible": true, "order": 1},
        {"id": "col-3", "field_id": "customer_name", "field_name": "Customer Name", "field_type": "string", "display_name": "Count", "aggregation": "count", "visible": true, "order": 2},
        {"id": "col-4", "field_id": "duration_minutes", "field_name": "Duration (mins)", "field_type": "number", "display_name": "Total Duration", "aggregation": "sum", "visible": true, "order": 3}
      ],
      "filters": {"logic": "AND", "filters": []},
      "groupings": [{"field_id": "csm_name", "field_name": "CSM Name", "order": 0}],
      "sortings": [{"field_id": "duration_minutes", "field_name": "Duration (mins)", "direction": "desc", "order": 0}],
      "visualization": {"type": "bar_chart", "title": "Activity by CSM", "show_legend": true},
      "limit": 100
    }'::jsonb,
    '00000000-0000-0000-0000-000000000000',
    true,
    true,
    ARRAY['activities', 'csm', 'performance']
  )
ON CONFLICT (id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE custom_reports IS 'PRD-180: Stores custom report configurations including columns, filters, groupings, visualization, and scheduling';
COMMENT ON TABLE custom_report_executions IS 'PRD-180: Audit trail of report executions for analytics and debugging';
COMMENT ON COLUMN custom_reports.config IS 'JSONB containing: data_source, columns, filters, groupings, sortings, visualization, limit';
COMMENT ON COLUMN custom_reports.shared_with IS 'JSONB array of {user_id, permission, shared_at} objects';
COMMENT ON COLUMN custom_reports.schedule IS 'JSONB containing: enabled, frequency, day_of_week/month, time, timezone, recipients, export_format';
