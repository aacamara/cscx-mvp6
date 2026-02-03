-- PRD-239: AI Coach for CSMs
-- Migration: Create coaching tables for skill assessment and interaction tracking

-- ============================================
-- CSM SKILL ASSESSMENTS
-- Tracks proficiency levels and recommendations for each skill area
-- ============================================
CREATE TABLE IF NOT EXISTS csm_skill_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  skill_area VARCHAR(50) NOT NULL,
  proficiency_level INTEGER NOT NULL CHECK (proficiency_level >= 1 AND proficiency_level <= 5),
  assessed_at TIMESTAMPTZ DEFAULT NOW(),
  recommendations JSONB DEFAULT '[]',
  evidence JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for common queries
  CONSTRAINT valid_skill_area CHECK (
    skill_area IN (
      'relationship_building',
      'strategic_thinking',
      'product_knowledge',
      'communication',
      'problem_solving',
      'time_management',
      'negotiation',
      'data_analysis',
      'executive_presence',
      'empathy'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_skill_assessments_user ON csm_skill_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_assessments_skill ON csm_skill_assessments(skill_area);
CREATE INDEX IF NOT EXISTS idx_skill_assessments_user_skill ON csm_skill_assessments(user_id, skill_area);
CREATE INDEX IF NOT EXISTS idx_skill_assessments_assessed_at ON csm_skill_assessments(assessed_at);

-- ============================================
-- COACHING INTERACTIONS
-- Logs all coaching interactions for learning and personalization
-- ============================================
CREATE TABLE IF NOT EXISTS coaching_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  interaction_type VARCHAR(50) NOT NULL,
  context JSONB DEFAULT '{}',
  guidance_provided TEXT,
  feedback_received TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Validate interaction types
  CONSTRAINT valid_interaction_type CHECK (
    interaction_type IN (
      'guidance_request',
      'feedback_request',
      'skill_assessment',
      'coaching_session',
      'weekly_summary'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_coaching_interactions_user ON coaching_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_interactions_type ON coaching_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_coaching_interactions_created ON coaching_interactions(created_at);

-- ============================================
-- COACHING GOALS
-- Tracks weekly/monthly goals set by the AI coach
-- ============================================
CREATE TABLE IF NOT EXISTS coaching_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  goal_text TEXT NOT NULL,
  skill_area VARCHAR(50),
  target_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coaching_goals_user ON coaching_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_goals_completed ON coaching_goals(completed);
CREATE INDEX IF NOT EXISTS idx_coaching_goals_target ON coaching_goals(target_date);

-- ============================================
-- COACHING MILESTONES
-- Tracks achievements and milestones reached
-- ============================================
CREATE TABLE IF NOT EXISTS coaching_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  milestone_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_coaching_milestones_user ON coaching_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_milestones_type ON coaching_milestones(milestone_type);

-- ============================================
-- Enable Row Level Security (if using Supabase)
-- ============================================
-- Note: Uncomment these if deploying to Supabase with RLS enabled

-- ALTER TABLE csm_skill_assessments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE coaching_interactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE coaching_goals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE coaching_milestones ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can read own skill assessments"
--   ON csm_skill_assessments FOR SELECT
--   USING (auth.uid() = user_id);

-- CREATE POLICY "Users can read own coaching interactions"
--   ON coaching_interactions FOR SELECT
--   USING (auth.uid() = user_id);

-- CREATE POLICY "Users can read own coaching goals"
--   ON coaching_goals FOR SELECT
--   USING (auth.uid() = user_id);

-- CREATE POLICY "Users can read own coaching milestones"
--   ON coaching_milestones FOR SELECT
--   USING (auth.uid() = user_id);

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE csm_skill_assessments IS 'PRD-239: Tracks CSM skill proficiency levels over time';
COMMENT ON TABLE coaching_interactions IS 'PRD-239: Logs all AI coaching interactions for learning';
COMMENT ON TABLE coaching_goals IS 'PRD-239: Weekly/monthly goals set by the AI coach';
COMMENT ON TABLE coaching_milestones IS 'PRD-239: Achievement tracking for CSM development';

COMMENT ON COLUMN csm_skill_assessments.proficiency_level IS '1=Beginner, 2=Developing, 3=Proficient, 4=Advanced, 5=Expert';
COMMENT ON COLUMN csm_skill_assessments.evidence IS 'Array of observations supporting the assessment';
COMMENT ON COLUMN coaching_interactions.context IS 'JSON object containing situation details';
