-- PRD-103: Expansion Signal Detected
-- Migration: Expansion Opportunities Table
-- Creates tables for tracking expansion signals and opportunities

-- ============================================
-- Expansion Opportunities Table
-- ============================================

CREATE TABLE IF NOT EXISTS expansion_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Opportunity Details
    opportunity_type VARCHAR(50) NOT NULL CHECK (opportunity_type IN ('upsell', 'seat_expansion', 'feature_upsell', 'land_and_expand', 'cross_sell')),
    product_line TEXT,
    estimated_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
    probability INTEGER NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),

    -- Stage Management
    stage VARCHAR(50) NOT NULL DEFAULT 'detected' CHECK (stage IN ('detected', 'qualified', 'proposed', 'negotiating', 'closed_won', 'closed_lost')),
    timeline VARCHAR(50) CHECK (timeline IN ('immediate', 'this_quarter', 'next_quarter', 'next_year')),

    -- Context
    champion_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    use_case TEXT,
    competitive_threat TEXT,
    blockers JSONB DEFAULT '[]'::jsonb,
    next_steps TEXT,

    -- Signal Data (JSONB for flexibility)
    signal_data JSONB NOT NULL DEFAULT '{
        "signals": [],
        "compositeScore": 0,
        "suggestedProducts": [],
        "recommendedApproach": ""
    }'::jsonb,

    -- Sales Coordination (FR-3.1, FR-3.2)
    sales_rep_id UUID,
    sales_notified_at TIMESTAMPTZ,
    crm_opportunity_id VARCHAR(100),

    -- Timestamps
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    qualified_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_customer_id ON expansion_opportunities(customer_id);
CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_stage ON expansion_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_opportunity_type ON expansion_opportunities(opportunity_type);
CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_probability ON expansion_opportunities(probability DESC);
CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_estimated_value ON expansion_opportunities(estimated_value DESC);
CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_sales_rep ON expansion_opportunities(sales_rep_id) WHERE sales_rep_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_crm_id ON expansion_opportunities(crm_opportunity_id) WHERE crm_opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_detected_at ON expansion_opportunities(detected_at DESC);

-- GIN index for signal_data JSON queries
CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_signal_data ON expansion_opportunities USING GIN (signal_data);

-- ============================================
-- Expansion Signal Log Table
-- Track individual signal detections over time
-- ============================================

