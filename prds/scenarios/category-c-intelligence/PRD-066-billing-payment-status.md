# PRD-066: Billing & Payment Status

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Provide CSMs with real-time visibility into customer billing and payment status, including invoice history, payment patterns, outstanding balances, and payment health. This intelligence enables proactive engagement before payment issues impact the customer relationship and helps CSMs prepare for financial conversations.

## User Story
As a CSM, I want to see my customer's billing and payment status so that I can proactively address payment issues, prepare for contract conversations, and understand the financial health of the relationship.

As a CS Leader, I want to see payment patterns across the portfolio so that I can identify collection risks and coordinate with Finance on at-risk accounts.

## Trigger
- Navigation: Customer Detail > Billing Tab
- Natural language: "Show me billing status for [Account]"
- Variations: "Payment history for [Account]", "Are there any outstanding invoices?", "Invoice status"
- Alert: Triggered when payment is overdue

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to display |
| Time Period | String | No | Invoice history period (default: 12 months) |
| Include Pending | Boolean | No | Show upcoming invoices |

## Billing Metrics
### Payment Health Indicators
| Metric | Description | Health Threshold |
|--------|-------------|------------------|
| Payment Score | Overall payment reliability | > 90 = Good |
| On-Time Rate | % invoices paid on time | > 95% |
| Avg Days to Pay | Average payment time | < Net terms |
| Outstanding Balance | Current unpaid amount | $0 |
| Days Outstanding | Avg age of unpaid invoices | < 30 days |

### Invoice Status Types
| Status | Description | Action Required |
|--------|-------------|-----------------|
| Paid | Invoice fully paid | None |
| Pending | Invoice sent, not yet due | Monitor |
| Overdue | Past due date | Follow up |
| Partially Paid | Partial payment received | Follow up |
| Disputed | Customer disputing charges | Resolve |
| Written Off | Deemed uncollectible | Record |

## Process Flow
```
Request Billing Status
          │
          ▼
┌──────────────────────────┐
│ Fetch Billing Data       │
│ (Integration/Contracts)  │
└───────────┬──────────────┘
            │
    ┌───────┴───────┬───────────────┬────────────────┐
    ▼               ▼               ▼                ▼
┌──────────┐ ┌───────────┐ ┌─────────────┐ ┌────────────┐
│Invoice   │ │Payment    │ │Subscription │ │Credit      │
│History   │ │History    │ │Details      │ │Status      │
└─────┬────┘ └─────┬─────┘ └──────┬──────┘ └─────┬──────┘
      │            │              │               │
      └────────────┴──────────────┴───────────────┘
                          │
                          ▼
           ┌──────────────────────────┐
           │ Calculate Payment Health │
           │ Score & Patterns         │
           └───────────┬──────────────┘
                       │
                       ▼
              Render Billing View
```

