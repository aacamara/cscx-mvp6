-- PRD-268: Location-Based Reminders
-- Customer location geofencing with arrival/departure notifications

-- ============================================
-- CUSTOMER LOCATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS customer_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label VARCHAR(200), -- 'HQ', 'NYC Office', etc.
  address TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  geofence_radius INTEGER DEFAULT 500, -- meters
  is_primary BOOLEAN DEFAULT false,
  geofence_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for customer_locations
CREATE INDEX IF NOT EXISTS idx_customer_locations_customer_id ON customer_locations(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_locations_geofence ON customer_locations(geofence_enabled, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_locations_coords ON customer_locations(latitude, longitude);

-- ============================================
-- CSM LOCATION PREFERENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS csm_location_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  location_tracking_enabled BOOLEAN DEFAULT false,
  arrival_notifications BOOLEAN DEFAULT true,
  departure_notifications BOOLEAN DEFAULT true,
  geofence_radius_default INTEGER DEFAULT 500, -- meters
  excluded_locations JSONB DEFAULT '[]', -- Home, personal locations
  battery_optimization VARCHAR(20) DEFAULT 'balanced' CHECK (battery_optimization IN ('low', 'balanced', 'high')),
  precise_location BOOLEAN DEFAULT false, -- Precise vs approximate
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VISIT LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS visit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES customer_locations(id) ON DELETE SET NULL,
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN departure_time IS NOT NULL AND arrival_time IS NOT NULL
      THEN EXTRACT(EPOCH FROM (departure_time - arrival_time)) / 60
      ELSE NULL
    END
  ) STORED,
  notes TEXT,
  follow_up_tasks JSONB DEFAULT '[]',
  voice_note_url TEXT,
  is_planned BOOLEAN DEFAULT false, -- Was it on calendar?
  calendar_event_id VARCHAR(200),
  sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for visit_logs
CREATE INDEX IF NOT EXISTS idx_visit_logs_user ON visit_logs(user_id, arrival_time DESC);
CREATE INDEX IF NOT EXISTS idx_visit_logs_customer ON visit_logs(customer_id, arrival_time DESC);
CREATE INDEX IF NOT EXISTS idx_visit_logs_location ON visit_logs(location_id);
CREATE INDEX IF NOT EXISTS idx_visit_logs_active ON visit_logs(user_id, customer_id) WHERE departure_time IS NULL;

-- ============================================
-- GEOFENCE EVENTS TABLE (for analytics)
-- ============================================

CREATE TABLE IF NOT EXISTS geofence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES customer_locations(id) ON DELETE SET NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('enter', 'exit', 'dwell')),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  accuracy_meters INTEGER,
  notification_sent BOOLEAN DEFAULT false,
  notification_clicked BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for geofence_events
CREATE INDEX IF NOT EXISTS idx_geofence_events_user ON geofence_events(user_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_events_customer ON geofence_events(customer_id, triggered_at DESC);

-- ============================================
-- VISIT PATTERNS TABLE (ML-derived insights)
-- ============================================

CREATE TABLE IF NOT EXISTS visit_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  avg_visit_duration_minutes INTEGER,
  typical_visit_days JSONB DEFAULT '[]', -- e.g., ['monday', 'wednesday']
  typical_visit_time VARCHAR(20), -- e.g., 'morning', 'afternoon'
  visit_frequency VARCHAR(20) CHECK (visit_frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'infrequent')),
  last_visit_date DATE,
  total_visits INTEGER DEFAULT 0,
  suggested_next_visit DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, customer_id)
);

-- Index for visit_patterns
CREATE INDEX IF NOT EXISTS idx_visit_patterns_user ON visit_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_visit_patterns_customer ON visit_patterns(customer_id);

-- ============================================
-- VIEWS
-- ============================================

-- Active visits (CSMs currently at customer sites)
CREATE OR REPLACE VIEW v_active_visits AS
SELECT
  vl.id,
  vl.user_id,
  vl.customer_id,
  vl.location_id,
  vl.arrival_time,
  c.name as customer_name,
  cl.label as location_label,
  cl.address,
  EXTRACT(EPOCH FROM (NOW() - vl.arrival_time)) / 60 as minutes_at_site
FROM visit_logs vl
JOIN customers c ON vl.customer_id = c.id
LEFT JOIN customer_locations cl ON vl.location_id = cl.id
WHERE vl.departure_time IS NULL
ORDER BY vl.arrival_time DESC;

