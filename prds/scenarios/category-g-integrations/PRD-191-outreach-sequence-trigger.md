# PRD-191: Outreach.io Sequence Trigger

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-191 |
| **Title** | Outreach.io Sequence Trigger |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs use Outreach.io for structured email sequences but must manually add prospects and trigger sequences. When CSCX.AI identifies situations requiring multi-touch outreach (onboarding, renewal, re-engagement), there's no automated way to enroll contacts in the appropriate Outreach sequence.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to automatically enroll stakeholders in Outreach sequences when specific triggers occur (e.g., new customer, approaching renewal).
2. **As a CSM**, I want to see Outreach sequence status for my contacts within CSCX.AI customer context.
3. **As a CS Leader**, I want to ensure consistent outreach execution by automating sequence enrollment.

### Secondary User Stories
4. **As a CSM**, I want to manually trigger Outreach sequences from the customer view when needed.
5. **As an Operations person**, I want to map CSCX.AI triggers to specific Outreach sequences.

## Functional Requirements

### FR-1: OAuth Authentication
- Support Outreach OAuth 2.0
- Request scopes: prospects, sequences, mailings
- Secure token storage

### FR-2: Sequence Discovery
- Fetch available sequences from Outreach
- Display sequence metadata:
  - Name, description
  - Step count
  - Success metrics
- Cache sequence list

### FR-3: Prospect Sync
- Create/update prospects in Outreach from stakeholders
- Map fields:
  - Name, email, title
  - Company association
  - Custom fields
- Handle existing prospect matching

### FR-4: Sequence Enrollment
- Enroll prospects in sequences programmatically
- Support enrollment criteria:
  - Specific stakeholder roles
  - Customer segment
  - Health score thresholds
- Requires HITL approval

### FR-5: Trigger-Based Enrollment
- Auto-enroll based on CSCX.AI events:
  - New customer → Onboarding sequence
  - Renewal 90 days → Renewal sequence
  - Health drop → Re-engagement sequence
  - Champion left → Multi-thread sequence
- Configurable trigger-sequence mapping

### FR-6: Sequence Status Tracking
- Sync sequence status back to CSCX.AI
- Track:
  - Active sequences per contact
  - Completion status
  - Reply/engagement events
- Display in stakeholder view

### FR-7: Sequence Pause/Resume
- Pause sequences for contacts
- Resume paused sequences
- Remove from sequence

## Non-Functional Requirements

### NFR-1: Performance
- Enrollment < 5 seconds
- Status sync every 15 minutes

### NFR-2: Reliability
- Retry failed enrollments
- Handle Outreach rate limits

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/outreach/connect
GET    /api/integrations/outreach/callback
GET    /api/outreach/sequences
POST   /api/outreach/prospects
POST   /api/outreach/enroll
GET    /api/outreach/status/:stakeholderId
PUT    /api/outreach/pause/:stakeholderId
DELETE /api/outreach/remove/:stakeholderId
PUT    /api/outreach/mappings
```

### Outreach API Usage
```javascript
// List sequences
GET https://api.outreach.io/api/v2/sequences
Authorization: Bearer {access_token}

// Create prospect
POST https://api.outreach.io/api/v2/prospects
{
  "data": {
    "type": "prospect",
    "attributes": {
      "firstName": "John",
      "lastName": "Smith",
      "emails": ["john@acmecorp.com"],
      "title": "VP Engineering"
    },
    "relationships": {
      "account": {"data": {"type": "account", "id": 123}}
    }
  }
}

// Add to sequence
POST https://api.outreach.io/api/v2/sequenceStates
{
  "data": {
    "type": "sequenceState",
    "relationships": {
      "prospect": {"data": {"type": "prospect", "id": 456}},
      "sequence": {"data": {"type": "sequence", "id": 789}}
    }
  }
}
```

### Database Schema
```sql
CREATE TABLE outreach_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type VARCHAR(50),
  sequence_id INTEGER,
  sequence_name TEXT,
  stakeholder_roles TEXT[],
  segment_filter TEXT,
  health_threshold INTEGER,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
);

CREATE TABLE outreach_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id UUID REFERENCES stakeholders(id),
  outreach_prospect_id INTEGER,
  sequence_id INTEGER,
  sequence_name TEXT,
  status VARCHAR(20),
  enrolled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

## User Interface

### Sequence Mapping Configuration
- List available sequences
- Map triggers to sequences
- Set enrollment criteria
- Enable/disable mappings

### Stakeholder Sequence Status
- Active sequences badge
- Sequence progress indicator
- Pause/remove buttons

### Manual Enrollment
- Select sequence from dropdown
- Confirm enrollment
- View sequence details

## Acceptance Criteria

### AC-1: Authentication
- [ ] OAuth flow completes
- [ ] Sequences load correctly
- [ ] Prospect sync works

### AC-2: Enrollment
- [ ] Can enroll from customer view
- [ ] Trigger-based enrollment works
- [ ] Approval flow respected

### AC-3: Status Tracking
- [ ] Sequence status visible
- [ ] Completion tracked
- [ ] Pause/resume functional

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Enroll [stakeholder] in onboarding sequence" | Trigger enrollment |
| "What sequences is [stakeholder] in?" | Show status |
| "Pause outreach for [account]" | Pause all sequences |

## Success Metrics
| Metric | Target |
|--------|--------|
| Auto-enrollment accuracy | > 99% |
| Sequence completion visibility | 100% |
| Manual enrollment time saved | 80% |

## Related PRDs
- PRD-192: Salesloft Cadence Integration
- PRD-028: Onboarding Welcome Sequence
- PRD-030: Win-Back Campaign Generator
