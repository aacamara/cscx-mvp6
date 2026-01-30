# PRD-199: Stripe Billing Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-199 |
| **Title** | Stripe Billing Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs lack visibility into billing status and payment history for their accounts. Failed payments, subscription changes, and billing disputes are risk signals that should be visible in customer context. Without Stripe integration, CSMs learn about payment issues reactively rather than proactively.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see subscription status and billing health for my accounts so I can identify payment risks early.
2. **As a CSM**, I want to be alerted when a customer has failed payments so I can coordinate with finance.
3. **As CSCX.AI**, I want payment status included in risk signal detection.

### Secondary User Stories
4. **As a CSM**, I want to see MRR/ARR calculated from Stripe data for accurate revenue tracking.
5. **As a Finance person**, I want CSM visibility into billing issues for faster resolution.

## Functional Requirements

### FR-1: Stripe Connect Authentication
- Support Stripe Connect OAuth
- Alternative: Restricted API key
- Read-only access to billing data

### FR-2: Customer Sync
- Match Stripe customers to CSCX customers
- Sync by:
  - Email domain
  - Company name
  - Metadata (customer_id)
- Handle multiple Stripe customers per account

### FR-3: Subscription Data Sync
- Sync subscription details:
  - Plan/price
  - Status (active, past_due, canceled)
  - Current period dates
  - Quantity/seats
  - MRR calculation
- Track subscription changes

### FR-4: Invoice Sync
- Pull invoice history
- Track:
  - Amount, status
  - Due date, paid date
  - Line items
  - Payment attempts
- Calculate payment patterns

### FR-5: Payment Status Tracking
- Monitor payment method status
- Track failed payments
- Alert on:
  - Payment failures
  - Card expiring
  - Subscription past due
  - Dunning status

### FR-6: Webhook Events
- Receive Stripe webhooks:
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
- Process in real-time

### FR-7: Risk Signal Integration
- Create risk signals for:
  - Failed payments
  - Subscription downgrade
  - Cancellation requested
  - Dunning in progress
- Include in health score

## Non-Functional Requirements

### NFR-1: Performance
- Webhook processing < 3 seconds
- Historical sync: 1000 customers in 10 minutes

### NFR-2: Security
- PCI DSS awareness (no card data stored)
- Encrypted token storage
- Audit logging

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/stripe/connect
GET    /api/integrations/stripe/callback
POST   /api/integrations/stripe/webhook
GET    /api/stripe/customer/:customerId
GET    /api/stripe/subscriptions/:customerId
GET    /api/stripe/invoices/:customerId
GET    /api/stripe/mrr/:customerId
```

### Stripe API Usage
```javascript
// List subscriptions
GET https://api.stripe.com/v1/subscriptions
?customer={stripe_customer_id}
&status=all

// List invoices
GET https://api.stripe.com/v1/invoices
?customer={stripe_customer_id}
&limit=100

// Webhook event
{
  "type": "invoice.payment_failed",
  "data": {
    "object": {
      "customer": "cus_123",
      "subscription": "sub_456",
      "amount_due": 10000,
      "attempt_count": 2
    }
  }
}
```

### Database Schema
```sql
CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  stripe_customer_id TEXT UNIQUE,
  email TEXT,
  name TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT REFERENCES stripe_customers(stripe_customer_id),
  stripe_subscription_id TEXT UNIQUE,
  status VARCHAR(20),
  plan_name TEXT,
  mrr_cents INTEGER,
  quantity INTEGER,
  current_period_start DATE,
  current_period_end DATE,
  cancel_at_period_end BOOLEAN,
  updated_at TIMESTAMPTZ
);

CREATE TABLE stripe_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id TEXT,
  stripe_invoice_id TEXT UNIQUE,
  amount_cents INTEGER,
  status VARCHAR(20),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  attempt_count INTEGER,
  created_at TIMESTAMPTZ
);
```

## User Interface

### Billing Status Widget
- Subscription status indicator
- MRR display
- Next invoice date
- Payment health icon

### Invoice History
- List of invoices
- Status badges
- Failed payment highlighting
- Payment attempt details

### Billing Alerts
- Failed payment notices
- Expiring card warnings
- Dunning status

## Acceptance Criteria

### AC-1: Connection
- [ ] Stripe OAuth/API key works
- [ ] Customer matching accurate
- [ ] Webhooks verified

### AC-2: Data Sync
- [ ] Subscriptions sync correctly
- [ ] Invoices display properly
- [ ] MRR calculates accurately

### AC-3: Alerts
- [ ] Failed payments create signals
- [ ] CSM receives alerts
- [ ] Health score reflects status

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "What's the billing status for [account]?" | Show subscription |
| "Any failed payments for [account]?" | Check invoices |
| "Show MRR for [account]" | Display revenue |
| "Alert me on payment failures" | Configure alerts |

## Success Metrics
| Metric | Target |
|--------|--------|
| Payment issue detection | < 5 minutes |
| Billing data accuracy | > 99% |
| CSM awareness of payment issues | 95% within 1 hour |

## Related PRDs
- PRD-200: Chargebee Subscription Management
- PRD-092: Invoice Overdue → Collections Alert
- PRD-066: Billing & Payment Status
