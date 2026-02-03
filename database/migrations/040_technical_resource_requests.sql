-- ============================================
-- PRD-245: Technical Resource Request
-- Database Schema for resource requests, skills, and scheduling
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Resource Skills Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.resource_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('technical', 'product', 'industry', 'certification', 'soft_skill')),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- User Skills (many-to-many relationship)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_skills (
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.resource_skills(id) ON DELETE CASCADE,
  proficiency_level INTEGER DEFAULT 3 CHECK (proficiency_level >= 1 AND proficiency_level <= 5),
  verified BOOLEAN DEFAULT FALSE,
  verified_by_user_id UUID REFERENCES public.user_profiles(id),
  verified_at TIMESTAMPTZ,
  years_experience DECIMAL(4,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, skill_id)
);

-- ============================================
-- Resource Requests Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.resource_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES public.user_profiles(id),

  -- Request details
  engagement_type VARCHAR(50) NOT NULL CHECK (engagement_type IN (
    'implementation', 'training', 'technical_review',
    'architecture_session', 'troubleshooting', 'integration',
    'migration', 'optimization', 'security_review', 'other'
  )),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  customer_context TEXT,
  required_skills UUID[] DEFAULT '{}',
  preferred_skills UUID[] DEFAULT '{}',

  -- Time requirements
  estimated_hours INTEGER CHECK (estimated_hours > 0),
  start_date DATE,
  end_date DATE,
  urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  flexibility VARCHAR(50) DEFAULT 'flexible_week' CHECK (flexibility IN ('exact_dates', 'flexible_week', 'flexible_month', 'asap')),

  -- Assignment
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'matching', 'assigned', 'scheduled',
    'in_progress', 'completed', 'cancelled', 'declined'
  )),
  assigned_resource_id UUID REFERENCES public.user_profiles(id),
  assigned_by_user_id UUID REFERENCES public.user_profiles(id),
  assigned_at TIMESTAMPTZ,

  -- Scheduling
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  calendar_event_ids JSONB DEFAULT '[]',
  meeting_links JSONB DEFAULT '[]',

  -- Completion
  actual_hours DECIMAL(6,2),
  outcome_summary TEXT,
  deliverables JSONB DEFAULT '[]',
  csm_rating INTEGER CHECK (csm_rating >= 1 AND csm_rating <= 5),
  csm_feedback TEXT,
  resource_rating INTEGER CHECK (resource_rating >= 1 AND resource_rating <= 5),
  resource_feedback TEXT,
  completed_at TIMESTAMPTZ,

  -- Metadata
  priority_score INTEGER DEFAULT 0,
  match_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Resource Availability Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.resource_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  available_hours DECIMAL(4,2) DEFAULT 8 CHECK (available_hours >= 0 AND available_hours <= 24),
  booked_hours DECIMAL(4,2) DEFAULT 0 CHECK (booked_hours >= 0 AND booked_hours <= 24),
  is_available BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ============================================
-- Resource Engagements Table (Time Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS public.resource_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.resource_requests(id) ON DELETE CASCADE,
  resource_user_id UUID NOT NULL REFERENCES public.user_profiles(id),
  date DATE NOT NULL,
  hours_logged DECIMAL(4,2) NOT NULL CHECK (hours_logged > 0 AND hours_logged <= 24),
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'preparation', 'meeting', 'implementation', 'documentation',
    'review', 'training', 'troubleshooting', 'follow_up', 'other'
  )),
  notes TEXT,
  billable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Resource Request History Table (Audit Trail)
-- ============================================

CREATE TABLE IF NOT EXISTS public.resource_request_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.resource_requests(id) ON DELETE CASCADE,
  changed_by_user_id UUID REFERENCES public.user_profiles(id),
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'created', 'updated', 'assigned', 'accepted', 'declined',
    'scheduled', 'started', 'completed', 'cancelled', 'time_logged'
  )),
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Resource Pool Table (Technical Resources)
-- ============================================

CREATE TABLE IF NOT EXISTS public.resource_pool (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN (
    'solutions_architect', 'solutions_engineer', 'technical_account_manager',
    'implementation_specialist', 'support_engineer', 'trainer', 'consultant'
  )),
  max_weekly_hours INTEGER DEFAULT 40 CHECK (max_weekly_hours > 0 AND max_weekly_hours <= 60),
  target_utilization DECIMAL(3,2) DEFAULT 0.80 CHECK (target_utilization > 0 AND target_utilization <= 1),
  timezone VARCHAR(50) DEFAULT 'America/Toronto',
  working_hours JSONB DEFAULT '{"start": "09:00", "end": "17:00", "days": [1,2,3,4,5]}',
  specializations TEXT[],
  bio TEXT,
  calendar_sync_enabled BOOLEAN DEFAULT FALSE,
  google_calendar_id VARCHAR(255),
  is_available_for_requests BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Resource requests indexes
