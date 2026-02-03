-- Migration: Competitive Intelligence (PRD-068)
-- Track competitor mentions, evaluations, and battle card data

-- ================================================
-- COMPETITORS TABLE
-- Known competitors in the market
-- ================================================
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  domain VARCHAR(255),
  description TEXT,
  category VARCHAR(100), -- 'direct', 'indirect', 'emerging'
  strengths JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  pricing_info TEXT,
  target_segments JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitors_name ON competitors(name);
CREATE INDEX IF NOT EXISTS idx_competitors_category ON competitors(category);

-- ================================================
-- BATTLE CARDS TABLE
-- Competitive battle cards with talk tracks
-- ================================================
CREATE TABLE IF NOT EXISTS battle_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  our_strengths JSONB DEFAULT '[]', -- Array of strength objects
  their_weaknesses JSONB DEFAULT '[]',
  key_differentiators JSONB DEFAULT '[]',
  objection_handlers JSONB DEFAULT '[]', -- Array of {objection, response}
  talk_tracks JSONB DEFAULT '[]', -- Array of {scenario, script}
  pricing_comparison JSONB,
  customer_wins JSONB DEFAULT '[]', -- Array of {customer, story}
  version INTEGER DEFAULT 1,
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battle_cards_competitor ON battle_cards(competitor_id);
CREATE INDEX IF NOT EXISTS idx_battle_cards_status ON battle_cards(status);