-- Recent visit summary per CSM
CREATE OR REPLACE VIEW v_csm_visit_summary AS
SELECT
  vl.user_id,
  COUNT(*) as total_visits_30d,
  COUNT(DISTINCT vl.customer_id) as unique_customers_visited,
  ROUND(AVG(EXTRACT(EPOCH FROM (vl.departure_time - vl.arrival_time)) / 60)::numeric, 0) as avg_duration_minutes,
  COUNT(CASE WHEN vl.notes IS NOT NULL AND vl.notes != '' THEN 1 END) as visits_with_notes,
  COUNT(CASE WHEN jsonb_array_length(vl.follow_up_tasks) > 0 THEN 1 END) as visits_with_tasks
FROM visit_logs vl
WHERE vl.arrival_time >= NOW() - INTERVAL '30 days'
  AND vl.departure_time IS NOT NULL
GROUP BY vl.user_id;

-- Customer visit history
CREATE OR REPLACE VIEW v_customer_visit_history AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  COUNT(vl.id) as total_visits,
  MAX(vl.arrival_time) as last_visit,
  MIN(vl.arrival_time) as first_visit,
  ROUND(AVG(EXTRACT(EPOCH FROM (vl.departure_time - vl.arrival_time)) / 60)::numeric, 0) as avg_visit_duration
FROM customers c
LEFT JOIN visit_logs vl ON c.id = vl.customer_id AND vl.departure_time IS NOT NULL
GROUP BY c.id, c.name;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to auto-update customer last_contact_date on visit
CREATE OR REPLACE FUNCTION update_customer_last_contact_on_visit()
RETURNS TRIGGER AS $$
BEGIN
  -- Update customer's last contact date when visit ends
  IF NEW.departure_time IS NOT NULL AND OLD.departure_time IS NULL THEN
    UPDATE customers
    SET
      last_contact_date = NEW.departure_time,
      updated_at = NOW()
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer on visit completion
DROP TRIGGER IF EXISTS trg_update_customer_on_visit ON visit_logs;
CREATE TRIGGER trg_update_customer_on_visit
  AFTER UPDATE ON visit_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_last_contact_on_visit();

-- Function to update visit patterns after visit
CREATE OR REPLACE FUNCTION update_visit_patterns()
RETURNS TRIGGER AS $$
BEGIN
  -- Update visit patterns when a visit is completed
  IF NEW.departure_time IS NOT NULL AND OLD.departure_time IS NULL THEN
    INSERT INTO visit_patterns (user_id, customer_id, last_visit_date, total_visits)
    VALUES (NEW.user_id, NEW.customer_id, NEW.arrival_time::date, 1)
    ON CONFLICT (user_id, customer_id) DO UPDATE SET
      last_visit_date = EXCLUDED.last_visit_date,
      total_visits = visit_patterns.total_visits + 1,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for visit patterns
DROP TRIGGER IF EXISTS trg_update_visit_patterns ON visit_logs;
CREATE TRIGGER trg_update_visit_patterns
  AFTER UPDATE ON visit_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_visit_patterns();

-- Function to calculate distance between two coordinates (in meters)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DECIMAL(10, 8),
  lon1 DECIMAL(11, 8),
  lat2 DECIMAL(10, 8),
  lon2 DECIMAL(11, 8)
) RETURNS INTEGER AS $$
DECLARE
  R INTEGER := 6371000; -- Earth's radius in meters
  dlat DECIMAL;
  dlon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN (R * c)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find nearby customer locations
CREATE OR REPLACE FUNCTION find_nearby_locations(
  p_latitude DECIMAL(10, 8),
  p_longitude DECIMAL(11, 8),
  p_radius_meters INTEGER DEFAULT 1000
) RETURNS TABLE (
  location_id UUID,
  customer_id UUID,
  customer_name VARCHAR,
  label VARCHAR,
  distance_meters INTEGER,
  geofence_radius INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.id as location_id,
    cl.customer_id,
    c.name as customer_name,
    cl.label,
    calculate_distance(p_latitude, p_longitude, cl.latitude, cl.longitude) as distance_meters,
    cl.geofence_radius
  FROM customer_locations cl
  JOIN customers c ON cl.customer_id = c.id
  WHERE cl.geofence_enabled = true
    AND calculate_distance(p_latitude, p_longitude, cl.latitude, cl.longitude) <= p_radius_meters
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE customer_locations IS 'PRD-268: Customer office locations with geofence configuration';
COMMENT ON TABLE csm_location_preferences IS 'PRD-268: CSM preferences for location tracking and notifications';
COMMENT ON TABLE visit_logs IS 'PRD-268: Visit logs with arrival/departure times and notes';
COMMENT ON TABLE geofence_events IS 'PRD-268: Geofence entry/exit events for analytics';
COMMENT ON TABLE visit_patterns IS 'PRD-268: ML-derived visit patterns for smart suggestions';
COMMENT ON FUNCTION calculate_distance IS 'PRD-268: Haversine formula for distance calculation';
COMMENT ON FUNCTION find_nearby_locations IS 'PRD-268: Find customer locations within radius';
