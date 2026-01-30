# PRD-068: Competitive Intelligence per Account

## Category
**Category C: Account Intelligence**

## Priority
**P2** - Advanced Features

## Overview
Provide CSMs with account-specific competitive intelligence including competitor mentions in conversations, competitive products the customer uses or evaluates, displacement risks, and battle-ready talking points. This intelligence helps CSMs proactively defend accounts and position against competitive threats.

## User Story
As a CSM, I want to know what competitors my customer is using or evaluating so that I can proactively address competitive threats, reinforce our value, and prevent displacement.

As a CS Leader, I want to see competitive trends across the portfolio so that I can identify patterns, update battle cards, and coordinate with Product on competitive gaps.

## Trigger
- Navigation: Customer Detail > Competitive Tab
- Natural language: "What competitors is [Account] using?"
- Variations: "Competitive intel for [Account]", "Who are we competing with at [Account]?"
- Alert: Competitor mentioned in meeting/email

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to analyze |
| Time Period | String | No | Look-back period for mentions |

## Competitive Data Sources
| Source | Detection Method | Data Type |
|--------|------------------|-----------|
| Meeting Transcripts | NLP extraction | Mentions, sentiment |
| Email Threads | Keyword detection | Questions, comparisons |
| Support Tickets | Tag analysis | Feature requests (gap indicators) |
| QBR Notes | Manual/AI capture | Strategic discussions |
| Web Research | Company analysis | Tech stack, news |

## Competitor Categories
| Category | Description | Risk Level |
|----------|-------------|------------|
| Active Threat | Customer actively evaluating | Critical |
| Incumbent | Using alongside our product | High |
| Past Evaluation | Previously considered | Medium |
| Market Presence | In their industry/space | Low |

## Output Format
```markdown
## Competitive Intelligence: Acme Corp
Last Updated: [Timestamp]

### Competitive Risk Level: MODERATE
[Risk gauge visualization]

### Active Competitive Situation

#### Current Threats
| Competitor | Status | Last Mentioned | Risk Level |
|------------|--------|----------------|------------|
| CompetitorX | Evaluating | Jan 15, 2026 | Critical |
| CompetitorY | Using for analytics | Nov 2025 | High |

---

### CompetitorX - Active Evaluation

**Status**: Customer is actively evaluating CompetitorX

**Timeline of Mentions**:
- **Jan 15, 2026** (QBR): CEO asked about feature parity with CompetitorX
- **Jan 10, 2026** (Support): Feature request citing CompetitorX capability
- **Dec 20, 2025** (Email): Asked for comparison document

**What They're Looking For**:
- Advanced reporting capabilities
- Better mobile experience
- Lower price point

**Their Concerns About Us**:
- "Reporting is harder to customize than CompetitorX"
- "Mobile app feels dated"
- "Cost per user is higher"

**Our Strengths vs CompetitorX**:
| Capability | Us | CompetitorX | Our Advantage |
|------------|-----|-------------|---------------|
| Integration depth | ✓✓ | ✓ | 3x more integrations |
| Enterprise security | ✓✓ | ✓ | SOC2 Type II, HIPAA |
| Customer support | ✓✓ | ✓ | Dedicated CSM, faster response |
| Uptime SLA | 99.99% | 99.9% | Higher reliability |

**Recommended Defense Strategy**:
1. **Immediate**: Schedule ROI review showing actual value delivered
2. **This Week**: Demo advanced reporting features they may not know about
3. **Messaging**: Emphasize integration depth and security compliance
4. **Concession**: Offer reporting training to address perception

**Battle Card Excerpt**:
> "CompetitorX may seem easier on the surface, but enterprise customers
> consistently find their reporting breaks at scale. Our customers
> process 10x the data volume with better performance."

[View Full Battle Card] [Request Sales Support] [Share with Manager]

---

### CompetitorY - Incumbent for Analytics

**Status**: Using CompetitorY for analytics alongside our platform

**Coexistence Assessment**:
- They use CompetitorY for: BI dashboards, data visualization
- They use us for: Core operations, workflow automation
- Overlap area: Reporting (some redundancy)

**Displacement Opportunity**:
Our analytics module could replace CompetitorY
- Current CompetitorY spend: ~$30,000/year (estimated)
- Our analytics add-on: $15,000/year
- Savings + consolidation benefit: Strong value prop

**Recommended Approach**:
1. Propose analytics module demo to power users
2. Show consolidation benefits (single source of truth)
3. Highlight cost savings and reduced vendor management

---

### Feature Gap Analysis

Based on competitive mentions, customers are asking for features where competitors lead:

| Requested Feature | Competitor With It | Our Status | Priority |
|-------------------|-------------------|------------|----------|
| Custom dashboards | CompetitorX | In development Q2 | High |
| Native mobile BI | CompetitorX | Planned Q3 | Medium |
| AI insights | CompetitorY | Shipped Jan 2026 | Delivered! |

**Talk Track for Gaps**:
> "I understand you've seen [feature] with CompetitorX. We're actively
> building this - it's on our Q2 roadmap. In the meantime, here's how
> our current customers achieve similar results..."

---

### Historical Competitive Context

**Past Evaluations**:
| Competitor | When | Outcome | Why We Won |
|------------|------|---------|------------|
| CompetitorZ | Q2 2024 | Won | Better integration, price |
| CompetitorY | Q1 2024 | Partial (analytics) | We lacked BI features then |

**Original Deal Context**:
- Displaced: None (greenfield)
- Key differentiators: Integration depth, CSM model
- Decision maker: VP Operations (still champion)

---

### Competitive Mentions Over Time
[Line chart: Competitor mentions per quarter]

Trend: CompetitorX mentions increasing since Q4 2025
Alert: 3x increase in competitive mentions - investigate

---

### Recommended Actions

1. **Urgent**: Address CompetitorX evaluation with ROI review
2. **Proactive**: Demo analytics to displace CompetitorY
3. **Ongoing**: Monitor for new competitive mentions

### Quick Actions
[View CompetitorX Battle Card] [Request Sales Engineer] [Schedule Competitive Review Meeting]

---

### Market Intelligence

**Acme Corp's Tech Stack** (via technographics):
- CRM: Salesforce
- Marketing: HubSpot
- Analytics: CompetitorY, Tableau
- Support: Zendesk

**Recent News**:
- Jan 5, 2026: Acme Corp announced cost reduction initiative
- Dec 2025: New CTO hired (came from CompetitorX customer)

**Implication**: Cost focus + new CTO may drive vendor consolidation
```

