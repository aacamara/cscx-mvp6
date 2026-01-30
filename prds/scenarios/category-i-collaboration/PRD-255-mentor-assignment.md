# PRD-255: Mentor Assignment

## Metadata
- **PRD ID**: PRD-255
- **Title**: Mentor Assignment
- **Category**: I - Collaboration
- **Priority**: P3
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-250 (Expertise Tagging), PRD-254 (Best Practice Sharing)

---

## Problem Statement

New CSMs lack structured mentorship within CSCX.AI. While managers provide oversight, peer mentorship (from experienced CSMs) accelerates ramp time and knowledge transfer. Currently, mentor relationships are informal and untracked, making it hard to measure mentorship effectiveness or ensure all new hires receive adequate support.

## User Story

> As a CS leader, I want to formally assign mentors to new CSMs, track their mentorship activities, and measure the impact on ramp time so that I can optimize our onboarding program.

---

## Functional Requirements

### FR-1: Mentor Program Setup
- **FR-1.1**: Define mentor eligibility criteria (tenure, performance, etc.)
- **FR-1.2**: Mentor opt-in with capacity limits
- **FR-1.3**: Mentor profile with expertise and availability
- **FR-1.4**: Mentor training/certification tracking
- **FR-1.5**: Mentor recognition program

### FR-2: Mentee Assignment
- **FR-2.1**: Auto-suggest mentor based on matching criteria
- **FR-2.2**: Manager assigns mentor to new CSM
- **FR-2.3**: Mentor accepts/declines assignment
- **FR-2.4**: Define mentorship duration and goals
- **FR-2.5**: Mentorship agreement/expectations

### FR-3: Mentorship Activities
- **FR-3.1**: Suggested check-in cadence
- **FR-3.2**: Log mentorship sessions
- **FR-3.3**: Track topics covered
- **FR-3.4**: Capture action items and progress
- **FR-3.5**: Resource sharing within mentorship

### FR-4: Progress Tracking
- **FR-4.1**: Mentee ramp milestones
- **FR-4.2**: Skill progression tracking
- **FR-4.3**: Mentee confidence self-assessment
- **FR-4.4**: Mentor feedback on progress
- **FR-4.5**: Manager visibility into mentorship

### FR-5: Program Analytics
- **FR-5.1**: Ramp time comparison (mentored vs not)
- **FR-5.2**: Mentor workload distribution
- **FR-5.3**: Session frequency metrics
- **FR-5.4**: Mentee satisfaction scores
- **FR-5.5**: Mentor effectiveness ranking

---

## Non-Functional Requirements

### NFR-1: Privacy
- Mentorship conversations private between mentor/mentee

### NFR-2: Flexibility
- Support various mentorship structures (1:1, group, topic-based)

### NFR-3: Integration
- Tie into onboarding workflow and training

---

## Technical Approach

### Data Model Extensions

```sql
-- mentors table
CREATE TABLE mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  max_mentees INTEGER DEFAULT 2,
  current_mentee_count INTEGER DEFAULT 0,
  expertise_areas TEXT[] DEFAULT '{}',
  availability_notes TEXT,
  total_mentees_to_date INTEGER DEFAULT 0,
  average_rating DECIMAL,
  is_certified BOOLEAN DEFAULT false,
  certified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- mentorship_assignments table
CREATE TABLE mentorship_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES mentors(id) NOT NULL,
  mentee_user_id UUID REFERENCES users(id) NOT NULL,
  assigned_by_user_id UUID REFERENCES users(id),

  -- Configuration
  start_date DATE NOT NULL,
  expected_end_date DATE,
  actual_end_date DATE,
  check_in_cadence VARCHAR(50) DEFAULT 'weekly', -- 'weekly', 'biweekly', 'monthly'

  -- Goals
  goals JSONB DEFAULT '[]', -- [{goal: string, target_date: date, achieved: bool}]
  milestones JSONB DEFAULT '[]',

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled'
  mentor_accepted_at TIMESTAMPTZ,

  -- Completion
  completion_notes TEXT,
  mentor_feedback TEXT,
  mentee_feedback TEXT,
  mentee_rating INTEGER, -- 1-5

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- mentorship_sessions table
CREATE TABLE mentorship_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES mentorship_assignments(id) ON DELETE CASCADE,
  session_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,

  -- Content
  topics_covered TEXT[] DEFAULT '{}',
  summary TEXT,
  action_items JSONB DEFAULT '[]', -- [{item: string, owner: 'mentor'|'mentee', due: date, done: bool}]
  resources_shared JSONB DEFAULT '[]',

  -- Assessment
  mentee_confidence_before INTEGER, -- 1-5
  mentee_confidence_after INTEGER, -- 1-5
  session_quality INTEGER, -- 1-5

  logged_by VARCHAR(20), -- 'mentor' or 'mentee'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- mentee_ramp_milestones
CREATE TABLE mentee_ramp_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES mentorship_assignments(id),
  mentee_user_id UUID REFERENCES users(id),
  milestone_name VARCHAR(200) NOT NULL,
  description TEXT,
  target_date DATE,
  achieved_date DATE,
  verification_method VARCHAR(50), -- 'self_report', 'mentor_verified', 'system_tracked'
  verified_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mentors_active ON mentors(is_active, current_mentee_count);
CREATE INDEX idx_mentorship_assignments_mentor ON mentorship_assignments(mentor_id);
CREATE INDEX idx_mentorship_assignments_mentee ON mentorship_assignments(mentee_user_id);
CREATE INDEX idx_mentorship_sessions ON mentorship_sessions(assignment_id, session_date);
```

