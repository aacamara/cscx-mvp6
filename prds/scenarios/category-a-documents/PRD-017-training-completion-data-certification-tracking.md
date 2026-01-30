# PRD-017: Training Completion Data → Certification Tracking

## Metadata
- **PRD ID**: PRD-017
- **Category**: A - Documents & Data Processing
- **Priority**: P2
- **Estimated Complexity**: Medium
- **Dependencies**: Onboarding workflow, user tracking

## Scenario Description
A CSM uploads training completion data from their LMS or training records and the system tracks certifications, identifies training gaps, monitors time-to-competency, and recommends additional training for users falling behind.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload training data and track certification status,
**So that** I can ensure customers achieve competency and identify users needing additional support.

## Trigger
CSM uploads training completion data via Chat UI with a message like "Track certifications from this training data."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Training presentation template | Slides templates | Implemented | Basic training deck |
| Onboarding workflow | UnifiedOnboarding | Implemented | Has training phase |
| User tracking | usage_events | Implemented | Can track user activity |
| LMS integration | GAPS_ANALYSIS.md | Not implemented | Listed as gap |

### What's Missing
- [ ] Training data upload and parsing
- [ ] Certification tracking system
- [ ] Training completion metrics
- [ ] Time-to-competency analysis
- [ ] Training gap identification
- [ ] Certification expiration tracking
- [ ] Training ROI correlation

## Detailed Workflow

### Step 1: Training Data Upload
**User Action**: CSM uploads training completion data
**System Response**:
- Accepts CSV/Excel from LMS or manual tracking
- Maps fields: user, course, completion date, score, certification
- Associates with customer users
- Reports: "Found 234 training records for 89 users across 12 courses"

### Step 2: Certification Analysis
**User Action**: System processes automatically
**System Response**:
- Calculates certification rates per customer
- Identifies incomplete or failing users
- Tracks expiring certifications
- Computes time-to-certification metrics

### Step 3: Gap Analysis
**User Action**: CSM requests gap analysis
**System Response**:
- Identifies users without required certifications
- Flags customers with low training completion
- Correlates training with product adoption
- Recommends training priorities

### Step 4: Action & Communication
**User Action**: CSM acts on insights
**System Response**:
- Schedules remedial training sessions
- Sends completion reminders
- Creates training improvement plans
- Updates customer readiness status

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/training/dataParser.ts` | Parse training data |
| `server/src/services/training/certificationTracker.ts` | Track certifications |
| `server/src/services/training/gapAnalyzer.ts` | Identify training gaps |
| `components/Training/CertificationDashboard.tsx` | Certification overview |
| `components/Training/UserProgress.tsx` | Individual user progress |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/training/upload` | POST | Upload training data |
| `GET /api/training/:customerId/status` | GET | Customer training status |
| `GET /api/training/:customerId/gaps` | GET | Training gaps |
| `POST /api/training/reminders` | POST | Send training reminders |

### Training Metrics
| Metric | Description |
|--------|-------------|
| Completion Rate | % of users who completed training |
| Certification Rate | % of users certified |
| Avg Time to Complete | Days from enrollment to completion |
| Pass Rate | % passing on first attempt |
| Recertification Due | Users with expiring certs |
| Training Coverage | % of user base enrolled |

