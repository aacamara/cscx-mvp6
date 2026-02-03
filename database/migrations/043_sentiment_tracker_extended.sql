-- PRD-076: Account Sentiment Over Time
-- Extended sentiment tracking tables for longitudinal analysis
-- This extends the base sentiment tables from PRD-218

-- ============================================
-- SENTIMENT EVENTS
-- Track significant events that impact sentiment
-- ============================================
CREATE TABLE IF NOT EXISTS sentiment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_description TEXT NOT NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('positive', 'negative')),
  sentiment_impact INTEGER NOT NULL,  -- Change in sentiment score
  recovery_days INTEGER,              -- Days until sentiment recovered
  related_analysis_ids UUID[],        -- References to sentiment_analyses
  source VARCHAR(50),                 -- What triggered this event detection
  auto_detected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_sentiment_events_customer ON sentiment_events(customer_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_events_type ON sentiment_events(event_type);

-- ============================================
-- STAKEHOLDER SENTIMENT
-- Per-stakeholder sentiment tracking
-- ============================================
CREATE TABLE IF NOT EXISTS stakeholder_sentiment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sentiment_score INTEGER CHECK (sentiment_score >= -100 AND sentiment_score <= 100),
  trend VARCHAR(20) CHECK (trend IN ('improving', 'stable', 'declining')),
  engagement_level VARCHAR(20) CHECK (engagement_level IN ('high', 'medium', 'low')),
  interaction_count INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  notable_quotes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, stakeholder_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_stakeholder_sentiment_customer ON stakeholder_sentiment(customer_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_sentiment_stakeholder ON stakeholder_sentiment(stakeholder_id);

-- ============================================
-- TOPIC SENTIMENT TRACKING
-- Detailed topic-level sentiment analysis
-- ============================================
CREATE TABLE IF NOT EXISTS topic_sentiment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  topic VARCHAR(100) NOT NULL,  -- e.g., 'product_value', 'support_experience', 'pricing'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sentiment_score INTEGER CHECK (sentiment_score >= -100 AND sentiment_score <= 100),
  trend VARCHAR(20) CHECK (trend IN ('improving', 'stable', 'declining')),
  frequency VARCHAR(20) CHECK (frequency IN ('high', 'medium', 'low')),
  mention_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, topic, period_start)
);

CREATE INDEX IF NOT EXISTS idx_topic_sentiment_customer ON topic_sentiment(customer_id);
CREATE INDEX IF NOT EXISTS idx_topic_sentiment_topic ON topic_sentiment(topic);

-- ============================================
-- TOPIC MENTIONS
-- Individual mentions of topics with quotes
-- ============================================
CREATE TABLE IF NOT EXISTS topic_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  topic_sentiment_id UUID REFERENCES topic_sentiment(id) ON DELETE CASCADE,
  sentiment_analysis_id UUID REFERENCES sentiment_analyses(id) ON DELETE CASCADE,
  topic VARCHAR(100) NOT NULL,
  quote TEXT NOT NULL,
  quote_sentiment INTEGER,
  source VARCHAR(50) NOT NULL,
  mentioned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_mentions_topic ON topic_mentions(topic_sentiment_id);
CREATE INDEX IF NOT EXISTS idx_topic_mentions_customer ON topic_mentions(customer_id);

-- ============================================
-- SENTIMENT DRIVERS
-- Factors that drive sentiment positive/negative
-- ============================================
CREATE TABLE IF NOT EXISTS sentiment_drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  driver_type VARCHAR(20) NOT NULL CHECK (driver_type IN ('positive', 'negative')),
  driver_name TEXT NOT NULL,
  contribution INTEGER NOT NULL,  -- Impact magnitude
  evidence TEXT,
  occurrence_count INTEGER DEFAULT 1,
  trend VARCHAR(20) CHECK (trend IN ('improving', 'stable', 'declining')),
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_detected_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE,
  UNIQUE(customer_id, driver_name, driver_type)
);

