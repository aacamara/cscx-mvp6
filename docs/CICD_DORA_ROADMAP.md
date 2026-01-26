# CI/CD & DORA Metrics Roadmap

**Status:** NOT IMPLEMENTED
**Priority:** High (P0)
**Last Updated:** 2026-01-22

---

## Current State

### GitHub Actions
**Status:** No workflows exist
**Location:** `.github/workflows/` (empty/missing)

### DORA Metrics
**Status:** Not tracked
**Definition:** DevOps Research and Assessment metrics

---

## DORA Metrics Overview

DORA metrics are the four key metrics that indicate software delivery performance:

| Metric | What It Measures | Target (Elite) |
|--------|------------------|----------------|
| **Deployment Frequency** | How often code deploys to production | On-demand (multiple per day) |
| **Lead Time for Changes** | Time from commit to production | Less than 1 hour |
| **Change Failure Rate** | % of deployments causing failures | 0-15% |
| **Time to Restore Service** | Time to recover from failures | Less than 1 hour |

---

## Proposed GitHub Actions Workflows

### 1. CI Pipeline (`ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/
```

### 2. CD Pipeline (`deploy.yml`)

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Build
        run: |
          npm ci
          npm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

      - name: Record Deployment
        run: |
          echo "DEPLOY_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> $GITHUB_ENV
          echo "COMMIT_SHA=${{ github.sha }}" >> $GITHUB_ENV
```

### 3. DORA Metrics Tracking (`dora-metrics.yml`)

```yaml
name: DORA Metrics

on:
  deployment:
  workflow_run:
    workflows: ["Deploy"]
    types: [completed]

jobs:
  record-metrics:
    runs-on: ubuntu-latest
    steps:
      - name: Calculate Lead Time
        id: lead-time
        run: |
          # Get commit timestamp
          COMMIT_TIME=$(git log -1 --format=%ct ${{ github.sha }})
          DEPLOY_TIME=$(date +%s)
          LEAD_TIME=$((DEPLOY_TIME - COMMIT_TIME))
          echo "lead_time_seconds=$LEAD_TIME" >> $GITHUB_OUTPUT

      - name: Record to Supabase
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: |
          curl -X POST "$SUPABASE_URL/rest/v1/dora_metrics" \
            -H "apikey: $SUPABASE_KEY" \
            -H "Content-Type: application/json" \
            -d '{
              "metric_type": "deployment",
              "commit_sha": "${{ github.sha }}",
              "lead_time_seconds": ${{ steps.lead-time.outputs.lead_time_seconds }},
              "success": ${{ job.status == 'success' }},
              "environment": "production"
            }'
```

---

## Database Schema for DORA Metrics

```sql
-- Migration: xxx_dora_metrics.sql

CREATE TABLE dora_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL, -- deployment, incident, recovery
  commit_sha VARCHAR(40),
  branch VARCHAR(100),
  environment VARCHAR(50) DEFAULT 'production',

  -- Deployment metrics
  lead_time_seconds INT,
  success BOOLEAN DEFAULT TRUE,

  -- Incident metrics
  incident_id VARCHAR(100),
  time_to_restore_seconds INT,

  -- Metadata
  triggered_by VARCHAR(100),
  workflow_run_id BIGINT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dora_metrics_type ON dora_metrics(metric_type, created_at DESC);
CREATE INDEX idx_dora_metrics_env ON dora_metrics(environment, created_at DESC);

-- View for calculating DORA metrics
CREATE VIEW dora_summary AS
SELECT
  date_trunc('week', created_at) AS week,

  -- Deployment Frequency
  COUNT(*) FILTER (WHERE metric_type = 'deployment' AND success = TRUE) AS deployments,

  -- Lead Time (avg in hours)
  AVG(lead_time_seconds) FILTER (WHERE metric_type = 'deployment') / 3600 AS avg_lead_time_hours,

  -- Change Failure Rate
  (COUNT(*) FILTER (WHERE metric_type = 'deployment' AND success = FALSE)::FLOAT /
   NULLIF(COUNT(*) FILTER (WHERE metric_type = 'deployment'), 0) * 100) AS change_failure_rate,

  -- Mean Time to Restore (in hours)
  AVG(time_to_restore_seconds) FILTER (WHERE metric_type = 'recovery') / 3600 AS mttr_hours

FROM dora_metrics
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY date_trunc('week', created_at)
ORDER BY week DESC;
```

---

## Implementation Plan

### Phase 1: Basic CI (Week 1)
1. [ ] Create `.github/workflows/ci.yml`
2. [ ] Add lint, typecheck, test jobs
3. [ ] Configure branch protection rules
4. [ ] Set up PR checks

### Phase 2: CD Pipeline (Week 2)
1. [ ] Choose deployment target (Vercel/Railway/Fly.io)
2. [ ] Create `.github/workflows/deploy.yml`
3. [ ] Set up environment secrets
4. [ ] Configure production environment

### Phase 3: DORA Tracking (Week 3)
1. [ ] Create `dora_metrics` table in Supabase
2. [ ] Create `.github/workflows/dora-metrics.yml`
3. [ ] Build dashboard view for metrics
4. [ ] Set up alerts for degradation

### Phase 4: Monitoring (Week 4)
1. [ ] Add incident tracking workflow
2. [ ] Set up PagerDuty/Opsgenie integration
3. [ ] Create weekly DORA report automation
4. [ ] Define SLOs based on metrics

---

## Recommended Tools

| Category | Tool | Purpose |
|----------|------|---------|
| **CI/CD** | GitHub Actions | Automation |
| **Hosting** | Vercel | Frontend deployment |
| **Backend** | Railway / Fly.io | Backend deployment |
| **Database** | Supabase | Already in use |
| **Monitoring** | Sentry | Error tracking |
| **Metrics** | Datadog / Grafana Cloud | DORA dashboards |
| **Incidents** | PagerDuty | On-call alerting |

---

## Quick Start

To implement basic CI immediately:

```bash
# Create workflow directory
mkdir -p .github/workflows

# Create basic CI workflow
cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run build
EOF

# Commit and push
git add .github/workflows/ci.yml
git commit -m "Add CI workflow"
git push
```

---

## References

- [DORA Metrics](https://dora.dev/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Accelerate Book](https://itrevolution.com/product/accelerate/)
