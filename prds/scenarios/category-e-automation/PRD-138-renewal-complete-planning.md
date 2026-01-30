# PRD-138: Contract Renewal Complete → Planning

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-138 |
| **Title** | Contract Renewal Complete → Planning |
| **Category** | E: Workflow Automation |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
After a contract renewal closes, there's often a lull before the next active engagement phase. CSMs miss the opportunity to reset success plans, capture renewal learnings, and establish momentum for the new contract period.

## User Story
**As a** CSM
**I want** automatic planning initiation when a renewal completes
**So that** I can quickly reset success plans and maintain momentum with the customer

## Functional Requirements

### FR-1: Renewal Completion Detection
- Detect renewal completion:
  - Contract signed (new term)
  - Salesforce opportunity closed-won (renewal)
  - Renewal pipeline stage update
  - Manual confirmation
- Capture new contract terms

### FR-2: Contract Update
- Update customer record:
  - New renewal date
  - Updated ARR
  - Modified entitlements
  - Term changes
  - New stakeholders (if any)

### FR-3: Success Plan Reset
- Generate new success plan:
  - Carry forward incomplete goals
  - Set new period objectives
  - Define fresh KPIs
  - Identify expansion opportunities
  - Plan relationship deepening
- Use template for segment

### FR-4: Kickoff Planning
- Plan renewal-period kickoff:
  - Schedule planning meeting
  - Prepare agenda
  - Identify attendees
  - Generate discussion guide

### FR-5: Internal Debrief
- Document renewal learnings:
  - What went well
  - Challenges encountered
  - Competitive factors
  - Pricing insights
  - Relationship assessment
- Store for future reference

### FR-6: Notifications
- Notify stakeholders:
  - CSM with new plan template
  - Sales with renewal success
  - Leadership for strategic accounts
  - Finance for billing setup

### FR-7: Health Reset
- Consider health adjustments:
  - Reset engagement baseline
  - Clear renewal-related signals
  - Set new monitoring thresholds

## Non-Functional Requirements

### NFR-1: Timeliness
- Planning initiated within 48 hours
- Kickoff scheduled within 2 weeks

### NFR-2: Continuity
- No loss of historical context
- Smooth transition between periods

## Technical Specifications

### Data Model
```typescript
interface RenewalCompletionPlanning {
  id: string;
  customerId: string;
  renewalId: string;
  previousContract: {
    endDate: Date;
    arr: number;
    term: string;
  };
  newContract: {
    startDate: Date;
    endDate: Date;
    arr: number;
    term: string;
    changes: string[];
  };
  successPlan: {
    newPlanId: string;
    carryForwardGoals: string[];
    newObjectives: string[];
    generatedAt: Date;
  };
  kickoff: {
    scheduledAt: Date | null;
    attendees: string[];
    agendaDocId: string | null;
  };
  debrief: {
    completed: boolean;
    documentId: string | null;
    learnings: string[];
  };
  notifications: NotificationLog[];
  createdAt: Date;
}
```

### API Endpoints
- `POST /api/renewals/:id/complete` - Process completion
- `GET /api/renewals/:id/planning` - Get planning status
- `POST /api/renewals/:id/kickoff` - Schedule kickoff
- `PUT /api/renewals/:id/debrief` - Record debrief

### Agent Involvement
| Agent | Role |
|-------|------|
| Orchestrator | Coordinate planning workflow |
| Scheduler | Plan kickoff meeting |
| Researcher | Compile renewal learnings |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Salesforce | IN | Renewal data |
| Contracts | IN/OUT | Contract updates |
| Success Plans | OUT | New plan creation |
| Calendar | OUT | Kickoff scheduling |

## Acceptance Criteria

- [ ] Renewal completion detected
- [ ] Contract record updated
- [ ] Success plan generated
- [ ] Kickoff planned
- [ ] Debrief captured
- [ ] Stakeholders notified

## Dependencies
- PRD-089: Renewal Approaching → Prep Checklist
- PRD-163: Renewal Forecast Report
- PRD-027: Renewal Proposal Generator

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Planning completion | 100% | Renewals with new plans |
| Kickoff scheduling | > 80% | Kickoffs within 2 weeks |
| Debrief capture | > 70% | Learnings documented |

## Implementation Notes
- Use `renewal_pipeline` table for tracking
- Build success plan templates by segment
- Integrate with contract management
- Consider multi-year renewal handling
