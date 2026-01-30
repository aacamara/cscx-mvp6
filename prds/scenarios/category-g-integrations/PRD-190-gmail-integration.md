# PRD-190: Gmail Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-190 |
| **Title** | Gmail Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs send hundreds of customer emails but this communication data doesn't automatically flow into CSCX.AI. Email frequency, response times, and sentiment are critical engagement signals. Additionally, CSMs must switch between CSCX.AI and Gmail to compose customer communications, losing customer context.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to send emails to customers directly from CSCX.AI with full customer context available while composing.
2. **As a CSM**, I want my Gmail conversations with customers automatically tracked and visible in account history.
3. **As CSCX.AI**, I want email engagement metrics included in customer health calculations.

### Secondary User Stories
4. **As a CSM**, I want AI-generated email drafts based on customer context and communication history.
5. **As a CSM**, I want email templates with automatic variable substitution for personalization.

## Functional Requirements

### FR-1: Google OAuth Integration
- Support Google OAuth 2.0 for Gmail access
- Request scopes:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.send`
  - `https://www.googleapis.com/auth/gmail.compose`
  - `https://www.googleapis.com/auth/gmail.modify`
- Secure token storage and refresh

### FR-2: Email Thread Sync
- Sync email threads by customer domain
- Extract thread data:
  - Subject, snippet
  - Participants
  - Timestamps
  - Labels
  - Thread length
- Incremental sync via history ID

### FR-3: Customer Email Detection
- Match emails to customers via:
  - Email domain
  - Stakeholder email addresses
  - Thread participant matching
- Handle multi-customer threads

### FR-4: Email Composition
- Compose and send from customer view
- Pre-populate:
  - To: stakeholder emails
  - Context from customer record
- Rich text editor with formatting
- Attachment support
- Requires HITL approval for send

### FR-5: Email Drafts
- Create drafts without sending
- AI-assisted draft generation
- Template-based composition
- Variable substitution:
  - `{{customer.name}}`
  - `{{stakeholder.first_name}}`
  - `{{health_score}}`
  - Custom variables

### FR-6: Email Actions
- Mark as read/unread
- Archive threads
- Star important threads
- Apply labels
- Reply in thread

### FR-7: Email Metrics
- Calculate engagement metrics:
  - Email frequency (sent/received)
  - Average response time
  - Thread depth
  - Last contact date
- Include in health score

## Non-Functional Requirements

### NFR-1: Performance
- Email send < 3 seconds
- Thread sync < 30 seconds for 100 threads
- Search response < 2 seconds

### NFR-2: Security
- No email content stored long-term (only metadata)
- Encryption at rest and in transit
- Audit logging for sent emails

## Technical Implementation

### API Endpoints
```
POST   /api/google/gmail/connect
GET    /api/google/gmail/threads
GET    /api/google/gmail/threads/:id
POST   /api/google/gmail/send
POST   /api/google/gmail/drafts
GET    /api/google/gmail/customer/:customerId
POST   /api/google/gmail/search
PUT    /api/google/gmail/threads/:id/read
PUT    /api/google/gmail/threads/:id/archive
```

### Gmail API Usage
```javascript
// List threads
GET https://gmail.googleapis.com/gmail/v1/users/me/threads
?q=from:*@acmecorp.com OR to:*@acmecorp.com
&maxResults=50

// Get thread
GET https://gmail.googleapis.com/gmail/v1/users/me/threads/{threadId}
?format=full

// Send email
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
{
  "raw": "base64_encoded_email"
}

// Create draft
POST https://gmail.googleapis.com/gmail/v1/users/me/drafts
{
  "message": {
    "raw": "base64_encoded_email"
  }
}
```

### Database Schema
```sql
CREATE TABLE email_thread_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  gmail_thread_id TEXT,
  subject TEXT,
  snippet TEXT,
  participants TEXT[],
  message_count INTEGER,
  last_message_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  UNIQUE(customer_id, gmail_thread_id)
);

CREATE TABLE email_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  metric_date DATE,
  emails_sent INTEGER,
  emails_received INTEGER,
  avg_response_hours NUMERIC,
  last_outbound_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  UNIQUE(customer_id, metric_date)
);
```

## User Interface

### Customer Email Panel
- Recent thread list with snippets
- Send email button
- Thread search
- Email frequency indicator

### Email Composer
- Rich text editor
- Stakeholder selector (To, CC)
- Template dropdown
- AI assist button
- Preview before send
- Attachment upload

### Thread View
- Full conversation display
- Reply in thread option
- Action buttons (archive, star)

## Acceptance Criteria

### AC-1: Authentication
- [ ] Google OAuth completes successfully
- [ ] Token refresh works
- [ ] Multi-account support

### AC-2: Email Sync
- [ ] Customer threads detected correctly
- [ ] Thread content viewable
- [ ] Incremental sync works

### AC-3: Sending
- [ ] Can compose and send from CSCX.AI
- [ ] Approval workflow works
- [ ] Sent emails appear in Gmail

### AC-4: Drafts
- [ ] AI draft generation works
- [ ] Templates apply correctly
- [ ] Variables substitute properly

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Draft email to [account]" | Open composer with draft |
| "Show recent emails with [account]" | Display threads |
| "When did I last email [account]?" | Show last contact |
| "Send a check-in email to [stakeholder]" | Compose and queue |

### Quick Actions
- Draft welcome email
- Send follow-up
- Request meeting

## Success Metrics
| Metric | Target |
|--------|--------|
| Email sync accuracy | > 99% |
| Send success rate | > 99.9% |
| CSM email time saved | 40% |

## Related PRDs
- PRD-026: One-Click QBR Email Generation
- PRD-034: Check-In Email After Silence
- PRD-215: Smart Email Response Suggestions
