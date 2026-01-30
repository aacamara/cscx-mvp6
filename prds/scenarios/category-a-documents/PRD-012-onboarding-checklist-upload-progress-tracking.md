# PRD-012: Onboarding Checklist Upload → Progress Tracking

## Metadata
- **PRD ID**: PRD-012
- **Category**: A - Documents & Data Processing
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Onboarding workflow, task management

## Scenario Description
A CSM uploads an onboarding checklist (from a PM tool, spreadsheet, or template) and the system parses the tasks, tracks completion status, identifies blockers, calculates progress metrics, and alerts on at-risk onboardings.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload my onboarding checklist and have progress automatically tracked,
**So that** I can identify delayed onboardings and ensure customers reach time-to-value quickly.

## Trigger
CSM uploads an onboarding checklist via Chat UI with a message like "Track progress on this onboarding checklist."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Onboarding workflow | `UnifiedOnboarding.tsx` | Implemented | Phase-based tracking |
| Onboarding plan template | Docs templates | Implemented | 30-60-90 day plan |
| Onboarding tracker sheet | Sheets templates | Implemented | Basic tracking |
| Customer workspace | Drive integration | Implemented | Folder structure |
| Go-Live checklist | GAPS_ANALYSIS.md | Not implemented | Listed as gap |

### What's Missing
- [ ] External checklist import (Asana, Monday, Jira, spreadsheet)
- [ ] Task-level progress calculation
- [ ] Blocker identification and escalation
- [ ] Time-to-value tracking metrics
- [ ] Onboarding health scoring
- [ ] At-risk onboarding alerts
- [ ] Milestone completion tracking

## Detailed Workflow

### Step 1: Checklist Upload
**User Action**: CSM uploads checklist file
**System Response**:
- Accepts Excel, CSV, or structured document
- Detects task structure (task name, owner, status, due date)
- Associates with customer record
- Reports: "Found 45 onboarding tasks for Acme Corp"

### Step 2: Task Mapping
**User Action**: CSM confirms task mapping
**System Response**:
- Maps tasks to onboarding phases (setup, training, go-live)
- Identifies dependencies between tasks
- Sets milestone markers
- Calculates expected completion timeline

### Step 3: Progress Analysis
**User Action**: CSM requests progress report
**System Response**:
- Calculates overall completion percentage
- Identifies overdue tasks
- Detects potential blockers
- Shows time-to-value trajectory
- Compares to benchmark timelines

### Step 4: Alerts & Actions
**User Action**: CSM reviews status
**System Response**:
- Creates alerts for at-risk items
- Suggests escalation for blockers
- Drafts status update email to customer
- Schedules check-in if falling behind

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/onboarding/checklistParser.ts` | Parse checklist formats |
| `server/src/services/onboarding/progressTracker.ts` | Track task completion |
| `server/src/services/onboarding/riskDetector.ts` | Identify at-risk onboardings |
| `components/Onboarding/ProgressDashboard.tsx` | Progress visualization |
| `components/Onboarding/TaskTimeline.tsx` | Timeline view |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/onboarding/checklist/upload` | POST | Upload checklist |
| `PUT /api/onboarding/checklist/:id/tasks` | PUT | Update task statuses |
| `GET /api/onboarding/:customerId/progress` | GET | Get progress metrics |
| `GET /api/onboarding/at-risk` | GET | List at-risk onboardings |

### Progress Metrics
| Metric | Description |
|--------|-------------|
| Overall Completion | % of tasks completed |
| On-Time Rate | % of tasks completed by due date |
| Time to Milestone | Days to reach each milestone |
| Blocker Count | Number of blocked tasks |
| Risk Score | Calculated onboarding risk |
| Projected Go-Live | Estimated completion date |

