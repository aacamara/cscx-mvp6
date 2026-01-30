# PRD-251: Resource Scheduling

## Metadata
- **PRD ID**: PRD-251
- **Title**: Resource Scheduling
- **Category**: I - Collaboration
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-245 (Technical Resource Request), Google Calendar integration

---

## Problem Statement

Scheduling shared resources (demo environments, training rooms, specialized equipment, or limited technical staff time) for customer engagements is chaotic. There's no visibility into resource availability, leading to double-bookings, last-minute conflicts, and inefficient utilization.

## User Story

> As a CSM, I want to view and book shared resources for customer engagements through a centralized scheduling system so that I can plan activities with confidence and avoid conflicts.

---

## Functional Requirements

### FR-1: Resource Definition
- **FR-1.1**: Define resource types (room, environment, equipment, person-capacity)
- **FR-1.2**: Set resource attributes (capacity, location, requirements)
- **FR-1.3**: Configure availability windows (hours, days, blackout dates)
- **FR-1.4**: Set booking rules (max duration, advance notice, approval required)
- **FR-1.5**: Group related resources

### FR-2: Availability View
- **FR-2.1**: Calendar view of resource availability
- **FR-2.2**: Filter by resource type/group
- **FR-2.3**: Show existing bookings (with customer/user info)
- **FR-2.4**: Highlight conflicts and overlaps
- **FR-2.5**: Week/month view options

### FR-3: Booking Workflow
- **FR-3.1**: Book resource for specific time slot
- **FR-3.2**: Link booking to customer and engagement
- **FR-3.3**: Recurring booking support
- **FR-3.4**: Approval workflow for premium resources
- **FR-3.5**: Waitlist for fully booked slots

### FR-4: Conflict Management
- **FR-4.1**: Prevent double-booking (hard constraint)
- **FR-4.2**: Warning for adjacent/tight bookings
- **FR-4.3**: Conflict resolution suggestions
- **FR-4.4**: Bump requests with justification
- **FR-4.5**: Auto-reassign on cancellation

### FR-5: Notifications & Reminders
- **FR-5.1**: Confirmation notification on booking
- **FR-5.2**: Reminder before scheduled use
- **FR-5.3**: Alert for upcoming expiry/auto-cancel
- **FR-5.4**: Notify waitlist on cancellation
- **FR-5.5**: Resource owner notifications

---

## Non-Functional Requirements

### NFR-1: Performance
- Availability check < 500ms
- Booking creation < 1 second

### NFR-2: Concurrency
- Handle race conditions for simultaneous bookings

### NFR-3: Integration
- Sync with Google Calendar for room bookings

---

## Technical Approach

### Data Model Extensions

```sql
-- resources table
CREATE TABLE schedulable_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  resource_type VARCHAR(50) NOT NULL, -- 'room', 'environment', 'equipment', 'capacity'
  category VARCHAR(100),

  -- Capacity
  capacity INTEGER DEFAULT 1, -- How many concurrent bookings
  location VARCHAR(200),

  -- Availability
  available_start TIME DEFAULT '09:00',
  available_end TIME DEFAULT '17:00',
  available_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- Mon-Fri
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  blackout_dates DATE[] DEFAULT '{}',

  -- Booking rules
  min_booking_minutes INTEGER DEFAULT 30,
  max_booking_minutes INTEGER DEFAULT 480,
  advance_booking_days INTEGER DEFAULT 30,
  requires_approval BOOLEAN DEFAULT false,
  approver_user_id UUID REFERENCES users(id),

  -- Status
  is_active BOOLEAN DEFAULT true,
  owner_user_id UUID REFERENCES users(id),

  -- Calendar sync
  google_calendar_id VARCHAR(200),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- resource_bookings table
CREATE TABLE resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES schedulable_resources(id) NOT NULL,
  booked_by_user_id UUID REFERENCES users(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),

  -- Time
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(50),

  -- Details
  title VARCHAR(500),
  description TEXT,
  engagement_type VARCHAR(50), -- 'demo', 'training', 'implementation', 'meeting'

  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule JSONB, -- iCal RRULE format
  parent_booking_id UUID REFERENCES resource_bookings(id),

  -- Status
  status VARCHAR(50) DEFAULT 'confirmed', -- 'pending', 'confirmed', 'cancelled', 'completed'
  approval_status VARCHAR(50) DEFAULT 'not_required', -- 'pending', 'approved', 'rejected'
  approved_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  -- Calendar sync
  google_event_id VARCHAR(200),

  cancelled_at TIMESTAMPTZ,
  cancelled_by_user_id UUID REFERENCES users(id),
  cancellation_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- resource_waitlist table
CREATE TABLE resource_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES schedulable_resources(id),
  user_id UUID REFERENCES users(id),
  customer_id UUID REFERENCES customers(id),
  desired_start TIMESTAMPTZ NOT NULL,
  desired_end TIMESTAMPTZ NOT NULL,
  flexibility_hours INTEGER DEFAULT 2,
  priority INTEGER DEFAULT 0,
  notes TEXT,
  notified_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'waiting', -- 'waiting', 'offered', 'booked', 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent double booking with exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE resource_bookings
  ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (status NOT IN ('cancelled'));

CREATE INDEX idx_bookings_resource ON resource_bookings(resource_id, start_time);
CREATE INDEX idx_bookings_user ON resource_bookings(booked_by_user_id);
CREATE INDEX idx_bookings_customer ON resource_bookings(customer_id);
```

