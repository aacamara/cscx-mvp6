# PRD-085: Account Readiness Assessment

## Metadata
- **PRD ID**: PRD-085
- **Category**: C - Account Intelligence
- **Priority**: P2
- **Estimated Complexity**: Medium
- **Dependencies**: PRD-059 (Renewal Pipeline), PRD-060 (Expansion Opportunity)

## Scenario Description
Before major milestones (renewal, expansion, QBR), CSMs need to assess account readiness across multiple dimensions. The system should evaluate relationship health, product adoption, stakeholder engagement, and open issues to provide a readiness score and gap analysis.

## User Story
**As a** CSM preparing for a renewal conversation,
**I want to** see an account readiness assessment,
**So that** I can address gaps before the critical meeting.

## Trigger
- CSM types: "Is [customer] ready for renewal?"
- CSM asks: "Assess readiness for [customer] [milestone]"
- Automated assessment 30 days before renewal date

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Health score | `health_score_history` table | Implemented | Overall health tracking |
| Renewal pipeline | `renewal_pipeline` table | Implemented | Renewal status |
| Stakeholders | `stakeholders` table | Implemented | Contact relationships |
| Support tickets | Integration | Partial | Via Zendesk |

### What's Missing
- [ ] Readiness scoring algorithm
- [ ] Milestone-specific assessment criteria
- [ ] Gap identification and prioritization
- [ ] Readiness checklist generation
- [ ] Historical readiness correlation with outcomes
- [ ] Action plan generation for gaps

## Detailed Workflow

### Step 1: Data Collection
- Gather health score and trend
- Pull stakeholder engagement data
- Check open support tickets
- Review recent meeting outcomes

### Step 2: Dimension Scoring
- Score each readiness dimension (0-100)
- Weight by importance for milestone type
- Calculate overall readiness score

### Step 3: Gap Analysis
- Identify dimensions below threshold
- Prioritize gaps by impact and effort
- Flag critical blockers

### Step 4: Action Plan
- Generate checklist to address gaps
- Suggest timeline based on milestone date
- Recommend resources and playbooks

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/intelligence/readinessAssessment.ts` | Create | Readiness scoring service |
| `components/CustomerDetail/ReadinessAssessment.tsx` | Create | Readiness UI component |
| `server/src/templates/readinessChecklist.ts` | Create | Checklist templates |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/customers/:id/readiness` | GET | Get readiness assessment |
| `GET /api/customers/:id/readiness/:milestone` | GET | Milestone-specific assessment |
| `POST /api/customers/:id/readiness/checklist` | POST | Generate action checklist |

### Database Changes
```sql
CREATE TABLE readiness_assessments (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  milestone_type VARCHAR(50),
  milestone_date DATE,
  overall_score INTEGER,
  dimension_scores JSONB,
  gaps JSONB,
  assessed_at TIMESTAMPTZ
);
```

## Chat UI Flow
```
CSM: Is Acme Corp ready for their renewal next month?
System: Assessing renewal readiness for Acme Corp...

**Renewal Readiness Score: 72/100** (Needs Attention)

**Dimension Scores:**

| Dimension | Score | Status |
|-----------|-------|--------|
| Product Adoption | 85 | ✅ Strong |
| Stakeholder Engagement | 60 | ⚠️ Gap |
| Value Realization | 78 | ✅ Good |
| Support Health | 45 | 🔴 Critical |
| Executive Alignment | 70 | ⚠️ Gap |

**Critical Gaps to Address:**

1. **Support Health** (45/100)
   - 2 unresolved P1 tickets
   - CSAT trending down
   - Action: Escalate tickets, schedule support review

2. **Stakeholder Engagement** (60/100)
   - CFO not engaged in 90 days
   - Missing technical champion
   - Action: Schedule executive briefing

**Recommended Checklist:**
- [ ] Resolve open P1 tickets (by Jan 15)
- [ ] Schedule CFO meeting (by Jan 10)
- [ ] Identify technical champion (by Jan 12)
- [ ] Prepare value summary (by Jan 18)
- [ ] Send renewal proposal (by Jan 20)

[Generate Full Report] [Create Tasks] [View Historical Assessments]
```

## Acceptance Criteria
- [ ] Score readiness across multiple dimensions
- [ ] Support different milestone types (renewal, expansion, QBR)
- [ ] Identify and prioritize gaps
- [ ] Generate actionable checklist with deadlines
- [ ] Show historical readiness vs. outcome correlation
- [ ] Automated assessment before milestones
- [ ] Export readiness report as PDF

## Ralph Loop Notes
- **Learning**: Track readiness scores vs. actual milestone outcomes
- **Optimization**: Adjust dimension weights based on correlation data
- **Personalization**: Learn which gaps matter most for each segment

### Completion Signal
```
<promise>PRD-085-COMPLETE</promise>
```
