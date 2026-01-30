# PRD-022: Historical Data Upload → Trend Analysis

## Metadata
- **PRD ID**: PRD-022
- **Category**: A - Documents & Data Processing
- **Priority**: P2
- **Estimated Complexity**: High
- **Dependencies**: Time-series analysis, health score history

## Scenario Description
A CSM uploads historical data spanning multiple periods (quarters, years) and the system performs trend analysis to identify long-term patterns, seasonal variations, growth/decline trajectories, and predict future states based on historical behavior.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload historical data and receive trend analysis,
**So that** I can understand long-term patterns and predict future customer behavior.

## Trigger
CSM uploads historical data via Chat UI with a message like "Analyze trends from this historical data."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Health score history | `health_score_history` | Implemented | Tracks over time |
| Usage trends | `usage_metrics.usage_trend` | Implemented | Basic trend direction |
| QBR history | `qbrs` table | Implemented | Quarterly records |
| Renewal pipeline | `renewal_pipeline` | Implemented | Has historical data |

### What's Missing
- [ ] Multi-year data analysis
- [ ] Seasonal pattern detection
- [ ] Growth trajectory modeling
- [ ] Predictive forecasting
- [ ] Cohort analysis over time
- [ ] Trend visualization
- [ ] Anomaly detection in historical data

## Detailed Workflow

### Step 1: Historical Data Upload
**User Action**: CSM uploads multi-period historical data
**System Response**:
- Accepts data with timestamps spanning extended periods
- Validates temporal coverage and continuity
- Normalizes data to consistent time intervals
- Reports: "Received 3 years of data (Jan 2023 - Jan 2026) for 45 customers"

### Step 2: Trend Identification
**User Action**: System processes automatically
**System Response**:
- Identifies overall trend direction (growth, decline, stable)
- Detects seasonal patterns (quarterly, annual)
- Calculates growth rates and velocities
- Segments customers by trend type

### Step 3: Pattern Analysis
**User Action**: CSM requests analysis
**System Response**:
- Shows trend visualizations
- Highlights significant inflection points
- Identifies leading/lagging indicators
- Detects anomalies from expected patterns

### Step 4: Predictions & Planning
**User Action**: CSM reviews forecasts
**System Response**:
- Projects future values based on trends
- Identifies at-risk accounts based on trajectory
- Recommends interventions for declining trends
- Suggests optimization for growing accounts

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/analysis/trendAnalyzer.ts` | Trend detection |
| `server/src/services/analysis/seasonalDetector.ts` | Seasonal patterns |
| `server/src/services/analysis/forecaster.ts` | Predictive modeling |
| `components/Analysis/TrendChart.tsx` | Trend visualization |
| `components/Analysis/ForecastView.tsx` | Prediction display |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/analysis/historical/upload` | POST | Upload historical data |
| `GET /api/analysis/trends` | GET | Trend analysis results |
| `GET /api/analysis/forecast/:customerId` | GET | Future predictions |
| `GET /api/analysis/cohorts` | GET | Cohort trend analysis |

### Trend Metrics
| Metric | Description |
|--------|-------------|
| CAGR | Compound Annual Growth Rate |
| Trend Direction | Up, down, stable |
| Velocity | Rate of change |
| Seasonality Index | Seasonal variation strength |
| Inflection Points | Significant trend changes |
| Forecast Accuracy | Historical prediction accuracy |

## Chat UI Flow
```
CSM: [Uploads customer_metrics_2023_2026.xlsx] Analyze trends from this historical data

System: 📊 Processing historical data...

**Data Overview:**
- Time Range: January 2023 - January 2026 (3 years)
- Customers: 45
- Data Points: 162 monthly snapshots per customer
- Metrics: ARR, Usage, Health Score, NPS

Analyzing trends...

---

**📈 Historical Trend Analysis Complete**

**Portfolio Overview (3-Year Trends)**

| Metric | Jan 2023 | Jan 2026 | CAGR | Trend |
|--------|----------|----------|------|-------|
| Total ARR | $2.1M | $4.2M | +26% | ⬆️ Strong |
| Avg Health | 68 | 72 | +2%/yr | ⬆️ Moderate |
| Avg NPS | +28 | +38 | +3/yr | ⬆️ Moderate |
| Customer Count | 38 | 45 | +6%/yr | ⬆️ Stable |

---

**📊 Customer Trend Segmentation**

| Segment | Customers | % of ARR | Trend |
|---------|-----------|----------|-------|
| 🚀 High Growth | 12 | 35% | CAGR > 30% |
| 📈 Steady Growth | 18 | 40% | CAGR 10-30% |
| ➡️ Stable | 8 | 15% | CAGR ±10% |
| 📉 Declining | 5 | 8% | CAGR < -10% |
| 🔴 At Risk | 2 | 2% | Accelerating decline |

---

**🚀 High Growth Customers (Top Performers)**

| Customer | 2023 ARR | 2026 ARR | CAGR | Growth Driver |
|----------|----------|----------|------|---------------|
| TechCorp | $25K | $200K | +100% | Product expansion |
| DataPro | $30K | $150K | +71% | Seat growth |
| CloudMax | $50K | $180K | +53% | Feature upsells |

**Pattern:** High growth correlates with:
- Executive sponsor engagement
- Multiple product lines adopted
- High NPS trajectory

---

**📉 Declining Customers (Intervention Needed)**

| Customer | 2023 ARR | 2026 ARR | CAGR | Decline Driver |
|----------|----------|----------|------|----------------|
| OldCorp | $85K | $65K | -9% | Champion left 2024 |
| LegacyCo | $60K | $42K | -11% | Usage declining |

**Pattern:** Decline correlates with:
- Champion departure
- No executive engagement
- Static usage (no new features)

---

**🔄 Seasonal Patterns Detected**

```
          Q1    Q2    Q3    Q4