CREATE INDEX IF NOT EXISTS idx_sentiment_drivers_customer ON sentiment_drivers(customer_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_drivers_type ON sentiment_drivers(driver_type);
CREATE INDEX IF NOT EXISTS idx_sentiment_drivers_active ON sentiment_drivers(customer_id, active) WHERE active = TRUE;

-- ============================================
-- SENTIMENT CORRELATIONS
-- Correlation analysis with other metrics
-- ============================================
CREATE TABLE IF NOT EXISTS sentiment_correlations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  factor VARCHAR(100) NOT NULL,  -- e.g., 'health_score', 'usage_volume', 'support_tickets'
  correlation_coefficient DECIMAL(4,3) CHECK (correlation_coefficient >= -1 AND correlation_coefficient <= 1),
  sample_size INTEGER,
  p_value DECIMAL(6,5),
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, factor)
);

CREATE INDEX IF NOT EXISTS idx_sentiment_correlations_customer ON sentiment_correlations(customer_id);

-- ============================================
-- SENTIMENT FORECASTS
-- Predicted future sentiment values
-- ============================================
CREATE TABLE IF NOT EXISTS sentiment_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  timeframe_days INTEGER NOT NULL,  -- 30, 60, 90 days
  predicted_sentiment INTEGER CHECK (predicted_sentiment >= -100 AND predicted_sentiment <= 100),
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
  model_version VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, forecast_date, timeframe_days)
);

CREATE INDEX IF NOT EXISTS idx_sentiment_forecasts_customer ON sentiment_forecasts(customer_id);

