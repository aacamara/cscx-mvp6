-- PRD-038: Training Invitation Personalization
-- Migration to add training session, invitation, and attendance tracking

-- ============================================
-- TRAINING SESSIONS (Catalog)
-- ============================================
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT NOT NULL,
  format TEXT DEFAULT 'webinar', -- 'webinar', 'workshop', 'self-paced', 'one-on-one'
  duration_minutes INTEGER DEFAULT 60,
  max_attendees INTEGER,
  scheduled_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'America/New_York',
  meeting_url TEXT,
  calendar_event_id TEXT,
  presenter_name TEXT,
  presenter_email TEXT,
  target_roles TEXT[], -- Array of roles this training is designed for
  target_features TEXT[], -- Features covered in this training
  skill_level TEXT DEFAULT 'intermediate', -- 'beginner', 'intermediate', 'advanced'
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern JSONB, -- For recurring sessions
  registration_deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled', -- 'draft', 'scheduled', 'in_progress', 'completed', 'cancelled'
  recording_url TEXT,
  materials_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_topic ON training_sessions(topic);
CREATE INDEX IF NOT EXISTS idx_training_sessions_scheduled ON training_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_training_sessions_status ON training_sessions(status);
CREATE INDEX IF NOT EXISTS idx_training_sessions_target_roles ON training_sessions USING GIN(target_roles);
CREATE INDEX IF NOT EXISTS idx_training_sessions_target_features ON training_sessions USING GIN(target_features);

-- ============================================
-- TRAINING INVITATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS training_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  training_session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_role TEXT,
  personalization_angle TEXT, -- What made this relevant for them
  adoption_gaps TEXT[], -- Features they haven't adopted
  skill_gaps TEXT[], -- Skills they could improve
  email_subject TEXT,
  email_body_html TEXT,
  email_body_text TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  reminder_sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft', -- 'draft', 'pending_approval', 'approved', 'sent', 'opened', 'registered', 'declined', 'expired'
  gmail_message_id TEXT,
  approval_id UUID REFERENCES approvals(id),
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_invitations_session ON training_invitations(training_session_id);
CREATE INDEX IF NOT EXISTS idx_training_invitations_customer ON training_invitations(customer_id);
CREATE INDEX IF NOT EXISTS idx_training_invitations_stakeholder ON training_invitations(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_training_invitations_status ON training_invitations(status);
CREATE INDEX IF NOT EXISTS idx_training_invitations_email ON training_invitations(recipient_email);

-- ============================================
-- TRAINING ATTENDANCE
-- ============================================
CREATE TABLE IF NOT EXISTS training_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  training_session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  training_invitation_id UUID REFERENCES training_invitations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  attendee_email TEXT NOT NULL,
  attendee_name TEXT,
  registration_source TEXT DEFAULT 'invitation', -- 'invitation', 'self_registered', 'manual'
  registered_at TIMESTAMPTZ,
  attended BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  attendance_duration_minutes INTEGER,
  engagement_score INTEGER, -- 0-100 based on participation
  feedback_rating INTEGER, -- 1-5 star rating
  feedback_text TEXT,
  follow_up_requested BOOLEAN DEFAULT FALSE,
  follow_up_notes TEXT,
  certificate_issued BOOLEAN DEFAULT FALSE,
  certificate_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_attendance_session ON training_attendance(training_session_id);
CREATE INDEX IF NOT EXISTS idx_training_attendance_customer ON training_attendance(customer_id);
CREATE INDEX IF NOT EXISTS idx_training_attendance_stakeholder ON training_attendance(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_training_attendance_email ON training_attendance(attendee_email);
CREATE INDEX IF NOT EXISTS idx_training_attendance_attended ON training_attendance(attended);

-- ============================================
-- TRAINING RECOMMENDATIONS (AI-Generated)
-- ============================================
CREATE TABLE IF NOT EXISTS training_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  training_session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  recommendation_type TEXT DEFAULT 'adoption_gap', -- 'adoption_gap', 'skill_gap', 'role_based', 'new_feature', 'refresher'
  relevance_score INTEGER DEFAULT 50, -- 0-100
  reason TEXT, -- Why this training is recommended
  adoption_data JSONB, -- Feature adoption metrics that triggered this
  skill_data JSONB, -- Skill assessment data
  status TEXT DEFAULT 'active', -- 'active', 'dismissed', 'converted'
  converted_to_invitation_id UUID REFERENCES training_invitations(id),
  dismissed_at TIMESTAMPTZ,
  dismissed_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_training_recommendations_customer ON training_recommendations(customer_id);
CREATE INDEX IF NOT EXISTS idx_training_recommendations_stakeholder ON training_recommendations(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_training_recommendations_session ON training_recommendations(training_session_id);
CREATE INDEX IF NOT EXISTS idx_training_recommendations_status ON training_recommendations(status);

-- ============================================
-- AUTO-UPDATE TIMESTAMPS TRIGGER
-- ============================================
CREATE TRIGGER update_training_sessions_timestamp
  BEFORE UPDATE ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_training_invitations_timestamp
  BEFORE UPDATE ON training_invitations
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_training_attendance_timestamp
  BEFORE UPDATE ON training_attendance
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- SAMPLE TRAINING SESSIONS
-- ============================================
INSERT INTO training_sessions (title, description, topic, format, duration_minutes, target_roles, target_features, skill_level, status)
VALUES
  (
    'Advanced Analytics & Custom Dashboards',
    'Learn how to build custom dashboards tailored to your KPIs, set up automated report scheduling, and share insights across your organization.',
    'analytics',
    'webinar',
    90,
    ARRAY['Director', 'Manager', 'Analyst', 'Team Lead'],
    ARRAY['dashboards', 'custom_reports', 'analytics', 'data_export'],
    'intermediate',
    'scheduled'
  ),
  (
    'Getting Started: Platform Fundamentals',
    'Essential training for new users covering navigation, key features, and best practices for daily workflows.',
    'onboarding',
    'webinar',
    60,
    ARRAY['End User', 'Team Member'],
    ARRAY['navigation', 'basic_features', 'workflows'],
    'beginner',
    'scheduled'
  ),
  (
    'Admin Power User Training',
    'Deep dive into administration features including user management, permissions, integrations, and system configuration.',
    'administration',
    'workshop',
    120,
    ARRAY['Administrator', 'IT Director', 'System Admin'],
    ARRAY['user_management', 'permissions', 'integrations', 'api'],
    'advanced',
    'scheduled'
  ),
  (
    'Executive Insights & ROI Reporting',
    'Learn how to create executive-level reports that demonstrate ROI, track strategic KPIs, and communicate value to leadership.',
    'reporting',
    'webinar',
    45,
    ARRAY['Executive', 'VP', 'Director', 'C-Level'],
    ARRAY['executive_dashboard', 'roi_reports', 'strategic_metrics'],
    'intermediate',
    'scheduled'
  ),
  (
    'Workflow Automation Masterclass',
    'Master automation capabilities including triggers, actions, integrations, and building custom workflows.',
    'automation',
    'workshop',
    90,
    ARRAY['Manager', 'Team Lead', 'Operations'],
    ARRAY['automations', 'triggers', 'workflows', 'integrations'],
    'advanced',
    'scheduled'
  )
ON CONFLICT DO NOTHING;
