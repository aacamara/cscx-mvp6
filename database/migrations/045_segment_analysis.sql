-- PRD-175: Customer Segmentation Analysis
-- Migration: Create segment analysis tables

-- ============================================
-- Customer Segments Table
-- ============================================

CREATE TABLE IF NOT EXISTS customer_segments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    criteria JSONB NOT NULL DEFAULT '[]',
    is_dynamic BOOLEAN DEFAULT true,
    color TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for segment lookup
CREATE INDEX IF NOT EXISTS idx_customer_segments_name ON customer_segments(name);
CREATE INDEX IF NOT EXISTS idx_customer_segments_dynamic ON customer_segments(is_dynamic);

-- ============================================
-- Customer Segment Membership Table
-- Tracks which customers belong to which segments
-- ============================================

CREATE TABLE IF NOT EXISTS customer_segment_membership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    segment_id TEXT NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by TEXT, -- 'system' for dynamic, user_id for manual
    UNIQUE(customer_id, segment_id)
);

-- Indexes for membership queries
CREATE INDEX IF NOT EXISTS idx_segment_membership_customer ON customer_segment_membership(customer_id);
CREATE INDEX IF NOT EXISTS idx_segment_membership_segment ON customer_segment_membership(segment_id);

-- ============================================
-- Segment Movement History Table
-- Tracks when customers move between segments
-- ============================================

CREATE TABLE IF NOT EXISTS segment_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    from_segment_id TEXT REFERENCES customer_segments(id) ON DELETE SET NULL,
    to_segment_id TEXT REFERENCES customer_segments(id) ON DELETE SET NULL,
    movement_type TEXT CHECK (movement_type IN ('upgrade', 'downgrade', 'lateral')),
    arr_at_movement NUMERIC(15, 2),
    reason TEXT,
    moved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for movement queries
CREATE INDEX IF NOT EXISTS idx_segment_movements_customer ON segment_movements(customer_id);
CREATE INDEX IF NOT EXISTS idx_segment_movements_date ON segment_movements(moved_at);
CREATE INDEX IF NOT EXISTS idx_segment_movements_type ON segment_movements(movement_type);

-- ============================================
-- Segment Performance Snapshots Table
-- Daily snapshots of segment performance metrics
-- ============================================

CREATE TABLE IF NOT EXISTS segment_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id TEXT NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_count INTEGER DEFAULT 0,
    total_arr NUMERIC(15, 2) DEFAULT 0,
    avg_health_score NUMERIC(5, 2) DEFAULT 0,
    nrr NUMERIC(5, 2) DEFAULT 100,
    churn_rate NUMERIC(5, 2) DEFAULT 0,
    expansion_rate NUMERIC(5, 2) DEFAULT 0,
    healthy_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(segment_id, snapshot_date)
);

