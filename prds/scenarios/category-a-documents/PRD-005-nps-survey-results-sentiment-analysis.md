# PRD-005: NPS Survey Results → Sentiment Analysis

## Metadata
- **PRD ID**: PRD-005
- **Category**: A - Documents & Data Processing
- **Priority**: P0
- **Estimated Complexity**: Medium
- **Dependencies**: AI sentiment analysis, trigger system, Gmail integration

## Scenario Description
A CSM uploads NPS survey results containing scores and verbatim feedback. The system analyzes sentiment beyond just the numeric score, categorizes feedback themes, identifies promoters for advocacy opportunities, and flags detractors for immediate follow-up with suggested response strategies.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload NPS survey results and get actionable sentiment analysis,
**So that** I can quickly respond to detractors and leverage promoters for advocacy.

## Trigger
CSM uploads a CSV/Excel of NPS survey results via Chat UI with a message like "Analyze these NPS results."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| NPS score tracking | `qbrs` table (nps_score) | Partial | Stores score but not verbatim |
| NPS submitted trigger | Trigger engine | Implemented | Can fire on NPS events |
| Sentiment analysis | Meeting analyses | Implemented | Can analyze sentiment |
| NPS follow-up script | Apps Script | Implemented | Automated follow-up logic |
| Survey/NPS support | CAPABILITIES_INVENTORY.md | Basic | Score tracking, follow-up |

### What's Missing
- [ ] NPS survey data upload and parsing
- [ ] Verbatim sentiment analysis beyond score
- [ ] Feedback theme categorization
- [ ] Promoter advocacy opportunity detection
- [ ] Detractor response strategy recommendations
- [ ] NPS history visualization

## Detailed Workflow

### Step 1: File Upload
**User Action**: CSM uploads NPS survey export
**System Response**:
- Validates file format
- Detects survey platform format (SurveyMonkey, Typeform, Delighted, etc.)
- Maps columns: respondent, score, verbatim, timestamp
- Reports distribution: "Found 234 responses: 45 Promoters, 112 Passives, 77 Detractors"

### Step 2: Sentiment Analysis
**User Action**: CSM initiates analysis
**System Response**:
- Analyzes verbatim comments with AI
- Correlates sentiment with numeric scores
- Identifies mismatches (positive comment with low score, etc.)
- Categorizes feedback into themes

### Step 3: Actionable Insights
**User Action**: CSM reviews analysis
**System Response**:
- Displays segmented insights by promoter/passive/detractor
- Highlights urgent detractors (low score + negative sentiment + high ARR)
- Identifies advocacy opportunities (high score + positive sentiment)
- Suggests response strategies per segment

### Step 4: Action Execution
**User Action**: CSM takes action on insights
**System Response**:
- Drafts personalized follow-up emails
- Creates tasks for detractor outreach
- Flags promoters for reference/testimonial asks
- Updates customer NPS records

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/surveys/npsParser.ts` | Parse NPS survey exports |
| `server/src/services/analysis/npsSentiment.ts` | Sentiment analysis for NPS verbatim |
| `server/src/services/analysis/feedbackThemes.ts` | Theme categorization |
| `components/NPS/NPSInsights.tsx` | NPS analysis dashboard |
| `components/NPS/DetractorQueue.tsx` | Prioritized detractor follow-up |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/nps/upload` | POST | Upload NPS survey data |
| `POST /api/nps/analyze` | POST | Run sentiment analysis |
| `GET /api/nps/insights` | GET | Retrieve analysis results |
| `POST /api/nps/follow-up` | POST | Generate follow-up actions |

### Database Changes
| Table | Change |
|-------|--------|
| `nps_responses` | New table for NPS data storage |
| `nps_analysis` | New table for analysis results |
| `customers` | Add `latest_nps_score`, `nps_trend` columns |

## Chat UI Flow
```
CSM: [Uploads q4_nps_survey.csv] Analyze these NPS results

System: 📊 Analyzing NPS Survey Data...

Detected format: Delighted Export
Found: 234 responses
Survey period: October - December 2025

**NPS Distribution**
```
Promoters (9-10):  ████████████ 45 (19%)
Passives (7-8):    ████████████████████████████ 112 (48%)
Detractors (0-6):  ███████████████████ 77 (33%)

