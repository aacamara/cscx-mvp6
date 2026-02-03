-- PRD-231: Customer Health Prediction
-- Migration for health prediction tables

-- ============================================
-- HEALTH PREDICTIONS
-- Stores predicted health scores for tracking
-- ============================================
CREATE TABLE IF NOT EXISTS health_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  current_health INTEGER NOT NULL CHECK (current_health >= 0 AND current_health <= 100),
  prediction_30d INTEGER CHECK (prediction_30d >= 0 AND prediction_30d <= 100),
  prediction_60d INTEGER CHECK (prediction_60d >= 0 AND prediction_60d <= 100),
  prediction_90d INTEGER CHECK (prediction_90d >= 0 AND prediction_90d <= 100),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  drivers JSONB DEFAULT '[]',  -- Array of { factor, direction, magnitude, description }
  interventions JSONB DEFAULT '[]',  -- Array of intervention recommendations
  predicted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_predictions_customer ON health_predictions(customer_id);
CREATE INDEX IF NOT EXISTS idx_predictions_date ON health_predictions(predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_customer_date ON health_predictions(customer_id, predicted_at DESC);

-- ============================================
-- PREDICTION ACCURACY
-- Tracks prediction accuracy over time
-- ============================================
CREATE TABLE IF NOT EXISTS prediction_accuracy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  prediction_date TIMESTAMPTZ NOT NULL,
  days_ahead INTEGER NOT NULL CHECK (days_ahead IN (30, 60, 90)),
  predicted_score INTEGER NOT NULL CHECK (predicted_score >= 0 AND predicted_score <= 100),
  actual_score INTEGER NOT NULL CHECK (actual_score >= 0 AND actual_score <= 100),
  error INTEGER NOT NULL,  -- Absolute difference
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for accuracy analysis
CREATE INDEX IF NOT EXISTS idx_accuracy_customer ON prediction_accuracy(customer_id);
CREATE INDEX IF NOT EXISTS idx_accuracy_days ON prediction_accuracy(days_ahead);
CREATE INDEX IF NOT EXISTS idx_accuracy_date ON prediction_accuracy(prediction_date);

-- ============================================
-- VIEW: Latest Predictions per Customer
-- ============================================
CREATE OR REPLACE VIEW latest_health_predictions AS
SELECT DISTINCT ON (customer_id)
  hp.id,
  hp.customer_id,
  c.name AS customer_name,
  c.arr,
  c.renewal_date,
  hp.current_health,
  hp.prediction_30d,
  hp.prediction_60d,
  hp.prediction_90d,
  hp.confidence,
  hp.drivers,
  hp.interventions,
  hp.predicted_at,
  -- Calculate decline
  COALESCE(hp.prediction_90d - hp.current_health, 0) AS health_change_90d
FROM health_predictions hp
JOIN customers c ON hp.customer_id = c.id
ORDER BY hp.customer_id, hp.predicted_at DESC;

-- ============================================
-- VIEW: Customers with Declining Health
-- ============================================
CREATE OR REPLACE VIEW declining_health_accounts AS
SELECT
  lhp.customer_id,
  lhp.customer_name,
  lhp.arr,
  lhp.current_health,
  lhp.prediction_30d,
  lhp.prediction_90d,
  lhp.health_change_90d AS decline,
  lhp.predicted_at,
  lhp.drivers
FROM latest_health_predictions lhp
WHERE lhp.health_change_90d < -10
ORDER BY lhp.health_change_90d ASC;

-- ============================================
-- VIEW: Prediction Accuracy Summary
-- ============================================
CREATE OR REPLACE VIEW prediction_accuracy_summary AS
SELECT
  days_ahead,
  COUNT(*) AS total_predictions,
  ROUND(AVG(error)::numeric, 2) AS avg_error,
  ROUND((100 - AVG(error))::numeric, 2) AS accuracy_pct,
  MIN(error) AS min_error,
  MAX(error) AS max_error,
  ROUND(STDDEV(error)::numeric, 2) AS error_stddev
FROM prediction_accuracy
GROUP BY days_ahead
ORDER BY days_ahead;

-- ============================================
-- FUNCTION: Get Portfolio Health Forecast
-- ============================================
CREATE OR REPLACE FUNCTION get_portfolio_health_forecast()
RETURNS TABLE (
  current_avg_health NUMERIC,
  predicted_30d_avg NUMERIC,
  predicted_60d_avg NUMERIC,
  predicted_90d_avg NUMERIC,
  current_below_50 BIGINT,
  predicted_30d_below_50 BIGINT,
  predicted_60d_below_50 BIGINT,
  predicted_90d_below_50 BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(AVG(lhp.current_health)::numeric, 1) AS current_avg_health,
    ROUND(AVG(lhp.prediction_30d)::numeric, 1) AS predicted_30d_avg,
    ROUND(AVG(lhp.prediction_60d)::numeric, 1) AS predicted_60d_avg,
    ROUND(AVG(lhp.prediction_90d)::numeric, 1) AS predicted_90d_avg,
    COUNT(*) FILTER (WHERE lhp.current_health < 50) AS current_below_50,
    COUNT(*) FILTER (WHERE lhp.prediction_30d < 50) AS predicted_30d_below_50,
    COUNT(*) FILTER (WHERE lhp.prediction_60d < 50) AS predicted_60d_below_50,
    COUNT(*) FILTER (WHERE lhp.prediction_90d < 50) AS predicted_90d_below_50
  FROM latest_health_predictions lhp;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-update prediction accuracy
-- Runs when health scores change to check past predictions
-- ============================================
CREATE OR REPLACE FUNCTION check_prediction_accuracy()
RETURNS TRIGGER AS $$
DECLARE
  v_prediction RECORD;
BEGIN
  -- Check predictions made 30 days ago
  FOR v_prediction IN
    SELECT id, prediction_30d, predicted_at
    FROM health_predictions
    WHERE customer_id = NEW.id
      AND predicted_at BETWEEN NOW() - INTERVAL '37 days' AND NOW() - INTERVAL '23 days'
      AND NOT EXISTS (
        SELECT 1 FROM prediction_accuracy pa
        WHERE pa.customer_id = NEW.id
          AND pa.prediction_date = health_predictions.predicted_at
          AND pa.days_ahead = 30
      )
  LOOP
    IF v_prediction.prediction_30d IS NOT NULL THEN
      INSERT INTO prediction_accuracy (
        customer_id, prediction_date, days_ahead, predicted_score, actual_score, error
      ) VALUES (
        NEW.id,
        v_prediction.predicted_at,
        30,
        v_prediction.prediction_30d,
        NEW.health_score,
        ABS(NEW.health_score - v_prediction.prediction_30d)
      );
    END IF;
  END LOOP;

  -- Check predictions made 60 days ago
  FOR v_prediction IN
    SELECT id, prediction_60d, predicted_at
    FROM health_predictions
    WHERE customer_id = NEW.id
      AND predicted_at BETWEEN NOW() - INTERVAL '67 days' AND NOW() - INTERVAL '53 days'
      AND NOT EXISTS (
        SELECT 1 FROM prediction_accuracy pa
        WHERE pa.customer_id = NEW.id
          AND pa.prediction_date = health_predictions.predicted_at
          AND pa.days_ahead = 60
      )
  LOOP
    IF v_prediction.prediction_60d IS NOT NULL THEN
      INSERT INTO prediction_accuracy (
        customer_id, prediction_date, days_ahead, predicted_score, actual_score, error
      ) VALUES (
        NEW.id,
        v_prediction.predicted_at,
        60,
        v_prediction.prediction_60d,
        NEW.health_score,
        ABS(NEW.health_score - v_prediction.prediction_60d)
      );
    END IF;
  END LOOP;

  -- Check predictions made 90 days ago
  FOR v_prediction IN
    SELECT id, prediction_90d, predicted_at
    FROM health_predictions
    WHERE customer_id = NEW.id
      AND predicted_at BETWEEN NOW() - INTERVAL '97 days' AND NOW() - INTERVAL '83 days'
      AND NOT EXISTS (
        SELECT 1 FROM prediction_accuracy pa
        WHERE pa.customer_id = NEW.id
          AND pa.prediction_date = health_predictions.predicted_at
          AND pa.days_ahead = 90
      )
  LOOP
    IF v_prediction.prediction_90d IS NOT NULL THEN
      INSERT INTO prediction_accuracy (
        customer_id, prediction_date, days_ahead, predicted_score, actual_score, error
      ) VALUES (
        NEW.id,
        v_prediction.predicted_at,
        90,
        v_prediction.prediction_90d,
        NEW.health_score,
        ABS(NEW.health_score - v_prediction.prediction_90d)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on customers table (if health_score column exists)
DROP TRIGGER IF EXISTS trigger_check_prediction_accuracy ON customers;
CREATE TRIGGER trigger_check_prediction_accuracy
  AFTER UPDATE OF health_score ON customers
  FOR EACH ROW
  WHEN (OLD.health_score IS DISTINCT FROM NEW.health_score)
  EXECUTE FUNCTION check_prediction_accuracy();
