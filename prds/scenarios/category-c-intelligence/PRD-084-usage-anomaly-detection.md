# PRD-084: Usage Anomaly Detection

## Metadata
- **PRD ID**: PRD-084
- **Category**: C - Account Intelligence
- **Priority**: P1
- **Estimated Complexity**: High
- **Dependencies**: PRD-086 (Usage Drop Alert), PRD-195 (Pendo Usage Data)

## Scenario Description
The system should automatically detect unusual patterns in customer usage data that may indicate problems or opportunities. This includes sudden drops, unexpected spikes, seasonal deviations, and feature abandonment patterns.

## User Story
**As a** CSM,
**I want to** be automatically alerted to unusual usage patterns,
**So that** I can proactively address issues before they escalate.

## Trigger
- Automated detection runs daily on usage data
- CSM asks: "Are there any usage anomalies for [customer]?"
- System flags anomaly in customer health dashboard

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Usage metrics | `usage_metrics` table | Implemented | Stores usage data |
| Health score | `health_score_history` table | Implemented | Includes usage component |
| Trigger engine | `server/src/services/triggers/` | Implemented | Can execute on conditions |
| Risk signals | `risk_signals` table | Implemented | Can store anomaly alerts |

### What's Missing
- [ ] Statistical anomaly detection algorithms
- [ ] Baseline calculation per customer
- [ ] Seasonal adjustment logic
- [ ] Anomaly classification (drop, spike, pattern change)
- [ ] False positive filtering
- [ ] Anomaly severity scoring

## Detailed Workflow

### Step 1: Baseline Calculation
- Calculate rolling averages for each customer
- Establish normal variance ranges
- Account for seasonal patterns

### Step 2: Anomaly Detection
- Compare current usage to baseline
- Apply statistical tests (z-score, IQR)
- Flag values outside normal range

### Step 3: Classification
- Categorize anomaly type (drop, spike, pattern)
- Assess severity based on magnitude and duration
- Filter false positives using historical patterns

### Step 4: Alert Generation
- Create risk signal for significant anomalies
- Notify CSM through preferred channels
- Log for trend analysis

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/analytics/anomalyDetection.ts` | Create | Anomaly detection service |
| `server/src/jobs/anomalyScanner.ts` | Create | Scheduled anomaly scanning job |
| `components/CustomerDetail/UsageAnomalies.tsx` | Create | Anomaly display UI |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/customers/:id/usage/anomalies` | GET | Get detected anomalies |
| `POST /api/analytics/anomalies/scan` | POST | Trigger anomaly scan |
| `PUT /api/analytics/anomalies/:id/dismiss` | PUT | Dismiss false positive |

### Database Changes
```sql
CREATE TABLE usage_anomalies (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  metric_type VARCHAR(50),
  anomaly_type VARCHAR(50),
  severity VARCHAR(20),
  baseline_value DECIMAL,
  actual_value DECIMAL,
  deviation_percent DECIMAL,
  detected_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID
);
```

## Chat UI Flow
```
CSM: Are there any usage anomalies for my accounts?
System: Scanning usage patterns across your portfolio...

**Anomalies Detected: 3 accounts**

1. **DataFlow Systems** 🔴 Critical
   - Anomaly: 67% drop in API calls
   - Duration: 5 days
   - Baseline: 45,000/day → Actual: 15,000/day
   - Possible Cause: Integration issue or migration
   [Investigate] [Contact Customer]

2. **CloudFirst Inc** 🟡 Warning
   - Anomaly: Feature abandonment detected
   - Reports module: -80% usage
   - Started: 2 weeks ago
   - Possible Cause: Training gap or competing tool
   [Schedule Training] [Investigate]

3. **Nexus Corp** 🟢 Positive
   - Anomaly: 150% increase in user logins
   - Duration: 10 days
   - Possible Cause: Team expansion or new use case
   [Explore Expansion] [Send Congratulations]

[View All Anomalies] [Adjust Sensitivity] [Export Report]
```

## Acceptance Criteria
- [ ] Detect usage drops exceeding configurable threshold
- [ ] Detect usage spikes (potential expansion signals)
- [ ] Identify feature abandonment patterns
- [ ] Account for seasonal variations
- [ ] Severity classification (critical, warning, info)
- [ ] False positive dismissal capability
- [ ] Daily automated scanning for all accounts
- [ ] CSM notification for critical anomalies

## Ralph Loop Notes
- **Learning**: Track which anomalies led to churn vs. expansion
- **Optimization**: Tune thresholds based on false positive rates
- **Personalization**: Learn customer-specific usage patterns

### Completion Signal
```
<promise>PRD-084-COMPLETE</promise>
```
