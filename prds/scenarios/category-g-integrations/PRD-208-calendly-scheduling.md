# PRD-208: Calendly Scheduling

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-208 |
| **Title** | Calendly Scheduling |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs use Calendly for customer meeting scheduling but these bookings don't automatically flow into CSCX.AI. Meeting frequency and scheduling patterns are important engagement signals, and CSMs need to share scheduling links directly from the customer context.

## User Stories

### Primary User Stories
1. **As a CSM**, I want Calendly bookings with customers automatically linked to their records.
2. **As a CSM**, I want to share my Calendly link directly from the customer view with context.
3. **As CSCX.AI**, I want Calendly meeting data included in engagement metrics.

### Secondary User Stories
4. **As a CSM**, I want to see when customers last scheduled with me via Calendly.
5. **As a CS Leader**, I want visibility into meeting frequency via Calendly bookings.

## Functional Requirements

### FR-1: OAuth Authentication
- Support Calendly OAuth 2.0
- Request user and event scopes
- Personal calendar access

### FR-2: Event Sync
- Pull Calendly bookings
- Sync event data:
  - Event type
  - Invitee details
  - Start/end time
  - Status (active, canceled, rescheduled)
  - Location
- Match to customers via invitee email

### FR-3: Customer Linking
- Auto-link events via invitee email domain
- Match to stakeholder records
- Handle multiple attendees

### FR-4: Scheduling Links
- Generate one-time scheduling links
- Pre-fill invitee information
- Track link usage
- Include customer context in event

### FR-5: Webhook Events
- Real-time booking notifications:
  - Event created
  - Event canceled
  - Event rescheduled
- Create calendar entries in CSCX.AI

### FR-6: Event Types
- Sync available event types
- Map to meeting categories (QBR, check-in, demo)
- Recommend appropriate type per context

### FR-7: Engagement Metrics
- Track bookings per customer
- Calculate scheduling frequency
- Monitor no-show/cancellation rates
- Include in health score

## Non-Functional Requirements

### NFR-1: Performance
- Webhook processing < 3 seconds
- Link generation < 2 seconds

### NFR-2: Reliability
- Handle Calendly outages gracefully
- Retry failed syncs

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/calendly/connect
GET    /api/integrations/calendly/callback
POST   /api/integrations/calendly/webhook
GET    /api/calendly/events/:customerId
GET    /api/calendly/event-types
POST   /api/calendly/scheduling-link
GET    /api/calendly/metrics/:customerId
```

### Calendly API Usage
```javascript
// List scheduled events
GET https://api.calendly.com/scheduled_events
?user=https://api.calendly.com/users/{user_id}
&invitee_email=*@acmecorp.com
&status=active

// Get event types
GET https://api.calendly.com/event_types
?user=https://api.calendly.com/users/{user_id}

// Create single-use link
POST https://api.calendly.com/scheduling_links
{
  "max_event_count": 1,
  "owner": "https://api.calendly.com/event_types/{event_type_uuid}",
  "owner_type": "EventType"
}

// Webhook payload
{
  "event": "invitee.created",
  "payload": {
    "event": "https://api.calendly.com/scheduled_events/abc123",
    "invitee": {
      "email": "john@acmecorp.com",
      "name": "John Smith"
    }
  }
}
```

### Database Schema
```sql
CREATE TABLE calendly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendly_event_id TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id),
  stakeholder_id UUID REFERENCES stakeholders(id),
  event_type TEXT,
  event_name TEXT,
  invitee_email TEXT,
  invitee_name TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status VARCHAR(20),
  location TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE calendly_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  booking_url TEXT,
  event_type TEXT,
  created_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ
);
```

## User Interface

### Customer Meetings Panel
- Upcoming Calendly bookings
- Past meetings list
- Quick schedule button

### Schedule Link Generator
- Select event type
- Generate link
- Copy to clipboard
- Track usage

### Engagement Metrics Widget
- Booking frequency
- Last scheduled date
- Cancellation rate

## Acceptance Criteria

### AC-1: Connection
- [ ] OAuth completes successfully
- [ ] Events sync correctly

### AC-2: Functionality
- [ ] Customer linking accurate
- [ ] Link generation works
- [ ] Webhooks process real-time

### AC-3: Metrics
- [ ] Engagement tracked
- [ ] Health score integration

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Send Calendly link to [stakeholder]" | Generate and share |
| "When did [account] last schedule with me?" | Check history |
| "Show Calendly bookings for [account]" | Display events |

## Success Metrics
| Metric | Target |
|--------|--------|
| Booking sync latency | < 1 minute |
| Link usage tracking | 100% |
| Engagement metric accuracy | > 99% |

## Related PRDs
- PRD-188: Google Calendar Sync
- PRD-036: Meeting Request Optimizer
