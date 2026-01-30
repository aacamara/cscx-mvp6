# PRD-209: Zoom Meeting Management

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-209 |
| **Title** | Zoom Meeting Management |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Customer meetings conducted on Zoom contain valuable interaction data - recordings, transcripts, attendance - that should automatically flow into CSCX.AI. Without integration, CSMs manually track Zoom meetings and miss opportunities to extract insights from recorded conversations.

## User Stories

### Primary User Stories
1. **As a CSM**, I want Zoom meetings with customers automatically linked to their records with full context.
2. **As a CSM**, I want meeting recordings and transcripts accessible from the customer view.
3. **As CSCX.AI**, I want to analyze Zoom transcripts for action items, risks, and sentiment.

### Secondary User Stories
4. **As a CSM**, I want to create Zoom meetings directly from customer context in CSCX.AI.
5. **As a CS Leader**, I want meeting frequency and attendance tracked for engagement metrics.

## Functional Requirements

### FR-1: OAuth Authentication
- Support Zoom OAuth 2.0
- Request scopes:
  - `meeting:read`, `meeting:write`
  - `recording:read`
  - `user:read`
- Account-level or user-level access

### FR-2: Meeting Sync
- Pull meetings with customer attendees
- Sync meeting data:
  - Topic, agenda
  - Start time, duration
  - Participants (internal/external)
  - Meeting type
  - Status (scheduled, started, ended)
- Match to customers via participant email

### FR-3: Recording Access
- Access meeting recordings
- Sync recording metadata:
  - Recording URL
  - Duration
  - File size
  - Expiration
- Secure playback within CSCX.AI

### FR-4: Transcript Integration
- Pull meeting transcripts (VTT format)
- Parse and store transcript content
- Speaker identification
- Enable transcript search

### FR-5: Meeting Creation
- Create Zoom meetings from CSCX.AI
- Pre-populate:
  - Attendee emails
  - Meeting topic with customer context
  - Agenda
- Generate join links
- Requires approval

### FR-6: Meeting Intelligence
- Send transcripts to AI for analysis
- Extract:
  - Action items with owners
  - Commitments made
  - Risk signals
  - Sentiment analysis
  - Next steps
- Store in meeting analysis record

### FR-7: Webhook Events
- Real-time meeting updates:
  - Meeting started
  - Meeting ended
  - Recording completed
  - Participant joined/left
- Trigger workflows on events

### FR-8: Attendance Tracking
- Track participant attendance
- Calculate attendance rates
- Identify no-shows
- Include in engagement metrics

## Non-Functional Requirements

### NFR-1: Performance
- Meeting sync < 5 seconds
- Transcript processing < 60 seconds
- Recording access < 10 seconds

### NFR-2: Security
- Encrypted recording access
- Respect Zoom privacy settings
- Audit logging for recording views

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/zoom/connect
GET    /api/integrations/zoom/callback
POST   /api/integrations/zoom/webhook
GET    /api/zoom/meetings
GET    /api/zoom/meetings/:meetingId
POST   /api/zoom/meetings
GET    /api/zoom/recordings/:meetingId
GET    /api/zoom/transcript/:meetingId
POST   /api/zoom/analyze/:meetingId
GET    /api/zoom/customer/:customerId
```

### Zoom API Usage
```javascript
// List meetings
GET https://api.zoom.us/v2/users/{userId}/meetings
?type=scheduled
&from=2026-01-01
&to=2026-01-31

// Get meeting details
GET https://api.zoom.us/v2/meetings/{meetingId}

// Create meeting
POST https://api.zoom.us/v2/users/{userId}/meetings
{
  "topic": "QBR - Acme Corp",
  "type": 2,
  "start_time": "2026-02-15T10:00:00Z",
  "duration": 60,
  "agenda": "Quarterly Business Review",
  "settings": {
    "join_before_host": false,
    "auto_recording": "cloud"
  }
}

// Get recordings
GET https://api.zoom.us/v2/meetings/{meetingId}/recordings

// Get transcript
GET https://api.zoom.us/v2/meetings/{meetingId}/recordings/{recordingId}
// VTT file download
```

### Database Schema
Uses existing `meetings`, `transcripts`, `meeting_analyses` tables plus:
```sql
CREATE TABLE zoom_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id),
  zoom_meeting_id BIGINT UNIQUE,
  zoom_uuid TEXT,
  host_email TEXT,
  join_url TEXT,
  recording_url TEXT,
  recording_expires_at TIMESTAMPTZ,
  transcript_file_url TEXT,
  participants JSONB,
  actual_duration_minutes INTEGER,
  synced_at TIMESTAMPTZ
);

CREATE TABLE zoom_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_meeting_id BIGINT,
  participant_email TEXT,
  stakeholder_id UUID REFERENCES stakeholders(id),
  join_time TIMESTAMPTZ,
  leave_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  attended BOOLEAN
);
```

## User Interface

### Meeting Panel
- Upcoming Zoom meetings
- Past meeting list with recordings
- Quick create button
- Sync status

### Recording Player
- Embedded video player
- Transcript alongside video
- Jump to timestamp
- Highlight insights

### Meeting Analysis View
- AI-generated summary
- Action items list
- Risk indicators
- Sentiment gauge

### Meeting Creation Form
- Topic input
- Date/time picker
- Attendee selector
- Auto-recording toggle

## Acceptance Criteria

### AC-1: Connection
- [ ] Zoom OAuth completes
- [ ] Meetings sync correctly
- [ ] Webhooks receive events

### AC-2: Recordings
- [ ] Recordings accessible
- [ ] Transcripts parse correctly
- [ ] Playback works in UI

### AC-3: Intelligence
- [ ] AI analysis runs on transcripts
- [ ] Action items extracted
- [ ] Sentiment scored

### AC-4: Meeting Creation
- [ ] Can create from CSCX.AI
- [ ] Join link works
- [ ] Approval flow respected

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Schedule Zoom meeting with [account]" | Create meeting |
| "Show recording from last [account] meeting" | Play recording |
| "What were the action items from the [account] call?" | Show analysis |
| "Analyze the last meeting with [account]" | Trigger AI analysis |
| "Who attended the [account] QBR?" | Show participants |

### Quick Actions
- Schedule meeting
- View recordings
- Analyze transcript

## Success Metrics
| Metric | Target |
|--------|--------|
| Meeting sync accuracy | > 99% |
| Transcript availability | > 95% |
| Analysis quality | > 85% satisfaction |
| Time to insight | < 1 hour post-meeting |

## Related PRDs
- PRD-188: Google Calendar Sync
- PRD-213: AI Meeting Summarization
- PRD-116: Post-Call Processing
- PRD-127: Meeting Booked → Pre-Meeting Research
