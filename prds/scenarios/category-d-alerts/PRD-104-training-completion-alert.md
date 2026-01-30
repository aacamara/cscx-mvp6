# PRD-104: Training Completion Alert

## Metadata
- **PRD ID**: PRD-104
- **Category**: D - Alerts & Triggers
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: LMS Integration, Training Tracking, User Management

---

## 1. Overview

### 1.1 Problem Statement
Training completion is a strong indicator of user investment and adoption success. CSMs need visibility into which users have completed training to celebrate milestones, identify who may need additional support, and track overall customer readiness. Without automated tracking, training completion goes unnoticed and uncelebrated.

### 1.2 Solution Summary
Implement an automated alert system that monitors training completions and certifications, notifying CSMs of significant milestones. Enable celebration outreach, identify users who started but haven't completed training, and track training coverage across the customer organization.

### 1.3 Success Metrics
- Increase training completion rates by 30%
- Reduce time-to-productivity for new users by 25%
- Achieve 90% CSM awareness of training milestones
- Improve customer satisfaction with onboarding experience

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** know when users complete training or earn certifications
**So that** I can congratulate them and reinforce positive engagement

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to know when users start but don't complete training, so I can offer help.

**US-3**: As a CSM, I want to see training coverage metrics for the account, so I can identify training gaps.

**US-4**: As an Enablement Manager, I want training completion data linked to adoption outcomes.

---

## 3. Functional Requirements

### 3.1 Training Monitoring

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Track training module completions | Must |
| FR-1.2 | Track certification achievements | Must |
| FR-1.3 | Detect training started but abandoned | Should |
| FR-1.4 | Track completion by user role/level | Should |
| FR-1.5 | Calculate account-level training coverage | Should |

### 3.2 Alert Types

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Alert on individual certification earned | Must |
| FR-2.2 | Alert on team training milestones (e.g., all admins certified) | Should |
| FR-2.3 | Alert on training abandonment after 14 days | Should |
| FR-2.4 | Weekly training digest option | Could |

### 3.3 Actions

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Draft congratulations email | Should |
| FR-3.2 | Suggest next learning path | Should |
| FR-3.3 | Offer help for abandoned training | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
CREATE TABLE user_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  user_id TEXT NOT NULL,
  user_email TEXT,
  user_name TEXT,
  course_id TEXT NOT NULL,
  course_name TEXT,
  course_type VARCHAR(50), -- onboarding, advanced, certification
  status VARCHAR(50), -- not_started, in_progress, completed, abandoned
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score INTEGER,
  certificate_url TEXT,
  csm_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Workflow Definition

```yaml
workflow: training_completion_alert
version: 1.0
trigger:
  type: event
  event: training_completed

steps:
  - id: notify_csm
    action: slack_dm
    config:
      message_template: "training_completion"
      include_next_steps: true

  - id: draft_congrats
    condition: "{{course_type}} == 'certification'"
    action: delegate_to_agent
    config:
      agent: communicator
      action: draft_email
      params:
        template: training_congratulations
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:mortar_board: Training Milestone: DataCorp

User Certified: Sarah Johnson (Admin)

Course: Platform Administrator Certification
Score: 95%
Completed: Jan 29, 2026

Account Training Status:
- Admins Certified: 2/3 (67%)
- End Users Trained: 15/25 (60%)
- Average Score: 88%

:warning: Training Gaps:
- Bob Smith started Admin Cert 21 days ago (stuck on Module 3)

[Send Congratulations] [View Training Dashboard] [Help Bob]
```

---

## 6. Related PRDs
- PRD-017: Training Completion Data - Certification Tracking
- PRD-038: Training Invitation Personalization
- PRD-143: Training Scheduled - Reminder Sequence
