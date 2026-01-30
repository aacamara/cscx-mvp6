# PRD-014: Customer Org Chart Upload → Stakeholder Mapping

## Metadata
- **PRD ID**: PRD-014
- **Category**: A - Documents & Data Processing
- **Priority**: P2
- **Estimated Complexity**: High
- **Dependencies**: Stakeholder management, relationship tracking

## Scenario Description
A CSM uploads a customer's org chart (image, PDF, or structured data) and the system extracts stakeholder information, maps reporting relationships, identifies key personas, and suggests multi-threading strategies based on the organizational structure.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload a customer org chart and have stakeholders automatically mapped,
**So that** I can understand the organizational structure and develop multi-threading strategies.

## Trigger
CSM uploads an org chart image/document via Chat UI with a message like "Map stakeholders from this org chart."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Stakeholders table | `stakeholders` | Implemented | Basic contact storage |
| Stakeholder extraction | Contract parsing | Implemented | From contracts |
| Relationship mapping | GAPS_ANALYSIS.md | Not implemented | Listed as gap |
| Account plans | `account_plans` | Implemented | Has stakeholder_map JSONB |
| Multi-threading scoring | GAPS_ANALYSIS.md | Not implemented | Listed as gap |

### What's Missing
- [ ] Org chart image/PDF parsing
- [ ] Reporting relationship extraction
- [ ] Stakeholder persona classification
- [ ] Org chart visualization
- [ ] Multi-threading gap analysis
- [ ] Relationship depth scoring
- [ ] Stakeholder change detection

## Detailed Workflow

### Step 1: Org Chart Upload
**User Action**: CSM uploads org chart (image, PDF, or Excel)
**System Response**:
- Accepts image (PNG, JPG), PDF, or Excel
- Uses vision AI for image processing
- Extracts names, titles, reporting lines
- Associates with customer record

### Step 2: Stakeholder Extraction
**User Action**: System processes automatically
**System Response**:
- Identifies individuals with name and title
- Determines reporting relationships
- Classifies personas (executive, champion, user, technical, etc.)
- Maps to existing stakeholder records

### Step 3: Mapping Analysis
**User Action**: CSM reviews extracted map
**System Response**:
- Displays visual org chart
- Highlights known vs new stakeholders
- Shows relationship coverage
- Identifies gaps in multi-threading
- Suggests key stakeholders to engage

### Step 4: Strategy & Actions
**User Action**: CSM requests recommendations
**System Response**:
- Generates multi-threading strategy
- Suggests introductions to pursue
- Creates stakeholder engagement plan
- Updates stakeholder records

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/stakeholders/orgChartParser.ts` | Parse org chart images/PDFs |
| `server/src/services/stakeholders/relationshipMapper.ts` | Map reporting relationships |
| `server/src/services/stakeholders/personaClassifier.ts` | Classify stakeholder personas |
| `components/Stakeholders/OrgChartViewer.tsx` | Org chart visualization |
| `components/Stakeholders/MultiThreadingAnalysis.tsx` | Coverage analysis |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/stakeholders/org-chart/upload` | POST | Upload org chart |
| `POST /api/stakeholders/org-chart/parse` | POST | Parse and extract |
| `GET /api/stakeholders/:customerId/map` | GET | Get stakeholder map |
| `POST /api/stakeholders/:customerId/strategy` | POST | Generate strategy |

### Persona Classifications
| Persona | Description | Engagement Priority |
|---------|-------------|---------------------|
| Executive Sponsor | C-level decision maker | High |
| Economic Buyer | Budget holder | High |
| Champion | Internal advocate | Critical |
| Technical Lead | Implementation owner | High |
| Power User | Heavy product user | Medium |
| End User | Regular user | Low |
| Detractor | Potential blocker | High (monitor) |

