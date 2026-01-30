# PRD-023: Benchmark Data Upload → Peer Comparison

## Metadata
- **PRD ID**: PRD-023
- **Category**: A - Documents & Data Processing
- **Priority**: P2
- **Estimated Complexity**: High
- **Dependencies**: Customer segmentation, industry data

## Scenario Description
A CSM uploads benchmark or industry data and the system compares their customers against peers, identifies over/under-performers, surfaces best practices from top performers, and creates actionable recommendations for customers lagging behind benchmarks.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload benchmark data and see how my customers compare,
**So that** I can have data-driven conversations about performance improvement.

## Trigger
CSM uploads benchmark data via Chat UI with a message like "Compare my customers against these benchmarks."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Customer segments | `customers.segment` | Implemented | Basic segmentation |
| Health scores | `customers.health_score` | Implemented | Individual scores |
| Usage metrics | `usage_metrics` | Implemented | Customer metrics |
| Industry field | `customers.industry` | Implemented | Industry classification |

### What's Missing
- [ ] Benchmark data storage
- [ ] Peer group definition
- [ ] Comparative analysis engine
- [ ] Percentile ranking
- [ ] Best practice extraction
- [ ] Benchmark gap analysis
- [ ] Industry comparison reports

## Detailed Workflow

### Step 1: Benchmark Upload
**User Action**: CSM uploads benchmark data
**System Response**:
- Accepts industry benchmarks or peer comparison data
- Identifies benchmark categories
- Validates against customer data structure
- Reports: "Loaded benchmarks for SaaS industry across 12 metrics"

### Step 2: Peer Group Definition
**User Action**: CSM confirms peer grouping
**System Response**:
- Groups customers by segment, industry, or size
- Matches to relevant benchmarks
- Shows peer group composition
- Allows custom grouping

### Step 3: Comparative Analysis
**User Action**: CSM requests comparison
**System Response**:
- Compares each customer to benchmarks
- Calculates percentile rankings
- Identifies gaps and outperformance
- Highlights best-in-class examples

### Step 4: Recommendations
**User Action**: CSM reviews results
**System Response**:
- Generates improvement recommendations
- Creates benchmark achievement plans
- Shares best practices from top performers
- Prepares customer-facing reports

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/benchmarks/dataLoader.ts` | Load benchmark data |
| `server/src/services/benchmarks/peerGrouper.ts` | Define peer groups |
| `server/src/services/benchmarks/comparator.ts` | Run comparisons |
| `components/Benchmarks/ComparisonDashboard.tsx` | Comparison view |
| `components/Benchmarks/PercentileChart.tsx` | Ranking visualization |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/benchmarks/upload` | POST | Upload benchmark data |
| `POST /api/benchmarks/peer-groups` | POST | Define peer groups |
| `GET /api/benchmarks/:customerId/compare` | GET | Customer comparison |
| `GET /api/benchmarks/leaders` | GET | Top performers |

### Benchmark Categories
| Category | Metrics |
|----------|---------|
| Engagement | DAU/MAU ratio, session length, feature adoption |
| Value | ROI, time-to-value, outcomes achieved |
| Satisfaction | NPS, CSAT, health score |
| Growth | Expansion rate, seat growth, feature adoption |
| Efficiency | Support tickets per user, self-service rate |

