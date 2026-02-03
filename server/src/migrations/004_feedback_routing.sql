-- PRD-128: Feedback Received → Routing
-- Database schema for automated feedback categorization and routing

-- ============================================
-- Customer Feedback Table
-- ============================================
CREATE TABLE IF NOT EXISTS customer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Source information
    source VARCHAR(50) NOT NULL CHECK (source IN ('survey', 'widget', 'support', 'meeting', 'email', 'social')),
    source_id VARCHAR(255),
    source_url TEXT,

    -- Submitter information
    submitter_email VARCHAR(255) NOT NULL,
    submitter_name VARCHAR(255),
    submitter_role VARCHAR(100),
    is_key_stakeholder BOOLEAN DEFAULT FALSE,

    -- Content
    content TEXT NOT NULL,
    raw_content TEXT,

    -- AI Classification
    classification_type VARCHAR(50) CHECK (classification_type IN ('feature_request', 'bug', 'praise', 'complaint', 'suggestion')),
    classification_category VARCHAR(50) CHECK (classification_category IN ('product', 'support', 'pricing', 'ux', 'documentation', 'performance', 'onboarding', 'other')),
    classification_sentiment VARCHAR(20) CHECK (classification_sentiment IN ('positive', 'neutral', 'negative')),
    classification_urgency VARCHAR(20) CHECK (classification_urgency IN ('immediate', 'soon', 'backlog')),
    classification_impact VARCHAR(20) CHECK (classification_impact IN ('high', 'medium', 'low')),
    classification_confidence DECIMAL(3,2) DEFAULT 0,
    classification_themes TEXT[] DEFAULT ARRAY[]::TEXT[],
    classification_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    classification_suggested_actions TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Routing
    routing_primary_team VARCHAR(100),
    routing_secondary_teams TEXT[] DEFAULT ARRAY[]::TEXT[],
    routing_assigned_to UUID REFERENCES users(id),
    routing_assigned_to_email VARCHAR(255),
    routing_routed_at TIMESTAMPTZ,
    routing_rule VARCHAR(255),
    routing_escalated BOOLEAN DEFAULT FALSE,
    routing_escalated_to UUID,
    routing_escalated_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'routed', 'acknowledged', 'in_progress', 'resolved', 'closed')),

    -- Acknowledgment
    ack_sent BOOLEAN DEFAULT FALSE,
    ack_sent_at TIMESTAMPTZ,
    ack_method VARCHAR(20) CHECK (ack_method IN ('email', 'slack', 'in_app')),
    ack_draft_content TEXT,
    ack_approved BOOLEAN DEFAULT FALSE,
    ack_approved_by UUID,
    ack_approved_at TIMESTAMPTZ,

    -- Resolution
    resolution_resolved_at TIMESTAMPTZ,
    resolution_outcome VARCHAR(50) CHECK (resolution_outcome IN ('implemented', 'fixed', 'wont_fix', 'duplicate', 'planned')),
    resolution_outcome_details TEXT,
    resolution_customer_notified BOOLEAN DEFAULT FALSE,
    resolution_notified_at TIMESTAMPTZ,
    resolution_external_ticket_id VARCHAR(255),
    resolution_external_ticket_url TEXT,

    -- CSM Notification
    csm_notified BOOLEAN DEFAULT FALSE,
    csm_notified_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for customer_feedback