### Mentor Matching Algorithm

```typescript
interface MentorMatch {
  mentor_id: string;
  match_score: number;
  factors: {
    expertise_overlap: number;
    capacity_available: boolean;
    location_match: boolean;
    past_success_rate: number;
  };
}

async function findBestMentors(mentee: User): Promise<MentorMatch[]> {
  const availableMentors = await db.query(`
    SELECT m.*, u.* FROM mentors m
    JOIN users u ON m.user_id = u.id
    WHERE m.is_active = true
      AND m.current_mentee_count < m.max_mentees
      AND m.user_id != $1
  `, [mentee.id]);

  const matches = await Promise.all(availableMentors.map(async mentor => {
    // Expertise overlap
    const menteeNeeds = await getMenteeSkillGaps(mentee.id);
    const expertiseOverlap = calculateOverlap(mentor.expertise_areas, menteeNeeds);

    // Location/timezone match
    const locationMatch = mentor.timezone === mentee.timezone;

    // Past success
    const pastAssignments = await getPastAssignments(mentor.id);
    const successRate = pastAssignments.length > 0
      ? pastAssignments.filter(a => a.status === 'completed' && a.mentee_rating >= 4).length / pastAssignments.length
      : 0.5;

    return {
      mentor_id: mentor.id,
      match_score: (expertiseOverlap * 40) + (locationMatch ? 20 : 0) + (successRate * 40),
      factors: {
        expertise_overlap: expertiseOverlap,
        capacity_available: true,
        location_match: locationMatch,
        past_success_rate: successRate
      }
    };
  }));

  return matches.sort((a, b) => b.match_score - a.match_score);
}
```

### API Endpoints

```typescript
// Mentors
GET    /api/mentors
POST   /api/mentors (opt-in)
PATCH  /api/mentors/:id
DELETE /api/mentors/:id (opt-out)

// Assignments
POST   /api/mentorship-assignments
GET    /api/mentorship-assignments
GET    /api/mentorship-assignments/:id
PATCH  /api/mentorship-assignments/:id
POST   /api/mentorship-assignments/:id/accept
POST   /api/mentorship-assignments/:id/complete

// Matching
GET    /api/mentors/matches?mentee={userId}

// Sessions
POST   /api/mentorship-assignments/:id/sessions
GET    /api/mentorship-assignments/:id/sessions
PATCH  /api/mentorship-sessions/:id

// Milestones
GET    /api/mentorship-assignments/:id/milestones
POST   /api/mentorship-assignments/:id/milestones
PATCH  /api/mentee-milestones/:id

// Analytics
GET    /api/mentorship/analytics
GET    /api/mentorship/ramp-comparison
GET    /api/mentors/:id/effectiveness
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mentorship coverage | 100% new CSMs | Assignment tracking |
| Ramp time reduction | 20% faster | Milestone comparison |
| Session completion rate | 90%+ of scheduled | Session logs |
| Mentee satisfaction | 4.5/5 | Feedback ratings |
| Mentor satisfaction | 4/5 | Mentor surveys |

---

## Acceptance Criteria

- [ ] Experienced CSMs can opt-in as mentors
- [ ] System suggests best mentor matches
- [ ] Manager can assign mentor to new CSM
- [ ] Mentor can accept/decline assignment
- [ ] Check-in reminders sent per cadence
- [ ] Sessions can be logged with topics and action items
- [ ] Milestones tracked with completion dates
- [ ] Both parties can provide feedback
- [ ] Analytics compare mentored vs non-mentored ramp

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Mentor matching | 2 days |
| API endpoints | 2 days |
| Mentor signup UI | 1 day |
| Assignment workflow | 2 days |
| Session logging | 2 days |
| Milestone tracking | 2 days |
| Analytics dashboard | 2 days |
| Testing | 2 days |
| **Total** | **17 days** |

---

## Notes

- Consider integration with Learning Management System (LMS)
- Add mentorship curriculum/suggested topics
- Future: Group mentorship for common topics
- Future: Reverse mentorship (new CSM teaches veteran)
- Future: Mentorship matching AI improvements
