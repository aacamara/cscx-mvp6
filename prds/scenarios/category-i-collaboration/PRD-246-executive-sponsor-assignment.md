# PRD-246: Executive Sponsor Assignment

## Metadata
- **PRD ID**: PRD-246
- **Title**: Executive Sponsor Assignment
- **Category**: I - Collaboration
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Stakeholder mapping, Customer segmentation

---

## Problem Statement

High-value accounts require executive sponsorship from within the vendor organization to build strategic relationships and ensure customer success at the highest levels. Currently, executive sponsor assignments are ad-hoc, with no structured process for matching, tracking engagement, or measuring impact.

## User Story

> As a CS leader, I want to systematically assign executive sponsors to strategic accounts, track their engagement, and measure the impact on customer outcomes so that we maximize the value of executive relationships.

---

## Functional Requirements

### FR-1: Assignment Criteria
- **FR-1.1**: Define executive sponsor eligibility criteria (ARR threshold, segment, etc.)
- **FR-1.2**: Auto-flag accounts qualifying for executive sponsorship
- **FR-1.3**: Consider industry/persona alignment in recommendations
- **FR-1.4**: Track executive sponsor capacity/portfolio

### FR-2: Assignment Workflow
- **FR-2.1**: Request executive sponsor for account
- **FR-2.2**: Suggest best-fit executives based on criteria
- **FR-2.3**: Executive accepts/declines assignment
- **FR-2.4**: Notify CSM and customer team of assignment
- **FR-2.5**: Record assignment history

### FR-3: Engagement Tracking
- **FR-3.1**: Track executive-customer interactions
- **FR-3.2**: Log meetings, emails, executive business reviews
- **FR-3.3**: Set engagement cadence expectations
- **FR-3.4**: Alert for overdue executive touchpoints
- **FR-3.5**: Capture engagement notes and outcomes

### FR-4: Portfolio Management
- **FR-4.1**: Executive sponsor dashboard showing portfolio
- **FR-4.2**: Account health overview for sponsored accounts
- **FR-4.3**: Upcoming commitments and deadlines
- **FR-4.4**: Recommended actions per account
- **FR-4.5**: Delegate to backup during PTO

### FR-5: Impact Measurement
- **FR-5.1**: Compare outcomes of sponsored vs non-sponsored accounts
- **FR-5.2**: Track renewal rates with executive engagement
- **FR-5.3**: Measure expansion correlation
- **FR-5.4**: NPS lift analysis
- **FR-5.5**: Executive sponsor scorecard

---

## Non-Functional Requirements

### NFR-1: Scalability
- Support 50+ executives with 10+ accounts each

### NFR-2: Privacy
- Executive engagement details visible only to appropriate roles

### NFR-3: Integration
- Sync with executive calendars
- Track engagement from email/calendar data

---

## Technical Approach

### Data Model Extensions

```sql
-- executive_sponsors table
CREATE TABLE executive_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE,
  title VARCHAR(200),
  bio TEXT,
  industries TEXT[],
  specialties TEXT[],
  max_accounts INTEGER DEFAULT 10,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- executive_assignments table
CREATE TABLE executive_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  executive_sponsor_id UUID REFERENCES executive_sponsors(id) NOT NULL,
  assigned_by_user_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'active', -- 'proposed', 'active', 'ended'
  engagement_cadence VARCHAR(50) DEFAULT 'quarterly', -- 'monthly', 'quarterly', 'biannual'
  assignment_reason TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  end_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_id, executive_sponsor_id, started_at)
);

-- executive_engagements table
CREATE TABLE executive_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES executive_assignments(id),
  customer_id UUID REFERENCES customers(id),
  executive_sponsor_id UUID REFERENCES executive_sponsors(id),
  engagement_type VARCHAR(50), -- 'meeting', 'email', 'ebr', 'call', 'event'
  title VARCHAR(500),
  description TEXT,
  customer_attendees TEXT[], -- Names/roles of customer attendees
  outcome TEXT,
  next_steps TEXT,
  engagement_date TIMESTAMPTZ,
  logged_by_user_id UUID REFERENCES users(id),
  source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'calendar', 'email'
  external_id VARCHAR(200), -- calendar event ID, email thread ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- executive_sponsor_criteria (configurable rules)
CREATE TABLE executive_sponsor_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200),
  conditions JSONB NOT NULL, -- {arr_min: 500000, segment: 'enterprise', ...}
  auto_qualify BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true
);

CREATE INDEX idx_exec_assignments_customer ON executive_assignments(customer_id);
CREATE INDEX idx_exec_assignments_sponsor ON executive_assignments(executive_sponsor_id);
CREATE INDEX idx_exec_engagements_assignment ON executive_engagements(assignment_id);
CREATE INDEX idx_exec_engagements_date ON executive_engagements(engagement_date DESC);
```

