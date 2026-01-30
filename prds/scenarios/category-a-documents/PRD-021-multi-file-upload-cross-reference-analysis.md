# PRD-021: Multi-File Upload → Cross-Reference Analysis

## Metadata
- **PRD ID**: PRD-021
- **Category**: A - Documents & Data Processing
- **Priority**: P1
- **Estimated Complexity**: Very High
- **Dependencies**: All document processing services, AI analysis

## Scenario Description
A CSM uploads multiple related files (usage data, support tickets, NPS results, meeting notes) and the system cross-references them to identify correlations, build a comprehensive customer view, detect hidden patterns, and generate holistic insights that wouldn't be visible from any single data source.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload multiple data files and have them cross-referenced,
**So that** I can discover patterns and correlations I would miss analyzing each file separately.

## Trigger
CSM uploads multiple files via Chat UI with a message like "Analyze these files together and find correlations."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Individual file analysis | Various PRDs | Partial | Separate analyses only |
| Customer 360 view | CustomerDetail | Partial | Static display |
| AI analysis | Claude/Gemini | Implemented | Can correlate if prompted |
| Customer data | Multiple tables | Implemented | Siloed by type |

### What's Missing
- [ ] Multi-file upload handling
- [ ] Cross-source correlation engine
- [ ] Unified timeline builder
- [ ] Pattern detection across data types
- [ ] Holistic insight generation
- [ ] Correlation visualization
- [ ] Multi-dimensional risk scoring

## Detailed Workflow

### Step 1: Multi-File Upload
**User Action**: CSM uploads multiple files simultaneously
**System Response**:
- Accepts batch of files (CSV, Excel, PDF, text)
- Identifies file types and content
- Associates all with same customer
- Reports: "Received 5 files: usage data, support tickets, NPS survey, meeting notes, invoice history"

### Step 2: Individual Processing
**User Action**: System processes automatically
**System Response**:
- Parses each file according to its type
- Extracts key metrics and events
- Normalizes data to common timeline
- Creates unified customer dataset

### Step 3: Cross-Reference Analysis
**User Action**: CSM requests correlation analysis
**System Response**:
- Analyzes correlations across datasets
- Builds event timeline with all sources
- Identifies patterns (e.g., usage drop → tickets → NPS decline)
- Discovers hidden insights

### Step 4: Holistic Insights
**User Action**: CSM reviews comprehensive analysis
**System Response**:
- Presents unified customer health view
- Shows correlation map
- Recommends actions based on multi-signal analysis
- Generates comprehensive report

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/analysis/multiFileProcessor.ts` | Handle multiple files |
| `server/src/services/analysis/crossReferenceEngine.ts` | Correlation analysis |
| `server/src/services/analysis/timelineBuilder.ts` | Unified timeline |
| `components/Analysis/CorrelationMap.tsx` | Visualization |
| `components/Analysis/UnifiedTimeline.tsx` | Timeline view |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/analysis/multi-upload` | POST | Upload multiple files |
| `POST /api/analysis/cross-reference` | POST | Run correlation analysis |
| `GET /api/analysis/:customerId/timeline` | GET | Unified timeline |
| `GET /api/analysis/:customerId/correlations` | GET | Correlation insights |

### Correlation Types
| Correlation | Description |
|-------------|-------------|
| Temporal | Events occurring in sequence |
| Causal | One event leading to another |
| Inverse | Negative correlation |
| Clustering | Events occurring together |
| Anomaly | Unexpected pattern breaks |

