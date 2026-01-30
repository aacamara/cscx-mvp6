# PRD-132: Account Team Change → Update Propagation

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-132 |
| **Title** | Account Team Change → Update Propagation |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When account team members change (CSM reassignment, AE change, support rep change), the update doesn't propagate consistently across systems, leading to communication gaps, incorrect routing, and confusion about responsibilities.

## User Story
**As a** CS Operations Manager
**I want** automatic update propagation when account team members change
**So that** all systems reflect the correct team and communication flows correctly

## Functional Requirements

### FR-1: Change Detection
- Detect team changes via:
  - CRM account owner update
  - Manual team assignment in CSCX
  - Org structure changes
  - Employee departure/transfer
- Capture change details and effective date

### FR-2: Affected Systems Identification
- Identify systems requiring update:
  - CRM (Salesforce, HubSpot)
  - CSCX customer record
  - Slack channels
  - Email distribution lists
  - Support system assignments
  - Calendar permissions
  - Document access
  - Automation routing

### FR-3: Update Propagation
- Propagate changes to all systems:
  - Update ownership/assignment fields
  - Modify access permissions
  - Update routing rules
  - Refresh notification preferences
- Validate updates completed

### FR-4: Transition Support
- Facilitate smooth transition:
  - Generate handoff document
  - Schedule transition meeting
  - Transfer active tasks
  - Update customer records
- Track transition progress

### FR-5: Customer Communication
- Prepare customer notification:
  - Introduction to new team member
  - Continuity assurance
  - Contact information
  - Transition timeline
- Queue for approval

### FR-6: Historical Record
- Maintain team history:
  - Previous team members
  - Tenure on account
  - Handoff dates
  - Transition notes
- Support reporting and analysis

## Non-Functional Requirements

### NFR-1: Consistency
- 100% system synchronization
- No orphaned records

### NFR-2: Timeliness
- Propagation within 4 hours
- Urgent changes immediate

### NFR-3: Auditability
- Full change log
- Compliance support

## Technical Specifications

### Data Model
```typescript
interface AccountTeamChange {
  id: string;
  customerId: string;
  changeType: 'csm' | 'ae' | 'support' | 'executive_sponsor' | 'other';
  previousAssignment: TeamMember;
  newAssignment: TeamMember;
  effectiveDate: Date;
  reason: string;
  propagationStatus: PropagationStatus[];
  transition: {
    handoffDocId: string | null;
    meetingScheduled: boolean;
    tasksTransferred: boolean;
    customerNotified: boolean;
  };
  createdBy: string;
  createdAt: Date;
}

interface PropagationStatus {
  system: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  updatedAt: Date | null;
  error: string | null;
}
```

### API Endpoints
- `POST /api/team/change` - Record team change
- `GET /api/team/change/:id/status` - Propagation status
- `POST /api/team/change/:id/retry` - Retry failed updates
- `GET /api/team/customer/:customerId/history` - Team history

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Salesforce | BI-DIR | Owner updates |
| Slack | OUT | Channel membership |
| Google Workspace | OUT | Permissions |
| Support System | OUT | Assignment |

## Acceptance Criteria

- [ ] Changes detected from all sources
- [ ] All systems updated
- [ ] Transition support provided
- [ ] Customer notification prepared
- [ ] History maintained

## Dependencies
- PRD-247: Team Handoff Workflow
- PRD-181: Salesforce Bi-Directional Sync
- PRD-186: Slack Notification Integration

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Propagation rate | 100% | Systems updated |
| Propagation time | < 4 hours | Change to completion |
| Error rate | < 5% | Failed updates |

## Implementation Notes
- Build system registry for propagation
- Implement retry logic for failures
- Consider staged rollout
- Support bulk changes for org restructures
