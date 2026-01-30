# PRD-198: Segment Data Sync

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-198 |
| **Title** | Segment Data Sync |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations using Segment as their customer data platform have a unified view of customer data that should flow into CSCX.AI. Without Segment integration, usage data, identity resolution, and behavioral events must be integrated separately from multiple sources.

## User Stories

### Primary User Stories
1. **As a Data Engineer**, I want to send customer data from Segment to CSCX.AI as a destination.
2. **As CSCX.AI**, I want to receive real-time usage events via Segment for immediate health score updates.
3. **As a CSM**, I want unified customer identity data from Segment.

### Secondary User Stories
4. **As an Admin**, I want to configure which Segment events map to CSCX.AI signals.
5. **As a Developer**, I want to use existing Segment instrumentation rather than building new.

## Functional Requirements

### FR-1: Segment Destination Setup
- CSCX.AI available as Segment destination
- Support track, identify, group calls
- Webhook-based ingestion

### FR-2: Event Ingestion
- Receive Segment events in real-time
- Parse and validate event structure
- Map to CSCX.AI data model
- Handle high-volume streams

### FR-3: Identity Resolution
- Process identify calls for user data
- Process group calls for account data
- Match to CSCX customers
- Handle anonymous to known transitions

### FR-4: Event Mapping
- Configure event to signal mapping:
  - `Feature Used` → adoption event
  - `Upgrade Started` → expansion signal
  - `Support Ticket Opened` → risk signal
- Custom mapping rules

### FR-5: Trait Sync
- Sync user traits to stakeholders
- Sync group traits to customers
- Support computed traits from Segment Personas

### FR-6: Real-Time Processing
- Process events within 1 second
- Trigger immediate health updates
- Enable real-time alerts

## Non-Functional Requirements

### NFR-1: Performance
- Handle 10,000 events/minute
- P99 latency < 500ms
- Graceful degradation under load

### NFR-2: Reliability
- At-least-once delivery
- Retry failed processing
- Dead letter queue for failures

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/segment/webhook
GET    /api/integrations/segment/config
PUT    /api/integrations/segment/mappings
GET    /api/segment/events/:customerId
```

### Segment Webhook Payload
```javascript
// Track event
{
  "type": "track",
  "event": "Feature Used",
  "userId": "user_123",
  "properties": {
    "feature_name": "Dashboard",
    "duration_seconds": 120
  },
  "context": {
    "groupId": "account_456"
  },
  "timestamp": "2026-01-29T10:00:00Z"
}

// Identify call
{
  "type": "identify",
  "userId": "user_123",
  "traits": {
    "email": "john@acmecorp.com",
    "name": "John Smith",
    "title": "VP Engineering"
  }
}

// Group call
{
  "type": "group",
  "groupId": "account_456",
  "traits": {
    "name": "Acme Corp",
    "industry": "Technology",
    "employee_count": 500
  }
}
```

### Database Schema
```sql
CREATE TABLE segment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  event_type VARCHAR(50),
  event_name TEXT,
  user_id TEXT,
  properties JSONB,
  processed BOOLEAN DEFAULT false,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE segment_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_event TEXT,
  cscx_signal_type VARCHAR(50),
  property_mappings JSONB,
  enabled BOOLEAN DEFAULT true
);
```

## User Interface

### Segment Configuration
- Connection instructions
- Write key display
- Event mapping interface
- Test event sender

### Event Monitor
- Real-time event stream
- Processing status
- Error details

## Acceptance Criteria

### AC-1: Connection
- [ ] Webhook receives events
- [ ] Events parse correctly
- [ ] Customer matching works

### AC-2: Processing
- [ ] Events trigger signals
- [ ] Identity data updates records
- [ ] Real-time processing works

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show Segment events for [account]" | Display recent events |
| "Configure Segment mapping" | Open config |

## Success Metrics
| Metric | Target |
|--------|--------|
| Event processing latency | < 500ms |
| Processing success rate | > 99.9% |

## Related PRDs
- PRD-195: Pendo Usage Data
- PRD-086: Usage Drop Alert
