# PRD-111: User Growth Alert

## Metadata
- **PRD ID**: PRD-111
- **Category**: D - Alerts & Triggers
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Usage Data API, User Tracking, Expansion Detection

---

## 1. Overview

### 1.1 Problem Statement
Rapid user growth at a customer account is a strong expansion signal. New users being added suggests the product is valuable and adoption is spreading. CSMs need to be aware of user growth to support adoption, ensure proper onboarding, and identify expansion opportunities.

### 1.2 Solution Summary
Implement monitoring for user growth that detects significant increases in active users or invited users. Alert CSMs with growth details and suggest appropriate actions (onboarding support, training resources, expansion conversation).

### 1.3 Success Metrics
- Detect user growth within 7 days
- Convert 40% of growth alerts to expansion conversations
- Improve new user onboarding completion rates
- Increase seat expansion revenue by 30%

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when a customer is adding many new users
**So that** I can support their growth and explore expansion opportunities

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to know if the growth is approaching or exceeding their seat limit.

**US-3**: As a CSM, I want to understand which departments/teams are growing.

---

## 3. Functional Requirements

### 3.1 Growth Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Track weekly new user additions | Must |
| FR-1.2 | Alert on >20% user growth in 30 days | Must |
| FR-1.3 | Alert when approaching seat limit (>80%) | Must |
| FR-1.4 | Alert when exceeding seat limit | Must |
| FR-1.5 | Identify growth by department/team | Should |

### 3.2 Alert Content

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Include growth metrics (count, percentage) | Must |
| FR-2.2 | Include seat utilization status | Must |
| FR-2.3 | Include new user details if available | Should |
| FR-2.4 | Suggest expansion conversation points | Should |

---

## 4. Technical Specifications

### 4.1 Detection Logic

```typescript
interface UserGrowthAnalysis {
  customerId: string;
  currentUsers: number;
  previousUsers: number; // 30 days ago
  contractedSeats: number;
  newUsersByDepartment: Record<string, number>;
}

function analyzeUserGrowth(analysis: UserGrowthAnalysis): GrowthAlert | null {
  const growthRate = (analysis.currentUsers - analysis.previousUsers) / analysis.previousUsers;
  const seatUtilization = analysis.currentUsers / analysis.contractedSeats;

  const alerts = [];

  if (growthRate >= 0.2) {
    alerts.push({ type: 'rapid_growth', rate: growthRate });
  }

  if (seatUtilization >= 0.8 && seatUtilization < 1) {
    alerts.push({ type: 'approaching_limit', utilization: seatUtilization });
  }

  if (seatUtilization >= 1) {
    alerts.push({ type: 'exceeds_limit', overage: analysis.currentUsers - analysis.contractedSeats });
  }

  return alerts.length > 0 ? { alerts, analysis } : null;
}
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:chart_with_upwards_trend: User Growth Alert: ScaleUp Inc

Significant User Growth Detected!

Growth Metrics:
- 30 days ago: 45 users
- Current: 68 users
- Growth: +23 users (+51%)

Seat Status:
- Contracted: 50 seats
- Current Usage: 68 users
- STATUS: EXCEEDS LIMIT by 18 seats

Growth by Team:
- Engineering: +12 users
- Product: +8 users
- Marketing: +3 users

Expansion Opportunity:
Estimated additional seat revenue: $9,000/year

Suggested Actions:
1. Congratulate on team growth
2. Offer training resources for new users
3. Discuss seat expansion to regularize usage

[Draft Expansion Email] [View User List] [Create Expansion Opportunity]
```

---

## 6. Related PRDs
- PRD-103: Expansion Signal Detected
- PRD-108: Contract Amendment Needed
- PRD-111: User Growth Alert
