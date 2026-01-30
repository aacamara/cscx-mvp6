# PRD-197: Mixpanel Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-197 |
| **Title** | Mixpanel Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations using Mixpanel for product analytics need their event data integrated with customer success workflows. CSMs require visibility into user behavior patterns, funnel performance, and engagement metrics from Mixpanel to make informed decisions about customer health.

## User Stories

### Primary User Stories
1. **As a CSM**, I want Mixpanel engagement data for my accounts available in CSCX.AI.
2. **As CSCX.AI**, I want to leverage Mixpanel event data for health scoring.
3. **As a CSM**, I want to see key funnel completion rates per account.

### Secondary User Stories
4. **As a CSM**, I want user segmentation data from Mixpanel.
5. **As an Analyst**, I want to correlate Mixpanel metrics with churn.

## Functional Requirements

### FR-1: API Integration
- Support Mixpanel Data Export API
- Support Mixpanel Query API (JQL)
- Service account authentication

### FR-2: Event Data Sync
- Aggregate events by account
- Track key metrics:
  - Event counts
  - Unique users
  - Session data
  - Property breakdowns
- Historical backfill

### FR-3: Funnel Performance
- Pull funnel conversion rates
- Track by account/cohort
- Identify bottlenecks

### FR-4: User Properties
- Sync user profiles with account mapping
- Track account-level aggregates
- Support custom properties

### FR-5: Insight Reports
- Pull saved reports data
- Sync dashboard metrics
- Scheduled refresh

### FR-6: Health Integration
- Map events to adoption signals
- Calculate engagement scores
- Trigger alerts on anomalies

## Non-Functional Requirements

### NFR-1: Performance
- Daily sync schedule
- Handle high-volume events
- Efficient aggregation

### NFR-2: Privacy
- Aggregate to account level
- No PII storage
- Respect data policies

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/mixpanel/connect
GET    /api/mixpanel/events/:customerId
GET    /api/mixpanel/funnels/:customerId
GET    /api/mixpanel/users/:customerId
POST   /api/mixpanel/sync
```

### Mixpanel API Usage
```javascript
// Query API (JQL)
POST https://mixpanel.com/api/2.0/jql
{
  "script": "function main() { return Events({from_date: '2026-01-01', to_date: '2026-01-31'}).groupByUser(['$distinct_id'], mixpanel.reducer.count()) }"
}

// Export raw events
GET https://data.mixpanel.com/api/2.0/export
?from_date=2026-01-01
&to_date=2026-01-31

// Funnels
GET https://mixpanel.com/api/2.0/funnels
?funnel_id=123
```

### Database Schema
```sql
CREATE TABLE mixpanel_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  mixpanel_group_id TEXT,
  metric_date DATE,
  total_events INTEGER,
  unique_users INTEGER,
  sessions INTEGER,
  avg_events_per_user NUMERIC,
  UNIQUE(customer_id, metric_date)
);

CREATE TABLE mixpanel_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  funnel_id TEXT,
  funnel_name TEXT,
  metric_date DATE,
  conversion_rate NUMERIC,
  completed_users INTEGER,
  drop_off_step INTEGER
);
```

## User Interface

### Event Dashboard
- Event volume chart
- Top events list
- User activity heatmap

### Funnel Widget
- Conversion visualization
- Step-by-step rates
- Trend comparison

## Acceptance Criteria

### AC-1: Connection
- [ ] API authentication works
- [ ] Events sync correctly

### AC-2: Metrics
- [ ] Aggregations accurate
- [ ] Funnels display properly

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show Mixpanel events for [account]" | Display events |
| "What's the funnel conversion for [account]?" | Show funnel |

## Success Metrics
| Metric | Target |
|--------|--------|
| Sync accuracy | > 99% |
| Data freshness | < 24 hours |

## Related PRDs
- PRD-195: Pendo Usage Data
- PRD-196: Amplitude Analytics Sync