-- ================================================
-- COMPETITIVE MENTIONS TABLE
-- Track competitor mentions per customer
-- ================================================
CREATE TABLE IF NOT EXISTS competitive_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL,
  competitor_name VARCHAR(255) NOT NULL, -- Denormalized for flexibility
  source_type VARCHAR(50) NOT NULL, -- 'meeting', 'email', 'support_ticket', 'qbr', 'manual'
  source_id UUID, -- Reference to the source record
  source_text TEXT, -- The actual text containing the mention
  context TEXT, -- Additional context around the mention
  sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative'
  intent VARCHAR(50), -- 'evaluation', 'comparison', 'complaint', 'praise', 'question'
  mentioned_by VARCHAR(255), -- Who mentioned the competitor
  mentioned_at TIMESTAMPTZ NOT NULL,
  extracted_concerns JSONB DEFAULT '[]', -- Concerns about us
  extracted_interests JSONB DEFAULT '[]', -- What they like about competitor
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitive_mentions_customer ON competitive_mentions(customer_id);
CREATE INDEX IF NOT EXISTS idx_competitive_mentions_competitor ON competitive_mentions(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitive_mentions_source ON competitive_mentions(source_type);
CREATE INDEX IF NOT EXISTS idx_competitive_mentions_date ON competitive_mentions(mentioned_at);

-- ================================================
-- CUSTOMER COMPETITORS TABLE
-- Track competitive status per customer
-- ================================================
CREATE TABLE IF NOT EXISTS customer_competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  competitor_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'unknown', -- 'active_threat', 'incumbent', 'past_evaluation', 'market_presence'
  relationship VARCHAR(100), -- 'evaluating', 'using_alongside', 'considering', 'displaced'
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_mentioned_at TIMESTAMPTZ,
  mention_count INTEGER DEFAULT 1,
  risk_level VARCHAR(20), -- 'critical', 'high', 'medium', 'low'
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, competitor_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_competitors_customer ON customer_competitors(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_competitors_status ON customer_competitors(status);
CREATE INDEX IF NOT EXISTS idx_customer_competitors_risk ON customer_competitors(risk_level);

-- ================================================
-- FEATURE GAPS TABLE
-- Track feature gaps mentioned vs competitors
-- ================================================
CREATE TABLE IF NOT EXISTS feature_gaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL,
  feature_name VARCHAR(255) NOT NULL,
  description TEXT,
  competitor_has BOOLEAN DEFAULT TRUE,
  our_status VARCHAR(50) DEFAULT 'missing', -- 'missing', 'planned', 'in_development', 'shipped'
  our_roadmap_quarter VARCHAR(20),
  priority VARCHAR(20), -- 'high', 'medium', 'low'
  mention_count INTEGER DEFAULT 1,
  impact_on_deal VARCHAR(50), -- 'blocker', 'major', 'minor', 'none'
  workaround TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_gaps_customer ON feature_gaps(customer_id);
CREATE INDEX IF NOT EXISTS idx_feature_gaps_competitor ON feature_gaps(competitor_id);
CREATE INDEX IF NOT EXISTS idx_feature_gaps_status ON feature_gaps(our_status);

-- ================================================
-- CUSTOMER TECH STACK TABLE
-- Track customer's technology ecosystem
-- ================================================
CREATE TABLE IF NOT EXISTS customer_tech_stack (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL, -- 'CRM', 'Marketing', 'Analytics', 'Support', etc.
  product_name VARCHAR(255) NOT NULL,
  vendor VARCHAR(255),
  is_competitor BOOLEAN DEFAULT FALSE,
  integration_status VARCHAR(50), -- 'integrated', 'planned', 'none'
  spend_estimate DECIMAL(12,2),
  contract_end DATE,
  notes TEXT,
  source VARCHAR(50), -- 'technographics', 'manual', 'meeting', 'email'
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_tech_stack_customer ON customer_tech_stack(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tech_stack_category ON customer_tech_stack(category);
CREATE INDEX IF NOT EXISTS idx_customer_tech_stack_is_competitor ON customer_tech_stack(is_competitor);

-- ================================================
-- TRIGGERS
-- ================================================

-- Update timestamps
DROP TRIGGER IF EXISTS update_competitors_updated_at ON competitors;
CREATE TRIGGER update_competitors_updated_at
  BEFORE UPDATE ON competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_battle_cards_updated_at ON battle_cards;
CREATE TRIGGER update_battle_cards_updated_at
  BEFORE UPDATE ON battle_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_competitors_updated_at ON customer_competitors;
CREATE TRIGGER update_customer_competitors_updated_at
  BEFORE UPDATE ON customer_competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feature_gaps_updated_at ON feature_gaps;
CREATE TRIGGER update_feature_gaps_updated_at
  BEFORE UPDATE ON feature_gaps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_tech_stack_updated_at ON customer_tech_stack;
CREATE TRIGGER update_customer_tech_stack_updated_at
  BEFORE UPDATE ON customer_tech_stack
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- VIEWS
-- ================================================

-- View: Competitive risk summary per customer
CREATE OR REPLACE VIEW v_customer_competitive_risk AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  c.arr,
  c.health_score,
  COUNT(DISTINCT cc.competitor_id) as competitor_count,
  COUNT(DISTINCT cc.competitor_id) FILTER (WHERE cc.status = 'active_threat') as active_threats,
  COUNT(DISTINCT cc.competitor_id) FILTER (WHERE cc.status = 'incumbent') as incumbents,
  COUNT(cm.id) as total_mentions,
  COUNT(cm.id) FILTER (WHERE cm.mentioned_at > NOW() - INTERVAL '90 days') as recent_mentions,
  MAX(cm.mentioned_at) as last_mention_date,
  CASE
    WHEN COUNT(cc.competitor_id) FILTER (WHERE cc.status = 'active_threat') > 0 THEN 'critical'
    WHEN COUNT(cc.competitor_id) FILTER (WHERE cc.status = 'incumbent') > 1 THEN 'high'
    WHEN COUNT(cm.id) FILTER (WHERE cm.mentioned_at > NOW() - INTERVAL '30 days') > 3 THEN 'medium'
    ELSE 'low'
  END as overall_risk_level
FROM customers c
LEFT JOIN customer_competitors cc ON cc.customer_id = c.id
LEFT JOIN competitive_mentions cm ON cm.customer_id = c.id
GROUP BY c.id, c.name, c.arr, c.health_score;

-- View: Competitor frequency across portfolio
CREATE OR REPLACE VIEW v_competitor_frequency AS
SELECT
  comp.id as competitor_id,
  comp.name as competitor_name,
  comp.category,
  COUNT(DISTINCT cc.customer_id) as customer_count,
  COUNT(DISTINCT cc.customer_id) FILTER (WHERE cc.status = 'active_threat') as active_evaluation_count,
  SUM(cc.mention_count) as total_mentions,
  COUNT(DISTINCT cm.customer_id) FILTER (WHERE cm.mentioned_at > NOW() - INTERVAL '90 days') as recent_customers,
  ARRAY_AGG(DISTINCT c.name) FILTER (WHERE cc.status = 'active_threat') as actively_evaluating_customers
FROM competitors comp
LEFT JOIN customer_competitors cc ON cc.competitor_id = comp.id
LEFT JOIN competitive_mentions cm ON cm.competitor_id = comp.id
LEFT JOIN customers c ON c.id = cc.customer_id
GROUP BY comp.id, comp.name, comp.category
ORDER BY customer_count DESC;

-- ================================================
-- SEED DATA: Common Competitors (Optional)
-- ================================================
-- INSERT INTO competitors (name, category, description) VALUES
--   ('CompetitorX', 'direct', 'Primary competitor in enterprise segment'),
--   ('CompetitorY', 'direct', 'Strong in SMB market'),
--   ('CompetitorZ', 'indirect', 'Analytics-focused alternative');
