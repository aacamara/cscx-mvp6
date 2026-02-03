# PRD: Executive Command Center

## Introduction

The Executive Command Center provides leadership with portfolio-level visibility into customer health, team performance, and business outcomes. VP of CS, CROs, and executives can monitor ARR retention, expansion pipeline, risk exposure, and CSM workload through real-time dashboards without diving into individual accounts.

This addresses the need for strategic oversight and data-driven decision making at the leadership level.

## Goals

- Real-time portfolio health visibility for executives
- Team performance metrics and benchmarking
- ARR retention and expansion tracking
- Risk exposure and mitigation progress
- CSM workload and capacity planning
- Drill-down from portfolio to segment to account

## User Stories

### US-001: Portfolio health summary
**Description:** As a VP of CS, I want a portfolio health summary so that I know overall customer health at a glance.

**Acceptance Criteria:**
- [ ] Total customers, ARR, and average health score
- [ ] Health distribution chart (% healthy, at-risk, critical)
- [ ] Trend indicators (improving, stable, declining)
- [ ] Comparison to previous period (MoM, QoQ)
- [ ] Segment breakdown (Enterprise, Mid-market, SMB)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: ARR retention metrics
**Description:** As a CRO, I want to see ARR retention metrics so that I understand revenue health.

**Acceptance Criteria:**
- [ ] Gross Revenue Retention (GRR) current and trending
- [ ] Net Revenue Retention (NRR) current and trending
- [ ] Churned ARR (actual and forecast)
- [ ] Expansion ARR (actual and forecast)
- [ ] Contraction ARR (downgrades)
- [ ] Cohort analysis (retention by signup quarter)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Risk exposure dashboard
**Description:** As a VP of CS, I want to see risk exposure so that I can allocate resources to save accounts.

**Acceptance Criteria:**
- [ ] Total ARR at risk (sum of high-risk customer ARR)
- [ ] Risk trend (improving or worsening)
- [ ] Top 10 at-risk accounts with health score and ARR
- [ ] Risk by segment (which segments are struggling)
- [ ] Risk by CSM (which CSMs have concentrated risk)
- [ ] Active save plays count and success rate
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Renewal pipeline
**Description:** As a VP of CS, I want to see the renewal pipeline so that I can forecast retention.

**Acceptance Criteria:**
- [ ] Renewals due this quarter with forecast status
- [ ] Renewal pipeline stages (On track, At risk, Churned)
- [ ] ARR by stage
- [ ] Late renewals (overdue without resolution)
- [ ] Upcoming renewals (30/60/90 days)
- [ ] Renewal rate forecast vs target
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Expansion pipeline
**Description:** As a CRO, I want to see the expansion pipeline so that I can forecast growth.

**Acceptance Criteria:**
- [ ] Total expansion opportunity value
- [ ] Expansion by type (upsell, cross-sell, upgrade)
- [ ] Expansion pipeline stages
- [ ] Top 10 expansion opportunities with details
- [ ] Expansion win rate (actual vs forecast)
- [ ] Expansion ARR vs target
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: CSM performance metrics
**Description:** As a VP of CS, I want to see CSM performance metrics so that I can coach and reward appropriately.

**Acceptance Criteria:**
- [ ] CSM leaderboard (retention rate, expansion, health improvement)
- [ ] Per-CSM metrics: accounts, ARR, health score average, response time
- [ ] Portfolio health by CSM
- [ ] Activity metrics (meetings, emails, tasks completed)
- [ ] Comparison to team average
- [ ] Trend by CSM over time
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: CSM workload and capacity
**Description:** As a VP of CS, I want to see CSM workload so that I can balance assignments.

**Acceptance Criteria:**
- [ ] Accounts per CSM vs target
- [ ] ARR per CSM vs target
- [ ] At-risk accounts per CSM
- [ ] Upcoming renewals per CSM
- [ ] Capacity utilization (current vs ideal)
- [ ] Rebalancing recommendations
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Executive alerts
**Description:** As a VP of CS, I want alerts for significant events so that I'm informed proactively.

