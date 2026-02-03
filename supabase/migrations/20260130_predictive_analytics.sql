-- PRD-176: Predictive Analytics Report
-- Database schema for storing predictions and tracking model performance

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  prediction_type VARCHAR(20) NOT NULL CHECK (prediction_type IN ('churn', 'expansion', 'health', 'behavior')),
  horizon_days INTEGER NOT NULL DEFAULT 90,
  predicted_value NUMERIC(5,2) NOT NULL CHECK (predicted_value >= 0 AND predicted_value <= 100),
  confidence NUMERIC(5,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  range_low NUMERIC(5,2) NOT NULL,
  range_high NUMERIC(5,2) NOT NULL,
  factors JSONB DEFAULT '[]'::JSONB,
  recommendations TEXT[] DEFAULT ARRAY[]::TEXT[],
  actual_outcome BOOLEAN, -- NULL until outcome is known, TRUE if prediction was correct
  outcome_date TIMESTAMPTZ, -- When the actual outcome was recorded
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one active prediction per customer per type
  UNIQUE(customer_id, prediction_type)
);

-- Prediction history table (stores historical predictions for accuracy tracking)
CREATE TABLE IF NOT EXISTS prediction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  prediction_type VARCHAR(20) NOT NULL CHECK (prediction_type IN ('churn', 'expansion', 'health', 'behavior')),
  horizon_days INTEGER NOT NULL DEFAULT 90,
  predicted_value NUMERIC(5,2) NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  range_low NUMERIC(5,2) NOT NULL,
  range_high NUMERIC(5,2) NOT NULL,
  factors JSONB DEFAULT '[]'::JSONB,
  actual_outcome BOOLEAN,
  outcome_date TIMESTAMPTZ,
  prediction_date TIMESTAMPTZ NOT NULL,
  evaluation_date TIMESTAMPTZ, -- When the prediction period ended
  was_accurate BOOLEAN, -- Whether the prediction was accurate
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model performance metrics table
CREATE TABLE IF NOT EXISTS model_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type VARCHAR(20) NOT NULL CHECK (model_type IN ('churn', 'expansion', 'health', 'behavior')),
  model_version VARCHAR(50) NOT NULL,
  evaluation_period_start DATE NOT NULL,
  evaluation_period_end DATE NOT NULL,
  total_predictions INTEGER NOT NULL DEFAULT 0,
  correct_predictions INTEGER NOT NULL DEFAULT 0,
  accuracy NUMERIC(5,4) NOT NULL CHECK (accuracy >= 0 AND accuracy <= 1),
  precision_score NUMERIC(5,4) CHECK (precision_score >= 0 AND precision_score <= 1),
  recall_score NUMERIC(5,4) CHECK (recall_score >= 0 AND recall_score <= 1),
  f1_score NUMERIC(5,4) CHECK (f1_score >= 0 AND f1_score <= 1),
  auc_roc NUMERIC(5,4) CHECK (auc_roc >= 0 AND auc_roc <= 1),
  training_samples INTEGER,
  validation_samples INTEGER,
  feature_importance JSONB DEFAULT '[]'::JSONB,
  hyperparameters JSONB DEFAULT '{}'::JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one record per model version per evaluation period
  UNIQUE(model_type, model_version, evaluation_period_start, evaluation_period_end)
);

-- Prediction factors reference table (stores factor definitions)
CREATE TABLE IF NOT EXISTS prediction_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_type VARCHAR(20) NOT NULL CHECK (prediction_type IN ('churn', 'expansion', 'health', 'behavior')),
  factor_key VARCHAR(50) NOT NULL,
  factor_name VARCHAR(100) NOT NULL,
  description TEXT,
  default_weight NUMERIC(5,4) NOT NULL DEFAULT 0.1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(prediction_type, factor_key)
);

-- Insert default churn prediction factors
INSERT INTO prediction_factors (prediction_type, factor_key, factor_name, description, default_weight)
VALUES
  ('churn', 'usage_decline', 'Usage Decline', 'Product usage trend over time', 0.25),
  ('churn', 'support_tickets', 'Support Tickets', 'Support ticket frequency and severity', 0.15),
  ('churn', 'nps_score', 'NPS Score', 'Net Promoter Score and satisfaction', 0.20),
  ('churn', 'engagement_score', 'Engagement Score', 'Customer engagement level', 0.15),
  ('churn', 'champion_status', 'Champion Status', 'Champion/sponsor stability', 0.10),
  ('churn', 'renewal_proximity', 'Renewal Proximity', 'Days until renewal', 0.10),
  ('churn', 'contract_value_trend', 'Contract Value Trend', 'ARR changes over time', 0.05)
ON CONFLICT (prediction_type, factor_key) DO NOTHING;

