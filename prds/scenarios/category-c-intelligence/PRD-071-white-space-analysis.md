# PRD-071: White Space Analysis

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Provide a comprehensive analysis of untapped opportunities within a customer account, identifying products/features not purchased, departments/teams not using the platform, and potential use cases not yet explored. This "white space" analysis helps CSMs and account managers identify expansion opportunities with specific, actionable insights.

## User Story
As a CSM, I want to see what opportunities exist within my customer account so that I can strategically pursue expansion and increase account value by addressing unmet needs.

As an Account Executive, I want to understand the white space in my accounts so that I can build targeted expansion proposals and forecast potential growth.

## Trigger
- Navigation: Customer Detail > Expansion Tab > White Space
- Natural language: "What's the white space for [Account]?"
- Variations: "Expansion opportunities at [Account]", "What else could [Account] buy?", "Untapped potential"

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to analyze |
| Focus Area | String | No | "products", "users", "use_cases", "all" |

## White Space Categories
### Product White Space
| Type | Description | Opportunity |
|------|-------------|-------------|
| Unpurchased Products | Products in catalog not in contract | Cross-sell |
| Feature Upgrades | Premium features not licensed | Upsell |
| Add-On Modules | Optional modules available | Upsell |
| Tier Upgrades | Higher tier available | Upsell |

### User White Space
| Type | Description | Opportunity |
|------|-------------|-------------|
| Unused Licenses | Licensed but not activated | Activation |
| Additional Seats | At capacity, need more | Seat expansion |
| New Departments | Departments not using | Department expansion |
| New Teams | Teams within dept not using | Team expansion |

### Use Case White Space
| Type | Description | Opportunity |
|------|-------------|-------------|
| Unrealized Use Cases | Use cases others do, they don't | Expansion |
| Adjacent Workflows | Related processes not automated | Expansion |
| Integration Opportunities | Integrations not connected | Stickiness |

## White Space Analysis Model
```typescript
interface WhiteSpaceAnalysis {
  customerId: string;
  totalPotentialValue: number;
  categories: {
    products: ProductWhiteSpace;
    users: UserWhiteSpace;
    useCases: UseCaseWhiteSpace;
  };
  prioritizedOpportunities: WhiteSpaceOpportunity[];
  recommendations: string[];
}

interface WhiteSpaceOpportunity {
  id: string;
  category: string;
  type: string;
  name: string;
  description: string;
  potentialValue: number;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
  nextSteps: string[];
  relevanceScore: number;
}
```

