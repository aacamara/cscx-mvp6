# PRD-105: Multi-Account Pattern Alert

## Metadata
- **PRD ID**: PRD-105
- **Category**: D - Alerts & Triggers
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Account Mapping, Company Intelligence, Parent-Child Relationships

---

## 1. Overview

### 1.1 Problem Statement
Organizations with multiple accounts (subsidiaries, divisions, regional entities) often exhibit patterns that should inform strategy: synchronized behaviors, cross-pollination opportunities, or risk contagion. CSMs managing individual accounts may miss these patterns without visibility into the broader organizational context.

### 1.2 Solution Summary
Implement monitoring for customers with multiple accounts to detect patterns across related entities. Alert CSMs when patterns emerge that indicate opportunities (successful rollouts to replicate) or risks (issues spreading across accounts).

### 1.3 Success Metrics
- Identify 30% more cross-account expansion opportunities
- Reduce cross-account churn contagion by 40%
- Improve coordinated account strategies
- Increase parent company NRR by 20%

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when patterns emerge across related accounts
**So that** I can coordinate strategy across the organization

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to know when a subsidiary's success could be replicated to other entities.

**US-3**: As a CS Manager, I want visibility into parent company health that aggregates all child accounts.

**US-4**: As a CSM, I want warning when issues at one account might spread to others.

---

## 3. Functional Requirements

### 3.1 Pattern Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Map parent-child account relationships | Must |
| FR-1.2 | Detect synchronized health score changes | Must |
| FR-1.3 | Detect successful playbook execution for replication | Should |
| FR-1.4 | Detect risk contagion patterns | Must |
| FR-1.5 | Identify expansion from one subsidiary to another | Should |

### 3.2 Alert Types

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Alert on multi-account risk patterns | Must |
| FR-2.2 | Alert on replication opportunities | Should |
| FR-2.3 | Alert on parent company milestones | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
-- Add parent relationship to customers
ALTER TABLE customers ADD COLUMN parent_customer_id UUID REFERENCES customers(id);
ALTER TABLE customers ADD COLUMN relationship_type VARCHAR(50); -- subsidiary, division, region

-- Multi-account patterns
CREATE TABLE multi_account_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_customer_id UUID REFERENCES customers(id),
  pattern_type VARCHAR(50), -- risk_contagion, replication_opportunity, synchronized_change
  affected_customers UUID[],
  details JSONB,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:link: Multi-Account Pattern: GlobalCorp Family

Pattern Detected: Replication Opportunity

Successful Account: GlobalCorp EMEA
- Completed advanced training rollout
- Health score: 92 (+18 points)
- Usage up 45%

Similar Accounts (consider replicating):
1. GlobalCorp APAC - Health: 65 - No advanced training
2. GlobalCorp LATAM - Health: 58 - Partial training

Recommendation:
Share EMEA's training success story with other regions.

[View Parent Dashboard] [Draft Cross-Region Email] [Create Playbook]
```

---

## 6. Related PRDs
- PRD-058: Account Comparison Tool
- PRD-074: Account Benchmarking
- PRD-242: Shared Account Views
