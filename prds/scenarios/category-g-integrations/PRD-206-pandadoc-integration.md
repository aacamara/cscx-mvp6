# PRD-206: PandaDoc Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-206 |
| **Title** | PandaDoc Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations using PandaDoc for proposals, quotes, and contracts need document status visible to CSMs. Contract and renewal proposal progress should be tracked within customer context without switching to PandaDoc.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see PandaDoc document status for my accounts in CSCX.AI.
2. **As a CSM**, I want to be notified when proposals are viewed or signed.
3. **As a CS Leader**, I want renewal proposal progress tracked for pipeline visibility.

### Secondary User Stories
4. **As a CSM**, I want to create proposals from templates with customer data pre-filled.
5. **As a CSM**, I want signed documents automatically stored in customer records.

## Functional Requirements

### FR-1: OAuth Authentication
- Support PandaDoc OAuth 2.0
- Request document and template scopes
- Workspace connection

### FR-2: Document Sync
- Pull documents by customer
- Sync document data:
  - Name, status
  - Recipients
  - Sent/viewed/completed dates
  - Document type (proposal, contract, quote)
- Customer matching via recipients

### FR-3: Status Tracking
- Webhook for real-time updates:
  - Document sent
  - Document viewed
  - Document completed
  - Document paid
- Notify CSM on events

### FR-4: Document Creation
- Create from templates
- Pre-populate:
  - Customer name, address
  - Contact information
  - Pricing/terms
- Send for signature
- Requires approval

### FR-5: Document Analytics
- Track view duration
- Page-level analytics
- Recipient engagement
- Forwarded to others

### FR-6: Payment Tracking
- Track payment status (if using PandaDoc payments)
- Alert on paid documents
- Feed to revenue tracking

## Non-Functional Requirements

### NFR-1: Performance
- Webhook processing < 3 seconds
- Document creation < 10 seconds

### NFR-2: Security
- Secure document access
- Role-based permissions

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/pandadoc/connect
GET    /api/integrations/pandadoc/callback
POST   /api/integrations/pandadoc/webhook
GET    /api/pandadoc/documents/:customerId
GET    /api/pandadoc/document/:documentId
POST   /api/pandadoc/documents
GET    /api/pandadoc/templates
GET    /api/pandadoc/analytics/:documentId
```

### PandaDoc API Usage
```javascript
// List documents
GET https://api.pandadoc.com/public/v1/documents
?q=Acme Corp
&status=document.draft,document.sent,document.completed

// Create document from template
POST https://api.pandadoc.com/public/v1/documents
{
  "name": "Renewal Proposal - Acme Corp",
  "template_uuid": "template_123",
  "recipients": [
    {"email": "john@acmecorp.com", "first_name": "John", "last_name": "Smith"}
  ],
  "tokens": [
    {"name": "Customer.Name", "value": "Acme Corp"},
    {"name": "Renewal.Amount", "value": "$50,000"}
  ]
}

// Send document
POST https://api.pandadoc.com/public/v1/documents/{id}/send
{
  "message": "Please review and sign the attached proposal.",
  "silent": false
}
```

### Database Schema
```sql
CREATE TABLE pandadoc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  pandadoc_id TEXT UNIQUE,
  name TEXT,
  status VARCHAR(30),
  document_type VARCHAR(30),
  recipients JSONB,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  payment_status VARCHAR(20),
  synced_at TIMESTAMPTZ
);

CREATE TABLE pandadoc_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pandadoc_id TEXT,
  event_type VARCHAR(50),
  recipient_email TEXT,
  occurred_at TIMESTAMPTZ
);
```

## User Interface

### Document Panel
- Document list by customer
- Status indicators
- View/completion tracking
- Quick actions

### Document Creation
- Template browser
- Field mapping
- Preview before send

### Analytics View
- View duration chart
- Page engagement
- Recipient activity

## Acceptance Criteria

### AC-1: Connection
- [ ] OAuth works correctly
- [ ] Documents sync properly

### AC-2: Functionality
- [ ] Status tracking accurate
- [ ] Webhooks process correctly
- [ ] Document creation works

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show PandaDoc proposals for [account]" | Display documents |
| "Create renewal proposal for [account]" | Start creation |
| "Has [account] viewed the proposal?" | Check analytics |

## Success Metrics
| Metric | Target |
|--------|--------|
| Document sync accuracy | > 99% |
| Status notification latency | < 1 minute |

## Related PRDs
- PRD-205: DocuSign Contract Management
- PRD-027: Renewal Proposal Generator
