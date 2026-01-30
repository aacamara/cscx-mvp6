# PRD-260: Team Goal Tracking

## Metadata
- **PRD ID**: PRD-260
- **Title**: Team Goal Tracking
- **Category**: I - Collaboration
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Metrics system, Customer data aggregation

---

## Problem Statement

CS teams set quarterly and annual goals (retention rate, NRR, NPS, QBR completion) but track progress in spreadsheets or separate tools. There's no integrated view connecting individual contributions to team goals, making it hard to course-correct and celebrate wins together.

## User Story

> As a CS leader, I want to set team and individual goals, track real-time progress against those goals, and understand how each team member contributes so that we stay aligned and motivated throughout the period.

---

## Functional Requirements

### FR-1: Goal Definition
- **FR-1.1**: Create team-level goals
- **FR-1.2**: Create individual goals cascading from team
- **FR-1.3**: Support various goal types (metric-based, task-based, milestone-based)
- **FR-1.4**: Set time periods (monthly, quarterly, annual)
- **FR-1.5**: Define targets with stretch goals

### FR-2: Metric Integration
- **FR-2.1**: Auto-connect goals to platform metrics
- **FR-2.2**: Real-time progress calculation
- **FR-2.3**: Manual progress entry for non-tracked items
- **FR-2.4**: Historical comparison to past periods
- **FR-2.5**: Forecasting based on trends

### FR-3: Progress Visualization
- **FR-3.1**: Team goal dashboard
- **FR-3.2**: Individual contribution view
- **FR-3.3**: Progress charts over time
- **FR-3.4**: Red/yellow/green status indicators
- **FR-3.5**: Leaderboard (optional, configurable)

### FR-4: Updates & Check-ins
- **FR-4.1**: Weekly automated progress updates
- **FR-4.2**: Manual check-in notes
- **FR-4.3**: Blocker documentation
- **FR-4.4**: Support requests linked to goals
- **FR-4.5**: Goal adjustment with reason

### FR-5: Celebration & Recognition
- **FR-5.1**: Goal achievement notifications
- **FR-5.2**: Milestone celebrations
- **FR-5.3**: Contribution highlights
- **FR-5.4**: Period-end summary
- **FR-5.5**: Badge/achievement system

---

## Non-Functional Requirements

### NFR-1: Real-Time
- Progress updates within 4 hours of underlying data change

### NFR-2: Accuracy
- Metric calculations match source systems

### NFR-3: Visibility
- Appropriate access controls (who sees what)

---

## Technical Approach

### Data Model Extensions

```sql
-- goal_periods table
CREATE TABLE goal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL, -- 'Q1 2026', 'FY 2026'
  period_type VARCHAR(20) NOT NULL, -- 'monthly', 'quarterly', 'annual'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- 'planning', 'active', 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- goals table
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID REFERENCES goal_periods(id) NOT NULL,
  parent_goal_id UUID REFERENCES goals(id), -- For cascading

  -- Ownership
  owner_type VARCHAR(20) NOT NULL, -- 'team', 'individual'
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES users(id),

  -- Goal definition
  name VARCHAR(500) NOT NULL,
  description TEXT,
  goal_type VARCHAR(50) NOT NULL, -- 'metric', 'task', 'milestone'

  -- For metric-based goals
  metric_name VARCHAR(200), -- 'nrr', 'retention_rate', 'nps', 'qbr_completion'
  metric_calculation JSONB, -- How to calculate from platform data
  baseline_value DECIMAL,
  target_value DECIMAL NOT NULL,
  stretch_target_value DECIMAL,
  target_direction VARCHAR(20) DEFAULT 'increase', -- 'increase', 'decrease', 'maintain'

  -- For task/milestone goals
  task_count_target INTEGER,
  milestones JSONB DEFAULT '[]',

  -- Current state
  current_value DECIMAL,
  progress_percentage DECIMAL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'on_track', -- 'on_track', 'at_risk', 'behind', 'achieved', 'exceeded'
  last_calculated_at TIMESTAMPTZ,

  -- Visibility
  is_public BOOLEAN DEFAULT true,
  show_in_leaderboard BOOLEAN DEFAULT true,

  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- goal_progress_history
CREATE TABLE goal_progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  value DECIMAL NOT NULL,
  progress_percentage DECIMAL,
  status VARCHAR(20),
  notes TEXT
);

-- goal_check_ins
CREATE TABLE goal_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  check_in_date DATE NOT NULL,
  progress_notes TEXT,
  blockers TEXT,
  support_needed TEXT,
  confidence_level INTEGER, -- 1-5 on achieving goal
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- goal_contributions (track individual -> team)
CREATE TABLE goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_goal_id UUID REFERENCES goals(id),
  individual_goal_id UUID REFERENCES goals(id),
  user_id UUID REFERENCES users(id),
  contribution_value DECIMAL,
  contribution_percentage DECIMAL,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- goal_achievements
CREATE TABLE goal_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id),
  user_id UUID REFERENCES users(id),
  achievement_type VARCHAR(50), -- 'achieved', 'exceeded', 'milestone'
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT false,
  celebrated BOOLEAN DEFAULT false
);

CREATE INDEX idx_goals_period ON goals(period_id);
CREATE INDEX idx_goals_owner ON goals(owner_type, team_id, user_id);
CREATE INDEX idx_goal_progress ON goal_progress_history(goal_id, recorded_at);
```

