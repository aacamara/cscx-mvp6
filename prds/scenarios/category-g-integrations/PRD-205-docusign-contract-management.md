# PRD-205: DocuSign Contract Management

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-205 |
| **Title** | DocuSign Contract Management |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Contract status and signing progress tracked in DocuSign is not visible to CSMs managing customer relationships. Pending signatures, renewal contracts, and amendment status should be accessible without switching to DocuSign, enabling better renewal coordination.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see DocuSign envelope status for contracts related to my accounts.
2. **As a CSM**, I want to be alerted when contracts are fully signed so I can begin onboarding.
3. **As a CS Leader**, I want renewal contract progress visible for pipeline management.

### Secondary User Stories
4. **As a CSM**, I want to send signature reminders from CSCX.AI.
5. **As an Admin**, I want signed contracts automatically stored in customer records.

## Functional Requirements

### FR-1: OAuth Authentication
- Support DocuSign OAuth 2.0
- Request signature and template scopes
- Support demo and production environments

### FR-2: Envelope Sync
- Pull envelopes by customer
- Sync envelope data:
  - Status (sent, delivered, completed, voided)
  - Recipients and signing status
  - Documents list
  - Sent/completed dates
- Match to customers

### FR-3: Customer Matching
- Link envelopes via:
  - Recipient email domain
  - Custom field mapping
  - Envelope metadata

### FR-4: Status Tracking
- Real-time webhook updates
- Track:
  - Envelope created
  - Sent for signature
  - Viewed by recipient
  - Signed by recipient
  - Completed/voided
- Notify CSM on key events

### FR-5: Document Access
- View completed documents
- Download signed PDFs
- Store in customer workspace (Google Drive)

### FR-6: Signature Reminders
- Send reminders from CSCX.AI
- Configurable reminder templates
- Track reminder history

### FR-7: Contract Intelligence
- Parse signed contracts for key terms
- Extract renewal dates, ARR
- Feed contract data to customer record

## Non-Functional Requirements

### NFR-1: Performance
- Webhook processing < 3 seconds
- Document download < 10 seconds

### NFR-2: Security
- Secure document handling
- Access control per user
- Audit logging

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/docusign/connect
GET    /api/integrations/docusign/callback
POST   /api/integrations/docusign/webhook
GET    /api/docusign/envelopes/:customerId
GET    /api/docusign/envelope/:envelopeId
GET    /api/docusign/document/:envelopeId/:documentId
POST   /api/docusign/remind/:envelopeId
```

### DocuSign API Usage
```javascript
// List envelopes
GET /restapi/v2.1/accounts/{accountId}/envelopes
?from_date=2026-01-01
&status=any

// Get envelope details
GET /restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId}
?include=recipients

// Download document
GET /restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId}/documents/{documentId}

// Send reminder
POST /restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId}/recipients/{recipientId}/reminder
```

### Database Schema
```sql
CREATE TABLE docusign_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  envelope_id TEXT UNIQUE,
  status VARCHAR(20),
  subject TEXT,
  documents JSONB,
  recipients JSONB,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
);

CREATE TABLE docusign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id TEXT,
  event_type VARCHAR(50),
  recipient_email TEXT,
  occurred_at TIMESTAMPTZ
);
```

## User Interface

### Contract Status Panel
- Envelope list by customer
- Status badges
- Recipient progress
- Quick actions

### Envelope Detail View
- Document list
- Signing timeline
- Recipient status
- Download/remind buttons

### Contract Alerts
- Completion notifications
- Stalled signature warnings
- Voided envelope alerts

## Acceptance Criteria

### AC-1: Connection
- [ ] OAuth completes successfully
- [ ] Envelopes sync correctly

### AC-2: Status Tracking
- [ ] Webhooks process real-time
- [ ] Status updates accurately
- [ ] CSM notifications work

### AC-3: Documents
- [ ] Can view completed docs
- [ ] Can download PDFs
- [ ] Storage integration works

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show contract status for [account]" | Display envelopes |
| "Is the renewal signed for [account]?" | Check status |
| "Send reminder for [account] contract" | Send reminder |
| "Download signed contract for [account]" | Get document |

## Success Metrics
| Metric | Target |
|--------|--------|
| Status sync latency | < 1 minute |
| Contract visibility | 100% |
| CSM signature awareness | 95% within 1 hour |

## Related PRDs
- PRD-206: PandaDoc Integration
- PRD-089: Renewal Approaching → Prep Checklist
- PRD-003: PDF Contract Upload → Key Terms Extraction
