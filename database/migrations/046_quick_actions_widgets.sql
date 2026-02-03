-- PRD-265: Quick Actions Widget
-- Migration for mobile quick action widget configurations

-- Widget configurations table
CREATE TABLE IF NOT EXISTS widget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_type VARCHAR(50) NOT NULL,
  size VARCHAR(20) DEFAULT 'medium',
  position INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_widget_type CHECK (widget_type IN (
    'customer_quick_view',
    'portfolio_overview',
    'tasks_today',
    'quick_compose',
    'notification_summary'
  )),
  CONSTRAINT valid_size CHECK (size IN ('small', 'medium', 'large'))
);

-- Customer notes table (if not exists)
CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_voice_note BOOLEAN DEFAULT FALSE,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health score history table (if not exists)
CREATE TABLE IF NOT EXISTS health_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  factors JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_widget_configs_user ON widget_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_widget_configs_user_type ON widget_configs(user_id, widget_type);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_user ON customer_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_created ON customer_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_score_history_customer ON health_score_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_health_score_history_recorded ON health_score_history(customer_id, recorded_at DESC);

-- Row Level Security
ALTER TABLE widget_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_score_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for widget_configs
CREATE POLICY widget_configs_select ON widget_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY widget_configs_insert ON widget_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY widget_configs_update ON widget_configs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY widget_configs_delete ON widget_configs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for customer_notes
CREATE POLICY customer_notes_select ON customer_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY customer_notes_insert ON customer_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY customer_notes_update ON customer_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY customer_notes_delete ON customer_notes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for health_score_history (read-only for users)
CREATE POLICY health_score_history_select ON health_score_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_id
      AND c.assigned_csm_id = auth.uid()
    )
  );

-- Function to update widget_configs updated_at
CREATE OR REPLACE FUNCTION update_widget_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for widget_configs updated_at
DROP TRIGGER IF EXISTS widget_configs_updated_at ON widget_configs;
CREATE TRIGGER widget_configs_updated_at
  BEFORE UPDATE ON widget_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_widget_configs_updated_at();

-- Function to update customer_notes updated_at
CREATE OR REPLACE FUNCTION update_customer_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for customer_notes updated_at
DROP TRIGGER IF EXISTS customer_notes_updated_at ON customer_notes;
CREATE TRIGGER customer_notes_updated_at
  BEFORE UPDATE ON customer_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_notes_updated_at();

-- Comment on tables
COMMENT ON TABLE widget_configs IS 'PRD-265: User widget configurations for mobile quick actions';
COMMENT ON TABLE customer_notes IS 'PRD-265: Quick notes and voice notes for customers';
COMMENT ON TABLE health_score_history IS 'PRD-265: Historical health scores for trend calculation';
