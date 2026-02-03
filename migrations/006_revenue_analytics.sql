-- PRD-158: Revenue Analytics Report
-- Migration: Revenue movements tracking and analytics

-- Revenue Movements Table
-- Tracks all revenue changes: new business, expansion, contraction, churn, reactivation
CREATE TABLE IF NOT EXISTS revenue_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Movement type
    type VARCHAR(20) NOT NULL CHECK (type IN ('new', 'expansion', 'contraction', 'churn', 'reactivation')),

    -- Revenue values
    previous_arr DECIMAL(15, 2) NOT NULL DEFAULT 0,
    new_arr DECIMAL(15, 2) NOT NULL DEFAULT 0,
    change_amount DECIMAL(15, 2) GENERATED ALWAYS AS (new_arr - previous_arr) STORED,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Attribution
    reason TEXT,
    source VARCHAR(50) CHECK (source IN ('upsell', 'downsell', 'price_change', 'churn', 'new_business', 'reactivation')),

    -- Metadata
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_revenue_movements_customer ON revenue_movements(customer_id);
CREATE INDEX IF NOT EXISTS idx_revenue_movements_date ON revenue_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_revenue_movements_type ON revenue_movements(type);
CREATE INDEX IF NOT EXISTS idx_revenue_movements_created ON revenue_movements(created_at);

-- Revenue Snapshots Table
-- Monthly snapshots of portfolio revenue for historical analysis
CREATE TABLE IF NOT EXISTS revenue_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL,

    -- Totals
    total_arr DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_mrr DECIMAL(15, 2) GENERATED ALWAYS AS (total_arr / 12) STORED,
    customer_count INTEGER NOT NULL DEFAULT 0,

    -- Movement totals for the period
    new_business DECIMAL(15, 2) DEFAULT 0,
    expansion DECIMAL(15, 2) DEFAULT 0,
    contraction DECIMAL(15, 2) DEFAULT 0,
    churn DECIMAL(15, 2) DEFAULT 0,

    -- Retention metrics
    gross_retention DECIMAL(5, 2),
    net_retention DECIMAL(5, 2),
    logo_retention DECIMAL(5, 2),

    -- Segment breakdown (JSONB for flexibility)
    segment_breakdown JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on snapshot date (one snapshot per month)
CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_snapshots_date ON revenue_snapshots(snapshot_date);

-- Add segment column to customers table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'customers' AND column_name = 'segment') THEN
        ALTER TABLE customers ADD COLUMN segment VARCHAR(20)
            CHECK (segment IN ('enterprise', 'mid-market', 'smb'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'customers' AND column_name = 'csm_id') THEN
        ALTER TABLE customers ADD COLUMN csm_id UUID REFERENCES auth.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'customers' AND column_name = 'csm_name') THEN
        ALTER TABLE customers ADD COLUMN csm_name VARCHAR(255);
    END IF;
END $$;

-- Function to auto-calculate segment from ARR
CREATE OR REPLACE FUNCTION calculate_customer_segment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.arr >= 100000 THEN
        NEW.segment := 'enterprise';
    ELSIF NEW.arr >= 25000 THEN
        NEW.segment := 'mid-market';
    ELSE
        NEW.segment := 'smb';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set segment on insert/update
DROP TRIGGER IF EXISTS trg_calculate_segment ON customers;
CREATE TRIGGER trg_calculate_segment
    BEFORE INSERT OR UPDATE OF arr ON customers
    FOR EACH ROW
    EXECUTE FUNCTION calculate_customer_segment();

-- Function to record revenue movement when ARR changes
CREATE OR REPLACE FUNCTION record_arr_change()
RETURNS TRIGGER AS $$
DECLARE
    movement_type VARCHAR(20);