CREATE INDEX IF NOT EXISTS idx_feedback_customer_id ON customer_feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_source ON customer_feedback(source);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON customer_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON customer_feedback(classification_type);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON customer_feedback(classification_category);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON customer_feedback(classification_sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_urgency ON customer_feedback(classification_urgency);
CREATE INDEX IF NOT EXISTS idx_feedback_impact ON customer_feedback(classification_impact);
CREATE INDEX IF NOT EXISTS idx_feedback_primary_team ON customer_feedback(routing_primary_team);
CREATE INDEX IF NOT EXISTS idx_feedback_assigned_to ON customer_feedback(routing_assigned_to);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON customer_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_content_search ON customer_feedback USING gin(to_tsvector('english', content));

-- ============================================
-- Feedback Routing Rules Table
-- ============================================
CREATE TABLE IF NOT EXISTS feedback_routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 100,
    enabled BOOLEAN DEFAULT TRUE,

    -- Conditions (stored as JSONB for flexibility)
    conditions JSONB NOT NULL DEFAULT '[]'::JSONB,
    condition_logic VARCHAR(10) DEFAULT 'AND' CHECK (condition_logic IN ('AND', 'OR')),

    -- Routing targets
    routing_primary_team VARCHAR(100) NOT NULL,
    routing_secondary_teams TEXT[] DEFAULT ARRAY[]::TEXT[],
    routing_assign_to UUID,

    -- Actions
    notify_csm BOOLEAN DEFAULT TRUE,
    auto_acknowledge BOOLEAN DEFAULT FALSE,

    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for routing rules
CREATE INDEX IF NOT EXISTS idx_routing_rules_enabled ON feedback_routing_rules(enabled, priority);

-- ============================================
-- Feedback Events (Activity Log)
-- ============================================
CREATE TABLE IF NOT EXISTS feedback_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES customer_feedback(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('created', 'classified', 'routed', 'acknowledged', 'status_changed', 'resolved', 'escalated', 'comment_added')),
    event_data JSONB DEFAULT '{}'::JSONB,
    performed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_events_feedback_id ON feedback_events(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_events_type ON feedback_events(event_type);
CREATE INDEX IF NOT EXISTS idx_feedback_events_created_at ON feedback_events(created_at DESC);

-- ============================================
-- Feedback Comments
-- ============================================
CREATE TABLE IF NOT EXISTS feedback_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID NOT NULL REFERENCES customer_feedback(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID,
    author_name VARCHAR(255) NOT NULL,
    author_email VARCHAR(255) NOT NULL,
    internal BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback_id ON feedback_comments(feedback_id);

-- ============================================
-- Feedback Teams Configuration
-- ============================================
CREATE TABLE IF NOT EXISTS feedback_teams (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slack_channel VARCHAR(100),
    email VARCHAR(255),
    feedback_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    categories TEXT[] DEFAULT ARRAY[]::TEXT[],
    members JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Feedback Analytics Cache
-- ============================================
CREATE TABLE IF NOT EXISTS feedback_analytics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    analytics_data JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_key ON feedback_analytics_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON feedback_analytics_cache(expires_at);

-- ============================================
-- Insert Default Routing Rules
-- ============================================
INSERT INTO feedback_routing_rules (name, description, priority, conditions, routing_primary_team, routing_secondary_teams, notify_csm) VALUES
-- Feature requests → Product
('Feature Requests to Product', 'Route all feature requests to the Product team', 10,
 '[{"field": "type", "operator": "equals", "value": "feature_request"}]'::JSONB,
 'product', ARRAY['engineering']::TEXT[], TRUE),

-- Bug reports → Engineering
('Bugs to Engineering', 'Route all bug reports to Engineering', 10,
 '[{"field": "type", "operator": "equals", "value": "bug"}]'::JSONB,
 'engineering', ARRAY['support']::TEXT[], TRUE),

-- Support complaints → Support Lead
('Support Complaints', 'Route support-related complaints to Support Lead', 20,
 '[{"field": "type", "operator": "equals", "value": "complaint"}, {"field": "category", "operator": "equals", "value": "support"}]'::JSONB,
 'support', ARRAY['customer_success']::TEXT[], TRUE),

-- Pricing concerns → Sales/Finance
('Pricing Concerns', 'Route pricing-related feedback to Sales/Finance', 30,
 '[{"field": "category", "operator": "equals", "value": "pricing"}]'::JSONB,
 'sales', ARRAY[]::TEXT[], TRUE),

-- Praise → Marketing
('Praise to Marketing', 'Route positive feedback and praise to Marketing for testimonials', 50,
 '[{"field": "type", "operator": "equals", "value": "praise"}]'::JSONB,
 'marketing', ARRAY['customer_success']::TEXT[], FALSE),

-- UX feedback → Design
('UX Feedback to Design', 'Route UX-related feedback to Design team', 40,
 '[{"field": "category", "operator": "equals", "value": "ux"}]'::JSONB,
 'design', ARRAY['product']::TEXT[], TRUE),

-- Negative sentiment urgent → CSM with escalation
('Urgent Negative Feedback', 'Escalate urgent negative feedback', 5,
 '[{"field": "sentiment", "operator": "equals", "value": "negative"}, {"field": "urgency", "operator": "equals", "value": "immediate"}]'::JSONB,
 'customer_success', ARRAY['support', 'product']::TEXT[], TRUE),

-- High impact → Product
('High Impact Feedback', 'Route high-impact feedback to Product with wider distribution', 15,
 '[{"field": "impact", "operator": "equals", "value": "high"}]'::JSONB,
 'product', ARRAY['engineering', 'customer_success']::TEXT[], TRUE)

ON CONFLICT DO NOTHING;

-- ============================================
-- Insert Default Teams
-- ============================================
INSERT INTO feedback_teams (id, name, feedback_types, categories) VALUES
('product', 'Product Team', ARRAY['feature_request', 'suggestion']::TEXT[], ARRAY['product', 'ux']::TEXT[]),
('engineering', 'Engineering', ARRAY['bug']::TEXT[], ARRAY['performance']::TEXT[]),
('support', 'Support Lead', ARRAY['complaint']::TEXT[], ARRAY['support']::TEXT[]),
('sales', 'Sales/Finance', ARRAY['complaint', 'suggestion']::TEXT[], ARRAY['pricing']::TEXT[]),
('marketing', 'Marketing', ARRAY['praise']::TEXT[], ARRAY[]::TEXT[]),
('design', 'Design Team', ARRAY['suggestion', 'complaint']::TEXT[], ARRAY['ux', 'documentation']::TEXT[]),
('customer_success', 'Customer Success', ARRAY['complaint', 'praise']::TEXT[], ARRAY['onboarding', 'support']::TEXT[])
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Updated At Trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feedback_updated_at ON customer_feedback;
CREATE TRIGGER feedback_updated_at
    BEFORE UPDATE ON customer_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();

DROP TRIGGER IF EXISTS routing_rules_updated_at ON feedback_routing_rules;
CREATE TRIGGER routing_rules_updated_at
    BEFORE UPDATE ON feedback_routing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();

DROP TRIGGER IF EXISTS teams_updated_at ON feedback_teams;
CREATE TRIGGER teams_updated_at
    BEFORE UPDATE ON feedback_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE customer_feedback IS 'PRD-128: Customer feedback with AI classification and routing';
COMMENT ON TABLE feedback_routing_rules IS 'PRD-128: Rules engine for automatic feedback routing';
COMMENT ON TABLE feedback_events IS 'PRD-128: Activity log for feedback lifecycle';
COMMENT ON TABLE feedback_comments IS 'PRD-128: Comments and notes on feedback items';
COMMENT ON TABLE feedback_teams IS 'PRD-128: Team configuration for feedback routing';
