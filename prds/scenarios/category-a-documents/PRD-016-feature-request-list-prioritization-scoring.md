# PRD-016: Feature Request List → Prioritization Scoring

## Metadata
- **PRD ID**: PRD-016
- **Category**: A - Documents & Data Processing
- **Priority**: P2
- **Estimated Complexity**: Medium
- **Dependencies**: Product feedback system, customer data

## Scenario Description
A CSM uploads a list of feature requests from customers (collected via surveys, calls, tickets) and the system scores and prioritizes them based on customer impact (ARR, count, segment), urgency, alignment with product roadmap, and competitive necessity.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload feature requests and have them prioritized,
**So that** I can advocate effectively with the product team based on customer impact data.

## Trigger
CSM uploads feature request data via Chat UI with a message like "Prioritize these feature requests."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Feature requests in tickets | Ticket analysis | Partial | Can detect from tickets |
| Customer ARR data | `customers.arr` | Implemented | Available for weighting |
| Product feedback themes | Feedback clustering | Partial | In PRD-010 |
| Expansion signals | `expansion_opportunities` | Implemented | Feature-driven expansion |

### What's Missing
- [ ] Dedicated feature request tracking
- [ ] Prioritization scoring algorithm
- [ ] ARR impact calculation
- [ ] Competitive necessity flagging
- [ ] Roadmap alignment checking
- [ ] Request aggregation and deduplication
- [ ] Product team report generation

## Detailed Workflow

### Step 1: Request Upload
**User Action**: CSM uploads feature request list
**System Response**:
- Accepts CSV/Excel with requests
- Parses fields: customer, request, urgency, context
- Matches to customer records
- Reports: "Found 87 feature requests from 45 customers"

### Step 2: Deduplication & Grouping
**User Action**: System processes automatically
**System Response**:
- Groups similar requests using NLP
- Identifies duplicate/overlapping requests
- Creates unified request items
- Reports: "Consolidated to 34 unique requests"

### Step 3: Prioritization Scoring
**User Action**: CSM requests scoring
**System Response**:
- Calculates impact score per request:
  - Customer ARR impact
  - Number of requesting customers
  - Urgency indicators
  - Competitive necessity
  - Strategic alignment
- Ranks requests by composite score

### Step 4: Report & Advocacy
**User Action**: CSM reviews and exports
**System Response**:
- Generates prioritized list with justification
- Creates product team report
- Includes customer quotes and context
- Provides advocacy talking points

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/features/requestParser.ts` | Parse feature request data |
| `server/src/services/features/requestGrouper.ts` | Group and deduplicate requests |
| `server/src/services/features/priorityScorer.ts` | Calculate priority scores |
| `components/Features/PrioritizedList.tsx` | Prioritized request view |
| `components/Features/ProductReport.tsx` | Product team report |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/features/requests/upload` | POST | Upload feature requests |
| `POST /api/features/requests/group` | POST | Group similar requests |
| `POST /api/features/requests/score` | POST | Calculate priority scores |
| `POST /api/features/requests/report` | POST | Generate product report |

### Prioritization Score Components
| Component | Weight | Description |
|-----------|--------|-------------|
| ARR Impact | 30% | Total ARR of requesting customers |
| Customer Count | 20% | Number of unique customers |
| Urgency | 20% | Stated urgency level |
| Competitive | 15% | Required to compete |
| Strategic | 15% | Alignment with company goals |

## Chat UI Flow
```
CSM: [Uploads feature_requests_q4.xlsx] Prioritize these feature requests

System: 📊 Processing feature requests...

Found: 87 feature requests
Customers: 45
Date range: October - December 2025

Grouping similar requests...

---

**🔄 Request Consolidation**

Original requests: 87
After grouping: 34 unique requests

**Top Groups:**
- "Mobile app" (12 requests) → Consolidated
- "API improvements" (8 requests) → Consolidated
- "Advanced reporting" (7 requests) → Consolidated
- "SSO/SAML" (6 requests) → Consolidated

---

**📊 Prioritization Scoring Complete**

**Top 10 Prioritized Requests**

| # | Request | Score | Customers | ARR Impact | Urgency |
|---|---------|-------|-----------|------------|---------|
| 1 | SSO/SAML Integration | 92 | 6 | $920K | 🔴 High |
| 2 | Mobile App | 87 | 12 | $680K | 🟡 Medium |
| 3 | Advanced Reporting | 85 | 7 | $750K | 🔴 High |
| 4 | API Rate Limit Increase | 81 | 5 | $420K | 🔴 High |
| 5 | Bulk Data Export | 78 | 8 | $340K | 🟡 Medium |
| 6 | Custom Dashboards | 74 | 6 | $380K | 🟡 Medium |
| 7 | Slack Integration | 71 | 9 | $290K | 🟢 Low |
| 8 | Webhook Improvements | 68 | 4 | $310K | 🟡 Medium |
| 9 | Multi-language Support | 65 | 3 | $450K | 🟡 Medium |
| 10 | Audit Log Export | 62 | 4 | $280K | 🟢 Low |

---

**🎯 #1: SSO/SAML Integration**

**Priority Score: 92/100**

**Breakdown:**
- ARR Impact: 95/100 ($920K at stake)
- Customer Count: 75/100 (6 enterprise customers)
- Urgency: 95/100 (blocking deals)
- Competitive: 100/100 (all competitors have it)
- Strategic: 80/100 (enterprise market focus)

**Requesting Customers:**
| Customer | ARR | Urgency | Context |
|----------|-----|---------|---------|
| TechCorp | $200K | Critical | "Blocking security approval" |
| DataPro | $150K | High | "Required for compliance" |
| CloudMax | $180K | High | "Mandatory for enterprise" |
| [3 more...] | $390K | Mixed | Various compliance needs |

**Customer Quotes:**
> "We cannot expand our deployment until SSO is available. Our security team has blocked it." - TechCorp CISO
> "This is a hard requirement for our annual security audit." - DataPro

**Competitive Context:**
- CompetitorA: ✅ Has SSO
- CompetitorB: ✅ Has SSO
- CompetitorC: ✅ Has SSO
- Us: ❌ Gap

**Business Impact:**
- $920K ARR at risk of churn/downgrade
- $450K expansion blocked
- 2 enterprise deals in pipeline blocked

---

**📈 Prioritization Matrix**

```
High Urgency
     │  🔴 SSO        🟡 API Limits
     │  🔴 Reports
     │
     ├──────────────────────────────
     │  🟡 Mobile     🟢 Slack
     │  🟡 Export     🟢 Audit Log
     │  🟡 Dashboards
