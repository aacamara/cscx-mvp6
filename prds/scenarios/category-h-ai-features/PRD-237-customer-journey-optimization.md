# PRD-237: Customer Journey Optimization

## Metadata
- **PRD ID**: PRD-237
- **Category**: H - AI-Powered Features
- **Priority**: P2
- **Estimated Complexity**: High
- **Dependencies**: PRD-062 (Customer Journey Timeline), PRD-232 (Playbook Selection)

## Scenario Description
The AI should analyze customer journeys to identify optimization opportunities, predict friction points, and recommend interventions to improve time-to-value and overall customer experience.

## User Story
**As a** CS leader,
**I want** AI to analyze and optimize customer journeys,
**So that** we can improve time-to-value and reduce churn.

## Trigger
- User asks: "How can we improve the journey for [segment]?"
- System detects journey friction patterns
- Quarterly journey analysis report

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Journey events | `engagement_events` table | Implemented | Event tracking |
| Milestones | `customers` table | Implemented | Key dates tracked |
| Playbooks | `csm_playbooks` table | Implemented | Journey playbooks |
| Health score | `health_score_history` | Implemented | Health tracking |

### What's Missing
- [ ] Journey stage classification
- [ ] Friction point detection algorithm
- [ ] Cohort journey comparison
- [ ] Optimal path identification
- [ ] Intervention recommendation engine
- [ ] Journey visualization improvements

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/ai/journeyOptimization.ts` | Create | Journey analysis service |
| `server/src/services/ai/frictionDetector.ts` | Create | Friction point detection |
| `components/JourneyAnalytics.tsx` | Create | Journey analytics UI |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/analytics/journey/optimization` | GET | Get optimization insights |
| `GET /api/analytics/journey/friction` | GET | Get friction point analysis |
| `POST /api/analytics/journey/simulate` | POST | Simulate journey changes |

### Database Changes
```sql
CREATE TABLE journey_stages (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  stage VARCHAR(50),
  entered_at TIMESTAMPTZ,
  exited_at TIMESTAMPTZ,
  duration_days INTEGER,
  success_score INTEGER
);

CREATE TABLE journey_friction_points (
  id UUID PRIMARY KEY,
  stage VARCHAR(50),
  friction_type VARCHAR(50),
  occurrence_count INTEGER,
  avg_delay_days DECIMAL,
  recommendations JSONB,
  analyzed_at TIMESTAMPTZ
);
```

## Chat UI Flow
```
Leader: How can we improve the onboarding journey?
System: Analyzing onboarding journey patterns across 234 customers...

**Journey Optimization Analysis: Onboarding**

**Current Performance:**
- Average Time-to-Value: 32 days
- Target: 21 days
- Gap: +11 days (52% longer than target)

**Friction Points Identified:**

1. **Technical Setup** (Days 3-8)
   - 45% of customers stall here
   - Avg delay: +5 days
   - Root Cause: Complex API integration
   - Recommendation: Add integration wizard + office hours

2. **First Value Milestone** (Days 14-21)
   - 30% don't reach first milestone
   - Avg delay: +4 days
   - Root Cause: Unclear success criteria
   - Recommendation: Define clear quick-win goals in kickoff

3. **Champion Engagement** (Days 7-14)
   - 25% have unengaged champions
   - Impact: 2x more likely to churn
   - Recommendation: Champion enablement program

**Optimal Journey Path:**
Kickoff → Quick Win (Day 5) → Integration (Day 10) → Full Adoption (Day 21)

**Projected Impact of Optimizations:**
- Time-to-Value: 32 → 24 days (-25%)
- First-year retention: +8%
- NPS improvement: +12 points

[Generate Improvement Plan] [View Journey Comparison] [Export Analysis]
```

## Acceptance Criteria
- [ ] Identify friction points in customer journey
- [ ] Compare journey patterns across cohorts
- [ ] Calculate impact of friction on outcomes
- [ ] Recommend specific interventions
- [ ] Simulate impact of proposed changes
- [ ] Track improvement over time
- [ ] Generate actionable improvement plans

## Ralph Loop Notes
- **Learning**: Track which interventions reduce friction
- **Optimization**: Identify optimal journey paths from successful customers
- **Personalization**: Customize recommendations by segment

### Completion Signal
```
<promise>PRD-237-COMPLETE</promise>
```
