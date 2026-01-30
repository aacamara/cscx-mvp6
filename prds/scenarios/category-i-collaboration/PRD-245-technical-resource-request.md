# PRD-245: Technical Resource Request

## Metadata
- **PRD ID**: PRD-245
- **Title**: Technical Resource Request
- **Category**: I - Collaboration
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-250 (Expertise Tagging), PRD-251 (Resource Scheduling)

---

## Problem Statement

CSMs often need to bring in technical resources (Solutions Architects, Solutions Engineers, Technical Account Managers, Implementation Specialists) for complex customer engagements. Currently, finding the right resource with availability requires manual coordination through Slack/email, leading to delays and suboptimal resource matching.

## User Story

> As a CSM, I want to request technical resources for my customer engagements with clear requirements, see available resources with relevant expertise, and book their time directly from CSCX.AI so that I can deliver technical value to customers faster.

---

## Functional Requirements

### FR-1: Request Creation
- **FR-1.1**: Create resource request from customer detail page
- **FR-1.2**: Select engagement type (Implementation, Training, Technical Review, Architecture Session, Troubleshooting)
- **FR-1.3**: Specify required skills/certifications
- **FR-1.4**: Define time commitment (hours, duration, dates)
- **FR-1.5**: Provide context (customer tech stack, goals, challenges)
- **FR-1.6**: Set priority level affecting queue position

### FR-2: Resource Matching
- **FR-2.1**: Display available resources matching requirements
- **FR-2.2**: Show resource expertise scores for requested skills
- **FR-2.3**: Show resource availability calendar
- **FR-2.4**: Display past experience with similar customers
- **FR-2.5**: Indicate resource workload/utilization
- **FR-2.6**: AI-suggested best match based on all factors

### FR-3: Booking & Scheduling
- **FR-3.1**: Request specific resource or let manager assign
- **FR-3.2**: Propose meeting times based on mutual availability
- **FR-3.3**: Integration with resource's calendar
- **FR-3.4**: Automatic calendar hold on request submission
- **FR-3.5**: Resource accepts/declines/proposes alternatives

### FR-4: Resource Manager View
- **FR-4.1**: Queue of pending resource requests
- **FR-4.2**: Resource utilization dashboard
- **FR-4.3**: Assignment recommendations based on capacity
- **FR-4.4**: Bulk assignment for similar requests
- **FR-4.5**: Workload balancing alerts

### FR-5: Engagement Tracking
- **FR-5.1**: Track engagement status (Requested -> Assigned -> Scheduled -> In Progress -> Completed)
- **FR-5.2**: Log hours spent on engagement
- **FR-5.3**: Capture outcomes and deliverables
- **FR-5.4**: Feedback from CSM and resource
- **FR-5.5**: Link to customer success metrics

---

## Non-Functional Requirements

### NFR-1: Performance
- Resource matching results < 2 seconds
- Calendar availability check < 1 second

### NFR-2: Scalability
- Support 100+ technical resources
- Handle 500+ requests per month

### NFR-3: Integration
- Sync with Google Calendar/Outlook
- Update resource utilization in real-time

---

## Technical Approach

### Data Model Extensions

```sql
-- resource_skills table
CREATE TABLE resource_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50), -- 'technical', 'product', 'industry', 'certification'
  description TEXT
);

-- user_skills (many-to-many)
CREATE TABLE user_skills (
  user_id UUID REFERENCES users(id),
  skill_id UUID REFERENCES resource_skills(id),
  proficiency_level INTEGER DEFAULT 3, -- 1-5 scale
  verified BOOLEAN DEFAULT false,
  verified_by_user_id UUID REFERENCES users(id),
  years_experience DECIMAL,
  PRIMARY KEY (user_id, skill_id)
);

-- resource_requests table
CREATE TABLE resource_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  requested_by_user_id UUID REFERENCES users(id) NOT NULL,

  -- Request details
  engagement_type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  customer_context TEXT,
  required_skills UUID[] DEFAULT '{}', -- Array of skill IDs
  preferred_skills UUID[] DEFAULT '{}',

  -- Time requirements
  estimated_hours INTEGER,
  start_date DATE,
  end_date DATE,
  urgency VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  flexibility VARCHAR(50), -- 'exact_dates', 'flexible_week', 'flexible_month'

  -- Assignment
  status VARCHAR(50) DEFAULT 'pending',
  assigned_resource_id UUID REFERENCES users(id),
  assigned_by_user_id UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ,

  -- Scheduling
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  calendar_event_ids JSONB DEFAULT '[]',

  -- Completion
  actual_hours INTEGER,
  outcome_summary TEXT,
  deliverables JSONB DEFAULT '[]',
  csm_rating INTEGER,
  resource_rating INTEGER,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- resource_availability table
CREATE TABLE resource_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  available_hours DECIMAL DEFAULT 8,
  booked_hours DECIMAL DEFAULT 0,
  notes TEXT,
  UNIQUE (user_id, date)
);

-- resource_engagements table (time tracking)
CREATE TABLE resource_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES resource_requests(id),
  resource_user_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  hours_logged DECIMAL NOT NULL,
  activity_type VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resource_requests_status ON resource_requests(status);
CREATE INDEX idx_resource_requests_customer ON resource_requests(customer_id);
CREATE INDEX idx_resource_availability_date ON resource_availability(user_id, date);
CREATE INDEX idx_user_skills_skill ON user_skills(skill_id);
```