## Output Format
```markdown
## White Space Analysis: Acme Corp
Generated: [Timestamp]

### Total White Space Value: $185,000 potential ARR

[Visualization: Sunburst chart of white space by category]

### Quick Summary
| Category | Opportunities | Potential Value | Readiness |
|----------|---------------|-----------------|-----------|
| Products | 4 | $95,000 | High |
| Users | 3 | $55,000 | Medium |
| Use Cases | 3 | $35,000 | Medium |

---

### Product White Space ($95,000)

#### Current vs Available
```
Product Catalog:
✓ Enterprise Platform      [$100,000]  - Purchased
✓ API Access              [$10,000]   - Purchased
✓ Standard Support        [Included]  - Active
○ Analytics Module        [$25,000]   - Not Purchased
○ White Labeling         [$30,000]   - Not Purchased
○ Advanced Security      [$15,000]   - Not Purchased
○ Mobile App Access      [$10,000]   - Not Purchased
○ Premium Support        [$15,000]   - Not Purchased
```

#### Top Product Opportunities

##### 1. Analytics Module - $25,000/year
**Confidence**: High | **Relevance**: 92/100

**Why This Fits**:
- Heavy usage of export/reporting features (500+ exports/month)
- Stakeholder asked about BI capabilities in last QBR
- Using CompetitorY for analytics (consolidation opportunity)
- Similar customers see 40% efficiency gain

**Signals Detected**:
- "Wish we had better dashboards" (Meeting, Dec 15)
- Feature request: Custom reporting (#4521)
- High report export volume

**Approach**:
1. Offer analytics demo to VP Operations
2. Show consolidation value vs CompetitorY ($20K savings)
3. Pilot with 5 power users

[Schedule Demo] [Send One-Pager] [Create Proposal]

---

##### 2. Advanced Security - $15,000/year
**Confidence**: Medium | **Relevance**: 78/100

**Why This Fits**:
- New CTO started (typically drives security reviews)
- Industry facing increased compliance pressure
- Peer companies at their size typically have this

**Signals**:
- New CTO hire announcement
- SOC2 mentioned in support ticket

[Share Security Datasheet] [Request Compliance Meeting]

---

### User White Space ($55,000)

#### License Utilization
| Type | Licensed | Active | Utilization | Opportunity |
|------|----------|--------|-------------|-------------|
| Full Users | 200 | 145 | 73% | 55 available |
| Admin Users | 10 | 5 | 50% | 5 available |

**Note**: No immediate seat expansion needed (55 seats available)

#### Department Penetration
| Department | Using? | Potential Users | Opportunity |
|------------|--------|-----------------|-------------|
| Operations | ✓ Yes | 80 | Active |
| Engineering | ✓ Yes | 45 | Active |
| Finance | Partial | 20 | $10,000 |
| Marketing | ✗ No | 35 | $17,500 |
| HR | ✗ No | 15 | $7,500 |
| Sales | ✗ No | 40 | $20,000 |

**Total Department Expansion**: $55,000 potential

#### Top User Expansion Opportunities

##### 1. Marketing Department - $17,500/year (35 users)
**Confidence**: High | **Relevance**: 85/100

**Why This Fits**:
- Marketing Director mentioned interest (QBR, Q3)
- Use case overlap with Operations workflows
- Champion (Sarah) has good relationship with Marketing VP

**Approach**:
1. Ask Sarah for warm intro to Marketing VP
2. Propose pilot with 5 marketing users
3. Focus on campaign reporting use case

[Request Introduction] [Create Marketing Use Case Doc]

---

### Use Case White Space ($35,000)

#### Realized vs Potential Use Cases
| Use Case | Adoption | Peer Adoption | Opportunity |
|----------|----------|---------------|-------------|
| Reporting Automation | ✓ Active | 90% | - |
| Workflow Automation | ✓ Active | 85% | - |
| Data Integration | ✓ Active | 75% | - |
| Customer Analytics | ✗ No | 60% | $15,000 |
| Predictive Alerts | ✗ No | 45% | $10,000 |
| External Sharing | ✗ No | 55% | $10,000 |

#### Top Use Case Opportunities

##### 1. Customer Analytics - $15,000/year
**Confidence**: Medium | **Relevance**: 72/100

**Why This Fits**:
- They have customer data flowing through platform
- Analytics module would unlock this use case
- Cross-sell with Analytics Module opportunity

**Approach**:
1. Bundle with Analytics Module proposal
2. Show customer analytics case study
3. Calculate ROI for customer insights

---

### Integrated Expansion Proposal

Based on white space analysis, recommended expansion package:

| Item | Annual Value | Discount | Net Value |
|------|-------------|----------|-----------|
| Analytics Module | $25,000 | 15% | $21,250 |
| Marketing Dept (35 users) | $17,500 | 15% | $14,875 |
| Advanced Security | $15,000 | 10% | $13,500 |
| **Total** | **$57,500** | | **$49,625** |

**Value Proposition**:
- Consolidate CompetitorY (-$20K annual)
- Enable new department (Marketing)
- Future-proof security compliance

**Timeline**:
- Q1: Analytics + Marketing pilot
- Q2: Full rollout + Security add-on

[Generate Expansion Proposal] [Schedule Expansion Call]

---

### Peer Comparison

**Accounts of similar size/industry typically have:**
| Product/Feature | Acme | Peer % |
|-----------------|------|--------|
| Analytics Module | No | 65% |
| Advanced Security | No | 55% |
| Mobile Access | No | 42% |
| 3+ Departments | No | 70% |

**Acme is under-penetrated vs peers**

---

### White Space Heatmap
[Visual heatmap showing opportunity by department/product]

### Quick Actions
[Export Analysis] [Create Proposal] [Schedule Strategy Call] [Share with AE]
```

## Acceptance Criteria
- [ ] All unpurchased products identified
- [ ] License utilization calculated
- [ ] Department penetration analyzed
- [ ] Use case adoption compared to peers
- [ ] Potential values estimated
- [ ] Confidence scores assigned
- [ ] Signals linked to opportunities
- [ ] Integrated expansion proposal generated
- [ ] Peer comparison included
- [ ] Export to PDF available

## API Endpoint
```
GET /api/intelligence/white-space/:customerId
  Query: ?focus=all

Response: {
  totalPotentialValue: number;
  categories: WhiteSpaceCategories;
  opportunities: WhiteSpaceOpportunity[];
  expansionProposal: ExpansionProposal;
  peerComparison: PeerComparison;
}
```

## Data Sources
| Source | Table | Data |
|--------|-------|------|
| Products | Product catalog | Available products |
| Contracts | `contracts`, `entitlements` | Purchased items |
| Usage | `usage_metrics` | Utilization data |
| Stakeholders | `stakeholders` | Department info |
| Meetings | `meeting_analyses` | Signal extraction |
| Peers | Aggregated data | Comparison |

## Opportunity Scoring
```typescript
const relevanceScore = (
  productFit * 0.30 +           // Does it fit their use case?
  signalStrength * 0.25 +       // Have they indicated interest?
  peerAdoption * 0.20 +         // Do similar customers have it?
  championAlignment * 0.15 +    // Does champion support this?
  timingFit * 0.10              // Is timing right?
);
```

## Success Metrics
| Metric | Target |
|--------|--------|
| White Space Identified | 100% of accounts |
| Opportunities Pursued | > 40% of identified |
| Conversion Rate | > 25% |
| Expansion Revenue Influenced | +30% |

## Future Enhancements
- Automated opportunity alerts
- ML-based opportunity scoring
- Competitive displacement opportunities
- Multi-year expansion roadmaps
- Territory planning integration

## Related PRDs
- PRD-060: Expansion Opportunity Finder
- PRD-047: Upsell Introduction Email
- PRD-155: Expansion Pipeline Report
- PRD-238: Expansion Propensity Modeling
