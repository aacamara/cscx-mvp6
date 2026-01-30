# PRD-258: Coverage Backup System

## Metadata
- **PRD ID**: PRD-258
- **Title**: Coverage Backup System
- **Category**: I - Collaboration
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-247 (Team Handoff Workflow), Calendar integration

---

## Problem Statement

When CSMs are out of office (PTO, sick leave, conferences), customer coverage suffers. Backup assignments are informal, backup CSMs lack context, and customers may receive no response during critical periods. There's no systematic way to ensure continuous coverage.

## User Story

> As a CS manager, I want to automatically assign backup coverage when CSMs are unavailable, ensure backups have the necessary context, and track coverage quality so that customers receive consistent service regardless of their CSM's availability.

---

## Functional Requirements

### FR-1: Absence Management
- **FR-1.1**: CSM logs planned absence (dates, type, partial/full day)
- **FR-1.2**: Auto-detect calendar blocks (OOO, vacation)
- **FR-1.3**: Set coverage preferences (preferred backup, specific needs)
- **FR-1.4**: Unplanned absence quick-entry for emergencies
- **FR-1.5**: Absence calendar view for team

### FR-2: Backup Assignment
- **FR-2.1**: Auto-suggest backup based on capacity and familiarity
- **FR-2.2**: Manager approves or modifies backup assignment
- **FR-2.3**: Backup accepts coverage responsibility
- **FR-2.4**: Partial coverage (specific accounts only)
- **FR-2.5**: Tiered backup (primary and secondary)

### FR-3: Context Transfer
- **FR-3.1**: Auto-generate coverage brief per account
- **FR-3.2**: Highlight urgent items and pending actions
- **FR-3.3**: Key contacts and communication history
- **FR-3.4**: Risk flags and special handling notes
- **FR-3.5**: Scheduled events during coverage period

### FR-4: During Coverage
- **FR-4.1**: Backup receives notifications for covered accounts
- **FR-4.2**: Actions logged under backup but linked to original CSM
- **FR-4.3**: Quick context access when customer reaches out
- **FR-4.4**: Escalation path if backup unavailable

### FR-5: Return & Handback
- **FR-5.1**: Auto-notify original CSM of return date approaching
- **FR-5.2**: Coverage summary with actions taken
- **FR-5.3**: Handback meeting scheduling
- **FR-5.4**: Outstanding items highlighted
- **FR-5.5**: Feedback from backup on accounts

---

## Non-Functional Requirements

### NFR-1: Reliability
- No customer gaps during CSM absence

### NFR-2: Timeliness
- Coverage brief ready before absence starts

### NFR-3: Transparency
- Clear audit of who had coverage when

---

## Technical Approach

### Data Model Extensions

```sql
-- csm_absences table
CREATE TABLE csm_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  absence_type VARCHAR(50) NOT NULL, -- 'vacation', 'sick', 'conference', 'parental', 'other'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_partial BOOLEAN DEFAULT false,
  partial_hours TEXT, -- e.g., "9am-12pm" if partial

  -- Preferences
  preferred_backup_user_id UUID REFERENCES users(id),
  special_instructions TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'planned', -- 'planned', 'coverage_assigned', 'active', 'completed', 'cancelled'
  calendar_event_id VARCHAR(200), -- Linked calendar OOO event

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- coverage_assignments table
CREATE TABLE coverage_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_id UUID REFERENCES csm_absences(id) ON DELETE CASCADE,
  backup_user_id UUID REFERENCES users(id) NOT NULL,
  assigned_by_user_id UUID REFERENCES users(id),

  -- Scope
  coverage_type VARCHAR(50) DEFAULT 'full', -- 'full', 'partial', 'tiered'
  covered_customer_ids UUID[], -- Null = all accounts

  -- Tier (for tiered coverage)
  tier INTEGER DEFAULT 1, -- 1 = primary, 2 = secondary

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'active', 'completed'
  accepted_at TIMESTAMPTZ,
  declined_reason TEXT,

  -- Metrics
  notifications_received INTEGER DEFAULT 0,
  actions_taken INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- coverage_briefs table
CREATE TABLE coverage_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coverage_assignment_id UUID REFERENCES coverage_assignments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) NOT NULL,

  -- Generated content
  brief_content JSONB NOT NULL, -- Structured brief data
  generated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Access tracking
  viewed_at TIMESTAMPTZ,

  -- During coverage
  notes_added TEXT,
  actions_taken JSONB DEFAULT '[]'
);

-- coverage_activities table
CREATE TABLE coverage_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coverage_assignment_id UUID REFERENCES coverage_assignments(id),
  customer_id UUID REFERENCES customers(id),
  backup_user_id UUID REFERENCES users(id),
  original_csm_id UUID REFERENCES users(id),

  -- Activity
  activity_type VARCHAR(100) NOT NULL,
  description TEXT,
  outcome TEXT,

  -- Related entities
  related_entity_type VARCHAR(50),
  related_entity_id UUID,

  activity_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_absences_user ON csm_absences(user_id, start_date);
CREATE INDEX idx_absences_dates ON csm_absences(start_date, end_date);
CREATE INDEX idx_coverage_assignments_backup ON coverage_assignments(backup_user_id);
CREATE INDEX idx_coverage_briefs_assignment ON coverage_briefs(coverage_assignment_id);
```

### Backup Suggestion Algorithm

