# PRD-214: Intelligent Task Prioritization

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-214 |
| **Title** | Intelligent Task Prioritization |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs manage dozens of accounts and hundreds of tasks simultaneously. Without intelligent prioritization, they may spend time on low-impact activities while critical situations escalate. Current task lists are sorted by due date or manual priority, not by actual business impact. AI should dynamically prioritize tasks based on account health, renewal timing, ARR value, and recent signals.

## User Stories

### Primary User Stories
1. **As a CSM**, I want my daily task list automatically prioritized by business impact, not just due date.
2. **As a CSM**, I want to see why a task is ranked highly (context reasoning).
3. **As a CSM**, I want priority to auto-adjust when new risk signals are detected.
4. **As a CSM**, I want to ask "What should I work on next?" and get an intelligent recommendation.
5. **As a CSM**, I want priority scores that factor in account ARR, health, and renewal proximity.

### Secondary User Stories
1. **As a CSM Manager**, I want to see if my team is working on the right priorities.
2. **As a CSM**, I want to override AI priority with manual flags when I have context AI doesn't have.
3. **As a CSM**, I want priority to consider my meeting schedule (don't prioritize prep tasks after the meeting).

## Acceptance Criteria

### Core Functionality
- [ ] Every task has an AI-computed priority score (0-100)
- [ ] Priority scores update in real-time based on signals
- [ ] Priority explanation provided for each task
- [ ] Daily task list sorted by computed priority
- [ ] "What should I work on?" command returns top 3-5 priorities with reasoning

### Priority Factors
- [ ] Account health score (lower health = higher task priority)
- [ ] Account ARR (higher ARR = higher priority)
- [ ] Renewal proximity (closer renewal = higher priority)
- [ ] Task type (escalation > check-in > administrative)
- [ ] Recent risk signals on account
- [ ] Time sensitivity (deadline approaching)
- [ ] Dependencies (blockers for other tasks)
- [ ] CSM workload (balance across portfolio)

### Task Types Priority Hierarchy
1. **Critical** (90-100): Active escalations, churn-prevention actions
2. **High** (70-89): At-risk account outreach, renewal prep, executive meetings
3. **Medium** (40-69): Regular check-ins, QBR prep, documentation
4. **Low** (0-39): Administrative, optional follow-ups, nice-to-haves

## Technical Specification

### Priority Scoring Algorithm

```typescript
interface PriorityFactors {
  // Account factors
  accountHealth: number;      // 0-100 (inverted: low health = high priority)
  accountARR: number;         // Normalized to 0-100
  renewalProximity: number;   // Days until renewal (closer = higher)
  activeRiskSignals: number;  // Count of unresolved signals

  // Task factors
  taskType: TaskType;
  dueDate: Date;
  isOverdue: boolean;
  hasBlockers: boolean;

  // Context factors
  recentInteraction: Date;    // Days since last touch
  sentimentTrend: 'improving' | 'stable' | 'declining';
}

function calculatePriority(factors: PriorityFactors): PriorityScore {
  let score = 50; // Base score

  // Account health impact (up to +30)
  score += (100 - factors.accountHealth) * 0.3;

  // ARR impact (up to +15)
  score += factors.accountARR * 0.15;

  // Renewal proximity (up to +20 for < 30 days)
  if (factors.renewalProximity < 30) {
    score += 20 * (1 - factors.renewalProximity / 30);
  } else if (factors.renewalProximity < 90) {
    score += 10 * (1 - (factors.renewalProximity - 30) / 60);
  }

  // Risk signals (up to +15)
  score += Math.min(factors.activeRiskSignals * 5, 15);

  // Task type multiplier
  score *= getTaskTypeMultiplier(factors.taskType);

  // Overdue penalty/boost
  if (factors.isOverdue) score += 15;

  // Declining sentiment boost
  if (factors.sentimentTrend === 'declining') score += 10;

  return {
    score: Math.min(Math.max(score, 0), 100),
    factors: generateExplanation(factors),
    category: categorize(score)
  };
}
```

### API Endpoints

#### GET /api/tasks/prioritized
```json
{
  "tasks": [
    {
      "id": "task-uuid",
      "title": "Call TechCorp about usage drop",
      "customer_id": "uuid",
      "customer_name": "TechCorp Industries",
      "due_date": "2026-01-30",
      "priority": {
        "score": 92,
        "category": "critical",
        "explanation": "High priority because: Health score dropped to 35 (-18), $250K ARR account, renewal in 45 days, 2 active risk signals",
        "factors": {
          "health_impact": 25,
          "arr_impact": 15,
          "renewal_impact": 18,
          "risk_impact": 10,
          "type_impact": 24
        }
      }
    }
  ],
  "recommendations": [
    "Focus on TechCorp today - multiple converging risk factors",
    "GlobalCo can wait until tomorrow - stable health",
    "Consider delegating routine check-ins to focus on critical accounts"
  ]
}
```

#### POST /api/tasks/prioritize
Recalculate priorities for a specific task or all tasks.

#### GET /api/ai/what-next
```json
{
  "top_priorities": [
    {
      "task": { ... },
      "reasoning": "TechCorp requires immediate attention. Their health score dropped 18 points this week due to a 40% decrease in daily active users. With renewal in 45 days and $250K ARR at risk, a proactive check-in call could prevent escalation."
    },
    { ... }
  ],
  "daily_focus": "Today your priority should be at-risk accounts. 3 accounts need attention before end of week.",
  "time_allocation": {
    "critical": "2-3 hours",
    "high": "2 hours",
    "medium": "1 hour"
  }
}
```

### Database Schema

```sql
CREATE TABLE task_priorities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id),
  score INTEGER NOT NULL,
  category VARCHAR(20) NOT NULL,
  factors JSONB NOT NULL,
  explanation TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  manual_override INTEGER,
  override_reason TEXT,
  override_by UUID
);

CREATE INDEX idx_task_priorities_score ON task_priorities(score DESC);
CREATE INDEX idx_task_priorities_task ON task_priorities(task_id);
```

### Real-Time Updates

Priority recalculation triggers:
- New risk signal detected
- Health score changes
- Task created/updated
- Renewal date approaches threshold
- CSM marks task complete (rebalances remaining)

Use WebSocket to push priority updates:
```typescript
socket.emit('priority_update', {
  task_id: 'uuid',
  old_score: 65,
  new_score: 88,
  reason: 'Health score dropped from 52 to 35'
});
```

## UI/UX Design

### Prioritized Task List
```
┌─────────────────────────────────────────────────────────┐
│ MY TASKS                             [Filter] [Sort ▼]  │
│ Showing: All tasks, sorted by AI Priority               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ CRITICAL (2 tasks)                                      │
│ ┌─────────────────────────────────────────────────────┐│
│ │ 🔴 92  Call TechCorp about usage drop               ││
│ │      TechCorp Industries | $250K | Due: Today       ││
│ │      Why: Health ↓18, 2 risk signals, renewal 45d   ││
│ │      [Start Call] [Reschedule] [View Account]       ││
│ └─────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────┐│
│ │ 🔴 88  Respond to GlobalCo escalation               ││
│ │      GlobalCo | $180K | Due: Today                  ││
│ │      Why: Active escalation, exec involved          ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ HIGH (5 tasks)                                          │
│ ┌─────────────────────────────────────────────────────┐│
│ │ 🟠 75  Prepare renewal proposal for Acme            ││
│ │      Acme Corp | $120K | Due: Feb 3                 ││
│ │      Why: Renewal in 30 days, good expansion opp    ││
│ └─────────────────────────────────────────────────────┘│
│ ...                                                     │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ [What should I work on?] Auto-prioritize refreshes q15m │
└─────────────────────────────────────────────────────────┘
```

### Priority Explanation Tooltip
Hover or click on priority score to see detailed breakdown:
- Health score impact: +25
- ARR value impact: +15
- Renewal proximity: +18
- Risk signals: +10
- Task type: x1.2

### Override Interface
```
┌─────────────────────────────────────────────┐
│ Override Priority for: Call TechCorp        │
├─────────────────────────────────────────────┤
│ AI Priority: 92 (Critical)                  │
│                                             │
│ Manual Priority: [    ] (0-100)             │
│                                             │
│ Reason for override:                        │
│ ┌─────────────────────────────────────────┐ │
│ │ Spoke with them yesterday, issue is     │ │
│ │ resolved but not yet reflected in data  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Apply Override] [Cancel]                   │
└─────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Tasks table with customer relationships
- Health score calculation system
- Risk signals detection system
- Real-time WebSocket infrastructure

### Related PRDs
- PRD-075: Predicted Next Best Action
- PRD-150: End of Day → Daily Summary
- PRD-057: "What Accounts Need Attention?" Briefing

## Success Metrics

### Quantitative
- CSMs complete 20% more high-priority tasks per week
- Time to address critical issues reduced by 30%
- At-risk account intervention rate increases by 25%
- Task completion aligns with business impact (correlation)

### Qualitative
- CSMs trust AI prioritization recommendations
- Reduced decision fatigue on "what to work on"
- Better work-life balance from efficient prioritization

## Rollout Plan

### Phase 1: Basic Scoring (Week 1-2)
- Priority algorithm implementation
- Static priority calculation
- Basic UI integration

### Phase 2: Intelligence (Week 3-4)
- Real-time updates on signals
- "What should I work on?" feature
- Priority explanations

### Phase 3: Refinement (Week 5-6)
- Manual override capability
- Manager visibility
- Priority history tracking

### Phase 4: Optimization (Week 7-8)
- Algorithm tuning based on outcomes
- Predictive priority (anticipate future needs)
- Cross-CSM workload balancing

## Open Questions
1. How do we measure if the priority algorithm is "correct"?
2. Should managers be able to force-prioritize tasks across team?
3. How do we handle tasks with no associated customer?
4. What's the ideal refresh frequency for priorities?
