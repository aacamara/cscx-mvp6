# PRD-091: NPS Score Drop - Recovery Workflow

## Metadata
- **PRD ID**: PRD-091
- **Category**: D - Alerts & Triggers
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: NPS Survey System, Trigger Engine, Communicator Agent

---

## 1. Overview

### 1.1 Problem Statement
When a customer's NPS score drops significantly (especially from Promoter to Passive or Detractor), it signals a major shift in sentiment that demands immediate attention. Without automated detection and structured response workflows, these critical signals can be missed or addressed too slowly, allowing negative sentiment to solidify and spread within the customer organization.

### 1.2 Solution Summary
Implement an NPS drop detection system that compares new survey responses against historical scores and triggers an immediate recovery workflow. The workflow includes urgent CSM notification, automatic sentiment analysis of feedback comments, personalized recovery outreach drafting, and task creation for follow-up actions.

### 1.3 Success Metrics
- Respond to NPS drops within 24 hours
- Recover 40% of detractors to passive/promoter within 60 days
- Reduce churn rate among detractors by 30%
- Increase NPS survey response rate through demonstrated responsiveness

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be immediately alerted when a customer's NPS score drops significantly
**So that** I can initiate a recovery conversation before the relationship deteriorates further

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to see the verbatim feedback that accompanied the low score, so I understand the specific issues to address.

**US-3**: As a CSM, I want a pre-drafted empathetic response email that acknowledges the feedback, so I can quickly reach out.

**US-4**: As a CS Manager, I want to see patterns in NPS drops across accounts (common themes), so I can identify systemic issues.

**US-5**: As a CSM, I want to track the customer's NPS history over time, so I can understand the trajectory and context.

---

## 3. Functional Requirements

### 3.1 NPS Drop Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Compare new NPS score against previous score from same account | Must |
| FR-1.2 | Detect category drops: Promoter→Passive (alert), Promoter→Detractor (critical), Passive→Detractor (high) | Must |
| FR-1.3 | Detect numeric drops: >3 point drop triggers review | Must |
| FR-1.4 | Process both individual and account-level NPS aggregates | Should |
| FR-1.5 | Account for multiple respondents from same company | Should |
| FR-1.6 | Identify first-time detractors vs recurring detractors | Should |

### 3.2 Alert Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Create risk_signal with type "nps_drop" | Must |
| FR-2.2 | Severity: Detractor = critical, Passive (from Promoter) = high | Must |
| FR-2.3 | Include previous score, new score, respondent info, verbatim feedback | Must |
| FR-2.4 | Perform AI sentiment analysis on feedback comment | Should |
| FR-2.5 | Extract key themes/issues from feedback text | Should |

### 3.3 Recovery Workflow

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Immediately notify CSM via Slack with full context | Must |
| FR-3.2 | Create high-priority task with 24-hour deadline | Must |
| FR-3.3 | Draft personalized recovery email acknowledging specific feedback | Must |
| FR-3.4 | Suggest call scheduling for deeper discussion | Should |
| FR-3.5 | Update health score based on NPS change | Must |
| FR-3.6 | Create internal escalation note if account is strategic | Should |
| FR-3.7 | Track recovery progress over subsequent surveys | Should |

### 3.4 Feedback Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-4.1 | Categorize feedback: product, support, value, relationship, other | Must |
| FR-4.2 | Identify actionable vs general complaints | Should |
| FR-4.3 | Link feedback to specific product areas or features | Should |
| FR-4.4 | Flag feedback mentioning competitors | Should |

---

## 4. Technical Specifications

### 4.1 Data Model Changes

```sql
-- NPS responses table (if not exists)
CREATE TABLE nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  respondent_email TEXT,
  respondent_name TEXT,
  respondent_role TEXT,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  category VARCHAR(20) GENERATED ALWAYS AS (
    CASE
      WHEN score >= 9 THEN 'promoter'
      WHEN score >= 7 THEN 'passive'
      ELSE 'detractor'
    END
  ) STORED,
  feedback TEXT,
  feedback_analysis JSONB, -- AI analysis results
  survey_id TEXT,
  survey_campaign TEXT,
  submitted_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  recovery_initiated BOOLEAN DEFAULT false,
  recovery_status VARCHAR(50), -- pending, in_progress, resolved, unresolved
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- risk_signal metadata for nps_drop
{
  "response_id": "uuid",
  "respondent": {
    "email": "jane.doe@customer.com",
    "name": "Jane Doe",
    "role": "Product Manager"
  },
  "score_change": {
    "previous_score": 9,
    "previous_category": "promoter",
    "current_score": 4,
    "current_category": "detractor",
    "point_drop": 5
  },
  "feedback": {
    "verbatim": "The product has become unreliable and support is slow to respond.",
    "analysis": {
      "sentiment": "negative",
      "sentiment_score": -0.8,
      "themes": ["reliability", "support_response_time"],
      "category": "product_and_support",
      "mentions_competitor": false,
      "actionable_items": [
        "Address reliability concerns",
        "Review support response times for this account"
      ]
    }
  },
  "account_context": {
    "arr": 125000,
    "days_until_renewal": 95,
    "health_score_before": 72,
    "previous_nps_count": 3
  }
}
```

