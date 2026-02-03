-- ============================================
-- PRD-264: Voice Command Support - Database Migration
-- ============================================
-- This migration creates the voice_settings table for storing
-- user preferences for voice commands and text-to-speech.

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Voice Settings Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.voice_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Core settings
  voice_enabled BOOLEAN DEFAULT TRUE,
  continuous_listening BOOLEAN DEFAULT FALSE,
  speech_rate NUMERIC(2, 1) DEFAULT 1.0 CHECK (speech_rate >= 0.5 AND speech_rate <= 2.0),
  voice_response_enabled BOOLEAN DEFAULT TRUE,
  summary_mode BOOLEAN DEFAULT FALSE,
  confirm_destructive_actions BOOLEAN DEFAULT TRUE,
  language TEXT DEFAULT 'en-US',

  -- Usage tracking
  total_commands_processed INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Voice Command History Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.voice_command_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,

  -- Command details
  transcript TEXT NOT NULL,
  command_id TEXT,
  command_action TEXT,
  confidence NUMERIC(5, 2),

  -- Result
  success BOOLEAN DEFAULT FALSE,
  response TEXT,
  navigation_target TEXT,
  error TEXT,

  -- Execution context
  execution_time_ms INTEGER,
  required_confirmation BOOLEAN DEFAULT FALSE,
  was_confirmed BOOLEAN,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

-- Voice settings indexes
CREATE INDEX IF NOT EXISTS idx_voice_settings_user ON public.voice_settings(user_id);

-- Command history indexes
CREATE INDEX IF NOT EXISTS idx_voice_command_history_user ON public.voice_command_history(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_command_history_customer ON public.voice_command_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_voice_command_history_created ON public.voice_command_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_command_history_command ON public.voice_command_history(command_action);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE public.voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_command_history ENABLE ROW LEVEL SECURITY;

-- Service role policies (for backend)
CREATE POLICY "Service role full access on voice_settings"
  ON public.voice_settings FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on voice_command_history"
  ON public.voice_command_history FOR ALL
  USING (auth.role() = 'service_role');

-- User policies
CREATE POLICY "Users can view own voice settings"
  ON public.voice_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own voice settings"
  ON public.voice_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice settings"
  ON public.voice_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own command history"
  ON public.voice_command_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own command history"
  ON public.voice_command_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Triggers
-- ============================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_voice_settings_updated_at
  BEFORE UPDATE ON public.voice_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- Initial Feature Flag
-- ============================================

INSERT INTO public.feature_flags (key, name, description, enabled, rollout_percentage)
VALUES (
  'voice_commands_enabled',
  'Voice Commands',
  'Enable voice command support for mobile users (PRD-264)',
  TRUE,
  100
)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Grant Permissions
-- ============================================

GRANT ALL ON public.voice_settings TO anon, authenticated, service_role;
GRANT ALL ON public.voice_command_history TO anon, authenticated, service_role;
