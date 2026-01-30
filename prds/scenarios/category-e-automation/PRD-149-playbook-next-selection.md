# PRD-149: Playbook Completed → Next Selection

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-149 |
| **Title** | Playbook Completed → Next Selection |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When a playbook completes, there's no systematic evaluation of what should come next. CSMs may leave customers in limbo, miss follow-on opportunities, or start inappropriate next steps without considering the playbook outcome.

## User Story
**As a** CSM
**I want** automatic next playbook recommendations when a playbook completes
**So that** I maintain continuous engagement and select the right next steps based on outcomes

## Functional Requirements

### FR-1: Playbook Completion Detection
- Detect playbook completion:
  - All steps marked complete
  - Manual completion trigger
  - Timeout completion
  - Cancellation
- Capture completion context

### FR-2: Outcome Assessment
- Assess playbook outcome:
  - Goals achieved
  - Health score change
  - Customer sentiment
  - Engagement level
  - Outstanding items
- Classify: Success, partial, incomplete, failed

### FR-3: Next Playbook Matching
- Recommend next playbook based on:
  - Previous playbook type
  - Outcome achieved
  - Current health status
  - Lifecycle stage
  - Customer segment
  - Time since last major engagement
- Score and rank recommendations

### FR-4: Transition Planning
- Plan smooth transition:
  - Gap period (avoid burnout)
  - Carry-forward items
  - Stakeholder continuity
  - Momentum maintenance

### FR-5: CSM Notification
- Present recommendations:
  - Top recommendation with rationale
  - Alternatives considered
  - Timing suggestions
  - Quick start option
- Allow acceptance, modification, or deferral

### FR-6: Continuous Journey
- Maintain customer journey view:
  - Playbook history
  - Outcome trajectory
  - Pattern identification
  - Success factors

### FR-7: No-Action Monitoring
- If no playbook selected:
  - Set reminder for re-evaluation
  - Monitor for triggers
  - Alert if customer health changes
  - Escalate if appropriate

## Non-Functional Requirements

### NFR-1: Timeliness
- Recommendation within 24 hours
- Transition smooth (no gap > 1 week)

### NFR-2: Relevance
- Recommendations contextually appropriate
- No inappropriate rapid succession

## Technical Specifications

### Data Model
```typescript
interface PlaybookCompletion {
  id: string;
  customerId: string;
  playbook: {
    id: string;
    type: string;
    name: string;
    startedAt: Date;
    completedAt: Date;
    duration: number;
  };
  outcome: {
    status: 'success' | 'partial' | 'incomplete' | 'failed' | 'cancelled';
    goalsAchieved: string[];
    goalsNotAchieved: string[];
    healthChange: number;
    sentimentChange: string;
    carryForwardItems: string[];
  };
  nextRecommendation: {
    playbooks: PlaybookOption[];
    timing: 'immediate' | 'next_week' | 'next_month' | 'monitor';
    rationale: string;
  };
  selection: {
    selectedPlaybookId: string | null;
    selectionDate: Date | null;
    deferredUntil: Date | null;
    selectionReason: string | null;
  };
  monitoring: {
    reminderSet: boolean;
    reminderDate: Date | null;
    healthThreshold: number | null;
  };
  createdAt: Date;
}

interface PlaybookOption {
  playbookId: string;
  name: string;
  type: string;
  matchScore: number;
  matchReason: string;
  suggestedStart: Date;
}
```

### API Endpoints
- `POST /api/playbooks/:id/complete` - Complete playbook
- `GET /api/playbooks/:id/next-recommendations` - Get recommendations
- `POST /api/playbooks/:id/select-next` - Select next playbook
- `POST /api/playbooks/:id/defer` - Defer selection
- `GET /api/playbooks/customer/:customerId/journey` - Customer journey

### Agent Involvement
| Agent | Role |
|-------|------|
| Monitor | Detect completion |
| Orchestrator | Generate recommendations |
| Researcher | Assess outcomes |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Playbooks | IN | Completion data |
| Health Score | IN | Current status |
| Customer Data | IN | Context |
| Playbook Library | IN | Available playbooks |
| Tasks | OUT | Carry-forward items |

## UI/UX Requirements

### Completion Summary
- Outcome visualization
- Goals checklist
- Health impact
- Recommendation card

### Journey Timeline
- Playbook history
- Outcomes over time
- Pattern insights
- Coverage gaps

## Acceptance Criteria

- [ ] Completion detected accurately
- [ ] Outcome assessed correctly
- [ ] Recommendations relevant
- [ ] Transition planning considered
- [ ] CSM notified promptly
- [ ] No-action monitored

## Dependencies
- PRD-118: Health Score Change → Playbook Selection
- PRD-232: Automated Playbook Selection
- PRD-168: Playbook Effectiveness Report

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Recommendation acceptance | > 60% | Selected vs recommended |
| Transition time | < 1 week | Completion to next start |
| Journey continuity | > 80% | Customers with next playbook |

## Implementation Notes
- Build playbook transition rules
- Implement outcome scoring
- Create journey visualization
- Support custom transition periods
