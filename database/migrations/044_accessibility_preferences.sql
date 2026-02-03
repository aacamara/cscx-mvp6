-- PRD-273: High Contrast Mode - Accessibility Preferences Migration
-- Add accessibility preferences to users table and create user_preferences table

-- Add accessibility_preferences column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS accessibility_preferences JSONB DEFAULT '{}';

-- Create user_preferences table for additional preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    accessibility_preferences JSONB DEFAULT '{
        "contrastMode": "normal",
        "reducedMotion": false,
        "fontSize": "normal",
        "screenReaderOptimized": false,
        "focusIndicatorEnhanced": false
    }',
    notification_preferences JSONB DEFAULT '{}',
    display_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id
ON user_preferences(user_id);

-- Enable RLS on user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see/modify their own preferences
CREATE POLICY user_preferences_select_own ON user_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY user_preferences_insert_own ON user_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_preferences_update_own ON user_preferences
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY user_preferences_delete_own ON user_preferences
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function on update
DROP TRIGGER IF EXISTS user_preferences_updated_at ON user_preferences;
CREATE TRIGGER user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_updated_at();

-- Comment on table
COMMENT ON TABLE user_preferences IS 'PRD-273: Stores user preferences including accessibility settings';
COMMENT ON COLUMN user_preferences.accessibility_preferences IS 'Accessibility settings: contrastMode, reducedMotion, fontSize, screenReaderOptimized, focusIndicatorEnhanced';
