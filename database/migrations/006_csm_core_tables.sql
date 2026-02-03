-- ============================================
-- CSM CORE TABLES MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- Health Scores (PROVE Framework)
CREATE TABLE IF NOT EXISTS health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  overall INT CHECK (overall >= 0 AND overall <= 100),
  overall_color TEXT CHECK (overall_color IN ('green', 'yellow', 'red')),
  product INT DEFAULT 0,
  risk INT DEFAULT 0,
  outcomes INT DEFAULT 0,
  voice INT DEFAULT 0,
  engagement INT DEFAULT 0,
  notes TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Success Plans
CREATE TABLE IF NOT EXISTS success_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('land', 'expand', 'renewal', 'roi')) DEFAULT 'land',
  status TEXT CHECK (status IN ('draft', 'active', 'on_hold', 'closed_achieved', 'closed_not_achieved')) DEFAULT 'draft',
  target_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Objectives (linked to Success Plans)
CREATE TABLE IF NOT EXISTS objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES success_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'blocked', 'completed')) DEFAULT 'not_started',
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CTAs (Calls to Action)
CREATE TABLE IF NOT EXISTS ctas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  owner_id UUID,
  type TEXT CHECK (type IN ('risk', 'opportunity', 'lifecycle', 'objective')) NOT NULL,
  reason TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  due_date DATE,
  status TEXT CHECK (status IN ('open', 'in_progress', 'snoozed', 'closed_successful', 'closed_unsuccessful')) DEFAULT 'open',
  playbook_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Timeline Activities
CREATE TABLE IF NOT EXISTS timeline_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID,
  type TEXT CHECK (type IN ('update', 'call', 'in_person', 'email', 'milestone')) NOT NULL,
  subject TEXT NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Glossary Terms
CREATE TABLE IF NOT EXISTS glossary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL UNIQUE,
  abbreviation TEXT,
  definition TEXT NOT NULL,
  category TEXT,
  related_terms TEXT[],
  usage_example TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playbooks
CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT,
  trigger_conditions TEXT,
  duration_days INT,
  phases JSONB NOT NULL DEFAULT '[]',
  success_criteria JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playbook Executions
CREATE TABLE IF NOT EXISTS playbook_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID REFERENCES playbooks(id),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  cta_id UUID REFERENCES ctas(id),
  current_phase INT DEFAULT 1,
  status TEXT CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  progress JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enhance customers table with CSM fields
ALTER TABLE customers ADD COLUMN IF NOT EXISTS arr DECIMAL(12,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS segment TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS renewal_date DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS csm_id UUID;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS health_score INT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS health_color TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deployment_type TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tier TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_health_scores_customer ON health_scores(customer_id);
CREATE INDEX IF NOT EXISTS idx_success_plans_customer ON success_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_ctas_customer ON ctas(customer_id);
CREATE INDEX IF NOT EXISTS idx_ctas_status ON ctas(status);
CREATE INDEX IF NOT EXISTS idx_timeline_customer ON timeline_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_glossary_term ON glossary(term);
