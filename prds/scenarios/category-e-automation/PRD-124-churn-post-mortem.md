# PRD-124: Churn Detected → Post-Mortem

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-124 |
| **Title** | Churn Detected → Post-Mortem |
| **Category** | E: Workflow Automation |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When a customer churns, valuable learnings are often lost. Manual post-mortem processes are inconsistent, delayed, and lack data-driven insights, preventing the organization from improving retention strategies.

## User Story
**As a** CS Leader
**I want** automatic post-mortem initiation when a customer churns
**So that** we can systematically capture learnings, identify patterns, and improve retention efforts

## Functional Requirements

### FR-1: Churn Detection
- Detect churn via:
  - Customer stage changed to "churned"
  - Contract non-renewal confirmed
  - Explicit cancellation request
  - Account deactivation
- Trigger post-mortem workflow

### FR-2: Data Compilation
- Automatically gather customer history:
  - Full interaction timeline
  - Health score trajectory
  - Risk signals history
  - Support ticket summary
  - Meeting notes and sentiment
  - Usage trends before churn
  - Save play attempts (if any)
- Compile into analysis dataset

### FR-3: Post-Mortem Document Generation
- Create structured post-mortem document:
  - Executive summary
  - Customer profile snapshot
  - Churn timeline
  - Root cause analysis prompts
  - Contributing factors (AI-suggested)
  - What we could have done differently
  - Lessons learned
  - Recommendations for prevention
- Store in customer folder

### FR-4: Root Cause Classification
- Prompt for root cause classification:
  - Price/Value
  - Product/Feature gaps
  - Poor onboarding
  - Champion departure
  - Strategic/M&A
  - Competitive displacement
  - Support issues
  - Relationship breakdown
  - Budget cuts
  - Other (custom)
- Support multiple contributing factors

### FR-5: Analysis Distribution
- Share post-mortem with stakeholders:
  - CSM and CS Manager
  - Product team (if product-related)
  - Sales (for competitive intelligence)
  - Leadership (for high-ARR churns)
- Schedule post-mortem review meeting

### FR-6: Pattern Analysis
- Aggregate churn data for insights:
  - Common root causes
  - Segment-specific trends
  - Early warning indicators
  - Seasonal patterns
  - CSM performance correlation
- Update predictive models

### FR-7: Win-Back Opportunity Assessment
- Evaluate win-back potential:
  - Exit circumstances
  - Relationship status
  - Competitive situation
  - Future opportunity triggers
- Create win-back reminder if appropriate

## Non-Functional Requirements

### NFR-1: Timeliness
- Post-mortem initiated within 24 hours
- Document draft ready < 2 hours
- Analysis complete within 7 days

### NFR-2: Completeness
- 100% churn post-mortem completion
- All data sources consulted
- Standardized format

### NFR-3: Actionability
- Learnings feed into process improvements
- Recommendations specific and implementable
- Patterns inform strategy

## Technical Specifications

### Data Model
```typescript
interface ChurnPostMortem {
  id: string;
  customerId: string;
  churnDate: Date;
  arrLost: number;
  status: 'initiated' | 'data_gathered' | 'analysis_pending' |
          'review_scheduled' | 'completed' | 'closed';
  dataCompilation: {
    healthScoreHistory: HealthScorePoint[];
    riskSignals: RiskSignal[];
    supportSummary: SupportSummary;
    meetingSentiments: SentimentSummary[];
    usageTrend: UsageTrend;
    savePlays: SavePlaySummary[];
    interactionTimeline: TimelineEvent[];
  };
  rootCauses: {
    primary: ChurnReason;
    contributing: ChurnReason[];
    customNotes: string;
  };
  analysis: {
    documentId: string;
    earlyWarningSignals: string[];
    missedOpportunities: string[];
    lessonsLearned: string[];
    recommendations: string[];
  };
  winBackAssessment: {
    potential: 'high' | 'medium' | 'low' | 'none';
    triggers: string[];
    reminderDate: Date | null;
  };
  review: {
    scheduledAt: Date | null;
    attendees: string[];
    outcome: string | null;
  };
  createdAt: Date;
  completedAt: Date | null;
}

type ChurnReason =
  | 'price_value'
  | 'product_gaps'
  | 'poor_onboarding'
  | 'champion_left'
  | 'strategic_ma'
  | 'competitive'
  | 'support_issues'
  | 'relationship'
  | 'budget_cuts'
  | 'other';
```

### API Endpoints
- `POST /api/churn/post-mortem` - Initiate post-mortem
- `GET /api/churn/post-mortem/:id` - Get post-mortem details
- `PUT /api/churn/post-mortem/:id/root-cause` - Set root cause
- `POST /api/churn/post-mortem/:id/complete` - Complete analysis
- `GET /api/churn/analysis/patterns` - Get churn patterns

### Agent Involvement
| Agent | Role |
|-------|------|
| Orchestrator | Coordinate post-mortem workflow |
| Researcher | Compile customer history |
| Monitor | Analyze patterns |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Customer Data | IN | Full history |
| Risk Signals | IN | Historical signals |
| Support Tickets | IN | Ticket history |
| Meeting Notes | IN | Sentiment data |
| Google Docs | OUT | Post-mortem document |
| Analytics | IN/OUT | Pattern analysis |

## UI/UX Requirements

### Post-Mortem Wizard
- Step-by-step analysis flow
- Pre-populated data summaries
- Root cause selection UI
- Free-form notes areas

### Churn Dashboard
- Recent churns list
- Completion status tracking
- Pattern visualization
- Root cause distribution

### Timeline Visualization
- Interactive customer timeline
- Key events highlighted
- Sentiment indicators
- Health score overlay

## Acceptance Criteria

### AC-1: Churn Detection
- [ ] All churn events trigger workflow
- [ ] Initiated within 24 hours
- [ ] ARR correctly captured

### AC-2: Data Compilation
- [ ] Health score history complete
- [ ] Risk signals included
- [ ] Support summary accurate
- [ ] Timeline comprehensive

### AC-3: Document Generation
- [ ] Document created from template
- [ ] All sections populated
- [ ] Stored in correct folder

### AC-4: Root Cause
- [ ] Classification UI intuitive
- [ ] Multiple factors supported
- [ ] Custom notes captured

### AC-5: Pattern Analysis
- [ ] Data feeds to analytics
- [ ] Trends visible in dashboard
- [ ] Insights actionable

### AC-6: Win-Back
- [ ] Assessment prompt displayed
- [ ] Reminders scheduled when appropriate
- [ ] Potential customers flagged

## Dependencies
- PRD-152: Churn Analysis Report
- PRD-216: Predictive Churn Scoring
- PRD-062: Customer Journey Timeline
- PRD-030: Win-Back Campaign Generator

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Incomplete data | Medium | Medium | Flag gaps, prompt for manual input |
| Blame culture | Medium | High | Focus on process, not individuals |
| Analysis fatigue | High | Medium | Streamline workflow, prioritize high-ARR |

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Completion rate | > 90% | Post-mortems completed |
| Time to complete | < 7 days | Churn to completion |
| Pattern identification | Track | Actionable insights generated |
| Retention improvement | -20% churn | Year-over-year comparison |

## Implementation Notes
- Use `save_plays` table for save attempt history
- Leverage `health_score_history` for trajectory
- Consider anonymous aggregation for sensitive analysis
- Build root cause taxonomy as configurable
