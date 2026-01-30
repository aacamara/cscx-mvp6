# PRD-015: Invoice History Upload → Payment Pattern Analysis

## Metadata
- **PRD ID**: PRD-015
- **Category**: A - Documents & Data Processing
- **Priority**: P2
- **Estimated Complexity**: Medium
- **Dependencies**: Finance data processing, risk signals

## Scenario Description
A CSM uploads invoice history data to analyze payment patterns, identify customers with payment issues, detect early warning signs of financial stress, and prepare for renewal conversations with accurate payment context.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload invoice history and receive payment pattern analysis,
**So that** I can identify accounts with payment issues and prepare appropriately for renewals.

## Trigger
CSM uploads invoice data via Chat UI with a message like "Analyze payment patterns from these invoices."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Customer ARR | `customers.arr` | Implemented | Current ARR stored |
| Renewal tracking | `renewal_pipeline` | Implemented | Renewal status |
| Contract terms | `contracts` | Implemented | Payment terms in contracts |
| Risk signals | `risk_signals` | Implemented | Can store payment risks |

### What's Missing
- [ ] Invoice data upload and parsing
- [ ] Payment timeline analysis
- [ ] Late payment pattern detection
- [ ] Days Sales Outstanding (DSO) calculation
- [ ] Payment trend visualization
- [ ] Financial health scoring
- [ ] Collection risk prediction

## Detailed Workflow

### Step 1: Invoice Upload
**User Action**: CSM uploads invoice export
**System Response**:
- Accepts CSV/Excel from billing system
- Maps columns: invoice ID, customer, amount, date, due date, paid date, status
- Associates with customer records
- Reports: "Found 456 invoices for 78 customers over 12 months"

### Step 2: Payment Analysis
**User Action**: CSM initiates analysis
**System Response**:
- Calculates payment metrics per customer
- Identifies late payment patterns
- Detects trend changes (improving/worsening)
- Computes DSO and other KPIs
- Flags anomalies and risks

### Step 3: Risk Assessment
**User Action**: CSM reviews patterns
**System Response**:
- Ranks customers by payment risk
- Identifies early warning signals
- Shows payment behavior trends
- Correlates with other health indicators

### Step 4: Action & Preparation
**User Action**: CSM takes action
**System Response**:
- Creates risk signals for problem accounts
- Prepares renewal briefings with payment context
- Suggests collection outreach
- Updates customer financial profiles

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/finance/invoiceParser.ts` | Parse invoice data |
| `server/src/services/finance/paymentAnalyzer.ts` | Analyze payment patterns |
| `server/src/services/finance/dsoCalculator.ts` | Calculate DSO metrics |
| `components/Finance/PaymentPatterns.tsx` | Payment visualization |
| `components/Finance/CollectionRisk.tsx` | Risk dashboard |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/invoices/upload` | POST | Upload invoice data |
| `POST /api/invoices/analyze` | POST | Run payment analysis |
| `GET /api/invoices/patterns/:customerId` | GET | Customer payment patterns |
| `GET /api/invoices/at-risk` | GET | List payment risk accounts |

### Payment Metrics
| Metric | Description |
|--------|-------------|
| On-Time Rate | % invoices paid by due date |
| Average Days to Pay | Mean time from invoice to payment |
| DSO | Days Sales Outstanding |
| Late Payment Trend | Improving, stable, worsening |
| Outstanding Balance | Current unpaid amount |
| Dispute Rate | % of invoices disputed |