### Resource Matching Algorithm

```typescript
interface ResourceMatch {
  user_id: string;
  match_score: number;
  skill_match: number;
  availability_score: number;
  workload_score: number;
  experience_score: number;
  details: {
    matched_skills: { skill: string; proficiency: number }[];
    available_hours: number;
    current_utilization: number;
    similar_customers: number;
  };
}

async function findMatchingResources(request: ResourceRequest): Promise<ResourceMatch[]> {
  const resources = await getResourcePoolByRole(request.engagement_type);

  const matches = await Promise.all(resources.map(async (resource) => {
    const skillMatch = calculateSkillMatch(resource, request.required_skills, request.preferred_skills);
    const availability = await getAvailability(resource.id, request.start_date, request.end_date);
    const workload = await getCurrentWorkload(resource.id);
    const experience = await getSimilarCustomerExperience(resource.id, request.customer_id);

    return {
      user_id: resource.id,
      match_score: weightedAverage([
        { score: skillMatch, weight: 0.4 },
        { score: availability, weight: 0.3 },
        { score: workload, weight: 0.2 },
        { score: experience, weight: 0.1 }
      ]),
      skill_match: skillMatch,
      availability_score: availability,
      workload_score: workload,
      experience_score: experience,
      details: { /* ... */ }
    };
  }));

  return matches.sort((a, b) => b.match_score - a.match_score);
}
```

### API Endpoints

```typescript
// Resource requests
POST   /api/resource-requests
GET    /api/resource-requests
GET    /api/resource-requests/:id
PATCH  /api/resource-requests/:id

// Resource matching
GET    /api/resource-requests/:id/matches
POST   /api/resource-requests/:id/assign

// Resource actions
POST   /api/resource-requests/:id/accept
POST   /api/resource-requests/:id/decline
POST   /api/resource-requests/:id/propose-times

// Scheduling
POST   /api/resource-requests/:id/schedule
GET    /api/resources/:id/availability
PATCH  /api/resources/:id/availability

// Time tracking
POST   /api/resource-requests/:id/log-time
GET    /api/resource-requests/:id/time-entries

// Resource manager dashboard
GET    /api/resource-manager/queue
GET    /api/resource-manager/utilization
GET    /api/resource-manager/recommendations
```

### Calendar Integration

```typescript
// Check mutual availability
async function findMutualAvailability(
  csmId: string,
  resourceId: string,
  customerId: string,
  durationMinutes: number,
  dateRange: { start: Date; end: Date }
): Promise<TimeSlot[]> {
  const csmCalendar = await googleCalendar.getAvailability(csmId, dateRange);
  const resourceCalendar = await googleCalendar.getAvailability(resourceId, dateRange);

  // Find overlapping free slots
  return findOverlappingSlots(csmCalendar, resourceCalendar, durationMinutes);
}

// Book engagement
async function bookEngagement(request: ResourceRequest, timeSlots: TimeSlot[]) {
  const eventIds = await Promise.all(timeSlots.map(slot =>
    googleCalendar.createEvent({
      title: `${request.engagement_type}: ${request.customer.name}`,
      attendees: [request.requested_by_user_id, request.assigned_resource_id],
      start: slot.start,
      end: slot.end,
      description: request.description
    })
  ));

  await updateRequest(request.id, { calendar_event_ids: eventIds });
}
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time from request to assignment | < 24 hours | Status timestamps |
| Resource utilization rate | 75-85% | Capacity tracking |
| CSM satisfaction with resources | 4.5/5 | Feedback ratings |
| Customer outcomes with resources | Track success metrics | Linked metrics |

---

## Acceptance Criteria

- [ ] CSM can create resource request with requirements
- [ ] System shows matching resources with scores
- [ ] Resource availability visible in request view
- [ ] Manager can assign resource to request
- [ ] Resource can accept/decline assignment
- [ ] Calendar booking integrates with Google Calendar
- [ ] Time tracking captures hours per engagement
- [ ] Utilization dashboard shows resource workload
- [ ] Feedback captured from both CSM and resource

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Resource matching algorithm | 3 days |
| API endpoints | 3 days |
| CSM request UI | 3 days |
| Resource manager dashboard | 3 days |
| Calendar integration | 2 days |
| Time tracking | 1 day |
| Testing | 2 days |
| **Total** | **19 days** |

---

## Notes

- Consider integrating with Professional Services Automation (PSA) tools
- Add skill certification verification workflow
- Future: AI-predicted engagement success
- Future: Automatic capacity planning recommendations
- Future: Customer-facing booking portal for premium support
