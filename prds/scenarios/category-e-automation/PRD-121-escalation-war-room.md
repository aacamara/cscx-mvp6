# PRD-121: Escalation Logged → War Room

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-121 |
| **Title** | Escalation Logged → War Room |
| **Category** | E: Workflow Automation |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When a customer escalation is logged, coordination among multiple stakeholders (CSM, Support, Product, Engineering, Leadership) is often chaotic. Information is scattered, updates are inconsistent, and there's no central command center for managing the escalation through resolution.

## User Story
**As a** CSM or CS Leader
**I want** automatic war room creation when an escalation is logged
**So that** all stakeholders can coordinate effectively, track progress, and resolve the issue quickly

## Functional Requirements

### FR-1: Escalation Detection
- Detect escalation logging via:
  - Manual escalation creation in CSCX
  - Support ticket marked as escalation
  - Risk signal severity = critical
  - Customer explicit escalation request
  - Executive involvement trigger
- Classify escalation severity: P1 (critical), P2 (high), P3 (medium)

### FR-2: War Room Creation
- Automatically create dedicated Slack channel:
  - Naming: `#war-room-{customer}-{date}`
  - Channel description with escalation summary
  - Pinned escalation brief
- Add initial participants based on escalation type:
  - CSM (owner)
  - CSM Manager
  - Support Lead (if support-related)
  - Product contact (if product-related)
  - Engineering contact (if technical)
  - Executive sponsor (if P1)

### FR-3: Escalation Brief
- Generate escalation document containing:
  - Customer overview (name, ARR, segment, health)
  - Issue description and impact
  - Timeline of events
  - Current status
  - Stakeholders involved
  - Key contacts at customer
  - Previous escalations (if any)
  - Recommended resolution path

### FR-4: War Room Dashboard
- Create central tracking view:
  - Status: Active, Resolved, Post-mortem
  - Time in escalation
  - Last update timestamp
  - Assigned owner
  - Severity level
  - Customer impact score
  - Resolution progress

### FR-5: Communication Templates
- Pre-generate communication templates:
  - Internal status update (for Slack)
  - Customer acknowledgment email
  - Executive briefing summary
  - Resolution notification
- Store in war room channel and Drive

### FR-6: Status Update Automation
- Scheduled status prompts:
  - Every 4 hours for P1
  - Every 8 hours for P2
  - Daily for P3
- Auto-compile updates from channel activity
- Generate status report for stakeholders

### FR-7: Resource Coordination
- Track resource allocation:
  - Who is working on what
  - Availability status
  - Time invested
- Schedule coordination meetings:
  - Initial war room kickoff
  - Regular syncs (based on severity)
  - Resolution review

### FR-8: Resolution & Close-out
- Resolution workflow:
  - Mark issue resolved
  - Capture resolution details
  - Customer confirmation
  - Post-mortem scheduling
- Archive channel but retain history

## Non-Functional Requirements

### NFR-1: Speed
- War room creation < 2 minutes
- Slack channel ready immediately
- All participants notified within 5 minutes

### NFR-2: Reliability
- 100% escalation capture
- Channel creation never fails
- Participant addition always works

### NFR-3: Visibility
- All stakeholders see same information
- Real-time status updates
- Full audit trail

## Technical Specifications

### Data Model
```typescript
interface Escalation {
  id: string;
  customerId: string;
  severity: 'P1' | 'P2' | 'P3';
  status: 'active' | 'resolved' | 'post_mortem' | 'closed';
  category: 'technical' | 'support' | 'product' | 'commercial' | 'relationship';
  title: string;
  description: string;
  impact: string;
  customerContacts: string[];
  timeline: TimelineEvent[];
  createdAt: Date;
  resolvedAt: Date | null;
  createdBy: string;
  ownerId: string;
}

interface WarRoom {
  escalationId: string;
  slackChannelId: string;
  slackChannelName: string;
  participants: Participant[];
  briefDocumentId: string;
  dashboardUrl: string;
  statusUpdates: StatusUpdate[];
  meetings: MeetingRef[];
  communications: CommunicationLog[];
  resolution: Resolution | null;
  createdAt: Date;
  closedAt: Date | null;
}

interface Participant {
  userId: string;
  role: 'owner' | 'support' | 'product' | 'engineering' | 'executive' | 'observer';
  addedAt: Date;
  notificationPreference: 'all' | 'critical' | 'summary';
}
```

### API Endpoints
- `POST /api/escalations` - Create escalation
- `GET /api/escalations/:id` - Get escalation details
- `PUT /api/escalations/:id/status` - Update status
- `POST /api/escalations/:id/war-room` - Create war room
- `POST /api/escalations/:id/update` - Add status update
- `POST /api/escalations/:id/resolve` - Mark resolved

### Agent Involvement
| Agent | Role |
|-------|------|
| Orchestrator | Coordinate war room setup |
| Communicator | Draft communications |
| Researcher | Compile customer context |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Slack | OUT | Channel creation, messages |
| Google Docs | OUT | Escalation brief |
| Google Calendar | OUT | Coordination meetings |
| Gmail | OUT | Customer communications |
| Support System | IN | Ticket details |

## UI/UX Requirements

### Escalation Form
- Quick escalation creation
- Severity selection with guidance
- Category classification
- Impact description
- Stakeholder tagging

### War Room Dashboard
- Active escalations list
- Severity-coded indicators
- Time tracking prominently displayed
- Quick status update button
- One-click join Slack channel

### Timeline View
- Chronological event display
- Status change markers
- Communication logs
- Meeting notes integrated

## Acceptance Criteria

### AC-1: Escalation Detection
- [ ] Manual escalation creates war room
- [ ] Critical risk signal triggers escalation flow
- [ ] Severity correctly classified

### AC-2: War Room Creation
- [ ] Slack channel created within 2 minutes
- [ ] Channel name follows convention
- [ ] Description includes key details

### AC-3: Participant Management
- [ ] Correct participants added based on type
- [ ] All participants notified
- [ ] Participant list visible in channel

### AC-4: Escalation Brief
- [ ] Document created in customer folder
- [ ] All required sections populated
- [ ] Pinned in Slack channel

### AC-5: Status Updates
- [ ] Prompts sent on schedule
- [ ] Updates captured and logged
- [ ] Summary generated automatically

### AC-6: Resolution
- [ ] Resolution captured with details
- [ ] Customer notified
- [ ] Channel archived appropriately

## Dependencies
- PRD-186: Slack Notification Integration
- PRD-243: Internal Escalation Workflow
- PRD-252: War Room Coordination
- PRD-087: Support Ticket Spike → Escalation

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Slack API rate limits | Low | Medium | Queue channel creation |
| Participant unavailable | Medium | Medium | Backup assignment process |
| Channel proliferation | Medium | Low | Auto-archive after resolution |

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to war room | < 2 min | Escalation to channel creation |
| Mean time to resolution | -30% | Compared to pre-automation |
| Stakeholder satisfaction | > 4/5 | Post-escalation survey |
| Escalation recurrence | < 15% | Same customer, same issue |

## Implementation Notes
- Use Slack `conversations.create` for private channels
- Leverage `ESCALATION_REPORT` template from Google Docs
- Consider using Slack workflows for status prompts
- Archive channels after 7 days of resolution
