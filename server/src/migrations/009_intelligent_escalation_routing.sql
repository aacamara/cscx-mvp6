-- Migration: PRD-236 Intelligent Escalation Routing
-- Date: 2025-01-30
-- Description: Creates tables for team expertise, routing decisions, and availability tracking

-- ============================================
-- Team Expertise Table
-- Tracks team member expertise areas and proficiency
-- ============================================

CREATE TABLE IF NOT EXISTS team_expertise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expertise_area VARCHAR(100) NOT NULL,
  proficiency_level INTEGER NOT NULL CHECK (proficiency_level >= 1 AND proficiency_level <= 5),
  years_experience DECIMAL(3,1),
  certifications TEXT[],
  notes TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, expertise_area)
);

-- Indexes for team_expertise
CREATE INDEX IF NOT EXISTS idx_team_expertise_user_id ON team_expertise(user_id);
CREATE INDEX IF NOT EXISTS idx_team_expertise_area ON team_expertise(expertise_area);
CREATE INDEX IF NOT EXISTS idx_team_expertise_proficiency ON team_expertise(proficiency_level DESC);
CREATE INDEX IF NOT EXISTS idx_team_expertise_area_proficiency ON team_expertise(expertise_area, proficiency_level DESC);

-- ============================================
-- Team Availability Table
-- Tracks real-time availability of team members
-- ============================================

CREATE TABLE IF NOT EXISTS team_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('online', 'away', 'busy', 'offline', 'dnd')),
  status_message TEXT,
  available_until TIMESTAMPTZ,
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
  working_hours JSONB DEFAULT '{"start": "09:00", "end": "17:00", "days": [1,2,3,4,5]}'::jsonb,
  on_call BOOLEAN NOT NULL DEFAULT false,
  max_escalations INTEGER NOT NULL DEFAULT 5,
  current_escalation_count INTEGER NOT NULL DEFAULT 0,
  last_escalation_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes for team_availability
CREATE INDEX IF NOT EXISTS idx_team_availability_status ON team_availability(status);
CREATE INDEX IF NOT EXISTS idx_team_availability_on_call ON team_availability(on_call) WHERE on_call = true;
CREATE INDEX IF NOT EXISTS idx_team_availability_load ON team_availability(current_escalation_count);

-- ============================================
-- Routing Decisions Table
-- Records routing decisions for learning and optimization
-- ============================================

CREATE TABLE IF NOT EXISTS routing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id UUID REFERENCES escalations(id) ON DELETE CASCADE,
  primary_assignee_id UUID NOT NULL,
  secondary_assignee_ids UUID[] DEFAULT '{}',
  executive_sponsor_id UUID,
  classification JSONB NOT NULL,
  routing_reason TEXT NOT NULL,
  estimated_response_time INTEGER, -- minutes
  actual_response_time INTEGER, -- minutes, filled later
  routing_score DECIMAL(3,2), -- 0-1, how good was the routing
  feedback TEXT,
  overridden BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  override_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for routing_decisions
CREATE INDEX IF NOT EXISTS idx_routing_decisions_escalation ON routing_decisions(escalation_id);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_primary ON routing_decisions(primary_assignee_id);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_created ON routing_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_overridden ON routing_decisions(overridden) WHERE overridden = true;

-- ============================================
-- Routing Reassignments Table
-- Tracks when escalations are reassigned for learning
-- ============================================

CREATE TABLE IF NOT EXISTS routing_reassignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id UUID NOT NULL REFERENCES escalations(id) ON DELETE CASCADE,
  previous_assignee_id UUID,
  new_assignee_id UUID NOT NULL,
  reason TEXT NOT NULL,
  reassigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for routing_reassignments
CREATE INDEX IF NOT EXISTS idx_routing_reassignments_escalation ON routing_reassignments(escalation_id);
CREATE INDEX IF NOT EXISTS idx_routing_reassignments_new_assignee ON routing_reassignments(new_assignee_id);
CREATE INDEX IF NOT EXISTS idx_routing_reassignments_created ON routing_reassignments(created_at DESC);

-- ============================================
-- Escalation Path Definitions Table
-- Configurable escalation paths for different scenarios
-- ============================================

