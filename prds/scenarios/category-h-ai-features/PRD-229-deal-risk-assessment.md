# PRD-229: Deal Risk Assessment

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-229 |
| **Title** | Deal Risk Assessment |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Renewals and expansion deals progress through various stages, but CSMs often lack visibility into what risks threaten each deal. By the time risks become obvious, it may be too late to course-correct. AI should continuously assess deal health, identify specific risks, and recommend mitigation strategies to improve win rates.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see a risk assessment for each renewal/expansion in my pipeline.
2. **As a CSM**, I want specific risks identified (not just a score).
3. **As a CSM**, I want risk mitigation recommendations for each deal.
4. **As a CSM**, I want alerts when deal risk increases significantly.
5. **As a CSM**, I want to track how risks evolve throughout the deal lifecycle.

### Secondary User Stories
1. **As a CSM Manager**, I want to see aggregate deal risk across the team's pipeline.
2. **As a CSM**, I want to see how my deal compares to similar successful deals.
3. **As a CS Leader**, I want to forecast accurately based on deal risk data.

## Acceptance Criteria

### Core Functionality
- [ ] Risk score (0-100) for each active deal
- [ ] Specific risk identification with severity
- [ ] Mitigation recommendations per risk
- [ ] Risk trend tracking over deal lifecycle
- [ ] Comparison to similar successful deals

### Risk Categories
- [ ] **Relationship risks**: Champion departure, stakeholder misalignment
- [ ] **Product risks**: Low adoption, feature gaps, support issues
- [ ] **Commercial risks**: Budget constraints, price sensitivity, procurement
- [ ] **Competitive risks**: Active evaluation, competitor mentions
- [ ] **Timing risks**: Decision timeline, fiscal year misalignment
- [ ] **Process risks**: Missing milestones, stalled stages

### Deal Types Covered
- [ ] Renewals
- [ ] Upsells
- [ ] Cross-sells
- [ ] Multi-year extensions

## Technical Specification

### Architecture

```
Deal Data → Risk Extractor → Risk Scorer → Mitigation Generator → Alert Engine
     ↓            ↓               ↓                ↓
Historical    Risk Model    Recommendation     Threshold
  Deals                       Engine            Monitor
```

### Risk Assessment Model

```typescript
interface DealRiskAssessment {
  deal_id: string;
  overall_risk_score: number;  // 0-100, higher = more risky
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  risks: IdentifiedRisk[];
  mitigations: Mitigation[];
  comparison: DealComparison;
  trend: RiskTrend;
  assessed_at: Date;
}

interface IdentifiedRisk {
  id: string;
  category: RiskCategory;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact_score: number;  // Contribution to overall risk
  evidence: string[];
  detected_at: Date;
  status: 'new' | 'acknowledged' | 'mitigating' | 'resolved';
}

interface Mitigation {
  risk_id: string;
  action: string;
  expected_impact: number;  // Risk reduction if executed
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  owner: string;
}
```

### Risk Detection Logic

