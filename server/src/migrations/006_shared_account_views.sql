-- Migration: Shared Account Views (PRD-242)
-- Date: 2026-01-29
-- Description: Creates tables for shared account views with collaboration features

-- ============================================
-- Account Views Table
-- Stores custom view configurations
-- ============================================

CREATE TABLE IF NOT EXISTS account_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  view_type VARCHAR(50) NOT NULL DEFAULT 'custom' CHECK (view_type IN ('system', 'custom', 'template')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for account_views
CREATE INDEX IF NOT EXISTS idx_account_views_owner_id ON account_views(owner_id);
CREATE INDEX IF NOT EXISTS idx_account_views_is_public ON account_views(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_account_views_view_type ON account_views(view_type);
CREATE INDEX IF NOT EXISTS idx_account_views_updated_at ON account_views(updated_at DESC);

-- ============================================
-- View Shares Table
-- Manages sharing with users and teams
-- ============================================

CREATE TABLE IF NOT EXISTS view_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id UUID NOT NULL REFERENCES account_views(id) ON DELETE CASCADE,
  shared_with_user_id TEXT,
  shared_with_team_id UUID,
  permission VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
  shared_by_user_id TEXT NOT NULL,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_share_target CHECK (
    (shared_with_user_id IS NOT NULL AND shared_with_team_id IS NULL) OR
    (shared_with_user_id IS NULL AND shared_with_team_id IS NOT NULL)
  )
);

-- Indexes for view_shares
CREATE INDEX IF NOT EXISTS idx_view_shares_view_id ON view_shares(view_id);
CREATE INDEX IF NOT EXISTS idx_view_shares_user_id ON view_shares(shared_with_user_id) WHERE shared_with_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_shares_team_id ON view_shares(shared_with_team_id) WHERE shared_with_team_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_view_shares_unique_user ON view_shares(view_id, shared_with_user_id) WHERE shared_with_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_view_shares_unique_team ON view_shares(view_id, shared_with_team_id) WHERE shared_with_team_id IS NOT NULL;

-- ============================================
-- View Favorites Table
-- Tracks user's favorite/pinned views
-- ============================================

CREATE TABLE IF NOT EXISTS view_favorites (
  user_id TEXT NOT NULL,
  view_id UUID NOT NULL REFERENCES account_views(id) ON DELETE CASCADE,
  favorited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, view_id)
);

-- Index for view_favorites
CREATE INDEX IF NOT EXISTS idx_view_favorites_user_id ON view_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_view_favorites_view_id ON view_favorites(view_id);

-- ============================================
-- View History Table
-- Version control for view configurations
-- ============================================

CREATE TABLE IF NOT EXISTS view_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id UUID NOT NULL REFERENCES account_views(id) ON DELETE CASCADE,
  configuration JSONB NOT NULL,
  changed_by_user_id TEXT NOT NULL,
  change_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for view_history
