# PRD-077: Meeting History & Outcomes

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Provide a comprehensive view of all meetings with a customer account including schedules, attendees, outcomes, action items, and follow-up status. This meeting history enables CSMs to track relationship touchpoints, ensure commitments are fulfilled, and prepare effectively for future meetings with full historical context.

## User Story
As a CSM, I want to see all meetings I've had with a customer and their outcomes so that I can track our commitments, reference past discussions, and prepare effectively for upcoming meetings.

As a CS Leader, I want to see meeting patterns across accounts so that I can ensure appropriate engagement levels and identify accounts that may need more attention.

## Trigger
- Navigation: Customer Detail > Meetings Tab
- Natural language: "Show me meeting history for [Account]"
- Variations: "Past meetings with [Account]", "What did we discuss with [Account]?", "Meeting outcomes"
- Meeting prep: Auto-surface before scheduled meetings

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to display |
| Time Period | String | No | "all", "6m", "12m", "ytd" |
| Status Filter | String | No | "all", "completed", "upcoming", "cancelled" |

## Meeting Data Model
```typescript
interface Meeting {
  id: string;
  customerId: string;

  // Basic info
  title: string;
  description: string;
  meetingType: MeetingType;
  scheduledAt: Date;
  duration: number;  // minutes
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';

  // Participants
  organizer: string;
  internalAttendees: Attendee[];
  externalAttendees: Attendee[];
  attendanceStatus: Record<string, 'attended' | 'no_show' | 'partial'>;

  // Location/Access
  meetingUrl: string;
  calendarEventId: string;
  recordingUrl: string;
  transcriptId: string;

  // Outcomes (post-meeting)
  summary: string;
  outcomes: MeetingOutcome[];
  actionItems: ActionItem[];
  nextMeeting: Date | null;
  sentiment: 'positive' | 'neutral' | 'negative';

  // Analysis
  analysis: MeetingAnalysis;
}

interface MeetingOutcome {
  type: 'decision' | 'commitment' | 'insight' | 'risk' | 'opportunity';
  description: string;
  owner: string;
  dueDate: Date | null;
  status: 'open' | 'in_progress' | 'completed' | 'overdue';
}

interface ActionItem {
  id: string;
  description: string;
  owner: string;
  dueDate: Date;
  status: 'pending' | 'completed' | 'overdue';
  completedAt: Date | null;
  notes: string;
}
```

## Meeting Types
| Type | Description | Typical Frequency |
|------|-------------|-------------------|
| Kickoff | Initial meeting | Once |
| Check-in | Regular touchpoint | Monthly |
| QBR | Quarterly Business Review | Quarterly |
| Training | Product training | As needed |
| Escalation | Issue resolution | As needed |
| Expansion | Growth discussion | As needed |
| Renewal | Contract renewal | Annual |
| Executive | Exec-to-exec | Quarterly |
| Technical | Technical review | As needed |

## Output Format
```markdown
## Meeting History: Acme Corp
Customer Since: Jan 2024 | Total Meetings: 24

### Meeting Stats
| Metric | Value | vs Average |
|--------|-------|------------|
| Total Meetings | 24 | ▲ +15% |
| This Quarter | 6 | ● Average |
| Avg Frequency | 2/month | ● On target |
| Attendance Rate | 92% | ▲ Above avg |
| Last Meeting | Jan 22, 2026 | 6 days ago |
| Next Meeting | Feb 5, 2026 | QBR |

---

### Upcoming Meetings

#### QBR - February 5, 2026 @ 2:00 PM
**Duration**: 60 minutes | **Location**: Zoom

**Attendees**:
- Internal: Sarah Johnson (CSM), Mike Chen (AE)
- Customer: Sarah Chen (VP Ops), Tom Williams (CEO)

**Agenda**:
1. Value delivered review
2. Success metrics update
3. Q2 objectives alignment
4. Expansion discussion
5. Roadmap preview

**Prep Status**: [In Progress - 60%]
- [x] Value summary drafted
- [x] Metrics pulled
- [ ] Deck finalized
- [ ] Stakeholder objectives gathered

[View Prep Checklist] [Edit Meeting] [Join Zoom]

---

### Recent Meetings

#### Monthly Check-in - January 22, 2026
**Status**: ✓ Completed | **Duration**: 45 min | **Sentiment**: Positive

**Attendees**: Sarah Johnson, Sarah Chen, Mike Lee

**Summary**:
Discussed Q4 achievements and Q1 priorities. Sarah Chen shared that
the team is seeing significant time savings. Mike Lee raised concerns
about recent performance issues which have been escalated to support.

**Key Outcomes**:
| Type | Description | Owner | Status |
|------|-------------|-------|--------|
| Commitment | Demo analytics module in Feb | Sarah J. | Scheduled |
| Risk | Performance issues flagged | Support | In Progress |
| Insight | Marketing team interested | Sarah J. | Follow up |

**Action Items**:
| Item | Owner | Due | Status |
|------|-------|-----|--------|
| Send analytics demo invite | Sarah J. | Jan 25 | ✓ Done |
| Escalate performance ticket | Sarah J. | Jan 23 | ✓ Done |
| Intro to Marketing VP | Sarah C. | Feb 1 | Pending |

**Recording**: [View Recording] | **Transcript**: [View Transcript]

---

#### Q4 QBR - December 15, 2025
**Status**: ✓ Completed | **Duration**: 60 min | **Sentiment**: Positive

**Attendees**: Sarah J., Mike C., Jane S. (Exec), Sarah C., Tom W. (CEO)

**Summary**:
Successful QBR covering Q4 performance. Highlighted 45% efficiency
improvement. Tom Williams expressed satisfaction and interest in
expanding to additional departments. Jane Smith proposed multi-year
renewal discussion for January.

**Key Outcomes**:
| Type | Description | Status |
|------|-------------|--------|
| Decision | Proceed with expansion planning | In Progress |
| Commitment | Multi-year renewal discussion | Scheduled |
| Opportunity | Marketing department expansion | Identified |

**Documents**: [QBR Deck] [Meeting Notes] [Value Summary]

---

#### Support Escalation Call - December 1, 2025
**Status**: ✓ Completed | **Duration**: 30 min | **Sentiment**: Neutral

**Summary**:
Emergency call to address critical bug affecting reports. Issue
identified and fix deployed within 24 hours. Customer appreciated
quick response. Offered service credit for inconvenience.

**Outcome**: Issue resolved, relationship maintained

---

### Meeting Timeline
[Visual timeline showing all meetings over 12 months]

```
2024  │ ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ●
      │ K                 Q        Q        Q   ▲
