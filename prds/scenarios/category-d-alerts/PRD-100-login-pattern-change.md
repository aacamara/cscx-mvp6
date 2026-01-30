# PRD-100: Login Pattern Change

## Metadata
- **PRD ID**: PRD-100
- **Category**: D - Alerts & Triggers
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Usage Data API, User Tracking, Trigger Engine

---

## 1. Overview

### 1.1 Problem Statement
Changes in user login patterns often precede churn or signal organizational changes. When daily users become weekly users, or when key users stop logging in entirely, it indicates diminishing engagement that requires intervention. CSMs need visibility into these behavioral shifts to act before the pattern becomes entrenched.

### 1.2 Solution Summary
Implement an automated login pattern monitoring system that detects significant changes in user login behavior at both individual and account levels. When concerning patterns emerge, alert CSMs with context and suggested re-engagement actions.

### 1.3 Success Metrics
- Detect login pattern changes within 7 days
- Reverse declining engagement patterns in 50% of flagged accounts
- Reduce churn among accounts with detected login declines by 30%
- Increase average login frequency for intervened accounts by 25%

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when users' login patterns change significantly
**So that** I can investigate and re-engage before they churn

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to know which specific users have changed their behavior, so I can target my outreach.

**US-3**: As a CSM, I want to distinguish between individual user changes and account-wide patterns, so I can understand the scope.

**US-4**: As a CS Manager, I want to see login trend data across the portfolio, so I can identify systemic issues.

---

## 3. Functional Requirements

### 3.1 Pattern Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Track login frequency per user (daily, weekly, monthly) | Must |
| FR-1.2 | Detect frequency downgrades (daily→weekly, weekly→monthly) | Must |
| FR-1.3 | Detect users who haven't logged in for 14+ days | Must |
| FR-1.4 | Detect account-level login declines (>30% reduction) | Must |
| FR-1.5 | Identify power user disengagement | Should |
| FR-1.6 | Account for expected patterns (holidays, seasonal) | Should |

### 3.2 Alert Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Create risk_signal with type "login_pattern_change" | Must |
| FR-2.2 | Include affected users and their pattern change | Must |
| FR-2.3 | Severity based on user importance and change magnitude | Must |
| FR-2.4 | Aggregate individual changes into account-level view | Should |

### 3.3 Re-engagement

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Suggest re-engagement actions based on pattern type | Should |
| FR-3.2 | Draft check-in message to affected users | Should |
| FR-3.3 | Track pattern recovery after intervention | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
-- User login tracking
CREATE TABLE user_login_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  user_id TEXT NOT NULL,
  user_email TEXT,
  user_name TEXT,
  user_role TEXT,
  is_power_user BOOLEAN DEFAULT false,
  historical_frequency VARCHAR(20), -- daily, weekly, monthly
  current_frequency VARCHAR(20),
  last_login_at TIMESTAMPTZ,
  days_since_login INTEGER,
  pattern_changed_at TIMESTAMPTZ,
  pattern_change_type VARCHAR(50), -- downgraded, stopped, resumed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, user_id)
);

-- risk_signal metadata structure
{
  "pattern_type": "login_frequency_downgrade",
  "account_level_change": true,
  "total_users": 50,
  "affected_users": 12,
  "users": [
    {
      "user_id": "user123",
      "name": "Jane Doe",
      "role": "Admin",
      "is_power_user": true,
      "previous_frequency": "daily",
      "current_frequency": "weekly",
      "last_login": "2026-01-20"
    }
  ],
  "account_metrics": {
    "previous_avg_logins_per_week": 150,
    "current_avg_logins_per_week": 85,
    "change_percent": -43
  }
}
```

### 4.2 Detection Logic

```typescript
interface UserLoginAnalysis {
  userId: string;
  loginDates: Date[];
  lookbackDays: number;
}

function analyzeLoginPattern(analysis: UserLoginAnalysis): LoginPattern {
  const { loginDates, lookbackDays } = analysis;

  // Calculate logins per week in different periods
  const recentWeeks = 2;
  const historicalWeeks = Math.floor(lookbackDays / 7) - recentWeeks;

  const recentLogins = loginDates.filter(d =>
    daysBetween(d, new Date()) <= recentWeeks * 7
  ).length;

  const historicalLogins = loginDates.filter(d =>
    daysBetween(d, new Date()) > recentWeeks * 7
  ).length;

  const recentFrequency = recentLogins / recentWeeks;
  const historicalFrequency = historicalLogins / historicalWeeks;

  // Categorize frequency
  const categorize = (loginsPerWeek: number) => {
    if (loginsPerWeek >= 4) return 'daily';
    if (loginsPerWeek >= 1) return 'weekly';
    if (loginsPerWeek >= 0.25) return 'monthly';
    return 'inactive';
  };

  return {
    historicalCategory: categorize(historicalFrequency),
    currentCategory: categorize(recentFrequency),
    changeDetected: categorize(historicalFrequency) !== categorize(recentFrequency),
    severity: calculateSeverity(historicalFrequency, recentFrequency)
  };
}
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:chart_with_downwards_trend: Login Pattern Change: Acme Corp

Account-Level Decline Detected

Metrics:
- Previous: 150 logins/week
- Current: 85 logins/week
- Change: -43%

Key Users Affected:

1. :red_circle: Jane Doe (Admin, Power User)
   Daily → Weekly (last login: 9 days ago)

2. :orange_circle: Bob Smith (Manager)
   Daily → Weekly (last login: 5 days ago)

3. :orange_circle: Sarah Lee (Analyst)
   Weekly → Monthly (last login: 18 days ago)

Account Context:
- ARR: $85,000
- Health Score: 71
- Recent Changes: None detected

Possible Causes:
- Seasonal slowdown?
- Tool replacement evaluation?
- Champion departure?

[Send Check-In Email] [Schedule Call] [View Usage Dashboard]
```

---

## 6. Related PRDs
- PRD-086: Usage Drop Alert - Check-In Workflow
- PRD-084: Usage Anomaly Detection
- PRD-106: Quiet Account Alert
- PRD-034: Check-In Email After Silence
