-- PRD-171: Benchmark Report
-- Migration: Benchmark caching and percentile tracking

-- Benchmark Cache Table
-- Stores pre-calculated benchmark statistics for performance
CREATE TABLE IF NOT EXISTS benchmark_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric VARCHAR(50) NOT NULL,
    segment VARCHAR(50), -- NULL means portfolio-wide

    -- Benchmark values
    min_value DECIMAL(15, 2) NOT NULL,
    p25_value DECIMAL(15, 2) NOT NULL,
    median_value DECIMAL(15, 2) NOT NULL,
    p75_value DECIMAL(15, 2) NOT NULL,
    max_value DECIMAL(15, 2) NOT NULL,
    mean_value DECIMAL(15, 2) NOT NULL,

    -- Metadata
    sample_size INTEGER NOT NULL DEFAULT 0,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day'),

    -- Distribution data (JSON array of buckets)
    distribution JSONB DEFAULT '[]',

    -- Top/bottom performers
    top_performers JSONB DEFAULT '[]',
    bottom_performers JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on metric + segment combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_benchmark_cache_metric_segment
    ON benchmark_cache(metric, COALESCE(segment, ''));

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_benchmark_cache_expires
    ON benchmark_cache(expires_at);

-- Customer Percentile History
-- Tracks customer percentile rankings over time for trend analysis
CREATE TABLE IF NOT EXISTS customer_percentiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL,

    -- Percentile data
    value DECIMAL(15, 2) NOT NULL,
    percentile INTEGER NOT NULL CHECK (percentile >= 0 AND percentile <= 100),
    benchmark_median DECIMAL(15, 2) NOT NULL,
    gap_to_median DECIMAL(15, 2) GENERATED ALWAYS AS (value - benchmark_median) STORED,

    -- Comparison context
    comparison_scope VARCHAR(20) NOT NULL CHECK (comparison_scope IN ('portfolio', 'segment')),
    segment VARCHAR(50),
    sample_size INTEGER NOT NULL,

    -- Metadata
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for customer percentile queries
CREATE INDEX IF NOT EXISTS idx_customer_percentiles_customer
    ON customer_percentiles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_percentiles_metric
    ON customer_percentiles(metric);
CREATE INDEX IF NOT EXISTS idx_customer_percentiles_calculated
    ON customer_percentiles(calculated_at);
CREATE INDEX IF NOT EXISTS idx_customer_percentiles_customer_metric
    ON customer_percentiles(customer_id, metric, calculated_at DESC);