```typescript
async function assessDealRisk(dealId: string): Promise<DealRiskAssessment> {
  const deal = await getDealContext(dealId);
  const customer = await getCustomerContext(deal.customer_id);
  const stakeholders = await getStakeholderData(deal.customer_id);

  const risks: IdentifiedRisk[] = [];

  // Relationship risk assessment
  if (customer.champion_departed) {
    risks.push({
      category: 'relationship',
      name: 'Champion Departure',
      description: 'Key champion has left the organization',
      severity: 'high',
      impact_score: 25,
      evidence: ['Champion departure detected on ' + customer.champion_departure_date]
    });
  }

  if (!stakeholders.some(s => s.role_type === 'executive')) {
    risks.push({
      category: 'relationship',
      name: 'No Executive Sponsor',
      description: 'No executive-level engagement on renewal',
      severity: 'medium',
      impact_score: 15,
      evidence: ['No executive attended recent meetings', 'Proposal not reviewed by leadership']
    });
  }

  // Product risk assessment
  if (customer.health_score < 50) {
    risks.push({
      category: 'product',
      name: 'Low Health Score',
      description: `Customer health score is ${customer.health_score}`,
      severity: customer.health_score < 30 ? 'critical' : 'high',
      impact_score: customer.health_score < 30 ? 30 : 20,
      evidence: ['Health score trend declining', `Current score: ${customer.health_score}`]
    });
  }

  // Commercial risk assessment
  if (deal.competitor_mentioned) {
    risks.push({
      category: 'competitive',
      name: 'Active Competitive Evaluation',
      description: 'Customer is evaluating competitors',
      severity: 'high',
      impact_score: 20,
      evidence: deal.competitor_evidence
    });
  }

  // Process risk assessment
  const daysSinceActivity = daysBetween(deal.last_activity, new Date());
  if (daysSinceActivity > 14) {
    risks.push({
      category: 'process',
      name: 'Stalled Deal',
      description: `No activity in ${daysSinceActivity} days`,
      severity: daysSinceActivity > 30 ? 'high' : 'medium',
      impact_score: Math.min(daysSinceActivity, 20),
      evidence: [`Last activity: ${deal.last_activity}`]
    });
  }

  // Calculate overall risk
  const overallScore = risks.reduce((sum, r) => sum + r.impact_score, 0);
  const normalizedScore = Math.min(overallScore, 100);

  // Generate mitigations
  const mitigations = await generateMitigations(risks);

  // Compare to similar deals
  const comparison = await compareToPastDeals(deal, risks);

  return {
    deal_id: dealId,
    overall_risk_score: normalizedScore,
    risk_level: categorizeRisk(normalizedScore),
    confidence: calculateConfidence(risks),
    risks,
    mitigations,
    comparison,
    trend: await getRiskTrend(dealId),
    assessed_at: new Date()
  };
}

async function generateMitigations(risks: IdentifiedRisk[]): Promise<Mitigation[]> {
  // Use Claude to generate contextual mitigations
  const prompt = `
    Generate specific mitigation actions for these deal risks:
    ${JSON.stringify(risks, null, 2)}

    For each risk, provide:
    1. Specific action to mitigate
    2. Expected risk reduction (%)
    3. Effort level (low/medium/high)
    4. Recommended timeline
  `;

  return await claude.generate(prompt);
}
```

### API Endpoints

#### GET /api/deals/{id}/risk-assessment
```json
{
  "deal_id": "uuid",
  "deal_type": "renewal",
  "customer_name": "TechCorp Industries",
  "deal_value": 150000,
  "close_date": "2026-03-31",
  "overall_risk_score": 62,
  "risk_level": "high",
  "confidence": 0.85,
  "risks": [
    {
      "id": "risk-1",
      "category": "relationship",
      "name": "Champion Departure",
      "description": "Sarah Chen (VP Product) left on Jan 15",
      "severity": "high",
      "impact_score": 25,
      "evidence": [
        "Champion departure detected Jan 15",
        "Was primary contact for renewal discussions"
      ],
      "status": "new"
    },
    {
      "id": "risk-2",
      "category": "competitive",
      "name": "Competitive Evaluation",
      "description": "Customer mentioned evaluating alternatives",
      "severity": "high",
      "impact_score": 20,
      "evidence": [
        "Mentioned 'looking at options' in Jan 20 meeting",
        "Requested feature comparison"
      ],
      "status": "acknowledged"
    },
    {
      "id": "risk-3",
      "category": "product",
      "name": "Declining Health Score",
      "description": "Health score dropped from 72 to 55",
      "severity": "medium",
      "impact_score": 17,
      "evidence": [
        "Usage down 25% in last month",
        "Support tickets increased"
      ],
      "status": "mitigating"
    }
  ],
  "mitigations": [
    {
      "risk_id": "risk-1",
      "action": "Identify and engage new champion (likely Mike in Engineering)",
      "expected_impact": 15,
      "effort": "medium",
      "timeline": "Next 2 weeks"
    },
    {
      "risk_id": "risk-2",
      "action": "Schedule competitive differentiation session with decision makers",
      "expected_impact": 12,
      "effort": "medium",
      "timeline": "This week"
    },
    {
      "risk_id": "risk-3",
      "action": "Conduct usage review and provide enablement resources",
      "expected_impact": 10,
      "effort": "low",
      "timeline": "Immediate"
    }
  ],
  "comparison": {
    "similar_deals_won": 45,
    "similar_deals_lost": 12,
    "win_rate": 0.79,
    "key_differentiator": "Won deals had executive sponsor engaged",
    "your_deal_missing": ["Executive sponsor engagement"]
  },
  "trend": {
    "direction": "increasing",
    "change_7d": +8,
    "history": [
      { "date": "2026-01-15", "score": 45 },
      { "date": "2026-01-22", "score": 54 },
      { "date": "2026-01-29", "score": 62 }
    ]
  }
}
```

