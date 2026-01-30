# PRD-116: Post-Call Processing

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-116 |
| **Title** | Post-Call Processing |
| **Category** | E: Workflow Automation |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
After customer calls, CSMs spend significant time manually processing call outcomes: transcribing notes, extracting action items, creating follow-up tasks, and drafting follow-up emails. This manual work delays follow-through and risks important details being lost or forgotten.

## User Story
**As a** CSM
**I want** automated post-call processing that generates summaries, extracts action items, creates tasks, and drafts follow-up emails
**So that** I can focus on customer relationships instead of administrative work while ensuring nothing falls through the cracks

## Functional Requirements

### FR-1: Automatic Trigger Detection
- System detects when a customer call ends via:
  - Zoom meeting completion webhook
  - Otter.ai transcript webhook
  - Google Calendar event end time
  - Manual "call ended" button in UI
- Trigger initiates post-call workflow within 5 minutes of call completion

### FR-2: Transcript Analysis
- Ingest transcript from Zoom, Otter.ai, or manual upload
- AI analyzes transcript to extract:
  - Meeting summary (3-5 bullet points)
  - Action items with owners and due dates
  - Commitments made by both parties
  - Risk signals detected
  - Expansion signals detected
  - Competitor mentions
  - Stakeholder sentiment
- Store analysis in `meeting_analyses` table

### FR-3: Task Creation
- Automatically create tasks in CSCX for each action item
- Set task owner based on action item assignment
- Set due date from extracted timeline or default (7 days)
- Link tasks to customer and meeting record
- Option to push tasks to external systems (Salesforce, Jira)

### FR-4: Follow-Up Email Draft
- Generate personalized follow-up email draft including:
  - Thank you for the meeting
  - Summary of discussion
  - Action items with owners and dates
  - Next steps
- Store draft in `google_pending_approvals` for CSM review
- Pre-populate recipient list from meeting attendees

### FR-5: CRM Update
- Update Salesforce/HubSpot with:
  - Meeting logged as activity
  - Notes summary attached
  - Next step field updated
  - Health score signal (if sentiment detected)

### FR-6: Notification
- Notify CSM via:
  - Slack DM with summary
  - Email digest (if configured)
  - In-app notification
- Include quick actions: approve email, view tasks, edit summary

## Non-Functional Requirements

### NFR-1: Performance
- Complete post-call processing within 5 minutes of trigger
- Handle transcripts up to 2 hours in length
- Support concurrent processing of up to 50 calls

### NFR-2: Accuracy
- Action item extraction accuracy > 90%
- Sentiment analysis accuracy > 85%
- Zero hallucinated commitments or action items

### NFR-3: Reliability
- Retry failed processing up to 3 times
- Queue processing if AI service unavailable
- Log all processing steps for audit

## Technical Specifications

### Data Model
```typescript
interface PostCallProcessingResult {
  meetingId: string;
  customerId: string;
  transcriptId: string;
  summary: string;
  actionItems: ActionItem[];
  commitments: Commitment[];
  riskSignals: RiskSignal[];
  expansionSignals: ExpansionSignal[];
  competitorMentions: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScore: number;
  followUpEmailDraft: EmailDraft;
  tasksCreated: string[];
  crmUpdated: boolean;
  processedAt: Date;
}

interface ActionItem {
  description: string;
  owner: string;
  ownerType: 'internal' | 'customer';
  dueDate: Date | null;
  priority: 'high' | 'medium' | 'low';
}
```

### API Endpoints
- `POST /api/workflows/post-call/trigger` - Manually trigger processing
- `POST /api/webhooks/zoom/meeting-ended` - Zoom webhook
- `POST /api/webhooks/otter/transcript-ready` - Otter webhook
- `GET /api/workflows/post-call/:meetingId/status` - Check processing status

### Agent Involvement
| Agent | Role |
|-------|------|
| Orchestrator | Coordinate post-call workflow |
| Researcher | Analyze transcript, extract insights |
| Communicator | Draft follow-up email |
| Scheduler | Create tasks with due dates |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Zoom | IN | Meeting completion, transcript |
| Otter.ai | IN | Transcript, speakers |
| Gmail | OUT | Follow-up email draft |
| Salesforce | OUT | Activity log, notes |
| Slack | OUT | CSM notification |
| Google Tasks | OUT | Task creation |

## UI/UX Requirements

### Post-Call Summary View
- Display meeting summary in customer detail timeline
- Show extracted action items with checkboxes
- Quick approve/edit follow-up email inline
- One-click task creation confirmation

### Notification Card
- Expandable card showing key insights
- Traffic light indicator for sentiment
- Quick action buttons for common tasks

## Acceptance Criteria

### AC-1: Trigger Detection
- [ ] System detects Zoom meeting completion within 2 minutes
- [ ] System detects Otter transcript within 1 minute of availability
- [ ] Manual trigger processes immediately

### AC-2: Analysis Quality
- [ ] Summary accurately captures main discussion points
- [ ] All explicit action items extracted
- [ ] Sentiment reflects actual call tone
- [ ] No false positive risk signals

### AC-3: Task Creation
- [ ] Tasks created for all action items
- [ ] Owner correctly assigned
- [ ] Due dates reasonable (if not explicit)
- [ ] Tasks linked to customer

### AC-4: Email Draft
- [ ] Email includes all key information
- [ ] Tone matches customer relationship
- [ ] Requires approval before sending
- [ ] Recipients correctly populated

### AC-5: Notifications
- [ ] CSM notified within 5 minutes
- [ ] Slack message contains summary
- [ ] Quick actions functional

## Dependencies
- PRD-213: AI Meeting Summarization (core capability)
- PRD-209: Zoom Meeting Management (integration)
- PRD-181: Salesforce Bi-Directional Sync (CRM updates)
- PRD-186: Slack Notification Integration (notifications)

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Transcript unavailable | Medium | High | Fallback to manual notes input |
| AI extraction errors | Medium | Medium | CSM review before task creation |
| CRM sync failure | Low | Medium | Queue for retry, notify CSM |

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Processing time | < 5 min | Avg time from call end to completion |
| CSM time saved | 15 min/call | Survey, time tracking |
| Action item capture | > 90% | Manual audit sample |
| Follow-up email approval rate | > 80% | Approved vs edited drafts |

## Implementation Notes
- Use existing `meeting_analyses` table schema
- Leverage `MeetingIntelligenceService` for transcript analysis
- Integrate with existing approval queue system
- Consider batch processing for high-volume periods
