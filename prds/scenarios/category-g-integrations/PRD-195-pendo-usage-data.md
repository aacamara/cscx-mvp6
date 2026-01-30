# PRD-195: Pendo Usage Data

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-195 |
| **Title** | Pendo Usage Data |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Product usage data captured in Pendo is essential for understanding customer adoption and health, but CSMs must access Pendo separately to understand how customers are using the product. Without integrated usage data, health scores cannot accurately reflect product engagement.

## User Stories

### Primary User Stories
1. **As a CSM**, I want Pendo usage metrics visible in CSCX.AI so I can see adoption at a glance in customer context.
2. **As CSCX.AI**, I want to include Pendo usage data in health score calculations for accurate adoption scoring.
3. **As a CSM**, I want alerts when Pendo shows significant usage drops for my accounts.

### Secondary User Stories
4. **As a CSM**, I want to see which features customers are using vs not using for targeted enablement.
5. **As a CS Leader**, I want portfolio-wide adoption trends from Pendo data.

## Functional Requirements

### FR-1: API Integration
- Support Pendo Aggregation API
- API key authentication
- Rate limit handling

### FR-2: Account Usage Sync
- Pull account-level metrics:
  - Active users (DAU, WAU, MAU)
  - Session counts
  - Time in app
  - Feature usage matrix
  - Guide completion rates
- Map to CSCX customers

### FR-3: Feature Adoption Tracking
- Sync feature usage by account
- Track:
  - Feature views
  - Feature clicks
  - Time on feature
  - Adoption percentage
- Compare to peer accounts

### FR-4: Guide Analytics
- Pull guide completion data
- Track in-app messaging engagement
- Associate with onboarding progress

### FR-5: Health Score Integration
- Feed Pendo metrics into health score:
  - DAU/MAU ratio → engagement component
  - Feature breadth → adoption component
  - Usage trend → trajectory component
- Configurable weights

### FR-6: Usage Alerts
- Trigger alerts on:
  - Usage drop > 20%
  - Key feature abandonment
  - No login in X days
  - Guide dismissal patterns
- Route to assigned CSM

### FR-7: Visitor-Level Data (Optional)
- Pull individual user activity
- Map to stakeholders
- Track champion engagement

## Non-Functional Requirements

### NFR-1: Performance
- Daily sync of account metrics
- Historical data backfill (90 days)
- Efficient aggregation handling

### NFR-2: Data Quality
- Handle missing data gracefully
- Validate metric calculations
- Audit sync accuracy

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/pendo/connect
GET    /api/pendo/accounts
GET    /api/pendo/accounts/:id/usage
GET    /api/pendo/accounts/:id/features
GET    /api/pendo/accounts/:id/guides
GET    /api/pendo/customer/:customerId/metrics
POST   /api/pendo/sync
```

### Pendo API Usage
```javascript
// Account usage metrics
POST https://app.pendo.io/api/v1/aggregation
{
  "response": {
    "mimeType": "application/json"
  },
  "request": {
    "pipeline": [
      {
        "source": {
          "accountMetrics": {
            "timeSeries": {
              "first": "2026-01-01",
              "last": "2026-01-31"
            }
          }
        }
      },
      {
        "identified": "accountMetrics"
      }
    ]
  }
}

// Feature usage
POST https://app.pendo.io/api/v1/aggregation
{
  "request": {
    "pipeline": [
      {
        "source": {
          "features": null
        }
      },
      {
        "filter": "accountId == 'account_123'"
      }
    ]
  }
}
```

### Database Schema
```sql
CREATE TABLE pendo_usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  pendo_account_id TEXT,
  metric_date DATE,
  dau INTEGER,
  wau INTEGER,
  mau INTEGER,
  session_count INTEGER,
  avg_session_minutes NUMERIC,
  page_views INTEGER,
  feature_events INTEGER,
  active_visitors INTEGER,
  UNIQUE(customer_id, metric_date)
);

CREATE TABLE pendo_feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  feature_id TEXT,
  feature_name TEXT,
  metric_date DATE,
  views INTEGER,
  clicks INTEGER,
  unique_visitors INTEGER,
  avg_time_seconds NUMERIC,
  UNIQUE(customer_id, feature_id, metric_date)
);

CREATE TABLE pendo_account_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  pendo_account_id TEXT UNIQUE,
  mapped_at TIMESTAMPTZ
);
```

## User Interface

### Usage Dashboard Widget
- Active users trend chart
- Session metrics
- DAU/MAU ratio gauge
- Comparison to average

### Feature Adoption Matrix
- Feature list with adoption %
- Heatmap view
- Drill-down to details

### Usage Alerts Panel
- Recent drops flagged
- Suggested actions
- Acknowledge/dismiss

## Acceptance Criteria

### AC-1: Connection
- [ ] API key authentication works
- [ ] Account mapping successful
- [ ] Data syncs correctly

### AC-2: Metrics
- [ ] DAU/WAU/MAU accurate
- [ ] Feature usage tracked
- [ ] Trends calculate correctly

### AC-3: Health Integration
- [ ] Usage feeds health score
- [ ] Alerts trigger on drops
- [ ] Weights configurable

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "How is [account] using the product?" | Show usage metrics |
| "What features is [account] not using?" | Show adoption gaps |
| "Show usage trend for [account]" | Display chart |
| "Any usage alerts for my portfolio?" | List alerts |

## Success Metrics
| Metric | Target |
|--------|--------|
| Sync accuracy | > 99% |
| Usage data freshness | < 24 hours |
| Health score accuracy improvement | +15% |

## Related PRDs
- PRD-196: Amplitude Analytics Sync
- PRD-197: Mixpanel Integration
- PRD-064: Product Adoption Dashboard
