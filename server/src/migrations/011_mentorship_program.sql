-- PRD-255: Mentor Assignment
-- Database migration for the mentorship program system
-- Created: 2026-01-30

-- ============================================
-- Mentors Table
-- ============================================
-- Stores mentor profiles with capacity and expertise

CREATE TABLE IF NOT EXISTS mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'on_leave'
  max_mentees INTEGER DEFAULT 2,
  current_mentee_count INTEGER DEFAULT 0,
  expertise_areas TEXT[] DEFAULT '{}',
  availability_notes TEXT,
  total_mentees_to_date INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  is_certified BOOLEAN DEFAULT false,
  certification_status VARCHAR(20) DEFAULT 'not_certified', -- 'not_certified', 'in_progress', 'certified'
  certified_at TIMESTAMPTZ,
  tenure_months INTEGER DEFAULT 0,
  performance_score DECIMAL(5,2),
  timezone VARCHAR(50),
  preferred_meeting_days TEXT[] DEFAULT '{}',
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding available mentors
CREATE INDEX IF NOT EXISTS idx_mentors_active_capacity
  ON mentors(is_active, current_mentee_count, max_mentees);

-- Index for expertise search
CREATE INDEX IF NOT EXISTS idx_mentors_expertise
  ON mentors USING GIN(expertise_areas);

-- ============================================
-- Mentor Recognitions Table
-- ============================================
-- Badges, certificates, and awards for mentors

