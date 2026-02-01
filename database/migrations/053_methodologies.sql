-- PRD: Knowledge Base Population & CSM Capability Index
-- Migration to create methodologies table for playbooks

-- Create methodologies table
CREATE TABLE IF NOT EXISTS methodologies (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,

    -- Which capabilities this applies to
    applicable_to TEXT[] NOT NULL DEFAULT '{}',

    -- The actual playbook
    steps JSONB NOT NULL DEFAULT '[]',

    -- Quality standards
    quality_criteria JSONB DEFAULT '[]',
    common_mistakes JSONB DEFAULT '[]',

    -- Templates and examples
    templates JSONB DEFAULT '[]',
    examples JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GIN index on applicable_to array for finding methodologies by capability
CREATE INDEX IF NOT EXISTS idx_methodologies_applicable ON methodologies USING GIN(applicable_to);

-- Index on category for filtering
CREATE INDEX IF NOT EXISTS idx_methodologies_category ON methodologies(category);

-- Full-text search on name
CREATE INDEX IF NOT EXISTS idx_methodologies_name_search ON methodologies
    USING GIN(to_tsvector('english', name));

-- Comments
COMMENT ON TABLE methodologies IS 'Stores methodologies/playbooks for executing capabilities';
COMMENT ON COLUMN methodologies.id IS 'Unique identifier for the methodology (e.g., qbr_methodology)';
COMMENT ON COLUMN methodologies.category IS 'Category matching capability categories';
COMMENT ON COLUMN methodologies.applicable_to IS 'Array of capability IDs this methodology applies to';
COMMENT ON COLUMN methodologies.steps IS 'Array of steps: [{order, name, description, actions, dataNeeded, tips}]';
COMMENT ON COLUMN methodologies.quality_criteria IS 'Array of quality criteria to meet';
COMMENT ON COLUMN methodologies.common_mistakes IS 'Array of common mistakes to avoid';
COMMENT ON COLUMN methodologies.templates IS 'Array of templates: [{name, format, content}]';
COMMENT ON COLUMN methodologies.examples IS 'Array of examples: [{scenario, input, output}]';

-- Enable RLS
ALTER TABLE methodologies ENABLE ROW LEVEL SECURITY;

-- RLS policies - all authenticated users can read
CREATE POLICY "All users can view methodologies" ON methodologies
    FOR SELECT
    USING (auth.role() IN ('authenticated', 'service_role'));

-- Only service role can modify
CREATE POLICY "Service role can manage methodologies" ON methodologies
    FOR ALL
    USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON methodologies TO authenticated;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_methodologies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_methodologies_updated_at
    BEFORE UPDATE ON methodologies
    FOR EACH ROW
    EXECUTE FUNCTION update_methodologies_updated_at();

-- Create function to get methodology for a capability
CREATE OR REPLACE FUNCTION get_methodology_for_capability(capability_id VARCHAR(100))
RETURNS TABLE(
    methodology_id VARCHAR(100),
    methodology_name VARCHAR(255),
    steps JSONB,
    quality_criteria JSONB,
    templates JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id as methodology_id,
        m.name as methodology_name,
        m.steps,
        m.quality_criteria,
        m.templates
    FROM methodologies m
    WHERE capability_id = ANY(m.applicable_to)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_methodology_for_capability IS 'Get the methodology for a specific capability';

-- Create view for methodology overview
CREATE OR REPLACE VIEW methodology_overview AS
SELECT
    m.id,
    m.name,
    m.category,
    array_length(m.applicable_to, 1) as capability_count,
    jsonb_array_length(m.steps) as step_count,
    jsonb_array_length(m.templates) as template_count,
    m.updated_at
FROM methodologies m
ORDER BY m.category, m.name;

COMMENT ON VIEW methodology_overview IS 'Overview of all methodologies with counts';

GRANT SELECT ON methodology_overview TO authenticated;
