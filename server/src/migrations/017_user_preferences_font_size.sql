-- Migration: User Preferences - Font Size Customization
-- PRD-274: Font Size Customization
--
-- Adds user_preferences table for storing font size and other accessibility preferences

-- Create user_preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Font size preferences (PRD-274)
  font_size VARCHAR(20) DEFAULT 'normal' CHECK (font_size IN ('small', 'normal', 'large', 'xlarge', 'xxlarge')),
  font_scale DECIMAL(3, 3) DEFAULT 1.000 CHECK (font_scale >= 0.75 AND font_scale <= 2.0),
  respect_os_preference BOOLEAN DEFAULT true,

  -- Additional accessibility preferences can be added here
  high_contrast_mode BOOLEAN DEFAULT false,
  reduced_motion BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one preferences record per user
  UNIQUE(user_id)
);

-- Create index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Add RLS policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only read their own preferences
CREATE POLICY "Users can read own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can manage all preferences
CREATE POLICY "Service role full access"
  ON user_preferences FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trigger_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- Add accessibility_preferences column to users table if it doesn't exist
-- This is a fallback/alternative storage method using JSONB
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'accessibility_preferences'
  ) THEN
    ALTER TABLE users ADD COLUMN accessibility_preferences JSONB DEFAULT '{}';
    COMMENT ON COLUMN users.accessibility_preferences IS 'JSONB storage for accessibility settings including fontSize, fontScale, etc.';
  END IF;
END $$;

-- Comment on the table
COMMENT ON TABLE user_preferences IS 'Stores user interface preferences including font size (PRD-274) and accessibility settings';
COMMENT ON COLUMN user_preferences.font_size IS 'Font size preset: small, normal, large, xlarge, xxlarge';
COMMENT ON COLUMN user_preferences.font_scale IS 'Font scale multiplier (0.75 to 2.0)';
COMMENT ON COLUMN user_preferences.respect_os_preference IS 'Whether to detect and apply OS accessibility preferences';
