# PRD-216: Predictive Churn Scoring

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-216 |
| **Title** | Predictive Churn Scoring |
| **Category** | H: AI-Powered Features |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Current health scores are reactive, reflecting current state rather than predicting future outcomes. By the time health declines significantly, churn may already be in motion. CSMs need predictive churn scores that identify at-risk accounts 60-90 days in advance, providing time for intervention before the customer decides to leave.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see a churn probability score for each account (0-100%).
2. **As a CSM**, I want to understand the key factors driving churn risk for each account.
3. **As a CSM**, I want alerts when churn probability crosses threshold levels.
4. **As a CSM**, I want recommended actions to reduce churn probability.
5. **As a CSM Manager**, I want to see aggregate churn risk across the team's portfolio.

### Secondary User Stories
1. **As a CS Leader**, I want to see predicted churn impact on ARR over next quarter.
2. **As a CSM**, I want to see how my interventions affected churn probability over time.
3. **As a CS Leader**, I want to validate prediction accuracy with historical churn data.

## Acceptance Criteria

### Core Functionality
- [ ] Churn probability score (0-100%) for every active customer
- [ ] Score updated daily or on significant events
- [ ] Factor breakdown showing contribution to risk score
- [ ] Historical trend of churn probability
- [ ] Comparison to similar customer cohorts

### Prediction Factors
- [ ] Usage trends (declining DAU/MAU, feature abandonment)
- [ ] Engagement patterns (meeting attendance, email response rates)
- [ ] Health score trajectory (direction and velocity of change)
- [ ] Support ticket patterns (volume, severity, sentiment)
- [ ] NPS/survey responses
- [ ] Stakeholder changes (champion departure)
- [ ] Contract terms (renewal proximity, auto-renew status)
- [ ] Payment patterns (late payments, disputes)
- [ ] Competitive signals (mentions in meetings, RFPs)
- [ ] Similar customer churn patterns (cohort analysis)

### Alert Thresholds
- [ ] Yellow alert: Churn probability > 30%
- [ ] Orange alert: Churn probability > 50%
- [ ] Red alert: Churn probability > 70%
- [ ] Critical: Churn probability > 85%

## Technical Specification

### Prediction Model Architecture

```
Historical Data → Feature Engineering → ML Model Training → Real-time Scoring → Score Distribution
                                              ↑
                                        Model Validation
                                        (Backtesting)
```

### Feature Engineering

```typescript
interface ChurnFeatures {
  // Usage features
  dau_trend_30d: number;        // % change in DAU
  mau_trend_90d: number;        // % change in MAU
  feature_adoption_breadth: number; // % of features used
  feature_adoption_trend: number;   // Change in feature usage
  login_frequency_change: number;   // Change in login patterns

  // Engagement features
  meetings_last_90d: number;
  meeting_sentiment_trend: string;
  email_response_rate: number;
  days_since_last_meeting: number;
  days_since_last_email: number;

  // Health features
  health_score_current: number;
  health_score_change_30d: number;
  health_score_change_90d: number;
  health_score_velocity: number;  // Rate of change

  // Support features
  ticket_volume_trend: number;
  avg_ticket_severity: number;
  unresolved_tickets: number;
  support_sentiment: number;

  // Relationship features
  champion_tenure: number;
  stakeholder_count: number;
  exec_sponsor_engaged: boolean;
  champion_departed: boolean;

  // Commercial features
  days_to_renewal: number;
  contract_term_months: number;
  arr_percentile: number;
  payment_history_score: number;

  // Competitive features
  competitor_mentions_90d: number;
  active_rfp: boolean;

  // Historical features
  previous_save_plays: number;
  tenure_months: number;
}
```

### Scoring Model

#### Approach 1: Rule-Based Scoring (Initial)
```typescript
function calculateChurnScore(features: ChurnFeatures): ChurnPrediction {
  let baseScore = 20; // Default 20% base churn risk

  // Usage signals (up to +30)
  if (features.dau_trend_30d < -0.2) baseScore += 15;
  if (features.mau_trend_90d < -0.3) baseScore += 15;
  if (features.feature_adoption_trend < -0.1) baseScore += 10;

  // Engagement signals (up to +25)
  if (features.days_since_last_meeting > 60) baseScore += 10;
  if (features.meeting_sentiment_trend === 'declining') baseScore += 15;

  // Health signals (up to +20)
  if (features.health_score_current < 40) baseScore += 10;
  if (features.health_score_velocity < -5) baseScore += 10; // Dropping fast

  // Relationship signals (up to +25)
  if (features.champion_departed) baseScore += 25;
  if (!features.exec_sponsor_engaged) baseScore += 5;

  // Mitigating factors
  if (features.days_to_renewal > 180) baseScore -= 10;
  if (features.health_score_change_30d > 10) baseScore -= 10;

  return {
    probability: Math.min(Math.max(baseScore, 0), 100),
    confidence: calculateConfidence(features),
    topFactors: identifyTopFactors(features),
    recommendations: generateRecommendations(features)
  };
}
```

#### Approach 2: ML Model (Future)
- Train on historical churn data
- Features: All ChurnFeatures + time series patterns
- Model: Gradient boosting (XGBoost/LightGBM) or neural network
- Output: Probability + feature importance

### API Endpoints

