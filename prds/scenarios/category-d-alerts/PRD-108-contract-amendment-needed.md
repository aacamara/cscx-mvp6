# PRD-108: Contract Amendment Needed

## Metadata
- **PRD ID**: PRD-108
- **Category**: D - Alerts & Triggers
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Contract Management, Usage Tracking, Entitlement Management

---

## 1. Overview

### 1.1 Problem Statement
Situations arise where the current contract no longer reflects reality: usage exceeds limits, needs have changed, or scope creep has occurred. CSMs need proactive alerts when contract amendments may be needed to regularize the relationship, capture additional revenue, or address customer requests properly.

### 1.2 Solution Summary
Implement detection of situations requiring contract amendments (usage overages, scope changes, term modifications) and alert CSMs with context and recommended amendment types.

### 1.3 Success Metrics
- Detect amendment needs within 7 days
- Convert 60% of overage situations to formal amendments
- Reduce revenue leakage from unenforced overages
- Improve contract accuracy and compliance

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when a contract amendment may be needed
**So that** I can proactively address the situation with the customer and capture appropriate revenue

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to know the specific reason an amendment is needed, so I can have an informed conversation.

**US-3**: As a Finance/Legal team member, I want visibility into pending amendment needs for compliance tracking.

---

## 3. Functional Requirements

### 3.1 Amendment Triggers

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Detect usage exceeding contracted limits | Must |
| FR-1.2 | Detect seat count overages | Must |
| FR-1.3 | Detect requests for out-of-scope services | Should |
| FR-1.4 | Detect significant use case changes | Should |
| FR-1.5 | Detect requests for early renewal/term extension | Should |

### 3.2 Alert Content

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Include contract terms and current state | Must |
| FR-2.2 | Include overage details if applicable | Must |
| FR-2.3 | Suggest amendment type | Should |
| FR-2.4 | Estimate revenue impact | Should |

---

## 4. Technical Specifications

### 4.1 Detection Logic

```typescript
const AMENDMENT_TRIGGERS = [
  {
    type: 'usage_overage',
    detect: (customer) => customer.usage.apiCalls > customer.contract.apiLimit * 1.1,
    details: (customer) => ({
      contracted: customer.contract.apiLimit,
      actual: customer.usage.apiCalls,
      overage_percent: ((customer.usage.apiCalls - customer.contract.apiLimit) / customer.contract.apiLimit * 100)
    })
  },
  {
    type: 'seat_overage',
    detect: (customer) => customer.activeUsers > customer.contract.seats,
    details: (customer) => ({
      contracted: customer.contract.seats,
      actual: customer.activeUsers,
      additional_seats: customer.activeUsers - customer.contract.seats
    })
  }
];
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:memo: Contract Amendment Needed: TechFlow Inc

Amendment Type: Usage Overage

Current Situation:
- Contracted API Calls: 1,000,000/month
- Actual Usage: 1,450,000/month
- Overage: 45%

This overage has persisted for 3 months.

Estimated Amendment Value: $2,500/month ($30,000 annually)

Customer Context:
- Current ARR: $85,000
- Contract End: Aug 2026
- Relationship Health: Good (78)

Options:
1. Upgrade to next tier (includes 2M API calls)
2. Add API call overage package
3. Negotiate custom arrangement

[Draft Amendment Discussion Email] [View Contract] [Calculate Upgrade Options]
```

---

## 6. Related PRDs
- PRD-042: Contract Amendment Request
- PRD-067: Contract Terms Quick Reference
- PRD-093: Contract Auto-Renewal - Review Trigger