## Competitive Risk Score
```typescript
const competitiveRiskScore = (
  activeEvaluationWeight * (activeThreats > 0 ? 40 : 0) +
  mentionFrequencyWeight * normalizedMentions +
  featureGapWeight * gapCount +
  incumbentWeight * (hasIncumbent ? 15 : 0) +
  decisionMakerChangeWeight * (newDecisionMaker ? 10 : 0)
);
```

## Acceptance Criteria
- [ ] All competitor mentions extracted from transcripts/emails
- [ ] Competitor status (active, incumbent, past) tracked
- [ ] Battle card excerpts displayed per competitor
- [ ] Feature gap analysis generated
- [ ] Historical context preserved
- [ ] Recommended actions specific to competitive situation
- [ ] Alert when new competitor mentioned
- [ ] Links to full battle cards
- [ ] Risk score calculated and displayed
- [ ] Tech stack intelligence shown

## API Endpoint
```
GET /api/intelligence/competitive/:customerId
  Query: ?period=12m

Response: {
  riskLevel: string;
  riskScore: number;
  activeThreats: Competitor[];
  incumbents: Competitor[];
  mentions: CompetitiveMention[];
  featureGaps: FeatureGap[];
  battleCards: BattleCardExcerpt[];
  recommendations: Action[];
}
```

## Data Sources
| Source | Table/API | Data |
|--------|-----------|------|
| Meetings | `meeting_analyses` | Competitor mentions |
| Email | Gmail API | Competitive keywords |
| Support | Integration | Feature requests |
| Battle Cards | Knowledge base | Battle card content |
| Technographics | External API | Tech stack data |
| News | News API | Company news |

## AI Processing
- NLP extraction of competitor names from text
- Sentiment analysis of competitive mentions
- Feature request categorization
- Battle card relevance matching

## Alert Triggers
| Condition | Alert | Priority |
|-----------|-------|----------|
| New competitor mentioned | CSM notification | Medium |
| Competitor mentioned 3+ times/month | CSM notification | High |
| "Evaluating alternatives" detected | CSM + Manager alert | Critical |

## Success Metrics
| Metric | Target |
|--------|--------|
| Competitive Threats Identified | > 90% before impact |
| Win Rate vs Competition | +15% |
| Displacement Prevention | 80% save rate |
| CSM Preparation Score | +40% confidence |

## Future Enhancements
- Real-time competitive mention alerts
- Automated battle card recommendations
- Win/loss analysis integration
- Competitor pricing intelligence
- Multi-vendor consolidation opportunities

## Related PRDs
- PRD-011: Competitor Mention Analysis
- PRD-094: Competitor Mentioned Alert
- PRD-230: Competitive Intelligence Gathering
- PRD-134: Competitive Deal Outcome Analysis
