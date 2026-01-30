# PRD-136: Risk Mitigation Complete → Status Update

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-136 |
| **Title** | Risk Mitigation Complete → Status Update |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When risk mitigation efforts complete (save plays, escalations resolved), status updates to stakeholders are inconsistent and health scores may not reflect the improvement, leading to outdated risk views.

## User Story
**As a** CSM
**I want** automatic status updates when risk mitigation completes
**So that** stakeholders are informed and customer health accurately reflects the resolution

## Functional Requirements

### FR-1: Completion Detection
- Detect mitigation completion:
  - Save play marked resolved
  - Escalation closed
  - Risk signal resolved
  - Manual completion entry
- Capture outcome details

### FR-2: Status Update Generation
- Generate status updates:
  - Resolution summary
  - Actions taken
  - Outcome achieved
  - Remaining considerations
  - Next steps (if any)

### FR-3: Stakeholder Notification
- Notify relevant parties:
  - CSM Manager
  - Executive sponsor (for critical risks)
  - Sales partner (if applicable)
  - Support team (if involved)
- Channel based on severity

### FR-4: Health Score Update
- Update customer health:
  - Remove resolved risk signal
  - Recalculate health score
  - Update trend indicators
  - Log health change reason

### FR-5: Documentation
- Document outcome:
  - Update save play record
  - Close escalation record
  - Log in customer timeline
  - Store lessons learned

### FR-6: Post-Mitigation Monitoring
- Set up follow-up monitoring:
  - Watch for recurrence
  - Track stability period
  - Validate long-term resolution
- Alert if issue returns

## Non-Functional Requirements

### NFR-1: Timeliness
- Updates within 2 hours of completion
- Health recalculation immediate

### NFR-2: Accuracy
- Correct stakeholders notified
- Health accurately reflects resolution

## Technical Specifications

### Data Model
```typescript
interface RiskMitigationCompletion {
  id: string;
  riskId: string;
  customerId: string;
  riskType: 'save_play' | 'escalation' | 'risk_signal';
  outcome: 'resolved' | 'partially_resolved' | 'unresolved';
  resolution: {
    summary: string;
    actionsTaken: string[];
    lessonsLearned: string[];
    nextSteps: string[];
  };
  notifications: {
    sent: string[];
    sentAt: Date;
  };
  healthUpdate: {
    previousScore: number;
    newScore: number;
    signalRemoved: boolean;
  };
  monitoring: {
    stabilityPeriod: number;
    monitoringEndDate: Date;
    recurrenceDetected: boolean;
  };
  completedAt: Date;
}
```

### API Endpoints
- `POST /api/risk/:id/complete` - Mark mitigation complete
- `GET /api/risk/:customerId/resolved` - Resolved risks
- `PUT /api/risk/:id/recurrence` - Log recurrence

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Save Plays | BI-DIR | Status updates |
| Health Score | OUT | Recalculation |
| Slack | OUT | Notifications |
| Risk Signals | OUT | Resolution |

## Acceptance Criteria

- [ ] Completion detected and logged
- [ ] Status updates generated
- [ ] Stakeholders notified
- [ ] Health score recalculated
- [ ] Post-mitigation monitoring active

## Dependencies
- PRD-083: Account Risk Factors Deep Dive
- PRD-113: Risk Score Calculation
- PRD-107: Health Score Threshold Alert

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Update timeliness | < 2 hours | Completion to notification |
| Health accuracy | 100% | Score reflects resolution |
| Recurrence tracking | 100% | Monitored post-resolution |

## Implementation Notes
- Use `save_plays` table for save play status
- Trigger health recalculation on resolution
- Set monitoring period based on risk type
- Build recurrence detection rules