### Metric Calculation Engine

```typescript
interface MetricCalculator {
  name: string;
  calculate(scope: { team_id?: string; user_id?: string }, period: DateRange): Promise<number>;
}

const metricCalculators: Record<string, MetricCalculator> = {
  nrr: {
    name: 'Net Revenue Retention',
    async calculate(scope, period) {
      const customers = await getCustomersForScope(scope);
      const startArr = await getARRAtDate(customers, period.start);
      const endArr = await getARRAtDate(customers, period.end);
      return (endArr / startArr) * 100;
    }
  },
  retention_rate: {
    name: 'Gross Retention Rate',
    async calculate(scope, period) {
      const customers = await getCustomersForScope(scope);
      const renewals = await getRenewalsInPeriod(customers, period);
      const retained = renewals.filter(r => r.outcome === 'renewed').length;
      return (retained / renewals.length) * 100;
    }
  },
  nps: {
    name: 'Net Promoter Score',
    async calculate(scope, period) {
      const customers = await getCustomersForScope(scope);
      const surveys = await getNPSSurveys(customers, period);
      const promoters = surveys.filter(s => s.score >= 9).length;
      const detractors = surveys.filter(s => s.score <= 6).length;
      return ((promoters - detractors) / surveys.length) * 100;
    }
  },
  qbr_completion: {
    name: 'QBR Completion Rate',
    async calculate(scope, period) {
      const customers = await getCustomersForScope(scope);
      const expectedQBRs = customers.length; // One per customer per quarter
      const completedQBRs = await getCompletedQBRs(customers, period);
      return (completedQBRs.length / expectedQBRs) * 100;
    }
  }
};

async function updateGoalProgress(goalId: string): Promise<void> {
  const goal = await getGoal(goalId);
  if (goal.goal_type !== 'metric') return;

  const calculator = metricCalculators[goal.metric_name];
  if (!calculator) return;

  const period = await getGoalPeriod(goal.period_id);
  const scope = goal.owner_type === 'team' ? { team_id: goal.team_id } : { user_id: goal.user_id };

  const currentValue = await calculator.calculate(scope, {
    start: period.start_date,
    end: new Date() // Up to now
  });

  const progress = calculateProgress(goal.baseline_value, goal.target_value, currentValue);
  const status = determineStatus(progress, period);

  await updateGoal(goalId, { current_value: currentValue, progress_percentage: progress, status });
  await recordProgressHistory(goalId, currentValue, progress, status);
}
```

### API Endpoints

```typescript
// Goal periods
POST   /api/goal-periods
GET    /api/goal-periods
GET    /api/goal-periods/:id
PATCH  /api/goal-periods/:id

// Goals
POST   /api/goals
GET    /api/goals
GET    /api/goals/:id
PATCH  /api/goals/:id
DELETE /api/goals/:id

// Progress
GET    /api/goals/:id/progress
POST   /api/goals/:id/refresh
GET    /api/goals/:id/history

// Check-ins
POST   /api/goals/:id/check-ins
GET    /api/goals/:id/check-ins

// Contributions
GET    /api/goals/:id/contributions
GET    /api/users/:id/contributions

// Achievements
GET    /api/goals/achievements
POST   /api/achievements/:id/acknowledge
POST   /api/achievements/:id/celebrate

// Dashboards
GET    /api/goals/dashboard/team
GET    /api/goals/dashboard/individual
GET    /api/goals/leaderboard
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Goal visibility | 100% of team has goals | Goal assignment |
| Check-in completion | 90% weekly | Check-in tracking |
| Goal achievement rate | 80%+ | Outcome tracking |
| Engagement with dashboard | Weekly views per user | Analytics |

---

## Acceptance Criteria

- [ ] Admin can create goal periods
- [ ] Goals created at team and individual level
- [ ] Metric-based goals auto-calculate from platform data
- [ ] Progress updates real-time
- [ ] Dashboard shows team goal progress
- [ ] Individual contributions to team goals visible
- [ ] Weekly check-ins supported
- [ ] Achievement notifications sent
- [ ] Historical progress chart available
- [ ] Leaderboard (optional) displays

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Metric calculators | 4 days |
| Progress engine | 2 days |
| API endpoints | 2 days |
| Team dashboard | 3 days |
| Individual view | 2 days |
| Check-ins UI | 1 day |
| Achievements & celebration | 2 days |
| Testing | 2 days |
| **Total** | **20 days** |

---

## Notes

- Consider OKR framework alignment
- Add goal templates for common CS metrics
- Future: AI-suggested goals based on historical performance
- Future: Predictive alerts for at-risk goals
- Future: Compensation/bonus integration
