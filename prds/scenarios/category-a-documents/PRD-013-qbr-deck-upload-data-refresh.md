# PRD-013: QBR Deck Upload → Data Refresh

## Metadata
- **PRD ID**: PRD-013
- **Category**: A - Documents & Data Processing
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Google Slides integration, customer data APIs

## Scenario Description
A CSM uploads a previous QBR deck (PowerPoint or Google Slides) and the system identifies data placeholders, refreshes them with current metrics, updates charts and tables, and generates an updated deck ready for the next QBR.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload my previous QBR deck and have it automatically refreshed with current data,
**So that** I can prepare for QBRs quickly without manual data updates.

## Trigger
CSM uploads a QBR deck via Chat UI with a message like "Refresh this QBR deck with current data."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| QBR presentation template | Slides templates | Implemented | Standard template |
| QBR creation | Google Slides service | Implemented | Can create from template |
| Customer metrics | Various tables | Implemented | Health, usage, etc. |
| QBR tracking | `qbrs` table | Implemented | Stores QBR records |
| Variable substitution | `{{placeholder}}` | Implemented | In templates |

### What's Missing
- [ ] Deck upload and parsing (PPTX, Google Slides)
- [ ] Placeholder/data field detection in existing decks
- [ ] Automatic data refresh for detected fields
- [ ] Chart data update capability
- [ ] Slide-by-slide comparison (old vs new)
- [ ] Custom deck format support

## Detailed Workflow

### Step 1: Deck Upload
**User Action**: CSM uploads previous QBR deck
**System Response**:
- Accepts PPTX or links Google Slides URL
- Parses slide structure
- Identifies customer from deck content
- Reports: "Found 18 slides for Acme Corp Q3 QBR"

### Step 2: Data Detection
**User Action**: System analyzes automatically
**System Response**:
- Scans for data fields (numbers, dates, metrics)
- Identifies charts and tables
- Detects customer-specific content
- Maps fields to available data sources
- Reports: "Found 34 data points to refresh"

### Step 3: Data Refresh
**User Action**: CSM confirms refresh
**System Response**:
- Pulls current data from all sources
- Updates text fields with new values
- Refreshes chart data
- Updates tables with current metrics
- Flags items that couldn't be auto-updated

### Step 4: Review & Finalize
**User Action**: CSM reviews updated deck
**System Response**:
- Shows before/after comparison
- Highlights significant changes
- Allows manual editing
- Generates final deck in customer workspace

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/presentations/deckParser.ts` | Parse PPTX and Slides |
| `server/src/services/presentations/dataDetector.ts` | Detect data fields |
| `server/src/services/presentations/dataRefresher.ts` | Update data in deck |
| `components/QBR/DeckRefreshPreview.tsx` | Before/after preview |
| `components/QBR/DataMappingEditor.tsx` | Edit data mappings |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/qbr/deck/upload` | POST | Upload QBR deck |
| `POST /api/qbr/deck/detect-data` | POST | Detect data fields |
| `POST /api/qbr/deck/refresh` | POST | Refresh data |
| `GET /api/qbr/deck/:id/preview` | GET | Preview updated deck |

### Detectable Data Types
| Type | Examples | Data Source |
|------|----------|-------------|
| ARR/Revenue | $125,000 ARR | `customers.arr` |
| Health Score | Health: 78/100 | `customers.health_score` |
| Usage Metrics | 1,234 MAU | `usage_metrics` |
| Dates | Q3 2025, Jan 2026 | Current quarter |
| Growth/Change | +15% YoY | Calculated |
| User Counts | 150 active users | `usage_metrics.active_users` |
| NPS Score | NPS: +45 | `nps_responses` |

