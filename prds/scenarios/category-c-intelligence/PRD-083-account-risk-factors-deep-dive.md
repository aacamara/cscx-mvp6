# PRD-083: Account Risk Factors Deep Dive

## Metadata
- **PRD ID**: PRD-083
- **Category**: C - Account Intelligence
- **Priority**: P1
- **Estimated Complexity**: High
- **Dependencies**: PRD-061 (At-Risk Portfolio View), PRD-113 (Risk Score Calculation)

## Scenario Description
When an account shows risk signals, CSMs need comprehensive analysis of all contributing factors. The system should provide a detailed breakdown of risk factors, their relative weights, historical trends, and recommended mitigation actions.

## User Story
**As a** CSM investigating a high-risk account,
**I want to** understand all the factors contributing to the risk,
**So that** I can develop a targeted mitigation strategy.

## Trigger
- CSM types: "Why is [customer] at risk?"
- CSM clicks "Deep Dive" on risk indicator
- CSM asks: "Analyze risk factors for [customer]"

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Risk signals | `risk_signals` table | Implemented | Individual risk events |
| Health score | `health_score_history` table | Implemented | Overall health tracking |
| Usage metrics | `usage_metrics` table | Implemented | Product usage data |
| Support tickets | Integration available | Partial | Via Zendesk integration |

### What's Missing
- [ ] Risk factor weighting and scoring
- [ ] Historical risk trend analysis
- [ ] Root cause categorization
- [ ] Mitigation action recommendations
- [ ] Risk factor correlation analysis
- [ ] Comparative risk benchmarking

## Detailed Workflow

### Step 1: Risk Signal Collection
- Gather all active risk signals for customer
- Pull historical risk signals (last 12 months)
- Aggregate related metrics (usage, engagement, support)

### Step 2: Factor Analysis
- Categorize risks by type (usage, engagement, financial, relationship)
- Calculate weight/impact of each factor
- Identify correlations between factors

### Step 3: Trend Analysis
- Compare current state to historical baselines
- Identify acceleration or deceleration of risk
- Flag emerging vs. chronic issues

### Step 4: Recommendation Generation
- Map risk factors to mitigation playbooks
- Prioritize actions by impact potential
- Estimate effort and timeline for mitigation

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/intelligence/riskAnalysis.ts` | Create | Risk deep dive analysis |
| `server/src/agents/specialists/monitor.ts` | Modify | Add risk analysis capabilities |
| `components/CustomerDetail/RiskDeepDive.tsx` | Create | Risk analysis UI |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/customers/:id/risk/deep-dive` | GET | Get comprehensive risk analysis |
| `GET /api/customers/:id/risk/trends` | GET | Get risk trend data |
| `POST /api/customers/:id/risk/mitigation` | POST | Generate mitigation plan |

### Database Changes
```sql
CREATE TABLE risk_factor_weights (
  id UUID PRIMARY KEY,
  factor_type VARCHAR(50),
  weight DECIMAL(3,2),
  description TEXT,
  updated_at TIMESTAMPTZ
);
```

## Chat UI Flow
```
CSM: Why is TechStart Inc at risk?
System: Analyzing risk factors for TechStart Inc...

**Risk Score: 35/100** (Critical)

**Contributing Factors:**

1. **Usage Decline** (Impact: 40%)
   - DAU dropped 45% in last 30 days
   - Key feature adoption: 23% → 12%
   - Trend: Accelerating decline ⬇️

2. **Champion Departure** (Impact: 30%)
   - Sarah Miller (VP Product) left company 3 weeks ago
   - No replacement champion identified
   - Exec sponsor engagement: None in 60 days

3. **Support Escalations** (Impact: 20%)
   - 3 P1 tickets in last month
   - CSAT dropped to 2.5/5
   - Unresolved: API performance issues

4. **Engagement Gap** (Impact: 10%)
   - No QBR in 2 quarters
   - Email response rate: 15%
   - Last meeting: 45 days ago

**Recommended Actions:**
1. 🔴 Identify and engage new champion (Urgent)
2. 🔴 Escalate API issues to engineering (Urgent)
3. 🟡 Schedule executive check-in (This week)
4. 🟡 Propose adoption workshop (Next week)

[Generate Save Play] [Schedule Actions] [View Historical Trends]
```

## Acceptance Criteria
- [ ] Display all contributing risk factors with weights
- [ ] Show historical trends for each factor
- [ ] Categorize risks by type (usage, relationship, financial, support)
- [ ] Provide prioritized mitigation recommendations
- [ ] Link to relevant playbooks and actions
- [ ] Compare to portfolio/segment benchmarks
- [ ] Support drill-down into each factor

## Ralph Loop Notes
- **Learning**: Track which mitigation actions successfully reduce risk
- **Optimization**: Adjust factor weights based on churn correlation
- **Personalization**: Learn account-specific risk patterns

### Completion Signal
```
<promise>PRD-083-COMPLETE</promise>
```
