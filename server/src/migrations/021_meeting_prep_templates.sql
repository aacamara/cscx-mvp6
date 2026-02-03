-- Migration: Meeting Prep Templates (PRD-256)
-- Created: 2026-01-30
-- Description: Tables for meeting prep template library and scheduled meeting preps

-- Meeting prep templates table
CREATE TABLE IF NOT EXISTS meeting_prep_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  meeting_type VARCHAR(50) NOT NULL CHECK (meeting_type IN ('1on1', 'team_sync', 'pipeline_review', 'qbr_planning', 'custom')),
  created_by_user_id UUID REFERENCES users(id),

  -- Sections to include
  -- Example: [{name: 'Portfolio Overview', type: 'metrics_summary', config: {metrics: ['health_score_avg', 'arr_total']}}]
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Default agenda template
  -- Example: [{topic: 'Review action items', duration_minutes: 5}]
  default_agenda JSONB DEFAULT '[]'::jsonb,

  -- Generation timing
  generate_hours_before INTEGER DEFAULT 24,
  send_to_attendees BOOLEAN DEFAULT true,

  -- Template settings
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled meeting preps table
CREATE TABLE IF NOT EXISTS scheduled_meeting_preps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES meeting_prep_templates(id) ON DELETE SET NULL,
  organizer_user_id UUID REFERENCES users(id),

  -- Meeting details
  meeting_title VARCHAR(500) NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  calendar_event_id VARCHAR(200),
  attendees UUID[] NOT NULL DEFAULT '{}',

  -- Generated content
  prep_document JSONB,
  generated_at TIMESTAMPTZ,

  -- Agenda
  agenda JSONB DEFAULT '[]'::jsonb,
  agenda_finalized BOOLEAN DEFAULT false,

  -- Status: scheduled, generated, sent, in_progress, completed
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'generated', 'sent', 'in_progress', 'completed')),
  sent_at TIMESTAMPTZ,

  -- Meeting notes
  meeting_notes TEXT,
  action_items JSONB DEFAULT '[]'::jsonb,
  -- Example: [{description: string, owner_user_id: uuid, due_date: date, status: string, customer_id?: uuid}]

  -- Post-meeting
  effectiveness_rating INTEGER CHECK (effectiveness_rating BETWEEN 1 AND 5),
  skip_recommended BOOLEAN DEFAULT false,
  skip_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting topic submissions
