# PRD-193: Gong Call Intelligence

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-193 |
| **Title** | Gong Call Intelligence |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Customer calls recorded and analyzed in Gong contain rich insights about sentiment, risks, and opportunities that CSMs cannot easily access from CSCX.AI. Manual review of call recordings is time-consuming, and key insights may be missed or not documented in customer records.

## User Stories

### Primary User Stories
1. **As a CSM**, I want Gong call summaries and insights visible within CSCX.AI customer context so I have complete interaction history.
2. **As a CSM**, I want to be alerted when Gong detects risk signals in customer calls so I can follow up immediately.
3. **As a CS Leader**, I want call sentiment trends included in customer health scoring.

### Secondary User Stories
4. **As a CSM**, I want to search across call transcripts to find specific topics discussed with customers.
5. **As a Product Manager**, I want aggregated feedback from customer calls for product planning.

## Functional Requirements

### FR-1: API Authentication
- Support Gong API authentication (OAuth or API key)
- Request access to calls, transcripts, and insights
- Secure credential storage

### FR-2: Call Data Sync
- Pull completed calls for customers
- Sync call metadata:
  - Title, date, duration
  - Participants (matched to stakeholders)
  - Recording URL
  - AI-generated summary
- Incremental sync by date

### FR-3: Transcript Integration
- Pull call transcripts from Gong
- Store transcripts linked to meetings
- Enable full-text search
- Handle speaker identification

### FR-4: Insight Extraction
- Sync Gong trackers and insights:
  - Competitor mentions
  - Pricing discussions
  - Risk indicators
  - Action items
  - Questions asked
- Map to CSCX.AI signals

### FR-5: Sentiment Analysis
- Pull sentiment scores from Gong
- Track sentiment by participant
- Trend sentiment over time
- Include in health score

### FR-6: Risk Signal Integration
- Detect risk signals from calls:
  - Frustration indicators
  - Competitor mentions
  - Contract/pricing concerns
  - Support escalation hints
- Create risk signals in CSCX.AI
- Alert CSM on high-risk calls

### FR-7: Customer Matching
- Match Gong accounts to CSCX customers
- Associate calls with customers via:
  - Email domain matching
  - Company name matching
  - CRM ID linking

## Non-Functional Requirements

### NFR-1: Performance
- Sync 1000 calls within 30 minutes
- Real-time webhook for new call alerts

### NFR-2: Data Handling
- Respect Gong data retention policies
- Handle large transcript storage
- Secure transcript access

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/gong/connect
GET    /api/gong/calls
GET    /api/gong/calls/:id
GET    /api/gong/calls/:id/transcript
GET    /api/gong/customer/:customerId/calls
GET    /api/gong/insights/:customerId
POST   /api/gong/webhook
```

### Gong API Usage
```javascript
// List calls
GET https://api.gong.io/v2/calls
?fromDateTime=2026-01-01T00:00:00Z
&toDateTime=2026-01-31T23:59:59Z
Authorization: Bearer {access_token}

// Get call transcript
GET https://api.gong.io/v2/calls/{callId}/transcript

// Get call insights
GET https://api.gong.io/v2/calls/{callId}/extensive
?contentSelector.exposedFields.collaboration.publicComments=true
&contentSelector.exposedFields.pointsOfInterest.trackerOccurrences=true
```

### Database Schema
```sql
CREATE TABLE gong_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gong_call_id TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id),
  meeting_id UUID REFERENCES meetings(id),
  title TEXT,
  duration_seconds INTEGER,
  participants JSONB,
  gong_url TEXT,
  summary TEXT,
  sentiment_score NUMERIC,
  sentiment_label VARCHAR(20),
  call_date TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
);

CREATE TABLE gong_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gong_call_id TEXT REFERENCES gong_calls(gong_call_id),
  insight_type VARCHAR(50),
  content TEXT,
  timestamp_seconds INTEGER,
  speaker TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE gong_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gong_call_id TEXT REFERENCES gong_calls(gong_call_id),
  transcript_text TEXT,
  speakers JSONB,
  word_count INTEGER,
  created_at TIMESTAMPTZ
);
```

## User Interface

### Customer Call History
- Chronological call list
- Sentiment indicators
- Key insights badges
- Quick links to Gong

### Call Detail View
- Summary section
- Transcript viewer
- Highlighted insights
- Action items extracted

### Insights Dashboard
- Trending topics
- Sentiment trends
- Risk indicators
- Competitor mentions

## Acceptance Criteria

### AC-1: Authentication
- [ ] Gong API connects successfully
- [ ] Call data syncs correctly
- [ ] Customer matching works

### AC-2: Data Sync
- [ ] Calls appear in customer context
- [ ] Transcripts searchable
- [ ] Insights extracted and displayed

### AC-3: Risk Integration
- [ ] Risk signals created from calls
- [ ] Alerts triggered for high-risk
- [ ] Health score includes call sentiment

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show recent calls with [account]" | Display call list |
| "What was discussed in the last call with [account]?" | Show summary |
| "Any risk signals from [account] calls?" | Display risks |
| "Search calls for 'pricing'" | Search transcripts |

## Success Metrics
| Metric | Target |
|--------|--------|
| Call sync accuracy | > 99% |
| Risk signal detection | > 85% |
| Time to insight from call | < 1 hour |

## Related PRDs
- PRD-194: Chorus.ai Integration
- PRD-213: AI Meeting Summarization
- PRD-083: Account Risk Factors Deep Dive
