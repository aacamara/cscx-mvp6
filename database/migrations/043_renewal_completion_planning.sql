-- ============================================
-- PRD-138: CONTRACT RENEWAL COMPLETE → PLANNING
-- Migration for renewal completion planning workflow
-- ============================================

-- Renewal Completion Planning Table
-- Tracks post-renewal planning workflow after a contract is renewed
CREATE TABLE IF NOT EXISTS renewal_completion_planning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  renewal_id UUID REFERENCES renewals(id) ON DELETE SET NULL,

  -- Previous contract details
  previous_contract_end_date DATE NOT NULL,
  previous_arr DECIMAL(12,2) NOT NULL DEFAULT 0,
  previous_term TEXT, -- e.g., '12 months', '24 months'

  -- New contract details
  new_contract_start_date DATE NOT NULL,
  new_contract_end_date DATE NOT NULL,
  new_arr DECIMAL(12,2) NOT NULL DEFAULT 0,
  new_term TEXT,
  arr_change DECIMAL(12,2) GENERATED ALWAYS AS (new_arr - previous_arr) STORED,
  contract_changes TEXT[], -- Array of notable changes

  -- Success plan tracking
  success_plan_id UUID,
  success_plan_generated BOOLEAN DEFAULT FALSE,
  carry_forward_goals TEXT[],
  new_objectives TEXT[],
  success_plan_generated_at TIMESTAMPTZ,

  -- Kickoff planning
  kickoff_scheduled BOOLEAN DEFAULT FALSE,
  kickoff_scheduled_at TIMESTAMPTZ,
  kickoff_date TIMESTAMPTZ,
  kickoff_attendees TEXT[],
  kickoff_agenda_doc_id TEXT,
  kickoff_agenda_doc_url TEXT,

  -- Internal debrief tracking
  debrief_completed BOOLEAN DEFAULT FALSE,
  debrief_completed_at TIMESTAMPTZ,
  debrief_document_id TEXT,
  debrief_document_url TEXT,
  debrief_learnings JSONB,

  -- Health reset tracking
  health_reset_completed BOOLEAN DEFAULT FALSE,
  previous_health_score INT,
  baseline_health_score INT,

  -- Status tracking
  status TEXT CHECK (status IN (
    'detected',           -- Renewal completion detected
    'contract_updated',   -- Customer record updated with new contract
    'plan_generated',     -- Success plan generated
    'kickoff_scheduled',  -- Kickoff meeting scheduled
    'debrief_completed',  -- Renewal debrief completed
    'completed',          -- All planning tasks completed
    'failed'              -- Something went wrong
  )) DEFAULT 'detected',

  -- Notification tracking
  notifications_sent JSONB DEFAULT '[]'::jsonb,

  -- Ownership
  csm_id UUID,
  created_by UUID,

  -- Metadata
  source TEXT DEFAULT 'manual', -- 'salesforce', 'manual', 'api'
  external_renewal_id TEXT, -- Salesforce opportunity ID, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Renewal Debrief Template Responses
-- Stores structured debrief information
CREATE TABLE IF NOT EXISTS renewal_debrief_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_id UUID REFERENCES renewal_completion_planning(id) ON DELETE CASCADE,

  -- What went well
  went_well TEXT[],

  -- Challenges encountered
  challenges TEXT[],

  -- Competitive factors
  competitive_threats TEXT[],
  competitor_mentioned TEXT,

  -- Pricing insights
  pricing_discussion_notes TEXT,
  discount_given BOOLEAN DEFAULT FALSE,
  discount_percentage DECIMAL(5,2),
  price_objection BOOLEAN DEFAULT FALSE,

  -- Relationship assessment
  relationship_strength TEXT CHECK (relationship_strength IN ('strong', 'moderate', 'weak', 'at_risk')),
  key_stakeholder_changes TEXT,
  champion_status TEXT,
  executive_engagement TEXT,

  -- Future opportunities
  expansion_opportunities TEXT[],
  upsell_discussed BOOLEAN DEFAULT FALSE,
  upsell_products TEXT[],

  -- Lessons learned
  lessons_for_next_renewal TEXT[],
  process_improvements TEXT[],

  -- Recorded by
  recorded_by UUID,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Success Plan Template for New Period
CREATE TABLE IF NOT EXISTS success_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  segment TEXT, -- 'enterprise', 'mid-market', 'smb'

  -- Default objectives
  default_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Default KPIs
  default_kpis JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Default milestones
  default_milestones JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Is active
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Success Plans
CREATE TABLE IF NOT EXISTS customer_success_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  planning_id UUID REFERENCES renewal_completion_planning(id) ON DELETE SET NULL,
  template_id UUID REFERENCES success_plan_templates(id) ON DELETE SET NULL,

  -- Plan period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label TEXT, -- e.g., 'FY2026', 'H1 2026'

  -- Objectives
  objectives JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- KPIs with targets
  kpis JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Milestones
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Carried forward from previous period
  carried_forward_items JSONB DEFAULT '[]'::jsonb,

  -- Status
  status TEXT CHECK (status IN ('draft', 'active', 'completed', 'cancelled')) DEFAULT 'draft',

  -- Review tracking
  last_reviewed_at TIMESTAMPTZ,
  last_reviewed_by UUID,
  next_review_date DATE,

  -- Document links
  document_id TEXT,
  document_url TEXT,

  -- Ownership
  csm_id UUID,
  created_by UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_renewal_completion_customer ON renewal_completion_planning(customer_id);