Usage:    ▃▅    ▆▇    ▅▆    ▃▄
          ↑             ↓
     Post-planning  EOY slowdown

NPS:      ▅▆    ▆▇    ▆▇    ▄▅
               ↑           ↓
          Post-QBR   Pre-renewal stress
```

**Insights:**
- Q2-Q3 are peak usage periods
- Q4 shows seasonal dip (EOY, holidays)
- NPS peaks after successful QBRs
- NPS dips before renewals (anxiety)

---

**🔮 Predictions (Next 12 Months)**

**Portfolio Forecast:**
| Metric | Current | Predicted EOY 2026 | Confidence |
|--------|---------|-------------------|------------|
| Total ARR | $4.2M | $4.9M (+17%) | High (82%) |
| Avg Health | 72 | 74 | Medium (68%) |
| At-Risk ARR | $180K | $95K | Medium (65%) |

**Customer-Level Predictions:**

| Customer | Current | Predicted | Confidence | Action |
|----------|---------|-----------|------------|--------|
| TechCorp | $200K | $280K | High | Expansion play |
| DataPro | $150K | $190K | High | Upsell ready |
| OldCorp | $65K | $52K | High | Save play needed |
| LegacyCo | $42K | $35K | Medium | At-risk intervention |

---

**⏱️ Inflection Point Analysis**

**Significant Trend Changes Detected:**

1. **TechCorp - Oct 2024** ⬆️
   - Health jumped 65 → 82
   - Cause: New VP became champion
   - Effect: Accelerated expansion

2. **OldCorp - Mar 2024** ⬇️
   - Health dropped 78 → 58
   - Cause: Champion (Sarah) left company
   - Effect: Declining engagement, no replacement

3. **Portfolio - Q2 2024** ⬆️
   - Avg health +5 points
   - Cause: New onboarding program launched
   - Effect: Better time-to-value

---

**💡 Strategic Recommendations**

**Based on 3-Year Trends:**

1. **Champion Succession Planning**
   - OldCorp decline shows champion risk
   - Implement multi-threading for all accounts >$50K
   - Early warning: Monitor for job change signals

2. **Seasonal Playbook**
   - Schedule strategic conversations in Q2-Q3
   - Plan re-engagement for Q4 dip
   - Post-QBR NPS capture timing

3. **Growth Acceleration**
   - TechCorp pattern: Exec engagement → expansion
   - Replicate across stable accounts
   - Target: Move 5 stable accounts to growth

4. **At-Risk Intervention**
   - OldCorp and LegacyCo need immediate attention
   - Pattern: 6+ months of decline before churn
   - Window: ~6 months to intervene

Would you like me to:
[Generate Forecast Report] [Create Intervention Plans] [Segment Playbooks] [Export Analysis]

CSM: Generate forecast report and create intervention plan for OldCorp

System: ✅ Actions Complete!

**📊 Portfolio Forecast Report Generated:**

# 2026 Portfolio Forecast
## Based on 3-Year Trend Analysis

### Executive Summary
Portfolio on track for 17% ARR growth ($4.2M → $4.9M) with strong performance from growth segment offsetting at-risk accounts.

### Key Predictions
[Detailed forecast by segment and customer...]

### Recommended Actions
[Strategic initiatives based on trends...]

---

**📋 Intervention Plan: OldCorp**

**Current State:**
- ARR: $65K (down from $85K peak)
- Health: 52/100
- Trend: Declining (-9% CAGR)
- Forecast: $52K by EOY without intervention

**Root Cause:**
Champion (Sarah Chen) left in March 2024. No replacement identified. Engagement dropped 60% post-departure.

**Intervention Plan:**

**Week 1: Assessment**
- [ ] Map current stakeholders
- [ ] Identify potential new champion
- [ ] Assess remaining value perception

**Week 2-3: Re-engagement**
- [ ] Schedule executive alignment call
- [ ] Present value recap and ROI
- [ ] Introduce new features since 2024

**Week 4-6: Rebuilding**
- [ ] Onboard new champion
- [ ] Create success plan
- [ ] Establish regular cadence

**Success Metrics:**
- New champion identified by Feb 15
- Health score >60 by March 31
- Stabilize at $60K ARR minimum

---

Report saved to: /Shared/Forecasts/2026_Portfolio_Forecast.pdf
Plan saved to: CSCX - OldCorp/05 - Reports/Intervention_Plan_2026.pdf
```

## Acceptance Criteria
- [ ] Supports data spanning multiple years
- [ ] Correctly identifies trend direction and magnitude
- [ ] Detects seasonal patterns with confidence scoring
- [ ] Calculates growth rates (CAGR, velocity)
- [ ] Identifies significant inflection points
- [ ] Segments customers by trend type
- [ ] Generates future predictions with confidence levels
- [ ] Correlates trends with known events
- [ ] Visualizes trends clearly over time
- [ ] Processing completes within 3 minutes for 5-year dataset

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-022-COMPLETE</promise>
```

### Success Metrics
- Forecast accuracy > 70% at 6-month horizon
- Declining trends identified > 60 days before critical
- Seasonal planning improves engagement metrics > 10%