CREATE TABLE IF NOT EXISTS meeting_topic_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_prep_id UUID NOT NULL REFERENCES scheduled_meeting_preps(id) ON DELETE CASCADE,
  submitted_by_user_id UUID REFERENCES users(id),
  topic VARCHAR(500) NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES customers(id),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  added_to_agenda BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting action item tracking (for cross-meeting visibility)
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_prep_id UUID NOT NULL REFERENCES scheduled_meeting_preps(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  owner_user_id UUID REFERENCES users(id),
  customer_id UUID REFERENCES customers(id),
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_meeting_prep_templates_type ON meeting_prep_templates(meeting_type);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_templates_creator ON meeting_prep_templates(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_templates_active ON meeting_prep_templates(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_meeting_preps_date ON scheduled_meeting_preps(meeting_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_meeting_preps_organizer ON scheduled_meeting_preps(organizer_user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_meeting_preps_status ON scheduled_meeting_preps(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_meeting_preps_template ON scheduled_meeting_preps(template_id);

CREATE INDEX IF NOT EXISTS idx_meeting_topic_submissions_prep ON meeting_topic_submissions(meeting_prep_id);
CREATE INDEX IF NOT EXISTS idx_meeting_topic_submissions_user ON meeting_topic_submissions(submitted_by_user_id);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_prep ON meeting_action_items(meeting_prep_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_owner ON meeting_action_items(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_status ON meeting_action_items(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_due ON meeting_action_items(due_date) WHERE status = 'pending';

-- Comments
COMMENT ON TABLE meeting_prep_templates IS 'Templates for meeting prep documents with configurable sections and agendas (PRD-256)';
COMMENT ON TABLE scheduled_meeting_preps IS 'Scheduled meetings with prep materials, notes, and action items';
COMMENT ON TABLE meeting_topic_submissions IS 'Topics submitted by attendees before meetings';
COMMENT ON TABLE meeting_action_items IS 'Action items created from meetings with tracking';

-- Insert default templates
INSERT INTO meeting_prep_templates (name, description, meeting_type, sections, default_agenda, is_default) VALUES
(
  '1:1 Meeting',
  'Standard template for manager-CSM 1:1 meetings',
  '1on1',
  '[
    {"name": "Portfolio Overview", "type": "metrics_summary", "config": {"metrics": ["health_score_avg", "arr_total", "at_risk_count"]}},
    {"name": "Accounts Needing Attention", "type": "accounts_needing_attention", "config": {"limit": 5}},
    {"name": "Recent Wins", "type": "recent_wins", "config": {"days": 7}},
    {"name": "Open Action Items", "type": "open_action_items", "config": {}}
  ]'::jsonb,
  '[
    {"topic": "Review previous action items", "duration_minutes": 5},
    {"topic": "Portfolio health check", "duration_minutes": 10},
    {"topic": "Accounts needing attention", "duration_minutes": 15},
    {"topic": "Wins and accomplishments", "duration_minutes": 5},
    {"topic": "Development and support needed", "duration_minutes": 10},
    {"topic": "New action items", "duration_minutes": 5}
  ]'::jsonb,
  true
),
(
  'Team Sync',
  'Weekly team sync meeting for entire CS team',
  'team_sync',
  '[
    {"name": "Team Metrics", "type": "team_metrics", "config": {"metrics": ["total_arr", "at_risk_arr", "renewals_this_month", "avg_health_score"]}},
    {"name": "Escalations", "type": "open_escalations", "config": {}},
    {"name": "Upcoming Renewals", "type": "upcoming_renewals", "config": {"days": 14}},
    {"name": "Team Wins", "type": "team_wins", "config": {"days": 7}}
  ]'::jsonb,
  '[
    {"topic": "Metrics review", "duration_minutes": 10},
    {"topic": "Escalation updates", "duration_minutes": 10},
    {"topic": "Renewal pipeline", "duration_minutes": 15},
    {"topic": "Team wins and shoutouts", "duration_minutes": 5},
    {"topic": "Process improvements", "duration_minutes": 10},
    {"topic": "Open floor", "duration_minutes": 10}
  ]'::jsonb,
  true
),
(
  'Pipeline Review',
  'Renewal pipeline review with leadership',
  'pipeline_review',
  '[
    {"name": "Pipeline Summary", "type": "pipeline_summary", "config": {"months": 3}},
    {"name": "At Risk Renewals", "type": "at_risk_renewals", "config": {}},
    {"name": "Expansion Opportunities", "type": "expansion_opportunities", "config": {}},
    {"name": "Forecast vs Actuals", "type": "forecast_comparison", "config": {}}
  ]'::jsonb,
  '[
    {"topic": "Pipeline overview", "duration_minutes": 10},
    {"topic": "At-risk accounts deep dive", "duration_minutes": 20},
    {"topic": "Expansion opportunities", "duration_minutes": 15},
    {"topic": "Forecast updates", "duration_minutes": 10},
    {"topic": "Resource needs", "duration_minutes": 5}
  ]'::jsonb,
  true
),
(
  'QBR Planning',
  'Quarterly business review planning session',
  'qbr_planning',
  '[
    {"name": "Quarter Performance", "type": "quarter_metrics", "config": {}},
    {"name": "Goal Achievement", "type": "goal_tracking", "config": {}},
    {"name": "Customer Feedback Summary", "type": "feedback_summary", "config": {}},
    {"name": "Next Quarter Priorities", "type": "strategic_priorities", "config": {}}
  ]'::jsonb,
  '[
    {"topic": "Quarter performance review", "duration_minutes": 15},
    {"topic": "Goal achievement analysis", "duration_minutes": 15},
    {"topic": "Key learnings and feedback", "duration_minutes": 15},
    {"topic": "Next quarter goals", "duration_minutes": 20},
    {"topic": "Resource planning", "duration_minutes": 10},
    {"topic": "Action items", "duration_minutes": 5}
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;
