-- PRD-258: Coverage Backup System
-- Migration to add enhanced coverage management tables

-- ============================================
-- CSM Absences Table
-- ============================================
CREATE TABLE IF NOT EXISTS csm_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_type VARCHAR(50) NOT NULL, -- 'vacation', 'sick', 'conference', 'parental', 'other'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_partial BOOLEAN DEFAULT false,
  partial_hours TEXT, -- e.g., "9am-12pm" if partial

  -- Preferences
  preferred_backup_user_id UUID REFERENCES users(id),
  special_instructions TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'planned', -- 'planned', 'coverage_assigned', 'active', 'completed', 'cancelled'
  calendar_event_id VARCHAR(200), -- Linked calendar OOO event

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Coverage Assignments Table
-- ============================================
CREATE TABLE IF NOT EXISTS coverage_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_id UUID NOT NULL REFERENCES csm_absences(id) ON DELETE CASCADE,
  backup_user_id UUID NOT NULL REFERENCES users(id),
  assigned_by_user_id UUID REFERENCES users(id),

  -- Scope
  coverage_type VARCHAR(50) DEFAULT 'full', -- 'full', 'partial', 'tiered'
  covered_customer_ids UUID[], -- Null = all accounts

  -- Tier (for tiered coverage)
  tier INTEGER DEFAULT 1, -- 1 = primary, 2 = secondary

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'active', 'completed'
  accepted_at TIMESTAMPTZ,
  declined_reason TEXT,

  -- Metrics
  notifications_received INTEGER DEFAULT 0,
  actions_taken INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Coverage Briefs Table
-- ============================================
CREATE TABLE IF NOT EXISTS coverage_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coverage_assignment_id UUID NOT NULL REFERENCES coverage_assignments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Generated content
  brief_content JSONB NOT NULL, -- Structured brief data
  generated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Access tracking
  viewed_at TIMESTAMPTZ,
  viewed_by UUID REFERENCES users(id),

  -- During coverage
  notes_added TEXT,
  actions_taken JSONB DEFAULT '[]'
);

-- ============================================
-- Coverage Activities Table
-- ============================================
CREATE TABLE IF NOT EXISTS coverage_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coverage_assignment_id UUID NOT NULL REFERENCES coverage_assignments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  backup_user_id UUID NOT NULL REFERENCES users(id),
  original_csm_id UUID NOT NULL REFERENCES users(id),

  -- Activity
  activity_type VARCHAR(100) NOT NULL, -- 'email', 'call', 'meeting', 'task', 'escalation', 'note'
  description TEXT,
  outcome TEXT,

  -- Related entities
  related_entity_type VARCHAR(50), -- 'task', 'meeting', 'email', 'support_ticket'
  related_entity_id UUID,

  activity_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_absences_user ON csm_absences(user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_absences_dates ON csm_absences(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_absences_status ON csm_absences(status);
CREATE INDEX IF NOT EXISTS idx_coverage_assignments_backup ON coverage_assignments(backup_user_id);
CREATE INDEX IF NOT EXISTS idx_coverage_assignments_absence ON coverage_assignments(absence_id);
CREATE INDEX IF NOT EXISTS idx_coverage_assignments_status ON coverage_assignments(status);
CREATE INDEX IF NOT EXISTS idx_coverage_briefs_assignment ON coverage_briefs(coverage_assignment_id);
CREATE INDEX IF NOT EXISTS idx_coverage_briefs_customer ON coverage_briefs(customer_id);
CREATE INDEX IF NOT EXISTS idx_coverage_activities_assignment ON coverage_activities(coverage_assignment_id);
CREATE INDEX IF NOT EXISTS idx_coverage_activities_customer ON coverage_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_coverage_activities_date ON coverage_activities(activity_date);

-- ============================================
-- Updated At Trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_csm_absences_updated_at ON csm_absences;
CREATE TRIGGER update_csm_absences_updated_at
    BEFORE UPDATE ON csm_absences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Sample Data for Development
-- ============================================
-- Note: In production, this would not be included

COMMENT ON TABLE csm_absences IS 'PRD-258: Tracks CSM planned and unplanned absences';
COMMENT ON TABLE coverage_assignments IS 'PRD-258: Assigns backup CSMs to cover for absences';
COMMENT ON TABLE coverage_briefs IS 'PRD-258: Per-account context briefs for backup CSMs';
COMMENT ON TABLE coverage_activities IS 'PRD-258: Activities performed by backup CSMs during coverage';
