# CSCX.AI Database Schema

Complete database schema for Supabase/PostgreSQL.

## Overview

The database is designed to support:
- Customer management
- Contract storage and parsing
- Agent sessions and messages
- Meeting transcripts and insights
- Training modules and progress

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    customers    │────<│   stakeholders  │     │    contracts    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │ 1:N                                          │ N:1
        ▼                                               ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ agent_sessions  │────<│ agent_messages  │     │  entitlements   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    approvals    │     │    meetings     │────<│   transcripts   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                │ 1:N
                                ▼
                        ┌─────────────────┐
                        │    insights     │
                        └─────────────────┘
```

---

## Tables

### customers

Core customer information.

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  arr NUMERIC,
  industry TEXT,
  stage TEXT DEFAULT 'prospect',
  health_score INTEGER,
  csm_id UUID REFERENCES auth.users(id),
  salesforce_id TEXT,
  hubspot_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_csm ON customers(csm_id);
CREATE INDEX idx_customers_stage ON customers(stage);
```

### stakeholders

Customer stakeholders/contacts.

```sql
CREATE TABLE stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  sentiment TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stakeholders_customer ON stakeholders(customer_id);
CREATE INDEX idx_stakeholders_email ON stakeholders(email);
```

### contracts

Parsed contract documents.

```sql
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  file_url TEXT,
  file_name TEXT,
  raw_text TEXT,
  company_name TEXT,
  arr NUMERIC,
  contract_term TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active',
  parsed_data JSONB,
  pricing_terms JSONB,
  technical_requirements JSONB,
  missing_info JSONB,
  next_steps JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_customer ON contracts(customer_id);
CREATE INDEX idx_contracts_status ON contracts(status);
```

### entitlements

Contract entitlements/line items.

```sql
CREATE TABLE entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER,
  unit TEXT,
  price NUMERIC,
  category TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entitlements_contract ON entitlements(contract_id);
```

### agent_sessions

Agent conversation sessions.

```sql
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active',
  active_agent TEXT DEFAULT 'onboarding',
  deployed_agents TEXT[] DEFAULT '{}',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_customer ON agent_sessions(customer_id);
CREATE INDEX idx_sessions_user ON agent_sessions(user_id);
CREATE INDEX idx_sessions_status ON agent_sessions(status);
```

### agent_messages

Individual messages in agent sessions.

```sql
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  agent_id TEXT,
  role TEXT NOT NULL, -- 'user', 'agent', 'system'
  content TEXT NOT NULL,
  thinking BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT FALSE,
  deployed_agent TEXT,
  tool_calls JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON agent_messages(session_id);
CREATE INDEX idx_messages_created ON agent_messages(created_at);
```

### approvals

Human-in-the-loop approval requests.

```sql
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  comment TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approvals_session ON approvals(session_id);
CREATE INDEX idx_approvals_status ON approvals(status);
```

### meetings

Meeting records.

```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agent_sessions(id),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  duration INTEGER, -- minutes
  status TEXT DEFAULT 'scheduled',
  meeting_url TEXT,
  calendar_event_id TEXT,
  attendees JSONB DEFAULT '[]',
  agenda JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meetings_customer ON meetings(customer_id);
CREATE INDEX idx_meetings_scheduled ON meetings(scheduled_at);
```

### transcripts

Meeting transcripts.

```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  duration INTEGER, -- seconds
  speakers JSONB DEFAULT '[]',
  word_count INTEGER,
  language TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transcripts_meeting ON transcripts(meeting_id);
```

### insights

AI-extracted insights.

```sql
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id),
  source TEXT NOT NULL, -- 'meeting', 'email', 'crm', 'agent'
  type TEXT NOT NULL, -- 'decision', 'action_item', 'concern', 'quote', 'sentiment'
  content TEXT NOT NULL,
  importance TEXT DEFAULT 'medium',
  owner TEXT,
  due_date DATE,
  status TEXT DEFAULT 'open',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insights_customer ON insights(customer_id);
CREATE INDEX idx_insights_type ON insights(type);
CREATE INDEX idx_insights_status ON insights(status);
```

### training_modules

Training content modules.

```sql
CREATE TABLE training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  duration INTEGER, -- minutes
  level TEXT DEFAULT 'beginner',
  category TEXT,
  prerequisites UUID[],
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_modules_category ON training_modules(category);
CREATE INDEX idx_modules_active ON training_modules(is_active);
```

