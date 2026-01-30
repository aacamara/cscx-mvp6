# PRD-090: Feature Adoption Stalled - Enablement

## Metadata
- **PRD ID**: PRD-090
- **Category**: D - Alerts & Triggers
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Usage Data API, Feature Adoption Tracking, Training Resources

---

## 1. Overview

### 1.1 Problem Statement
Customers often purchase products with specific use cases in mind but fail to fully adopt key features that would maximize their ROI. When feature adoption stalls after initial onboarding, customers may not realize the full value of their investment, leading to lower satisfaction and higher churn risk. CSMs need proactive visibility into adoption gaps to intervene before value realization suffers.

### 1.2 Solution Summary
Implement an intelligent feature adoption monitoring system that detects when customers have stalled on key feature adoption. When stalls are detected, automatically trigger an enablement workflow that includes personalized training recommendations, resource sharing, and proactive outreach to re-engage users with underutilized features.

### 1.3 Success Metrics
- Increase feature adoption rate by 40% for flagged accounts
- Reduce time from purchase to full adoption by 30%
- Improve health scores by 15 points for accounts receiving enablement intervention
- Increase training content engagement by 50%

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when a customer's feature adoption has stalled
**So that** I can proactively offer training and resources to unlock value

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want specific recommendations for which features to focus on based on the customer's use case, so I can provide targeted enablement.

**US-3**: As a CSM, I want to share relevant training resources directly from the alert, so I can quickly help customers get unstuck.

**US-4**: As a Product Manager, I want aggregated data on which features commonly stall, so I can improve onboarding or the feature itself.

**US-5**: As a CSM, I want to track whether my enablement intervention leads to increased adoption, so I can measure my impact.

---

## 3. Functional Requirements

### 3.1 Adoption Stall Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Track feature usage per customer at daily/weekly granularity | Must |
| FR-1.2 | Define "expected adoption timeline" per feature (e.g., 30 days post-activation) | Must |
| FR-1.3 | Detect stall: feature activated but <20% usage for 14+ days | Must |
| FR-1.4 | Track adoption stages: Not Started → Started → Engaged → Adopted | Must |
| FR-1.5 | Calculate adoption score per feature (0-100) | Should |
| FR-1.6 | Consider customer segment for appropriate adoption benchmarks | Should |
| FR-1.7 | Account for seasonal/cyclical usage patterns | Could |

### 3.2 Alert Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Create risk_signal with type "adoption_stalled" | Must |
| FR-2.2 | Include affected feature(s), current adoption %, expected timeline | Must |
| FR-2.3 | Prioritize alerts by feature importance and customer ARR | Must |
| FR-2.4 | Prevent duplicate alerts for same feature within 30-day window | Must |
| FR-2.5 | Aggregate multiple stalled features into single alert | Should |

### 3.3 Enablement Workflow

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Map features to relevant training resources (videos, docs, webinars) | Must |
| FR-3.2 | Generate personalized enablement email with resources | Must |
| FR-3.3 | Suggest training session scheduling | Should |
| FR-3.4 | Track resource engagement (opens, clicks, completions) | Should |
| FR-3.5 | Offer in-app tips or guided tours (future integration) | Could |

### 3.4 Impact Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-4.1 | Track adoption change after enablement intervention | Must |
| FR-4.2 | Record intervention type and timing | Must |
| FR-4.3 | Calculate enablement effectiveness score | Should |
| FR-4.4 | Report on successful vs unsuccessful interventions | Should |

---

## 4. Technical Specifications

### 4.1 Data Model Changes

