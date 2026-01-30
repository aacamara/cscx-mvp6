# PRD-184: Zendesk Ticket Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-184 |
| **Title** | Zendesk Ticket Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs lack visibility into customer support interactions happening in Zendesk. Support ticket volume, sentiment, and escalation patterns are critical signals for customer health that currently require manual lookup or separate reporting. Without integration, CSMs miss early warning signs and cannot proactively address customer issues.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see all open support tickets for my accounts so that I can proactively reach out to struggling customers.
2. **As a CSM**, I want ticket escalations to trigger alerts so that I can engage before situations deteriorate.
3. **As a CS Leader**, I want support ticket trends included in health score calculations so that support experience impacts customer health visibility.

### Secondary User Stories
4. **As a CSM**, I want to see ticket history during customer conversations for full context.
5. **As a CSM**, I want ticket resolution satisfaction scores to inform relationship management.

## Functional Requirements

### FR-1: OAuth/API Authentication
- Support Zendesk OAuth 2.0 authentication
- Alternative API token authentication
- Multi-subdomain support
- Secure credential management

### FR-2: Ticket Data Sync
- Pull tickets with customer association
- Sync ticket fields:
  - Subject, description
  - Status, priority
  - Created/updated timestamps
  - Assigned agent
  - Tags and custom fields
- Real-time webhook for ticket updates

### FR-3: Customer Matching
- Match tickets to CSCX customers via:
  - Organization ID mapping
  - Email domain matching
  - Custom field association
- Handle unmatched tickets gracefully

### FR-4: Support Metrics Calculation
- Calculate per-customer metrics:
  - Open ticket count
  - Average resolution time
  - Escalation frequency
  - CSAT scores
- Update metrics on ticket changes

### FR-5: Health Score Integration
- Include support metrics in health score:
  - High open tickets = negative signal
  - Frequent escalations = negative signal
  - High CSAT = positive signal
- Configurable weight for support signals

### FR-6: Alert Triggers
- Trigger alerts for:
  - Ticket escalation
  - SLA breach
  - Ticket spike (3+ in 24 hours)
  - Negative CSAT response
- Route alerts to assigned CSM

## Non-Functional Requirements

### NFR-1: Performance
- Webhook processing < 3 seconds
- Historical sync: 10,000 tickets in 15 minutes
- Real-time ticket visibility

### NFR-2: Reliability
- 99.9% webhook delivery
- Retry failed syncs automatically
- Handle rate limits gracefully

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/zendesk/connect
GET    /api/integrations/zendesk/callback
POST   /api/integrations/zendesk/webhook
GET    /api/integrations/zendesk/tickets/:customerId
GET    /api/integrations/zendesk/metrics/:customerId
PUT    /api/integrations/zendesk/mapping
```

### Zendesk API Usage
```javascript
// Fetch tickets by organization
GET /api/v2/organizations/{org_id}/tickets.json
Authorization: Bearer {access_token}

// Incremental ticket export
GET /api/v2/incremental/tickets.json?start_time={unix_timestamp}

// Webhook payload handling
{
  "ticket": {
    "id": 123,
    "subject": "Issue with feature X",
    "status": "open",
    "priority": "high",
    "organization_id": 456
  }
}
```

### Database Schema
```sql
CREATE TABLE zendesk_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zendesk_ticket_id BIGINT UNIQUE,
  customer_id UUID REFERENCES customers(id),
  subject TEXT,
  description TEXT,
  status VARCHAR(20),
  priority VARCHAR(20),
  requester_email TEXT,
  assignee_name TEXT,
  tags TEXT[],
  satisfaction_rating VARCHAR(20),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE zendesk_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  metric_date DATE,
  open_tickets INTEGER,
  escalations INTEGER,
  avg_resolution_hours NUMERIC,
  csat_score NUMERIC,
  UNIQUE(customer_id, metric_date)
);
```

## User Interface

### Customer Ticket Panel
- List of open tickets with priority indicators
- Ticket count badge on customer card
- Quick actions: view in Zendesk, add note
- Ticket history timeline

### Support Metrics Widget
- Open tickets gauge
- CSAT trend chart
- Escalation history
- SLA compliance indicator

## Acceptance Criteria

### AC-1: Authentication
- [ ] OAuth flow completes successfully
- [ ] API token auth works as fallback
- [ ] Multiple subdomains supported

### AC-2: Ticket Sync
- [ ] Tickets sync with correct customer mapping
- [ ] Real-time updates via webhook
- [ ] Historical tickets import on connect

### AC-3: Metrics & Alerts
- [ ] Support metrics calculate correctly
- [ ] Escalation triggers CSM alert
- [ ] Health score includes support signals

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show support tickets for [account]" | Display ticket list |
| "Are there any escalated tickets?" | Filter escalations |
| "What's the support health for [account]?" | Show metrics |
| "Alert me on ticket escalations" | Configure alert |

### Quick Actions
- View open tickets
- See ticket history
- Check CSAT scores

## Success Metrics
| Metric | Target |
|--------|--------|
| Ticket sync latency | < 5 seconds |
| CSM escalation awareness | 95% within 1 hour |
| Support signal in health score | Included |

## Related PRDs
- PRD-087: Support Ticket Spike → Escalation
- PRD-102: Support Satisfaction Drop
- PRD-122: Support Ticket → CSM Visibility
