# PRD-134: Competitive Deal Outcome → Analysis

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-134 |
| **Title** | Competitive Deal Outcome → Analysis |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When customers churn to competitors or we win against competitors, the intelligence gathered isn't systematically captured and analyzed. This prevents the organization from learning and improving competitive positioning.

## User Story
**As a** CS Leader
**I want** automatic analysis when competitive deal outcomes occur
**So that** we can continuously improve our competitive strategy based on real outcomes

## Functional Requirements

### FR-1: Outcome Detection
- Detect competitive outcomes:
  - Churn to named competitor
  - Win against named competitor
  - Competitive evaluation in progress
  - Expansion win vs competitive alternative
- Capture competitor identification

### FR-2: Data Collection
- Gather outcome context:
  - Decision factors mentioned
  - Feature comparisons
  - Pricing discussions
  - Relationship dynamics
  - Timeline and process
  - Stakeholder feedback

### FR-3: Analysis Generation
- Generate competitive analysis:
  - Win/loss factors
  - Competitor strengths shown
  - Our gaps exposed
  - Effective counter-strategies
  - Pricing insights
  - Recommendations

### FR-4: Pattern Identification
- Analyze patterns across outcomes:
  - Common win factors
  - Frequent loss reasons
  - Competitor-specific trends
  - Segment vulnerabilities
  - Effective strategies

### FR-5: Knowledge Distribution
- Share insights:
  - Update battle cards
  - Notify sales team
  - Inform product team
  - Executive briefing (significant outcomes)
- Store in competitive intelligence base

### FR-6: Action Recommendations
- Generate recommendations:
  - Product improvements
  - Pricing adjustments
  - Sales enablement needs
  - Marketing messaging
  - Defensive strategies

## Non-Functional Requirements

### NFR-1: Timeliness
- Analysis within 48 hours of outcome
- Pattern updates monthly

### NFR-2: Accuracy
- Factor identification accurate
- Insights actionable

### NFR-3: Privacy
- Handle sensitive data appropriately
- Anonymize for broad sharing

## Technical Specifications

### Data Model
```typescript
interface CompetitiveOutcome {
  id: string;
  customerId: string;
  outcomeType: 'loss_to_competitor' | 'win_vs_competitor' | 'expansion_win';
  competitor: string;
  decisionFactors: DecisionFactor[];
  context: {
    evaluationLength: number;
    stakeholdersInvolved: string[];
    pricingDiscussed: boolean;
    featuresCompared: string[];
  };
  analysis: {
    primaryReasons: string[];
    competitorStrengths: string[];
    ourGaps: string[];
    effectiveStrategies: string[];
    recommendations: string[];
  };
  distribution: {
    battleCardUpdated: boolean;
    salesNotified: boolean;
    productNotified: boolean;
    executiveBriefed: boolean;
  };
  outcomeDate: Date;
  analyzedAt: Date;
}
```

### API Endpoints
- `POST /api/competitive/outcome` - Record outcome
- `GET /api/competitive/outcome/:id/analysis` - Get analysis
- `GET /api/competitive/patterns` - Pattern analysis
- `GET /api/competitive/battle-card/:competitor` - Battle card

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Churn Data | IN | Loss context |
| Win Data | IN | Win context |
| Slack | OUT | Team notifications |
| Knowledge Base | OUT | Battle cards |

## Acceptance Criteria

- [ ] Outcomes detected and recorded
- [ ] Analysis generated within 48 hours
- [ ] Patterns identified monthly
- [ ] Insights distributed to teams
- [ ] Battle cards updated

## Dependencies
- PRD-068: Competitive Intelligence per Account
- PRD-011: Competitor Mention Analysis → Battle Card
- PRD-094: Competitor Mentioned → Battle Card

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Outcome capture | > 90% | Competitive outcomes recorded |
| Win rate improvement | +10% | Against tracked competitors |
| Battle card usage | > 50% | Sales using updated cards |

## Implementation Notes
- Build competitor taxonomy
- Integrate with exit interview process
- Consider anonymized sharing
- Update battle cards automatically
