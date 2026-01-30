# PRD-018: Event Attendance Upload → Engagement Scoring

## Metadata
- **PRD ID**: PRD-018
- **Category**: A - Documents & Data Processing
- **Priority**: P3
- **Estimated Complexity**: Medium
- **Dependencies**: Customer engagement tracking, event management

## Scenario Description
A CSM uploads event attendance data (webinars, user groups, conferences, training sessions) and the system scores engagement levels, identifies highly engaged customers, detects declining engagement, and suggests customers to invite to upcoming events.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload event attendance data and receive engagement scores,
**So that** I can identify engaged customers for advocacy and disengaged customers needing outreach.

## Trigger
CSM uploads event attendance data via Chat UI with a message like "Score engagement from this event data."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Customer engagement | health score | Partial | Usage-based only |
| Meeting tracking | `meetings` table | Implemented | Scheduled meetings |
| Calendar integration | Google Calendar | Implemented | Can create events |
| Event attendance | Not implemented | Gap | No event tracking |

### What's Missing
- [ ] Event attendance data model
- [ ] Event engagement scoring
- [ ] Multi-event participation tracking
- [ ] Engagement trend analysis
- [ ] Event recommendation engine
- [ ] Advocacy opportunity detection
- [ ] Declining engagement alerts

## Detailed Workflow

### Step 1: Attendance Upload
**User Action**: CSM uploads event attendance data
**System Response**:
- Accepts CSV/Excel from event platform
- Maps fields: customer, user, event type, date, attendance status
- Associates with customer records
- Reports: "Found 567 attendance records for 234 users across 18 events"

### Step 2: Engagement Scoring
**User Action**: System processes automatically
**System Response**:
- Calculates engagement score per customer
- Considers event type, frequency, recency
- Identifies engagement trends
- Ranks customers by engagement level

### Step 3: Insights Generation
**User Action**: CSM requests insights
**System Response**:
- Displays engagement leaderboard
- Identifies advocacy candidates (high engagement)
- Flags declining engagement (risk)
- Suggests event invitations

### Step 4: Action & Outreach
**User Action**: CSM acts on insights
**System Response**:
- Creates advocacy opportunities
- Sends event invitations
- Schedules outreach for disengaged
- Updates engagement scores in health

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/events/attendanceParser.ts` | Parse attendance data |
| `server/src/services/events/engagementScorer.ts` | Calculate engagement scores |
| `server/src/services/events/eventRecommender.ts` | Recommend events |
| `components/Events/EngagementDashboard.tsx` | Engagement overview |
| `components/Events/AttendanceHistory.tsx` | Customer attendance history |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/events/attendance/upload` | POST | Upload attendance data |
| `GET /api/events/:customerId/engagement` | GET | Customer engagement score |
| `GET /api/events/recommendations` | GET | Event recommendations |
| `POST /api/events/invitations` | POST | Send event invitations |

### Engagement Score Components
| Component | Weight | Description |
|-----------|--------|-------------|
| Event Frequency | 30% | Number of events attended |
| Event Recency | 25% | Days since last event |
| Event Diversity | 20% | Variety of event types |
| Participation Depth | 15% | Q&A, feedback submitted |
| Consistency | 10% | Regular attendance pattern |

