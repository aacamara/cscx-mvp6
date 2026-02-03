-- ============================================
-- CHURN POST-MORTEM MIGRATION (PRD-124)
-- Run this in Supabase SQL Editor
-- ============================================

-- Churn Reason Enum Type
DO $$ BEGIN
  CREATE TYPE churn_reason AS ENUM (
    'price_value',
    'product_gaps',
    'poor_onboarding',
    'champion_left',
    'strategic_ma',
    'competitive',
    'support_issues',
    'relationship',
    'budget_cuts',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Churn Post-Mortem Status Enum
DO $$ BEGIN
  CREATE TYPE churn_post_mortem_status AS ENUM (
    'initiated',
    'data_gathered',
    'analysis_pending',
    'review_scheduled',
    'completed',
    'closed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Win-Back Potential Enum
DO $$ BEGIN
  CREATE TYPE win_back_potential AS ENUM (
    'high',
    'medium',
    'low',
    'none'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- MAIN CHURN POST-MORTEM TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS churn_post_mortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  churn_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  arr_lost DECIMAL(12,2) NOT NULL DEFAULT 0,
  status churn_post_mortem_status NOT NULL DEFAULT 'initiated',

  -- Churn Detection Metadata
  detection_source TEXT CHECK (detection_source IN ('stage_change', 'non_renewal', 'cancellation', 'deactivation', 'manual')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  detected_by UUID, -- User or agent that detected churn

  -- Root Causes
  primary_root_cause churn_reason,
  contributing_factors churn_reason[] DEFAULT '{}',
  custom_notes TEXT,

  -- Win-Back Assessment
  win_back_potential win_back_potential DEFAULT 'none',
  win_back_triggers TEXT[] DEFAULT '{}',
  win_back_reminder_date DATE,

  -- Review Meeting
  review_scheduled_at TIMESTAMPTZ,
  review_attendees UUID[] DEFAULT '{}',
  review_outcome TEXT,

  -- Document Reference
  document_id TEXT, -- Google Doc ID for post-mortem document
  document_url TEXT, -- Direct URL to document

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID,
  assigned_to UUID
);

-- ============================================
-- DATA COMPILATION TABLE
-- Stores compiled customer history for analysis
-- ============================================
CREATE TABLE IF NOT EXISTS churn_data_compilations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_mortem_id UUID NOT NULL REFERENCES churn_post_mortems(id) ON DELETE CASCADE,

  -- Health Score History (JSON array of {date, score, color})
  health_score_history JSONB DEFAULT '[]',

  -- Risk Signals History (JSON array of signals)
  risk_signals JSONB DEFAULT '[]',

  -- Support Summary
  support_summary JSONB DEFAULT '{}',

  -- Meeting Sentiments (JSON array of {date, sentiment, notes})
  meeting_sentiments JSONB DEFAULT '[]',

  -- Usage Trend Data
  usage_trend JSONB DEFAULT '{}',

  -- Save Play Attempts
  save_plays JSONB DEFAULT '[]',

  -- Interaction Timeline (comprehensive event list)
  interaction_timeline JSONB DEFAULT '[]',

  -- Compilation metadata
  compiled_at TIMESTAMPTZ DEFAULT NOW(),
  compiled_by TEXT, -- Agent or service that compiled

  UNIQUE(post_mortem_id)
);

-- ============================================
-- ANALYSIS TABLE
-- Stores AI-generated and human-refined analysis
-- ============================================
CREATE TABLE IF NOT EXISTS churn_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_mortem_id UUID NOT NULL REFERENCES churn_post_mortems(id) ON DELETE CASCADE,

  -- AI-Suggested Analysis
  early_warning_signals TEXT[] DEFAULT '{}',
  missed_opportunities TEXT[] DEFAULT '{}',
  lessons_learned TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',

  -- Executive Summary (AI-generated)
  executive_summary TEXT,

  -- Customer Profile Snapshot
  customer_snapshot JSONB DEFAULT '{}',

  -- Churn Timeline (key events leading to churn)
  churn_timeline JSONB DEFAULT '[]',

  -- Analysis metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by TEXT, -- Agent that generated analysis
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,

  UNIQUE(post_mortem_id)
);

-- ============================================
-- CHURN PATTERNS TABLE
-- Aggregated pattern analysis across all churns
-- ============================================
CREATE TABLE IF NOT EXISTS churn_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pattern identification
  pattern_type TEXT NOT NULL, -- 'root_cause', 'segment', 'seasonal', 'csm', 'early_warning'
  pattern_name TEXT NOT NULL,
  pattern_description TEXT,

  -- Pattern data
  occurrence_count INT DEFAULT 0,
  affected_arr DECIMAL(12,2) DEFAULT 0,

  -- Breakdown data (JSON for flexibility)
  breakdown_data JSONB DEFAULT '{}',

  -- Time period
  period_start DATE,
  period_end DATE,

  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(pattern_type, pattern_name, period_start, period_end)
);