### Matching Algorithm

```typescript
interface ExecutiveMatch {
  executive_sponsor_id: string;
  match_score: number;
  factors: {
    industry_match: boolean;
    capacity_available: boolean;
    relationship_history: boolean;
    specialty_match: boolean;
  };
}

async function findBestExecutiveSponsor(customer: Customer): Promise<ExecutiveMatch[]> {
  const activeSponsors = await getActiveExecutiveSponsors();

  const matches = await Promise.all(activeSponsors.map(async (exec) => {
    const currentLoad = await getAssignmentCount(exec.id);
    const hasCapacity = currentLoad < exec.max_accounts;
    const industryMatch = exec.industries.includes(customer.industry);
    const specialtyMatch = exec.specialties.some(s =>
      customer.metadata?.needs?.includes(s)
    );
    const hasHistory = await hasPriorRelationship(exec.id, customer.id);

    const score = calculateScore({
      hasCapacity: hasCapacity ? 30 : 0,
      industryMatch: industryMatch ? 25 : 0,
      specialtyMatch: specialtyMatch ? 25 : 0,
      hasHistory: hasHistory ? 20 : 0
    });

    return {
      executive_sponsor_id: exec.id,
      match_score: score,
      factors: { industry_match: industryMatch, capacity_available: hasCapacity,
                 relationship_history: hasHistory, specialty_match: specialtyMatch }
    };
  }));

  return matches.filter(m => m.factors.capacity_available).sort((a, b) => b.match_score - a.match_score);
}
```

### API Endpoints

```typescript
// Executive sponsor management
GET    /api/executive-sponsors
POST   /api/executive-sponsors
GET    /api/executive-sponsors/:id
PATCH  /api/executive-sponsors/:id

// Assignments
GET    /api/executive-assignments
POST   /api/executive-assignments
PATCH  /api/executive-assignments/:id
DELETE /api/executive-assignments/:id

// Matching
GET    /api/customers/:id/executive-sponsor-matches

// Engagements
POST   /api/executive-engagements
GET    /api/executive-engagements
GET    /api/executive-assignments/:id/engagements

// Dashboard
GET    /api/executive-sponsors/:id/portfolio
GET    /api/executive-sponsors/:id/dashboard
GET    /api/executive-sponsors/impact-metrics
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sponsored account coverage | 100% of qualifying accounts | Assignment tracking |
| Executive engagement cadence | 90% meeting cadence | Engagement logs |
| Renewal rate (sponsored vs not) | 10% lift | Outcome comparison |
| Expansion revenue (sponsored) | 15% lift | Revenue tracking |

---

## Acceptance Criteria

- [ ] Accounts auto-flagged when meeting sponsor criteria
- [ ] CS leader can request sponsor assignment
- [ ] System suggests best-fit executives
- [ ] Executive can accept/decline assignment
- [ ] Engagement tracking logs all interactions
- [ ] Alerts sent for overdue touchpoints
- [ ] Executive dashboard shows portfolio
- [ ] Impact metrics compare sponsored vs non-sponsored

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Matching algorithm | 2 days |
| API endpoints | 2 days |
| Assignment UI | 2 days |
| Executive dashboard | 3 days |
| Engagement tracking | 2 days |
| Impact reporting | 2 days |
| Testing | 2 days |
| **Total** | **17 days** |

---

## Notes

- Consider executive preference weights in matching
- Add executive prep brief generation before engagements
- Future: AI-generated talking points for executives
- Future: Sentiment analysis on executive engagement outcomes
- Future: Predictive modeling of optimal executive pairing