```sql
-- Feature adoption tracking
CREATE TABLE feature_adoption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  feature_id VARCHAR(100) NOT NULL,
  feature_name VARCHAR(255) NOT NULL,
  activated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  usage_score INTEGER DEFAULT 0, -- 0-100
  stage VARCHAR(50) DEFAULT 'not_started', -- not_started, started, engaged, adopted, churned
  expected_adoption_days INTEGER DEFAULT 30,
  stall_detected_at TIMESTAMPTZ,
  intervention_sent_at TIMESTAMPTZ,
  intervention_type VARCHAR(50),
  adoption_after_intervention INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, feature_id)
);

-- Feature catalog with training resources
CREATE TABLE feature_catalog (
  feature_id VARCHAR(100) PRIMARY KEY,
  feature_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  importance_score INTEGER DEFAULT 50, -- 0-100
  expected_adoption_days INTEGER DEFAULT 30,
  training_resources JSONB, -- Array of resource links
  tips TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training resources structure
{
  "training_resources": [
    {
      "type": "video",
      "title": "Getting Started with Feature X",
      "url": "https://training.example.com/feature-x",
      "duration_minutes": 15,
      "level": "beginner"
    },
    {
      "type": "documentation",
      "title": "Feature X User Guide",
      "url": "https://docs.example.com/feature-x"
    },
    {
      "type": "webinar",
      "title": "Advanced Feature X Techniques",
      "url": "https://training.example.com/webinars/feature-x-advanced",
      "next_session": "2026-02-15T14:00:00Z"
    }
  ]
}
```

### 4.2 API Endpoints

```typescript
// Get feature adoption status for customer
GET /api/customers/:customerId/feature-adoption
Response: {
  overallAdoptionScore: number,
  features: Array<{
    featureId: string,
    featureName: string,
    stage: string,
    usageScore: number,
    lastUsedAt: string,
    isStalled: boolean,
    daysInCurrentStage: number
  }>,
  stalledFeatures: FeatureAdoption[],
  recommendations: string[]
}

// Get enablement resources for feature
GET /api/features/:featureId/resources
Response: {
  feature: FeatureCatalog,
  resources: TrainingResource[],
  suggestedOutreach: string
}

// Record enablement intervention
POST /api/feature-adoption/:id/intervention
Body: {
  interventionType: 'email' | 'call' | 'training' | 'resource_share',
  details: string,
  resourcesShared?: string[]
}

// Bulk update feature adoption from usage events
POST /api/feature-adoption/sync
Body: { customerId: string }
```

### 4.3 Detection Algorithm

```typescript
interface FeatureAdoptionCheck {
  customerId: string;
  featureId: string;
  activatedAt: Date;
  usageEvents: UsageEvent[];
}

function evaluateAdoptionStatus(check: FeatureAdoptionCheck): AdoptionStatus {
  const daysSinceActivation = daysBetween(check.activatedAt, new Date());
  const recentUsage = check.usageEvents.filter(e =>
    e.timestamp > subDays(new Date(), 14)
  );

  const usageScore = calculateUsageScore(recentUsage);

  // Determine stage
  let stage: AdoptionStage;
  if (usageScore === 0 && daysSinceActivation > 7) {
    stage = 'not_started';
  } else if (usageScore < 20) {
    stage = 'started';
  } else if (usageScore < 60) {
    stage = 'engaged';
  } else {
    stage = 'adopted';
  }

  // Check for stall
  const isStalled = (
    stage !== 'adopted' &&
    daysSinceActivation > check.expectedAdoptionDays &&
    usageScore < 30
  );

  return { stage, usageScore, isStalled };
}
```

### 4.4 Workflow Definition

```yaml
workflow: feature_adoption_enablement
version: 1.0
trigger:
  type: risk_signal_created
  filter:
    signal_type: adoption_stalled

steps:
  - id: analyze_stall
    action: delegate_to_agent
    config:
      agent: researcher
      action: analyze_adoption_gap
      params:
        customer_id: "{{customer.id}}"
        feature_id: "{{feature_id}}"

  - id: get_resources
    action: query_database
    config:
      query: "SELECT * FROM feature_catalog WHERE feature_id = '{{feature_id}}'"

  - id: notify_csm
    action: slack_dm
    config:
      message_template: "adoption_stalled_alert"
      include_resources: true

  - id: draft_enablement_email
    action: delegate_to_agent
    config:
      agent: communicator
      action: draft_email
      params:
        template: feature_enablement
        feature_name: "{{feature_name}}"
        resources: "{{resources}}"
        requires_approval: true

  - id: create_task
    action: create_task
    config:
      title: "Enable {{customer.name}} on {{feature_name}}"
      due_date_offset_hours: 72
      priority: medium

  - id: schedule_followup
    action: create_task
    config:
      title: "Check {{feature_name}} adoption for {{customer.name}}"
      due_date_offset_days: 14
      priority: low
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:chart_with_downwards_trend: Feature Adoption Stalled: TechCorp

Feature: Advanced Analytics Dashboard
Status: Started → Stalled (Day 45)
Usage Score: 15/100 (Expected: 60+ by Day 30)

Customer Context:
- ARR: $75,000
- Overall Adoption: 65%
- This feature importance: High

Why it matters:
Advanced Analytics was a key purchase driver for this customer.
Low adoption may indicate:
- Training gap
- Integration challenges
- Changed priorities

Recommended Resources:
1. :video_camera: "Analytics Dashboard Overview" (12 min)
2. :page_facing_up: "Quick Start Guide"
3. :calendar: Next live training: Feb 15, 2026

[Share Resources] [Draft Enablement Email] [Schedule Training Call]
```

