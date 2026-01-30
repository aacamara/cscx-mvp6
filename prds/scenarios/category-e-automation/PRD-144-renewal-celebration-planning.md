# PRD-144: Renewal Won → Celebration + Planning

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-144 |
| **Title** | Renewal Won → Celebration + Planning |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When renewals are won, the celebration is often muted or absent, and the transition to the new contract period lacks planning. This misses opportunities to strengthen relationships, recognize success, and set the stage for expansion.

## User Story
**As a** CSM
**I want** automatic celebration and planning when renewals are won
**So that** customers feel valued and we enter the new period with momentum

## Functional Requirements

### FR-1: Renewal Win Detection
- Detect renewal wins:
  - Salesforce opportunity closed-won
  - Contract signed notification
  - Renewal pipeline stage update
  - Manual confirmation
- Capture renewal details

### FR-2: Customer Celebration
- Generate celebration outreach:
  - Thank you for continued partnership
  - Value delivered summary
  - Relationship appreciation
  - Looking forward message
- Personalize by relationship tenure

### FR-3: Internal Celebration
- Notify and celebrate internally:
  - Team Slack announcement
  - CSM recognition
  - Leadership notification (large renewals)
  - Win dashboard update

### FR-4: Stakeholder Recognition
- Recognize key stakeholders:
  - Champion thank you
  - Executive sponsor acknowledgment
  - Decision maker appreciation
- Consider gifts/gestures for strategic accounts

### FR-5: Next Period Planning
- Initiate planning activities:
  - Success plan renewal meeting
  - Goal setting session invitation
  - Expansion opportunity assessment
  - Relationship deepening plan

### FR-6: Upsell Timing
- Assess expansion timing:
  - Warm up period (allow celebration)
  - Expansion conversation scheduling
  - Cross-sell opportunity flagging
- Coordinate with sales

## Non-Functional Requirements

### NFR-1: Timeliness
- Celebration within 24 hours
- Planning within 2 weeks

### NFR-2: Appropriateness
- Celebration matches relationship
- Not overly sales-focused

## Technical Specifications

### Data Model
```typescript
interface RenewalCelebration {
  id: string;
  customerId: string;
  renewalId: string;
  renewal: {
    arr: number;
    change: number;
    term: string;
    closedAt: Date;
    yearNumber: number;
  };
  celebration: {
    customerOutreach: {
      sent: boolean;
      draftId: string | null;
      sentAt: Date | null;
    };
    internalAnnouncement: {
      sent: boolean;
      channel: string;
      sentAt: Date | null;
    };
    stakeholderRecognition: RecognitionAction[];
  };
  planning: {
    successPlanMeeting: Date | null;
    expansionAssessment: boolean;
    nextSteps: string[];
  };
  createdAt: Date;
}
```

### API Endpoints
- `POST /api/renewals/:id/celebrate` - Trigger celebration
- `GET /api/renewals/:id/celebration` - Celebration status
- `POST /api/renewals/:id/plan-next` - Initiate planning

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Salesforce | IN | Renewal data |
| Gmail | OUT | Customer outreach |
| Slack | OUT | Team announcement |
| Calendar | OUT | Planning meetings |

## Acceptance Criteria

- [ ] Renewal wins detected
- [ ] Customer celebration sent
- [ ] Internal celebration posted
- [ ] Stakeholder recognition appropriate
- [ ] Next period planning initiated

## Dependencies
- PRD-138: Contract Renewal Complete → Planning
- PRD-040: Milestone Celebration Email
- PRD-035: Thank You Note Generator

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Celebration rate | > 90% | Renewals celebrated |
| Customer response | > 40% | Reply to celebration |
| Planning completion | > 80% | Success plan meeting scheduled |

## Implementation Notes
- Build celebration templates by tenure
- Coordinate with marketing for large renewals
- Consider customer gift program integration
- Track multi-year renewal milestones