```typescript
interface BackupSuggestion {
  user_id: string;
  score: number;
  factors: {
    capacity_score: number;
    familiarity_score: number;
    skill_match_score: number;
    preference_score: number;
  };
}

async function suggestBackups(absence: CSMAbsence): Promise<BackupSuggestion[]> {
  const absentUser = await getUser(absence.user_id);
  const portfolio = await getCustomerPortfolio(absence.user_id);

  // Get potential backups (same team, not also out)
  const candidates = await getAvailableTeamMembers(absentUser.team_id, absence.start_date, absence.end_date);

  const suggestions = await Promise.all(candidates.map(async (candidate) => {
    // Capacity - how many accounts do they already have + pending coverage
    const currentLoad = await getPortfolioSize(candidate.id);
    const coverageLoad = await getPendingCoverageLoad(candidate.id, absence.start_date, absence.end_date);
    const capacityScore = Math.max(0, 100 - (currentLoad + coverageLoad) * 2);

    // Familiarity - have they worked with these customers before?
    const familiarCustomers = await getSharedCustomerHistory(candidate.id, portfolio.map(c => c.id));
    const familiarityScore = (familiarCustomers.length / portfolio.length) * 100;

    // Skill match - similar segment/industry expertise
    const skillMatch = await calculateSkillOverlap(candidate.id, absentUser.id);

    // Preference - is this the preferred backup?
    const preferenceScore = absence.preferred_backup_user_id === candidate.id ? 30 : 0;

    return {
      user_id: candidate.id,
      score: (capacityScore * 0.3) + (familiarityScore * 0.3) + (skillMatch * 0.25) + preferenceScore,
      factors: {
        capacity_score: capacityScore,
        familiarity_score: familiarityScore,
        skill_match_score: skillMatch,
        preference_score: preferenceScore
      }
    };
  }));

  return suggestions.sort((a, b) => b.score - a.score);
}
```

### Coverage Brief Generation

```typescript
interface CoverageBrief {
  customer: {
    name: string;
    arr: number;
    health_score: number;
    stage: string;
    renewal_date: string;
  };
  key_contacts: Stakeholder[];
  urgent_items: {
    type: string;
    description: string;
    due_date: string;
  }[];
  recent_activity: Activity[];
  scheduled_events: CalendarEvent[];
  risk_flags: RiskSignal[];
  special_notes: string;
}

async function generateCoverageBrief(customerId: string, coveragePeriod: DateRange): Promise<CoverageBrief> {
  const [customer, stakeholders, tasks, activities, events, risks] = await Promise.all([
    getCustomer(customerId),
    getStakeholders(customerId),
    getOpenTasks(customerId),
    getRecentActivities(customerId, 14),
    getScheduledEvents(customerId, coveragePeriod),
    getActiveRiskSignals(customerId)
  ]);

  return {
    customer: {
      name: customer.name,
      arr: customer.arr,
      health_score: customer.health_score,
      stage: customer.stage,
      renewal_date: customer.renewal_date
    },
    key_contacts: stakeholders.filter(s => s.is_primary).slice(0, 3),
    urgent_items: tasks.filter(t => t.due_at && isWithinDays(t.due_at, 14)),
    recent_activity: activities.slice(0, 5),
    scheduled_events: events,
    risk_flags: risks,
    special_notes: '' // CSM can add before leaving
  };
}
```

### API Endpoints

```typescript
// Absences
POST   /api/absences
GET    /api/absences
GET    /api/absences/:id
PATCH  /api/absences/:id
DELETE /api/absences/:id

// Coverage assignments
GET    /api/absences/:id/coverage
POST   /api/absences/:id/coverage
PATCH  /api/coverage-assignments/:id
POST   /api/coverage-assignments/:id/accept
POST   /api/coverage-assignments/:id/decline

// Backup suggestions
GET    /api/absences/:id/backup-suggestions

// Coverage briefs
GET    /api/coverage-assignments/:id/briefs
POST   /api/coverage-briefs/:id/notes

// Coverage activities
POST   /api/coverage-assignments/:id/activities
GET    /api/coverage-assignments/:id/activities

// Return/Handback
GET    /api/coverage-assignments/:id/summary
POST   /api/coverage-assignments/:id/complete

// Team view
GET    /api/team/absences
GET    /api/team/coverage-calendar
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Coverage assignment rate | 100% of absences | Assignment tracking |
| Customer response time (during coverage) | Same as normal | Response time metrics |
| Coverage acceptance rate | 95%+ | Assignment acceptance |
| Handback completion | 100% | Completion tracking |

---

## Acceptance Criteria

- [ ] CSM can log planned absence with dates
- [ ] System suggests backup based on capacity and familiarity
- [ ] Manager can assign backup coverage
- [ ] Backup accepts and receives coverage briefs
- [ ] Coverage brief includes key context per account
- [ ] Backup receives notifications for covered accounts
- [ ] Activities during coverage logged with linkage
- [ ] Coverage summary generated for handback
- [ ] Team absence calendar visible
- [ ] Unplanned absence quick-entry works

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Backup suggestion algorithm | 2 days |
| Coverage brief generation | 2 days |
| API endpoints | 3 days |
| Absence management UI | 2 days |
| Coverage management UI | 3 days |
| Notification routing | 2 days |
| Handback flow | 1 day |
| Testing | 2 days |
| **Total** | **19 days** |

---

## Notes

- Consider calendar integration for auto-detection of OOO
- Add coverage quality metrics
- Future: AI-suggested special instructions based on portfolio
- Future: Automated coverage for sudden absences
- Future: Coverage pooling for small teams