## Chat UI Flow
```
CSM: [Uploads acme_onboarding_tasks.xlsx] Track progress on this onboarding

System: 📋 Analyzing onboarding checklist...

Customer: Acme Corp
Source: Excel spreadsheet
Tasks found: 45

**Task Breakdown by Phase:**
- Setup/Configuration: 12 tasks
- Integration: 8 tasks
- Training: 10 tasks
- Data Migration: 7 tasks
- Go-Live: 8 tasks

Analyzing progress...

---

**📊 Onboarding Progress Report: Acme Corp**

**Overall Status**
```
Progress: ██████████░░░░░░░░░░ 52%
On-Time:  ████████████░░░░░░░░ 67%
```

- Started: January 15, 2026
- Target Go-Live: March 1, 2026
- Projected Go-Live: **March 12, 2026** ⚠️ (11 days behind)

---

**📈 Phase Progress**

| Phase | Tasks | Complete | Status |
|-------|-------|----------|--------|
| Setup | 12 | 10 (83%) | ✅ On track |
| Integration | 8 | 5 (63%) | ⚠️ Behind |
| Training | 10 | 3 (30%) | ⚠️ Behind |
| Migration | 7 | 4 (57%) | ✅ On track |
| Go-Live | 8 | 0 (0%) | ⏳ Not started |

---

**🔴 Overdue Tasks (5)**

| Task | Owner | Due | Days Overdue |
|------|-------|-----|--------------|
| Complete SSO setup | Mike (Acme) | Jan 20 | 9 days |
| API credentials shared | Mike (Acme) | Jan 22 | 7 days |
| Admin training scheduled | Sarah (Acme) | Jan 25 | 4 days |
| Test data migration | You | Jan 27 | 2 days |
| Integration testing | You | Jan 28 | 1 day |

---

**🚧 Blockers Identified**

1. **SSO Setup Blocked**
   - Dependency: Waiting on Acme IT for certificate
   - Impact: Blocks user training
   - Duration: 9 days

2. **API Integration Delayed**
   - Dependency: API credentials not received
   - Impact: Blocks data flow setup
   - Duration: 7 days

---

**⚠️ Risk Assessment: MEDIUM-HIGH**

Risk Factors:
- Customer-owned tasks 70% overdue
- 2 critical path blockers
- No progress on training (0 sessions completed)

Without intervention: Go-live delayed 2+ weeks

---

**💡 Recommended Actions**

1. **Escalate SSO blocker** - Request executive help from Sarah
2. **Schedule API credential call** - Mike may need help from IT
3. **Compress training schedule** - Conduct parallel sessions
4. **Set up daily standups** - Through go-live period

Would you like me to:
[Draft Escalation Email] [Schedule Check-in Call] [Create Risk Signal] [Generate Status Report]

CSM: Draft an escalation email to Sarah about the blockers

System: 📧 Drafting escalation email...

**To:** Sarah Chen <sarah.chen@acme.com>
**Subject:** Onboarding Status Update - Action Needed on SSO & API

Hi Sarah,

I wanted to give you a quick update on our onboarding progress and flag a couple of items that need attention.

**Current Status:** 52% complete (targeting March 1 go-live)

**Items Requiring Your Help:**

1. **SSO Certificate (9 days overdue)**
   We're waiting on the SSL certificate from your IT team to complete SSO setup. This is blocking our ability to start user training. Can you help expedite this with Mike's team?

2. **API Credentials (7 days overdue)**
   Mike mentioned he needed to get these from IT security. Without them, we can't set up the data integration that's core to your use case.

**Impact:** These delays put our March 1 go-live at risk. If we can resolve by Feb 3, we can still hit the target with a compressed schedule.

**Ask:** Could we schedule a quick 15-min call tomorrow to align on next steps? I'd also love to get IT security on that call if possible.

Looking forward to getting back on track!

Best,
[Your Name]

---

[Preview] [Edit] [Approve & Send]

I've also set a reminder to follow up in 48 hours if no response.
```

## Acceptance Criteria
- [ ] Supports Excel, CSV, and common PM tool exports (Asana, Monday, Jira)
- [ ] Correctly identifies task structure (name, owner, status, due date)
- [ ] Maps tasks to standard onboarding phases automatically
- [ ] Calculates accurate completion percentages
- [ ] Identifies blockers and their impact on timeline
- [ ] Projects go-live date based on current velocity
- [ ] Compares to benchmark timelines for similar customers
- [ ] Risk scoring considers multiple factors
- [ ] Integrates with existing onboarding workflow
- [ ] Updates can be uploaded incrementally to track changes

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-012-COMPLETE</promise>
```

### Success Metrics
- Onboarding completion rate improvement > 10%
- Average time-to-value reduction > 15%
- At-risk onboardings identified > 7 days before go-live date
