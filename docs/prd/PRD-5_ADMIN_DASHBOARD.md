# PRD-5: Admin Dashboard for Platform + Agent Performance + Token Consumption

**Status**: 🔴 Not Started
**Priority**: P1 - Important
**Last Updated**: 2026-02-01

---

## Goal

Admin user can view platform health and usage: agent performance, token consumption, costs proxy, job health, error rates, latency, and per-workspace usage.

---

## Requirements

| Req ID | Requirement |
|--------|-------------|
| FR-1 | Admin area accessible only to admin role |
| FR-2 | Overview KPIs: daily active workspaces/users, # actions, # errors, latency p95, success rate |
| FR-3 | Agents tab: per-agent metrics (invocations, success/fail, avg latency, retries) |
| FR-4 | Tokens tab: tokens by workspace, by agent, by day; cost estimation |
| FR-5 | Jobs tab: ingestion queue health, KB indexing success/failure, contract parsing stats |
| FR-6 | Support tab: open tickets, time-to-first-response, time-to-resolve |
| FR-7 | Drill-down: workspace detail view, user detail view |
| FR-8 | Export: CSV export for usage reports |

---

## Data Model

```sql
-- Metrics are aggregated from existing tables + new tracking

CREATE TABLE public.platform_metrics_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id),  -- null for platform-wide
  metric_type TEXT NOT NULL,  -- 'actions', 'errors', 'tokens', 'latency_p95', etc.
  value NUMERIC,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, workspace_id, metric_type)
);

CREATE TABLE public.agent_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name TEXT NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id),
  date DATE NOT NULL,
  invocations INTEGER DEFAULT 0,
  successes INTEGER DEFAULT 0,
  failures INTEGER DEFAULT 0,
  retries INTEGER DEFAULT 0,
  total_latency_ms BIGINT DEFAULT 0,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_name, workspace_id, date)
);

CREATE TABLE public.token_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES public.workspaces(id),
  user_id UUID REFERENCES public.users(id),
  agent_name TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd NUMERIC(10, 6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Contracts

### GET /api/admin/overview
Platform overview KPIs.

### GET /api/admin/agents
Agent performance metrics.

### GET /api/admin/tokens
Token consumption by workspace/agent/day.

### GET /api/admin/jobs
Job health metrics.

### GET /api/admin/support
Support ticket stats.

### GET /api/admin/workspaces/:id
Workspace detail metrics.

### GET /api/admin/export
CSV export of metrics.

---

## UI Components

### Overview Dashboard
- KPI cards: DAU, Actions, Errors, Success Rate, P95 Latency
- Trend charts for past 30 days
- Alert indicators for anomalies

### Agents Tab
- Table: Agent, Invocations, Success Rate, Avg Latency, Retries
- Click to expand for time-series chart

### Tokens Tab
- Total tokens (input/output) with cost estimate
- Breakdown by workspace, agent, model
- Time-series chart

### Jobs Tab
- Queue depth, processing rate
- Success/failure counts by job type
- Error log preview

### Support Tab
- Open tickets by severity
- SLA metrics: time to first response, time to resolve
- Ticket trend chart

---

## Test Plan

- Permission tests (admin-only access)
- Aggregation correctness tests with fixtures
- UI smoke test
- Export functionality test

---

## Definition of Done

- [ ] Admin role gating implemented
- [ ] Overview KPIs working
- [ ] Per-agent metrics working
- [ ] Token consumption tracking
- [ ] Job health monitoring
- [ ] Support ticket stats
- [ ] Drill-down views
- [ ] CSV export
- [ ] All tests passing
- [ ] Deployed to staging/production
