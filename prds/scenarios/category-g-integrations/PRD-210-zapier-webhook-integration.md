# PRD-210: Zapier Webhook Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-210 |
| **Title** | Zapier Webhook Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSCX.AI cannot connect to the long tail of tools that CSMs use without building direct integrations for each one. Zapier provides a universal connector to 5000+ apps, allowing customers to create custom integrations without code and enabling CSCX.AI to both send and receive data from virtually any system.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to connect CSCX.AI to tools we use (that don't have direct integrations) via Zapier.
2. **As an Admin**, I want CSCX.AI events to trigger Zapier workflows for custom automations.
3. **As an Operations person**, I want data from other tools to flow into CSCX.AI via Zapier.

### Secondary User Stories
4. **As a CSM**, I want to use pre-built Zap templates for common use cases.
5. **As a Developer**, I want API access to trigger CSCX.AI actions from external systems.

## Functional Requirements

### FR-1: Webhook Triggers (CSCX.AI → Zapier)
- Send webhooks on CSCX.AI events:
  - Health score changed
  - Customer created/updated
  - Risk signal detected
  - Renewal approaching
  - Task created/completed
  - Approval requested
- Configurable per-event webhooks
- Secure webhook signing

### FR-2: Webhook Actions (Zapier → CSCX.AI)
- Receive webhooks to:
  - Create/update customer
  - Add stakeholder
  - Log activity
  - Create task
  - Create risk signal
  - Update health score component
- API key authentication
- Payload validation

### FR-3: Zapier App Configuration
- CSCX.AI available as Zapier app
- Trigger events documented
- Action endpoints available
- OAuth for user authentication

### FR-4: Webhook Management
- Configure outbound webhooks
- Test webhook delivery
- View delivery history
- Retry failed deliveries

### FR-5: Template Library
- Pre-built Zap templates:
  - "New Slack message → Log CSCX activity"
  - "CSCX health drop → Slack alert"
  - "New Typeform response → CSCX task"
  - "CSCX renewal alert → Asana task"
- Template sharing

### FR-6: Custom Webhook Builder
- Create custom webhooks without Zapier
- Configure URL, headers, payload
- Map CSCX.AI fields to payload
- Test and validate

### FR-7: Incoming Webhook Parser
- Accept various payload formats
- Field mapping configuration
- Data transformation
- Error handling with feedback

## Non-Functional Requirements

### NFR-1: Performance
- Webhook delivery < 5 seconds
- Incoming processing < 3 seconds
- Support 1000 webhooks/minute

### NFR-2: Reliability
- 99.9% delivery rate
- Retry with exponential backoff
- Dead letter queue

### NFR-3: Security
- HMAC signature verification
- API key rotation
- Rate limiting

## Technical Implementation

### API Endpoints
```
# Outbound webhook configuration
POST   /api/webhooks/outbound
GET    /api/webhooks/outbound
PUT    /api/webhooks/outbound/:id
DELETE /api/webhooks/outbound/:id
POST   /api/webhooks/outbound/:id/test
GET    /api/webhooks/outbound/:id/logs

# Inbound webhook handlers
POST   /api/webhooks/inbound/:token
POST   /api/zapier/customers
POST   /api/zapier/activities
POST   /api/zapier/tasks
POST   /api/zapier/signals

# Zapier app endpoints
GET    /api/zapier/triggers
GET    /api/zapier/actions
POST   /api/zapier/subscribe
DELETE /api/zapier/unsubscribe/:id
```

### Outbound Webhook Payload
```javascript
// Health score change event
{
  "event": "health_score.changed",
  "timestamp": "2026-01-29T10:00:00Z",
  "data": {
    "customer_id": "cust_123",
    "customer_name": "Acme Corp",
    "previous_score": 85,
    "new_score": 62,
    "change": -23,
    "trend": "declining",
    "csm_email": "csm@company.com"
  },
  "signature": "sha256=abc123..."
}

// Risk signal detected
{
  "event": "risk_signal.created",
  "timestamp": "2026-01-29T10:05:00Z",
  "data": {
    "customer_id": "cust_123",
    "customer_name": "Acme Corp",
    "signal_type": "champion_left",
    "severity": "high",
    "description": "Primary champion Sarah Johnson has left the company",
    "arr_at_risk": 50000
  }
}
```

### Inbound Webhook Processing
```javascript
// Expected inbound format
POST /api/zapier/activities
{
  "customer_id": "cust_123",  // or customer_name for lookup
  "activity_type": "support_call",
  "description": "Customer called about billing issue",
  "occurred_at": "2026-01-29T09:00:00Z",
  "metadata": {
    "source": "zendesk",
    "ticket_id": "12345"
  }
}
```

### Database Schema
```sql
CREATE TABLE outbound_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT,
  url TEXT,
  events TEXT[], -- events to trigger on
  headers JSONB,
  active BOOLEAN DEFAULT true,
  secret TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES outbound_webhooks(id),
  event_type TEXT,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0
);

CREATE TABLE inbound_webhook_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  token TEXT UNIQUE,
  name TEXT,
  action_type TEXT,
  field_mapping JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
);

CREATE TABLE inbound_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES inbound_webhook_tokens(id),
  payload JSONB,
  processed BOOLEAN,
  error_message TEXT,
  received_at TIMESTAMPTZ
);
```

## User Interface

### Webhook Configuration
- Outbound webhook list
- Event type checkboxes
- URL and header configuration
- Test button
- Delivery logs

### Inbound Webhook Setup
- Generate webhook URL
- Configure field mapping
- Test with sample payload
- View received data

### Zapier Template Gallery
- Browse templates by use case
- One-click install
- Customization options

### Delivery Monitor
- Real-time delivery status
- Success/failure rates
- Error details
- Retry controls

## Acceptance Criteria

### AC-1: Outbound Webhooks
- [ ] Can configure webhook for any event
- [ ] Webhooks deliver reliably
- [ ] Signature verification works
- [ ] Retry mechanism functions

### AC-2: Inbound Webhooks
- [ ] Webhooks process correctly
- [ ] Field mapping works
- [ ] Validation provides feedback
- [ ] Records created in CSCX.AI

### AC-3: Zapier Integration
- [ ] CSCX.AI appears in Zapier
- [ ] Triggers work
- [ ] Actions work
- [ ] OAuth authenticates properly

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Set up a webhook for health alerts" | Open configuration |
| "Show webhook delivery status" | Display logs |
| "Create Zapier connection" | Start setup |
| "Test the Slack webhook" | Send test |

## Success Metrics
| Metric | Target |
|--------|--------|
| Webhook delivery rate | > 99.9% |
| Delivery latency | < 5 seconds |
| Inbound processing success | > 99% |
| Customer integration adoption | 50%+ |

## Related PRDs
- PRD-186: Slack Notification Integration
- PRD-086: Usage Drop Alert
- PRD-116: Post-Call Processing
