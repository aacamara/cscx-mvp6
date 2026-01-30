# PRD-006: Usage Data Upload → Adoption Scoring

## Metadata
- **PRD ID**: PRD-006
- **Category**: A - Documents & Data Processing
- **Priority**: P0
- **Estimated Complexity**: Medium
- **Dependencies**: Usage metrics engine, health score calculation

## Scenario Description
A CSM uploads product usage data exported from their analytics platform (Pendo, Amplitude, Mixpanel) or internal system. The system processes the data to calculate adoption scores per customer, identifying power users, underutilized features, and accounts at risk due to low engagement.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload usage data and receive adoption scores with actionable insights,
**So that** I can identify accounts needing adoption support and features to promote.

## Trigger
CSM uploads a CSV/Excel of usage data via Chat UI with a message like "Calculate adoption scores from this usage data."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Usage data ingestion | `/api/v1/usage` endpoint | Implemented | Real-time event ingestion |
| Usage metrics table | `usage_metrics` | Implemented | DAU, WAU, MAU, feature_adoption |
| Adoption score calculation | In health score | Partial | Basic adoption metric |
| Usage events table | `usage_events` | Implemented | Stores raw events |
| Usage tracker script | Apps Script | Implemented | Tracks and trends usage |

### What's Missing
- [ ] Bulk usage data upload (file-based)
- [ ] Multi-format analytics platform parsing (Pendo, Amplitude, Mixpanel)
- [ ] Feature-level adoption breakdown
- [ ] User-level engagement analysis
- [ ] Adoption benchmarking across portfolio
- [ ] Adoption improvement recommendations

## Detailed Workflow

### Step 1: File Upload
**User Action**: CSM uploads usage export file
**System Response**:
- Validates file format
- Detects analytics platform format
- Maps columns: customer, user, feature/event, timestamp, duration
- Reports: "Found 45,000 usage events for 67 customers over 90 days"

### Step 2: Data Processing
**User Action**: CSM confirms column mappings
**System Response**:
- Aggregates events by customer and feature
- Calculates user engagement metrics
- Identifies feature adoption patterns
- Computes adoption scores (0-100)

### Step 3: Adoption Analysis
**User Action**: CSM reviews analysis
**System Response**:
- Displays adoption scores by customer
- Shows feature adoption heatmap
- Identifies underutilized features per customer
- Highlights adoption leaders and laggards
- Compares to portfolio benchmarks

### Step 4: Action Recommendations
**User Action**: CSM requests recommendations
**System Response**:
- Suggests training for low-adoption accounts
- Identifies features to promote per customer
- Creates adoption improvement tasks
- Drafts outreach for adoption campaigns

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/usage/bulkUploader.ts` | Process bulk usage file uploads |
| `server/src/services/usage/platformParsers.ts` | Parse Pendo, Amplitude, Mixpanel formats |
| `server/src/services/analysis/adoptionScoring.ts` | Calculate adoption scores |
| `components/Adoption/AdoptionDashboard.tsx` | Adoption analysis visualization |
| `components/Adoption/FeatureHeatmap.tsx` | Feature adoption heatmap |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/usage/upload` | POST | Upload usage data file |
| `POST /api/usage/process` | POST | Process and calculate metrics |
| `GET /api/adoption/scores` | GET | Retrieve adoption scores |
| `GET /api/adoption/features/:customerId` | GET | Feature breakdown per customer |

### Adoption Score Components
| Component | Weight | Description |
|-----------|--------|-------------|
| Breadth | 30% | % of available features used |
| Depth | 30% | Frequency of feature usage |
| Recency | 20% | Time since last engagement |
| Stickiness | 20% | DAU/MAU ratio |