-- Insert default expansion prediction factors
INSERT INTO prediction_factors (prediction_type, factor_key, factor_name, description, default_weight)
VALUES
  ('expansion', 'usage_growth', 'Usage Growth', 'Usage growth trajectory', 0.25),
  ('expansion', 'feature_adoption', 'Feature Adoption', 'New feature adoption rate', 0.20),
  ('expansion', 'seat_utilization', 'Seat Utilization', 'License utilization rate', 0.15),
  ('expansion', 'engagement_increase', 'Engagement Increase', 'Engagement trend', 0.15),
  ('expansion', 'request_signals', 'Request Signals', 'Feature/upgrade requests', 0.15),
  ('expansion', 'business_growth', 'Business Growth', 'Customer company growth signals', 0.10)
ON CONFLICT (prediction_type, factor_key) DO NOTHING;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_predictions_customer ON predictions(customer_id);
CREATE INDEX IF NOT EXISTS idx_predictions_type ON predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_predictions_value ON predictions(predicted_value DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prediction_history_customer ON prediction_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_prediction_history_type ON prediction_history(prediction_type);
CREATE INDEX IF NOT EXISTS idx_prediction_history_date ON prediction_history(prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_history_evaluation ON prediction_history(evaluation_date);

CREATE INDEX IF NOT EXISTS idx_model_performance_type ON model_performance(model_type);
CREATE INDEX IF NOT EXISTS idx_model_performance_period ON model_performance(evaluation_period_start, evaluation_period_end);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_prediction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_predictions_updated_at ON predictions;
CREATE TRIGGER update_predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_prediction_updated_at();

DROP TRIGGER IF EXISTS update_prediction_factors_updated_at ON prediction_factors;
CREATE TRIGGER update_prediction_factors_updated_at
  BEFORE UPDATE ON prediction_factors
  FOR EACH ROW
  EXECUTE FUNCTION update_prediction_updated_at();

-- Function to archive prediction to history before update
CREATE OR REPLACE FUNCTION archive_prediction_to_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only archive if predicted_value is changing (new prediction)
  IF OLD.predicted_value != NEW.predicted_value OR OLD.confidence != NEW.confidence THEN
    INSERT INTO prediction_history (
      customer_id,
      prediction_type,
      horizon_days,
      predicted_value,
      confidence,
      range_low,
      range_high,
      factors,
      actual_outcome,
      outcome_date,
      prediction_date
    ) VALUES (
      OLD.customer_id,
      OLD.prediction_type,
      OLD.horizon_days,
      OLD.predicted_value,
      OLD.confidence,
      OLD.range_low,
      OLD.range_high,
      OLD.factors,
      OLD.actual_outcome,
      OLD.outcome_date,
      OLD.created_at
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS archive_prediction_on_update ON predictions;
CREATE TRIGGER archive_prediction_on_update
  BEFORE UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION archive_prediction_to_history();

-- Row Level Security (RLS) policies
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_factors ENABLE ROW LEVEL SECURITY;

-- Policies for predictions (users see predictions for their customers)
CREATE POLICY "Users can view predictions for their customers"
  ON predictions FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()::TEXT
    )
  );

CREATE POLICY "Service role has full access to predictions"
  ON predictions FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for prediction history
CREATE POLICY "Users can view prediction history for their customers"
  ON prediction_history FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()::TEXT
    )
  );

CREATE POLICY "Service role has full access to prediction history"
  ON prediction_history FOR ALL
  USING (auth.role() = 'service_role');

-- Model performance is readable by all authenticated users
CREATE POLICY "Authenticated users can view model performance"
  ON model_performance FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role has full access to model performance"
  ON model_performance FOR ALL
  USING (auth.role() = 'service_role');

-- Prediction factors are readable by all authenticated users
CREATE POLICY "Authenticated users can view prediction factors"
  ON prediction_factors FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role has full access to prediction factors"
  ON prediction_factors FOR ALL
  USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE predictions IS 'Stores current ML predictions for customer outcomes (PRD-176)';
COMMENT ON TABLE prediction_history IS 'Archives historical predictions for accuracy tracking (PRD-176)';
COMMENT ON TABLE model_performance IS 'Tracks ML model performance metrics over time (PRD-176)';
COMMENT ON TABLE prediction_factors IS 'Reference table for prediction factor definitions and weights (PRD-176)';

COMMENT ON COLUMN predictions.predicted_value IS 'Probability score 0-100 for the predicted outcome';
COMMENT ON COLUMN predictions.confidence IS 'Model confidence level 0-100 for this prediction';
COMMENT ON COLUMN predictions.actual_outcome IS 'TRUE if prediction was correct, NULL until outcome is known';
COMMENT ON COLUMN prediction_history.was_accurate IS 'Whether the prediction was accurate when evaluated';