CREATE TABLE IF NOT EXISTS mentor_recognitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES mentors(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'badge', 'certificate', 'award'
  title VARCHAR(200) NOT NULL,
  description TEXT,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  awarded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_recognitions_mentor
  ON mentor_recognitions(mentor_id);

-- ============================================
-- Mentorship Assignments Table
-- ============================================
-- Tracks mentor-mentee pairings

CREATE TABLE IF NOT EXISTS mentorship_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES mentors(id) NOT NULL,
  mentee_user_id UUID NOT NULL,
  assigned_by_user_id UUID,

  -- Configuration
  start_date DATE NOT NULL,
  expected_end_date DATE,
  actual_end_date DATE,
  check_in_cadence VARCHAR(20) DEFAULT 'weekly', -- 'weekly', 'biweekly', 'monthly'

  -- Goals & Milestones (stored as JSONB for flexibility)
  goals JSONB DEFAULT '[]',
  -- Structure: [{ id, goal, target_date, achieved, achieved_at, notes }]

  milestones JSONB DEFAULT '[]',
  -- Structure: [{ id, name, description, target_date, achieved_date, verification_method, verified_by, order }]

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled', 'on_hold'
  mentor_accepted_at TIMESTAMPTZ,
  mentor_declined_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Completion
  completion_notes TEXT,
  mentor_feedback TEXT,
  mentee_feedback TEXT,
  mentee_rating INTEGER CHECK (mentee_rating >= 1 AND mentee_rating <= 5),

  -- Metadata
  expectations TEXT,
  focus_areas TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding assignments by mentor
CREATE INDEX IF NOT EXISTS idx_mentorship_assignments_mentor
  ON mentorship_assignments(mentor_id, status);

-- Index for finding assignments by mentee
CREATE INDEX IF NOT EXISTS idx_mentorship_assignments_mentee
  ON mentorship_assignments(mentee_user_id, status);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_mentorship_assignments_status
  ON mentorship_assignments(status, start_date);

-- ============================================
-- Mentorship Sessions Table
-- ============================================
-- Logs of mentorship check-ins

CREATE TABLE IF NOT EXISTS mentorship_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES mentorship_assignments(id) ON DELETE CASCADE,
  session_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,

  -- Content
  topics_covered TEXT[] DEFAULT '{}',
  summary TEXT,
  action_items JSONB DEFAULT '[]',
  -- Structure: [{ id, item, owner, due_date, done, completed_at }]

  resources_shared JSONB DEFAULT '[]',
  -- Structure: [{ id, type, title, url, description, shared_at }]

  -- Assessment
  mentee_confidence_before INTEGER CHECK (mentee_confidence_before >= 1 AND mentee_confidence_before <= 5),
  mentee_confidence_after INTEGER CHECK (mentee_confidence_after >= 1 AND mentee_confidence_after <= 5),
  session_quality INTEGER CHECK (session_quality >= 1 AND session_quality <= 5),
  mentor_notes TEXT,
  mentee_notes TEXT,

  -- Metadata
  logged_by VARCHAR(20), -- 'mentor' or 'mentee'
  meeting_link TEXT,
  is_scheduled BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding sessions by assignment
CREATE INDEX IF NOT EXISTS idx_mentorship_sessions_assignment
  ON mentorship_sessions(assignment_id, session_date DESC);

-- ============================================
-- Mentee Ramp Milestones Table
-- ============================================
-- Detailed milestone tracking for mentees

CREATE TABLE IF NOT EXISTS mentee_ramp_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES mentorship_assignments(id) ON DELETE CASCADE,
  mentee_user_id UUID NOT NULL,
  milestone_name VARCHAR(200) NOT NULL,
  description TEXT,
  target_date DATE,
  achieved_date DATE,
  verification_method VARCHAR(20) DEFAULT 'mentor_verified', -- 'self_report', 'mentor_verified', 'system_tracked'
  verified_by_user_id UUID,
  category VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding milestones by assignment
CREATE INDEX IF NOT EXISTS idx_mentee_milestones_assignment
  ON mentee_ramp_milestones(assignment_id, sort_order);

-- Index for finding milestones by mentee
CREATE INDEX IF NOT EXISTS idx_mentee_milestones_mentee
  ON mentee_ramp_milestones(mentee_user_id, achieved_date);

-- ============================================
-- Mentorship Analytics Materialized View
-- ============================================
-- Pre-computed analytics for program reporting

CREATE MATERIALIZED VIEW IF NOT EXISTS mentorship_program_stats AS
WITH mentor_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE is_active = true) as total_active_mentors,
    AVG(average_rating) FILTER (WHERE average_rating IS NOT NULL) as avg_mentor_rating,
    SUM(current_mentee_count) as total_active_mentees,
    SUM(total_mentees_to_date) as total_mentees_all_time
  FROM mentors
),
assignment_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'active') as active_assignments,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_assignments,
    AVG(mentee_rating) FILTER (WHERE mentee_rating IS NOT NULL) as avg_mentee_rating,
    AVG(EXTRACT(days FROM (actual_end_date - start_date)))
      FILTER (WHERE status = 'completed' AND actual_end_date IS NOT NULL) as avg_assignment_duration_days
  FROM mentorship_assignments
),
session_stats AS (
  SELECT
    COUNT(*) as total_sessions,
    AVG(duration_minutes) as avg_session_duration,
    AVG(session_quality) as avg_session_quality,
    AVG(mentee_confidence_after - mentee_confidence_before) as avg_confidence_improvement
  FROM mentorship_sessions
  WHERE session_date >= NOW() - INTERVAL '90 days'
)
SELECT
  m.total_active_mentors,
  m.avg_mentor_rating,
  m.total_active_mentees,
  m.total_mentees_all_time,
  a.active_assignments,
  a.completed_assignments,
  a.avg_mentee_rating,
  a.avg_assignment_duration_days,
  s.total_sessions,
  s.avg_session_duration,
  s.avg_session_quality,
  s.avg_confidence_improvement,
  NOW() as computed_at
FROM mentor_stats m, assignment_stats a, session_stats s;

