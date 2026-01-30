# PRD-010: Product Feedback Upload → Theme Clustering

## Metadata
- **PRD ID**: PRD-010
- **Category**: A - Documents & Data Processing
- **Priority**: P1
- **Estimated Complexity**: High
- **Dependencies**: AI analysis engine, feedback storage

## Scenario Description
A CSM uploads product feedback data (from surveys, support tickets, feature request lists, or customer interviews) and the system clusters feedback into themes, quantifies frequency and sentiment per theme, and generates a product feedback report for the product team.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload customer feedback and have it automatically categorized into themes,
**So that** I can provide organized, quantified feedback to the product team.

## Trigger
CSM uploads a CSV/Excel/document of feedback via Chat UI with a message like "Analyze this feedback and identify themes."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Meeting feedback extraction | `meeting_analyses` | Partial | Competitor mentions only |
| Sentiment analysis | AI services | Implemented | Can analyze text |
| NPS verbatim | NPS workflow | Implemented | From survey data |
| Feature requests | Ticket analysis | Partial | In support patterns |

### What's Missing
- [ ] Dedicated feedback upload and parsing
- [ ] Theme clustering algorithm
- [ ] Cross-source feedback aggregation
- [ ] Customer-level feedback tracking
- [ ] Product team report generation
- [ ] Feedback prioritization scoring
- [ ] Trend analysis over time

## Detailed Workflow

### Step 1: Feedback Upload
**User Action**: CSM uploads feedback data
**System Response**:
- Accepts CSV, Excel, or document with feedback
- Identifies feedback source (survey, interview, support, etc.)
- Extracts customer attribution if available
- Reports: "Found 456 feedback items from 89 customers"

### Step 2: Theme Clustering
**User Action**: CSM initiates analysis
**System Response**:
- AI clusters feedback into themes using NLP
- Identifies 10-20 primary themes
- Calculates frequency per theme
- Analyzes sentiment per theme
- Identifies sub-themes within major categories

### Step 3: Insights Generation
**User Action**: CSM reviews themes
**System Response**:
- Displays theme summary with examples
- Shows customer distribution per theme
- Correlates themes with customer segments
- Highlights high-impact themes (high frequency + negative sentiment)
- Identifies emerging vs declining themes

### Step 4: Report & Action
**User Action**: CSM generates report
**System Response**:
- Creates formatted product feedback report
- Includes customer quotes and attribution
- Prioritizes themes by business impact
- Suggests product team discussion points
- Tracks feedback for follow-up

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/feedback/feedbackParser.ts` | Parse various feedback formats |
| `server/src/services/analysis/themeClustering.ts` | NLP theme clustering |
| `server/src/services/analysis/feedbackPrioritizer.ts` | Prioritize by impact |
| `server/src/services/reports/feedbackReport.ts` | Generate product reports |
| `components/Feedback/ThemeDashboard.tsx` | Theme visualization |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/feedback/upload` | POST | Upload feedback data |
| `POST /api/feedback/cluster` | POST | Run theme clustering |
| `GET /api/feedback/themes` | GET | Retrieve clustered themes |
| `POST /api/feedback/report` | POST | Generate product report |

### Theme Analysis Outputs
| Output | Description |
|--------|-------------|
| Primary Themes | Top-level feedback categories |
| Sub-themes | Granular breakdown within themes |
| Frequency Count | Number of mentions per theme |
| Sentiment Score | Average sentiment per theme |
| Customer Impact | Number of unique customers per theme |
| ARR Weight | Total ARR of customers mentioning theme |
| Trend Direction | Increasing, stable, or decreasing mentions |

