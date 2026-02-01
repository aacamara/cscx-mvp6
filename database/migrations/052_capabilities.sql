-- PRD: Knowledge Base Population & CSM Capability Index
-- Migration to create capabilities table for the capability registry

-- Create capabilities table
CREATE TABLE IF NOT EXISTS capabilities (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,

    -- How users ask for this capability
    trigger_patterns JSONB NOT NULL DEFAULT '[]',
    keywords TEXT[] NOT NULL DEFAULT '{}',
    example_prompts JSONB DEFAULT '[]',

    -- What's needed to execute
    required_inputs JSONB DEFAULT '[]',

    -- What it produces
    outputs JSONB DEFAULT '[]',

    -- How to execute
    execution JSONB DEFAULT '{}',

    -- Relationships
    related_capabilities TEXT[] DEFAULT '{}',
    prerequisites TEXT[] DEFAULT '{}',

    -- Status
    enabled BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GIN index on keywords array for fast keyword matching
CREATE INDEX IF NOT EXISTS idx_capabilities_keywords ON capabilities USING GIN(keywords);

-- Index on category for filtering
CREATE INDEX IF NOT EXISTS idx_capabilities_category ON capabilities(category);

-- Index on enabled for active capabilities
CREATE INDEX IF NOT EXISTS idx_capabilities_enabled ON capabilities(enabled) WHERE enabled = true;

-- GIN index on trigger_patterns for pattern matching
CREATE INDEX IF NOT EXISTS idx_capabilities_trigger_patterns ON capabilities USING GIN(trigger_patterns);

-- Full-text search index on name and description
CREATE INDEX IF NOT EXISTS idx_capabilities_text_search ON capabilities
    USING GIN(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')));

-- Comments
COMMENT ON TABLE capabilities IS 'Registry of all platform capabilities that can be invoked via natural language';
COMMENT ON COLUMN capabilities.id IS 'Unique identifier for the capability (e.g., qbr_generation)';
COMMENT ON COLUMN capabilities.category IS 'Category: document_generation, data_analysis, communication, scheduling, research, risk_management, expansion, onboarding, renewal, reporting, integration, workflow';
COMMENT ON COLUMN capabilities.trigger_patterns IS 'Natural language patterns that trigger this capability';
COMMENT ON COLUMN capabilities.keywords IS 'Keywords for fast lookup and matching';
COMMENT ON COLUMN capabilities.example_prompts IS 'Example user prompts that would invoke this capability';
COMMENT ON COLUMN capabilities.required_inputs IS 'Inputs required to execute: [{name, type, source, required}]';
COMMENT ON COLUMN capabilities.outputs IS 'What the capability produces: [{type, format, description}]';
COMMENT ON COLUMN capabilities.execution IS 'How to execute: {service, method, requiresApproval, estimatedDuration}';
COMMENT ON COLUMN capabilities.related_capabilities IS 'IDs of related capabilities for suggestions';
COMMENT ON COLUMN capabilities.prerequisites IS 'Prerequisites that must be met (e.g., customer_selected)';

-- Enable RLS (capabilities are read-only for users, service manages them)
ALTER TABLE capabilities ENABLE ROW LEVEL SECURITY;

-- RLS policies - all authenticated users can read
CREATE POLICY "All users can view capabilities" ON capabilities
    FOR SELECT
    USING (auth.role() IN ('authenticated', 'service_role'));

-- Only service role can modify
CREATE POLICY "Service role can manage capabilities" ON capabilities
    FOR ALL
    USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON capabilities TO authenticated;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_capabilities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_capabilities_updated_at
    BEFORE UPDATE ON capabilities
    FOR EACH ROW
    EXECUTE FUNCTION update_capabilities_updated_at();

-- Create function for keyword-based capability matching
CREATE OR REPLACE FUNCTION match_capability_by_keywords(search_keywords TEXT[])
RETURNS TABLE(
    capability_id VARCHAR(100),
    capability_name VARCHAR(255),
    category VARCHAR(50),
    match_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as capability_id,
        c.name as capability_name,
        c.category,
        (
            SELECT COUNT(*)::INTEGER
            FROM unnest(c.keywords) k
            WHERE k = ANY(search_keywords)
        ) as match_score
    FROM capabilities c
    WHERE c.enabled = true
    AND c.keywords && search_keywords
    ORDER BY match_score DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION match_capability_by_keywords IS 'Find capabilities by matching keywords, returns scored results';