## Chat UI Flow
```
CSM: [Uploads acme_training_report.csv] Track certifications from this training data

System: 📊 Processing training data...

Customer: Acme Corp
Found: 234 training records
Users: 89 unique users
Courses: 12 courses

Analyzing certifications...

---

**📚 Training & Certification Status: Acme Corp**

**Overall Completion**
```
Certified:     ███████████████░░░░░ 72%
In Progress:   ███░░░░░░░░░░░░░░░░░ 15%
Not Started:   ███░░░░░░░░░░░░░░░░░ 13%
```

- Total Users: 89
- Certified: 64 (72%)
- In Progress: 13 (15%)
- Not Started: 12 (13%)

---

**📋 Course Completion by Type**

| Course | Enrolled | Completed | Pass Rate | Avg Days |
|--------|----------|-----------|-----------|----------|
| Basic Fundamentals | 89 | 82 (92%) | 95% | 3 days |
| Admin Certification | 25 | 21 (84%) | 88% | 7 days |
| Advanced Features | 45 | 28 (62%) | 79% | 12 days |
| API Integration | 18 | 12 (67%) | 83% | 8 days |
| Reporting Mastery | 30 | 18 (60%) | 72% | 10 days |

---

**⚠️ Certification Gaps**

**Users Without Required Certifications:**

| User | Role | Missing Certification | Last Activity |
|------|------|----------------------|---------------|
| Tom Brown | Admin | Admin Certification | Jan 15 |
| Rachel Green | Admin | Admin Certification | Jan 22 |
| Chris Davis | Developer | API Integration | Dec 28 |
| Emily White | Analyst | Reporting Mastery | Jan 10 |
| [4 more...] | Various | Various | Various |

**High Priority:**
- 2 Admins without Admin Certification
- These users have elevated permissions but incomplete training

---

**⏰ Expiring Certifications (Next 30 Days)**

| User | Certification | Expires | Recert Status |
|------|--------------|---------|---------------|
| Sarah Chen | Admin Cert | Feb 15 | Not started |
| Mike Johnson | Advanced | Feb 22 | In progress |
| Amy Lee | Basic | Feb 28 | Not started |

---

**📈 Training vs Adoption Correlation**

| Certification Level | Avg Usage Score | Avg Feature Adoption |
|--------------------|-----------------|---------------------|
| Fully Certified | 85/100 | 78% |
| Partial | 62/100 | 52% |
| Not Certified | 34/100 | 28% |

**Insight:** Certified users have 2.5x higher adoption!

---

**🎯 Training Gaps by Role**

| Role | Required | Current | Gap |
|------|----------|---------|-----|
| Admins (8) | Admin Cert | 6 (75%) | 2 missing |
| Power Users (15) | Advanced | 10 (67%) | 5 missing |
| Developers (5) | API Cert | 3 (60%) | 2 missing |
| All Users (89) | Basic | 82 (92%) | 7 missing |

---

**💡 Recommended Actions**

1. **Admin Certification Push** (High Priority)
   - 2 admins without certification
   - Risk: Security and configuration errors
   - Action: Schedule mandatory admin training

2. **Recertification Campaign** (Medium Priority)
   - 3 certifications expiring in 30 days
   - Action: Send reminder emails

3. **Developer Enablement** (Medium Priority)
   - 2 developers without API certification
   - Impact: Limiting integration quality
   - Action: Schedule API office hours

Would you like me to:
[Send Training Reminders] [Schedule Training Sessions] [Create Training Plan] [Export Report]

CSM: Send training reminders and create a training plan

System: ✅ Actions Complete!

**📧 Training Reminders Sent:**

1. **Admin Certification Required** (Tom Brown, Rachel Green)
   > Subject: Complete Your Admin Certification
   > "Hi [Name], As an admin on your team's account, completing Admin Certification ensures you can effectively manage your organization's setup..."

2. **Recertification Due** (Sarah Chen, Mike Johnson, Amy Lee)
   > Subject: Your Certification Expires Soon
   > "Hi [Name], Your [Certification] expires on [Date]. Please complete recertification to maintain your credentials..."

3. **Uncertified Users** (7 users)
   > Subject: Get Started with Training
   > "Hi [Name], Completing Basic Fundamentals training helps you get the most out of..."

---

**📋 Training Plan: Acme Corp**

**Week 1-2: Critical Gaps**
- [ ] Admin Certification for Tom Brown (Feb 3-7)
- [ ] Admin Certification for Rachel Green (Feb 3-7)
- [ ] API office hours for developers (Feb 5)

**Week 2-3: Recertifications**
- [ ] Sarah Chen recertification (before Feb 15)
- [ ] Mike Johnson complete in-progress (before Feb 22)
- [ ] Amy Lee recertification (before Feb 28)

**Week 3-4: Adoption Boost**
- [ ] Advanced Features training session (Feb 17)
- [ ] Reporting Mastery workshop (Feb 19)
- [ ] Target: 5 additional completions

**Success Metrics:**
- Admin certification: 75% → 100%
- Overall certification: 72% → 85%
- Developer certification: 60% → 100%

---

Training plan saved to customer workspace:
📁 CSCX - Acme Corp/01 - Onboarding/Training_Plan_Q1_2026.xlsx

Would you like me to schedule calendar events for the training sessions?
```

## Acceptance Criteria
- [ ] Supports CSV/Excel from common LMS platforms
- [ ] Maps users to customer records accurately
- [ ] Tracks multiple certifications per user
- [ ] Identifies certification gaps by role
- [ ] Calculates time-to-competency metrics
- [ ] Tracks certification expiration dates
- [ ] Correlates training with adoption metrics
- [ ] Sends training reminders via email
- [ ] Creates actionable training plans
- [ ] Processing completes within 30 seconds for 500 records

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-017-COMPLETE</promise>
```

### Success Metrics
- Customer certification rate improvement > 20%
- Correlation between certification and retention validated
- Time-to-competency reduction > 15%
