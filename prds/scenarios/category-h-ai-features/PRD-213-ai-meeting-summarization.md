# PRD-213: AI Meeting Summarization

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-213 |
| **Title** | AI Meeting Summarization |
| **Category** | H: AI-Powered Features |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs spend significant time after customer meetings writing summaries, extracting action items, and updating CRM records. Meeting recordings and transcripts exist but require manual review. AI should automatically generate comprehensive meeting summaries with actionable insights, reducing post-meeting admin time from 15-30 minutes to under 2 minutes.

## User Stories

### Primary User Stories
1. **As a CSM**, I want meeting transcripts automatically summarized within minutes of the meeting ending.
2. **As a CSM**, I want action items extracted with suggested owners and due dates.
3. **As a CSM**, I want commitments made (by us or the customer) clearly highlighted.
4. **As a CSM**, I want risk signals and expansion opportunities flagged from meeting content.
5. **As a CSM**, I want to review and edit the summary before it's shared or logged.

### Secondary User Stories
1. **As a CSM**, I want sentiment analysis showing how the meeting went overall.
2. **As a CSM**, I want competitive mentions flagged and linked to battle cards.
3. **As a CSM Manager**, I want to review team meeting summaries for coaching opportunities.
4. **As a CSM**, I want the summary auto-saved to the customer's Google Drive folder.

## Acceptance Criteria

### Core Functionality
- [ ] Automatic processing of meeting transcripts from Zoom, Otter.ai, and manual upload
- [ ] Summary generation within 5 minutes of transcript availability
- [ ] Extraction of action items with owner suggestions and due date recommendations
- [ ] Identification of commitments (mutual obligations)
- [ ] Risk signal detection from conversation content
- [ ] Expansion signal detection (interest in new features, more licenses)
- [ ] Sentiment analysis (positive/neutral/negative/mixed)

### Summary Components
- [ ] Executive summary (2-3 sentences)
- [ ] Key discussion points (bulleted)
- [ ] Decisions made
- [ ] Action items table (item, owner, due date, status)
- [ ] Commitments tracking
- [ ] Follow-up recommendations
- [ ] Risk/opportunity flags

### Integration Points
- [ ] Auto-populate meeting_analyses table
- [ ] Create tasks from action items (with approval)
- [ ] Update customer risk_signals if detected
- [ ] Save summary document to customer's Drive folder
- [ ] Optionally send summary email to attendees

## Technical Specification

### Architecture
```
Transcript Source → Transcript Processor → AI Analysis Pipeline → Summary Generator → Review UI → Action Executor
```

### Analysis Pipeline

#### 1. Transcript Ingestion
Sources supported:
- Zoom API (recordings + transcripts)
- Otter.ai webhook
- Manual upload (VTT, SRT, plain text)

#### 2. AI Analysis Prompts

**Summary Extraction Prompt:**
```
Analyze this customer success meeting transcript and extract:

1. EXECUTIVE SUMMARY: 2-3 sentence overview of the meeting
2. KEY DISCUSSION POINTS: Main topics discussed (bulleted)
3. DECISIONS MADE: Any decisions or agreements reached
4. ACTION ITEMS: Tasks that need to be done
   - Format: [Task] | [Suggested Owner: Customer/CSM] | [Suggested Due Date]
5. COMMITMENTS: Promises made by either party
6. RISK SIGNALS: Any concerns, complaints, or churn indicators
7. EXPANSION SIGNALS: Interest in growth, new features, more users
8. SENTIMENT: Overall meeting tone (positive/neutral/negative/mixed)
9. FOLLOW-UP RECOMMENDATIONS: Suggested next steps

Meeting Context:
- Customer: {customer_name}
- Account ARR: {arr}
- Meeting Type: {meeting_type}
- Attendees: {attendees}
```

**Risk Signal Detection Prompt:**
```
From this meeting transcript, identify any risk signals:
- Competitor mentions
- Budget concerns
- Champion departure hints
- Dissatisfaction with product/support
- Timeline pressure (need results by X date)
- Stakeholder alignment issues

Rate overall risk level: LOW | MEDIUM | HIGH | CRITICAL
```

#### 3. Summary Schema
```typescript
interface MeetingSummary {
  meeting_id: string;
  customer_id: string;
  executive_summary: string;
  key_points: string[];
  decisions: string[];
  action_items: ActionItem[];
  commitments: Commitment[];
  risk_signals: RiskSignal[];
  expansion_signals: ExpansionSignal[];
  overall_sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentiment_score: number; // -100 to 100
  follow_up_recommendations: string[];
  confidence_score: number; // 0-100
}

interface ActionItem {
  description: string;
  suggested_owner: 'customer' | 'csm' | 'internal' | string;
  suggested_due_date: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending_review' | 'approved' | 'created';
}
```

### API Endpoints