## Chat UI Flow
```
CSM: [Uploads invoice_history_2025.csv] Analyze payment patterns from these invoices

System: 📊 Processing invoice data...

Found: 456 invoices
Customers: 78
Date range: January - December 2025
Total invoiced: $4.8M
Total collected: $4.6M

Analyzing payment patterns...

---

**💳 Payment Pattern Analysis Complete**

**Portfolio Overview**
- Average On-Time Rate: 82%
- Average Days to Pay: 34 days (target: 30)
- DSO: 38 days
- Outstanding: $185,000 (4%)

---

**📈 Payment Performance by Segment**

| Segment | On-Time % | Avg Days | DSO | Outstanding |
|---------|-----------|----------|-----|-------------|
| Enterprise | 88% | 31 days | 35 | $45,000 |
| Mid-Market | 79% | 36 days | 41 | $89,000 |
| SMB | 74% | 42 days | 48 | $51,000 |

---

**🔴 High-Risk Payment Accounts**

| Customer | ARR | On-Time % | Avg Days | Outstanding | Risk |
|----------|-----|-----------|----------|-------------|------|
| **OldCorp** | $65K | 42% | 58 days | $24,500 | 🔴 Critical |
| **SmallBiz** | $28K | 55% | 49 days | $8,200 | 🔴 High |
| **TechLegacy** | $45K | 62% | 44 days | $12,000 | 🟡 Medium |

---

**📉 Payment Pattern Trends**

**Worsening (Action Needed):**

1. **OldCorp** - Pattern Deteriorating
   ```
   Q1: 67% on-time, 38 days avg
   Q2: 50% on-time, 48 days avg
   Q3: 42% on-time, 58 days avg
   Q4: 25% on-time, 72 days avg ⚠️
   ```
   - Outstanding: $24,500 (current + 30 days past due)
   - Signal: Potential financial distress

2. **SmallBiz** - Intermittent Issues
   ```
   Pattern: Pays late consistently, catches up quarterly
   ```
   - Issue: Cash flow timing, not inability to pay
   - Risk: Lower but requires monitoring

---

**🟢 Payment Improvers**

| Customer | Previous | Current | Change |
|----------|----------|---------|--------|
| DataPro | 68% | 89% | ⬆️ +21% |
| CloudMax | 72% | 88% | ⬆️ +16% |
| TechCorp | 75% | 91% | ⬆️ +16% |

---

**⚠️ Early Warning Signals**

1. **GrowthStartup** - New pattern emerging
   - Last 3 invoices: 15, 22, 38 days (trending up)
   - Previously consistent at 20 days
   - Signal: Possible cash flow constraint

2. **MediaCo** - First late payment
   - 12 months on-time, then 45 days on latest
   - Signal: Investigate - could be one-off or emerging issue

---

**💡 Recommended Actions**

**For OldCorp (Critical):**
1. Finance escalation - arrange payment plan
2. Review upcoming renewal terms
3. Consider executive conversation about partnership value

**For SmallBiz (High):**
1. Offer alternative payment schedule (monthly vs quarterly)
2. Set up automatic payment reminders
3. Discuss cash flow friendly options

**For GrowthStartup (Monitor):**
1. Check in with champion about business status
2. Early renewal discussion with incentives
3. Monitor next invoice closely

Would you like me to:
[Create Risk Signals] [Prepare Renewal Briefings] [Draft Collection Outreach] [Export Full Report]

CSM: Create risk signals and prepare renewal briefing for OldCorp

System: ✅ Actions Complete!

**Risk Signal Created:**

🔴 **OldCorp - Payment Risk**
- Type: payment_risk
- Severity: Critical
- Details: Payment on-time rate dropped from 67% to 25% over 4 quarters
- Outstanding: $24,500 (38% of ARR)
- Pattern: Worsening payment behavior indicating potential financial stress
- Recommended: Finance escalation, renewal strategy review

---

**📋 Renewal Briefing: OldCorp**

**Renewal Date:** April 15, 2026 (76 days away)
**Current ARR:** $65,000

---

**⚠️ Payment Context**

**Red Flags:**
- On-time payment rate declined from 67% → 25%
- Average days to pay increased from 38 → 72 days
- Current outstanding balance: $24,500 (37% of ARR)
- 2 invoices past 60 days

**Historical Pattern:**
| Quarter | On-Time | Avg Days | Outstanding |
|---------|---------|----------|-------------|
| Q1 2025 | 67% | 38 | $0 |
| Q2 2025 | 50% | 48 | $8,200 |
| Q3 2025 | 42% | 58 | $16,000 |
| Q4 2025 | 25% | 72 | $24,500 |

---

**📊 Renewal Risk Assessment**

- **Financial Risk:** High - payment pattern suggests cash constraints
- **Renewal Probability:** 60% (down from 85% baseline)
- **Churn Risk:** Moderate-High if not addressed

---

**💡 Renewal Strategy Recommendations**

1. **Address Outstanding Balance First**
   - Don't discuss renewal until payment plan in place
   - Offer finance team involvement

2. **Consider Restructured Terms**
   - Monthly billing vs annual
   - Reduced commitment with usage-based component
   - Multi-year discount if prepaid (improves their cash flow planning)

3. **Validate Value**
   - Document ROI to justify continued investment
   - Ensure they're getting value for current spend

4. **Escalation Path**
   - If no progress in 2 weeks, involve your manager
   - Prepare for potential downgrade conversation

---

**🗣️ Talking Points for Call**

> "Before we discuss the renewal, I wanted to check in on how things are going overall. I noticed some recent invoice delays and want to make sure everything is okay on your end."

> "We value our partnership and want to find a structure that works for both sides. Would a different billing cadence help with cash flow planning?"

---

[Save to Customer Record] [Schedule Renewal Call] [Draft Email to Finance]
```

## Acceptance Criteria
- [ ] Supports common billing export formats (CSV, Excel)
- [ ] Correctly maps invoice fields (amount, dates, status)
- [ ] Calculates DSO and on-time payment rate accurately
- [ ] Identifies payment pattern trends over time
- [ ] Detects early warning signals for new issues
- [ ] Ranks customers by payment risk
- [ ] Creates actionable risk signals
- [ ] Renewal briefings include payment context
- [ ] Correlates payment patterns with other health indicators
- [ ] Processing completes within 1 minute for 5,000 invoices

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-015-COMPLETE</promise>
```

### Success Metrics
- Payment risk identification > 30 days before escalation
- Collection rate improvement > 5%
- Renewal conversations with payment context > 90%
