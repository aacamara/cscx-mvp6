# PRD-170: Trend Analysis Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-170 |
| Title | Trend Analysis Report |
| Category | F - Reporting & Analytics |
| Priority | P1 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a comprehensive trend analysis report that tracks key metrics over time, identifies patterns, and provides predictive insights. This enables proactive decision-making based on directional changes in portfolio health.

---

## 2. Problem Statement

### Current Pain Points
- No systematic tracking of metric trends
- Difficult to identify emerging patterns early
- Cannot predict future performance from historical data
- Missing alerts on concerning trend changes
- Lack of context for current performance

### Impact
- Reactive response to declining metrics
- Missed early warning signals
- Inability to forecast outcomes
- Poor strategic planning

---

## 3. Solution Overview

### High-Level Approach
Build a trend analysis engine that tracks historical data, identifies patterns, generates forecasts, and alerts on significant changes.

### Key Features
1. **Historical Tracking** - Long-term metric history
2. **Pattern Detection** - Identify trends and cycles
3. **Forecasting** - Predict future values
4. **Anomaly Detection** - Flag unusual changes
5. **Comparison** - Period-over-period analysis
6. **Visualization** - Trend charts and projections

---

## 4. User Stories

```
As a VP of CS,
I want to see trends across key metrics
So that I can anticipate and plan for changes
```

```
As a CSM Manager,
I want to identify concerning trends early
So that I can intervene proactively
```

```
As a CS Ops Lead,
I want to forecast future performance
So that I can set realistic targets
```

---

## 5. Functional Requirements

### 5.1 Metric Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-170.1 | Track health score trends | P0 |
| FR-170.2 | Track retention trends | P0 |
| FR-170.3 | Track revenue trends | P0 |
| FR-170.4 | Track engagement trends | P1 |
| FR-170.5 | Track adoption trends | P1 |
| FR-170.6 | Custom metric trending | P2 |

### 5.2 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-170.7 | Calculate period-over-period change | P0 |
| FR-170.8 | Identify trend direction | P0 |
| FR-170.9 | Detect seasonality | P2 |
| FR-170.10 | Forecast future values | P1 |
| FR-170.11 | Alert on significant changes | P0 |

### 5.3 Visualization

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-170.12 | Time series charts | P0 |
| FR-170.13 | Trend lines with forecasts | P1 |
| FR-170.14 | Comparison overlays | P1 |
| FR-170.15 | Anomaly highlighting | P1 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface TrendData {
  metric: string;
  granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly';

  data_points: {
    period: string;
    value: number;
    previous_value?: number;
    change: number;
    change_pct: number;
  }[];

  trend: {
    direction: 'up' | 'down' | 'stable';
    strength: 'strong' | 'moderate' | 'weak';
    slope: number;
  };

  forecast?: {
    next_period: number;
    confidence_low: number;
    confidence_high: number;
  };

  anomalies: {
    period: string;
    expected: number;
    actual: number;
    deviation: number;
  }[];
}

interface TrendAnalysis {
  period_start: string;
  period_end: string;

  metrics: TrendData[];

  insights: {
    type: 'improvement' | 'decline' | 'anomaly' | 'forecast';
    metric: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
  }[];
}
```

### 6.2 API Endpoints

```typescript
// Get trend analysis
GET /api/reports/trend-analysis
Query: {
  metrics: string[];
  period_start: string;
  period_end: string;
  granularity: string;
  include_forecast?: boolean;
}

Response: {
  analysis: TrendAnalysis;
  charts: ChartData[];
  alerts: TrendAlert[];
}

// Get single metric trend
GET /api/reports/trend-analysis/:metric
Query: { periods: number; granularity: string }
```

---

## 7. User Interface

### 7.1 Trend Dashboard

```
+----------------------------------------------------------+
|  Trend Analysis                          [12 Months v]    |
+----------------------------------------------------------+
|                                                           |
|  KEY METRIC TRENDS                                        |
|  +----------------+----------------+----------------+     |
|  | Health Score   | Retention      | NRR            |     |
|  |   72 → 76     |   93% → 95%   |  106% → 112%   |     |
|  |   ↑ +5.6%     |   ↑ +2.2%     |   ↑ +5.7%      |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  HEALTH SCORE TREND                                       |
|  +--------------------------------------------------+    |
|  | 80|                              ____  Forecast   |    |
|  | 75|                    _________/     ----        |    |
|  | 70|___________________/                           |    |
|  | 65|                                               |    |
|  |   +------------------------------------------>   |    |
|  |    J F M A M J J A S O N D J F M                 |    |
|  +--------------------------------------------------+    |
|  Trend: ↑ Improving (+0.5/month) | Forecast: 78 by Q2     |
|                                                           |
|  TREND ALERTS                                             |
|  +--------------------------------------------------+    |
|  | ↑ NRR improved 6% - strongest growth in 4 qtrs   |    |
|  | → Engagement stable - consider new initiatives    |    |
|  | ⚠ Onboarding time increasing - investigate       |    |
|  +--------------------------------------------------+    |
|                                                           |
|  PERIOD COMPARISON                                        |
|  +------------------------------------------------------+|
|  | Metric          | Last Qtr | This Qtr | Change       ||
|  |-----------------|----------|----------|--------------|
|  | Avg Health      | 72       | 76       | +5.6%        ||
|  | Retention       | 93%      | 95%      | +2.2%        ||
|  | Expansion Rate  | 18%      | 22%      | +22%         ||
|  | Churn Rate      | 4.2%     | 3.1%     | -26%         ||
|  +------------------------------------------------------+|
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Natural Language Queries

```
"Show me health score trends"
"What's the trend for retention over the past year?"
"Are there any concerning trends?"
"Forecast next quarter's NRR"
"Compare this quarter to last quarter"
```

---

## 9. Acceptance Criteria

- [ ] Historical data displays accurately
- [ ] Trend direction calculates correctly
- [ ] Forecasts generate with confidence intervals
- [ ] Anomalies are detected and highlighted
- [ ] Period comparisons are accurate

---

## 10. Test Cases

### TC-170.1: Trend Detection
```
Given: Health scores [70, 72, 73, 75, 76] over 5 months
When: Trend is analyzed
Then: Direction = Up, Strength = Moderate
And: Slope ≈ +1.2/month
```

### TC-170.2: Anomaly Detection
```
Given: Typical value 75, actual value 60
When: Anomaly detection runs
Then: Deviation flagged as significant
And: Alert generated
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Forecast accuracy | > 85% | Predicted vs actual |
| Early detection | 2+ weeks | Lead time on issues |
| Alert relevance | > 90% | Actionable alerts |

---

## 12. Dependencies

- Historical metric data
- PRD-153: Health Score Portfolio View
- PRD-158: Revenue Analytics Report
- PRD-174: Net Revenue Retention Report

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Trend models, UI |
| Backend | 2 weeks | Calculations, forecasting |
| Frontend | 1 week | Charts, visualizations |
| Testing | 1 week | Accuracy validation |
| **Total** | **5 weeks** | |

---

## 14. Open Questions

1. How far back should we store historical data?
2. What statistical methods for forecasting?
3. What threshold defines a "significant" change?
4. Should we support custom metric definitions?
