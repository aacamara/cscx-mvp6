# PRD-092: Invoice Overdue - Collections Alert

## Metadata
- **PRD ID**: PRD-092
- **Category**: D - Alerts & Triggers
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Billing System Integration, Trigger Engine, Finance Team Routing

---

## 1. Overview

### 1.1 Problem Statement
Overdue invoices create financial risk and can indicate deeper relationship issues. CSMs often learn about payment problems late in the collections process, missing opportunities to understand underlying concerns and maintain relationship quality. Early CSM involvement can help distinguish between administrative issues and genuine customer dissatisfaction.

### 1.2 Solution Summary
Implement an automated alert system that detects overdue invoices and notifies CSMs at key aging milestones (7, 14, 30, 60 days). The alert includes context about the customer relationship, suggests appropriate outreach, and coordinates with the finance team to ensure aligned communication.

### 1.3 Success Metrics
- Reduce average days-to-payment by 20%
- Increase CSM awareness of payment issues within 7 days of due date
- Reduce involuntary churn due to billing issues by 50%
- Maintain customer satisfaction during collections process

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when my customer has an overdue invoice
**So that** I can proactively check in and address any underlying issues

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to understand the context (is this a first-time issue or pattern?), so I can calibrate my approach.

**US-3**: As a Finance team member, I want CSM visibility into collections, so we can coordinate our outreach.

**US-4**: As a CSM, I want to know if there are any open support tickets or complaints that might explain delayed payment, so I can address root causes.

---

## 3. Functional Requirements

### 3.1 Overdue Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Monitor invoice due dates from billing system | Must |
| FR-1.2 | Trigger alerts at aging milestones: 7, 14, 30, 60 days overdue | Must |
| FR-1.3 | Calculate total outstanding amount per customer | Must |
| FR-1.4 | Track payment history and identify patterns | Should |
| FR-1.5 | Distinguish between admin delay vs potential dispute | Should |

### 3.2 Alert Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Create risk_signal with type "invoice_overdue" | Must |
| FR-2.2 | Severity escalates with age: 7d=low, 14d=medium, 30d=high, 60d=critical | Must |
| FR-2.3 | Include invoice details, total outstanding, payment history | Must |
| FR-2.4 | Correlate with recent support tickets or complaints | Should |

### 3.3 Coordination Workflow

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Notify CSM with appropriate context | Must |
| FR-3.2 | Copy/notify Finance team on escalated items (30+ days) | Must |
| FR-3.3 | Suggest soft check-in approach for early alerts | Should |
| FR-3.4 | Track CSM and Finance actions in shared view | Should |

---

## 4. Technical Specifications

### 4.1 API Endpoints

```typescript
// Get overdue invoices for customer
GET /api/customers/:customerId/billing/overdue
Response: {
  totalOutstanding: number,
  invoices: Invoice[],
  paymentHistory: PaymentRecord[],
  isFirstTimeOverdue: boolean
}

// Manual billing check
POST /api/billing/check-overdue
Body: { customerId?: string }
```

### 4.2 Workflow Definition

```yaml
workflow: invoice_overdue_alert
version: 1.0
trigger:
  type: scheduled
  schedule: "0 9 * * *" # Daily at 9 AM

steps:
  - id: check_overdue
    action: query_billing_system
    config:
      filter: "due_date < NOW() AND status != 'paid'"

  - id: notify_7_day
    condition: "{{days_overdue}} >= 7 AND {{days_overdue}} < 14"
    action: slack_dm
    config:
      message_template: "invoice_overdue_soft"
      severity: low

  - id: notify_30_day
    condition: "{{days_overdue}} >= 30"
    action: notify_multiple
    config:
      recipients: ["csm", "finance"]
      message_template: "invoice_overdue_escalation"
      severity: high
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format (30-Day)

```
:warning: Invoice Overdue: Acme Corp

Invoice #INV-2024-001 is 32 days past due

Amount: $12,500
Due Date: Dec 28, 2025
Current Status: 32 days overdue

Payment History:
- Previous 4 invoices: Paid on time
- This is first overdue occurrence

Context Check:
- No open support tickets
- Health Score: 75 (stable)
- Last meeting: Jan 15, 2026

Recommended Approach:
This may be an administrative issue. Consider a friendly check-in.

[Send Soft Check-In] [View Invoice] [View Customer]
```

---

## 6. Related PRDs
- PRD-066: Billing & Payment Status
- PRD-110: Billing Change Alert
- PRD-199: Stripe Billing Integration