Overall NPS: -14 (Detractors - Promoters %)
```

Analyzing verbatim feedback...

---

**🎯 Sentiment Analysis Complete**

**Score vs Sentiment Correlation**
- 89% of Promoters have positive verbatim ✓
- 67% of Passives have neutral verbatim ✓
- ⚠️ 12% of Detractors have positive verbatim (score/sentiment mismatch)

---

**📢 Top Feedback Themes**

| Theme | Mentions | Sentiment | Segment |
|-------|----------|-----------|---------|
| Product Reliability | 67 | 😊 Positive | Promoters |
| Customer Support | 52 | 😊 Positive | Mixed |
| Onboarding Complexity | 48 | 😞 Negative | Detractors |
| Pricing Concerns | 34 | 😐 Mixed | Passives |
| Missing Features | 29 | 😞 Negative | Detractors |

---

**🔴 Priority Detractors (Require Immediate Attention)**

| Customer | Score | ARR | Verbatim Summary | Recommended Action |
|----------|-------|-----|------------------|-------------------|
| **TechStart Inc** | 2 | $125K | "Implementation was a disaster" | Executive escalation |
| **DataFlow Corp** | 4 | $89K | "Support response too slow" | Schedule call + SLA review |
| **CloudFirst** | 3 | $156K | "Missing critical integration" | Product roadmap discussion |

---

**🟢 Promoter Advocacy Opportunities**

| Customer | Score | ARR | Verbatim Highlight | Opportunity |
|----------|-------|-----|-------------------|-------------|
| **Acme Corp** | 10 | $200K | "Best decision we made" | Case study |
| **Beta Inc** | 10 | $145K | "Support team is amazing" | G2 review |
| **Gamma LLC** | 9 | $178K | "Transformed our process" | Reference call |

---

**⚠️ Score-Sentiment Mismatches (Investigate)**

1. **Omega Systems** - Score: 4, Sentiment: Positive
   Comment: "Love the product but pricing increase was unexpected"
   → Billing/renewal issue, not product dissatisfaction

2. **Delta Corp** - Score: 5, Sentiment: Positive
   Comment: "Great tool, just wish we used it more"
   → Adoption issue, not satisfaction issue

Would you like me to:
[Draft Detractor Outreach] [Queue Promoter Asks] [Create Risk Signals] [Export Full Report]

CSM: Draft detractor outreach for top 3

System: 📧 Drafting personalized follow-up emails...

**1. TechStart Inc (Score: 2)**
Subject: Following up on your feedback - let's make this right

Hi [Contact],

Thank you for sharing your candid feedback in our recent survey. I was concerned to hear that your implementation experience fell short of expectations.

I'd like to schedule a call this week to understand what went wrong and discuss how we can course-correct. Your success is my top priority.

Would [Tuesday/Thursday] work for a 30-minute call?

[Preview] [Edit] [Approve]

**2. DataFlow Corp (Score: 4)**
Subject: Your feedback matters - improving our support response

[... similar personalized email ...]

**3. CloudFirst (Score: 3)**
Subject: Let's discuss the integration you need

[... similar personalized email ...]

[Approve All] [Edit All]
```

## Acceptance Criteria
- [ ] Supports CSV/Excel exports from major NPS platforms
- [ ] Correctly calculates NPS score from raw data
- [ ] Sentiment analysis processes verbatim comments in under 30 seconds per 100 responses
- [ ] Theme categorization produces 5-10 actionable themes
- [ ] Score-sentiment mismatches are detected and flagged
- [ ] Detractor prioritization considers score, ARR, and sentiment
- [ ] Promoter opportunities suggest specific advocacy actions
- [ ] Follow-up emails are personalized based on specific feedback
- [ ] NPS data updates customer records with scores
- [ ] Historical NPS trends can be viewed per customer

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-005-COMPLETE</promise>
```

### Success Metrics
- Detractor follow-up initiated within 24 hours for all priority detractors
- Promoter conversion to advocates > 20%
- Theme accuracy validated by product team > 80%
