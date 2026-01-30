# PRD-192: Salesloft Cadence Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-192 |
| **Title** | Salesloft Cadence Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations using Salesloft for sales and customer success outreach cannot automatically trigger cadences from CSCX.AI events. CSMs must manually add people to cadences, creating delays and inconsistent execution of critical outreach workflows.

## User Stories

### Primary User Stories
1. **As a CSM**, I want stakeholders automatically added to Salesloft cadences when CSCX.AI detects specific triggers.
2. **As a CSM**, I want to see cadence participation status within the customer context.
3. **As a CS Leader**, I want standardized outreach workflows triggered automatically for consistency.

### Secondary User Stories
4. **As a CSM**, I want to manually add contacts to cadences from CSCX.AI.
5. **As an Admin**, I want to configure which triggers activate which cadences.

## Functional Requirements

### FR-1: OAuth Authentication
- Support Salesloft OAuth 2.0
- Request required scopes for cadences and people
- Token management

### FR-2: Cadence Discovery
- Fetch available cadences
- Display cadence details:
  - Name, description
  - Step count and types
  - Duration
  - Success rates

### FR-3: People Sync
- Create/update People from stakeholders
- Map standard fields
- Handle duplicates via email matching

### FR-4: Cadence Enrollment
- Add people to cadences programmatically
- Support due date specification
- Handle step customization
- Requires approval

### FR-5: Trigger Automation
- Map CSCX.AI triggers to cadences:
  - New customer → Welcome cadence
  - Renewal window → Renewal cadence
  - At-risk → Save cadence
  - Expansion signal → Upsell cadence
- Configure per segment

### FR-6: Activity Sync
- Pull cadence activity back to CSCX.AI
- Track:
  - Steps completed
  - Opens, clicks, replies
  - Bounce/unsubscribe
- Update stakeholder engagement

### FR-7: Cadence Management
- Pause person in cadence
- Skip step
- Remove from cadence
- View cadence history

## Non-Functional Requirements

### NFR-1: Performance
- Enrollment completes < 5 seconds
- Activity sync every 30 minutes

### NFR-2: Reliability
- Handle API rate limits
- Retry failed operations

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/salesloft/connect
GET    /api/integrations/salesloft/callback
GET    /api/salesloft/cadences
POST   /api/salesloft/people
POST   /api/salesloft/cadences/:id/add
GET    /api/salesloft/people/:id/activity
PUT    /api/salesloft/cadence-memberships/:id/pause
DELETE /api/salesloft/cadence-memberships/:id
PUT    /api/salesloft/trigger-mappings
```

### Salesloft API Usage
```javascript
// List cadences
GET https://api.salesloft.com/v2/cadences
Authorization: Bearer {access_token}

// Create person
POST https://api.salesloft.com/v2/people
{
  "first_name": "John",
  "last_name": "Smith",
  "email_address": "john@acmecorp.com",
  "title": "VP Engineering",
  "account_id": 123
}

// Add to cadence
POST https://api.salesloft.com/v2/cadence_memberships
{
  "cadence_id": 456,
  "person_id": 789
}

// Get activities
GET https://api.salesloft.com/v2/activities
?person_id=789
```

### Database Schema
```sql
CREATE TABLE salesloft_cadence_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type VARCHAR(50),
  cadence_id INTEGER,
  cadence_name TEXT,
  stakeholder_criteria JSONB,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
);

CREATE TABLE salesloft_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id UUID REFERENCES stakeholders(id),
  salesloft_person_id INTEGER,
  cadence_id INTEGER,
  cadence_name TEXT,
  status VARCHAR(20),
  current_step INTEGER,
  added_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

## User Interface

### Cadence Configuration
- Browse available cadences
- Map triggers to cadences
- Set enrollment criteria
- Preview automation rules

### Contact Cadence View
- Active cadence badge
- Progress indicator
- Engagement metrics
- Quick actions

## Acceptance Criteria

### AC-1: Authentication
- [ ] Salesloft OAuth works
- [ ] Cadences load correctly
- [ ] People sync properly

### AC-2: Automation
- [ ] Trigger-based enrollment works
- [ ] Activity syncs back
- [ ] Approval flow respected

### AC-3: Management
- [ ] Can pause/remove from cadence
- [ ] Status updates real-time
- [ ] History tracked

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Add [stakeholder] to renewal cadence" | Enroll in cadence |
| "What cadence is [stakeholder] in?" | Show membership |
| "Show Salesloft activity for [account]" | Display activities |

## Success Metrics
| Metric | Target |
|--------|--------|
| Automated enrollment accuracy | > 99% |
| Activity sync completeness | 100% |
| Cadence execution consistency | 95% |

## Related PRDs
- PRD-191: Outreach.io Sequence Trigger
- PRD-028: Onboarding Welcome Sequence