## Chat UI Flow
```
CSM: [Uploads saas_industry_benchmarks_2026.csv] Compare my customers against these benchmarks

System: 📊 Processing benchmark data...

**Benchmarks Loaded:**
- Source: SaaS Industry Report 2026
- Metrics: 12 KPIs across 5 categories
- Peer segments: Enterprise, Mid-Market, SMB
- Sample size: 500 companies

Matching to your customers...

---

**📈 Peer Comparison Analysis**

**Portfolio vs Benchmarks**

| Metric | Your Avg | Benchmark | Percentile | Status |
|--------|----------|-----------|------------|--------|
| DAU/MAU Ratio | 0.42 | 0.38 | 65th | ✅ Above |
| Feature Adoption | 62% | 58% | 60th | ✅ Above |
| NPS Score | +38 | +42 | 45th | ⚠️ Below |
| Time-to-Value | 45 days | 30 days | 35th | ⚠️ Below |
| Expansion Rate | 18% | 22% | 40th | ⚠️ Below |
| Support Tickets/User | 0.8 | 0.5 | 30th | 🔴 Below |

**Summary:** Above benchmark on engagement, below on satisfaction and growth

---

**🏆 Top Performers (Your Customers)**

**Above 90th Percentile:**

| Customer | Metric | Value | Percentile | Best Practice |
|----------|--------|-------|------------|---------------|
| TechCorp | Feature Adoption | 92% | 98th | Weekly training sessions |
| DataPro | DAU/MAU | 0.68 | 95th | Gamified daily challenges |
| CloudMax | NPS | +72 | 93rd | Proactive success calls |

---

**⚠️ Below Benchmark Customers**

**Below 25th Percentile:**

| Customer | Metric | Value | Benchmark | Gap |
|----------|--------|-------|-----------|-----|
| OldCorp | Feature Adoption | 28% | 58% | -30% |
| SmallBiz | NPS | -12 | +42 | -54 pts |
| LegacyCo | Time-to-Value | 90 days | 30 days | +60 days |
| StartupXYZ | DAU/MAU | 0.15 | 0.38 | -0.23 |

---

**📊 Peer Group: Enterprise Customers (>$100K ARR)**

| Customer | Overall Rank | Strengths | Gaps |
|----------|--------------|-----------|------|
| TechCorp | 92nd | Adoption, Engagement | None |
| CloudMax | 78th | NPS, Retention | Expansion |
| DataPro | 85th | Engagement | Time-to-Value |
| OldCorp | 23rd | None | Multiple gaps |

**Enterprise Benchmark Performance:**
- 3 of 4 above median
- 1 significantly below (OldCorp)

---

**📊 Peer Group: Mid-Market ($25K-$100K ARR)**

| Customer | Overall Rank | Strengths | Gaps |
|----------|--------------|-----------|------|
| Acme Corp | 55th | Balanced | Expansion |
| BetaInc | 62nd | Engagement | NPS |
| GrowthCo | 71st | Growth | Support efficiency |
| LegacyCo | 18th | None | Time-to-Value, Adoption |

---

**🎯 Best Practices from Top Performers**

**Feature Adoption (TechCorp - 98th percentile):**
> "We run weekly 30-minute training sessions for new features. Attendance is optional but we gamify it with completion badges."

**Key Success Factors:**
1. Regular, short training cadence
2. Gamification elements
3. Feature release communication
4. Admin champion program

**Recommendation:** Replicate for OldCorp, SmallBiz, StartupXYZ

---

**NPS (CloudMax - 93rd percentile):**
> "Our CSM does monthly proactive calls even when there are no issues. Customers feel cared for."

**Key Success Factors:**
1. Proactive outreach cadence
2. No-agenda check-ins
3. Quick issue resolution
4. Executive touchpoints quarterly

**Recommendation:** Implement for SmallBiz (NPS -12)

---

**📋 Improvement Recommendations**

**OldCorp - Multiple Gaps**

| Metric | Current | Target | Timeline | Action |
|--------|---------|--------|----------|--------|
| Adoption | 28% | 50% | 90 days | Training program |
| NPS | +8 | +30 | 60 days | Success call cadence |
| Engagement | 0.22 | 0.35 | 60 days | User reactivation |

**Benchmark Achievement Plan:**
1. Week 1-2: Diagnose root causes
2. Week 3-4: Implement training program (copy TechCorp)
3. Week 5-8: Proactive success calls (copy CloudMax)
4. Week 9-12: Measure and adjust

---

Would you like me to:
[Create Benchmark Reports per Customer] [Generate Best Practice Playbooks] [Schedule Benchmark Review Calls] [Export Full Analysis]

CSM: Create benchmark report for Acme Corp to share with them

System: 📄 Generating Customer Benchmark Report...

---

# Performance Benchmark Report
## Acme Corp vs Industry Peers

**Prepared by:** [Your Name], Customer Success Manager
**Date:** January 29, 2026
**Peer Group:** Mid-Market SaaS ($25K-$100K ARR)

---

### Executive Summary

Acme Corp performs at the **55th percentile** overall compared to industry peers. You excel in engagement metrics and have opportunities to improve in expansion and support efficiency.

---

### Your Performance vs Benchmarks

| Metric | Your Score | Industry Median | Your Percentile |
|--------|------------|-----------------|-----------------|
| Daily Active Users | 42% | 38% | 60th ✅ |
| Feature Adoption | 65% | 58% | 62nd ✅ |
| NPS Score | +38 | +42 | 48th ➡️ |
| Time-to-Value | 42 days | 30 days | 40th ⚠️ |
| Expansion Rate | 15% | 22% | 35th ⚠️ |
| Support Efficiency | 0.7/user | 0.5/user | 38th ⚠️ |

---

### Where You Excel

**User Engagement (60th-65th percentile)**
Your team has strong daily engagement habits. This indicates good product fit and user satisfaction with core workflows.

**Best Practice:** Your admin team's weekly sync has driven consistent usage.

---

### Opportunities for Improvement

**1. Time-to-Value (40th percentile)**
Your onboarding took 42 days vs 30-day benchmark. Faster time-to-value correlates with higher retention.

**Recommendation:** Consider our accelerated onboarding track for new users.

**2. Expansion (35th percentile)**
Growth rate of 15% vs 22% benchmark. Top performers leverage advanced features to drive expansion.

**Recommendation:** Let's review Advanced Analytics and API features - underutilized but high-value.

---

### Peer Comparison

Compared to similar companies in your industry:

```
                    Your Position
                         ↓
Peer A    ████████████████████████████ 78th
Peer B    █████████████████████████ 71st
You       ██████████████████████ 55th
Peer C    █████████████████ 42nd
Peer D    ██████████ 25th
```

---

### Recommended Next Steps

1. **Feature Deep Dive** - Review underutilized features
2. **Onboarding Optimization** - Streamline for new team members
3. **Quarterly Benchmark Review** - Track progress together

---

*This report is based on anonymized industry data from 500 peer companies.*

---

[Download PDF] [Email to Customer] [Schedule Review Call]

Report saved and ready to share!
```

## Acceptance Criteria
- [ ] Supports benchmark data in CSV/Excel format
- [ ] Correctly maps benchmarks to customer metrics
- [ ] Calculates percentile rankings accurately
- [ ] Groups customers into meaningful peer cohorts
- [ ] Identifies best practices from top performers
- [ ] Generates actionable improvement recommendations
- [ ] Creates customer-facing benchmark reports
- [ ] Tracks benchmark performance over time
- [ ] Highlights both strengths and gaps
- [ ] Processing completes within 1 minute for typical dataset

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-023-COMPLETE</promise>
```

### Success Metrics
- Customers receiving benchmark reports engage > 80%
- Below-benchmark customers improve > 40% within 6 months
- Benchmark conversations lead to expansion > 20%