CREATE INDEX IF NOT EXISTS idx_view_history_view_id ON view_history(view_id);
CREATE INDEX IF NOT EXISTS idx_view_history_created_at ON view_history(view_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_view_history_changed_by ON view_history(changed_by_user_id);

-- ============================================
-- Trigger to update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_account_views_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_account_views_updated_at ON account_views;
CREATE TRIGGER trigger_account_views_updated_at
  BEFORE UPDATE ON account_views
  FOR EACH ROW
  EXECUTE FUNCTION update_account_views_updated_at();

-- ============================================
-- Function to check view access permissions
-- Returns: 'owner', 'admin', 'edit', 'view', or NULL (no access)
-- ============================================

CREATE OR REPLACE FUNCTION get_view_permission(
  p_view_id UUID,
  p_user_id TEXT,
  p_team_ids UUID[] DEFAULT '{}'
)
RETURNS TEXT AS $$
DECLARE
  v_permission TEXT;
  v_is_owner BOOLEAN;
  v_is_public BOOLEAN;
BEGIN
  -- Check if user is owner
  SELECT owner_id = p_user_id, is_public
  INTO v_is_owner, v_is_public
  FROM account_views
  WHERE id = p_view_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_is_owner THEN
    RETURN 'owner';
  END IF;

  -- Check direct user share
  SELECT permission INTO v_permission
  FROM view_shares
  WHERE view_id = p_view_id AND shared_with_user_id = p_user_id;

  IF FOUND THEN
    RETURN v_permission;
  END IF;

  -- Check team shares
  SELECT permission INTO v_permission
  FROM view_shares
  WHERE view_id = p_view_id AND shared_with_team_id = ANY(p_team_ids)
  ORDER BY CASE permission WHEN 'admin' THEN 1 WHEN 'edit' THEN 2 WHEN 'view' THEN 3 END
  LIMIT 1;

  IF FOUND THEN
    RETURN v_permission;
  END IF;

  -- Check if public
  IF v_is_public THEN
    RETURN 'view';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on tables
ALTER TABLE account_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_history ENABLE ROW LEVEL SECURITY;

-- Account views policies
CREATE POLICY "Users can view own views"
  ON account_views FOR SELECT
  USING (owner_id = auth.uid()::text OR owner_id = 'demo-user');

CREATE POLICY "Users can view public views"
  ON account_views FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can view shared views"
  ON account_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM view_shares
      WHERE view_shares.view_id = account_views.id
      AND view_shares.shared_with_user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can create views"
  ON account_views FOR INSERT
  WITH CHECK (owner_id = auth.uid()::text OR owner_id = 'demo-user');

CREATE POLICY "Owners can update views"
  ON account_views FOR UPDATE
  USING (owner_id = auth.uid()::text OR owner_id = 'demo-user');

CREATE POLICY "Users with edit permission can update views"
  ON account_views FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM view_shares
      WHERE view_shares.view_id = account_views.id
      AND view_shares.shared_with_user_id = auth.uid()::text
      AND view_shares.permission IN ('edit', 'admin')
    )
  );

CREATE POLICY "Owners can delete views"
  ON account_views FOR DELETE
  USING (owner_id = auth.uid()::text OR owner_id = 'demo-user');

-- View shares policies
CREATE POLICY "Owners can manage shares"
  ON view_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM account_views
      WHERE account_views.id = view_shares.view_id
      AND (account_views.owner_id = auth.uid()::text OR account_views.owner_id = 'demo-user')
    )
  );

CREATE POLICY "Admins can manage shares"
  ON view_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM view_shares vs
      WHERE vs.view_id = view_shares.view_id
      AND vs.shared_with_user_id = auth.uid()::text
      AND vs.permission = 'admin'
    )
  );

CREATE POLICY "Users can view their shares"
  ON view_shares FOR SELECT
  USING (shared_with_user_id = auth.uid()::text);

-- View favorites policies
CREATE POLICY "Users manage own favorites"
  ON view_favorites FOR ALL
  USING (user_id = auth.uid()::text OR user_id = 'demo-user');

-- View history policies
CREATE POLICY "Users can view history for accessible views"
  ON view_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM account_views
      WHERE account_views.id = view_history.view_id
      AND (
        account_views.owner_id = auth.uid()::text
        OR account_views.is_public = true
        OR EXISTS (
          SELECT 1 FROM view_shares
          WHERE view_shares.view_id = account_views.id
          AND view_shares.shared_with_user_id = auth.uid()::text
        )
      )
    )
  );

CREATE POLICY "Users can create history entries for editable views"
  ON view_history FOR INSERT
  WITH CHECK (changed_by_user_id = auth.uid()::text OR changed_by_user_id = 'demo-user');

-- ============================================
-- Service role bypass for RLS
-- ============================================

CREATE POLICY "Service role can access all views"
  ON account_views FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all shares"
  ON view_shares FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all favorites"
  ON view_favorites FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all history"
  ON view_history FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON TABLE account_views IS 'Custom account views with columns, filters, and sorting configurations (PRD-242)';
COMMENT ON TABLE view_shares IS 'Manages view sharing with users and teams with permission levels';
COMMENT ON TABLE view_favorites IS 'User favorites/pinned views for quick access';
COMMENT ON TABLE view_history IS 'Version history for view configurations with rollback support';

COMMENT ON COLUMN account_views.configuration IS 'JSONB with columns, filters, sort, groupBy, and dateRange settings';
COMMENT ON COLUMN account_views.view_type IS 'system = built-in, custom = user-created, template = shared starting point';
COMMENT ON COLUMN view_shares.permission IS 'view = read-only, edit = can modify config, admin = can manage shares';
COMMENT ON FUNCTION get_view_permission IS 'Returns highest permission level for a user on a view';