-- Indexes for snapshot queries
CREATE INDEX IF NOT EXISTS idx_segment_snapshots_segment ON segment_performance_snapshots(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_snapshots_date ON segment_performance_snapshots(snapshot_date);

-- ============================================
-- Seed Predefined Segments
-- ============================================

INSERT INTO customer_segments (id, name, description, criteria, is_dynamic, color, created_by)
VALUES
    ('enterprise', 'Enterprise', 'Large accounts with ARR > $100K', '[{"attribute": "arr", "operator": "greater", "value": 100000}]', true, '#3b82f6', 'system'),
    ('mid-market', 'Mid-Market', 'Mid-size accounts with ARR $25K-$100K', '[{"attribute": "arr", "operator": "between", "value": {"min": 25000, "max": 100000}}]', true, '#10b981', 'system'),
    ('smb', 'SMB', 'Small accounts with ARR < $25K', '[{"attribute": "arr", "operator": "less", "value": 25000}]', true, '#f59e0b', 'system'),
    ('high-growth', 'High-Growth', 'Fast-expanding accounts (expansion > 20%)', '[{"attribute": "expansion_rate", "operator": "greater", "value": 20}]', true, '#8b5cf6', 'system')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Function to Determine Segment Movement Type
-- ============================================

CREATE OR REPLACE FUNCTION determine_segment_movement_type(
    from_segment TEXT,
    to_segment TEXT
) RETURNS TEXT AS $$
DECLARE
    segment_order JSONB := '{"enterprise": 3, "mid-market": 2, "smb": 1, "high-growth": 4}';
    from_order INTEGER;
    to_order INTEGER;
BEGIN
    from_order := COALESCE((segment_order->>from_segment)::INTEGER, 0);
    to_order := COALESCE((segment_order->>to_segment)::INTEGER, 0);

    IF to_order > from_order THEN
        RETURN 'upgrade';
    ELSIF to_order < from_order THEN
        RETURN 'downgrade';
    ELSE
        RETURN 'lateral';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Trigger to Track Segment Movements
-- ============================================

CREATE OR REPLACE FUNCTION track_segment_movement()
RETURNS TRIGGER AS $$
DECLARE
    customer_arr NUMERIC;
    movement_type TEXT;
BEGIN
    -- Get customer ARR
    SELECT arr INTO customer_arr FROM customers WHERE id = NEW.customer_id;

    -- Determine movement type
    movement_type := determine_segment_movement_type(
        (SELECT segment_id FROM customer_segment_membership
         WHERE customer_id = NEW.customer_id AND segment_id != NEW.segment_id
         ORDER BY assigned_at DESC LIMIT 1),
        NEW.segment_id
    );

    -- Record movement (only if there was a previous segment)
    IF EXISTS (
        SELECT 1 FROM customer_segment_membership
        WHERE customer_id = NEW.customer_id AND segment_id != NEW.segment_id
    ) THEN
        INSERT INTO segment_movements (
            customer_id,
            from_segment_id,
            to_segment_id,
            movement_type,
            arr_at_movement,
            reason
        )
        SELECT
            NEW.customer_id,
            segment_id,
            NEW.segment_id,
            movement_type,
            customer_arr,
            'ARR change'
        FROM customer_segment_membership
        WHERE customer_id = NEW.customer_id AND segment_id != NEW.segment_id
        ORDER BY assigned_at DESC
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS segment_movement_trigger ON customer_segment_membership;
CREATE TRIGGER segment_movement_trigger
    AFTER INSERT ON customer_segment_membership
    FOR EACH ROW
    EXECUTE FUNCTION track_segment_movement();

-- ============================================
-- View for Segment Summary
-- ============================================

CREATE OR REPLACE VIEW segment_summary AS
SELECT
    cs.id,
    cs.name,
    cs.description,
    cs.color,
    cs.is_dynamic,
    COUNT(DISTINCT csm.customer_id) as customer_count,
    COALESCE(SUM(c.arr), 0) as total_arr,
    ROUND(AVG(c.health_score), 0) as avg_health_score,
    COUNT(DISTINCT CASE WHEN c.health_score >= 70 THEN csm.customer_id END) as healthy_count,
    COUNT(DISTINCT CASE WHEN c.health_score >= 40 AND c.health_score < 70 THEN csm.customer_id END) as warning_count,
    COUNT(DISTINCT CASE WHEN c.health_score < 40 THEN csm.customer_id END) as critical_count
FROM customer_segments cs
LEFT JOIN customer_segment_membership csm ON cs.id = csm.segment_id
LEFT JOIN customers c ON csm.customer_id = c.id
GROUP BY cs.id, cs.name, cs.description, cs.color, cs.is_dynamic;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE customer_segments IS 'PRD-175: Stores segment definitions with criteria';
COMMENT ON TABLE customer_segment_membership IS 'PRD-175: Tracks which customers belong to which segments';
COMMENT ON TABLE segment_movements IS 'PRD-175: Historical record of customer segment changes';
COMMENT ON TABLE segment_performance_snapshots IS 'PRD-175: Daily performance snapshots per segment';
