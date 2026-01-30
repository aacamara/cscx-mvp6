# PRD-232: Automated Playbook Selection

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-232 |
| **Title** | Automated Playbook Selection |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs have access to multiple playbooks (onboarding, renewal, save play, expansion) but must manually decide which to use and when. This decision is inconsistent and often reactive. AI should automatically recommend the most appropriate playbook based on customer context, lifecycle stage, and current signals, initiating playbooks proactively rather than reactively.

## User Stories

### Primary User Stories
1. **As a CSM**, I want the system to recommend which playbook to use for each customer.
2. **As a CSM**, I want to understand why a specific playbook is recommended.
3. **As a CSM**, I want playbooks automatically triggered based on signals.
4. **As a CSM**, I want to see playbook fit scores for multiple options.
5. **As a CSM**, I want to customize which playbooks auto-trigger vs require approval.

### Secondary User Stories
1. **As a CSM Manager**, I want to ensure consistent playbook usage across the team.
2. **As a CS Leader**, I want to measure playbook effectiveness by selection method.
3. **As a CSM**, I want to override AI recommendations when I have additional context.

## Acceptance Criteria

### Core Functionality
- [ ] Automatic playbook recommendation for each customer
- [ ] Fit score calculation for each available playbook
- [ ] Trigger-based playbook initiation
- [ ] Recommendation explanation
- [ ] Manual override capability

### Playbook Types
- [ ] Onboarding playbooks (by segment, industry)
- [ ] Adoption playbooks (feature-specific)
- [ ] Renewal playbooks (by risk level, timeline)
- [ ] Save/Recovery playbooks (by risk type)
- [ ] Expansion playbooks (by signal type)
- [ ] QBR playbooks (quarterly cadence)

### Selection Criteria
- [ ] Customer lifecycle stage
- [ ] Health score and trend
- [ ] Renewal proximity
- [ ] Risk signals present
- [ ] Expansion signals present
- [ ] Industry/segment
- [ ] Previous playbook outcomes

## Technical Specification

### Architecture

```
Trigger Events → Context Analyzer → Playbook Matcher → Fit Scorer → Selection Engine → Execution
       ↓                                    ↓                ↓
Signal Detection               Playbook Library        Approval Flow
```

### Playbook Matching Model

```typescript
interface PlaybookRecommendation {
  customer_id: string;
  recommended_playbook: Playbook;
  fit_score: number;
  reasoning: string[];
  alternative_playbooks: PlaybookOption[];
  trigger_type: 'automatic' | 'suggested' | 'manual';
  status: 'pending_approval' | 'started' | 'active';
}

interface PlaybookOption {
  playbook_id: string;
  playbook_name: string;
  fit_score: number;
  key_reasons: string[];
}

interface PlaybookCriteria {
  lifecycle_stages: string[];
  health_score_range: { min: number; max: number };
  risk_signals: string[];
  expansion_signals: string[];
  renewal_proximity_days: { min: number; max: number };
  industries: string[];
  segments: string[];
}
```

### Selection Algorithm