-- Function to calculate percentile for a value within a dataset
CREATE OR REPLACE FUNCTION calculate_percentile(
    p_value DECIMAL,
    p_metric VARCHAR,
    p_segment VARCHAR DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    total_count INTEGER;
    below_count INTEGER;
    percentile INTEGER;
BEGIN
    -- Get total count in comparison set
    IF p_segment IS NULL THEN
        SELECT COUNT(*) INTO total_count
        FROM customers
        WHERE stage != 'churned';

        SELECT COUNT(*) INTO below_count
        FROM customers
        WHERE stage != 'churned'
        AND CASE p_metric
            WHEN 'health_score' THEN health_score
            WHEN 'arr' THEN arr
            ELSE health_score
        END < p_value;
    ELSE
        SELECT COUNT(*) INTO total_count
        FROM customers
        WHERE stage != 'churned'
        AND segment = p_segment;

        SELECT COUNT(*) INTO below_count
        FROM customers
        WHERE stage != 'churned'
        AND segment = p_segment
        AND CASE p_metric
            WHEN 'health_score' THEN health_score
            WHEN 'arr' THEN arr
            ELSE health_score
        END < p_value;
    END IF;

    -- Calculate percentile
    IF total_count > 0 THEN
        percentile := ROUND((below_count::DECIMAL / total_count) * 100);
    ELSE
        percentile := 50;
    END IF;

    RETURN percentile;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh benchmark cache for a metric
CREATE OR REPLACE FUNCTION refresh_benchmark_cache(
    p_metric VARCHAR,
    p_segment VARCHAR DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    stats RECORD;
    dist JSONB;
    top_perf JSONB;
    bottom_perf JSONB;
    bucket_size DECIMAL;
    min_val DECIMAL;
    max_val DECIMAL;
BEGIN
    -- Calculate statistics
    IF p_segment IS NULL THEN
        SELECT
            MIN(CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as min_v,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as p25_v,
            PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as median_v,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as p75_v,
            MAX(CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as max_v,
            AVG(CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as mean_v,
            COUNT(*) as sample_count
        INTO stats
        FROM customers
        WHERE stage != 'churned';
    ELSE
        SELECT
            MIN(CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as min_v,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as p25_v,
            PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as median_v,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as p75_v,
            MAX(CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as max_v,
            AVG(CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END) as mean_v,
            COUNT(*) as sample_count
        INTO stats
        FROM customers
        WHERE stage != 'churned'
        AND segment = p_segment;
    END IF;

    -- Get top performers
    IF p_segment IS NULL THEN
        SELECT jsonb_agg(row_to_json(t)) INTO top_perf
        FROM (
            SELECT id as customer_id, name as customer_name,
                   CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END as value,
                   segment
            FROM customers
            WHERE stage != 'churned'
            ORDER BY CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END DESC
            LIMIT 5
        ) t;
    ELSE
        SELECT jsonb_agg(row_to_json(t)) INTO top_perf
        FROM (
            SELECT id as customer_id, name as customer_name,
                   CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END as value,
                   segment
            FROM customers
            WHERE stage != 'churned' AND segment = p_segment
            ORDER BY CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END DESC
            LIMIT 5
        ) t;
    END IF;

    -- Get bottom performers
    IF p_segment IS NULL THEN
        SELECT jsonb_agg(row_to_json(t)) INTO bottom_perf
        FROM (
            SELECT id as customer_id, name as customer_name,
                   CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END as value,
                   segment
            FROM customers
            WHERE stage != 'churned'
            ORDER BY CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END ASC
            LIMIT 5
        ) t;
    ELSE
        SELECT jsonb_agg(row_to_json(t)) INTO bottom_perf
        FROM (
            SELECT id as customer_id, name as customer_name,
                   CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END as value,
                   segment
            FROM customers
            WHERE stage != 'churned' AND segment = p_segment
            ORDER BY CASE p_metric WHEN 'health_score' THEN health_score WHEN 'arr' THEN arr ELSE health_score END ASC
            LIMIT 5
        ) t;
    END IF;

    -- Upsert benchmark cache
    INSERT INTO benchmark_cache (
        metric,
        segment,
        min_value,
        p25_value,
        median_value,
        p75_value,
        max_value,
        mean_value,
        sample_size,
        calculated_at,
        expires_at,
        top_performers,
        bottom_performers,
        updated_at
    ) VALUES (
        p_metric,
        p_segment,
        COALESCE(stats.min_v, 0),
        COALESCE(stats.p25_v, 0),
        COALESCE(stats.median_v, 0),
        COALESCE(stats.p75_v, 0),
        COALESCE(stats.max_v, 0),
        COALESCE(stats.mean_v, 0),
        COALESCE(stats.sample_count, 0),
        NOW(),
        NOW() + INTERVAL '1 day',
        COALESCE(top_perf, '[]'::jsonb),
        COALESCE(bottom_perf, '[]'::jsonb),
        NOW()
    )
    ON CONFLICT (metric, COALESCE(segment, ''))
    DO UPDATE SET
        min_value = EXCLUDED.min_value,
        p25_value = EXCLUDED.p25_value,
        median_value = EXCLUDED.median_value,
        p75_value = EXCLUDED.p75_value,
        max_value = EXCLUDED.max_value,
        mean_value = EXCLUDED.mean_value,
        sample_size = EXCLUDED.sample_size,
        calculated_at = NOW(),
        expires_at = NOW() + INTERVAL '1 day',
        top_performers = EXCLUDED.top_performers,
        bottom_performers = EXCLUDED.bottom_performers,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE benchmark_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_percentiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read benchmark cache
CREATE POLICY "Allow read access to benchmark cache" ON benchmark_cache
    FOR SELECT TO authenticated
    USING (true);

-- Allow authenticated users to read customer percentiles
CREATE POLICY "Allow read access to customer percentiles" ON customer_percentiles
    FOR SELECT TO authenticated
    USING (true);

-- Allow service role to write benchmark data
CREATE POLICY "Allow service to write benchmark cache" ON benchmark_cache
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow service to write customer percentiles" ON customer_percentiles
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Comment on tables
COMMENT ON TABLE benchmark_cache IS 'PRD-171: Caches pre-calculated benchmark statistics for performance';
COMMENT ON TABLE customer_percentiles IS 'PRD-171: Tracks customer percentile rankings over time for trend analysis';
COMMENT ON FUNCTION calculate_percentile IS 'PRD-171: Calculates the percentile ranking of a value within the portfolio or segment';
COMMENT ON FUNCTION refresh_benchmark_cache IS 'PRD-171: Refreshes the benchmark cache for a specific metric and optional segment';
