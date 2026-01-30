# PRD-060: Expansion Opportunity Finder

## Category
**Category C: Account Intelligence**

## Priority
**P0** - Foundation Tier

## Overview
Automatically identify and surface expansion opportunities across the customer portfolio by analyzing usage patterns, feature adoption gaps, stakeholder signals, and contract headroom. This proactive intelligence helps CSMs and account managers capture additional revenue by identifying customers ready for upsell, cross-sell, or seat expansion.

## User Story
As a CSM, I want the system to automatically identify which accounts have expansion potential so that I can proactively pursue growth opportunities rather than waiting for customers to ask for more.

As a CS Leader, I want visibility into the total expansion pipeline potential across my team so that I can set accurate growth targets and coach CSMs on expansion motions.

## Trigger
- Natural language command: "Show me expansion opportunities"
- Variations: "Which accounts can grow?", "Upsell opportunities", "Where can we expand?"
- Dashboard: Expansion Pipeline view
- Automated: Signal-based alerts when new opportunities detected

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| CSM ID | UUID | No | Filter to specific CSM |
| Opportunity Type | String | No | "upsell", "cross-sell", "seats", "all" |
| Minimum Value | Number | No | Minimum opportunity value |
| Confidence Filter | String | No | "high", "medium", "all" |

## Process Flow
```
Opportunity Detection Triggered
            │
            ▼
┌──────────────────────────┐
│ Scan All Active Accounts │
│ (Healthy accounts only)  │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ For Each Account:        │
│ Analyze Expansion Signals│
└───────────┬──────────────┘
            │
    ┌───────┴───────┬──────────────┬────────────────┐
    ▼               ▼              ▼                ▼
┌──────────┐ ┌───────────┐ ┌─────────────┐ ┌────────────┐
│Usage     │ │Contract   │ │Stakeholder │ │Competitive │
│Patterns  │ │Headroom   │ │Signals     │ │Whitespace  │
└─────┬────┘ └─────┬─────┘ └──────┬──────┘ └─────┬──────┘
      │            │              │               │
      └────────────┴──────────────┴───────────────┘
                          │
                          ▼
           ┌──────────────────────────┐
           │ Score & Classify         │
           │ Opportunities            │
           └───────────┬──────────────┘
                       │
                       ▼
           ┌──────────────────────────┐
           │ Estimate Value &         │
           │ Generate Approach        │
           └───────────┬──────────────┘
                       │
                       ▼
              Surface Opportunities
```

## Expansion Signal Detection
### Usage-Based Signals
| Signal | Detection Logic | Opportunity Type |
|--------|----------------|------------------|
| Seat Utilization > 90% | active_users / licensed_users > 0.9 | Seat expansion |
| Feature Ceiling Hit | Power feature usage at limit | Feature upsell |
| Usage Growth > 30% | MAU growth vs prior quarter | Tier upsell |
| New Use Case | New feature cluster adopted | Cross-sell |
| API Usage Surge | API calls > 80% of limit | API tier upgrade |

### Contract-Based Signals
| Signal | Detection Logic | Opportunity Type |
|--------|----------------|------------------|
| Approaching Entitlement Limit | Usage > 80% of entitlement | Entitlement expansion |
| Multi-Year Discount Available | Single year contract | Multi-year conversion |
| Legacy Pricing | Not on current pricing | Pricing update |
| Missing Products | Products not in contract | Cross-sell |

### Stakeholder Signals
| Signal | Detection Logic | Opportunity Type |
|--------|----------------|------------------|
| New Department Mentioned | New team in conversations | Department expansion |
| Budget Discussion | "Budget" mentioned positively | General expansion |
| Comparison Shopping | Competitor features asked | Feature upsell |
| Exec Sponsor Growth Goals | Growth mentioned in QBR | Strategic expansion |

## Opportunity Scoring Model
```typescript
interface ExpansionOpportunity {
  customerId: string;
  opportunityType: 'upsell' | 'cross_sell' | 'seat_expansion' | 'tier_upgrade';
  estimatedValue: number;
  confidenceScore: number;  // 0-100
  signals: ExpansionSignal[];
  suggestedApproach: string;
  champion: Stakeholder | null;
  timeline: 'immediate' | '30_days' | '60_days' | 'next_renewal';
  blockers: string[];
}

// Confidence calculation
confidence = (
  signalStrength * 0.35 +      // How strong are the signals
  healthScore * 0.25 +          // Is the account healthy enough
  championEngagement * 0.20 +   // Do we have a path to decision maker
  historicalExpansion * 0.20    // Has this account expanded before
);
```