CREATE TABLE IF NOT EXISTS escalation_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('technical', 'support', 'product', 'commercial', 'relationship')),
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('P1', 'P2', 'P3')),
  customer_tier VARCHAR(50), -- NULL means all tiers
  arr_minimum DECIMAL(12,2), -- NULL means no minimum
  required_roles VARCHAR(50)[] NOT NULL DEFAULT '{}',
  optional_roles VARCHAR(50)[] DEFAULT '{}',
  executive_required BOOLEAN NOT NULL DEFAULT false,
  sla_minutes INTEGER NOT NULL,
  notification_channels TEXT[] DEFAULT '{"slack"}',
  active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for escalation_paths
CREATE INDEX IF NOT EXISTS idx_escalation_paths_category ON escalation_paths(category);
CREATE INDEX IF NOT EXISTS idx_escalation_paths_severity ON escalation_paths(severity);
CREATE INDEX IF NOT EXISTS idx_escalation_paths_active ON escalation_paths(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_escalation_paths_lookup ON escalation_paths(category, severity, active);

-- ============================================
-- Routing Learning Table
-- Stores outcomes for improving routing algorithm
-- ============================================

CREATE TABLE IF NOT EXISTS routing_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id UUID NOT NULL REFERENCES escalations(id) ON DELETE CASCADE,
  initial_routing_decision_id UUID REFERENCES routing_decisions(id),
  final_assignee_id UUID NOT NULL,
  resolution_time_minutes INTEGER,
  customer_satisfaction_score INTEGER CHECK (customer_satisfaction_score >= 1 AND customer_satisfaction_score <= 5),
  was_reassigned BOOLEAN NOT NULL DEFAULT false,
  reassignment_count INTEGER NOT NULL DEFAULT 0,
  expertise_match_score DECIMAL(3,2),
  availability_at_assignment VARCHAR(20),
  outcome VARCHAR(50) CHECK (outcome IN ('resolved', 'escalated_further', 'transferred', 'closed_unresolved')),
  lessons_learned TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for routing_learning
CREATE INDEX IF NOT EXISTS idx_routing_learning_escalation ON routing_learning(escalation_id);
CREATE INDEX IF NOT EXISTS idx_routing_learning_assignee ON routing_learning(final_assignee_id);
CREATE INDEX IF NOT EXISTS idx_routing_learning_outcome ON routing_learning(outcome);
CREATE INDEX IF NOT EXISTS idx_routing_learning_satisfaction ON routing_learning(customer_satisfaction_score DESC);

-- ============================================
-- Insert Default Escalation Paths
-- ============================================

INSERT INTO escalation_paths (name, category, severity, customer_tier, required_roles, optional_roles, executive_required, sla_minutes, notification_channels, priority)
VALUES
  ('Technical P1 - Enterprise', 'technical', 'P1', 'enterprise', ARRAY['engineering', 'support'], ARRAY['product'], true, 30, ARRAY['slack', 'email', 'pagerduty'], 100),
  ('Technical P1 - Standard', 'technical', 'P1', NULL, ARRAY['engineering', 'support'], ARRAY['product'], true, 60, ARRAY['slack', 'email'], 90),
  ('Technical P2', 'technical', 'P2', NULL, ARRAY['engineering'], ARRAY['support'], false, 120, ARRAY['slack'], 50),
  ('Technical P3', 'technical', 'P3', NULL, ARRAY['support'], ARRAY['engineering'], false, 480, ARRAY['slack'], 30),
  ('Support P1', 'support', 'P1', NULL, ARRAY['support'], ARRAY['engineering'], true, 60, ARRAY['slack', 'email'], 80),
  ('Support P2', 'support', 'P2', NULL, ARRAY['support'], ARRAY[], false, 180, ARRAY['slack'], 40),
  ('Support P3', 'support', 'P3', NULL, ARRAY['support'], ARRAY[], false, 480, ARRAY['slack'], 20),
  ('Product P1', 'product', 'P1', NULL, ARRAY['product'], ARRAY['engineering'], true, 120, ARRAY['slack', 'email'], 70),
  ('Product P2', 'product', 'P2', NULL, ARRAY['product'], ARRAY[], false, 240, ARRAY['slack'], 35),
  ('Commercial P1', 'commercial', 'P1', NULL, ARRAY['account-management', 'executive'], ARRAY['finance'], true, 60, ARRAY['slack', 'email'], 85),
  ('Commercial P2', 'commercial', 'P2', NULL, ARRAY['account-management'], ARRAY['finance'], false, 240, ARRAY['slack'], 45),
  ('Relationship P1', 'relationship', 'P1', NULL, ARRAY['customer-success', 'executive'], ARRAY[], true, 60, ARRAY['slack', 'email'], 75),
  ('Relationship P2', 'relationship', 'P2', NULL, ARRAY['customer-success'], ARRAY['executive'], false, 180, ARRAY['slack'], 40)
ON CONFLICT DO NOTHING;

-- ============================================
-- Functions
-- ============================================

-- Function to update availability when escalation is assigned
CREATE OR REPLACE FUNCTION update_availability_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment escalation count for new assignee
  UPDATE team_availability
  SET current_escalation_count = current_escalation_count + 1,
      last_escalation_at = NOW(),
      updated_at = NOW()
  WHERE user_id = NEW.owner_id;

  -- If this is an update (reassignment), decrement old assignee
  IF TG_OP = 'UPDATE' AND OLD.owner_id IS DISTINCT FROM NEW.owner_id AND OLD.owner_id IS NOT NULL THEN
    UPDATE team_availability
    SET current_escalation_count = GREATEST(0, current_escalation_count - 1),
        updated_at = NOW()
    WHERE user_id = OLD.owner_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for escalation assignment tracking
DROP TRIGGER IF EXISTS trg_escalation_assignment ON escalations;
CREATE TRIGGER trg_escalation_assignment
AFTER INSERT OR UPDATE OF owner_id ON escalations
FOR EACH ROW
EXECUTE FUNCTION update_availability_on_assignment();

-- Function to decrement availability when escalation is closed
CREATE OR REPLACE FUNCTION update_availability_on_closure()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    UPDATE team_availability
    SET current_escalation_count = GREATEST(0, current_escalation_count - 1),
        updated_at = NOW()
    WHERE user_id = NEW.owner_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for escalation closure tracking
DROP TRIGGER IF EXISTS trg_escalation_closure ON escalations;
CREATE TRIGGER trg_escalation_closure
AFTER UPDATE OF status ON escalations
FOR EACH ROW
EXECUTE FUNCTION update_availability_on_closure();

-- Function to get best available team members for routing
CREATE OR REPLACE FUNCTION get_available_experts(
  p_expertise_area VARCHAR,
  p_min_proficiency INTEGER DEFAULT 3,
  p_max_load INTEGER DEFAULT 5
)
RETURNS TABLE (
  user_id UUID,
  expertise_area VARCHAR,
  proficiency_level INTEGER,
  current_load INTEGER,
  availability_status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    te.user_id,
    te.expertise_area,
    te.proficiency_level,
    COALESCE(ta.current_escalation_count, 0) as current_load,
    COALESCE(ta.status, 'offline') as availability_status
  FROM team_expertise te
  LEFT JOIN team_availability ta ON te.user_id = ta.user_id
  WHERE te.expertise_area = p_expertise_area
    AND te.proficiency_level >= p_min_proficiency
    AND COALESCE(ta.current_escalation_count, 0) < p_max_load
    AND COALESCE(ta.status, 'offline') IN ('online', 'away')
  ORDER BY
    te.proficiency_level DESC,
    COALESCE(ta.current_escalation_count, 0) ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Add columns to escalations table if not exists
-- ============================================

DO $$
BEGIN
  -- Add routing_decision_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escalations' AND column_name = 'routing_decision_id'
  ) THEN
    ALTER TABLE escalations ADD COLUMN routing_decision_id UUID REFERENCES routing_decisions(id);
  END IF;

  -- Add classification column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escalations' AND column_name = 'classification'
  ) THEN
    ALTER TABLE escalations ADD COLUMN classification JSONB;
  END IF;

  -- Add estimated_response_time column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escalations' AND column_name = 'estimated_response_time'
  ) THEN
    ALTER TABLE escalations ADD COLUMN estimated_response_time INTEGER;
  END IF;
END $$;

-- ============================================
-- Sample Expertise Data (for development)
-- ============================================

-- Note: This would be populated from real user data in production
-- INSERT INTO team_expertise (user_id, expertise_area, proficiency_level) VALUES ...