## Chat UI Flow
```
CSM: [Uploads Acme_QBR_Q3_2025.pptx] Refresh this QBR deck with current data

System: 📊 Analyzing QBR deck...

Deck: Acme_QBR_Q3_2025.pptx
Slides: 18
Customer identified: **Acme Corp**
Previous QBR: Q3 2025

Scanning for data fields...

---

**🔍 Data Detection Complete**

Found **34 data points** to refresh:

**Metrics (will auto-update):**
| Field | Q3 Value | Current Value | Change |
|-------|----------|---------------|--------|
| ARR | $100,000 | $125,000 | ⬆️ +25% |
| Health Score | 72 | 78 | ⬆️ +6 |
| MAU | 980 | 1,234 | ⬆️ +26% |
| NPS | +38 | +45 | ⬆️ +7 |
| Active Users | 120/150 | 145/160 | ⬆️ Better |
| Support Tickets | 23 | 18 | ⬇️ Improved |

**Dates (will update):**
- "Q3 2025" → "Q4 2025" (8 instances)
- "July - September" → "October - December"

**Charts (will refresh):**
- Slide 5: Usage Trend (line chart) → New data available
- Slide 8: Feature Adoption (bar chart) → New data available
- Slide 12: Health Score History (line chart) → New data available

**Tables (will update):**
- Slide 6: Monthly Metrics Table (3 months data)
- Slide 10: Feature Usage Matrix

**⚠️ Manual Review Needed:**
- Slide 3: Executive Summary text (narrative)
- Slide 14: Challenges section (customer-specific)
- Slide 15: Goals for Next Quarter (strategic)
- Slide 17: Action Items (from last QBR)

Ready to refresh? [Refresh All] [Select Fields] [Preview First]

CSM: Refresh all

System: 🔄 Refreshing QBR deck...

✅ **Refresh Complete!**

Updated:
- 34 data fields updated
- 3 charts refreshed
- 2 tables updated
- 8 date references changed

---

**📈 Key Changes Highlighted**

| Slide | Change | Impact |
|-------|--------|--------|
| 4 | ARR: $100K → $125K | 🟢 Great news! |
| 5 | Usage trend graph | 🟢 Upward trajectory |
| 7 | Health: 72 → 78 | 🟢 Improvement |
| 11 | Tickets: 23 → 18 | 🟢 Fewer issues |

---

**⚠️ Review These Slides:**

**Slide 3: Executive Summary**
> Current text: "Q3 was a strong quarter with successful implementation completion..."

This narrative text needs your review - I can help draft an updated summary if you'd like.

**Slide 14: Challenges**
> Current text lists Q3 challenges around adoption

Would you like me to update based on current risk signals?

**Slide 15: Q4 Goals**
> Lists goals that may have been achieved or changed

---

**📁 Updated Deck Saved**

Location: CSCX - Acme Corp/03 - QBRs/Acme_QBR_Q4_2025.pptx

[Open in Google Slides] [Download PPTX] [Send for Review]

Would you like me to:
[Draft Executive Summary] [Update Challenges Section] [Generate Talking Points]

CSM: Draft the executive summary for Q4

System: 📝 Drafting Executive Summary...

---

**Q4 2025 Executive Summary - Acme Corp**

Q4 was a strong quarter for Acme Corp, marked by significant growth and improved engagement across all metrics.

**Key Highlights:**
- **ARR Growth:** Achieved $125K (+25% from Q3) following the October seat expansion
- **Adoption Success:** MAU increased 26% to 1,234 users, exceeding the 1,100 target
- **Health Improvement:** Score rose from 72 to 78, moving from "Good" to "Healthy" status
- **Customer Satisfaction:** NPS improved to +45, with particularly positive feedback on support response times

**Challenges Addressed:**
- Initial integration issues resolved with dedicated technical support
- Reduced support ticket volume by 22% through proactive training

**Looking Ahead:**
- Q1 focus on Advanced Analytics adoption (currently at 34%)
- Preparing for April renewal with expansion discussion

---

[Insert into Slide 3] [Edit] [Generate Speaking Notes]

I've also prepared talking points for each slide if you'd like them.
```

## Acceptance Criteria
- [ ] Supports PPTX file upload and Google Slides URL
- [ ] Correctly identifies customer from deck content
- [ ] Detects numeric metrics, dates, and chart data
- [ ] Refreshes data from all relevant sources (health, usage, NPS, etc.)
- [ ] Charts update with correct data and maintain formatting
- [ ] Tables update with new values while preserving structure
- [ ] Shows before/after comparison for review
- [ ] Flags content requiring manual review (narratives, goals)
- [ ] Saves updated deck to customer workspace
- [ ] Processing completes within 60 seconds for typical deck

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-013-COMPLETE</promise>
```

### Success Metrics
- QBR prep time reduced by > 50%
- Data accuracy in refreshed decks > 98%
- CSM satisfaction with deck quality > 4/5