## Chat UI Flow
```
CSM: [Uploads 5 files: usage_data.csv, support_tickets.csv, nps_survey.csv, q4_meetings.pdf, invoices.xlsx]

Analyze these files together for Acme Corp and find correlations

System: 📊 Processing multiple files...

**Files Received:**
1. usage_data.csv - Product usage metrics
2. support_tickets.csv - Support ticket history
3. nps_survey.csv - NPS survey results
4. q4_meetings.pdf - Meeting transcript summaries
5. invoices.xlsx - Invoice/payment history

Customer identified: **Acme Corp**
Date range: October 2025 - January 2026

Processing each file...

---

**📁 Individual File Processing**

| File | Records | Key Metrics |
|------|---------|-------------|
| Usage Data | 45K events | MAU: 1,234, Adoption: 62% |
| Support Tickets | 89 tickets | Escalations: 8, CSAT: 3.2/5 |
| NPS Survey | 12 responses | Score: +8 (down from +42) |
| Meetings | 6 transcripts | Sentiment: Declining |
| Invoices | 12 invoices | On-time: 67%, Outstanding: $24K |

Building unified timeline...
Running cross-reference analysis...

---

**🔗 Cross-Reference Analysis Complete**

**Unified Customer Health: 52/100** 🔴

This score reflects correlations across all data sources.

---

**📈 Unified Timeline - Key Events**

```
Oct 1  │ NPS Score: +42 ✅
       │ Health: 78/100
       │
Oct 15 │ 🔴 New feature launched (Advanced Analytics)
       │ 📊 Usage of feature: 5%
       │
Nov 1  │ 📞 Meeting: "Struggling with new feature"
       │ 🎫 First ticket about Analytics (high priority)
       │
Nov 15 │ 📊 Overall usage drops 15%
       │ 🎫 3 more Analytics tickets
       │ 💰 First late payment (15 days)
       │