CREATE INDEX IF NOT EXISTS idx_resource_requests_status ON public.resource_requests(status);
CREATE INDEX IF NOT EXISTS idx_resource_requests_customer ON public.resource_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_requested_by ON public.resource_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_assigned_to ON public.resource_requests(assigned_resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_engagement_type ON public.resource_requests(engagement_type);
CREATE INDEX IF NOT EXISTS idx_resource_requests_urgency ON public.resource_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_resource_requests_dates ON public.resource_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_resource_requests_created ON public.resource_requests(created_at DESC);

-- Resource availability indexes
CREATE INDEX IF NOT EXISTS idx_resource_availability_date ON public.resource_availability(user_id, date);
CREATE INDEX IF NOT EXISTS idx_resource_availability_available ON public.resource_availability(date, is_available);

-- User skills indexes
CREATE INDEX IF NOT EXISTS idx_user_skills_skill ON public.user_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_verified ON public.user_skills(verified);
CREATE INDEX IF NOT EXISTS idx_user_skills_proficiency ON public.user_skills(proficiency_level);

-- Resource engagements indexes
CREATE INDEX IF NOT EXISTS idx_resource_engagements_request ON public.resource_engagements(request_id);
CREATE INDEX IF NOT EXISTS idx_resource_engagements_user ON public.resource_engagements(resource_user_id);
CREATE INDEX IF NOT EXISTS idx_resource_engagements_date ON public.resource_engagements(date);

-- Resource pool indexes
CREATE INDEX IF NOT EXISTS idx_resource_pool_type ON public.resource_pool(resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_pool_available ON public.resource_pool(is_available_for_requests);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE public.resource_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_pool ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on resource_skills" ON public.resource_skills FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on user_skills" ON public.user_skills FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on resource_requests" ON public.resource_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on resource_availability" ON public.resource_availability FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on resource_engagements" ON public.resource_engagements FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on resource_request_history" ON public.resource_request_history FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on resource_pool" ON public.resource_pool FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Triggers for updated_at
-- ============================================

CREATE TRIGGER update_resource_skills_updated_at
  BEFORE UPDATE ON public.resource_skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_skills_updated_at
  BEFORE UPDATE ON public.user_skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_resource_requests_updated_at
  BEFORE UPDATE ON public.resource_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_resource_availability_updated_at
  BEFORE UPDATE ON public.resource_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_resource_pool_updated_at
  BEFORE UPDATE ON public.resource_pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- Seed Initial Skills Data
-- ============================================

INSERT INTO public.resource_skills (name, category, description) VALUES
  -- Technical Skills
  ('AWS', 'technical', 'Amazon Web Services cloud platform expertise'),
  ('Azure', 'technical', 'Microsoft Azure cloud platform expertise'),
  ('GCP', 'technical', 'Google Cloud Platform expertise'),
  ('Kubernetes', 'technical', 'Container orchestration with Kubernetes'),
  ('Docker', 'technical', 'Containerization with Docker'),
  ('Python', 'technical', 'Python programming language'),
  ('JavaScript', 'technical', 'JavaScript/TypeScript development'),
  ('SQL', 'technical', 'SQL databases and query optimization'),
  ('REST APIs', 'technical', 'RESTful API design and implementation'),
  ('GraphQL', 'technical', 'GraphQL API expertise'),
  ('Security', 'technical', 'Application and infrastructure security'),
  ('CI/CD', 'technical', 'Continuous integration and deployment pipelines'),

  -- Product Skills
  ('Platform Administration', 'product', 'Platform configuration and administration'),
  ('Data Integration', 'product', 'Data pipeline and integration setup'),
  ('Reporting', 'product', 'Custom reporting and analytics'),
  ('Workflow Automation', 'product', 'Automation and workflow design'),
  ('User Management', 'product', 'SSO, RBAC, and user provisioning'),

  -- Industry Skills
  ('Healthcare', 'industry', 'Healthcare industry expertise'),
  ('Finance', 'industry', 'Financial services expertise'),
  ('E-commerce', 'industry', 'E-commerce and retail expertise'),
  ('SaaS', 'industry', 'SaaS business model expertise'),
  ('Enterprise', 'industry', 'Enterprise deployment experience'),

  -- Certifications
  ('AWS Solutions Architect', 'certification', 'AWS Solutions Architect certification'),
  ('Azure Administrator', 'certification', 'Microsoft Azure Administrator certification'),
  ('Kubernetes Administrator', 'certification', 'Certified Kubernetes Administrator'),
  ('PMP', 'certification', 'Project Management Professional'),
  ('CISSP', 'certification', 'Certified Information Systems Security Professional'),

  -- Soft Skills
  ('Technical Training', 'soft_skill', 'Ability to conduct technical training'),
  ('Executive Communication', 'soft_skill', 'Executive-level presentation skills'),
  ('Project Management', 'soft_skill', 'Project management experience'),
  ('Customer Success', 'soft_skill', 'Customer success methodology')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Helper Functions
-- ============================================

-- Function to calculate resource utilization for a date range
CREATE OR REPLACE FUNCTION public.calculate_resource_utilization(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  total_available_hours DECIMAL,
  total_booked_hours DECIMAL,
  utilization_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(ra.available_hours), 0) as total_available_hours,
    COALESCE(SUM(ra.booked_hours), 0) as total_booked_hours,
    CASE
      WHEN COALESCE(SUM(ra.available_hours), 0) = 0 THEN 0
      ELSE ROUND((COALESCE(SUM(ra.booked_hours), 0) / COALESCE(SUM(ra.available_hours), 1)) * 100, 2)
    END as utilization_rate
  FROM public.resource_availability ra
  WHERE ra.user_id = p_user_id
    AND ra.date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get available hours for a resource on a specific date
CREATE OR REPLACE FUNCTION public.get_available_hours(
  p_user_id UUID,
  p_date DATE
) RETURNS DECIMAL AS $$
DECLARE
  v_available DECIMAL;
  v_booked DECIMAL;
BEGIN
  SELECT available_hours, booked_hours
  INTO v_available, v_booked
  FROM public.resource_availability
  WHERE user_id = p_user_id AND date = p_date;

  IF NOT FOUND THEN
    -- Default 8 hours if no record exists
    RETURN 8.0;
  END IF;

  RETURN GREATEST(v_available - v_booked, 0);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.calculate_resource_utilization TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_available_hours TO authenticated, service_role;