### training_progress

Customer training progress.

```sql
CREATE TABLE training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id),
  module_id UUID REFERENCES training_modules(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed'
  progress INTEGER DEFAULT 0, -- percentage
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_progress_unique ON training_progress(customer_id, stakeholder_id, module_id);
CREATE INDEX idx_progress_customer ON training_progress(customer_id);
```

### knowledge_base

Knowledge base articles for training agent.

```sql
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  embedding VECTOR(1536), -- For semantic search
  is_public BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_category ON knowledge_base(category);
CREATE INDEX idx_kb_tags ON knowledge_base USING GIN(tags);
```

### activity_log

Audit trail for all actions.

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  customer_id UUID REFERENCES customers(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_user ON activity_log(user_id);
CREATE INDEX idx_activity_customer ON activity_log(customer_id);
CREATE INDEX idx_activity_created ON activity_log(created_at);
```

---

## Views

### customer_health_view

Aggregated customer health data.

```sql
CREATE VIEW customer_health_view AS
SELECT
  c.id,
  c.name,
  c.arr,
  c.health_score,
  c.stage,
  COUNT(DISTINCT s.id) AS stakeholder_count,
  COUNT(DISTINCT m.id) AS meeting_count,
  COUNT(DISTINCT i.id) FILTER (WHERE i.type = 'concern') AS concern_count,
  MAX(m.scheduled_at) AS last_meeting,
  MAX(am.created_at) AS last_interaction
FROM customers c
LEFT JOIN stakeholders s ON s.customer_id = c.id
LEFT JOIN meetings m ON m.customer_id = c.id
LEFT JOIN insights i ON i.customer_id = c.id
LEFT JOIN agent_sessions ags ON ags.customer_id = c.id
LEFT JOIN agent_messages am ON am.session_id = ags.id
GROUP BY c.id;
```

---

## Functions

### update_health_score

Automatically recalculate health score.

```sql
CREATE OR REPLACE FUNCTION update_health_score(customer_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  engagement_score INTEGER;
  adoption_score INTEGER;
  total_score INTEGER;
BEGIN
  -- Calculate engagement (based on recent interactions)
  SELECT LEAST(100, COUNT(*) * 10) INTO engagement_score
  FROM agent_messages am
  JOIN agent_sessions s ON s.id = am.session_id
  WHERE s.customer_id = customer_uuid
  AND am.created_at > NOW() - INTERVAL '30 days';

  -- Calculate adoption (based on training progress)
  SELECT COALESCE(AVG(progress), 0) INTO adoption_score
  FROM training_progress
  WHERE customer_id = customer_uuid;

  -- Combine scores
  total_score := (engagement_score + adoption_score) / 2;

  -- Update customer
  UPDATE customers SET
    health_score = total_score,
    updated_at = NOW()
  WHERE id = customer_uuid;

  RETURN total_score;
END;
$$ LANGUAGE plpgsql;
```

### auto_update_timestamps

Trigger for updated_at columns.

```sql
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_customers_timestamp
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_contracts_timestamp
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ... repeat for other tables
```

---

## Row Level Security (RLS)

Enable RLS for multi-tenant security:

```sql
-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their assigned customers
CREATE POLICY customers_policy ON customers
  FOR ALL
  USING (csm_id = auth.uid());

-- Policy: Stakeholders inherit customer access
CREATE POLICY stakeholders_policy ON stakeholders
  FOR ALL
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE csm_id = auth.uid()
    )
  );

-- Service role bypass for backend
CREATE POLICY service_role_policy ON customers
  FOR ALL
  TO service_role
  USING (true);
```

---

## Migrations

### Initial Migration

Save as `database/migrations/001_initial.sql`:

```sql
-- Run all CREATE TABLE statements above
```

### Add Vector Search

Save as `database/migrations/002_vector_search.sql`:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to knowledge_base
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS idx_kb_embedding
ON knowledge_base
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

## Backup Strategy

### Automated Backups (Supabase)

Supabase provides:
- Point-in-time recovery (Pro plan)
- Daily backups (Free plan)

### Manual Backup

```bash
# Export data
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

---

## Performance Tips

1. **Use indexes** for frequently queried columns
2. **Partition large tables** (activity_log, agent_messages)
3. **Use connection pooling** (PgBouncer via Supabase)
4. **Archive old data** periodically
5. **Monitor slow queries** via Supabase dashboard