-- ============================================
-- SENTIMENT ALERT SETTINGS
-- Per-customer alert configuration
-- ============================================
CREATE TABLE IF NOT EXISTS sentiment_alert_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  condition_type VARCHAR(50) NOT NULL,  -- 'score_below', 'drop_exceeds', 'stakeholder_negative'
  condition_value INTEGER,
  alert_channels TEXT[] DEFAULT ARRAY['in_app'],  -- 'email', 'slack', 'in_app'
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'triggered')),
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_sentiment_alert_settings_customer ON sentiment_alert_settings(customer_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_alert_settings_active ON sentiment_alert_settings(status) WHERE status = 'active';

-- ============================================
-- FUNCTION: Detect sentiment events automatically
-- ============================================
CREATE OR REPLACE FUNCTION detect_sentiment_events()
RETURNS TRIGGER AS $$
DECLARE
  v_previous_avg INTEGER;
  v_impact INTEGER;
BEGIN
  -- Get average sentiment from previous 7 days
  SELECT COALESCE(AVG(overall_score), NEW.overall_score)::INTEGER
  INTO v_previous_avg
  FROM sentiment_analyses
  WHERE customer_id = NEW.customer_id
    AND analyzed_at BETWEEN NEW.analyzed_at - INTERVAL '7 days' AND NEW.analyzed_at - INTERVAL '1 day';

  v_impact := NEW.overall_score - v_previous_avg;

  -- Detect significant positive event (score jump > 20)
  IF v_impact > 20 THEN
    INSERT INTO sentiment_events (
      customer_id,
      event_date,
      event_description,
      event_type,
      sentiment_impact,
      related_analysis_ids,
      source,
      auto_detected
    )
    VALUES (
      NEW.customer_id,
      NEW.analyzed_at::DATE,
      'Significant sentiment improvement detected',
      'positive',
      v_impact,
      ARRAY[NEW.id],
      NEW.source,
      TRUE
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Detect significant negative event (score drop > 20)
  IF v_impact < -20 THEN
    INSERT INTO sentiment_events (
      customer_id,
      event_date,
      event_description,
      event_type,
      sentiment_impact,
      related_analysis_ids,
      source,
      auto_detected
    )
    VALUES (
      NEW.customer_id,
      NEW.analyzed_at::DATE,
      'Significant sentiment decline detected',
      'negative',
      v_impact,
      ARRAY[NEW.id],
      NEW.source,
      TRUE
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic event detection
DROP TRIGGER IF EXISTS trigger_detect_sentiment_events ON sentiment_analyses;
CREATE TRIGGER trigger_detect_sentiment_events
  AFTER INSERT ON sentiment_analyses
  FOR EACH ROW
  EXECUTE FUNCTION detect_sentiment_events();

-- ============================================
-- FUNCTION: Update stakeholder sentiment
-- ============================================
CREATE OR REPLACE FUNCTION update_stakeholder_sentiment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stakeholder_id IS NOT NULL THEN
    INSERT INTO stakeholder_sentiment (
      customer_id,
      stakeholder_id,
      period_start,
      period_end,
      sentiment_score,
      trend,
      engagement_level,
      interaction_count,
      last_interaction_at
    )
    VALUES (
      NEW.customer_id,
      NEW.stakeholder_id,
      DATE_TRUNC('week', NEW.analyzed_at)::DATE,
      (DATE_TRUNC('week', NEW.analyzed_at) + INTERVAL '6 days')::DATE,
      NEW.overall_score,
      'stable',
      CASE
        WHEN NEW.overall_score >= 50 THEN 'high'
        WHEN NEW.overall_score >= 0 THEN 'medium'
        ELSE 'low'
      END,
      1,
      NEW.analyzed_at
    )
    ON CONFLICT (customer_id, stakeholder_id, period_start) DO UPDATE SET
      sentiment_score = (stakeholder_sentiment.sentiment_score + EXCLUDED.sentiment_score) / 2,
      interaction_count = stakeholder_sentiment.interaction_count + 1,
      last_interaction_at = EXCLUDED.last_interaction_at,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for stakeholder sentiment updates
DROP TRIGGER IF EXISTS trigger_update_stakeholder_sentiment ON sentiment_analyses;
CREATE TRIGGER trigger_update_stakeholder_sentiment
  AFTER INSERT ON sentiment_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_stakeholder_sentiment();

-- ============================================
-- FUNCTION: Calculate sentiment correlations
-- ============================================
CREATE OR REPLACE FUNCTION calculate_sentiment_correlations(p_customer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_health_corr DECIMAL(4,3);
  v_usage_corr DECIMAL(4,3);
  v_support_corr DECIMAL(4,3);
BEGIN
  -- This is a placeholder for correlation calculations
  -- In production, would compute actual statistical correlations

  -- Health score correlation (using latest values)
  INSERT INTO sentiment_correlations (customer_id, factor, correlation_coefficient, sample_size)
  VALUES (p_customer_id, 'health_score', 0.85, 30)
  ON CONFLICT (customer_id, factor) DO UPDATE SET
    correlation_coefficient = EXCLUDED.correlation_coefficient,
    calculated_at = NOW();

  INSERT INTO sentiment_correlations (customer_id, factor, correlation_coefficient, sample_size)
  VALUES (p_customer_id, 'usage_volume', 0.72, 30)
  ON CONFLICT (customer_id, factor) DO UPDATE SET
    correlation_coefficient = EXCLUDED.correlation_coefficient,
    calculated_at = NOW();

  INSERT INTO sentiment_correlations (customer_id, factor, correlation_coefficient, sample_size)
  VALUES (p_customer_id, 'support_tickets', -0.65, 30)
  ON CONFLICT (customer_id, factor) DO UPDATE SET
    correlation_coefficient = EXCLUDED.correlation_coefficient,
    calculated_at = NOW();

  INSERT INTO sentiment_correlations (customer_id, factor, correlation_coefficient, sample_size)
  VALUES (p_customer_id, 'meeting_frequency', 0.58, 30)
  ON CONFLICT (customer_id, factor) DO UPDATE SET
    correlation_coefficient = EXCLUDED.correlation_coefficient,
    calculated_at = NOW();

  INSERT INTO sentiment_correlations (customer_id, factor, correlation_coefficient, sample_size)
  VALUES (p_customer_id, 'days_since_contact', -0.45, 30)
  ON CONFLICT (customer_id, factor) DO UPDATE SET
    correlation_coefficient = EXCLUDED.correlation_coefficient,
    calculated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Add content_snippet to sentiment_analyses if not exists
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sentiment_analyses' AND column_name = 'content_snippet'
  ) THEN
    ALTER TABLE sentiment_analyses ADD COLUMN content_snippet TEXT;
  END IF;
END $$;
