# PRD-200: Chargebee Subscription Management

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-200 |
| **Title** | Chargebee Subscription Management |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations using Chargebee for subscription management need billing data integrated with customer success workflows. Subscription lifecycle events, revenue metrics, and payment status should be visible to CSMs and incorporated into health scoring.

## User Stories

### Primary User Stories
1. **As a CSM**, I want subscription and billing data from Chargebee visible in CSCX.AI customer context.
2. **As a CSM**, I want alerts on subscription changes (upgrades, downgrades, cancellations).
3. **As CSCX.AI**, I want Chargebee subscription data for accurate MRR tracking and health scoring.

### Secondary User Stories
4. **As a CSM**, I want to see subscription usage vs entitlements for expansion conversations.
5. **As a Finance person**, I want CSMs informed about billing issues for coordinated resolution.

## Functional Requirements

### FR-1: API Authentication
- Support Chargebee API key authentication
- Site/subdomain configuration
- Read access to subscriptions, customers, invoices

### FR-2: Customer Sync
- Match Chargebee customers to CSCX customers
- Sync customer attributes:
  - Name, email
  - Company
  - Custom fields
- Handle customer merges

### FR-3: Subscription Sync
- Pull subscription data:
  - Plan details
  - Status
  - MRR/ARR
  - Addons
  - Billing cycle
  - Next renewal date
- Track changes over time

### FR-4: Invoice and Payment Sync
- Sync invoice history
- Track payment status
- Monitor failed payments
- Calculate payment health

### FR-5: Webhook Events
- Receive Chargebee webhooks:
  - Subscription created/updated/cancelled
  - Invoice generated/paid/failed
  - Payment source expiring
- Real-time processing

### FR-6: MRR Analytics
- Calculate MRR from subscriptions
- Track MRR changes
- Categorize: new, expansion, contraction, churn
- Feed to revenue reports

### FR-7: Risk Signals
- Create signals for:
  - Subscription downgrade
  - Cancellation scheduled
  - Payment failures
  - Dunning initiated
- Integrate with health score

## Non-Functional Requirements

### NFR-1: Performance
- Webhook processing < 3 seconds
- Full sync: 5000 subscriptions in 15 minutes

### NFR-2: Accuracy
- MRR calculation accuracy > 99.9%
- Subscription status always current

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/chargebee/connect
POST   /api/integrations/chargebee/webhook
GET    /api/chargebee/customer/:customerId
GET    /api/chargebee/subscriptions/:customerId
GET    /api/chargebee/invoices/:customerId
GET    /api/chargebee/mrr/:customerId
POST   /api/chargebee/sync
```

### Chargebee API Usage
```javascript
// List subscriptions
GET https://{site}.chargebee.com/api/v2/subscriptions
?customer_id[is]={customer_id}

// Get customer
GET https://{site}.chargebee.com/api/v2/customers/{customer_id}

// List invoices
GET https://{site}.chargebee.com/api/v2/invoices
?customer_id[is]={customer_id}
```

### Database Schema
```sql
CREATE TABLE chargebee_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  chargebee_subscription_id TEXT UNIQUE,
  chargebee_customer_id TEXT,
  plan_id TEXT,
  plan_name TEXT,
  status VARCHAR(20),
  mrr_cents INTEGER,
  billing_period INTEGER,
  billing_period_unit VARCHAR(10),
  next_billing_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE chargebee_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chargebee_customer_id TEXT,
  chargebee_invoice_id TEXT UNIQUE,
  amount_cents INTEGER,
  status VARCHAR(20),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  dunning_status VARCHAR(20)
);
```

## User Interface

### Subscription Widget
- Current plan display
- MRR badge
- Renewal countdown
- Status indicator

### Billing History
- Invoice list
- Payment status
- Dunning alerts

## Acceptance Criteria

### AC-1: Connection
- [ ] API key authentication works
- [ ] Customer mapping accurate

### AC-2: Data Sync
- [ ] Subscriptions sync correctly
- [ ] Invoices display properly
- [ ] MRR accurate

### AC-3: Events
- [ ] Webhooks process correctly
- [ ] Alerts trigger appropriately

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show Chargebee subscription for [account]" | Display subscription |
| "What's the MRR for [account]?" | Show revenue |
| "Any billing issues for [account]?" | Check status |

## Success Metrics
| Metric | Target |
|--------|--------|
| Sync accuracy | > 99% |
| MRR calculation accuracy | > 99.9% |

## Related PRDs
- PRD-199: Stripe Billing Integration
- PRD-092: Invoice Overdue → Collections Alert
