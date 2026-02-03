-- PRD-218: Real-Time Sentiment Analysis
-- Database schema for storing sentiment analyses and alerts

-- ============================================================================
-- Sentiment Analyses Table
-- Stores individual sentiment analysis results for communications
-- ============================================================================

CREATE TABLE IF NOT EXISTS sentiment_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  source VARCHAR(50) NOT NULL CHECK (source IN ('email', 'meeting', 'support', 'slack', 'survey')),
  source_id TEXT,  -- External ID (e.g., email thread ID, ticket ID)
  content_hash TEXT NOT NULL,  -- SHA-256 hash for deduplication
  overall_score INTEGER NOT NULL CHECK (overall_score >= -100 AND overall_score <= 100),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  topic_sentiment JSONB DEFAULT '{}'::jsonb,
  -- Structure: {"product": number|null, "support": number|null, "pricing": number|null, "relationship": number|null}
  emotional_indicators TEXT[] DEFAULT '{}',
  -- Array of detected emotions: ["frustrated", "concerned", "appreciative", etc.]
  key_phrases JSONB DEFAULT '[]'::jsonb,
  -- Array: [{"text": string, "sentiment": "positive"|"negative"|"neutral", "impact": number}]
  risk_indicators TEXT[] DEFAULT '{}',
  -- Array of concerning phrases/keywords detected
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sentiment_customer_date
  ON sentiment_analyses(customer_id, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_sentiment_source
  ON sentiment_analyses(source, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_sentiment_content_hash
  ON sentiment_analyses(content_hash);

CREATE INDEX IF NOT EXISTS idx_sentiment_score
  ON sentiment_analyses(overall_score);

-- Partial index for negative sentiment (frequently queried)
CREATE INDEX IF NOT EXISTS idx_sentiment_negative
  ON sentiment_analyses(customer_id, analyzed_at DESC)
  WHERE overall_score < 0;

-- ============================================================================
-- Sentiment Alerts Table
-- Stores alerts triggered by sentiment analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS sentiment_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sentiment_analysis_id UUID NOT NULL REFERENCES sentiment_analyses(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_sentiment', 'negative_spike', 'trend_decline', 'risk_keywords')),
  alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_customer
  ON sentiment_alerts(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_unacknowledged
  ON sentiment_alerts(customer_id, created_at DESC)
  WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_level
  ON sentiment_alerts(alert_level, created_at DESC);

-- ============================================================================
-- Sentiment Trends View
-- Materialized view for efficient trend calculations
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS sentiment_trends AS
SELECT
  customer_id,
  DATE_TRUNC('week', analyzed_at) AS week_start,
  AVG(overall_score) AS avg_score,
  COUNT(*) AS interaction_count,
  AVG(CASE WHEN overall_score < 0 THEN 1 ELSE 0 END) * 100 AS negative_pct,
  ARRAY_AGG(DISTINCT source) AS sources_analyzed
FROM sentiment_analyses
WHERE analyzed_at >= NOW() - INTERVAL '90 days'
GROUP BY customer_id, DATE_TRUNC('week', analyzed_at);

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_sentiment_trends_pk
  ON sentiment_trends(customer_id, week_start);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to refresh sentiment trends (call periodically)
CREATE OR REPLACE FUNCTION refresh_sentiment_trends()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY sentiment_trends;
END;
$$;

-- Function to calculate rolling sentiment for a customer
CREATE OR REPLACE FUNCTION get_customer_rolling_sentiment(
  p_customer_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  avg_score DECIMAL,
  trend VARCHAR(20),
  interaction_count BIGINT,
  alert_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_avg DECIMAL;
  previous_avg DECIMAL;
BEGIN
  -- Calculate current period average
  SELECT AVG(overall_score) INTO current_avg
  FROM sentiment_analyses
  WHERE customer_id = p_customer_id
    AND analyzed_at >= NOW() - (p_days || ' days')::INTERVAL;

  -- Calculate previous period average
  SELECT AVG(overall_score) INTO previous_avg
  FROM sentiment_analyses
  WHERE customer_id = p_customer_id
    AND analyzed_at >= NOW() - (p_days * 2 || ' days')::INTERVAL
    AND analyzed_at < NOW() - (p_days || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    COALESCE(current_avg, 0)::DECIMAL AS avg_score,
    CASE
      WHEN previous_avg IS NULL THEN 'stable'
      WHEN current_avg > previous_avg + 10 THEN 'improving'
      WHEN current_avg < previous_avg - 10 THEN 'declining'
      ELSE 'stable'
    END::VARCHAR(20) AS trend,
    (SELECT COUNT(*) FROM sentiment_analyses
     WHERE customer_id = p_customer_id
     AND analyzed_at >= NOW() - (p_days || ' days')::INTERVAL) AS interaction_count,
    (SELECT COUNT(*) FROM sentiment_alerts
     WHERE customer_id = p_customer_id
     AND acknowledged_at IS NULL) AS alert_count;
END;
$$;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE sentiment_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for sentiment_analyses
CREATE POLICY sentiment_analyses_select_policy ON sentiment_analyses
  FOR SELECT
  USING (true);  -- All authenticated users can view

CREATE POLICY sentiment_analyses_insert_policy ON sentiment_analyses
  FOR INSERT
  WITH CHECK (true);  -- Service role can insert

CREATE POLICY sentiment_analyses_update_policy ON sentiment_analyses
  FOR UPDATE
  USING (true);  -- Service role can update

-- Policies for sentiment_alerts
CREATE POLICY sentiment_alerts_select_policy ON sentiment_alerts
  FOR SELECT
  USING (true);  -- All authenticated users can view

CREATE POLICY sentiment_alerts_insert_policy ON sentiment_alerts
  FOR INSERT
  WITH CHECK (true);  -- Service role can insert

CREATE POLICY sentiment_alerts_update_policy ON sentiment_alerts
  FOR UPDATE
  USING (true);  -- Service role can update (for acknowledgment)

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE sentiment_analyses IS 'Stores sentiment analysis results for customer communications (PRD-218)';
COMMENT ON TABLE sentiment_alerts IS 'Stores alerts triggered by negative sentiment or risk indicators (PRD-218)';
COMMENT ON MATERIALIZED VIEW sentiment_trends IS 'Weekly aggregated sentiment trends for efficient dashboard queries';
COMMENT ON FUNCTION refresh_sentiment_trends() IS 'Refreshes the sentiment_trends materialized view';
COMMENT ON FUNCTION get_customer_rolling_sentiment(UUID, INTEGER) IS 'Returns rolling sentiment metrics for a customer';