#### GET /api/customers/{id}/churn-score
```json
{
  "customer_id": "uuid",
  "customer_name": "TechCorp Industries",
  "churn_probability": 67,
  "confidence": 0.82,
  "trend": "increasing",
  "change_30d": +12,
  "alert_level": "orange",
  "top_factors": [
    {
      "factor": "champion_departure",
      "impact": 25,
      "description": "Sarah Chen (VP Product) left the company on Jan 15"
    },
    {
      "factor": "usage_decline",
      "impact": 15,
      "description": "Daily active users down 35% over past 30 days"
    },
    {
      "factor": "meeting_sentiment",
      "impact": 12,
      "description": "Last 2 meetings had negative sentiment"
    }
  ],
  "recommendations": [
    {
      "action": "multi_thread",
      "description": "Identify and engage new champion",
      "impact_estimate": -15,
      "urgency": "high"
    },
    {
      "action": "usage_review",
      "description": "Schedule usage review meeting",
      "impact_estimate": -10,
      "urgency": "medium"
    }
  ],
  "similar_customers": {
    "saved_count": 12,
    "churned_count": 5,
    "key_differentiator": "Early intervention on champion change"
  },
  "calculated_at": "2026-01-29T10:00:00Z"
}
```

#### GET /api/portfolio/churn-risk
```json
{
  "summary": {
    "total_accounts": 45,
    "at_risk_count": 8,
    "critical_count": 2,
    "arr_at_risk": 850000,
    "predicted_churn_arr": 320000
  },
  "distribution": {
    "low_risk": { "count": 25, "arr": 2500000 },
    "medium_risk": { "count": 12, "arr": 1200000 },
    "high_risk": { "count": 6, "arr": 650000 },
    "critical_risk": { "count": 2, "arr": 200000 }
  },
  "trending_worse": [
    { "customer_id": "uuid", "name": "TechCorp", "change": +15 }
  ],
  "trending_better": [
    { "customer_id": "uuid", "name": "GlobalCo", "change": -10 }
  ]
}
```

### Database Schema

```sql
CREATE TABLE churn_predictions (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  probability INTEGER NOT NULL,
  confidence DECIMAL(3,2),
  alert_level VARCHAR(20),
  factors JSONB NOT NULL,
  recommendations JSONB,
  model_version VARCHAR(20),
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE churn_prediction_history (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  probability INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_churn_predictions_customer ON churn_predictions(customer_id);
CREATE INDEX idx_churn_predictions_alert ON churn_predictions(alert_level);
CREATE INDEX idx_churn_history_customer_date ON churn_prediction_history(customer_id, recorded_at);
```

## UI/UX Design

### Customer Detail - Churn Risk Card
```
┌─────────────────────────────────────────────────────────┐
│ CHURN RISK                                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   67%              ▲ +12% from last month               │
│   ████████████████░░░░░░░░░░                           │
│   HIGH RISK                                             │
│                                                         │
│ TOP RISK FACTORS                                        │
│ ─────────────────                                       │
│ 🔴 Champion departed (Jan 15)           +25 points     │
│ 🟠 Usage down 35%                       +15 points     │
│ 🟠 Negative meeting sentiment           +12 points     │
│                                                         │
│ RECOMMENDED ACTIONS                                     │
│ ─────────────────                                       │
│ 1. Identify new champion (-15% impact)                  │
│ 2. Schedule usage review (-10% impact)                  │
│ 3. Escalate to leadership (-8% impact)                  │
│                                                         │
│ [Start Save Play] [View History] [Compare to Cohort]    │
└─────────────────────────────────────────────────────────┘
```

### Portfolio Risk Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ PORTFOLIO CHURN RISK                    Q1 2026 ▼       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ARR AT RISK                 ACCOUNTS BY RISK LEVEL      │
│ ┌─────────────────────┐     ┌─────────────────────────┐ │
│ │     $850K            │     │ ▓▓▓▓▓▓▓▓▓▓▓▓▓░ 25 Low  │ │
│ │  of $4.5M portfolio  │     │ ▓▓▓▓▓▓░░░░░░░░ 12 Med  │ │
│ │     19%              │     │ ▓▓▓░░░░░░░░░░░ 6 High  │ │
│ └─────────────────────┘     │ ▓░░░░░░░░░░░░░ 2 Crit  │ │
│                              └─────────────────────────┘ │
│                                                         │
│ CRITICAL ACCOUNTS (Churn > 70%)                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ TechCorp       $250K    85%    ▲5   Champion left   │ │
│ │ GlobalCo       $180K    72%    ▲8   Usage collapse  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ TREND: Churn risk increasing across portfolio           │
│        3 accounts moved to high risk this month         │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Usage metrics ingestion pipeline
- Meeting analysis system
- Risk signal detection
- Health score calculation

### Related PRDs
- PRD-231: Customer Health Prediction
- PRD-152: Churn Analysis Report
- PRD-061: At-Risk Portfolio View
- PRD-118: Health Score Change → Playbook Selection

## Success Metrics

### Quantitative
- Prediction accuracy > 75% (actual churn matches prediction)
- Early warning: Identifies risk 60+ days before churn
- False positive rate < 20%
- Save rate improvement: 20% more at-risk accounts saved

### Qualitative
- CSMs trust predictions and take action
- Predictions align with CSM intuition
- Clear, actionable recommendations

## Rollout Plan

### Phase 1: Rule-Based Model (Week 1-3)
- Implement feature extraction
- Deploy rule-based scoring
- Basic UI integration

### Phase 2: Validation (Week 4-5)
- Backtest against historical churn
- Tune scoring weights
- Add confidence scores

### Phase 3: Recommendations (Week 6-7)
- Automated action recommendations
- Integration with save plays
- Alert system

### Phase 4: ML Enhancement (Week 8+)
- Train ML model on historical data
- A/B test vs rule-based
- Continuous learning pipeline

## Open Questions
1. What's the minimum history needed for accurate prediction?
2. How do we handle new customers with limited data?
3. Should we differentiate churn types (voluntary vs involuntary)?
4. How do we account for macro factors (economy, industry trends)?
