-- Migration: 026_qbr_auto_prep.sql
-- PRD-120: QBR Scheduling → Auto-Prep
-- Purpose: Store QBR preparation data, materials, checklists, and reminders

-- QBR Preparations table (main tracking)
CREATE TABLE IF NOT EXISTS qbr_preparations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_event_id TEXT, -- Google Calendar event ID

  -- Scheduling
  scheduled_date TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60, -- 30, 60, or 90 min QBR
  quarter VARCHAR(10) NOT NULL, -- Q1, Q2, Q3, Q4
  year INT NOT NULL,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'preparing', 'ready', 'completed', 'cancelled')),
  prep_started_at TIMESTAMPTZ,
  prep_completed_at TIMESTAMPTZ,

  -- Aggregated metrics snapshot
  metrics JSONB DEFAULT '{}',
  -- Structure: {
  --   healthScoreCurrent: number,
  --   healthScoreTrend: 'up' | 'down' | 'stable',
  --   healthScoreQoQ: number (change from last quarter),
  --   usageMetrics: { dau, wau, mau, sessions, trend },
  --   adoptionScore: number,
  --   npsScore: number | null,
  --   csatScore: number | null,
  --   supportTickets: { total, escalated, resolved, avgResponseTime },
  --   engagementScore: number,
  --   roiMetrics: { valueDelivered, costSavings, timelineSaved }
  -- }

  -- Generated presentation
  presentation_doc_id TEXT, -- Google Slides ID
  presentation_url TEXT,
  presentation_generated_at TIMESTAMPTZ,
  presentation_customized_at TIMESTAMPTZ,

  -- Prep brief document
  prep_brief_doc_id TEXT, -- Google Docs ID
  prep_brief_url TEXT,

  -- Metrics spreadsheet
  metrics_sheet_id TEXT, -- Google Sheets ID
  metrics_sheet_url TEXT,

  -- Supporting documents folder
  qbr_folder_id TEXT, -- Google Drive folder ID

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- QBR Wins & Challenges
CREATE TABLE IF NOT EXISTS qbr_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qbr_id UUID NOT NULL REFERENCES qbr_preparations(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('win', 'challenge')),
  title TEXT NOT NULL,
  description TEXT,
  impact VARCHAR(20) DEFAULT 'medium' CHECK (impact IN ('high', 'medium', 'low')),
  source VARCHAR(100), -- Where this was extracted from (e.g., 'milestone:xxx', 'ticket:xxx')
  source_date TIMESTAMPTZ,
  display_order INT DEFAULT 0,
  is_included BOOLEAN DEFAULT TRUE, -- CSM can exclude items
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QBR Talking Points (for prep brief)
CREATE TABLE IF NOT EXISTS qbr_talking_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qbr_id UUID NOT NULL REFERENCES qbr_preparations(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'discussion', 'question', 'opportunity', 'risk', 'stakeholder'
  content TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  stakeholder_name TEXT, -- For stakeholder-specific notes
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QBR Checklist Items
CREATE TABLE IF NOT EXISTS qbr_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qbr_id UUID NOT NULL REFERENCES qbr_preparations(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default checklist items template
CREATE TABLE IF NOT EXISTS qbr_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task TEXT NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default checklist items
INSERT INTO qbr_checklist_templates (task, description, display_order) VALUES
  ('Review presentation', 'Review all slides and ensure data is accurate', 1),
  ('Customize with specific examples', 'Add customer-specific success stories and examples', 2),
  ('Confirm attendee list', 'Verify all key stakeholders are invited', 3),
  ('Prepare for likely questions', 'Review anticipated questions and prepare answers', 4),
  ('Identify success stories', 'Prepare 2-3 concrete success stories to share', 5),
  ('Review competitive landscape', 'Check for any competitive threats to address', 6),
  ('Review expansion opportunities', 'Identify and prepare expansion discussion points', 7),
  ('Test meeting technology', 'Verify video/audio setup and screen sharing', 8)
ON CONFLICT DO NOTHING;

-- QBR Reminders
CREATE TABLE IF NOT EXISTS qbr_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qbr_id UUID NOT NULL REFERENCES qbr_preparations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL, -- 'prep_ready', 'review', 'final', 'meeting_brief'
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  notification_id UUID, -- Reference to notifications table
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qbr_preparations_customer ON qbr_preparations(customer_id);
CREATE INDEX IF NOT EXISTS idx_qbr_preparations_user ON qbr_preparations(user_id);
CREATE INDEX IF NOT EXISTS idx_qbr_preparations_status ON qbr_preparations(status);
CREATE INDEX IF NOT EXISTS idx_qbr_preparations_scheduled ON qbr_preparations(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_qbr_preparations_calendar ON qbr_preparations(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_qbr_items_qbr ON qbr_items(qbr_id);
CREATE INDEX IF NOT EXISTS idx_qbr_items_type ON qbr_items(qbr_id, type);
CREATE INDEX IF NOT EXISTS idx_qbr_talking_points_qbr ON qbr_talking_points(qbr_id);
CREATE INDEX IF NOT EXISTS idx_qbr_checklist_items_qbr ON qbr_checklist_items(qbr_id);
CREATE INDEX IF NOT EXISTS idx_qbr_reminders_qbr ON qbr_reminders(qbr_id);
CREATE INDEX IF NOT EXISTS idx_qbr_reminders_scheduled ON qbr_reminders(scheduled_for) WHERE sent_at IS NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_qbr_preparation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS qbr_preparations_updated_at ON qbr_preparations;
CREATE TRIGGER qbr_preparations_updated_at
  BEFORE UPDATE ON qbr_preparations
  FOR EACH ROW
  EXECUTE FUNCTION update_qbr_preparation_timestamp();

-- RLS Policies
ALTER TABLE qbr_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qbr_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qbr_talking_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE qbr_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qbr_reminders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see QBRs they own or are assigned to the customer
CREATE POLICY qbr_preparations_access ON qbr_preparations
  FOR ALL USING (
    user_id = auth.uid() OR
    customer_id IN (
      SELECT id FROM customers WHERE assigned_csm_id = auth.uid()
    )
  );

CREATE POLICY qbr_items_access ON qbr_items
  FOR ALL USING (
    qbr_id IN (SELECT id FROM qbr_preparations WHERE user_id = auth.uid())
  );

CREATE POLICY qbr_talking_points_access ON qbr_talking_points
  FOR ALL USING (
    qbr_id IN (SELECT id FROM qbr_preparations WHERE user_id = auth.uid())
  );

CREATE POLICY qbr_checklist_items_access ON qbr_checklist_items
  FOR ALL USING (
    qbr_id IN (SELECT id FROM qbr_preparations WHERE user_id = auth.uid())
  );

CREATE POLICY qbr_reminders_access ON qbr_reminders
  FOR ALL USING (
    user_id = auth.uid()
  );
