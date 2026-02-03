-- PRD-127: Meeting Booked -> Pre-Meeting Research
-- Migration for automated meeting prep briefs

-- Meeting Prep Briefs Table
CREATE TABLE IF NOT EXISTS meeting_prep_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  calendar_event_id VARCHAR(255),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  csm_id VARCHAR(255) NOT NULL,

  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  prep_delivered_at TIMESTAMPTZ,
  reminder_delivered_at TIMESTAMPTZ,

  -- Content (JSONB for flexibility)
  content JSONB NOT NULL DEFAULT '{}',
  -- content structure:
  -- {
  --   customerSnapshot: { name, healthScore, healthTrend, arr, renewalDate, stage, daysSinceLastMeeting },
  --   recentActivity: [{ type, description, date }],
  --   openItems: [{ type, description, dueDate, priority }],
  --   talkingPoints: [{ point, priority, context }],
  --   questions: [string],
  --   attendeeProfiles: [{ name, role, sentiment, lastContact, notes }],
  --   recommendations: [string],
  --   previousMeetings: [{ date, summary, decisions, followUps }],
  --   meetingContext: { agenda, objectives, meetingType }
  -- }

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'delivered', 'viewed', 'completed')),
  viewed_at TIMESTAMPTZ,

  -- Metadata
  generated_by VARCHAR(50) DEFAULT 'system', -- 'system', 'manual', 'agent'
  generation_duration_ms INTEGER,
  data_completeness INTEGER DEFAULT 0, -- 0-100 percentage

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_meeting_prep_briefs_csm_id ON meeting_prep_briefs(csm_id);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_briefs_customer_id ON meeting_prep_briefs(customer_id);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_briefs_scheduled_at ON meeting_prep_briefs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_briefs_status ON meeting_prep_briefs(status);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_briefs_calendar_event ON meeting_prep_briefs(calendar_event_id);

-- Unique constraint to prevent duplicate briefs for same meeting
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_prep_briefs_unique_meeting
  ON meeting_prep_briefs(calendar_event_id, csm_id) WHERE calendar_event_id IS NOT NULL;

-- Meeting Prep Delivery Log (for tracking notifications)
CREATE TABLE IF NOT EXISTS meeting_prep_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES meeting_prep_briefs(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('app', 'email', 'slack')),
  delivery_type VARCHAR(50) NOT NULL CHECK (delivery_type IN ('initial', 'reminder', 'morning_digest')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_prep_delivery_brief ON meeting_prep_delivery_log(brief_id);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_delivery_status ON meeting_prep_delivery_log(status);

-- Meeting Prep User Preferences
CREATE TABLE IF NOT EXISTS meeting_prep_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,

  -- Timing preferences
  initial_lead_hours INTEGER DEFAULT 24, -- Hours before meeting for initial brief
  reminder_lead_minutes INTEGER DEFAULT 60, -- Minutes before meeting for reminder
  morning_digest_enabled BOOLEAN DEFAULT true,
  morning_digest_time TIME DEFAULT '08:00:00',

  -- Delivery channels
  app_notifications BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  slack_notifications BOOLEAN DEFAULT false,

  -- Content preferences
  include_stakeholder_profiles BOOLEAN DEFAULT true,
  include_previous_meetings BOOLEAN DEFAULT true,
  include_risk_signals BOOLEAN DEFAULT true,
  max_talking_points INTEGER DEFAULT 7,

  -- Auto-generate settings
  auto_generate_enabled BOOLEAN DEFAULT true,
  minimum_meeting_duration_minutes INTEGER DEFAULT 15, -- Skip briefs for very short meetings

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_prep_prefs_user ON meeting_prep_preferences(user_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_meeting_prep_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_meeting_prep_briefs_timestamp ON meeting_prep_briefs;
CREATE TRIGGER update_meeting_prep_briefs_timestamp
  BEFORE UPDATE ON meeting_prep_briefs
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_prep_timestamp();

DROP TRIGGER IF EXISTS update_meeting_prep_preferences_timestamp ON meeting_prep_preferences;
CREATE TRIGGER update_meeting_prep_preferences_timestamp
  BEFORE UPDATE ON meeting_prep_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_prep_timestamp();

-- Comments for documentation
COMMENT ON TABLE meeting_prep_briefs IS 'PRD-127: Stores automated pre-meeting research briefs';
COMMENT ON TABLE meeting_prep_delivery_log IS 'PRD-127: Tracks delivery status of meeting prep notifications';
COMMENT ON TABLE meeting_prep_preferences IS 'PRD-127: User preferences for meeting prep automation';
COMMENT ON COLUMN meeting_prep_briefs.content IS 'JSONB containing customerSnapshot, recentActivity, openItems, talkingPoints, questions, attendeeProfiles, recommendations';