## Chat UI Flow
```
CSM: [Uploads acme_org_chart.png] Map stakeholders from this org chart

System: 📊 Analyzing org chart image...

Using vision AI to extract organizational structure...

---

**🏢 Org Chart Analysis Complete**

**Customer:** Acme Corp
**Extracted:** 23 individuals
**Departments:** 4 (Operations, IT, Finance, Marketing)

---

**📋 Extracted Stakeholders**

**Executive Level**
| Name | Title | Reports To | Status |
|------|-------|------------|--------|
| John Smith | CEO | - | 🆕 New |
| Sarah Chen | VP Operations | CEO | ✅ Known |
| David Park | CTO | CEO | 🆕 New |
| Lisa Wong | CFO | CEO | 🆕 New |

**Operations (Sarah's Team)**
| Name | Title | Reports To | Status |
|------|-------|------------|--------|
| Mike Johnson | Director, Ops | Sarah Chen | ✅ Known |
| Amy Lee | Manager, CS | Mike Johnson | 🆕 New |
| Tom Brown | Analyst | Amy Lee | 🆕 New |

**IT (David's Team)**
| Name | Title | Reports To | Status |
|------|-------|------------|--------|
| Kevin Wu | Director, IT | David Park | 🆕 New |
| Rachel Green | Systems Admin | Kevin Wu | 🆕 New |

[... more departments ...]

---

**🎯 Persona Classification**

| Persona | Individuals | Known | Engaged |
|---------|-------------|-------|---------|
| Executive Sponsor | 4 | 1 (Sarah) | 1 |
| Economic Buyer | 2 | 0 | 0 ⚠️ |
| Champion | 1 | 1 (Mike) | 1 |
| Technical Lead | 2 | 0 | 0 ⚠️ |
| Power Users | 6 | 2 | 2 |
| End Users | 8 | 0 | 0 |

---

**⚠️ Multi-Threading Gaps**

Current Coverage: **2 of 4 key personas** (50%)

**Critical Gaps:**

1. **No Executive Sponsor Access**
   - Sarah is VP but not C-level
   - CEO (John Smith) and CFO (Lisa Wong) not engaged
   - Risk: Decisions made above our relationships

2. **No IT Relationship**
   - CTO (David Park) and IT Director (Kevin Wu) unknown
   - Risk: Technical blockers without advocates
   - Opportunity: Integration expansion discussions

3. **Limited Depth**
   - Only 2 contacts across entire organization
   - Single-threaded through Mike
   - Risk: Champion leaves = relationship at risk

---

**📈 Relationship Map**

```
                    ┌─────────────┐
                    │  John Smith │ ← 🔴 No access
                    │     CEO     │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐
    │ Sarah Chen  │ │ David Park  │ │ Lisa Wong   │
    │VP Operations│ │    CTO      │ │    CFO      │
    │   ✅ Known  │ │  🔴 Unknown │ │  🔴 Unknown │
    └──────┬──────┘ └──────┬──────┘ └─────────────┘
           │               │
    ┌──────┴──────┐ ┌──────┴──────┐
    │Mike Johnson │ │ Kevin Wu    │
    │Director, Ops│ │Director, IT │
    │ ⭐ Champion │ │ 🔴 Unknown  │
    └─────────────┘ └─────────────┘
```

---

**💡 Recommended Multi-Threading Strategy**

**Priority 1: IT Relationship (2 weeks)**
- Goal: Establish relationship with Kevin Wu (IT Director)
- Approach: Ask Mike for introduction
- Talking point: Upcoming integration roadmap discussion
- Task: Schedule intro meeting

**Priority 2: Executive Access (4 weeks)**
- Goal: Brief meeting with CEO or CFO
- Approach: Request through Sarah for exec briefing
- Talking point: Expansion impact on business metrics
- Task: Propose executive update to Sarah

**Priority 3: Deepen Power User Base (ongoing)**
- Goal: Identify 3 additional power users
- Approach: Training sessions, office hours
- Task: Schedule user workshop

Would you like me to:
[Save Stakeholders to Records] [Create Engagement Plan] [Draft Introduction Request] [Export Org Map]

CSM: Save stakeholders and create an engagement plan

System: ✅ Updates Complete!

**Stakeholders Saved:**
- 12 new stakeholders added to Acme Corp
- 2 existing stakeholders updated with reporting info
- Org chart saved to customer workspace

---

**📋 Stakeholder Engagement Plan: Acme Corp**

**Week 1-2: IT Relationship Building**
- [ ] Ask Mike for introduction to Kevin Wu
- [ ] Research Kevin's background (LinkedIn)
- [ ] Prepare integration roadmap summary
- [ ] Schedule intro call with Kevin

**Week 2-4: Executive Access**
- [ ] Draft executive summary for Sarah
- [ ] Request 15-min CEO briefing opportunity
- [ ] Prepare ROI talking points for CFO
- [ ] Identify mutual connections via LinkedIn

**Week 3-6: Deepen User Base**
- [ ] Schedule user training workshop
- [ ] Identify top 5 users by usage
- [ ] Create power user program invite
- [ ] Set up quarterly user feedback calls

**Ongoing: Champion Development**
- [ ] Monthly sync with Mike
- [ ] Share early access to features
- [ ] Invite to customer advisory board
- [ ] Create case study opportunity

---

Tasks added to your task list with due dates.

I've also created a stakeholder engagement tracker in the customer workspace:
📁 CSCX - Acme Corp/05 - Reports/Stakeholder_Engagement_Tracker.xlsx
```

## Acceptance Criteria
- [ ] Supports org chart images (PNG, JPG), PDFs, and Excel formats
- [ ] Vision AI accurately extracts names and titles (>90%)
- [ ] Reporting relationships correctly identified
- [ ] Personas classified based on title and position
- [ ] Matches to existing stakeholder records
- [ ] Visualizes org chart with relationship status
- [ ] Multi-threading gaps clearly identified
- [ ] Engagement recommendations are actionable
- [ ] Stakeholders saved to database with relationships
- [ ] Processing completes within 30 seconds for typical org chart

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-014-COMPLETE</promise>
```

### Success Metrics
- Multi-threading coverage improvement > 25%
- Executive relationship established > 50% of strategic accounts
- Champion redundancy (2+ champions) achieved > 40% of accounts
