-- Feature Flags Migration
-- Creates the feature_flags table for custom feature flag implementation

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Feature Flags table
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT false,
    rollout_percentage INTEGER DEFAULT 100
        CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    targeting_rules JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flag evaluations audit log (optional - for analytics)
CREATE TABLE IF NOT EXISTS feature_flag_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_key VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    customer_id VARCHAR(100),
    result BOOLEAN NOT NULL,
    context JSONB,
    evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_evaluations_flag_key ON feature_flag_evaluations(flag_key);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluated_at ON feature_flag_evaluations(evaluated_at);
CREATE INDEX IF NOT EXISTS idx_evaluations_customer_id ON feature_flag_evaluations(customer_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial feature flags
INSERT INTO feature_flags (key, name, description, enabled, rollout_percentage) VALUES
    ('enhanced_health_checks', 'Enhanced Health Checks', 'Enable deep connectivity tests for all services', true, 100),
    ('ai_fallback_to_gemini', 'AI Fallback to Gemini', 'Automatically fallback from Claude to Gemini on failure', true, 100),
    ('circuit_breaker_enabled', 'Circuit Breaker Pattern', 'Enable circuit breakers for AI services', true, 100),
    ('preview_deployments', 'Preview Deployments', 'Enable PR preview deployments', true, 100),
    ('structured_logging', 'Structured Logging', 'Enable JSON structured logging for Cloud Logging', true, 100),
    ('new_agent_routing', 'New Agent Routing', 'Use keyword-first routing for AI agents', true, 100)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Cleanup old evaluations (keep last 30 days)
-- This should be run periodically as a maintenance task
-- DELETE FROM feature_flag_evaluations WHERE evaluated_at < NOW() - INTERVAL '30 days';

-- Comments for documentation
COMMENT ON TABLE feature_flags IS 'Stores feature flag definitions for gradual rollouts and feature toggles';
COMMENT ON COLUMN feature_flags.key IS 'Unique identifier used in code to check flag status';
COMMENT ON COLUMN feature_flags.rollout_percentage IS 'Percentage of users/requests that should see this feature (0-100)';
COMMENT ON COLUMN feature_flags.targeting_rules IS 'JSON array of targeting rules for conditional evaluation';
COMMENT ON TABLE feature_flag_evaluations IS 'Audit log of feature flag evaluations for analytics';