-- ============================================
-- CHURN EVENTS LOG
-- Tracks all churn-related events for audit
-- ============================================
CREATE TABLE IF NOT EXISTS churn_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_mortem_id UUID REFERENCES churn_post_mortems(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL CHECK (event_type IN (
    'churn_detected',
    'post_mortem_initiated',
    'data_compiled',
    'analysis_generated',
    'root_cause_set',
    'review_scheduled',
    'review_completed',
    'post_mortem_completed',
    'win_back_reminder_set',
    'stakeholder_notified'
  )),

  event_data JSONB DEFAULT '{}',
  triggered_by TEXT, -- 'system', 'agent', or user_id

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_churn_post_mortems_customer ON churn_post_mortems(customer_id);
CREATE INDEX IF NOT EXISTS idx_churn_post_mortems_status ON churn_post_mortems(status);
CREATE INDEX IF NOT EXISTS idx_churn_post_mortems_churn_date ON churn_post_mortems(churn_date);
CREATE INDEX IF NOT EXISTS idx_churn_post_mortems_primary_cause ON churn_post_mortems(primary_root_cause);
CREATE INDEX IF NOT EXISTS idx_churn_data_compilations_post_mortem ON churn_data_compilations(post_mortem_id);
CREATE INDEX IF NOT EXISTS idx_churn_analyses_post_mortem ON churn_analyses(post_mortem_id);
CREATE INDEX IF NOT EXISTS idx_churn_patterns_type ON churn_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_churn_events_customer ON churn_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_churn_events_type ON churn_events(event_type);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at on churn_post_mortems changes
CREATE OR REPLACE FUNCTION update_churn_post_mortem_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_churn_post_mortem_timestamp ON churn_post_mortems;
CREATE TRIGGER trigger_update_churn_post_mortem_timestamp
  BEFORE UPDATE ON churn_post_mortems
  FOR EACH ROW
  EXECUTE FUNCTION update_churn_post_mortem_timestamp();

-- Auto-set completed_at when status changes to 'completed' or 'closed'
CREATE OR REPLACE FUNCTION set_churn_post_mortem_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'closed') AND OLD.status NOT IN ('completed', 'closed') THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_churn_post_mortem_completed ON churn_post_mortems;
CREATE TRIGGER trigger_set_churn_post_mortem_completed
  BEFORE UPDATE ON churn_post_mortems
  FOR EACH ROW
  EXECUTE FUNCTION set_churn_post_mortem_completed();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE churn_post_mortems ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_data_compilations ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_events ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (adjust as needed for your auth setup)
CREATE POLICY "Users can view all churn post-mortems" ON churn_post_mortems
  FOR SELECT USING (true);

CREATE POLICY "Users can insert churn post-mortems" ON churn_post_mortems
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update churn post-mortems" ON churn_post_mortems
  FOR UPDATE USING (true);

CREATE POLICY "Users can view churn data compilations" ON churn_data_compilations
  FOR SELECT USING (true);

CREATE POLICY "Users can insert churn data compilations" ON churn_data_compilations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update churn data compilations" ON churn_data_compilations
  FOR UPDATE USING (true);

CREATE POLICY "Users can view churn analyses" ON churn_analyses
  FOR SELECT USING (true);

CREATE POLICY "Users can insert churn analyses" ON churn_analyses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update churn analyses" ON churn_analyses
  FOR UPDATE USING (true);

CREATE POLICY "Users can view churn patterns" ON churn_patterns
  FOR SELECT USING (true);

CREATE POLICY "Users can insert churn patterns" ON churn_patterns
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update churn patterns" ON churn_patterns
  FOR UPDATE USING (true);

CREATE POLICY "Users can view churn events" ON churn_events
  FOR SELECT USING (true);

CREATE POLICY "Users can insert churn events" ON churn_events
  FOR INSERT WITH CHECK (true);