-- Index for the materialized view (for faster refresh)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentorship_stats_computed
  ON mentorship_program_stats(computed_at);

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update mentor's current_mentee_count
CREATE OR REPLACE FUNCTION update_mentor_mentee_count()
RETURNS TRIGGER AS $$
BEGIN
  -- On new active assignment
  IF (TG_OP = 'INSERT' AND NEW.status = 'active') OR
     (TG_OP = 'UPDATE' AND OLD.status != 'active' AND NEW.status = 'active') THEN
    UPDATE mentors
    SET current_mentee_count = current_mentee_count + 1,
        updated_at = NOW()
    WHERE id = NEW.mentor_id;
  END IF;

  -- On assignment completion or cancellation
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status IN ('completed', 'cancelled') THEN
    UPDATE mentors
    SET current_mentee_count = GREATEST(0, current_mentee_count - 1),
        total_mentees_to_date = CASE WHEN NEW.status = 'completed' THEN total_mentees_to_date + 1 ELSE total_mentees_to_date END,
        updated_at = NOW()
    WHERE id = NEW.mentor_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for mentor mentee count
DROP TRIGGER IF EXISTS trigger_update_mentor_mentee_count ON mentorship_assignments;
CREATE TRIGGER trigger_update_mentor_mentee_count
AFTER INSERT OR UPDATE ON mentorship_assignments
FOR EACH ROW
EXECUTE FUNCTION update_mentor_mentee_count();

-- Function to update mentor's average rating
CREATE OR REPLACE FUNCTION update_mentor_average_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mentee_rating IS NOT NULL THEN
    UPDATE mentors
    SET average_rating = (
      SELECT AVG(mentee_rating)
      FROM mentorship_assignments
      WHERE mentor_id = NEW.mentor_id AND mentee_rating IS NOT NULL
    ),
    updated_at = NOW()
    WHERE id = NEW.mentor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for mentor rating
DROP TRIGGER IF EXISTS trigger_update_mentor_rating ON mentorship_assignments;
CREATE TRIGGER trigger_update_mentor_rating
AFTER UPDATE ON mentorship_assignments
FOR EACH ROW
WHEN (NEW.mentee_rating IS DISTINCT FROM OLD.mentee_rating)
EXECUTE FUNCTION update_mentor_average_rating();

-- Function to refresh materialized view (call periodically or on-demand)
CREATE OR REPLACE FUNCTION refresh_mentorship_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mentorship_program_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentee_ramp_milestones ENABLE ROW LEVEL SECURITY;

-- Policies for mentors table
CREATE POLICY "Mentors are viewable by authenticated users"
  ON mentors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Mentors can update their own profile"
  ON mentors FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own mentor profile"
  ON mentors FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policies for assignments (visible to mentor, mentee, and assigners)
CREATE POLICY "Assignments viewable by participants and managers"
  ON mentorship_assignments FOR SELECT
  TO authenticated
  USING (
    mentee_user_id = auth.uid() OR
    mentor_id IN (SELECT id FROM mentors WHERE user_id = auth.uid()) OR
    assigned_by_user_id = auth.uid()
  );

-- Policies for sessions (visible to assignment participants)
CREATE POLICY "Sessions viewable by assignment participants"
  ON mentorship_sessions FOR SELECT
  TO authenticated
  USING (
    assignment_id IN (
      SELECT id FROM mentorship_assignments
      WHERE mentee_user_id = auth.uid() OR
            mentor_id IN (SELECT id FROM mentors WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- Sample Data for Development
-- ============================================

-- Note: In production, remove this section or wrap in a conditional

-- Sample mentor (comment out for production)
-- INSERT INTO mentors (user_id, is_active, max_mentees, expertise_areas, bio, is_certified)
-- VALUES
--   (gen_random_uuid(), true, 3, ARRAY['onboarding', 'enterprise', 'renewals'], 'Senior CSM with 3+ years experience.', true),
--   (gen_random_uuid(), true, 2, ARRAY['technical', 'adoption', 'mid-market'], 'Technical CSM with engineering background.', true);

COMMENT ON TABLE mentors IS 'PRD-255: Stores mentor profiles with capacity, expertise, and certification status';
COMMENT ON TABLE mentorship_assignments IS 'PRD-255: Tracks mentor-mentee pairings with goals, milestones, and status';
COMMENT ON TABLE mentorship_sessions IS 'PRD-255: Logs of mentorship check-in sessions with topics and assessments';
COMMENT ON TABLE mentee_ramp_milestones IS 'PRD-255: Detailed milestone tracking for mentee ramp progress';
