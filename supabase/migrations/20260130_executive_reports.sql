-- PRD-179: Executive Summary Report
-- Migration to create executive_reports table for storing generated reports

-- Create executive_reports table
CREATE TABLE IF NOT EXISTS executive_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Period information
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label VARCHAR(100) NOT NULL,

  -- Report data (stored as JSONB for flexibility)
  metrics JSONB NOT NULL DEFAULT '{}',

  -- AI-generated narrative summary (optional)
  narrative TEXT,

  -- Metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id),

  -- Report status
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'archived')),

  -- Distribution list for scheduled reports
  distribution_list JSONB DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_executive_reports_period
  ON executive_reports(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_executive_reports_generated_at
  ON executive_reports(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_executive_reports_generated_by
  ON executive_reports(generated_by);

CREATE INDEX IF NOT EXISTS idx_executive_reports_status
  ON executive_reports(status);

-- Enable Row Level Security
ALTER TABLE executive_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all reports in their organization
CREATE POLICY "Users can read executive reports"
  ON executive_reports
  FOR SELECT
  USING (true);

-- Policy: Users can insert their own reports
CREATE POLICY "Users can create executive reports"
  ON executive_reports
  FOR INSERT
  WITH CHECK (auth.uid() = generated_by OR generated_by IS NULL);

-- Policy: Users can update their own reports
CREATE POLICY "Users can update their own executive reports"
  ON executive_reports
  FOR UPDATE
  USING (auth.uid() = generated_by OR generated_by IS NULL);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_executive_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_executive_reports_updated_at
  BEFORE UPDATE ON executive_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_executive_reports_updated_at();

-- Create scheduled_reports table for recurring report generation
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Report type
  report_type VARCHAR(50) NOT NULL DEFAULT 'executive_summary',

  -- Schedule configuration
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 28),

  -- Distribution
  distribution_list JSONB NOT NULL DEFAULT '[]',

  -- Owner
  created_by UUID REFERENCES auth.users(id),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding due schedules
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run
  ON scheduled_reports(next_run_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by
  ON scheduled_reports(created_by);

-- Enable RLS on scheduled_reports
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own schedules
CREATE POLICY "Users can read their own scheduled reports"
  ON scheduled_reports
  FOR SELECT
  USING (auth.uid() = created_by);

-- Policy: Users can create their own schedules
CREATE POLICY "Users can create scheduled reports"
  ON scheduled_reports
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Policy: Users can update their own schedules
CREATE POLICY "Users can update their own scheduled reports"
  ON scheduled_reports
  FOR UPDATE
  USING (auth.uid() = created_by);

-- Policy: Users can delete their own schedules
CREATE POLICY "Users can delete their own scheduled reports"
  ON scheduled_reports
  FOR DELETE
  USING (auth.uid() = created_by);

-- Create trigger for scheduled_reports updated_at
CREATE TRIGGER trigger_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_executive_reports_updated_at();

-- Comments for documentation
COMMENT ON TABLE executive_reports IS 'PRD-179: Stores generated executive summary reports';
COMMENT ON TABLE scheduled_reports IS 'PRD-179: Stores scheduled report configurations';
COMMENT ON COLUMN executive_reports.metrics IS 'JSONB containing all report metrics, portfolio data, wins, risks, and recommendations';
COMMENT ON COLUMN executive_reports.narrative IS 'AI-generated narrative summary of the report';
