# PRD-185: Intercom Conversation Sync

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-185 |
| **Title** | Intercom Conversation Sync |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Customer conversations happening in Intercom represent valuable engagement and sentiment data that CSMs cannot currently access within CSCX.AI. Chat interactions often surface product issues, feature requests, and satisfaction signals that should inform customer health and CSM outreach decisions.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see Intercom conversation history for my accounts so that I understand recent customer interactions and sentiment.
2. **As a CSM**, I want to be alerted when a customer has multiple frustrated conversations so that I can intervene proactively.
3. **As a CS Leader**, I want Intercom engagement metrics included in customer health calculations.

### Secondary User Stories
4. **As a CSM**, I want conversation themes analyzed to identify common issues across my portfolio.
5. **As a Product Manager**, I want aggregated feedback from Intercom visible in CSCX.AI for product planning.

## Functional Requirements

### FR-1: OAuth Authentication
- Support Intercom OAuth 2.0
- Request scopes: read conversations, read users, read companies
- Secure token storage and refresh

### FR-2: Conversation Sync
- Pull conversations by company/user
- Sync conversation attributes:
  - Subject/title
  - Full transcript
  - State (open, closed, snoozed)
  - Assignee
  - Tags
  - Timestamps
- Incremental sync via updated_at

### FR-3: Company/User Matching
- Match Intercom companies to CSCX customers
- Map by company ID, domain, or name
- Associate users as stakeholders
- Handle unmatched conversations

### FR-4: Sentiment Analysis
- Analyze conversation sentiment via AI
- Classify: positive, neutral, negative, frustrated
- Track sentiment trends per customer
- Alert on negative sentiment spikes

### FR-5: Engagement Metrics
- Calculate conversation metrics:
  - Conversation volume
  - Response times
  - Resolution rate
  - Repeat contact rate
- Include in health score calculation

### FR-6: Theme Extraction
- Extract common topics from conversations
- Categorize: support, feature request, bug, billing
- Aggregate themes per customer and portfolio

## Non-Functional Requirements

### NFR-1: Performance
- Sync 10,000 conversations in 20 minutes
- Real-time webhook processing < 5 seconds

### NFR-2: Privacy
- Respect data retention policies
- Option to exclude sensitive conversations
- GDPR compliance for EU customers

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/intercom/connect
GET    /api/integrations/intercom/callback
POST   /api/integrations/intercom/webhook
GET    /api/integrations/intercom/conversations/:customerId
GET    /api/integrations/intercom/analytics/:customerId
```

### Intercom API Usage
```javascript
// List conversations
GET /conversations
Authorization: Bearer {access_token}
Accept: application/json

// Get conversation with parts
GET /conversations/{id}?display_as=plaintext

// Search conversations by company
POST /conversations/search
{
  "query": {
    "field": "company.company_id",
    "operator": "=",
    "value": "company_123"
  }
}
```

### Database Schema
```sql
CREATE TABLE intercom_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intercom_id VARCHAR(50) UNIQUE,
  customer_id UUID REFERENCES customers(id),
  subject TEXT,
  state VARCHAR(20),
  sentiment VARCHAR(20),
  sentiment_score NUMERIC,
  tags TEXT[],
  themes TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE TABLE intercom_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES intercom_conversations(id),
  author_type VARCHAR(20), -- user, admin, bot
  body TEXT,
  created_at TIMESTAMPTZ
);
```

## User Interface

### Conversation Timeline
- Chronological conversation list
- Sentiment indicators
- Quick filters: open, closed, negative
- Search within conversations

### Engagement Widget
- Conversation volume trend
- Sentiment distribution pie chart
- Top themes word cloud
- Recent conversations preview

## Acceptance Criteria

### AC-1: Authentication
- [ ] OAuth flow works correctly
- [ ] Token refresh handled
- [ ] Webhook verification works

### AC-2: Conversation Sync
- [ ] Conversations sync with customer matching
- [ ] Full transcripts available
- [ ] Real-time updates via webhook

### AC-3: Analytics
- [ ] Sentiment analysis runs on sync
- [ ] Themes extracted correctly
- [ ] Metrics calculate accurately

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show Intercom conversations for [account]" | Display conversations |
| "What are customers talking about?" | Show theme analysis |
| "Any frustrated customers in Intercom?" | Filter negative sentiment |

## Success Metrics
| Metric | Target |
|--------|--------|
| Conversation sync accuracy | > 99% |
| Sentiment classification accuracy | > 85% |
| CSM engagement with data | Weekly use |

## Related PRDs
- PRD-184: Zendesk Ticket Integration
- PRD-218: Real-Time Sentiment Analysis
