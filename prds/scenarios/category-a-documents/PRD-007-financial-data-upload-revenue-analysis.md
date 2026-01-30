# PRD-007: Financial Data Upload → Revenue Analysis

## Metadata
- **PRD ID**: PRD-007
- **Category**: A - Documents & Data Processing
- **Priority**: P1
- **Estimated Complexity**: High
- **Dependencies**: Customer records, billing integration concepts

## Scenario Description
A CSM uploads financial data (invoices, billing history, payment records) to analyze revenue patterns, identify payment issues, track expansion/contraction, and prepare for renewal conversations with accurate financial context.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload financial data and receive revenue analysis,
**So that** I can understand each customer's financial health and prepare for renewal discussions.

## Trigger
CSM uploads a CSV/Excel of financial data via Chat UI with a message like "Analyze this billing data for my accounts."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| ARR tracking | `customers` table | Implemented | Stores current ARR |
| Renewal pipeline | `renewal_pipeline` table | Implemented | Tracks renewal status |
| Contract ARR | `contracts` table | Implemented | Contract-level ARR |
| QBR metrics | `qbrs` table | Partial | Some financial context |

### What's Missing
- [ ] Payment history upload and parsing
- [ ] Revenue trend analysis over time
- [ ] Expansion/contraction tracking
- [ ] Payment risk detection (late payments, disputes)
- [ ] Revenue forecasting
- [ ] Multi-currency support
- [ ] Financial health scoring

## Detailed Workflow

### Step 1: File Upload
**User Action**: CSM uploads financial data export
**System Response**:
- Validates file format
- Detects data type (invoices, payments, billing summary)
- Maps columns: customer, amount, date, type, status
- Reports: "Found 1,234 transactions for 89 customers over 12 months"

### Step 2: Data Reconciliation
**User Action**: CSM confirms mappings
**System Response**:
- Matches transactions to existing customers
- Reconciles with current ARR records
- Identifies discrepancies
- Reports: "3 customers have ARR mismatches requiring review"

### Step 3: Revenue Analysis
**User Action**: CSM initiates analysis
**System Response**:
- Calculates revenue trends per customer
- Identifies expansion/contraction events
- Detects payment patterns and risks
- Computes financial health metrics

### Step 4: Insights & Actions
**User Action**: CSM reviews results
**System Response**:
- Displays revenue summary dashboard
- Highlights accounts with financial risks
- Identifies upsell opportunities based on growth
- Suggests renewal pricing strategies

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/finance/billingParser.ts` | Parse financial data exports |
| `server/src/services/analysis/revenueAnalysis.ts` | Revenue trend analysis |
| `server/src/services/analysis/paymentRisk.ts` | Payment risk detection |
| `components/Finance/RevenueAnalysis.tsx` | Revenue analysis dashboard |
| `components/Finance/ARRTimeline.tsx` | ARR trend visualization |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/finance/upload` | POST | Upload financial data |
| `POST /api/finance/reconcile` | POST | Reconcile with existing records |
| `GET /api/finance/analysis/:customerId` | GET | Customer revenue analysis |
| `GET /api/finance/portfolio` | GET | Portfolio financial summary |

### Analysis Outputs
| Metric | Description |
|--------|-------------|
| Revenue Trend | Month-over-month revenue change |
| Net Revenue Retention | Expansion - Contraction + Renewals |
| Payment Health | On-time payment rate, DSO |
| Expansion Velocity | Rate of growth within accounts |
| Contraction Risk | Accounts showing revenue decline |

## Chat UI Flow
```
CSM: [Uploads billing_history_2025.xlsx] Analyze this billing data

System: 📊 Processing financial data...

Detected: Billing History Export
Found: 1,234 transactions
Customers: 89
Date range: January - December 2025
Total revenue: $4.2M

Reconciling with customer records...

---

**💰 Revenue Analysis Complete**

**Portfolio Summary**
- Total ARR: $4.2M
- Net Revenue Retention: 108%
- Expansion Revenue: $520K
- Contraction: $180K
- Churn: $145K

---

**📈 Revenue Trends**

```
Q1 2025: $3.8M ████████████████████
Q2 2025: $3.9M █████████████████████
Q3 2025: $4.1M ██████████████████████
Q4 2025: $4.2M ██████████████████████▌
```

---

**🚀 Top Expansion Accounts**

| Customer | Start ARR | Current ARR | Growth | Expansion Events |
|----------|-----------|-------------|--------|------------------|
| TechCorp | $50K | $125K | +150% | 3 upsells |
| DataPro | $35K | $72K | +106% | 2 upsells |
| CloudMax | $80K | $145K | +81% | Product upgrade |

---

**⚠️ Revenue Risks**

| Customer | Current ARR | Issue | Risk Level |
|----------|-------------|-------|------------|
| **OldCorp** | $65K | 3 late payments, disputed invoice | 🔴 High |
| **SmallBiz** | $24K | Downgraded seats by 40% | 🟡 Medium |
| **LegacyCo** | $42K | No expansion in 24 months | 🟡 Medium |

---

**💵 Payment Health**

| Metric | Value | Benchmark |
|--------|-------|-----------|
| On-Time Payment Rate | 87% | 92% ⚠️ |
| Average Days to Pay | 38 days | 30 days ⚠️ |
| Outstanding Invoices | $145K | - |
| Disputed Amount | $28K | - |

---

**🎯 ARR Reconciliation Issues**

| Customer | Recorded ARR | Calculated ARR | Difference |
|----------|--------------|----------------|------------|
| BetaCorp | $45,000 | $52,000 | +$7,000 |
| GammaTech | $78,000 | $72,000 | -$6,000 |
| DeltaInc | $33,000 | $36,500 | +$3,500 |

Would you like me to:
[Update ARR Records] [Create Risk Signals for Payment Issues] [Prepare Renewal Briefings] [Export Financial Report]

CSM: Update ARR records and create risk signals

System: ✅ Updates Complete!

**ARR Records Updated:**
- BetaCorp: $45,000 → $52,000 ✓
- GammaTech: $78,000 → $72,000 ✓
- DeltaInc: $33,000 → $36,500 ✓

**Risk Signals Created:**

🔴 **OldCorp - Payment Risk**
- Type: payment_risk
- Severity: High
- Details: 3 late payments in past 6 months, $28K disputed invoice
- Recommended: Finance escalation, account review

🟡 **SmallBiz - Contraction Risk**
- Type: contraction
- Severity: Medium
- Details: 40% seat reduction in October
- Recommended: Value realization discussion

🟡 **LegacyCo - Expansion Stall**
- Type: expansion_risk
- Severity: Medium
- Details: No growth in 24 months, flat usage
- Recommended: Business review, uncover new use cases

All risk signals added to customer records.
```

## Acceptance Criteria
- [ ] Supports common billing export formats (CSV, Excel)
- [ ] Correctly parses invoice, payment, and credit memo transactions
- [ ] Multi-currency support with conversion to base currency
- [ ] Reconciliation identifies and explains ARR discrepancies
- [ ] Revenue trends calculated accurately over configurable periods
- [ ] Expansion/contraction events detected and quantified
- [ ] Payment risk scoring considers late payments, disputes, DSO
- [ ] NRR calculation matches standard SaaS methodology
- [ ] ARR updates create audit trail
- [ ] Processing completes within 1 minute for 10,000 transactions

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-007-COMPLETE</promise>
```

### Success Metrics
- ARR reconciliation accuracy > 98%
- Payment risk signals predict actual collection issues > 75%
- Expansion opportunities surfaced lead to upsell conversations > 30%