### 4.2 API Endpoints

```typescript
// Ingest NPS survey response
POST /api/nps/responses
Body: {
  customerId: string,
  respondentEmail: string,
  respondentName?: string,
  respondentRole?: string,
  score: number,
  feedback?: string,
  surveyId?: string,
  surveyCampaign?: string,
  submittedAt: string
}

// Get NPS history for customer
GET /api/customers/:customerId/nps
Response: {
  currentScore: number,
  currentCategory: string,
  averageScore: number,
  responseCount: number,
  trend: 'improving' | 'stable' | 'declining',
  history: NpsResponse[],
  detractorCount: number,
  lastRecoveryAttempt?: string
}

// Initiate recovery workflow
POST /api/nps/responses/:responseId/initiate-recovery
Body: {
  priority?: 'normal' | 'high' | 'critical'
}

// Update recovery status
PATCH /api/nps/responses/:responseId/recovery
Body: {
  status: 'in_progress' | 'resolved' | 'unresolved',
  notes: string
}
```

### 4.3 Detection Logic

```typescript
interface NpsDropDetection {
  responseId: string;
  customerId: string;
  newScore: number;
  previousResponses: NpsResponse[];
}

async function detectNpsDrop(input: NpsDropDetection): Promise<DropResult | null> {
  const { newScore, previousResponses } = input;

  // Get most recent previous score for comparison
  const previousScore = previousResponses.length > 0
    ? previousResponses[0].score
    : null;

  const newCategory = getCategory(newScore);
  const previousCategory = previousScore ? getCategory(previousScore) : null;

  // Check for significant drop
  const isDetractor = newCategory === 'detractor';
  const categoryDropped = previousCategory &&
    (previousCategory === 'promoter' && newCategory !== 'promoter') ||
    (previousCategory === 'passive' && newCategory === 'detractor');
  const significantPointDrop = previousScore && (previousScore - newScore) >= 3;

  if (!isDetractor && !categoryDropped && !significantPointDrop) {
    return null;
  }

  // Determine severity
  let severity: 'medium' | 'high' | 'critical';
  if (isDetractor && previousCategory === 'promoter') {
    severity = 'critical';
  } else if (isDetractor) {
    severity = 'high';
  } else {
    severity = 'medium';
  }

  return {
    shouldAlert: true,
    severity,
    previousScore,
    newScore,
    previousCategory,
    newCategory,
    pointDrop: previousScore ? previousScore - newScore : null
  };
}

function getCategory(score: number): 'promoter' | 'passive' | 'detractor' {
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}
```

### 4.4 Workflow Definition

```yaml
workflow: nps_drop_recovery
version: 1.0
trigger:
  type: risk_signal_created
  filter:
    signal_type: nps_drop

steps:
  - id: analyze_feedback
    action: ai_analysis
    config:
      model: claude-sonnet-4
      prompt: |
        Analyze this NPS feedback and extract:
        1. Primary sentiment (positive/negative/mixed)
        2. Key themes/issues mentioned
        3. Category (product, support, value, relationship, other)
        4. Whether competitors are mentioned
        5. Actionable items for the CSM

        Feedback: "{{feedback}}"
        Score: {{score}}

  - id: notify_csm
    action: slack_dm
    config:
      message_template: "nps_drop_alert"
      urgency: "{{severity}}"
      include_feedback_analysis: true

  - id: create_urgent_task
    action: create_task
    config:
      title: "URGENT: NPS Detractor - {{customer.name}} ({{respondent.name}})"
      description: |
        Score dropped from {{previous_score}} to {{new_score}}
        Feedback: {{feedback}}
        Action needed within 24 hours.
      due_date_offset_hours: 24
      priority: critical

  - id: update_health_score
    action: update_health_score
    config:
      adjustment: -20
      reason: "NPS score dropped to detractor ({{new_score}})"

  - id: draft_recovery_email
    action: delegate_to_agent
    config:
      agent: communicator
      action: draft_email
      params:
        template: nps_recovery
        personalize_for_feedback: true
        requires_approval: true

  - id: notify_manager
    condition: "{{severity}} == 'critical' OR {{customer.arr}} >= 100000"
    action: slack_dm
    config:
      recipient: "{{csm.manager_id}}"
      message_template: "nps_critical_alert"

  - id: log_recovery_initiation
    action: update_record
    config:
      table: nps_responses
      record_id: "{{response_id}}"
      updates:
        recovery_initiated: true
        recovery_status: 'pending'
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:rotating_light: NPS ALERT: Detractor Response - Acme Corp

Score: 4 (was 9 - Promoter → Detractor)

Respondent: Jane Doe (Product Manager)
Submitted: Jan 29, 2026 at 2:30 PM

Feedback:
"The product has become unreliable and support is slow to respond. We're evaluating alternatives."

:mag: AI Analysis:
- Sentiment: Strongly Negative
- Key Issues: Product reliability, Support response time
- :warning: Competitor evaluation mentioned

Account Context:
- ARR: $125,000
- Renewal: 95 days away
- Health Score: 72 → 52 (adjusted)

Recommended Actions:
1. Acknowledge feedback within 24 hours
2. Schedule call to discuss reliability concerns
3. Review recent support tickets for this account
4. Involve Support Lead in resolution

[Draft Recovery Email] [View Support Tickets] [Schedule Call] [View Customer]
```