Dec 1  │ 🔴 NPS Score: +8 (⬇️ -34 points)
       │ 📞 Meeting: "Frustrated with support response"
       │ 🎫 Ticket escalation (#1 of 8)
       │
Dec 15 │ 📊 MAU drops 25%
       │ 🎫 Peak ticket volume (23 tickets)
       │ 💰 Second late payment (22 days)
       │
Jan 1  │ 📞 Meeting: Sarah mentioned "exploring alternatives"
       │ 🔴 Health: 52/100
       │ 💰 $24K outstanding
       │
Jan 29 │ Current State: Multiple risk signals active
```

---

**🔍 Discovered Correlations**

**1. Feature Launch → Support Spike → NPS Drop** (Strong Correlation)
```
Advanced Analytics launch
    ↓ (14 days)
Support ticket spike (+340%)
    ↓ (30 days)
NPS dropped 34 points
    ↓ (45 days)
Usage declined 25%
```
**Insight:** The new feature caused confusion, driving support burden and satisfaction decline.

**2. Support Response Time → Payment Delays** (Moderate Correlation)
```
Avg support response: 48 hours → 72 hours
    ↓ (correlates with)
Payment behavior: On-time → 15-22 days late
```
**Insight:** Dissatisfaction may be manifesting in delayed payments.

**3. Meeting Sentiment → Subsequent Behavior** (Strong Correlation)
- Nov 1 meeting (frustrated) → 15% usage drop in following 2 weeks
- Dec 1 meeting (very frustrated) → 25% usage drop, escalations
- Jan 1 meeting (exploring alternatives) → 🔴 Active churn risk

**4. User Engagement Clustering** (Identified Pattern)
- Power users (5 people): Maintained usage
- Casual users (40 people): Dropped off after Analytics issues
- New users (10 people): Never activated

---

**⚠️ Multi-Signal Risk Assessment**

| Signal Source | Risk Indicator | Weight | Score |
|---------------|----------------|--------|-------|
| Usage Data | 25% decline, feature adoption blocked | High | 🔴 |
| Support | 8 escalations, 3.2 CSAT | High | 🔴 |
| NPS | Dropped 34 points, verbatim negative | High | 🔴 |
| Meetings | "Exploring alternatives" mentioned | Critical | 🔴 |
| Payments | 67% on-time, $24K outstanding | Medium | 🟡 |

**Combined Risk Score: CRITICAL**

This account shows compounding risk signals that individually might seem manageable but together indicate serious churn risk.

---

**🎯 Root Cause Analysis**

**Primary Issue:** Failed feature adoption (Advanced Analytics)
- Launched Oct 15 without adequate training
- Support wasn't prepared for questions
- Response times increased across all tickets
- Cascading impact on satisfaction and engagement

**Secondary Issues:**
1. Support capacity/training gap
2. Onboarding incomplete for new features
3. Communication breakdown (6 weeks between feature launch and first check-in)

---

**💡 Recommended Action Plan**

**Immediate (This Week):**
1. **Executive apology call** - Acknowledge the experience
2. **Dedicated support contact** - Single point for all tickets
3. **Payment plan discussion** - Address outstanding balance

**Short-term (2-4 Weeks):**
4. **Advanced Analytics retraining** - Personalized sessions
5. **Re-engage dropped users** - Targeted outreach
6. **Weekly check-ins** - Until stability restored

**Medium-term (1-3 Months):**
7. **Account recovery plan** - Document and track
8. **NPS follow-up survey** - Measure improvement
9. **Renewal strategy** - Adjust terms if needed

---

Would you like me to:
[Create Risk Signal + Save Play] [Generate Executive Brief] [Schedule Recovery Call] [Export Full Analysis]

CSM: Create risk signal and generate executive brief

System: ✅ Actions Complete!

**🚨 Critical Risk Signal Created:**

**Customer:** Acme Corp
**Severity:** Critical
**Type:** multi_signal_churn_risk

**Summary:**
Cross-reference analysis of 5 data sources reveals compounding risk signals:
- NPS dropped 34 points post-feature launch
- Usage declined 25% over 3 months
- 8 support escalations with declining CSAT
- Payment delays and $24K outstanding
- "Exploring alternatives" mentioned in Jan meeting

**Root Cause:** Failed Advanced Analytics feature adoption cascaded to support overload, satisfaction decline, and disengagement.

**Recommended:** Executive intervention + account recovery plan

---

**📄 Executive Brief Generated:**

# Acme Corp - Account Risk Brief
## Prepared for Leadership Review

### Situation Summary
Acme Corp ($125K ARR, renewal April 2026) is at critical churn risk based on multi-source analysis revealing compounding issues over the past 3 months.

### Key Findings
| Metric | 3 Months Ago | Today | Change |
|--------|--------------|-------|--------|
| NPS | +42 | +8 | -34 points |
| MAU | 1,645 | 1,234 | -25% |
| Support CSAT | 4.1 | 3.2 | -0.9 |
| Health Score | 78 | 52 | -26 |

### Root Cause
Advanced Analytics feature launch (Oct 15) without adequate training led to support overload, declining satisfaction, and user disengagement.

### Business Impact
- $125K ARR at risk
- Customer mentioned "exploring alternatives"
- $24K outstanding balance

### Recommended Actions
1. Executive apology call (CEO/VP level)
2. Dedicated account recovery plan
3. Feature retraining program
4. Adjusted renewal terms consideration

### Success Criteria
- NPS return to positive by March
- Usage stabilization by February
- All outstanding balance collected

---

[Download PDF] [Share with Leadership] [Schedule Review]

Brief saved to: /Shared/Account Risk/Acme_Corp_Risk_Brief_Jan2026.pdf
```

## Acceptance Criteria
- [ ] Supports simultaneous upload of 10+ files
- [ ] Correctly identifies and processes different file types
- [ ] Builds unified timeline across all data sources
- [ ] Detects correlations with statistical significance
- [ ] Identifies causal relationships where evident
- [ ] Generates holistic health score from all inputs
- [ ] Provides root cause analysis for patterns
- [ ] Recommendations consider all data sources
- [ ] Processing completes within 5 minutes for typical batch
- [ ] Visualization shows cross-source connections clearly

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-021-COMPLETE</promise>
```

### Success Metrics
- Hidden risks identified > 30 days before other signals
- Root cause accuracy validated > 80%
- Account save rate for multi-signal risks > 50%
