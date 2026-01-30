# PRD-231: Customer Health Prediction

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-231 |
| **Title** | Customer Health Prediction |
| **Category** | H: AI-Powered Features |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Current health scores are reactive, measuring current state based on recent data. CSMs need predictive health scores that forecast where customer health will be in 30, 60, and 90 days, enabling proactive intervention before health actually declines. This differs from churn prediction (PRD-216) by focusing on health trajectory rather than binary churn outcome.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see predicted health scores for 30/60/90 days out.
2. **As a CSM**, I want to understand what factors will drive health changes.
3. **As a CSM**, I want alerts when predicted health shows significant decline.
4. **As a CSM**, I want recommendations to improve predicted health trajectory.
5. **As a CSM**, I want to see which interventions would have the most impact.

### Secondary User Stories
1. **As a CSM Manager**, I want to see portfolio health forecast.
2. **As a CSM**, I want to track prediction accuracy over time.
3. **As a CS Leader**, I want to forecast resource needs based on health predictions.

## Acceptance Criteria

### Core Functionality
- [ ] Predicted health scores for 30, 60, 90 days
- [ ] Confidence intervals for predictions
- [ ] Key driver identification (what's causing the trend)
- [ ] Intervention impact modeling (if we do X, health improves by Y)
- [ ] Historical prediction accuracy tracking

### Prediction Inputs
- [ ] Current health score and components
- [ ] Health score velocity (rate of change)
- [ ] Usage trend trajectories
- [ ] Engagement pattern forecasts
- [ ] Upcoming events (renewal, QBR)
- [ ] Planned interventions
- [ ] Seasonal patterns for this customer
- [ ] Cohort behavior patterns

### Output Metrics
- [ ] Predicted health score (0-100)
- [ ] Confidence interval (e.g., 65 +/- 10)
- [ ] Primary drivers of prediction
- [ ] Recommended interventions with expected impact

## Technical Specification

### Architecture

```
Historical Data → Feature Engineering → Prediction Model → Impact Simulator → Recommendations
       ↓                   ↓                  ↓                  ↓
  Time Series        Pattern Extraction   ML/Statistical    What-if Analysis
```

### Prediction Model

```typescript
interface HealthPrediction {
  customer_id: string;
  current_health: number;
  predictions: PredictionPoint[];
  confidence: number;
  primary_drivers: Driver[];
  interventions: InterventionImpact[];
  accuracy_metrics: AccuracyMetrics;
  predicted_at: Date;
}

interface PredictionPoint {
  days_ahead: number;  // 30, 60, 90
  predicted_score: number;
  confidence_interval: { low: number; high: number };
  key_factors: string[];
}

interface Driver {
  factor: string;
  direction: 'positive' | 'negative';
  magnitude: number;  // Contribution to predicted change
  description: string;
}

interface InterventionImpact {
  intervention: string;
  expected_health_impact: number;
  confidence: number;
  time_to_impact_days: number;
  effort: 'low' | 'medium' | 'high';
}
```

### Prediction Algorithm

```typescript
async function predictHealth(
  customerId: string,
  horizonDays: number[]
): Promise<HealthPrediction> {
  // Gather historical health data
  const healthHistory = await getHealthHistory(customerId, 180);  // 6 months
  const usageHistory = await getUsageHistory(customerId, 180);
  const engagementHistory = await getEngagementHistory(customerId, 180);
  const upcomingEvents = await getUpcomingEvents(customerId);

  // Extract features
  const features = {
    health_velocity: calculateVelocity(healthHistory, 30),
    health_acceleration: calculateAcceleration(healthHistory, 30),
    usage_trend: calculateTrend(usageHistory),
    engagement_trend: calculateTrend(engagementHistory),
    seasonal_pattern: extractSeasonality(healthHistory),
    days_to_renewal: upcomingEvents.renewal?.daysAway || 365,
    recent_qbr: upcomingEvents.lastQbr?.daysAgo || 180,
    open_risk_signals: await getRiskSignalCount(customerId),
  };

  // Make predictions for each horizon
  const predictions = horizonDays.map(days => {
    const baseProjection = projectHealth(healthHistory, days);
    const adjustments = calculateAdjustments(features, days);

    return {
      days_ahead: days,
      predicted_score: Math.round(baseProjection + adjustments.total),
      confidence_interval: calculateConfidenceInterval(healthHistory, days),
      key_factors: adjustments.factors
    };
  });

  // Identify primary drivers
  const drivers = identifyDrivers(features, predictions);

  // Model intervention impacts
  const interventions = await modelInterventions(customerId, features);

  return {
    customer_id: customerId,
    current_health: healthHistory[healthHistory.length - 1].score,
    predictions,
    confidence: calculateOverallConfidence(healthHistory),
    primary_drivers: drivers,
    interventions,
    accuracy_metrics: await getHistoricalAccuracy(customerId),
    predicted_at: new Date()
  };
}

function projectHealth(
  history: HealthDataPoint[],
  daysAhead: number
): number {
  // Use linear regression for base projection
  const recentHistory = history.slice(-60);  // Last 60 days
  const slope = calculateSlope(recentHistory);
  const currentScore = history[history.length - 1].score;

  let projection = currentScore + (slope * daysAhead);

  // Apply mean reversion for extreme scores
  const mean = 65;  // Historical average
  const reversion = (mean - projection) * 0.1;
  projection += reversion;

  // Bound to 0-100
  return Math.max(0, Math.min(100, projection));
}

async function modelInterventions(
  customerId: string,
  features: Features
): Promise<InterventionImpact[]> {
  const possibleInterventions = [
    {
      name: 'Executive Business Review',
      applicability: features.recent_qbr > 90,
      typical_impact: 8,
      effort: 'high'
    },
    {
      name: 'Enablement Session',
      applicability: features.usage_trend < 0,
      typical_impact: 6,
      effort: 'medium'
    },
    {
      name: 'Champion Engagement',
      applicability: features.engagement_trend < 0,
      typical_impact: 5,
      effort: 'low'
    },
    // ... more interventions
  ];

  return possibleInterventions
    .filter(i => i.applicability)
    .map(i => ({
      intervention: i.name,
      expected_health_impact: i.typical_impact,
      confidence: 0.7,
      time_to_impact_days: 14,
      effort: i.effort
    }));
}
```

### API Endpoints

#### GET /api/customers/{id}/health-prediction
```json
{
  "customer_id": "uuid",
  "customer_name": "TechCorp Industries",
  "current_health": 68,
  "predictions": [
    {
      "days_ahead": 30,
      "predicted_score": 62,
      "confidence_interval": { "low": 55, "high": 69 },
      "key_factors": ["Usage declining", "No recent QBR"]
    },
    {
      "days_ahead": 60,
      "predicted_score": 55,
      "confidence_interval": { "low": 45, "high": 65 },
      "key_factors": ["Continued usage decline", "Renewal approaching"]
    },
    {
      "days_ahead": 90,
      "predicted_score": 50,
      "confidence_interval": { "low": 38, "high": 62 },
      "key_factors": ["Renewal pressure", "Engagement risk"]
    }
  ],
  "confidence": 0.78,
  "primary_drivers": [
    {
      "factor": "usage_decline",
      "direction": "negative",
      "magnitude": -8,
      "description": "Usage trending down 15% month-over-month"
    },
    {
      "factor": "no_recent_qbr",
      "direction": "negative",
      "magnitude": -4,
      "description": "120 days since last QBR"
    }
  ],
  "interventions": [
    {
      "intervention": "Schedule QBR",
      "expected_health_impact": 8,
      "confidence": 0.75,
      "time_to_impact_days": 21,
      "effort": "high"
    },
    {
      "intervention": "Usage Enablement Session",
      "expected_health_impact": 6,
      "confidence": 0.70,
      "time_to_impact_days": 14,
      "effort": "medium"
    }
  ],
  "accuracy_metrics": {
    "30_day_accuracy": 0.82,
    "60_day_accuracy": 0.74,
    "90_day_accuracy": 0.68
  },
  "predicted_at": "2026-01-29T10:00:00Z"
}
```

#### GET /api/portfolio/health-forecast
```json
{
  "portfolio_summary": {
    "current_avg_health": 68,
    "predicted_30d_avg": 65,
    "predicted_60d_avg": 62,
    "predicted_90d_avg": 60
  },
  "at_risk_forecast": {
    "current_below_50": 5,
    "predicted_30d_below_50": 8,
    "predicted_60d_below_50": 12,
    "predicted_90d_below_50": 15
  },
  "accounts_declining": [
    {
      "customer_id": "uuid",
      "customer_name": "TechCorp",
      "current": 68,
      "predicted_90d": 50,
      "decline": -18
    }
  ],
  "recommended_focus": [
    "8 accounts predicted to drop below 50 in 30 days",
    "Schedule QBRs for accounts with no engagement in 90+ days"
  ]
}
```

### Database Schema

```sql
CREATE TABLE health_predictions (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  current_health INTEGER,
  prediction_30d INTEGER,
  prediction_60d INTEGER,
  prediction_90d INTEGER,
  confidence DECIMAL(3,2),
  drivers JSONB,
  interventions JSONB,
  predicted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prediction_accuracy (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  prediction_date DATE,
  days_ahead INTEGER,
  predicted_score INTEGER,
  actual_score INTEGER,
  error INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_predictions_customer ON health_predictions(customer_id);
CREATE INDEX idx_accuracy_customer ON prediction_accuracy(customer_id);
```

## UI/UX Design

### Health Prediction Card
```
┌─────────────────────────────────────────────────────────┐
│ HEALTH FORECAST - TechCorp Industries                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ PREDICTED TRAJECTORY                                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │  100│                                               │ │
│ │   80│  ●─────────┐                                  │ │
│ │   60│             ─────●─────────●─────────●       │ │
│ │   40│               68    62       55       50     │ │
│ │   20│                                               │ │
│ │    0└─────────────────────────────────────────────  │ │
│ │      Now      30d       60d       90d              │ │
│ │                                                     │ │
│ │      ━━━ Predicted    ░░░ Confidence Interval      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ KEY DRIVERS                                             │
│ ───────────                                             │
│ ⬇️ Usage declining (-15% MoM)              -8 points   │
│ ⬇️ No QBR in 120 days                      -4 points   │
│                                                         │
│ RECOMMENDED INTERVENTIONS                               │
│ ─────────────────────────                               │
│ 📊 Schedule QBR                           +8 points    │
│    Effort: High | Impact in 21 days                     │
│    [Schedule Now]                                       │
│                                                         │
│ 🎓 Usage Enablement Session               +6 points    │
│    Effort: Medium | Impact in 14 days                   │
│    [Schedule Now]                                       │
│                                                         │
│ With both interventions: Predicted 90d score → 64      │
│                                                         │
│ Prediction Accuracy: 30d=82% | 60d=74% | 90d=68%       │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Health score history (existing)
- Usage metrics history
- Engagement tracking
- Event calendar (renewals, QBRs)

### Related PRDs
- PRD-216: Predictive Churn Scoring
- PRD-118: Health Score Change → Playbook Selection
- PRD-107: Health Score Threshold Alert

## Success Metrics

### Quantitative
- 30-day prediction accuracy > 80%
- 60-day prediction accuracy > 70%
- 90-day prediction accuracy > 65%
- Early warning: Predicted declines caught 30+ days in advance
- Intervention effectiveness: Health improved when recommended actions taken

### Qualitative
- CSMs trust predictions
- Interventions are actionable
- Predictions help prioritize work

## Rollout Plan

### Phase 1: Basic Prediction (Week 1-2)
- Trend extrapolation model
- 30-day predictions
- Basic visualization

### Phase 2: Enhanced Model (Week 3-4)
- Multi-factor model
- 60/90 day predictions
- Driver identification

### Phase 3: Interventions (Week 5-6)
- Intervention modeling
- Impact estimation
- Recommendation engine

### Phase 4: Accuracy Tracking (Week 7-8)
- Historical accuracy measurement
- Model tuning
- Portfolio forecasting

## Open Questions
1. How much historical data is needed for reliable predictions?
2. How do we handle new customers with limited history?
3. Should we use ML models or statistical methods?
4. How often should predictions be recalculated?