## Output Format
```markdown
## Expansion Opportunity Pipeline
Generated: [Timestamp]

### Portfolio Summary
| Metric | Value |
|--------|-------|
| Total Opportunities | 28 |
| Total Potential Value | $485,000 |
| High Confidence (>70%) | 12 opportunities - $210,000 |
| Immediate (This Quarter) | 8 opportunities - $145,000 |

### Top Opportunities

#### 1. Acme Corp - Seat Expansion
**Opportunity Value**: $45,000 | **Confidence**: 85%

**Why This Opportunity**:
- Current: 50 seats, 48 active users (96% utilization)
- 3 departments requesting access in last 30 days
- Champion confirmed budget availability for Q1
- Usage growing 25% month-over-month

**Approach**:
1. Lead with value delivered to current users
2. Propose pilot for requesting departments (15 seats)
3. Bundle with power feature upgrade for better pricing

**Champion**: Sarah Chen (VP Operations)
**Timeline**: Immediate
**Next Step**: [Schedule Expansion Call] [Send Proposal]

---

#### 2. Beta Inc - Cross-Sell (Analytics Module)
**Opportunity Value**: $35,000 | **Confidence**: 72%

**Why This Opportunity**:
- Heavy export usage suggests analytics need
- Competitor analytics mentioned in last QBR
- CFO sponsor interested in reporting capabilities
- Similar customers see 40% efficiency gain

**Approach**:
1. Offer analytics demo to CFO and team
2. Present ROI case study from similar company
3. Bundle with training credits

**Timeline**: 30 days
**Next Step**: [Request Demo] [Send Case Study]

---

### Opportunity by Type
| Type | Count | Total Value | Avg Confidence |
|------|-------|-------------|----------------|
| Seat Expansion | 12 | $180,000 | 78% |
| Tier Upgrade | 8 | $145,000 | 71% |
| Cross-Sell | 5 | $95,000 | 65% |
| Multi-Year | 3 | $65,000 | 82% |

### Opportunity by Timeline
| Timeline | Count | Value | Actions Needed |
|----------|-------|-------|----------------|
| Immediate | 8 | $145,000 | Ready to propose |
| This Quarter | 12 | $210,000 | Nurturing |
| Next Quarter | 8 | $130,000 | Early signals |

### Quick Wins (High Value, High Confidence, Immediate)
| Account | Type | Value | Confidence | Action |
|---------|------|-------|------------|--------|
| Acme Corp | Seats | $45,000 | 85% | [Propose] |
| Delta Co | Multi-Year | $28,000 | 88% | [Propose] |
| Epsilon | Tier | $32,000 | 80% | [Schedule Demo] |
```

## Acceptance Criteria
- [ ] Detects seat utilization > 85%
- [ ] Identifies feature adoption gaps vs available features
- [ ] Surfaces cross-sell opportunities based on usage patterns
- [ ] Estimates opportunity value accurately
- [ ] Provides confidence scores with explanation
- [ ] Suggests approach and talking points
- [ ] Identifies champion for each opportunity
- [ ] Integrates with expansion_opportunities table
- [ ] Real-time alerts when new signals detected
- [ ] Filters by type, confidence, timeline, value

## API Endpoint
```
GET /api/intelligence/expansion-opportunities
  Query: ?type=all&minValue=10000&confidence=high

POST /api/intelligence/expansion-opportunities
  Body: {
    "csmId": "uuid",
    "opportunityTypes": ["upsell", "cross_sell"],
    "minConfidence": 60
  }
```

## Data Sources
| Source | Table | Usage |
|--------|-------|-------|
| Customers | `customers` | Base account data |
| Contracts | `contracts` | Entitlements, pricing |
| Usage | `usage_metrics` | Utilization analysis |
| Entitlements | `entitlements` | Limit comparison |
| Meetings | `meeting_analyses` | Signal extraction |
| Opportunities | `expansion_opportunities` | Existing pipeline |

## Automated Actions
- Create expansion opportunity record when confidence > 60%
- Alert CSM via Slack when high-confidence opportunity detected
- Add to CRM pipeline when CSM confirms opportunity
- Track conversion rate for model improvement

## Success Metrics
| Metric | Target |
|--------|--------|
| Opportunity Detection Rate | > 80% of actual expansions |
| Conversion Rate (High Confidence) | > 40% |
| Time from Signal to Action | < 7 days |
| Expansion Revenue Influenced | +25% vs baseline |
| False Positive Rate | < 20% |

## Future Enhancements
- ML model trained on historical expansion data
- Automatic proposal generation
- Competitive displacement opportunities
- Partner/integration expansion tracking
- Territory planning integration

## Related PRDs
- PRD-071: White Space Analysis
- PRD-103: Expansion Signal Detected
- PRD-155: Expansion Pipeline Report
- PRD-238: Expansion Propensity Modeling
