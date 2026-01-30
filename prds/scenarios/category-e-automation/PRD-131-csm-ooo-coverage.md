# PRD-131: CSM Out of Office → Coverage

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-131 |
| **Title** | CSM Out of Office → Coverage |
| **Category** | E: Workflow Automation |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When CSMs take time off, coverage for their accounts is often ad-hoc, leading to missed customer needs, delayed responses, and inconsistent service levels. The handoff process is manual and information transfer is incomplete.

## User Story
**As a** CSM
**I want** automatic coverage setup when I set out-of-office status
**So that** my customers receive uninterrupted service and I can take time off without worry

## Functional Requirements

### FR-1: OOO Detection
- Detect out-of-office via:
  - Google Calendar OOO event
  - Manual OOO flag in CSCX
  - Slack status change
  - PTO system integration
- Capture dates and duration

### FR-2: Coverage Assignment
- Assign coverage CSM:
  - Primary backup (pre-configured)
  - Team round-robin (if no primary)
  - Workload-balanced assignment
  - Skill/segment matching
- Support split coverage for large portfolios

### FR-3: Handoff Brief Generation
- Create coverage brief per account:
  - Current status and health
  - Active issues or risks
  - Pending tasks and deadlines
  - Scheduled meetings (to attend or reschedule)
  - Key stakeholder contacts
  - Context for ongoing conversations
- Generate portfolio summary

### FR-4: Customer Notification
- Notify customers (if configured):
  - Intro to covering CSM
  - OOO dates
  - How to reach coverage
  - Escalation path
- Support auto-email or manual trigger

### FR-5: System Updates
- Update routing automatically:
  - Email forwarding/CC rules
  - Slack channel membership
  - Task assignment redirection
  - Alert routing
  - Calendar meeting transfers

### FR-6: Coverage Dashboard
- Provide covering CSM with:
  - Portfolio view of covered accounts
  - Priority indicators
  - Quick access to key information
  - Action item list

### FR-7: Return Handback
- When CSM returns:
  - Activity summary during absence
  - Issues resolved/outstanding
  - Customer sentiment changes
  - Follow-up recommendations
- Seamless transition back

## Non-Functional Requirements

### NFR-1: Timeliness
- Coverage setup within 1 hour of OOO
- Handoff brief ready before OOO starts

### NFR-2: Completeness
- 100% account coverage
- All critical info in handoff

### NFR-3: Minimal Friction
- Covering CSM can work efficiently
- Original CSM can truly disconnect

## Technical Specifications

### Data Model
```typescript
interface OOOCoverage {
  id: string;
  csmId: string;
  coveringCsmId: string;
  startDate: Date;
  endDate: Date;
  status: 'scheduled' | 'active' | 'completed';
  coveredAccounts: CoveredAccount[];
  handoffBrief: {
    documentId: string;
    generatedAt: Date;
    viewedAt: Date | null;
  };
  customerNotifications: {
    sent: boolean;
    sentAt: Date | null;
    method: 'auto' | 'manual' | 'none';
  };
  routingUpdates: RoutingUpdate[];
  returnHandback: {
    summaryDocId: string | null;
    generatedAt: Date | null;
    activitiesDuringAbsence: ActivitySummary[];
    outstandingIssues: string[];
  };
  createdAt: Date;
}

interface CoveredAccount {
  customerId: string;
  priority: 'high' | 'medium' | 'low';
  healthScore: number;
  activeIssues: string[];
  upcomingMeetings: MeetingRef[];
  pendingTasks: TaskRef[];
  keyContacts: string[];
  contextNotes: string;
}

interface RoutingUpdate {
  type: 'email' | 'slack' | 'tasks' | 'alerts';
  originalRouting: string;
  temporaryRouting: string;
  revertedAt: Date | null;
}
```

### API Endpoints
- `POST /api/coverage/setup` - Setup coverage
- `GET /api/coverage/:csmId/current` - Current coverage status
- `GET /api/coverage/:coverageId/handoff` - Get handoff brief
- `POST /api/coverage/:coverageId/notify-customers` - Send notifications
- `POST /api/coverage/:coverageId/return` - Process return

### Agent Involvement
| Agent | Role |
|-------|------|
| Orchestrator | Coordinate coverage setup |
| Researcher | Generate handoff briefs |
| Communicator | Customer notifications |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Google Calendar | IN | OOO detection |
| Slack | IN/OUT | Status, routing |
| Gmail | OUT | Forwarding, notifications |
| Tasks | IN/OUT | Reassignment |

## UI/UX Requirements

### OOO Setup Wizard
- Date selection
- Coverage CSM selection
- Notification preferences
- Account priority review

### Coverage Dashboard
- Clear view of covered accounts
- Priority sorting
- Quick context access
- Action quick links

### Return Summary
- Activity timeline
- Issue summary
- Recommendations

## Acceptance Criteria

- [ ] OOO detected from calendar
- [ ] Coverage CSM assigned
- [ ] Handoff brief generated
- [ ] Routing updated correctly
- [ ] Customer notifications sent (if enabled)
- [ ] Return handback generated

## Dependencies
- PRD-258: Coverage Backup System
- PRD-247: Team Handoff Workflow
- PRD-186: Slack Notification Integration
- PRD-188: Google Calendar Sync

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Coverage setup time | < 1 hour | OOO to active coverage |
| Customer response time | Unchanged | SLA maintained |
| Issue escalation rate | Unchanged | Escalations during OOO |
| CSM satisfaction | > 4/5 | Post-OOO survey |

## Implementation Notes
- Pre-configure backup CSM relationships
- Build coverage routing rules engine
- Consider automatic calendar event handling
- Support partial day coverage
