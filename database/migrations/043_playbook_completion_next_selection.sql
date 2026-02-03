-- PRD-149: Playbook Completed → Next Selection
-- Migration for playbook completion tracking, outcome assessment, and next playbook recommendations

-- ============================================
-- PLAYBOOK COMPLETIONS
-- Tracks when playbooks complete and their outcomes
-- ============================================
CREATE TABLE IF NOT EXISTS playbook_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,

  -- Playbook info
  playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
  playbook_execution_id UUID REFERENCES playbook_executions(id) ON DELETE SET NULL,
  playbook_type TEXT NOT NULL,
  playbook_name TEXT NOT NULL,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_days INTEGER,

  -- Completion method
  completion_type TEXT NOT NULL CHECK (completion_type IN ('all_steps_complete', 'manual', 'timeout', 'cancelled')),

  -- Outcome assessment
  outcome_status TEXT NOT NULL CHECK (outcome_status IN ('success', 'partial', 'incomplete', 'failed', 'cancelled')),
  goals_achieved JSONB DEFAULT '[]',
  goals_not_achieved JSONB DEFAULT '[]',
  health_change INTEGER DEFAULT 0, -- Delta from start to end
  sentiment_change TEXT CHECK (sentiment_change IN ('improved', 'stable', 'declined', 'unknown')),
  carry_forward_items JSONB DEFAULT '[]',

  -- Context at completion
  health_score_at_start INTEGER,
  health_score_at_end INTEGER,
  engagement_level TEXT CHECK (engagement_level IN ('high', 'medium', 'low', 'none')),
  outstanding_issues JSONB DEFAULT '[]',

  -- Metadata
  notes TEXT,
  completed_by UUID, -- CSM who marked complete
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbook_completions_customer ON playbook_completions(customer_id);
CREATE INDEX IF NOT EXISTS idx_playbook_completions_playbook ON playbook_completions(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_completions_outcome ON playbook_completions(outcome_status);
CREATE INDEX IF NOT EXISTS idx_playbook_completions_completed_at ON playbook_completions(completed_at DESC);

-- ============================================
-- PLAYBOOK RECOMMENDATIONS
-- AI-generated next playbook suggestions
-- ============================================
CREATE TABLE IF NOT EXISTS playbook_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  completion_id UUID REFERENCES playbook_completions(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,

  -- Recommended playbook
  playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
  playbook_name TEXT NOT NULL,
  playbook_type TEXT NOT NULL,

  -- Recommendation scoring
  match_score NUMERIC(3, 2) NOT NULL CHECK (match_score >= 0 AND match_score <= 1),
  match_reason TEXT NOT NULL,

  -- Timing recommendation
  suggested_timing TEXT NOT NULL CHECK (suggested_timing IN ('immediate', 'next_week', 'next_month', 'monitor')),
  suggested_start_date DATE,
  gap_days INTEGER DEFAULT 0, -- Recommended gap before starting

  -- Ranking
  rank_order INTEGER NOT NULL DEFAULT 1,

  -- Context used for recommendation
  factors_considered JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbook_recommendations_completion ON playbook_recommendations(completion_id);
CREATE INDEX IF NOT EXISTS idx_playbook_recommendations_customer ON playbook_recommendations(customer_id);
CREATE INDEX IF NOT EXISTS idx_playbook_recommendations_playbook ON playbook_recommendations(playbook_id);

-- ============================================
-- PLAYBOOK SELECTIONS
-- CSM's decision on next playbook
-- ============================================
CREATE TABLE IF NOT EXISTS playbook_selections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  completion_id UUID REFERENCES playbook_completions(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,

  -- Selection decision
  selected_playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
  selected_playbook_name TEXT,
  selection_type TEXT NOT NULL CHECK (selection_type IN ('accepted_recommendation', 'alternate', 'deferred', 'no_action')),

  -- From recommendation (if accepted)
  recommendation_id UUID REFERENCES playbook_recommendations(id) ON DELETE SET NULL,

  -- Decision details
  selection_reason TEXT,
  deferred_until DATE,

  -- Execution (if started)
  execution_started BOOLEAN DEFAULT FALSE,
  execution_id UUID REFERENCES playbook_executions(id) ON DELETE SET NULL,
  execution_started_at TIMESTAMPTZ,

  -- Monitoring for no-action
  reminder_set BOOLEAN DEFAULT FALSE,
  reminder_date DATE,
  health_threshold INTEGER, -- Alert if health drops below this

  -- Audit
  selected_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_playbook_selections_completion ON playbook_selections(completion_id);
CREATE INDEX IF NOT EXISTS idx_playbook_selections_customer ON playbook_selections(customer_id);
CREATE INDEX IF NOT EXISTS idx_playbook_selections_deferred ON playbook_selections(deferred_until) WHERE deferred_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_playbook_selections_reminder ON playbook_selections(reminder_date) WHERE reminder_set = TRUE;

-- ============================================
-- CUSTOMER JOURNEY VIEW
-- Tracks playbook history for pattern analysis
-- ============================================
CREATE TABLE IF NOT EXISTS customer_playbook_journey (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,

  -- Journey sequence
  sequence_number INTEGER NOT NULL,
  completion_id UUID REFERENCES playbook_completions(id) ON DELETE CASCADE,

  -- Playbook info
  playbook_type TEXT NOT NULL,
  playbook_name TEXT NOT NULL,
  outcome_status TEXT NOT NULL,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  gap_from_previous_days INTEGER,

  -- Health trajectory
  health_at_start INTEGER,
  health_at_end INTEGER,
  health_delta INTEGER,

  -- Success factors (for pattern learning)
  success_factors JSONB DEFAULT '[]',
  blockers JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journey_customer ON customer_playbook_journey(customer_id);
CREATE INDEX IF NOT EXISTS idx_journey_sequence ON customer_playbook_journey(customer_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_journey_type ON customer_playbook_journey(playbook_type);

-- ============================================
-- PLAYBOOK TRANSITION RULES
-- Defines valid next playbooks based on current playbook outcome
-- ============================================
CREATE TABLE IF NOT EXISTS playbook_transition_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- From playbook
  from_playbook_type TEXT NOT NULL,
  from_outcome TEXT NOT NULL CHECK (from_outcome IN ('success', 'partial', 'incomplete', 'failed', 'cancelled', 'any')),

  -- To playbook
  to_playbook_type TEXT NOT NULL,

  -- Rule configuration
  base_score NUMERIC(3, 2) NOT NULL DEFAULT 0.5 CHECK (base_score >= 0 AND base_score <= 1),
  health_min INTEGER, -- Only suggest if health >= this
  health_max INTEGER, -- Only suggest if health <= this
  days_since_last_min INTEGER, -- Minimum days since last major engagement

  -- Timing
  suggested_gap_days INTEGER DEFAULT 7,
  suggested_timing TEXT DEFAULT 'next_week',

  -- Rule metadata
  rationale TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 100, -- Lower = higher priority

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transition_rules_unique ON playbook_transition_rules(from_playbook_type, from_outcome, to_playbook_type);
CREATE INDEX IF NOT EXISTS idx_transition_rules_from ON playbook_transition_rules(from_playbook_type, from_outcome);

-- ============================================
-- SEED TRANSITION RULES
-- Default rules for common playbook transitions
-- ============================================
INSERT INTO playbook_transition_rules (from_playbook_type, from_outcome, to_playbook_type, base_score, suggested_gap_days, suggested_timing, rationale)
VALUES
  -- After successful onboarding
  ('onboarding', 'success', 'adoption', 0.9, 7, 'next_week', 'Drive feature adoption after successful onboarding'),
  ('onboarding', 'success', 'expansion', 0.5, 30, 'next_month', 'Consider expansion after proven adoption'),
  ('onboarding', 'success', 'qbr', 0.7, 60, 'next_month', 'Schedule first QBR after initial onboarding success'),

  -- After partial onboarding
  ('onboarding', 'partial', 'adoption', 0.7, 7, 'next_week', 'Focus on adoption gaps'),
  ('onboarding', 'partial', 'risk', 0.4, 0, 'immediate', 'Monitor for risk if onboarding incomplete'),

  -- After failed onboarding
  ('onboarding', 'failed', 'risk', 0.9, 0, 'immediate', 'Immediate risk assessment after failed onboarding'),
  ('onboarding', 'incomplete', 'onboarding', 0.8, 7, 'next_week', 'Restart onboarding with adjusted approach'),

  -- After successful adoption
  ('adoption', 'success', 'expansion', 0.8, 14, 'next_week', 'Explore expansion opportunities'),
  ('adoption', 'success', 'qbr', 0.7, 30, 'next_month', 'Celebrate wins in QBR'),
  ('adoption', 'success', 'renewal', 0.6, 60, 'next_month', 'Begin renewal conversation early'),

  -- After adoption struggles
  ('adoption', 'partial', 'adoption', 0.6, 14, 'next_week', 'Continue adoption efforts'),
  ('adoption', 'failed', 'risk', 0.9, 0, 'immediate', 'Address adoption failure risks'),

  -- After successful renewal
  ('renewal', 'success', 'expansion', 0.8, 30, 'next_month', 'Post-renewal expansion opportunity'),
  ('renewal', 'success', 'qbr', 0.6, 60, 'next_month', 'Schedule strategic QBR'),
  ('renewal', 'success', 'onboarding', 0.3, 0, 'immediate', 'Re-onboard if adding new products'),

  -- After renewal challenges
  ('renewal', 'partial', 'risk', 0.7, 0, 'immediate', 'Monitor for churn risk'),
  ('renewal', 'failed', 'risk', 0.95, 0, 'immediate', 'Critical risk intervention needed'),

  -- After QBR
  ('qbr', 'success', 'expansion', 0.7, 30, 'next_month', 'QBR identified expansion opportunities'),
  ('qbr', 'success', 'adoption', 0.5, 14, 'next_week', 'Drive adoption of discussed features'),
  ('qbr', 'partial', 'risk', 0.5, 14, 'next_week', 'Address QBR concerns'),

  -- After risk playbook
  ('risk', 'success', 'adoption', 0.7, 14, 'next_week', 'Re-engage with adoption after stabilization'),
  ('risk', 'success', 'renewal', 0.8, 30, 'next_month', 'Prepare renewal after risk mitigation'),
  ('risk', 'partial', 'risk', 0.6, 7, 'next_week', 'Continue risk monitoring'),
  ('risk', 'failed', 'risk', 0.9, 0, 'immediate', 'Escalate risk intervention'),

  -- After expansion
  ('expansion', 'success', 'onboarding', 0.8, 7, 'next_week', 'Onboard new products/users'),
  ('expansion', 'success', 'qbr', 0.6, 30, 'next_month', 'Celebrate expansion in QBR'),
  ('expansion', 'partial', 'adoption', 0.7, 14, 'next_week', 'Focus on adoption before next expansion'),
  ('expansion', 'failed', 'adoption', 0.6, 14, 'next_week', 'Strengthen base before expansion')
ON CONFLICT (from_playbook_type, from_outcome, to_playbook_type) DO UPDATE SET
  base_score = EXCLUDED.base_score,
  suggested_gap_days = EXCLUDED.suggested_gap_days,
  suggested_timing = EXCLUDED.suggested_timing,
  rationale = EXCLUDED.rationale,
  updated_at = NOW();

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE TRIGGER update_playbook_completions_timestamp
  BEFORE UPDATE ON playbook_completions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_playbook_selections_timestamp
  BEFORE UPDATE ON playbook_selections
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_playbook_transition_rules_timestamp
  BEFORE UPDATE ON playbook_transition_rules
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to calculate playbook outcome score
CREATE OR REPLACE FUNCTION calculate_playbook_outcome_score(
  p_outcome_status TEXT,
  p_health_change INTEGER,
  p_goals_achieved_count INTEGER,
  p_total_goals INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  base_score NUMERIC;
  health_bonus NUMERIC;
  goals_score NUMERIC;
BEGIN
  -- Base score from outcome status
  base_score := CASE p_outcome_status
    WHEN 'success' THEN 1.0
    WHEN 'partial' THEN 0.6
    WHEN 'incomplete' THEN 0.3
    WHEN 'failed' THEN 0.1
    WHEN 'cancelled' THEN 0.0
    ELSE 0.5
  END;

  -- Health change bonus/penalty (-0.2 to +0.2)
  health_bonus := LEAST(0.2, GREATEST(-0.2, p_health_change / 50.0));

  -- Goals completion ratio (0 to 1)
  goals_score := CASE
    WHEN p_total_goals > 0 THEN (p_goals_achieved_count::NUMERIC / p_total_goals)
    ELSE 0.5
  END;

  -- Weighted combination
  RETURN LEAST(1.0, GREATEST(0.0,
    (base_score * 0.5) + (goals_score * 0.3) + (health_bonus * 0.2) + 0.1
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get customer journey summary
CREATE OR REPLACE FUNCTION get_customer_journey_summary(p_customer_id UUID)
RETURNS TABLE (
  total_playbooks INTEGER,
  successful_playbooks INTEGER,
  average_health_delta NUMERIC,
  most_common_type TEXT,
  current_health INTEGER,
  days_since_last_playbook INTEGER,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_playbooks,
    COUNT(*) FILTER (WHERE outcome_status = 'success')::INTEGER as successful_playbooks,
    AVG(health_delta)::NUMERIC as average_health_delta,
    MODE() WITHIN GROUP (ORDER BY playbook_type) as most_common_type,
    (SELECT health_score FROM customers WHERE id = p_customer_id) as current_health,
    EXTRACT(DAY FROM NOW() - MAX(completed_at))::INTEGER as days_since_last_playbook,
    (COUNT(*) FILTER (WHERE outcome_status = 'success')::NUMERIC / NULLIF(COUNT(*), 0))::NUMERIC as success_rate
  FROM customer_playbook_journey
  WHERE customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql STABLE;
