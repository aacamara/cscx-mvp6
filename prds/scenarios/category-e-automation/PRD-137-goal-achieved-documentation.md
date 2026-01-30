# PRD-137: Goal Achieved → Success Documentation

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-137 |
| **Title** | Goal Achieved → Success Documentation |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When customers achieve defined success goals, the wins often go undocumented, uncelebrated, and unused for renewal/expansion conversations or marketing. This misses opportunities to reinforce value and capture success stories.

## User Story
**As a** CSM
**I want** automatic success documentation when customer goals are achieved
**So that** wins are captured, celebrated, and leveraged for renewals and marketing

## Functional Requirements

### FR-1: Goal Achievement Detection
- Detect goal completion:
  - Success plan milestone complete
  - KPI threshold reached
  - Onboarding goal achieved
  - ROI milestone hit
  - Manual confirmation
- Verify achievement with data

### FR-2: Success Documentation
- Generate success record:
  - Goal description
  - Achievement details
  - Metrics and evidence
  - Timeline to achievement
  - Contributing factors
  - Customer quotes (if available)

### FR-3: Internal Celebration
- Notify and celebrate:
  - Slack announcement to team
  - CSM recognition
  - Add to wins dashboard
  - Update customer record

### FR-4: Customer Communication
- Generate customer communication:
  - Congratulations message
  - Achievement summary
  - ROI/value documentation
  - Suggestions for next goals
- Queue for CSM approval

### FR-5: Marketing Potential
- Assess marketing potential:
  - Case study candidate
  - Testimonial opportunity
  - Reference potential
  - Social proof opportunity
- Flag for marketing team

### FR-6: Value Repository
- Store in value repository:
  - Searchable by industry/use case
  - Available for QBRs/renewals
  - Accessible for sales
  - Aggregate for reporting

## Non-Functional Requirements

### NFR-1: Accuracy
- Achievement verified with data
- Metrics accurate

### NFR-2: Timeliness
- Documentation within 24 hours
- Celebration immediate

## Technical Specifications

### Data Model
```typescript
interface GoalAchievement {
  id: string;
  customerId: string;
  goal: {
    id: string;
    name: string;
    type: 'success_plan' | 'kpi' | 'onboarding' | 'roi' | 'custom';
    originalTarget: any;
    achievedResult: any;
  };
  achievement: {
    achievedAt: Date;
    timeToAchieve: number;
    evidence: Evidence[];
    contributingFactors: string[];
    customerQuotes: string[];
  };
  documentation: {
    summaryDocId: string;
    celebrationSent: boolean;
    customerNotified: boolean;
    marketingFlagged: boolean;
  };
  marketingPotential: {
    caseStudyCandidate: boolean;
    testimonialCandidate: boolean;
    referenceCandidate: boolean;
    score: number;
  };
  createdAt: Date;
}
```

### API Endpoints
- `POST /api/goals/:id/achieve` - Record achievement
- `GET /api/goals/achievements` - List achievements
- `GET /api/goals/customer/:customerId` - Customer achievements
- `POST /api/goals/:id/marketing-flag` - Flag for marketing

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Success Plans | IN | Goal data |
| Usage Data | IN | Achievement evidence |
| Slack | OUT | Team celebration |
| Gmail | OUT | Customer communication |
| Google Docs | OUT | Documentation |

## Acceptance Criteria

- [ ] Achievements detected automatically
- [ ] Documentation generated
- [ ] Team notified/celebration sent
- [ ] Customer communication prepared
- [ ] Marketing potential assessed

## Dependencies
- PRD-165: Success Metrics Report
- PRD-240: Automated Success Story Drafting
- PRD-040: Milestone Celebration Email

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Achievement capture | > 90% | Goals documented |
| Customer communication | > 70% | Celebrations sent |
| Marketing utilization | > 20% | Wins used for marketing |

## Implementation Notes
- Build goal tracking infrastructure
- Integrate with success planning
- Create celebration templates
- Connect with advocacy programs