#### GET /api/pipeline/risk-summary
```json
{
  "total_deals": 25,
  "total_value": 2500000,
  "risk_distribution": {
    "low": { "count": 10, "value": 800000 },
    "medium": { "count": 8, "value": 900000 },
    "high": { "count": 5, "value": 600000 },
    "critical": { "count": 2, "value": 200000 }
  },
  "top_risks_across_pipeline": [
    { "risk": "No executive sponsor", "deal_count": 8 },
    { "risk": "Health score below 50", "deal_count": 5 },
    { "risk": "Competitive evaluation", "deal_count": 3 }
  ],
  "forecast_impact": {
    "original_forecast": 2500000,
    "risk_adjusted_forecast": 2050000,
    "at_risk_amount": 450000
  }
}
```

### Database Schema

```sql
CREATE TABLE deal_risk_assessments (
  id UUID PRIMARY KEY,
  deal_id UUID NOT NULL,
  deal_type VARCHAR(50),
  overall_risk_score INTEGER,
  risk_level VARCHAR(20),
  confidence DECIMAL(3,2),
  risks JSONB,
  mitigations JSONB,
  comparison JSONB,
  assessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deal_risk_history (
  id UUID PRIMARY KEY,
  deal_id UUID NOT NULL,
  risk_score INTEGER,
  risk_level VARCHAR(20),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deal_risk_mitigation_actions (
  id UUID PRIMARY KEY,
  deal_id UUID NOT NULL,
  risk_id TEXT,
  action TEXT,
  status VARCHAR(50),
  outcome VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_deal_risk_deal ON deal_risk_assessments(deal_id);
CREATE INDEX idx_deal_risk_level ON deal_risk_assessments(risk_level);
```

## UI/UX Design

### Deal Risk Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ RENEWAL RISK ASSESSMENT - TechCorp Industries           │
│ $150K | Close: Mar 31, 2026                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ OVERALL RISK                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │    62         HIGH RISK         ↗️ +8 this week     │ │
│ │    ████████████████████░░░░░░░░░                    │ │
│ │                                                     │ │
│ │    Risk History                                     │ │
│ │    45 ──── 54 ──── 62                              │ │
│ │   Jan 15  Jan 22  Jan 29                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ IDENTIFIED RISKS                                        │
│ ────────────────                                        │
│ 🔴 HIGH: Champion Departure                    25 pts  │
│    Sarah Chen left Jan 15. Was primary contact.         │
│    Mitigation: Engage Mike in Engineering               │
│    [Start Mitigation] [View Details]                    │
│                                                         │
│ 🔴 HIGH: Competitive Evaluation                20 pts  │
│    Customer evaluating alternatives.                    │
│    Mitigation: Differentiation session                  │
│    [Schedule Meeting] [View Details]                    │
│                                                         │
│ 🟠 MEDIUM: Declining Health Score              17 pts  │
│    Health dropped from 72 to 55.                        │
│    Mitigation: Usage review + enablement                │
│    [In Progress ✓] [View Details]                      │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ COMPARISON TO WON DEALS                                 │
│ Similar deals: 79% win rate (45 won, 12 lost)           │
│ Missing element: Executive sponsor engagement           │
│                                                         │
│ [Full Analysis] [Export Report] [Update Deal Stage]     │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Renewal pipeline data
- Health score system
- Meeting analysis (for competitive mentions)
- Stakeholder tracking

### Related PRDs
- PRD-216: Predictive Churn Scoring
- PRD-163: Renewal Forecast Report
- PRD-118: Health Score Change → Playbook Selection

## Success Metrics

### Quantitative
- Risk prediction accuracy > 80%
- Early warning: High-risk deals flagged 30+ days before loss
- Win rate improvement: 10% for deals with acted-upon mitigations
- Forecast accuracy improvement: 15% when using risk-adjusted pipeline

### Qualitative
- CSMs trust risk assessments
- Mitigations are actionable and effective
- Better deal qualification decisions

## Rollout Plan

### Phase 1: Basic Assessment (Week 1-2)
- Core risk detection
- Simple scoring
- Basic UI

### Phase 2: Mitigations (Week 3-4)
- AI-generated mitigations
- Mitigation tracking
- Deal comparison

### Phase 3: Pipeline View (Week 5-6)
- Aggregate risk view
- Forecast adjustment
- Trend analysis

### Phase 4: Optimization (Week 7-8)
- Model tuning from outcomes
- Advanced risk patterns
- Manager dashboards

## Open Questions
1. How do we weight different risk categories?
2. Should risk scores affect CRM opportunity stages?
3. How do we validate risk prediction accuracy?
4. What's the right alert threshold for deal risk changes?