BEGIN
    -- Skip if ARR hasn't changed
    IF OLD.arr = NEW.arr THEN
        RETURN NEW;
    END IF;

    -- Determine movement type
    IF OLD.arr IS NULL OR OLD.arr = 0 THEN
        movement_type := 'new';
    ELSIF NEW.arr = 0 AND OLD.arr > 0 THEN
        movement_type := 'churn';
    ELSIF NEW.arr > OLD.arr THEN
        movement_type := 'expansion';
    ELSE
        movement_type := 'contraction';
    END IF;

    -- Insert movement record
    INSERT INTO revenue_movements (
        customer_id,
        movement_date,
        type,
        previous_arr,
        new_arr,
        source
    ) VALUES (
        NEW.id,
        CURRENT_DATE,
        movement_type,
        COALESCE(OLD.arr, 0),
        NEW.arr,
        CASE
            WHEN movement_type = 'new' THEN 'new_business'
            WHEN movement_type = 'churn' THEN 'churn'
            WHEN movement_type = 'expansion' THEN 'upsell'
            ELSE 'downsell'
        END
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-record movements
DROP TRIGGER IF EXISTS trg_record_arr_change ON customers;
CREATE TRIGGER trg_record_arr_change
    AFTER UPDATE OF arr ON customers
    FOR EACH ROW
    EXECUTE FUNCTION record_arr_change();

-- Function to generate monthly revenue snapshot
CREATE OR REPLACE FUNCTION generate_revenue_snapshot()
RETURNS void AS $$
DECLARE
    snapshot_month DATE;
    prev_month DATE;
    total_arr_val DECIMAL(15, 2);
    customer_count_val INTEGER;
    new_biz DECIMAL(15, 2);
    expansion_val DECIMAL(15, 2);
    contraction_val DECIMAL(15, 2);
    churn_val DECIMAL(15, 2);
    prev_arr DECIMAL(15, 2);
    grr DECIMAL(5, 2);
    nrr DECIMAL(5, 2);
    segments JSONB;
BEGIN
    -- First day of current month
    snapshot_month := DATE_TRUNC('month', CURRENT_DATE);
    prev_month := snapshot_month - INTERVAL '1 month';

    -- Get current totals
    SELECT
        COALESCE(SUM(arr), 0),
        COUNT(*)
    INTO total_arr_val, customer_count_val
    FROM customers
    WHERE stage != 'churned';

    -- Get movements for the month
    SELECT
        COALESCE(SUM(CASE WHEN type = 'new' THEN change_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'expansion' THEN change_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'contraction' THEN ABS(change_amount) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'churn' THEN ABS(change_amount) ELSE 0 END), 0)
    INTO new_biz, expansion_val, contraction_val, churn_val
    FROM revenue_movements
    WHERE movement_date >= prev_month AND movement_date < snapshot_month;

    -- Get previous month's ARR for retention calcs
    SELECT COALESCE(total_arr, total_arr_val - new_biz - expansion_val + contraction_val + churn_val)
    INTO prev_arr
    FROM revenue_snapshots
    WHERE snapshot_date = prev_month;

    -- Calculate retention (avoid division by zero)
    IF prev_arr > 0 THEN
        grr := ((prev_arr - contraction_val - churn_val) / prev_arr) * 100;
        nrr := ((prev_arr + expansion_val - contraction_val - churn_val) / prev_arr) * 100;
    ELSE
        grr := 100;
        nrr := 100;
    END IF;

    -- Get segment breakdown
    SELECT jsonb_object_agg(
        segment,
        jsonb_build_object(
            'arr', COALESCE(SUM(arr), 0),
            'customer_count', COUNT(*),
            'avg_arr', COALESCE(AVG(arr), 0)
        )
    )
    INTO segments
    FROM customers
    WHERE stage != 'churned'
    GROUP BY segment;

    -- Upsert snapshot
    INSERT INTO revenue_snapshots (
        snapshot_date,
        total_arr,
        customer_count,
        new_business,
        expansion,
        contraction,
        churn,
        gross_retention,
        net_retention,
        segment_breakdown
    ) VALUES (
        snapshot_month,
        total_arr_val,
        customer_count_val,
        new_biz,
        expansion_val,
        contraction_val,
        churn_val,
        grr,
        nrr,
        COALESCE(segments, '{}'::jsonb)
    )
    ON CONFLICT (snapshot_date)
    DO UPDATE SET
        total_arr = EXCLUDED.total_arr,
        customer_count = EXCLUDED.customer_count,
        new_business = EXCLUDED.new_business,
        expansion = EXCLUDED.expansion,
        contraction = EXCLUDED.contraction,
        churn = EXCLUDED.churn,
        gross_retention = EXCLUDED.gross_retention,
        net_retention = EXCLUDED.net_retention,
        segment_breakdown = EXCLUDED.segment_breakdown;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE revenue_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all movements
CREATE POLICY "Allow read access to revenue movements" ON revenue_movements
    FOR SELECT TO authenticated
    USING (true);

-- Allow authenticated users to insert movements
CREATE POLICY "Allow insert revenue movements" ON revenue_movements
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Allow read access to snapshots
CREATE POLICY "Allow read access to revenue snapshots" ON revenue_snapshots
    FOR SELECT TO authenticated
    USING (true);

-- Comment on tables
COMMENT ON TABLE revenue_movements IS 'PRD-158: Tracks all revenue changes including new business, expansion, contraction, and churn';
COMMENT ON TABLE revenue_snapshots IS 'PRD-158: Monthly snapshots of portfolio revenue metrics for historical analysis';
