# PRD-194: Chorus.ai Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-194 |
| **Title** | Chorus.ai Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations using Chorus.ai (now ZoomInfo Chorus) for conversation intelligence have valuable call insights siloed from their customer success platform. CSMs need access to call recordings, transcripts, and AI-generated insights within CSCX.AI to maintain complete customer context.

## User Stories

### Primary User Stories
1. **As a CSM**, I want Chorus call recordings and summaries accessible from CSCX.AI customer records.
2. **As a CSM**, I want Chorus-detected action items automatically created as tasks in CSCX.AI.
3. **As a CS Leader**, I want conversation analytics included in customer health assessments.

### Secondary User Stories
4. **As a CSM**, I want to search call transcripts for specific topics across my portfolio.
5. **As an Admin**, I want to configure which Chorus insights map to CSCX.AI signals.

## Functional Requirements

### FR-1: API Authentication
- Support Chorus REST API authentication
- OAuth 2.0 or API key based
- Secure credential management

### FR-2: Meeting Sync
- Pull completed recordings
- Sync metadata:
  - Title, date, duration
  - Participants
  - Recording links
- Associate with customers

### FR-3: Transcript Access
- Retrieve call transcripts
- Speaker identification
- Timestamp mapping
- Search capabilities

### FR-4: Momentum Insights
- Sync Chorus Momentum data:
  - Deal progress signals
  - Next steps detected
  - Pricing discussions
  - Objections raised
- Map to CSCX.AI analytics

### FR-5: Action Item Extraction
- Pull AI-detected action items
- Create tasks in CSCX.AI
- Assign to appropriate CSM
- Link to source call

### FR-6: Tracker Integration
- Sync custom trackers (competitor mentions, features, etc.)
- Map to CSCX.AI categories
- Enable trending analysis

## Non-Functional Requirements

### NFR-1: Performance
- Sync 500 calls in 20 minutes
- Transcript retrieval < 5 seconds

### NFR-2: Compatibility
- Support Chorus API version changes
- Handle data model differences

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/chorus/connect
GET    /api/chorus/meetings
GET    /api/chorus/meetings/:id
GET    /api/chorus/meetings/:id/transcript
GET    /api/chorus/customer/:customerId
GET    /api/chorus/insights/:customerId
POST   /api/chorus/webhook
```

### Chorus API Usage
```javascript
// List calls
GET https://chorus.ai/api/v1/calls
?start_date=2026-01-01
&end_date=2026-01-31
Authorization: Bearer {access_token}

// Get call details
GET https://chorus.ai/api/v1/calls/{call_id}

// Get transcript
GET https://chorus.ai/api/v1/calls/{call_id}/transcript

// Get trackers
GET https://chorus.ai/api/v1/calls/{call_id}/trackers
```

### Database Schema
```sql
CREATE TABLE chorus_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chorus_call_id TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id),
  title TEXT,
  duration_seconds INTEGER,
  participants JSONB,
  chorus_url TEXT,
  summary TEXT,
  call_date TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
);

CREATE TABLE chorus_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chorus_call_id TEXT,
  customer_id UUID REFERENCES customers(id),
  description TEXT,
  owner TEXT,
  due_date DATE,
  task_id UUID REFERENCES tasks(id),
  created_at TIMESTAMPTZ
);
```

## User Interface

### Call Library
- List of customer calls
- Filter by date, participant
- Quick summary view
- Link to full recording

### Insights Panel
- Trending topics
- Action items pending
- Momentum indicators

## Acceptance Criteria

### AC-1: Authentication
- [ ] API connection works
- [ ] Calls sync correctly

### AC-2: Data Integration
- [ ] Transcripts accessible
- [ ] Action items create tasks
- [ ] Customer matching accurate

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show Chorus calls for [account]" | Display calls |
| "What action items from [account] calls?" | Show items |

## Success Metrics
| Metric | Target |
|--------|--------|
| Call sync accuracy | > 99% |
| Action item capture | > 90% |

## Related PRDs
- PRD-193: Gong Call Intelligence
- PRD-213: AI Meeting Summarization