### Availability Algorithm

```typescript
interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  booking?: ResourceBooking;
}

async function getResourceAvailability(
  resourceId: string,
  startDate: Date,
  endDate: Date
): Promise<TimeSlot[]> {
  const resource = await getResource(resourceId);
  const bookings = await getBookings(resourceId, startDate, endDate);

  const slots: TimeSlot[] = [];
  let current = startDate;

  while (current < endDate) {
    const dayOfWeek = current.getDay();

    // Skip unavailable days
    if (!resource.available_days.includes(dayOfWeek)) {
      current = addDays(current, 1);
      continue;
    }

    // Skip blackout dates
    if (resource.blackout_dates.includes(formatDate(current))) {
      current = addDays(current, 1);
      continue;
    }

    // Generate slots for this day
    const dayStart = setTime(current, resource.available_start);
    const dayEnd = setTime(current, resource.available_end);
    let slotStart = dayStart;

    while (slotStart < dayEnd) {
      const slotEnd = addMinutes(slotStart, resource.min_booking_minutes);
      const overlappingBooking = bookings.find(b =>
        b.start_time < slotEnd && b.end_time > slotStart
      );

      slots.push({
        start: slotStart,
        end: slotEnd,
        available: !overlappingBooking,
        booking: overlappingBooking
      });

      slotStart = slotEnd;
    }

    current = addDays(current, 1);
  }

  return slots;
}

async function bookResource(
  resourceId: string,
  userId: string,
  start: Date,
  end: Date,
  details: BookingDetails
): Promise<ResourceBooking> {
  // Use transaction with row locking to prevent race conditions
  return await db.transaction(async (tx) => {
    // Check for conflicts with lock
    const conflicts = await tx.query(`
      SELECT id FROM resource_bookings
      WHERE resource_id = $1
        AND status != 'cancelled'
        AND tstzrange(start_time, end_time) && tstzrange($2, $3)
      FOR UPDATE
    `, [resourceId, start, end]);

    if (conflicts.length > 0) {
      throw new Error('Resource is no longer available for this time slot');
    }

    // Create booking
    const booking = await tx.insert('resource_bookings', {
      resource_id: resourceId,
      booked_by_user_id: userId,
      start_time: start,
      end_time: end,
      ...details
    });

    return booking;
  });
}
```

### API Endpoints

```typescript
// Resources
GET    /api/resources
POST   /api/resources (admin)
PATCH  /api/resources/:id (admin)
DELETE /api/resources/:id (admin)

// Availability
GET    /api/resources/:id/availability?start={date}&end={date}
GET    /api/resources/availability?type={type}&start={date}&end={date}

// Bookings
POST   /api/resources/:id/bookings
GET    /api/resources/:id/bookings
PATCH  /api/bookings/:id
DELETE /api/bookings/:id

// My bookings
GET    /api/bookings/my
GET    /api/bookings/my/upcoming

// Waitlist
POST   /api/resources/:id/waitlist
GET    /api/resources/:id/waitlist
DELETE /api/waitlist/:id

// Approvals
POST   /api/bookings/:id/approve
POST   /api/bookings/:id/reject
GET    /api/bookings/pending-approvals
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Resource utilization | 70-85% | Booking analytics |
| Double-booking incidents | 0 | Conflict detection |
| Booking lead time | Track average | Timestamp analysis |
| Waitlist conversion | 30%+ | Status tracking |

---

## Acceptance Criteria

- [ ] Admin can define schedulable resources with availability rules
- [ ] Users can view resource calendar with bookings
- [ ] Users can book available slots
- [ ] Double-bookings prevented at database level
- [ ] Recurring bookings supported
- [ ] Approval workflow for premium resources
- [ ] Waitlist notifies users when slots open
- [ ] Google Calendar sync for room resources
- [ ] Reminders sent before scheduled use

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Availability algorithm | 2 days |
| API endpoints | 2 days |
| Calendar UI | 4 days |
| Booking workflow | 2 days |
| Waitlist & notifications | 2 days |
| Google Calendar sync | 2 days |
| Testing | 2 days |
| **Total** | **18 days** |

---

## Notes

- Consider integration with meeting room booking systems
- Add resource usage reporting for capacity planning
- Future: Predictive booking suggestions
- Future: Auto-release unused bookings
- Future: Cost tracking for paid resources
