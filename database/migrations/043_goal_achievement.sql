-- PRD-137: Goal Achieved -> Success Documentation
-- Database schema for goal achievements and success documentation

-- ============================================
-- GOALS TABLE
-- Tracks customer success goals
-- ============================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('success_plan', 'kpi', 'onboarding', 'roi', 'custom')),
  description TEXT,
  target_value TEXT NOT NULL,
  target_date DATE,
  kpi_metric TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'missed', 'cancelled')),
  success_plan_id UUID,
  created_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_customer ON goals(customer_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(type);

-- ============================================
-- GOAL ACHIEVEMENTS TABLE
-- Records when goals are achieved
-- ============================================
CREATE TABLE IF NOT EXISTS goal_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,

  -- Goal details (denormalized for history)
  goal_name TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('success_plan', 'kpi', 'onboarding', 'roi', 'custom')),
  goal_description TEXT,
  original_target TEXT NOT NULL,
  achieved_result TEXT NOT NULL,

  -- Achievement details
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_to_achieve_days INTEGER,
  percent_over_target NUMERIC(5,2),
  contributing_factors TEXT[],
  customer_quotes TEXT[],
  verification_method TEXT CHECK (verification_method IN ('automatic', 'manual')),
  verified_by UUID,

  -- Documentation status
  summary_doc_id TEXT,
  summary_doc_url TEXT,
  celebration_sent BOOLEAN DEFAULT FALSE,
  celebration_sent_at TIMESTAMPTZ,
  customer_notified BOOLEAN DEFAULT FALSE,
  customer_notified_at TIMESTAMPTZ,
  marketing_flagged BOOLEAN DEFAULT FALSE,
  marketing_flagged_at TIMESTAMPTZ,
  internal_announcement_sent BOOLEAN DEFAULT FALSE,
  internal_announcement_sent_at TIMESTAMPTZ,

  -- Marketing potential
  case_study_candidate BOOLEAN DEFAULT FALSE,
  testimonial_candidate BOOLEAN DEFAULT FALSE,
  reference_candidate BOOLEAN DEFAULT FALSE,
  social_proof_candidate BOOLEAN DEFAULT FALSE,
  marketing_score INTEGER DEFAULT 0 CHECK (marketing_score >= 0 AND marketing_score <= 100),
  marketing_reasons TEXT[],

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'documented', 'celebrated', 'marketed')),

  -- Ownership
  csm_id UUID,
  csm_name TEXT,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_achievements_customer ON goal_achievements(customer_id);
CREATE INDEX IF NOT EXISTS idx_goal_achievements_goal ON goal_achievements(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_achievements_status ON goal_achievements(status);
CREATE INDEX IF NOT EXISTS idx_goal_achievements_achieved_at ON goal_achievements(achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_achievements_marketing ON goal_achievements(marketing_flagged) WHERE marketing_flagged = TRUE;

-- ============================================
-- ACHIEVEMENT EVIDENCE TABLE
-- Stores evidence supporting achievements
-- ============================================
CREATE TABLE IF NOT EXISTS achievement_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  achievement_id UUID NOT NULL REFERENCES goal_achievements(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('metric', 'screenshot', 'document', 'testimonial', 'email')),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  value TEXT,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievement_evidence_achievement ON achievement_evidence(achievement_id);

-- ============================================
-- VALUE REPOSITORY TABLE
-- Searchable repository of customer success stories
-- ============================================
CREATE TABLE IF NOT EXISTS value_repository (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  achievement_id UUID REFERENCES goal_achievements(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  industry TEXT,
  use_case TEXT,
  achievement_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  quantified_value TEXT,
  timeframe TEXT,
  search_tags TEXT[],
  available_for TEXT[] DEFAULT '{}', -- qbr, renewal, sales, marketing
  is_public BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_value_repository_customer ON value_repository(customer_id);
CREATE INDEX IF NOT EXISTS idx_value_repository_industry ON value_repository(industry);
CREATE INDEX IF NOT EXISTS idx_value_repository_use_case ON value_repository(use_case);
CREATE INDEX IF NOT EXISTS idx_value_repository_tags ON value_repository USING GIN(search_tags);
CREATE INDEX IF NOT EXISTS idx_value_repository_available ON value_repository USING GIN(available_for);

-- ============================================
-- CELEBRATION LOG TABLE
-- Tracks celebrations and notifications sent
-- ============================================
CREATE TABLE IF NOT EXISTS celebration_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  achievement_id UUID NOT NULL REFERENCES goal_achievements(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('slack', 'email', 'dashboard', 'customer_notification')),
  recipient TEXT,
  channel TEXT,
  message TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_celebration_log_achievement ON celebration_log(achievement_id);

-- ============================================
-- MARKETING FLAG LOG TABLE
-- Tracks marketing team flags and follow-ups
-- ============================================
CREATE TABLE IF NOT EXISTS marketing_flag_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  achievement_id UUID NOT NULL REFERENCES goal_achievements(id) ON DELETE CASCADE,
  flagged_by UUID,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('case_study', 'testimonial', 'reference', 'social_proof')),
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'declined')),
  assigned_to TEXT,
  completed_at TIMESTAMPTZ,
  outcome TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_flag_achievement ON marketing_flag_log(achievement_id);
CREATE INDEX IF NOT EXISTS idx_marketing_flag_status ON marketing_flag_log(status);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE TRIGGER update_goals_timestamp
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_goal_achievements_timestamp
  BEFORE UPDATE ON goal_achievements
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_value_repository_timestamp
  BEFORE UPDATE ON value_repository
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_marketing_flag_log_timestamp
  BEFORE UPDATE ON marketing_flag_log
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- VIEWS
-- ============================================

-- Achievement summary view
CREATE OR REPLACE VIEW achievement_summary AS
SELECT
  ga.customer_id,
  c.name as customer_name,
  c.arr,
  c.industry,
  COUNT(*) as total_achievements,
  COUNT(*) FILTER (WHERE ga.achieved_at >= NOW() - INTERVAL '30 days') as achievements_last_30_days,
  COUNT(*) FILTER (WHERE ga.achieved_at >= NOW() - INTERVAL '90 days') as achievements_last_90_days,
  COUNT(*) FILTER (WHERE ga.marketing_flagged = TRUE) as marketing_opportunities,
  AVG(ga.marketing_score) as avg_marketing_score,
  array_agg(DISTINCT ga.goal_type) as goal_types
FROM goal_achievements ga
JOIN customers c ON c.id = ga.customer_id
GROUP BY ga.customer_id, c.name, c.arr, c.industry;

-- Marketing candidates view
CREATE OR REPLACE VIEW marketing_candidates AS
SELECT
  ga.id,
  ga.customer_id,
  c.name as customer_name,
  c.industry,
  ga.goal_name,
  ga.goal_type,
  ga.achieved_result,
  ga.achieved_at,
  ga.marketing_score,
  ga.case_study_candidate,
  ga.testimonial_candidate,
  ga.reference_candidate,
  ga.social_proof_candidate,
  ga.marketing_reasons
FROM goal_achievements ga
JOIN customers c ON c.id = ga.customer_id
WHERE ga.marketing_flagged = TRUE
  AND ga.status IN ('documented', 'celebrated')
ORDER BY ga.marketing_score DESC, ga.achieved_at DESC;
