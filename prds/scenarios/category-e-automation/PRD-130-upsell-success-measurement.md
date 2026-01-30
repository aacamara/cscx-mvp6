# PRD-130: Upsell Closed → Success Measurement

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-130 |
| **Title** | Upsell Closed → Success Measurement |
| **Category** | E: Workflow Automation |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
After an upsell closes, there's often no systematic measurement of whether the customer is successfully adopting and deriving value from the expanded solution. This leads to increased churn risk on expanded revenue and missed opportunities to optimize future upsell approaches.

## User Story
**As a** CSM
**I want** automatic success measurement setup when an upsell closes
**So that** I can ensure customers realize value from their expansion and reduce churn risk on new ARR

## Functional Requirements

### FR-1: Upsell Detection
- Detect closed upsells via:
  - Salesforce opportunity closed-won
  - Expansion opportunity updated
  - Contract amendment signed
  - Manual entry
- Capture upsell details: products, value, success criteria

### FR-2: Success Criteria Definition
- Establish success metrics based on:
  - Product/feature purchased
  - Stated customer goals
  - Industry benchmarks
  - Historical success patterns
- Allow CSM customization

### FR-3: Measurement Plan Creation
- Generate measurement plan:
  - Key metrics to track
  - Measurement frequency
  - Success thresholds
  - Review checkpoints (30/60/90 days)
  - Comparison baseline
- Store in customer record

### FR-4: Tracking Setup
- Configure tracking:
  - Usage dashboards for new features
  - Adoption milestones
  - ROI calculations
  - Customer feedback collection
- Automate data collection

### FR-5: Progress Monitoring
- Monitor adoption progress:
  - Feature usage vs expectations
  - Milestone completion
  - User activation rates
  - Value realization indicators
- Alert on lagging adoption

### FR-6: Success Review
- Trigger success reviews:
  - 30-day initial check
  - 60-day adoption review
  - 90-day value assessment
- Generate review summary

### FR-7: Outcome Documentation
- Document outcomes:
  - Success achieved (with evidence)
  - Partial success (with gaps)
  - At-risk (with intervention plan)
- Update customer health factors

### FR-8: Feedback Loop
- Capture learnings:
  - Upsell-to-value correlation
  - Successful onboarding patterns
  - Risk indicators
- Improve future predictions

## Non-Functional Requirements

### NFR-1: Timeliness
- Measurement plan within 48 hours
- Tracking active by first review

### NFR-2: Accuracy
- Metrics align with actual value
- Thresholds realistic

### NFR-3: Actionability
- Progress visible to CSM
- Early warnings enabled

## Technical Specifications

### Data Model
```typescript
interface UpsellSuccessMeasurement {
  id: string;
  customerId: string;
  upsellId: string;
  opportunityId: string;
  upsellDetails: {
    products: string[];
    arrIncrease: number;
    closeDate: Date;
    salesRep: string;
  };
  successCriteria: {
    metrics: SuccessMetric[];
    goals: string[];
    benchmarks: Record<string, number>;
  };
  measurementPlan: {
    trackingStart: Date;
    checkpoints: Checkpoint[];
    dashboardUrl: string;
  };
  progress: {
    currentStatus: 'on_track' | 'at_risk' | 'behind' | 'exceeding';
    metricsProgress: MetricProgress[];
    lastUpdated: Date;
  };
  reviews: SuccessReview[];
  outcome: {
    status: 'success' | 'partial' | 'at_risk' | 'failed' | 'pending';
    evidence: string[];
    lessonsLearned: string[];
    documentedAt: Date | null;
  };
  createdAt: Date;
}

interface SuccessMetric {
  name: string;
  type: 'usage' | 'adoption' | 'roi' | 'satisfaction';
  target: number;
  unit: string;
  measurement: 'automatic' | 'manual';
}

interface Checkpoint {
  day: number;
  type: 'check' | 'review' | 'assessment';
  status: 'pending' | 'completed' | 'skipped';
  scheduledDate: Date;
  completedDate: Date | null;
}
```

### API Endpoints
- `POST /api/upsell/:id/success-measurement` - Create measurement plan
- `GET /api/upsell/:id/progress` - Get progress
- `PUT /api/upsell/:id/metrics` - Update metrics
- `POST /api/upsell/:id/review` - Record review
- `GET /api/upsell/outcomes` - Outcome analysis

### Agent Involvement
| Agent | Role |
|-------|------|
| Monitor | Track usage and adoption |
| Orchestrator | Coordinate reviews |
| Researcher | Analyze progress |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Salesforce | IN | Opportunity data |
| Usage Data | IN | Feature adoption |
| Health Score | IN/OUT | Health factors |
| Google Docs | OUT | Review documents |
| Calendar | OUT | Review scheduling |

## Acceptance Criteria

- [ ] Upsells detected and tracked
- [ ] Success criteria established
- [ ] Measurement plan generated
- [ ] Progress monitoring active
- [ ] Review checkpoints triggered
- [ ] Outcomes documented

## Dependencies
- PRD-060: Expansion Opportunity Finder
- PRD-238: Expansion Propensity Modeling
- PRD-064: Product Adoption Dashboard
- PRD-165: Success Metrics Report

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Measurement coverage | 100% | Upsells with plans |
| Adoption success | > 70% | On-track at 90 days |
| Churn on expansion | < 10% | Year-1 churn rate |
| Value realization | > 80% | Goals achieved |

## Implementation Notes
- Leverage `expansion_opportunities` table
- Build configurable success templates
- Integrate with product analytics
- Consider customer success scorecard