```typescript
async function selectPlaybook(
  customerId: string,
  trigger?: TriggerEvent
): Promise<PlaybookRecommendation> {
  const customer = await getCustomerContext(customerId);
  const playbooks = await getAvailablePlaybooks();

  // Calculate fit scores for all playbooks
  const scoredPlaybooks = playbooks.map(playbook => ({
    playbook,
    score: calculateFitScore(playbook, customer, trigger),
    reasons: generateReasons(playbook, customer)
  }));

  // Sort by fit score
  const ranked = scoredPlaybooks.sort((a, b) => b.score - a.score);
  const best = ranked[0];

  // Determine trigger type based on confidence
  const triggerType = determineTriggerType(best.score, customer.settings);

  return {
    customer_id: customerId,
    recommended_playbook: best.playbook,
    fit_score: best.score,
    reasoning: best.reasons,
    alternative_playbooks: ranked.slice(1, 4).map(p => ({
      playbook_id: p.playbook.id,
      playbook_name: p.playbook.name,
      fit_score: p.score,
      key_reasons: p.reasons.slice(0, 2)
    })),
    trigger_type: triggerType,
    status: triggerType === 'automatic' ? 'started' : 'pending_approval'
  };
}

function calculateFitScore(
  playbook: Playbook,
  customer: CustomerContext,
  trigger?: TriggerEvent
): number {
  let score = 50;  // Base score
  const criteria = playbook.criteria;

  // Lifecycle stage match (+20)
  if (criteria.lifecycle_stages.includes(customer.stage)) {
    score += 20;
  }

  // Health score match (+15)
  if (customer.health_score >= criteria.health_score_range.min &&
      customer.health_score <= criteria.health_score_range.max) {
    score += 15;
  }

  // Risk signal match (+15)
  if (trigger?.type === 'risk_signal' &&
      criteria.risk_signals.includes(trigger.signal_type)) {
    score += 15;
  }

  // Renewal proximity match (+10)
  const daysToRenewal = customer.daysToRenewal;
  if (daysToRenewal >= criteria.renewal_proximity_days.min &&
      daysToRenewal <= criteria.renewal_proximity_days.max) {
    score += 10;
  }

  // Industry/segment bonus (+5 each)
  if (criteria.industries.includes(customer.industry)) {
    score += 5;
  }
  if (criteria.segments.includes(customer.segment)) {
    score += 5;
  }

  // Historical success rate adjustment
  const successRate = await getPlaybookSuccessRate(playbook.id, customer.segment);
  score += (successRate - 0.5) * 20;  // +/- 10 based on success rate

  return Math.min(100, Math.max(0, score));
}
```

### Automatic Trigger System

```typescript
interface PlaybookTrigger {
  trigger_type: string;
  playbook_id: string;
  conditions: TriggerCondition[];
  auto_start: boolean;
  require_approval_if: string[];
}

const PLAYBOOK_TRIGGERS: PlaybookTrigger[] = [
  {
    trigger_type: 'health_score_drop',
    playbook_id: 'save-play-standard',
    conditions: [
      { metric: 'health_score_change_7d', operator: '<', value: -15 },
      { metric: 'health_score', operator: '<', value: 50 }
    ],
    auto_start: false,
    require_approval_if: ['high_arr', 'active_expansion']
  },
  {
    trigger_type: 'renewal_approaching',
    playbook_id: 'renewal-90day',
    conditions: [
      { metric: 'days_to_renewal', operator: '<=', value: 90 },
      { metric: 'renewal_playbook_active', operator: '=', value: false }
    ],
    auto_start: true,
    require_approval_if: []
  },
  // ... more triggers
];

async function evaluateTriggers(
  customerId: string,
  event: SystemEvent
): Promise<PlaybookRecommendation | null> {
  const customer = await getCustomerContext(customerId);

  for (const trigger of PLAYBOOK_TRIGGERS) {
    if (event.type === trigger.trigger_type) {
      const conditionsMet = trigger.conditions.every(
        c => evaluateCondition(c, customer)
      );

      if (conditionsMet) {
        const shouldRequireApproval = trigger.require_approval_if.some(
          condition => evaluateApprovalCondition(condition, customer)
        );

        return await selectPlaybook(customerId, {
          type: trigger.trigger_type,
          playbook_hint: trigger.playbook_id,
          require_approval: shouldRequireApproval || !trigger.auto_start
        });
      }
    }
  }

  return null;
}
```

### API Endpoints

#### GET /api/customers/{id}/recommended-playbook
```json
{
  "customer_id": "uuid",
  "customer_name": "TechCorp Industries",
  "recommended_playbook": {
    "id": "save-play-standard",
    "name": "Standard Save Play",
    "description": "Comprehensive risk mitigation playbook",
    "duration_days": 30,
    "steps_count": 8
  },
  "fit_score": 85,
  "reasoning": [
    "Health score dropped below 50 (currently 45)",
    "High value account ($250K ARR) warrants proactive intervention",
    "Usage decline matches save play criteria",
    "Success rate for similar accounts: 72%"
  ],
  "alternative_playbooks": [
    {
      "playbook_id": "save-play-executive",
      "playbook_name": "Executive Save Play",
      "fit_score": 75,
      "key_reasons": ["Higher touch approach", "Includes exec escalation"]
    },
    {
      "playbook_id": "adoption-recovery",
      "playbook_name": "Adoption Recovery",
      "fit_score": 65,
      "key_reasons": ["Focus on usage improvement"]
    }
  ],
  "trigger_type": "suggested",
  "trigger_event": {
    "type": "health_score_drop",
    "details": "Health score dropped from 62 to 45 this week"
  }
}
```