CREATE TABLE IF NOT EXISTS expansion_signal_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES expansion_opportunities(id) ON DELETE SET NULL,

    -- Signal Details
    signal_type VARCHAR(50) NOT NULL CHECK (signal_type IN (
        'usage_limit_approaching',
        'seat_overage',
        'feature_interest',
        'expansion_mention',
        'new_team_onboarding',
        'api_usage_growth',
        'competitor_displacement'
    )),
    signal_strength DECIMAL(3, 2) NOT NULL CHECK (signal_strength >= 0 AND signal_strength <= 1),
    description TEXT NOT NULL,
    source VARCHAR(50), -- usage_data, meeting_transcript, email, etc.
    quote TEXT, -- Direct quote if applicable

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for signal log
CREATE INDEX IF NOT EXISTS idx_expansion_signal_log_customer_id ON expansion_signal_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_expansion_signal_log_opportunity_id ON expansion_signal_log(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_expansion_signal_log_signal_type ON expansion_signal_log(signal_type);
CREATE INDEX IF NOT EXISTS idx_expansion_signal_log_detected_at ON expansion_signal_log(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_expansion_signal_log_strength ON expansion_signal_log(signal_strength DESC);

-- ============================================
-- Expansion Workflow Runs Table
-- Track scheduled and manual scan runs
-- ============================================

CREATE TABLE IF NOT EXISTS expansion_scan_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Run Details
    run_type VARCHAR(20) NOT NULL CHECK (run_type IN ('scheduled', 'manual')),
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),

    -- Results
    customers_scanned INTEGER DEFAULT 0,
    signals_detected INTEGER DEFAULT 0,
    opportunities_created INTEGER DEFAULT 0,
    opportunities_updated INTEGER DEFAULT 0,
    alerts_sent INTEGER DEFAULT 0,

    -- Configuration
    min_score_threshold DECIMAL(3, 2) DEFAULT 0.6,

    -- Error tracking
    error_message TEXT,

    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for scan runs
CREATE INDEX IF NOT EXISTS idx_expansion_scan_runs_status ON expansion_scan_runs(status);
CREATE INDEX IF NOT EXISTS idx_expansion_scan_runs_started_at ON expansion_scan_runs(started_at DESC);

-- ============================================
-- Functions and Triggers
-- ============================================

-- Update timestamp trigger for expansion_opportunities
CREATE OR REPLACE FUNCTION update_expansion_opportunity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_expansion_opportunity_updated ON expansion_opportunities;
CREATE TRIGGER trigger_expansion_opportunity_updated
    BEFORE UPDATE ON expansion_opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_expansion_opportunity_timestamp();

-- Function to get expansion summary for a customer
CREATE OR REPLACE FUNCTION get_customer_expansion_summary(p_customer_id UUID)
RETURNS TABLE (
    active_opportunities INTEGER,
    total_estimated_value DECIMAL(12, 2),
    highest_probability INTEGER,
    latest_signal_type VARCHAR(50),
    latest_signal_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT eo.id)::INTEGER as active_opportunities,
        COALESCE(SUM(eo.estimated_value), 0) as total_estimated_value,
        COALESCE(MAX(eo.probability), 0)::INTEGER as highest_probability,
        (SELECT esl.signal_type FROM expansion_signal_log esl
         WHERE esl.customer_id = p_customer_id
         ORDER BY esl.detected_at DESC LIMIT 1) as latest_signal_type,
        (SELECT esl.detected_at FROM expansion_signal_log esl
         WHERE esl.customer_id = p_customer_id
         ORDER BY esl.detected_at DESC LIMIT 1) as latest_signal_date
    FROM expansion_opportunities eo
    WHERE eo.customer_id = p_customer_id
      AND eo.stage NOT IN ('closed_won', 'closed_lost');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Views
-- ============================================

-- Active expansion pipeline view
CREATE OR REPLACE VIEW v_expansion_pipeline AS
SELECT
    eo.id,
    eo.customer_id,
    c.name as customer_name,
    c.arr as current_arr,
    c.health_score,
    eo.opportunity_type,
    eo.product_line,
    eo.estimated_value,
    eo.probability,
    eo.stage,
    eo.timeline,
    eo.signal_data->>'compositeScore' as composite_score,
    jsonb_array_length(eo.signal_data->'signals') as signal_count,
    eo.sales_rep_id,
    eo.detected_at,
    eo.qualified_at,
    eo.created_at,
    eo.updated_at
FROM expansion_opportunities eo
JOIN customers c ON c.id = eo.customer_id
WHERE eo.stage NOT IN ('closed_won', 'closed_lost')
ORDER BY eo.probability DESC, eo.estimated_value DESC;

-- Expansion metrics view
CREATE OR REPLACE VIEW v_expansion_metrics AS
SELECT
    stage,
    opportunity_type,
    COUNT(*) as opportunity_count,
    SUM(estimated_value) as total_estimated_value,
    AVG(probability) as avg_probability,
    AVG(EXTRACT(EPOCH FROM (COALESCE(qualified_at, NOW()) - detected_at)) / 86400) as avg_days_to_qualify
FROM expansion_opportunities
GROUP BY stage, opportunity_type
ORDER BY stage, opportunity_type;

-- Recent signals view (last 30 days)
CREATE OR REPLACE VIEW v_recent_expansion_signals AS
SELECT
    esl.id,
    esl.customer_id,
    c.name as customer_name,
    esl.signal_type,
    esl.signal_strength,
    esl.description,
    esl.source,
    esl.detected_at,
    eo.id as opportunity_id,
    eo.stage as opportunity_stage
FROM expansion_signal_log esl
JOIN customers c ON c.id = esl.customer_id
LEFT JOIN expansion_opportunities eo ON eo.id = esl.opportunity_id
WHERE esl.detected_at >= NOW() - INTERVAL '30 days'
ORDER BY esl.detected_at DESC;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE expansion_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_signal_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_scan_runs ENABLE ROW LEVEL SECURITY;

-- Policies for expansion_opportunities
CREATE POLICY "Users can view expansion opportunities" ON expansion_opportunities
    FOR SELECT USING (true);

CREATE POLICY "Users can insert expansion opportunities" ON expansion_opportunities
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update expansion opportunities" ON expansion_opportunities
    FOR UPDATE USING (true);

-- Policies for expansion_signal_log
CREATE POLICY "Users can view expansion signal log" ON expansion_signal_log
    FOR SELECT USING (true);

CREATE POLICY "Users can insert expansion signal log" ON expansion_signal_log
    FOR INSERT WITH CHECK (true);

-- Policies for expansion_scan_runs
CREATE POLICY "Users can view expansion scan runs" ON expansion_scan_runs
    FOR SELECT USING (true);

CREATE POLICY "Users can insert expansion scan runs" ON expansion_scan_runs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update expansion scan runs" ON expansion_scan_runs
    FOR UPDATE USING (true);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE expansion_opportunities IS 'PRD-103: Tracks expansion opportunities detected from customer signals';
COMMENT ON TABLE expansion_signal_log IS 'PRD-103: Historical log of individual expansion signals detected';
COMMENT ON TABLE expansion_scan_runs IS 'PRD-103: Tracks scheduled and manual expansion signal scan runs';
COMMENT ON VIEW v_expansion_pipeline IS 'Active expansion opportunities with customer context';
COMMENT ON VIEW v_expansion_metrics IS 'Aggregated expansion metrics by stage and type';
COMMENT ON VIEW v_recent_expansion_signals IS 'Recent expansion signals from last 30 days';