### 5.2 Customer Detail - Adoption View

Feature adoption dashboard showing:
- Overall adoption score
- Feature-by-feature breakdown with progress bars
- Stalled features highlighted in warning color
- Quick action to share resources
- Adoption trend over time

### 5.3 Feature Adoption Card

For each feature:
- Feature name and icon
- Stage badge (Not Started | Started | Engaged | Adopted)
- Usage score meter
- Days in current stage
- Last used date
- Available resources count
- "Send Resources" button

---

## 6. Integration Points

### 6.1 Required Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| Usage Data API | Feature usage tracking | Implemented |
| Knowledge Base | Training resources | Implemented |
| Gmail | Enablement email | Implemented |
| Calendar | Training scheduling | Implemented |

### 6.2 Future Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| LMS (Thought Industries, etc.) | Training completion tracking | Planned |
| In-app messaging | Contextual tips | Planned |
| Product analytics (Pendo, etc.) | Deeper usage insights | Planned |

---

## 7. Testing Requirements

### 7.1 Test Scenarios

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| Normal adoption | Feature used regularly | No alert |
| Stalled adoption | Feature activated but unused for 20 days | Alert generated |
| Recovery | Stalled feature starts being used | Update stage, record recovery |
| Multiple stalls | 3 features stalled | Single aggregated alert |
| Already intervened | Stall on feature with recent intervention | Suppress alert (30-day cooldown) |

---

## 8. Rollout Plan

### Phase 1: Tracking Infrastructure (Week 1)
- Create feature_adoption table
- Build adoption calculation job
- Populate feature_catalog with initial features

### Phase 2: Basic Alerting (Week 2)
- Implement stall detection
- Slack notifications
- Basic resource linking

### Phase 3: Enablement Automation (Week 3)
- Email draft generation
- Resource recommendation engine
- Training scheduling

### Phase 4: Impact Measurement (Week 4)
- Intervention tracking
- Effectiveness reporting
- Dashboard views

---

## 9. Open Questions

1. Should we alert on all features or only "key" features?
2. What is the right threshold for "stalled" (currently 14 days, <20% usage)?
3. Should customers be able to self-serve request training?
4. How do we handle features that are legitimately not needed by certain customers?

---

## 10. Appendix

### 10.1 Email Template: Feature Enablement

```
Subject: Getting more value from {{feature_name}}

Hi {{champion_name}},

I noticed your team has started exploring {{feature_name}} but might not have had a chance to fully dive in yet. This is a powerful feature that can help you {{key_benefit}}.

I wanted to share some resources that might help:

{{#each resources}}
- {{title}}: {{url}}
{{/each}}

Many of our customers find that a quick 20-minute walkthrough makes a big difference. Would you like to schedule a brief session where I can show you some best practices and answer any questions?

[Schedule a Session]

Let me know if there's anything specific you're trying to accomplish with {{feature_name}} - I'm happy to help!

Best,
{{csm_name}}
```

### 10.2 Related PRDs
- PRD-006: Usage Data Upload - Adoption Scoring
- PRD-064: Product Adoption Dashboard
- PRD-099: High-Value Feature Released
- PRD-104: Training Completion Alert