### 5.2 Customer Detail - NPS Section

NPS dashboard card showing:
- Current average NPS score
- Category distribution pie chart
- Score trend chart over time
- Recent responses with feedback snippets
- Recovery status indicators
- "View Full NPS History" link

### 5.3 NPS Response Detail Modal

When viewing individual response:
- Respondent information
- Score with visual indicator
- Full verbatim feedback
- AI analysis breakdown
- Recovery actions taken
- Outcome tracking

---

## 6. Integration Points

### 6.1 Required Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| Survey System (Delighted, SurveyMonkey, etc.) | NPS data source | Needed |
| Slack | Urgent notifications | Implemented |
| Gmail | Recovery email | Implemented |
| Calendar | Follow-up scheduling | Implemented |

### 6.2 Survey System Integration Options

Support webhooks from:
- Delighted
- Wootric
- SurveyMonkey
- Typeform
- Custom survey endpoints

---

## 7. Testing Requirements

### 7.1 Test Scenarios

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| Detractor (first time) | Score 4, no previous | High severity alert |
| Promoter to Detractor | Previous 9, new 3 | Critical alert |
| Promoter to Passive | Previous 9, new 7 | Medium alert |
| Passive to Detractor | Previous 7, new 5 | High alert |
| Score improvement | Previous 4, new 8 | No alert (positive change) |
| Small drop | Previous 8, new 7 | No alert (within threshold) |

---

## 8. Rollout Plan

### Phase 1: Basic Detection (Week 1)
- NPS response ingestion API
- Drop detection logic
- Slack notifications

### Phase 2: Recovery Workflow (Week 2)
- Task creation
- Email drafting
- Health score updates

### Phase 3: AI Analysis (Week 3)
- Feedback sentiment analysis
- Theme extraction
- Actionable item generation

### Phase 4: Tracking & Reporting (Week 4)
- Recovery status tracking
- Outcome measurement
- Dashboard views

---

## 9. Open Questions

1. Should we integrate with specific NPS survey platforms or build a generic webhook receiver?
2. What is the appropriate response SLA (currently 24 hours)?
3. Should recovery emails be auto-sent or always require approval?
4. How do we handle multiple detractor responses from the same account?

---

## 10. Appendix

### 10.1 Email Template: NPS Recovery

```
Subject: Thank you for your feedback - let's make things right

Hi {{respondent_name}},

Thank you for taking the time to share your feedback. I read your response personally and wanted to reach out right away.

I'm sorry to hear about {{primary_issue}}. Your experience doesn't reflect the standard we strive for, and I want to help make this right.

{{#if specific_acknowledgment}}
Specifically, regarding {{specific_issue}}: {{response_to_issue}}
{{/if}}

I'd like to schedule a brief call to discuss your concerns directly and understand how we can better support you and your team. Would you have 20-30 minutes this week?

[Schedule a Call]

Your feedback matters deeply to us, and I'm committed to turning this experience around.

Best regards,
{{csm_name}}
Customer Success Manager

P.S. If you prefer email, please reply to this message and I'll address your concerns directly.
```

### 10.2 NPS Category Definitions

| Score | Category | Definition |
|-------|----------|------------|
| 9-10 | Promoter | Loyal enthusiasts who will keep buying and refer others |
| 7-8 | Passive | Satisfied but unenthusiastic, vulnerable to competition |
| 0-6 | Detractor | Unhappy customers who can damage brand through negative word-of-mouth |

### 10.3 Related PRDs
- PRD-005: NPS Survey Results - Sentiment Analysis
- PRD-076: Account Sentiment Over Time
- PRD-218: Real-Time Sentiment Analysis
- PRD-046: Apology Email Generator