## Chat UI Flow
```
CSM: [Uploads q4_customer_feedback.xlsx] Analyze this feedback and identify themes

System: 📊 Processing feedback data...

Found: 456 feedback items
Sources: Customer interviews (89), Support tickets (234), Survey responses (133)
Customers represented: 78
Date range: October - December 2025

Running theme clustering...

---

**🎯 Theme Analysis Complete**

**Top 10 Themes by Frequency**

| # | Theme | Count | Sentiment | Customers | ARR Impact |
|---|-------|-------|-----------|-----------|------------|
| 1 | Performance/Speed | 67 | 😞 Negative | 45 | $1.2M |
| 2 | Mobile App Request | 52 | 😐 Neutral | 38 | $890K |
| 3 | Reporting Capabilities | 48 | 😐 Mixed | 34 | $750K |
| 4 | API Documentation | 41 | 😞 Negative | 29 | $680K |
| 5 | SSO/SAML Integration | 38 | 😐 Neutral | 28 | $920K |
| 6 | UI/UX Improvements | 35 | 😐 Neutral | 27 | $520K |
| 7 | Pricing Flexibility | 31 | 😞 Negative | 25 | $680K |
| 8 | Customer Support | 29 | 😊 Positive | 22 | $410K |
| 9 | Onboarding Process | 26 | 😞 Negative | 21 | $380K |
| 10 | Data Export Options | 23 | 😐 Neutral | 19 | $340K |

---

**📈 Theme Deep Dive: Performance/Speed (#1)**

**Sub-themes:**
- Page load times (28 mentions)
- Report generation speed (19 mentions)
- Search performance (12 mentions)
- Dashboard refresh (8 mentions)

**Sample Feedback:**
> "Dashboard takes 15+ seconds to load with large datasets" - TechCorp
> "Report exports timing out for anything over 10K rows" - DataPro
> "Search is painfully slow compared to competitors" - CloudMax

**Customer Segments:**
- Enterprise (70%): Most impacted by large data volumes
- Mid-Market (25%): Moderate complaints
- SMB (5%): Minimal issues

**Trend:** ⬆️ Increasing (+35% vs Q3)

---

**🚨 High-Impact Themes (High Frequency + Negative Sentiment)**

1. **Performance/Speed** - 67 mentions, $1.2M ARR at risk
2. **API Documentation** - 41 mentions, integration blockers
3. **Onboarding Process** - 26 mentions, time-to-value issues

---

**💡 Emerging Themes (New in Q4)**

- **AI Features Request** - 12 mentions (new)
- **Workflow Automation** - 9 mentions (new)
- **Slack Integration** - 8 mentions (growing)

---

**📊 Theme x Customer Segment Matrix**

```
                    | Enterprise | Mid-Market | SMB |
--------------------|------------|------------|-----|
Performance         | ●●●●●      | ●●●        | ●   |
Mobile App          | ●●●        | ●●●●       | ●●  |
Reporting           | ●●●●       | ●●●        | ●   |
SSO/SAML            | ●●●●●      | ●●         |     |
Pricing             | ●          | ●●●        | ●●●●|
```

Would you like me to:
[Generate Product Team Report] [Drill Into Specific Theme] [Export Raw Data] [Create Customer Follow-up List]

CSM: Generate a product team report

System: 📄 Generating Product Feedback Report...

---

# Q4 2025 Customer Feedback Report

## Executive Summary
Analysis of 456 feedback items from 78 customers reveals Performance/Speed as the critical issue affecting $1.2M ARR. Mobile App and Reporting capabilities are high-demand feature requests.

## Priority Matrix

### 🔴 Critical (Address Immediately)
1. **Performance/Speed** - Affecting 45 enterprise customers
   - Root cause: Large dataset handling
   - Business impact: Churn risk for top-tier accounts

### 🟠 High Priority (Next Quarter)
2. **API Documentation** - Blocking 29 integrations
3. **SSO/SAML** - Enterprise deal blocker ($920K pipeline)

### 🟡 Medium Priority (Roadmap)
4. **Mobile App** - Strong demand across segments
5. **Reporting** - Specific to enterprise analytics needs

## Detailed Analysis
[... continued report ...]

---

Report generated!

[Download PDF] [Share with Product Team] [Schedule Review Meeting]

I've also created a shareable link: `docs.google.com/document/d/xxx`

Would you like me to email this to the product team?
```

## Acceptance Criteria
- [ ] Supports CSV, Excel, and document-based feedback inputs
- [ ] Theme clustering produces 10-20 coherent, distinct themes
- [ ] Sub-themes provide actionable granularity
- [ ] Sentiment analysis accurately reflects feedback tone
- [ ] Customer attribution links feedback to customer records
- [ ] ARR impact calculation uses accurate customer data
- [ ] Trend analysis compares to previous period data
- [ ] Generated report is professional and shareable
- [ ] Processing completes within 2 minutes for 1,000 items
- [ ] Themes can be manually adjusted/merged by CSM

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-010-COMPLETE</promise>
```

### Success Metrics
- Theme accuracy validated by product team > 85%
- Feedback reports shared with product within 1 week
- High-impact themes addressed in product roadmap > 50%
