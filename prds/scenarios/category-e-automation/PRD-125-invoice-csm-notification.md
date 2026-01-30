# PRD-125: Invoice Generated → CSM Notification

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-125 |
| **Title** | Invoice Generated → CSM Notification |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs are often unaware when invoices are generated for their accounts, missing opportunities to preemptively address billing questions, ensure customer satisfaction with value received, and identify potential payment issues before they escalate.

## User Story
**As a** CSM
**I want** notification when invoices are generated for my accounts
**So that** I can proactively support customers with billing questions and reinforce value before payment

## Functional Requirements

### FR-1: Invoice Detection
- Detect invoice generation via:
  - Stripe webhook
  - Chargebee webhook
  - Salesforce billing integration
  - Manual invoice upload
- Capture invoice details

### FR-2: Invoice Context
- Associate invoice with customer context:
  - Customer name and health score
  - Contract details
  - Previous payment history
  - Upcoming renewal date
  - Recent support issues (if any)
  - Value delivered this period

### FR-3: CSM Notification
- Notify CSM with:
  - Invoice amount and due date
  - Customer health status
  - Payment history summary
  - Recommended actions
- Channels: In-app, Slack (for high-value), email digest

### FR-4: Risk Assessment
- Flag potential payment risks:
  - First invoice (new customer)
  - Significant amount change
  - Customer health declining
  - Previous late payments
  - Contract dispute history
- Recommend proactive outreach

### FR-5: Value Reinforcement Prompt
- For strategic accounts, prompt CSM to:
  - Send value summary before payment
  - Schedule check-in call
  - Share success metrics
  - Address any concerns proactively

### FR-6: Payment Tracking
- Track payment status:
  - Pending
  - Paid
  - Overdue
  - Failed
- Alert CSM to overdue invoices

## Non-Functional Requirements

### NFR-1: Timeliness
- Notification within 1 hour of invoice generation
- Real-time payment status updates

### NFR-2: Filtering
- Configurable notification thresholds
- Avoid notification fatigue

## Technical Specifications

### Data Model
```typescript
interface InvoiceNotification {
  id: string;
  invoiceId: string;
  customerId: string;
  csmId: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue' | 'failed';
  riskFlags: string[];
  customerContext: {
    healthScore: number;
    paymentHistory: 'excellent' | 'good' | 'fair' | 'poor';
    renewalDate: Date;
    recentIssues: boolean;
  };
  notifiedAt: Date;
  acknowledgedAt: Date | null;
  actionTaken: string | null;
}
```

### API Endpoints
- `POST /api/webhooks/billing/invoice` - Invoice webhook
- `GET /api/invoices/customer/:customerId` - Customer invoices
- `PUT /api/invoices/:invoiceId/acknowledge` - Acknowledge notification
- `GET /api/invoices/csm/:csmId/pending` - CSM pending invoices

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Stripe | IN | Invoice data |
| Chargebee | IN | Invoice data |
| Slack | OUT | Notifications |

## Acceptance Criteria

- [ ] Invoice generation triggers notification
- [ ] Context enrichment accurate
- [ ] Risk flags correctly identified
- [ ] Payment tracking functional
- [ ] Overdue alerts working

## Dependencies
- PRD-199: Stripe Billing Integration
- PRD-200: Chargebee Subscription Management
- PRD-092: Invoice Overdue → Collections Alert

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Notification delivery | < 1 hour | Invoice to notification |
| Proactive outreach rate | > 30% | CSM contact before payment |
| On-time payment rate | +5% | Compared to baseline |

## Implementation Notes
- Use billing system webhooks
- Consider batch notifications for high-volume accounts
- Integrate with value summary generation