#### POST /api/customers/{id}/start-playbook
```json
{
  "playbook_id": "save-play-standard",
  "override_reason": "optional - if different from recommended"
}
```

### Database Schema

```sql
CREATE TABLE playbook_recommendations (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  playbook_id TEXT NOT NULL,
  fit_score INTEGER,
  reasoning JSONB,
  alternatives JSONB,
  trigger_type VARCHAR(50),
  trigger_event JSONB,
  status VARCHAR(50),
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE playbook_outcomes (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  playbook_id TEXT NOT NULL,
  selection_method VARCHAR(50),  -- ai_recommended, manual
  was_recommended_playbook BOOLEAN,
  outcome VARCHAR(50),  -- success, partial, failed
  health_change INTEGER,
  outcome_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## UI/UX Design

### Playbook Recommendation Card
```
┌─────────────────────────────────────────────────────────┐
│ 📋 RECOMMENDED PLAYBOOK - TechCorp Industries           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⚠️ Triggered by: Health score dropped 17 points         │
│                                                         │
│ RECOMMENDED: Standard Save Play          Fit: 85%       │
│ ──────────────────────────────────────                  │
│ 30-day risk mitigation playbook with 8 steps            │
│ Success rate for similar accounts: 72%                  │
│                                                         │
│ Why this playbook:                                      │
│ ✓ Health below 50 (you: 45)                            │
│ ✓ High value account warrants proactive approach        │
│ ✓ Usage decline matches save play criteria              │
│                                                         │
│ [Start Playbook] [View Steps] [Choose Different]        │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ ALTERNATIVES                                            │
│ ┌───────────────────────────────────┐                   │
│ │ Executive Save Play      Fit: 75% │                   │
│ │ Higher touch, exec escalation     │                   │
│ │ [Select]                          │                   │
│ └───────────────────────────────────┘                   │
│ ┌───────────────────────────────────┐                   │
│ │ Adoption Recovery        Fit: 65% │                   │
│ │ Focus on usage improvement        │                   │
│ │ [Select]                          │                   │
│ └───────────────────────────────────┘                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Playbook library with criteria definitions
- Health score and signal detection
- Trigger/automation engine
- Outcome tracking

### Related PRDs
- PRD-118: Health Score Change → Playbook Selection
- PRD-149: Playbook Completed → Next Selection
- PRD-168: Playbook Effectiveness Report

## Success Metrics

### Quantitative
- Playbook fit accuracy > 85% (CSMs accept recommendation)
- Auto-triggered playbook success rate > recommended average
- Time to playbook start reduced by 50%
- Consistent playbook usage across team (+30%)

### Qualitative
- CSMs trust AI recommendations
- Less decision fatigue on playbook selection
- Better outcomes from early intervention

## Rollout Plan

### Phase 1: Recommendations (Week 1-2)
- Basic fit scoring
- Manual recommendation display
- Alternative options

### Phase 2: Triggers (Week 3-4)
- Signal-based triggers
- Approval workflow
- Auto-start for low-risk triggers

### Phase 3: Learning (Week 5-6)
- Outcome tracking
- Success rate by selection method
- Recommendation refinement

### Phase 4: Optimization (Week 7-8)
- Cross-segment learning
- Custom trigger rules
- Manager oversight dashboard

## Open Questions
1. Should CSMs be able to decline all recommendations?
2. How do we handle conflicting playbook triggers?
3. What's the right level of automation vs human oversight?
4. How do we measure "playbook fit" after the fact?
