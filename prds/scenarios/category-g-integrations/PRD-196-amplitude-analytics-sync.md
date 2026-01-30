# PRD-196: Amplitude Analytics Sync

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-196 |
| **Title** | Amplitude Analytics Sync |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations using Amplitude for product analytics have rich behavioral data that CSMs cannot leverage within CSCX.AI. User engagement patterns, feature adoption funnels, and retention metrics captured in Amplitude are crucial for understanding customer health but require manual analysis.

## User Stories

### Primary User Stories
1. **As a CSM**, I want Amplitude engagement metrics for my accounts visible in CSCX.AI.
2. **As CSCX.AI**, I want to include Amplitude data in health score calculations.
3. **As a CSM**, I want to understand retention and stickiness metrics per account.

### Secondary User Stories
4. **As a CSM**, I want to see which user cohorts are most engaged per account.
5. **As a Product Manager**, I want account-level funnel completion data.

## Functional Requirements

### FR-1: API Integration
- Support Amplitude Export API
- Support Amplitude Dashboard REST API
- API key + secret authentication

### FR-2: Account-Level Metrics
- Sync aggregated metrics:
  - Active users (daily, weekly, monthly)
  - Session frequency
  - Event counts
  - Retention rates
- Map org_id to CSCX customers

### FR-3: Behavioral Cohorts
- Sync user segment membership
- Track power users per account
- Identify at-risk users (low engagement)

### FR-4: Funnel Analytics
- Pull funnel completion rates
- Track onboarding funnel per account
- Identify drop-off points

### FR-5: Stickiness Metrics
- Calculate DAU/MAU ratio
- Track session depth
- Monitor feature frequency

### FR-6: Health Score Integration
- Feed metrics into health calculations:
  - Retention rate component
  - Engagement depth component
  - Feature breadth component
- Configure thresholds

## Non-Functional Requirements

### NFR-1: Performance
- Handle large data exports
- Daily sync schedule
- Efficient aggregation

### NFR-2: Data Handling
- Respect data retention policies
- Aggregate before storage
- Privacy-conscious design

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/amplitude/connect
GET    /api/amplitude/metrics/:customerId
GET    /api/amplitude/funnels/:customerId
GET    /api/amplitude/retention/:customerId
POST   /api/amplitude/sync
```

### Amplitude API Usage
```javascript
// Dashboard API - Active users
GET https://amplitude.com/api/2/users
?start=2026-01-01
&end=2026-01-31
&m=active

// Export API - Events
GET https://amplitude.com/api/2/export
?start=20260101T00
&end=20260131T23

// Cohorts
GET https://amplitude.com/api/3/cohorts
```

### Database Schema
```sql
CREATE TABLE amplitude_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  amplitude_org_id TEXT,
  metric_date DATE,
  dau INTEGER,
  wau INTEGER,
  mau INTEGER,
  new_users INTEGER,
  session_count INTEGER,
  events_count INTEGER,
  retention_d1 NUMERIC,
  retention_d7 NUMERIC,
  retention_d30 NUMERIC,
  stickiness_ratio NUMERIC,
  UNIQUE(customer_id, metric_date)
);
```

## User Interface

### Engagement Dashboard
- Active users chart
- Retention curve
- Stickiness gauge
- Event volume trend

### Funnel Visualization
- Step-by-step completion
- Drop-off indicators
- Benchmark comparison

## Acceptance Criteria

### AC-1: Connection
- [ ] API authentication works
- [ ] Metrics sync correctly
- [ ] Customer mapping accurate

### AC-2: Metrics
- [ ] Active users accurate
- [ ] Retention calculated
- [ ] Funnels display correctly

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show Amplitude metrics for [account]" | Display dashboard |
| "What's the retention for [account]?" | Show retention |
| "How sticky is [account]?" | Show DAU/MAU |

## Success Metrics
| Metric | Target |
|--------|--------|
| Sync accuracy | > 99% |
| Data freshness | < 24 hours |

## Related PRDs
- PRD-195: Pendo Usage Data
- PRD-197: Mixpanel Integration