## Chat UI Flow
```
CSM: [Uploads pendo_usage_export.csv] Calculate adoption scores from this data

System: 📊 Processing usage data...

Detected format: Pendo Export
Found: 45,678 usage events
Customers: 67
Date range: November 1, 2025 - January 29, 2026
Features tracked: 24

Processing metrics...

---

**📈 Adoption Score Analysis Complete**

**Portfolio Overview**
- Average Adoption Score: 62/100
- Highest: TechCorp (89/100)
- Lowest: StartupABC (23/100)

---

**🏆 Adoption Leaders**

| Customer | Score | Active Users | Features Used | Trend |
|----------|-------|--------------|---------------|-------|
| TechCorp | 89 | 145/150 (97%) | 22/24 (92%) | ⬆️ +5 |
| DataPro | 84 | 78/80 (98%) | 20/24 (83%) | ➡️ Stable |
| CloudMax | 81 | 56/60 (93%) | 21/24 (88%) | ⬆️ +3 |

---

**⚠️ Adoption Laggards (Need Attention)**

| Customer | Score | Active Users | Features Used | Trend |
|----------|-------|--------------|---------------|-------|
| **StartupABC** | 23 | 5/40 (13%) | 4/24 (17%) | ⬇️ -8 |
| **OldCorp** | 31 | 12/55 (22%) | 6/24 (25%) | ⬇️ -5 |
| **SmallBiz** | 38 | 8/25 (32%) | 8/24 (33%) | ➡️ Stable |

---

**🎯 Feature Adoption Heatmap**

```
Feature              | High | Med | Low |
---------------------|------|-----|-----|
Dashboard            | ████ |     |     | 95%
Reports              | ███  |     |     | 78%
Integrations         | ██   |     |     | 56%
Advanced Analytics   | █    |     |     | 34%
Custom Workflows     |      | █   |     | 21%
API Access           |      |     | █   | 12%
```

---

**📢 Key Insights**

1. **API Access underutilized** - Only 12% adoption but high correlation with retention
2. **StartupABC at risk** - 87% of users inactive in past 30 days
3. **Advanced Analytics gap** - Enterprise customers using at 65%, SMB at 18%

---

**💡 Recommended Actions**

For **StartupABC** (Score: 23):
1. Schedule emergency adoption call
2. Assign dedicated onboarding specialist
3. Create customized training program

For **OldCorp** (Score: 31):
1. Executive business review to realign on value
2. Identify new champion (current champion inactive)
3. Feature roadshow for unused capabilities

Would you like me to:
[Update Customer Health Scores] [Create Adoption Tasks] [Draft Outreach Emails] [Export Full Report]

CSM: Update health scores and create tasks for the 3 laggards

System: ✅ Updates Complete!

**Health Scores Updated:**
- StartupABC: 58 → 42 (adoption factor weighted heavily)
- OldCorp: 65 → 51
- SmallBiz: 61 → 54

**Tasks Created:**

📋 **StartupABC - Adoption Emergency**
- [ ] Schedule adoption review call by Feb 5
- [ ] Prepare training materials for underused features
- [ ] Identify new power users for champion program

📋 **OldCorp - Re-engagement Campaign**
- [ ] Schedule executive check-in by Feb 7
- [ ] Research champion status (last active 45 days ago)
- [ ] Prepare feature demo for Advanced Analytics

📋 **SmallBiz - Proactive Support**
- [ ] Send "Tips & Tricks" guide for unused features
- [ ] Offer complimentary training session
- [ ] Set 30-day adoption checkpoint

All tasks assigned to you and visible in your task list.
```

## Acceptance Criteria
- [ ] Supports Pendo, Amplitude, Mixpanel, and generic CSV usage exports
- [ ] Correctly maps events to customers and features
- [ ] Adoption score calculation is consistent and explainable
- [ ] Feature adoption heatmap displays clearly across 20+ features
- [ ] Portfolio benchmarking compares customers accurately
- [ ] Underutilized features are identified per customer
- [ ] Health score integration properly weights adoption
- [ ] Recommendations are specific and actionable
- [ ] Processing completes within 2 minutes for 100K events
- [ ] Historical adoption trends can be compared over time

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-006-COMPLETE</promise>
```

### Success Metrics
- Adoption score correlation with retention > 0.7
- Laggards receiving intervention within 48 hours
- Feature adoption campaigns increase usage by > 15%