## Chat UI Flow
```
CSM: [Uploads event_attendance_2025.csv] Score engagement from this event data

System: 📊 Processing event attendance data...

Found: 567 attendance records
Unique users: 234
Customers: 78
Events: 18 (webinars, user groups, training sessions)
Date range: January - December 2025

Calculating engagement scores...

---

**📈 Event Engagement Analysis**

**Event Summary**
| Event Type | Events | Attendees | Avg Attendance |
|------------|--------|-----------|----------------|
| Webinars | 8 | 312 | 39 per event |
| User Groups | 4 | 145 | 36 per event |
| Training Sessions | 4 | 89 | 22 per event |
| Conference | 2 | 67 | 34 per event |

---

**🏆 Engagement Leaderboard (Top Customers)**

| Rank | Customer | Score | Events | Users | Trend |
|------|----------|-------|--------|-------|-------|
| 1 | TechCorp | 95 | 16/18 | 12 | ⬆️ Rising |
| 2 | DataPro | 92 | 15/18 | 8 | ➡️ Stable |
| 3 | CloudMax | 88 | 14/18 | 10 | ⬆️ Rising |
| 4 | Acme Corp | 85 | 13/18 | 6 | ➡️ Stable |
| 5 | BetaInc | 82 | 12/18 | 7 | ⬇️ Declining |

---

**🌟 Advocacy Candidates (High Engagement)**

| Customer | Score | Events | Notable Participation |
|----------|-------|--------|----------------------|
| **TechCorp** | 95 | 16/18 | Speaker at User Group, Case study candidate |
| **DataPro** | 92 | 15/18 | Asked most questions, Power user |
| **CloudMax** | 88 | 14/18 | Consistent attendance, Provided feedback |

**Recommendation:** These customers are prime candidates for:
- Case studies
- Reference calls
- Advisory board
- Speaking opportunities

---

**⚠️ Declining Engagement (Risk)**

| Customer | Score | Current | Previous | Events Missed |
|----------|-------|---------|----------|---------------|
| **OldCorp** | 35 | 2 events | 8 events | Last 6 events |
| **SmallBiz** | 42 | 3 events | 7 events | Last 4 events |
| **LegacyCo** | 48 | 4 events | 9 events | Last 3 events |

**Risk Signal:** Declining event engagement often precedes churn.

---

**📅 Upcoming Events - Invitation Recommendations**

**Webinar: Advanced Analytics Deep Dive (Feb 15)**
Recommended invites based on engagement + interest signals:

| Customer | Reason | Contact |
|----------|--------|---------|
| Acme Corp | High engagement, analytics interest | Sarah Chen |
| GrowthCo | Attended 2 analytics webinars | Mike Davis |
| TechStart | New customer, building skills | Amy Lee |

**User Group: Q1 Customer Advisory (Feb 22)**
Recommended for high-engagement customers:

| Customer | Reason | Contact |
|----------|--------|---------|
| TechCorp | Top engaged, valuable feedback | John Smith |
| DataPro | Power user insights | Lisa Wong |
| CloudMax | Growing account, build relationship | David Park |

---

**📊 Engagement Distribution**

```
High (80-100):   ████████░░░░░░░░░░░░ 18 customers (23%)
Good (60-79):    ██████████████░░░░░░ 28 customers (36%)
Medium (40-59):  ████████████░░░░░░░░ 22 customers (28%)
Low (0-39):      ████░░░░░░░░░░░░░░░░ 10 customers (13%)
```

Would you like me to:
[Create Advocacy Opportunities] [Send Event Invitations] [Create Risk Signals] [Export Report]

CSM: Create advocacy opportunities for top 3 and send invitations for the webinar

System: ✅ Actions Complete!

**🌟 Advocacy Opportunities Created:**

1. **TechCorp** (Engagement Score: 95)
   - Type: Case Study + Speaking
   - Champion: John Smith
   - Notes: Speaker at User Group, highly engaged, $200K ARR
   - Task: Schedule case study discussion

2. **DataPro** (Engagement Score: 92)
   - Type: Reference + Advisory Board
   - Champion: Lisa Wong
   - Notes: Power user, asks great questions, $150K ARR
   - Task: Invite to advisory board

3. **CloudMax** (Engagement Score: 88)
   - Type: Reference
   - Champion: David Park
   - Notes: Consistent engagement, growing account, $180K ARR
   - Task: Request for reference pool

---

**📧 Webinar Invitations Sent:**

**Event:** Advanced Analytics Deep Dive
**Date:** February 15, 2026

Invitations sent to:
| Customer | Contact | Email Status |
|----------|---------|--------------|
| Acme Corp | Sarah Chen | ✓ Sent |
| GrowthCo | Mike Davis | ✓ Sent |
| TechStart | Amy Lee | ✓ Sent |

**Email Preview:**
> Subject: You're Invited: Advanced Analytics Deep Dive
>
> Hi [Name],
>
> Based on your interest in analytics, I thought you'd find our upcoming webinar valuable...
>
> [Register Now button]

---

I've also updated engagement scores in the health score calculation for all 78 customers. 3 risk signals created for declining engagement customers.
```

## Acceptance Criteria
- [ ] Supports CSV/Excel from common event platforms (Zoom, Hopin, Eventbrite)
- [ ] Maps attendees to customer records accurately
- [ ] Engagement scoring considers multiple factors
- [ ] Identifies advocacy candidates from high engagement
- [ ] Detects declining engagement patterns
- [ ] Recommends event invitations based on interests
- [ ] Creates advocacy opportunities with context
- [ ] Integrates with health score calculation
- [ ] Sends personalized event invitations
- [ ] Processing completes within 30 seconds for 1,000 records

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-018-COMPLETE</promise>
```

### Success Metrics
- Advocacy conversion rate from high-engagement customers > 25%
- Declining engagement flagged > 30 days before churn signal
- Event attendance increase from recommendations > 20%
