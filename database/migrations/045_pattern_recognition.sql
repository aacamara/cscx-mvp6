-- PRD-233: AI Pattern Recognition
-- Migration for behavioral pattern detection and analysis caching

-- Pattern Analysis Cache Table
-- Stores cached pattern analysis results to avoid repeated computation
CREATE TABLE IF NOT EXISTS pattern_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  analysis_data JSONB NOT NULL,
  -- analysis_data structure:
  -- {
  --   customerId: string,
  --   customerName: string,
  --   patterns: [{
  --     id: string,
  --     type: 'communication' | 'engagement' | 'risk' | 'success' | 'meeting' | 'stakeholder' | 'usage',
  --     name: string,
  --     description: string,
  --     severity: 'info' | 'warning' | 'critical' | 'positive',
  --     confidence: 'low' | 'medium' | 'high',
  --     confidenceScore: number,
  --     insight: string,
  --     suggestedAction: string,
  --     detectedAt: timestamp
  --   }],
  --   summary: string,
  --   overallRiskLevel: 'low' | 'medium' | 'high' | 'critical',
  --   topInsights: [string],
  --   recommendedActions: [string],
  --   dataQuality: number
  -- }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  UNIQUE(customer_id)
);

-- Index for cache lookup
CREATE INDEX IF NOT EXISTS idx_pattern_cache_customer ON pattern_analysis_cache(customer_id);
CREATE INDEX IF NOT EXISTS idx_pattern_cache_expires ON pattern_analysis_cache(expires_at);

-- Detected Patterns History Table
-- Stores historical patterns for trend analysis
CREATE TABLE IF NOT EXISTS detected_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  pattern_type VARCHAR(50) NOT NULL,
  pattern_name VARCHAR(255) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'positive')),
  confidence VARCHAR(20) NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  description TEXT,
  insight TEXT,
  suggested_action TEXT,
  data_points JSONB DEFAULT '[]',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(255),
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for pattern queries
CREATE INDEX IF NOT EXISTS idx_patterns_customer ON detected_patterns(customer_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON detected_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_severity ON detected_patterns(severity);
CREATE INDEX IF NOT EXISTS idx_patterns_detected_at ON detected_patterns(detected_at);
CREATE INDEX IF NOT EXISTS idx_patterns_unacknowledged ON detected_patterns(customer_id) WHERE acknowledged_at IS NULL;

-- Pattern Alerts Table
-- Tracks pattern-based alerts requiring attention
CREATE TABLE IF NOT EXISTS pattern_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID REFERENCES detected_patterns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL DEFAULT 'pattern_detected',
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(255),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for alert queries
CREATE INDEX IF NOT EXISTS idx_pattern_alerts_customer ON pattern_alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_pattern_alerts_unacknowledged ON pattern_alerts(acknowledged) WHERE acknowledged = FALSE;
CREATE INDEX IF NOT EXISTS idx_pattern_alerts_triggered ON pattern_alerts(triggered_at);

-- Pattern Recognition Settings Table
-- User/org preferences for pattern detection
CREATE TABLE IF NOT EXISTS pattern_recognition_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),
  org_id VARCHAR(255),

  -- Pattern type toggles
  communication_patterns_enabled BOOLEAN DEFAULT TRUE,
  engagement_patterns_enabled BOOLEAN DEFAULT TRUE,
  risk_patterns_enabled BOOLEAN DEFAULT TRUE,
  success_patterns_enabled BOOLEAN DEFAULT TRUE,
  meeting_patterns_enabled BOOLEAN DEFAULT TRUE,
  stakeholder_patterns_enabled BOOLEAN DEFAULT TRUE,
  usage_patterns_enabled BOOLEAN DEFAULT TRUE,

  -- Alert preferences
  critical_alerts_enabled BOOLEAN DEFAULT TRUE,
  warning_alerts_enabled BOOLEAN DEFAULT TRUE,
  positive_alerts_enabled BOOLEAN DEFAULT FALSE,
  info_alerts_enabled BOOLEAN DEFAULT FALSE,

  -- Analysis preferences
  lookback_days INTEGER DEFAULT 90,
  include_ai_summary BOOLEAN DEFAULT TRUE,
  auto_refresh_hours INTEGER DEFAULT 24,

  -- Notification preferences
  email_notifications BOOLEAN DEFAULT TRUE,
  slack_notifications BOOLEAN DEFAULT FALSE,
  in_app_notifications BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id),
  UNIQUE(org_id)
);

CREATE INDEX IF NOT EXISTS idx_pattern_settings_user ON pattern_recognition_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_pattern_settings_org ON pattern_recognition_settings(org_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_pattern_cache_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at on cache
DROP TRIGGER IF EXISTS update_pattern_cache_timestamp ON pattern_analysis_cache;
CREATE TRIGGER update_pattern_cache_timestamp
  BEFORE UPDATE ON pattern_analysis_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_pattern_cache_timestamp();

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_pattern_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM pattern_analysis_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE pattern_analysis_cache IS 'PRD-233: Caches AI pattern analysis results for performance';
COMMENT ON TABLE detected_patterns IS 'PRD-233: Historical record of detected behavioral patterns';
COMMENT ON TABLE pattern_alerts IS 'PRD-233: Pattern-based alerts requiring CSM attention';
COMMENT ON TABLE pattern_recognition_settings IS 'PRD-233: User and organization settings for pattern detection';
COMMENT ON COLUMN pattern_analysis_cache.analysis_data IS 'JSONB containing full pattern analysis results';
COMMENT ON COLUMN detected_patterns.data_points IS 'JSONB array of data points that contributed to pattern detection';
