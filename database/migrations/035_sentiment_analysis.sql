-- PRD-218: Real-Time Sentiment Analysis Engine
-- Migration for sentiment analysis tables

-- ============================================
-- SENTIMENT ANALYSES
-- ============================================
CREATE TABLE IF NOT EXISTS sentiment_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id),
  source VARCHAR(50) NOT NULL,  -- 'email', 'meeting', 'support', 'slack', 'survey'
  source_id TEXT,               -- e.g., email thread ID, meeting ID
  content_hash TEXT,            -- For deduplication
  overall_score INTEGER NOT NULL CHECK (overall_score >= -100 AND overall_score <= 100),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  topic_sentiment JSONB DEFAULT '{}',  -- { product: -45, support: -30, pricing: null, relationship: -10 }
  emotional_indicators TEXT[] DEFAULT '{}',
  key_phrases JSONB DEFAULT '[]',  -- Array of { text, sentiment, impact }
  risk_indicators TEXT[] DEFAULT '{}',
  content_snippet TEXT,  -- First 200 chars of analyzed content (for display)
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sentiment_customer_date ON sentiment_analyses(customer_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_source ON sentiment_analyses(source, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_score ON sentiment_analyses(overall_score);
CREATE INDEX IF NOT EXISTS idx_sentiment_content_hash ON sentiment_analyses(content_hash);

-- ============================================
-- SENTIMENT ALERTS
-- ============================================
CREATE TABLE IF NOT EXISTS sentiment_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  sentiment_analysis_id UUID REFERENCES sentiment_analyses(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,  -- 'score_drop', 'negative_spike', 'keyword_detected', 'trend_decline'
  alert_level VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',  -- Additional context (e.g., keywords detected, score change)
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_customer ON sentiment_alerts(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_unacknowledged ON sentiment_alerts(customer_id, acknowledged_at) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_level ON sentiment_alerts(alert_level);

-- ============================================
-- SENTIMENT AGGREGATES (Materialized for performance)
-- ============================================
CREATE TABLE IF NOT EXISTS sentiment_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  current_score INTEGER,
  trend VARCHAR(20),  -- 'improving', 'stable', 'declining'
  change_7d INTEGER,
  change_30d INTEGER,
  topic_breakdown JSONB DEFAULT '{}',  -- { product: 55, support: 25, pricing: 60, relationship: 50 }
  last_analysis_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_aggregates_customer ON sentiment_aggregates(customer_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_aggregates_score ON sentiment_aggregates(current_score);

-- ============================================
-- FUNCTION: Update sentiment aggregates
-- ============================================
CREATE OR REPLACE FUNCTION update_sentiment_aggregate()
RETURNS TRIGGER AS $$
DECLARE
  v_current_score INTEGER;
  v_7d_ago_score INTEGER;
  v_30d_ago_score INTEGER;
  v_trend VARCHAR(20);
  v_topic_product NUMERIC;
  v_topic_support NUMERIC;
  v_topic_pricing NUMERIC;
  v_topic_relationship NUMERIC;
BEGIN
  -- Calculate current score (weighted average of last 10 analyses)
  SELECT COALESCE(AVG(overall_score), 0)::INTEGER
  INTO v_current_score
  FROM (
    SELECT overall_score
    FROM sentiment_analyses
    WHERE customer_id = NEW.customer_id
    ORDER BY analyzed_at DESC
    LIMIT 10
  ) recent;

  -- Get 7-day ago score
  SELECT COALESCE(AVG(overall_score), v_current_score)::INTEGER
  INTO v_7d_ago_score
  FROM sentiment_analyses
  WHERE customer_id = NEW.customer_id
    AND analyzed_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days';

  -- Get 30-day ago score
  SELECT COALESCE(AVG(overall_score), v_current_score)::INTEGER
  INTO v_30d_ago_score
  FROM sentiment_analyses
  WHERE customer_id = NEW.customer_id
    AND analyzed_at BETWEEN NOW() - INTERVAL '37 days' AND NOW() - INTERVAL '30 days';

  -- Determine trend
  IF v_current_score > v_7d_ago_score + 5 THEN
    v_trend := 'improving';
  ELSIF v_current_score < v_7d_ago_score - 5 THEN
    v_trend := 'declining';
  ELSE
    v_trend := 'stable';
  END IF;

  -- Calculate topic averages
  SELECT
    COALESCE(AVG((topic_sentiment->>'product')::NUMERIC), 0),
    COALESCE(AVG((topic_sentiment->>'support')::NUMERIC), 0),
    COALESCE(AVG((topic_sentiment->>'pricing')::NUMERIC), 0),
    COALESCE(AVG((topic_sentiment->>'relationship')::NUMERIC), 0)
  INTO v_topic_product, v_topic_support, v_topic_pricing, v_topic_relationship
  FROM sentiment_analyses
  WHERE customer_id = NEW.customer_id
    AND analyzed_at > NOW() - INTERVAL '30 days';

  -- Upsert aggregate
  INSERT INTO sentiment_aggregates (
    customer_id,
    current_score,
    trend,
    change_7d,
    change_30d,
    topic_breakdown,
    last_analysis_at
  )
  VALUES (
    NEW.customer_id,
    v_current_score,
    v_trend,
    v_current_score - v_7d_ago_score,
    v_current_score - v_30d_ago_score,
    jsonb_build_object(
      'product', ROUND(v_topic_product),
      'support', ROUND(v_topic_support),
      'pricing', ROUND(v_topic_pricing),
      'relationship', ROUND(v_topic_relationship)
    ),
    NEW.analyzed_at
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    current_score = EXCLUDED.current_score,
    trend = EXCLUDED.trend,
    change_7d = EXCLUDED.change_7d,
    change_30d = EXCLUDED.change_30d,
    topic_breakdown = EXCLUDED.topic_breakdown,
    last_analysis_at = EXCLUDED.last_analysis_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update aggregates on new analysis
DROP TRIGGER IF EXISTS trigger_update_sentiment_aggregate ON sentiment_analyses;
CREATE TRIGGER trigger_update_sentiment_aggregate
  AFTER INSERT ON sentiment_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_sentiment_aggregate();