Low  └────────────────────────────────
        High ARR                Low ARR
```

---

Would you like me to:
[Generate Product Team Report] [Deep Dive on #1] [Add Roadmap Context] [Export Prioritized List]

CSM: Generate product team report

System: 📄 Generating Product Team Report...

---

# Customer Feature Request Report
## Q4 2025 - Consolidated & Prioritized

**Prepared by:** [CSM Name]
**Date:** January 29, 2026
**Data Source:** 87 requests from 45 customers

---

## Executive Summary

We've consolidated Q4 customer feature requests into 34 unique items, prioritized by customer impact. **SSO/SAML integration is the #1 priority**, affecting $920K ARR with critical urgency from 6 enterprise customers.

**Key Themes:**
1. Security & Compliance (SSO, Audit) - Enterprise blockers
2. Data Access (Reporting, Export, API) - Power user needs
3. Mobility (Mobile App) - Broad demand, lower urgency

---

## Priority 1 Requests (Score > 80)

### 1. SSO/SAML Integration (Score: 92)
- **Customer Impact:** $920K ARR, 6 customers
- **Urgency:** Critical - blocking security approvals and deals
- **Competitive:** All major competitors have this
- **Recommendation:** Must-have for Q1 roadmap
- **If not delivered:** Risk losing 2 enterprise renewals

### 2. Mobile App (Score: 87)
- **Customer Impact:** $680K ARR, 12 customers
- **Urgency:** Medium - quality of life, not blocking
- **Competitive:** CompetitorA has superior mobile
- **Recommendation:** Q2 priority

### 3. Advanced Reporting (Score: 85)
- **Customer Impact:** $750K ARR, 7 customers
- **Urgency:** High - limiting enterprise analytics
- **Competitive:** Gap vs enterprise competitors
- **Recommendation:** Q1-Q2 priority

### 4. API Rate Limit Increase (Score: 81)
- **Customer Impact:** $420K ARR, 5 customers
- **Urgency:** High - blocking integrations
- **Competitive:** Standard in market
- **Recommendation:** Quick win - can likely address Q1

---

## Customer Quotes by Request

### SSO/SAML
> "We cannot expand our deployment until SSO is available." - TechCorp CISO
> "This is a hard requirement for our annual security audit." - DataPro

### Mobile App
> "Our field team needs mobile access to be effective." - CloudMax
> "CompetitorA's mobile app is the one thing they do better." - DataPro

### Advanced Reporting
> "We're exporting data to Excel to build reports. Need this native." - TechCorp

---

## Customers at Risk Without These Features

| Customer | ARR | Primary Request | Risk Level |
|----------|-----|-----------------|------------|
| TechCorp | $200K | SSO | 🔴 High - won't renew |
| DataPro | $150K | SSO | 🔴 High - compliance deadline |
| CloudMax | $180K | Mobile + SSO | 🟡 Medium - exploring options |

---

## Recommended Product Team Discussion

1. **SSO:** Can we accelerate to Q1? What's blocking?
2. **API Limits:** Is this a quick config change?
3. **Mobile:** Do we have a committed timeline to share?
4. **Reporting:** Can we prioritize specific report types?

---

[Download PDF] [Share with Product] [Schedule Review Meeting]

Report saved to: /Shared/Product Feedback/Q4_2025_Feature_Requests.pdf
```

## Acceptance Criteria
- [ ] Supports CSV/Excel upload of feature requests
- [ ] Groups similar requests using NLP with >85% accuracy
- [ ] Priority scoring is transparent and adjustable
- [ ] ARR impact calculated from linked customer data
- [ ] Competitive context included when relevant
- [ ] Customer quotes preserved and attributed
- [ ] Report format suitable for product team consumption
- [ ] Export available in PDF and spreadsheet formats
- [ ] Requests can be tracked for roadmap responses
- [ ] Processing completes within 1 minute for 200 requests

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-016-COMPLETE</promise>
```

### Success Metrics
- Feature requests included in product roadmap > 30%
- Customer satisfaction with feature communication > 4/5
- Renewal save rate for customers with blocking requests > 70%