**Acceptance Criteria:**
- [ ] Alert: Large account (>$100K ARR) health drops to critical
- [ ] Alert: CSM workload exceeds threshold
- [ ] Alert: Renewal at risk within 30 days
- [ ] Alert: Unexpected churn (account marked churned)
- [ ] Alert: Major expansion closed
- [ ] Email digest option (daily, weekly)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Segment comparison
**Description:** As a VP of CS, I want to compare segments so that I can identify patterns.

**Acceptance Criteria:**
- [ ] Side-by-side segment metrics (Enterprise vs Mid-market vs SMB)
- [ ] Health score by segment
- [ ] Retention rate by segment
- [ ] Expansion rate by segment
- [ ] Time to value by segment
- [ ] Support ticket volume by segment
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Custom date ranges
**Description:** As an executive, I want to select custom date ranges so that I can analyze specific periods.

**Acceptance Criteria:**
- [ ] Preset ranges: This month, Last month, This quarter, Last quarter, YTD
- [ ] Custom date range picker
- [ ] Comparison period selection (vs previous period, vs same period last year)
- [ ] All dashboard widgets update based on selection
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: Export and reporting
**Description:** As a VP of CS, I want to export dashboard data so that I can share in board meetings.

**Acceptance Criteria:**
- [ ] Export to PDF (formatted report)
- [ ] Export to Excel (raw data)
- [ ] Scheduled email reports (weekly, monthly)
- [ ] Shareable link (read-only access)
- [ ] Export includes date range and filters applied
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-012: Drill-down navigation
**Description:** As an executive, I want to drill down from metrics to details so that I can investigate issues.

**Acceptance Criteria:**
- [ ] Click ARR at risk → See list of at-risk accounts
- [ ] Click CSM name → See CSM's portfolio details
- [ ] Click segment → See segment-filtered dashboard
- [ ] Click customer → Navigate to customer detail
- [ ] Breadcrumb navigation back to overview
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Dashboard data aggregated from existing tables (customers, health_scores, renewal_pipeline, etc.)
- FR-2: Aggregations cached in `dashboard_metrics` table, refreshed every 15 minutes
- FR-3: Role-based access: Executive dashboard requires VP or Admin role
- FR-4: Date range filters apply to all widgets consistently
- FR-5: Drill-down maintains filter context
- FR-6: Alerts stored in `executive_alerts` table with severity, acknowledged status
- FR-7: PDF export uses Puppeteer for rendering
- FR-8: Scheduled reports use cron job with email delivery
- FR-9: Leaderboard rankings calculated nightly
- FR-10: YoY comparisons require 12+ months of data

## Non-Goals

- No board deck generation (just data export)
- No financial forecasting (that's finance's responsibility)
- No goal setting UI (goals set externally for now)
- No customer-facing portal metrics (internal only)
- No real-time streaming updates (15-minute refresh sufficient)

## Technical Considerations

- Pre-aggregate metrics to avoid expensive queries on dashboard load
- Consider materialized views for complex aggregations
- Use caching (Redis) for dashboard widget data
- PDF generation can be slow; use background job with download link
- Role-based access via existing auth system (add VP, Admin roles)

## Design Considerations

- Executive dashboards should be scannable in <5 seconds
- Use consistent color coding (green=good, yellow=warning, red=critical)
- Mobile-responsive for executives checking on mobile
- Print-friendly layout for PDF export
- Minimize cognitive load (key metrics first, details on drill-down)

## Success Metrics

- 80% of VP+ users access dashboard at least weekly
- Time to identify at-risk accounts reduced from days to minutes
- Board meeting prep time reduced by 60%
- Data-driven conversations in leadership meetings increase 50%

## Open Questions

- Should executives have direct communication capability (email account from dashboard)?
- How to handle multi-team orgs (VP sees only their team vs all teams)?
- Should historical snapshots be preserved (month-end snapshots)?
- What's the minimum data period before showing trends?