2025  │   Check-ins       QBR      QBR      QBR Now
```

---

### Meeting Type Distribution

| Type | Count | % of Total | Last |
|------|-------|------------|------|
| Check-in | 14 | 58% | Jan 22 |
| QBR | 4 | 17% | Dec 15 |
| Training | 3 | 13% | Oct 10 |
| Escalation | 2 | 8% | Dec 1 |
| Kickoff | 1 | 4% | Jan 15, 2024 |

---

### Attendee Analysis

**Customer Attendance**:
| Stakeholder | Meetings | Rate | Last Attended |
|-------------|----------|------|---------------|
| Sarah Chen | 22 | 92% | Jan 22 |
| Mike Lee | 12 | 75% | Jan 22 |
| Tom Williams | 4 | 100% (QBRs) | Dec 15 |
| Amy Wang | 6 | 67% | Nov 15 |

**Insight**: Strong champion attendance, but Mike Lee's rate declining

---

### Action Item Tracking

**Open Items**: 3 | **Completed (30d)**: 8 | **Overdue**: 1

| Item | Meeting | Owner | Due | Status |
|------|---------|-------|-----|--------|
| Intro to Marketing VP | Jan 22 | Sarah C. | Feb 1 | Pending |
| Share roadmap preview | Dec QBR | Sarah J. | Jan 30 | ⚠ Overdue |
| Send pricing proposal | Jan 22 | Mike C. | Feb 5 | On Track |

**Overdue Alert**: "Share roadmap preview" is 2 days overdue
[Mark Complete] [Extend Due Date] [Send Reminder]

---

### Commitment Fulfillment

| Commitment | Made | Owner | Status |
|------------|------|-------|--------|
| Multi-year renewal discussion | Dec 15 | Mike C. | Scheduled Feb 5 |
| Analytics demo | Jan 22 | Sarah J. | Completed Jan 28 |
| Monthly check-ins | Jan 2024 | Sarah J. | ✓ Maintained |
| Quarterly QBRs | Jan 2024 | Sarah J. | ✓ Maintained |

**Fulfillment Rate**: 95% (19/20 commitments kept)

---

### Quick Actions
[Schedule Meeting] [View All Transcripts] [Export Meeting History] [Generate Meeting Report]
```

## Acceptance Criteria
- [ ] All meetings displayed with status
- [ ] Upcoming meetings shown with prep status
- [ ] Past meetings show summary and outcomes
- [ ] Action items tracked with status
- [ ] Commitments tracked with fulfillment
- [ ] Attendee analysis accurate
- [ ] Meeting type distribution calculated
- [ ] Recording/transcript links work
- [ ] Overdue items highlighted
- [ ] Export to PDF available

## API Endpoint
```
GET /api/intelligence/meetings/:customerId
  Query: ?period=12m&status=all

POST /api/intelligence/meetings/:meetingId/outcomes
  Body: {
    "summary": "...",
    "outcomes": [...],
    "actionItems": [...]
  }

PATCH /api/intelligence/action-items/:itemId
  Body: { "status": "completed" }
```

## Data Sources
| Source | Table/API | Data |
|--------|-----------|------|
| Meetings | `meetings` | Core meeting data |
| Calendar | Google Calendar | Schedule, attendees |
| Transcripts | `transcripts` | Meeting content |
| Analysis | `meeting_analyses` | AI analysis |
| Actions | `action_items` | Action tracking |

## Integration Points
- Google Calendar: Meeting sync
- Zoom: Recording, transcript
- Otter.ai: Transcript backup
- Task systems: Action item sync

## Success Metrics
| Metric | Target |
|--------|--------|
| Meeting Documentation | > 90% have summary |
| Action Item Completion | > 85% on time |
| Commitment Fulfillment | > 90% |
| Meeting Frequency (at-risk) | Increase by 25% |

## Future Enhancements
- Auto-generated meeting summaries
- Suggested meeting topics based on context
- Meeting effectiveness scoring
- Cross-account meeting patterns
- Voice highlights from recordings

## Related PRDs
- PRD-062: Customer Journey Timeline
- PRD-116: Post-Call Processing
- PRD-166: Meeting Analytics Report
- PRD-213: AI Meeting Summarization