#### POST /api/meetings/analyze
```json
{
  "meeting_id": "uuid",
  "transcript_source": "zoom|otter|manual",
  "transcript_content": "...",
  "customer_id": "uuid",
  "meeting_metadata": {
    "title": "Q1 QBR",
    "attendees": [...],
    "date": "2026-01-29"
  }
}
```

#### GET /api/meetings/{id}/summary
Returns the generated summary for review.

#### POST /api/meetings/{id}/summary/approve
```json
{
  "edits": {
    "executive_summary": "edited text",
    "action_items": [...]
  },
  "create_tasks": true,
  "save_to_drive": true,
  "send_email": false
}
```

### Database Schema
Uses existing `meeting_analyses` table:
```sql
-- meeting_analyses already exists with:
-- summary, overall_sentiment, sentiment_score, action_items,
-- commitments, follow_ups, risk_signals, risk_level,
-- expansion_signals, expansion_potential, stakeholder_insights,
-- competitor_mentions, confidence, analyzed_at
```

### Integration with Existing Services

#### Zoom Integration
- Webhook: Recording completed → trigger analysis
- API: Fetch transcript from recording

#### Otter.ai Integration
- Existing webhook handler processes transcript
- Extend to trigger AI analysis pipeline

#### Google Drive Integration
- Use existing docs.ts template system
- Create "Meeting Notes" document with summary
- Save to customer's "02 - Meetings" folder

## UI/UX Design

### Meeting Summary Review Screen
```
┌─────────────────────────────────────────────────────────┐
│ Meeting Summary: Q1 QBR with Acme Corp                  │
│ January 29, 2026 | 45 minutes | 5 attendees             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ EXECUTIVE SUMMARY                           [Edit]      │
│ ─────────────────                                       │
│ Productive quarterly review with strong engagement.     │
│ Customer expressed satisfaction with recent features    │
│ but raised concerns about reporting capabilities.       │
│                                                         │
│ SENTIMENT: Positive (78/100)    ████████████░░ 78%     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ KEY DISCUSSION POINTS                                   │
│ • Q4 adoption metrics showed 40% increase               │
│ • New reporting requirements for compliance             │
│ • Expansion interest for European team                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ ACTION ITEMS                                            │
│ ┌─────────────────────────────────────────────────────┐│
│ │ ☐ Schedule demo of new reporting features           ││
│ │   Owner: CSM | Due: Feb 5 | [Create Task]           ││
│ │ ☐ Send pricing for EU expansion                     ││
│ │   Owner: CSM | Due: Feb 3 | [Create Task]           ││
│ │ ☐ Review compliance requirements internally         ││
│ │   Owner: Customer | Due: Feb 10                     ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
├─────────────────────────────────────────────────────────┤
│ RISK SIGNALS                          Risk Level: LOW   │
│ • Compliance deadline pressure (March 2026)             │
│                                                         │
│ EXPANSION SIGNALS                    Opportunity: HIGH  │
│ • Interest in EU expansion (20 additional seats)        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [Save to Drive] [Create All Tasks] [Send to Attendees]  │
│ [Regenerate Summary] [Edit Full Summary]                │
└─────────────────────────────────────────────────────────┘
```

### Inline Summary in Customer Timeline
- Collapsed card showing key metrics
- Expand for full summary
- Quick action buttons

### Notification Flow
1. Meeting ends → Processing notification
2. Summary ready → Review prompt in AIPanel
3. After review → Confirmation of saved items

## Dependencies

### Required Infrastructure
- Zoom OAuth integration (existing)
- Otter.ai webhook (existing)
- Claude API for analysis
- Google Drive integration (existing)

### Related PRDs
- PRD-116: Post-Call Processing
- PRD-008: Meeting Notes Upload → Action Item Extraction
- PRD-077: Meeting History & Outcomes
- PRD-233: Smart Meeting Prep

## Success Metrics

### Quantitative
- Summary generation time < 5 minutes
- Action item extraction accuracy > 90%
- Post-meeting admin time reduced by 80%
- 95% of summaries approved without major edits

### Qualitative
- CSMs trust AI summaries for accuracy
- Stakeholders find shared summaries valuable
- Risk signals match CSM intuition

## Rollout Plan

### Phase 1: Basic Summarization (Week 1-2)
- Manual transcript upload
- Executive summary + key points
- Basic action item extraction

### Phase 2: Integration (Week 3-4)
- Zoom webhook auto-trigger
- Otter.ai integration
- Google Drive auto-save

### Phase 3: Intelligence (Week 5-6)
- Risk signal detection
- Expansion signal detection
- Sentiment analysis

### Phase 4: Automation (Week 7-8)
- Task auto-creation (with approval)
- Email distribution
- CRM activity logging

## Open Questions
1. Should CSM approval be required before any tasks are created?
2. How do we handle meetings with multiple customers present?
3. What's the retention policy for transcripts vs summaries?
4. How do we handle confidential/sensitive content flagging?
