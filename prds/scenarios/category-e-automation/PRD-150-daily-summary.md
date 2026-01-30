# PRD-150: End of Day → Daily Summary

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-150 |
| **Title** | End of Day → Daily Summary |
| **Category** | E: Workflow Automation |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs end their day without a clear picture of what was accomplished and what needs attention tomorrow. This leads to dropped balls, anxiety about forgotten items, and inefficient morning ramp-up.

## User Story
**As a** CSM
**I want** an automatic daily summary at end of day
**So that** I can close out the day confidently and start tomorrow prepared

## Functional Requirements

### FR-1: Summary Trigger
- Trigger daily summary at:
  - Configurable end-of-day time
  - CSM's local timezone
  - Workday detection (skip weekends if configured)
  - Manual trigger option

### FR-2: Today's Accomplishments
- Compile day's activities:
  - Tasks completed
  - Meetings held (with outcomes)
  - Emails sent
  - Calls made
  - Documents created
  - Issues resolved
- Celebrate wins

### FR-3: Tomorrow's Preview
- Preview next day:
  - Scheduled meetings
  - Due tasks
  - Approaching deadlines
  - Renewal reminders
  - Follow-up reminders
- Prioritized view

### FR-4: Attention Required
- Highlight items needing attention:
  - Overdue tasks
  - Missed follow-ups
  - Health score alerts
  - Pending approvals
  - Unanswered emails
- Severity indicators

### FR-5: Portfolio Health Snapshot
- Quick portfolio view:
  - Overall health summary
  - Customers needing attention
  - Risk signals active
  - Upcoming renewals (30 days)
  - Recent health changes

### FR-6: Key Metrics
- Daily metrics summary:
  - Customer touches
  - Response times
  - Task completion rate
  - Meeting effectiveness
  - Trend vs average

### FR-7: Delivery Options
- Configurable delivery:
  - Email digest
  - Slack DM
  - In-app summary
  - All of the above
- Mobile-friendly format

### FR-8: Weekly Comparison
- End-of-week enhanced summary:
  - Week's accomplishments
  - Week vs previous week
  - Goals progress
  - Next week preview

## Non-Functional Requirements

### NFR-1: Timeliness
- Summary delivered within 15 minutes of trigger
- Consistent timing daily

### NFR-2: Relevance
- Information actionable
- Not overwhelming (prioritized)

### NFR-3: Personalization
- Adapts to CSM's portfolio
- Learns preferences over time

## Technical Specifications

### Data Model
```typescript
interface DailySummary {
  id: string;
  csmId: string;
  date: Date;
  timezone: string;
  accomplishments: {
    tasksCompleted: TaskRef[];
    meetingsHeld: MeetingSummary[];
    emailsSent: number;
    callsMade: number;
    documentsCreated: string[];
    issuesResolved: string[];
  };
  tomorrow: {
    meetings: MeetingPreview[];
    tasksDue: TaskRef[];
    deadlines: Deadline[];
    reminders: Reminder[];
  };
  attention: {
    overdueTasks: TaskRef[];
    missedFollowUps: FollowUp[];
    alerts: Alert[];
    pendingApprovals: ApprovalRef[];
    unansweredEmails: EmailRef[];
  };
  portfolio: {
    totalCustomers: number;
    healthDistribution: Record<string, number>;
    needingAttention: CustomerRef[];
    riskSignals: number;
    upcomingRenewals: RenewalPreview[];
  };
  metrics: {
    customerTouches: number;
    avgResponseTime: number;
    taskCompletionRate: number;
    vsAverage: Record<string, number>;
  };
  delivery: {
    channels: string[];
    sentAt: Date;
    viewedAt: Date | null;
  };
  createdAt: Date;
}
```

### API Endpoints
- `POST /api/summary/daily/trigger` - Trigger summary
- `GET /api/summary/daily/:date` - Get summary
- `PUT /api/summary/settings` - Update preferences
- `GET /api/summary/weekly` - Get weekly summary

### Agent Involvement
| Agent | Role |
|-------|------|
| Monitor | Compile activities |
| Orchestrator | Generate summary |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Tasks | IN | Completion data |
| Calendar | IN | Meeting data |
| Gmail | IN | Email activity |
| Health Scores | IN | Portfolio health |
| Gmail/Slack | OUT | Summary delivery |

## UI/UX Requirements

### Summary Email
- Clean, scannable layout
- Section headers
- Action links
- Mobile optimized

### In-App Summary
- Dashboard widget
- Expandable sections
- Quick actions
- Drill-down capability

### Weekly View
- Week comparison
- Trend charts
- Goal tracking

## Acceptance Criteria

- [ ] Summary triggers at configured time
- [ ] Accomplishments accurately captured
- [ ] Tomorrow preview complete
- [ ] Attention items highlighted
- [ ] Portfolio snapshot accurate
- [ ] Delivery reliable

## Dependencies
- PRD-151: Personal Weekly Summary Report
- PRD-214: Intelligent Task Prioritization
- PRD-057: "What Accounts Need Attention?" Briefing

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Open rate | > 80% | Summaries viewed |
| CSM satisfaction | > 4/5 | Utility survey |
| Morning ramp time | -30% | Time to productive |
| Dropped items | -50% | Overdue reduction |

## Implementation Notes
- Use scheduled jobs for daily trigger
- Build configurable summary components
- Implement learning for personalization
- Support summary customization
- Consider gamification elements
