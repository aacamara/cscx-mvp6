# Database - Agent Instructions

## Overview

Supabase PostgreSQL database with Row Level Security (RLS). All schema changes through migrations.

## Schema Overview

### Core Tables

```sql
-- Customers (central entity)
customers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  arr NUMERIC NOT NULL,
  tier TEXT CHECK (tier IN ('enterprise', 'mid-market', 'smb')),
  health_score INTEGER DEFAULT 50,
  renewal_date DATE,
  csm_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Stakeholders (contacts at customer)
stakeholders (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  title TEXT,
  role TEXT CHECK (role IN ('champion', 'sponsor', 'user', 'detractor')),
  is_primary BOOLEAN DEFAULT false,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Contracts
contracts (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  file_url TEXT,
  parsed_data JSONB, -- AI-extracted contract data
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Entitlements (what customer purchased)
entitlements (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  contract_id UUID REFERENCES contracts(id),
  product TEXT NOT NULL,
  quantity INTEGER,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### Agent Tables

```sql
-- Agent sessions (conversations)
agent_sessions (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  user_id UUID REFERENCES users(id),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Agent messages
agent_messages (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES agent_sessions(id),
  role TEXT CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,
  thinking TEXT, -- Claude's extended thinking
  tool_calls JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Agent runs (execution traces)
agent_runs (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES agent_sessions(id),
  agent_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  input TEXT,
  output TEXT,
  total_tokens_input INTEGER,
  total_tokens_output INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB
)

-- Agent steps (individual actions within a run)
agent_steps (
  id UUID PRIMARY KEY,
  run_id UUID REFERENCES agent_runs(id),
  step_type TEXT CHECK (step_type IN ('thinking', 'tool_call', 'tool_result', 'llm_call', 'handoff')),
  name TEXT,
  input JSONB,
  output JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- HITL Approvals
approvals (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES agent_sessions(id),
  action_type TEXT NOT NULL,
  action_description TEXT,
  action_data JSONB,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
)
```

### CS Metrics Tables

```sql
-- Health scores (PROVE framework)
health_scores (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  overall INTEGER NOT NULL,
  product INTEGER,    -- Feature adoption
  risk INTEGER,       -- Risk factors
  outcomes INTEGER,   -- Goal achievement
  voice INTEGER,      -- Engagement
  engagement INTEGER, -- Activity
  calculated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Usage metrics
usage_metrics (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  date DATE NOT NULL,
  dau INTEGER,
  wau INTEGER,
  mau INTEGER,
  session_duration_avg INTEGER,
  feature_adoption JSONB,
  adoption_score INTEGER
)

-- Risk signals
risk_signals (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  signal_type TEXT CHECK (signal_type IN (
    'usage_drop', 'champion_left', 'support_escalation',
    'nps_detractor', 'competitor_threat', 'payment_issue'
  )),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
)

-- Renewal pipeline
renewal_pipeline (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  renewal_date DATE NOT NULL,
  current_arr NUMERIC,
  forecasted_arr NUMERIC,
  stage TEXT CHECK (stage IN ('healthy', 'at_risk', 'churned', 'expanded')),
  probability INTEGER,
  notes TEXT
)

-- QBRs
qbrs (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  scheduled_date DATE,
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  attendees JSONB,
  presentation_url TEXT,
  action_items JSONB,
  notes TEXT
)
```

## Migration Pattern

```sql
-- database/migrations/XXX_description.sql

-- Always include rollback plan in comments
-- Rollback: DROP TABLE IF EXISTS new_table;

BEGIN;

-- Create table
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns...
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_new_table_customer
  ON new_table(customer_id);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can access their customers' data"
  ON new_table
  FOR ALL
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE csm_id = auth.uid()
    )
  );

COMMIT;
```

## Key Indexes

```sql
-- Performance-critical indexes
CREATE INDEX idx_customers_health ON customers(health_score);
CREATE INDEX idx_customers_renewal ON customers(renewal_date);
CREATE INDEX idx_agent_runs_customer ON agent_runs(customer_id);
CREATE INDEX idx_agent_runs_session ON agent_runs(session_id);
CREATE INDEX idx_risk_signals_unresolved ON risk_signals(customer_id) WHERE resolved_at IS NULL;
CREATE INDEX idx_approvals_pending ON approvals(session_id) WHERE status = 'pending';
CREATE INDEX idx_usage_metrics_date ON usage_metrics(customer_id, date);
```

## RLS Policies

```sql
-- Customers: CSMs see their assigned customers
CREATE POLICY "CSMs see assigned customers"
  ON customers FOR SELECT
  USING (csm_id = auth.uid() OR is_admin(auth.uid()));

-- Agent sessions: Users see their own sessions
CREATE POLICY "Users see own sessions"
  ON agent_sessions FOR ALL
  USING (user_id = auth.uid());

-- Approvals: Users see their session's approvals
CREATE POLICY "Users see session approvals"
  ON approvals FOR ALL
  USING (
    session_id IN (
      SELECT id FROM agent_sessions WHERE user_id = auth.uid()
    )
  );
```

## Common Queries

### Get customer with health breakdown
```sql
SELECT
  c.*,
  hs.overall as health_score,
  hs.product,
  hs.risk,
  hs.outcomes,
  hs.voice,
  hs.engagement,
  hs.calculated_at as health_calculated_at
FROM customers c
LEFT JOIN LATERAL (
  SELECT * FROM health_scores
  WHERE customer_id = c.id
  ORDER BY calculated_at DESC
  LIMIT 1
) hs ON true
WHERE c.id = $1;
```

### Get at-risk customers
```sql
SELECT c.*, COUNT(rs.id) as active_signals
FROM customers c
LEFT JOIN risk_signals rs ON rs.customer_id = c.id AND rs.resolved_at IS NULL
WHERE c.health_score < 60
  OR rs.severity IN ('high', 'critical')
GROUP BY c.id
ORDER BY c.health_score ASC;
```

### Get upcoming renewals
```sql
SELECT c.*, rp.*
FROM customers c
JOIN renewal_pipeline rp ON rp.customer_id = c.id
WHERE rp.renewal_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
ORDER BY rp.renewal_date ASC;
```

## Common Gotchas

### 1. Use TIMESTAMPTZ, not TIMESTAMP
```sql
-- ❌ BAD - no timezone
created_at TIMESTAMP DEFAULT NOW()

-- ✅ GOOD - with timezone
created_at TIMESTAMPTZ DEFAULT NOW()
```

### 2. Always check for errors in Supabase client
```typescript
// ❌ BAD
const { data } = await supabase.from('customers').select();

// ✅ GOOD
const { data, error } = await supabase.from('customers').select();
if (error) throw error;
```

### 3. Use gen_random_uuid() for UUIDs
```sql
-- ❌ BAD - requires extension
id UUID DEFAULT uuid_generate_v4()

-- ✅ GOOD - built-in
id UUID DEFAULT gen_random_uuid()
```

### 4. JSONB over JSON
```sql
-- ❌ BAD - less efficient
metadata JSON

-- ✅ GOOD - supports indexing
metadata JSONB
```

### 5. Soft delete pattern
```sql
-- Add deleted_at column
ALTER TABLE customers ADD COLUMN deleted_at TIMESTAMPTZ;

-- Update queries to filter
SELECT * FROM customers WHERE deleted_at IS NULL;

-- Soft delete
UPDATE customers SET deleted_at = NOW() WHERE id = $1;
```

## Running Migrations

```bash
# Using the migration script
node scripts/run-migration.js

# Or directly with Supabase CLI
supabase db push
```