## Output Format
```markdown
## Billing & Payment Status: Acme Corp
Updated: [Timestamp]

### Payment Health Score: 95/100 (Excellent)
[Gauge visualization]

### Quick Summary
| Metric | Value | Status |
|--------|-------|--------|
| Current ARR | $150,000 | |
| Contract Term | Annual | |
| Billing Cycle | Monthly | |
| Payment Terms | Net 30 | |
| On-Time Rate | 96% | ✓ |
| Outstanding Balance | $0 | ✓ |

---

### Outstanding Invoices

**No outstanding invoices** ✓

[or if there are outstanding invoices:]

| Invoice # | Date | Amount | Due Date | Status | Days Over |
|-----------|------|--------|----------|--------|-----------|
| INV-2026-0089 | Jan 15 | $12,500 | Feb 14 | Overdue | 15 days |
| INV-2026-0102 | Feb 1 | $12,500 | Mar 3 | Pending | - |

**Total Outstanding**: $12,500
**Oldest Invoice**: 15 days overdue

[Contact Finance] [Send Payment Reminder] [View in Billing System]

---

### Invoice History (Last 12 Months)

| Invoice # | Date | Amount | Paid Date | Days to Pay | Status |
|-----------|------|--------|-----------|-------------|--------|
| INV-2026-0089 | Jan 15 | $12,500 | - | - | Overdue |
| INV-2025-0456 | Dec 15 | $12,500 | Dec 28 | 13 | Paid |
| INV-2025-0398 | Nov 15 | $12,500 | Nov 22 | 7 | Paid |
| INV-2025-0342 | Oct 15 | $12,500 | Oct 30 | 15 | Paid |
| INV-2025-0287 | Sep 15 | $12,500 | Sep 28 | 13 | Paid |
| ... | ... | ... | ... | ... | ... |

**12-Month Summary**:
- Total Invoiced: $150,000
- Total Paid: $137,500
- Outstanding: $12,500
- Average Days to Pay: 12 days

[Export Invoice History] [View All Invoices]

---

### Payment Pattern Analysis

#### Payment Timing
[Bar chart: Days to pay by month]

Average: 12 days | Best: 7 days | Worst: 22 days

#### Payment Method
| Method | % of Payments |
|--------|---------------|
| ACH Transfer | 75% |
| Credit Card | 25% |
| Check | 0% |

#### Seasonal Patterns
- Q1: Typically pays within 10 days
- Q4: Slower payments (holiday periods) - avg 18 days

---

### Subscription Details

#### Current Subscription
| Product | Quantity | Unit Price | Monthly |
|---------|----------|------------|---------|
| Enterprise Plan | 1 | $10,000 | $10,000 |
| Additional Users | 50 | $50 | $2,500 |
| **Total** | | | **$12,500** |

#### Upcoming Changes
- **Feb 15, 2026**: Price increase effective (+5%)
- **Jan 15, 2027**: Renewal due

---

### Credits & Adjustments

| Date | Type | Amount | Reason | Status |
|------|------|--------|--------|--------|
| Oct 10, 2025 | Credit | -$2,500 | Service disruption compensation | Applied |
| Aug 15, 2025 | Adjustment | -$500 | Billing error correction | Applied |

**Available Credit Balance**: $0

---

### Risk Indicators

| Indicator | Status | Notes |
|-----------|--------|-------|
| Payment Trend | ● Stable | Consistent payment pattern |
| Recent Late Payments | ✓ None | Last 6 months all on time |
| Disputed Invoices | ✓ None | No active disputes |
| Credit Limit | ✓ OK | Within approved terms |
| Financial News | ● Monitor | No concerning news detected |

---

### Recommended Actions

**Current**: No action required - payment health is excellent

**Proactive**:
1. Thank customer for consistent on-time payments in next QBR
2. Discuss auto-pay enrollment to simplify their process

### Quick Actions
[Send Invoice] [Request Payment] [Add Credit] [Contact Finance]

---

### Finance Contact
**Accounts Receivable**: ar@yourcompany.com
**Customer's AP Contact**: Sarah Chen (sarah@acme.com)
```

## Acceptance Criteria
- [ ] Current outstanding balance displayed
- [ ] Invoice history shows last 12 months
- [ ] Payment health score calculated
- [ ] Overdue invoices highlighted prominently
- [ ] Days to pay tracked per invoice
- [ ] Payment patterns analyzed
- [ ] Subscription details shown
- [ ] Credits and adjustments visible
- [ ] Quick actions functional
- [ ] Integration with billing system works
- [ ] Export to PDF/CSV available

## API Endpoint
```
GET /api/intelligence/billing/:customerId
  Query: ?period=12m&includePending=true

Response: {
  healthScore: number;
  summary: BillingSummary;
  outstanding: Invoice[];
  invoiceHistory: Invoice[];
  subscription: SubscriptionDetails;
  credits: CreditAdjustment[];
  patterns: PaymentPatterns;
  riskIndicators: RiskIndicator[];
}
```

## Data Sources
| Source | Integration | Data |
|--------|-------------|------|
| Stripe | API | Invoices, payments, subscriptions |
| Chargebee | API | Billing data |
| QuickBooks | API | Invoices, payments |
| Contracts | `contracts` table | Contract terms, ARR |
| Internal | `billing_history` table | Fallback storage |

## Integration Requirements
- Billing platform API access (read-only minimum)
- Customer ID mapping between systems
- Real-time webhook for payment events
- Historical data sync on connection

## Alert Triggers
| Condition | Alert | Priority |
|-----------|-------|----------|
| Invoice overdue > 15 days | CSM notification | High |
| Invoice overdue > 30 days | CSM + Manager notification | Critical |
| Invoice disputed | CSM notification | Medium |
| Payment failed | CSM notification | High |
| Credit applied | CSM FYI | Low |

## Error Handling
| Error | Response |
|-------|----------|
| No billing integration | "Connect billing platform for payment visibility" |
| No billing data | "No billing records found for this account" |
| Integration error | "Unable to fetch billing data. Contact Finance directly." |

## Success Metrics
| Metric | Target |
|--------|--------|
| CSM Awareness of Overdue | 100% within 24 hours |
| Proactive Payment Conversations | +40% |
| Days Sales Outstanding (DSO) | -10% |
| Collection-Related Churn | -25% |

## Future Enhancements
- Payment prediction modeling
- Automated payment reminder sequences
- Self-service payment portal integration
- Multi-currency support
- Revenue recognition tracking

## Related PRDs
- PRD-092: Invoice Overdue Alert
- PRD-015: Invoice History Upload
- PRD-199: Stripe Billing Integration
- PRD-200: Chargebee Subscription Management
