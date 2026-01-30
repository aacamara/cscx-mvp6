# PRD-004: Support Ticket Export → Pattern Analysis

## Metadata
- **PRD ID**: PRD-004
- **Category**: A - Documents & Data Processing
- **Priority**: P1
- **Estimated Complexity**: High
- **Dependencies**: AI analysis engine, risk signal detection

## Scenario Description
A CSM exports support tickets from their ticketing system (Zendesk, Intercom, Freshdesk) and uploads them to identify patterns, recurring issues, escalation trends, and potential churn signals. The system analyzes ticket data to surface actionable insights about customer health and product feedback.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload support ticket data and have patterns automatically identified,
**So that** I can proactively address recurring issues and identify at-risk customers.

## Trigger
CSM uploads a CSV/Excel export of support tickets via Chat UI with a message like "Analyze these support tickets for patterns."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Risk signal detection | `risk_signals` table | Implemented | Can store ticket-based signals |
| Ticket escalated trigger | Trigger engine | Implemented | Fires on escalation events |
| Meeting analysis | `meeting_analyses` table | Implemented | Similar pattern detection |
| AI analysis | Claude/Gemini | Implemented | Can analyze text data |
| Zendesk/Intercom integration | GAPS_ANALYSIS.md | Not implemented | Listed as gap |

### What's Missing
- [ ] Ticket data upload and parsing service
- [ ] Ticket pattern analysis algorithm
- [ ] Recurring issue clustering
- [ ] Customer-level ticket aggregation
- [ ] Trend visualization over time
- [ ] Product feedback extraction from tickets

## Detailed Workflow

### Step 1: File Upload
**User Action**: CSM uploads ticket export (CSV/Excel)
**System Response**:
- Validates file format
- Detects ticket system format (Zendesk, Intercom, Freshdesk, generic)
- Maps columns to standard ticket schema
- Reports: "Found 1,247 tickets from 89 customers"

### Step 2: Column Mapping
**User Action**: CSM confirms column mappings
**System Response**:
- Auto-detects: ticket ID, customer, subject, description, status, priority, created date, resolved date
- Asks for confirmation on any ambiguous mappings
- Validates required fields are present

### Step 3: Pattern Analysis
**User Action**: CSM initiates analysis
**System Response**:
- Clusters tickets by topic/issue type
- Identifies recurring issues per customer
- Calculates escalation rates
- Detects sentiment trends
- Identifies potential product gaps
- Surfaces customers with concerning patterns

### Step 4: Insights Review
**User Action**: CSM reviews analysis results
**System Response**:
- Displays categorized insights
- Allows drill-down into specific patterns
- Offers to create risk signals for concerning patterns
- Suggests follow-up actions per customer

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/tickets/ticketParser.ts` | Parse various ticket export formats |
| `server/src/services/analysis/ticketPatterns.ts` | Pattern detection algorithms |
| `server/src/services/analysis/issueClustering.ts` | Topic clustering for tickets |
| `components/Analysis/TicketInsights.tsx` | Insights visualization component |
| `components/Analysis/PatternDrilldown.tsx` | Detailed pattern view |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/tickets/upload` | POST | Upload ticket export file |
| `POST /api/tickets/analyze` | POST | Run pattern analysis |
| `GET /api/tickets/patterns` | GET | Retrieve detected patterns |
| `POST /api/tickets/risk-signals` | POST | Create risk signals from patterns |

### Analysis Outputs
| Output | Description |
|--------|-------------|
| Issue Categories | Grouped tickets by topic (billing, technical, feature request, etc.) |
| Customer Risk Matrix | Customers ranked by ticket volume, escalation rate, sentiment |
| Trending Issues | Issues increasing in frequency over time |
| Product Gaps | Feature requests and complaints aggregated |
| Resolution Metrics | Average resolution time, first-contact resolution rate |
| Sentiment Analysis | Overall and per-customer sentiment trends |

## Chat UI Flow
```
CSM: [Uploads zendesk_export_q4.csv] Analyze these support tickets for patterns

System: 📊 Analyzing ticket export...

Detected format: Zendesk Export
Found: 1,247 tickets from 89 customers
Date range: October 1 - December 31, 2025

Column Mapping:
- Ticket ID → #id
- Requester → customer_email
- Subject → subject
- Description → description
- Status → status
- Priority → priority
- Created → created_at
- Solved → resolved_at
- Satisfaction → csat_score

Is this mapping correct? [Confirm] [Edit Mapping]

CSM: Confirm

System: Running pattern analysis...

📈 **Ticket Pattern Analysis Complete**

**Overview**
- Total Tickets: 1,247
- Unique Customers: 89
- Avg Resolution Time: 18.4 hours
- Escalation Rate: 8.2%
- CSAT Average: 3.8/5

---

**🔴 Top Issue Categories**

| Category | Tickets | % of Total | Trend |
|----------|---------|------------|-------|
| Login/Authentication | 312 | 25% | ⬆️ +45% |
| API Integration Errors | 198 | 16% | ⬆️ +23% |
| Performance Issues | 156 | 13% | ➡️ Stable |
| Billing Questions | 134 | 11% | ⬇️ -12% |
| Feature Requests | 127 | 10% | ⬆️ +8% |

---

**⚠️ Customers Requiring Attention**

| Customer | Tickets | Escalations | Avg Sentiment | Risk |
|----------|---------|-------------|---------------|------|
| **TechStart Inc** | 47 | 8 (17%) | Negative | 🔴 High |
| **DataFlow Corp** | 38 | 5 (13%) | Negative | 🔴 High |
| **CloudFirst** | 29 | 3 (10%) | Mixed | 🟡 Medium |

---

**📢 Product Feedback Themes**

1. **SSO Integration** (67 mentions)
   "Customers requesting SAML/OKTA integration"

2. **Mobile App** (45 mentions)
   "Demand for native mobile experience"

3. **Bulk Export** (34 mentions)
   "Need to export data in bulk formats"

---

**📉 Concerning Trends**

1. Login issues up 45% - possible auth service degradation
2. TechStart Inc has 3x avg ticket volume with declining sentiment
3. API integration errors correlating with recent v2.1 release

Would you like me to:
[Create Risk Signals] [Drill Down by Customer] [Export Full Report] [Draft Outreach for High-Risk]

CSM: Create risk signals for TechStart and DataFlow

System: ✅ Created 2 risk signals:

1. **TechStart Inc** - High ticket volume with escalations
   - Type: ticket_escalated
   - Severity: High
   - Added to at-risk watch list

2. **DataFlow Corp** - Negative sentiment trend
   - Type: ticket_escalated
   - Severity: High
   - Added to at-risk watch list

Would you like me to draft outreach emails to these customers?
```

## Acceptance Criteria
- [ ] Supports CSV and Excel ticket exports from major platforms (Zendesk, Intercom, Freshdesk)
- [ ] Auto-detects export format and maps columns appropriately
- [ ] Pattern analysis completes within 2 minutes for 5,000 tickets
- [ ] Issue clustering produces meaningful, non-overlapping categories
- [ ] Customer risk ranking considers volume, escalation rate, and sentiment
- [ ] Trending issues correctly identify week-over-week changes
- [ ] Product feedback themes are actionable and de-duplicated
- [ ] Risk signals created link to specific ticket evidence
- [ ] Analysis can be exported as PDF report
- [ ] Historical analysis can be compared (Q3 vs Q4)

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-004-COMPLETE</promise>
```

### Success Metrics
- Pattern detection accuracy validated by CSM > 85%
- At-risk customer identification leads to proactive outreach within 24 hours
- Product feedback surfaced to product team within 1 week
