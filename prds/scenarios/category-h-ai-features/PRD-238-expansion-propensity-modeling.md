# PRD-238: Expansion Propensity Modeling

## Metadata
- **PRD ID**: PRD-238
- **Category**: H - AI-Powered Features
- **Priority**: P1
- **Estimated Complexity**: High
- **Dependencies**: PRD-060 (Expansion Opportunity), PRD-103 (Expansion Signal)

## Scenario Description
The AI should predict which customers are most likely to expand based on usage patterns, engagement signals, and success metrics. This enables CSMs to prioritize expansion conversations with customers who are ready to buy.

## User Story
**As a** CSM focused on expansion,
**I want** AI to predict expansion propensity,
**So that** I can focus on customers most likely to expand.

## Trigger
- CSM asks: "Which accounts are ready to expand?"
- Weekly expansion propensity score refresh
- User views expansion opportunity dashboard

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Usage metrics | `usage_metrics` table | Implemented | Product usage data |
| Expansion pipeline | `expansion_opportunities` | Implemented | Opportunity tracking |
| Health scores | `health_score_history` | Implemented | Customer health |
| Contract data | `contracts` table | Implemented | Entitlements |

### What's Missing
- [ ] ML-based propensity scoring model
- [ ] Feature engineering pipeline
- [ ] Model training and refresh process
- [ ] Propensity score visualization
- [ ] Confidence intervals
- [ ] Explanation of scoring factors

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/ai/expansionPropensity.ts` | Create | Propensity scoring service |
| `server/src/jobs/propensityRefresh.ts` | Create | Scheduled model refresh |
| `components/ExpansionPropensity.tsx` | Create | Propensity dashboard |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/analytics/expansion-propensity` | GET | Get propensity scores |
| `GET /api/customers/:id/expansion-propensity` | GET | Customer-specific propensity |
| `POST /api/analytics/expansion-propensity/refresh` | POST | Trigger model refresh |

### Database Changes
```sql
CREATE TABLE expansion_propensity (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  propensity_score INTEGER,
  confidence DECIMAL,
  contributing_factors JSONB,
  recommended_products JSONB,
  estimated_value DECIMAL,
  calculated_at TIMESTAMPTZ
);

CREATE INDEX idx_expansion_propensity_score ON expansion_propensity(propensity_score DESC);
```

## Chat UI Flow
```
CSM: Which accounts are ready to expand?
System: Analyzing expansion propensity across your portfolio...

**Top Expansion Opportunities**

| Rank | Customer | Propensity | Confidence | Est. Value | Primary Signal |
|------|----------|------------|------------|------------|----------------|
| 1 | TechFlow Inc | 94% | High | $85K | Usage at 95% capacity |
| 2 | DataDrive Co | 88% | High | $120K | Asking about enterprise |
| 3 | CloudFirst | 82% | Medium | $45K | New team expansion |
| 4 | Nexus Corp | 78% | High | $65K | Feature requests |
| 5 | Acme Corp | 72% | Medium | $90K | Champion promotion |

**TechFlow Inc - Deep Dive:**

**Propensity Score: 94/100**

Contributing Factors:
- 📈 Usage at 95% of license capacity (+35 points)
- ⭐ Health score of 92 (+20 points)
- 💬 Asked about additional seats 2x (+18 points)
- 📊 Executive engagement high (+12 points)
- 🎯 Similar cohort expanded 80% (+9 points)

**Recommended Approach:**
- Product: Additional 50 seats
- Timing: This quarter (budget cycle)
- Champion: Sarah Chen (promoted to VP)
- Entry Point: Capacity planning conversation

[Create Expansion Opp] [Schedule Meeting] [Generate Proposal]
```

## Acceptance Criteria
- [ ] Score all customers on expansion likelihood (0-100)
- [ ] Provide confidence level for each score
- [ ] List contributing factors with weights
- [ ] Recommend specific products/services
- [ ] Estimate expansion value
- [ ] Weekly automatic refresh
- [ ] Historical accuracy tracking

## Ralph Loop Notes
- **Learning**: Track propensity scores vs. actual expansion outcomes
- **Optimization**: Retrain model based on new expansion data
- **Personalization**: Learn segment-specific expansion patterns

### Completion Signal
```
<promise>PRD-238-COMPLETE</promise>
```