CREATE INDEX IF NOT EXISTS idx_renewal_completion_renewal ON renewal_completion_planning(renewal_id);
CREATE INDEX IF NOT EXISTS idx_renewal_completion_status ON renewal_completion_planning(status);
CREATE INDEX IF NOT EXISTS idx_renewal_completion_created ON renewal_completion_planning(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_renewal_debrief_planning ON renewal_debrief_responses(planning_id);
CREATE INDEX IF NOT EXISTS idx_success_plans_customer ON customer_success_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_success_plans_planning ON customer_success_plans(planning_id);

-- Update trigger for renewal_completion_planning
CREATE OR REPLACE FUNCTION update_renewal_completion_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Set completed_at when status changes to completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_renewal_completion_timestamp ON renewal_completion_planning;
CREATE TRIGGER update_renewal_completion_timestamp
  BEFORE UPDATE ON renewal_completion_planning
  FOR EACH ROW EXECUTE FUNCTION update_renewal_completion_timestamp();

-- Update trigger for customer_success_plans
CREATE OR REPLACE FUNCTION update_success_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_success_plan_timestamp ON customer_success_plans;
CREATE TRIGGER update_success_plan_timestamp
  BEFORE UPDATE ON customer_success_plans
  FOR EACH ROW EXECUTE FUNCTION update_success_plan_timestamp();

-- Insert default success plan templates
INSERT INTO success_plan_templates (id, name, description, segment, default_objectives, default_kpis, default_milestones)
VALUES
  (
    gen_random_uuid(),
    'Enterprise Success Plan',
    'Comprehensive success plan for enterprise customers with strategic focus',
    'enterprise',
    '[
      {"title": "Maximize Product Adoption", "description": "Achieve 80%+ feature adoption across all licensed modules"},
      {"title": "Executive Alignment", "description": "Establish quarterly executive touchpoints and strategic reviews"},
      {"title": "Value Realization", "description": "Document and quantify ROI metrics for business case"},
      {"title": "Expansion Readiness", "description": "Identify and nurture expansion opportunities"}
    ]'::jsonb,
    '[
      {"name": "Feature Adoption Rate", "target": 80, "unit": "%"},
      {"name": "Monthly Active Users", "target": 90, "unit": "%"},
      {"name": "Support Ticket Volume", "target": 20, "unit": "tickets/month", "direction": "down"},
      {"name": "NPS Score", "target": 50, "unit": "points"}
    ]'::jsonb,
    '[
      {"title": "30-Day Check-in", "days_from_start": 30, "description": "Review initial period performance and adjust plan"},
      {"title": "Quarterly Business Review", "days_from_start": 90, "description": "Formal QBR with stakeholders"},
      {"title": "Mid-Year Assessment", "days_from_start": 180, "description": "Comprehensive mid-year review"},
      {"title": "Renewal Planning Kickoff", "days_from_start": 270, "description": "Begin next renewal cycle planning"}
    ]'::jsonb
  ),
  (
    gen_random_uuid(),
    'Mid-Market Success Plan',
    'Balanced success plan for mid-market customers',
    'mid-market',
    '[
      {"title": "Drive Product Adoption", "description": "Achieve 70%+ adoption of core features"},
      {"title": "Build Champion Network", "description": "Identify and develop internal champions"},
      {"title": "Establish Success Metrics", "description": "Define and track customer-specific KPIs"}
    ]'::jsonb,
    '[
      {"name": "Feature Adoption Rate", "target": 70, "unit": "%"},
      {"name": "Active User Rate", "target": 80, "unit": "%"},
      {"name": "Health Score", "target": 75, "unit": "points"}
    ]'::jsonb,
    '[
      {"title": "30-Day Check-in", "days_from_start": 30, "description": "Initial performance review"},
      {"title": "Quarterly Review", "days_from_start": 90, "description": "Quarterly business review"}
    ]'::jsonb
  ),
  (
    gen_random_uuid(),
    'SMB Success Plan',
    'Streamlined success plan for SMB customers',
    'smb',
    '[
      {"title": "Core Feature Adoption", "description": "Ensure adoption of essential features"},
      {"title": "Self-Service Enablement", "description": "Enable customer self-sufficiency"}
    ]'::jsonb,
    '[
      {"name": "Feature Adoption Rate", "target": 60, "unit": "%"},
      {"name": "Self-Service Resolution Rate", "target": 80, "unit": "%"}
    ]'::jsonb,
    '[
      {"title": "Monthly Check-in", "days_from_start": 30, "description": "Brief monthly status review"}
    ]'::jsonb
  )
ON CONFLICT DO NOTHING;

-- Function to detect renewal completions from renewals table
CREATE OR REPLACE FUNCTION detect_renewal_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- When a renewal is marked as 'renewed' outcome, create a planning record
  IF NEW.outcome = 'renewed' AND (OLD.outcome IS NULL OR OLD.outcome != 'renewed') THEN
    INSERT INTO renewal_completion_planning (
      customer_id,
      renewal_id,
      previous_contract_end_date,
      previous_arr,
      new_contract_start_date,
      new_contract_end_date,
      new_arr,
      csm_id,
      source,
      status
    )
    SELECT
      NEW.customer_id,
      NEW.id,
      NEW.renewal_date,
      NEW.current_arr,
      NEW.renewal_date + INTERVAL '1 day',
      NEW.renewal_date + INTERVAL '1 year', -- Default to 1 year term
      COALESCE(NEW.outcome_arr, NEW.proposed_arr, NEW.current_arr),
      NEW.csm_id,
      'automatic',
      'detected'
    WHERE NOT EXISTS (
      SELECT 1 FROM renewal_completion_planning
      WHERE renewal_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_renewal_completion ON renewals;
CREATE TRIGGER trigger_renewal_completion
  AFTER UPDATE ON renewals
  FOR EACH ROW EXECUTE FUNCTION detect_renewal_completion();
