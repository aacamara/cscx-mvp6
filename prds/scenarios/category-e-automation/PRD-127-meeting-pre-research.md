# PRD-127: Meeting Booked → Pre-Meeting Research

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-127 |
| **Title** | Meeting Booked → Pre-Meeting Research |
| **Category** | E: Workflow Automation |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs often enter customer meetings underprepared, scrambling to review account details at the last minute. This leads to less productive conversations, missed opportunities, and a perception of disorganization.

## User Story
**As a** CSM
**I want** automatic pre-meeting research when a customer meeting is booked
**So that** I enter every meeting fully prepared with relevant context and talking points

## Functional Requirements

### FR-1: Meeting Detection
- Detect customer meetings via:
  - Google Calendar event creation
  - Calendly booking notification
  - Zoom meeting scheduled
  - Manual meeting entry
- Identify customer from attendees

### FR-2: Research Compilation
- Gather relevant information:
  - Customer health score and trends
  - Recent interactions (emails, calls, support)
  - Open action items and tasks
  - Recent risk signals
  - Usage metrics highlights
  - Stakeholder updates
  - Previous meeting notes
  - Open opportunities

### FR-3: Prep Brief Generation
- Create meeting prep document:
  - Meeting context (agenda if available)
  - Customer snapshot
  - Key talking points
  - Questions to ask
  - Items requiring follow-up
  - Recent wins to celebrate
  - Concerns to address
- Deliver at configurable lead time

### FR-4: Attendee Intelligence
- Research attendees:
  - Role and influence
  - Interaction history
  - Sentiment indicators
  - LinkedIn updates (if integrated)
  - Meeting frequency

### FR-5: Contextual Recommendations
- Suggest meeting focus based on:
  - Customer lifecycle stage
  - Health score trajectory
  - Upcoming milestones (renewal, QBR)
  - Open issues or opportunities
  - Time since last deep engagement

### FR-6: Delivery Timing
- Send prep brief:
  - 24 hours before meeting (initial)
  - 1 hour before meeting (reminder with updates)
  - Optional: morning digest for day's meetings
- Channels: email, Slack, in-app

### FR-7: Historical Context
- Include relevant history:
  - Previous meeting summaries
  - Decisions made
  - Commitments outstanding
  - Relationship trajectory

## Non-Functional Requirements

### NFR-1: Timeliness
- Research ready 24 hours before meeting
- Updates reflected until 1 hour before

### NFR-2: Relevance
- Information prioritized by importance
- Brevity over completeness
- Actionable insights highlighted

### NFR-3: Reliability
- 100% meeting detection
- No missed customer meetings

## Technical Specifications

### Data Model
```typescript
interface MeetingPrepBrief {
  id: string;
  meetingId: string;
  calendarEventId: string;
  customerId: string;
  csmId: string;
  scheduledAt: Date;
  prepDeliveredAt: Date | null;
  reminderDeliveredAt: Date | null;
  content: {
    customerSnapshot: CustomerSnapshot;
    recentActivity: ActivitySummary[];
    openItems: OpenItem[];
    talkingPoints: TalkingPoint[];
    questions: string[];
    attendeeProfiles: AttendeeProfile[];
    recommendations: string[];
  };
  status: 'scheduled' | 'delivered' | 'viewed' | 'completed';
  viewedAt: Date | null;
}

interface CustomerSnapshot {
  name: string;
  healthScore: number;
  healthTrend: 'up' | 'down' | 'stable';
  arr: number;
  renewalDate: Date;
  stage: string;
  daysSinceLastMeeting: number;
}
```

### API Endpoints
- `GET /api/meetings/today` - Today's meetings with prep status
- `GET /api/meetings/:id/prep` - Get prep brief
- `POST /api/meetings/:id/prep/refresh` - Refresh prep brief
- `PUT /api/meetings/:id/prep/viewed` - Mark as viewed

### Agent Involvement
| Agent | Role |
|-------|------|
| Researcher | Compile customer intelligence |
| Orchestrator | Coordinate prep generation |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Google Calendar | IN | Meeting detection |
| Calendly | IN | Booking notification |
| Customer Data | IN | All customer context |
| Gmail/Slack | OUT | Prep delivery |
| Google Docs | OUT | Prep brief document |

## UI/UX Requirements

### Meeting Prep View
- Daily meeting list with prep status
- Quick expand for key points
- One-click to full brief
- Mark as reviewed

### Prep Brief Format
- Executive summary at top
- Expandable sections
- Mobile-friendly format
- Quick access links

## Acceptance Criteria

- [ ] All customer meetings detected
- [ ] Prep brief generated 24 hours before
- [ ] Reminder sent 1 hour before
- [ ] Content accurate and relevant
- [ ] Attendee profiles included
- [ ] Historical context available

## Dependencies
- PRD-056: "Tell Me About [Account]" Command
- PRD-233: Smart Meeting Prep
- PRD-188: Google Calendar Sync
- PRD-077: Meeting History & Outcomes

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Prep delivery rate | 100% | Briefs delivered on time |
| CSM usage rate | > 70% | Briefs viewed before meeting |
| Meeting effectiveness | +20% | Post-meeting survey |

## Implementation Notes
- Use Google Calendar API for detection
- Cache customer data for quick assembly
- Consider ML for talking point prioritization
- Integrate with meeting notes for feedback loop
