# CADG Complete Cards PRD
## Context-Aware Agentic Document Generation - All Agent Cards

**Version:** 2.0
**Date:** 2026-02-04
**Status:** Ready for Implementation

---

## Overview

Implement comprehensive CADG card generation for all 5 CS Agents, each with 4 specialized capabilities, plus General Mode portfolio-level cards. Every card follows the same pattern as the QBR card: gather data from multiple sources, show **editable HITL approval UI**, generate Google Workspace documents, and display results with links + **PDF/data export**.

---

## Core Card Requirements

### Every Card MUST Have:

1. **Editable Preview** - Users can modify content before generating
2. **Approve/Reject Buttons** - Clear HITL workflow
3. **Data Sources Panel** - Show what data was gathered
4. **PDF Download** - Export as PDF
5. **PPTX/XLSX/DOCX Download** - Native format export
6. **CSV Data Export** - Export underlying data sources
7. **Google Drive Links** - Direct links to generated files
8. **Beautiful UI** - Consistent with existing card styling
9. **Loading States** - Smooth generation experience
10. **Error Handling** - Clear error messages with retry option

### UI Components Pattern (like MeetingScheduler):

```tsx
// Every card preview should support:
- Inline editing of text fields
- Section collapse/expand
- Add/remove items from lists
- AI enhance button for content improvement
- Preview before final generation
```

---

## Agent Cards Matrix

### 1. Onboarding Specialist (🚀)

| Card | Task Type | Output | Data Sources |
|------|-----------|--------|--------------|
| Kickoff Plan | `kickoff_plan` | Google Docs | Customer 360, Stakeholders, Contract Terms |
| 30-60-90 Day Plan | `milestone_plan` | Google Docs + Sheets | Onboarding Tasks, Health Baseline, Goals |
| Stakeholder Map | `stakeholder_map` | Google Slides | CRM Contacts, Engagement History, Org Data |
| Training Schedule | `training_schedule` | Google Sheets | Product Features, User Roles, Availability |

### 2. Adoption Specialist (📈)

| Card | Task Type | Output | Data Sources |
|------|-----------|--------|--------------|
| Usage Analysis | `usage_analysis` | Google Sheets + Docs | Usage Metrics, Feature Adoption, Trends |
| Feature Campaign | `feature_campaign` | Google Docs | Low Adoption Features, User Segments, Templates |
| Champion Plan | `champion_development` | Google Docs | Power Users, Engagement Scores, Training |
| Training Program | `training_program` | Google Slides + Sheets | Feature Gaps, User Roles, Best Practices |

### 3. Renewal Specialist (🔄)

| Card | Task Type | Output | Data Sources |
|------|-----------|--------|--------------|
| Renewal Forecast | `renewal_forecast` | Google Sheets | Health Trends, Engagement, Risk Signals |
| Value Summary | `value_summary` | Google Slides | ROI Metrics, Success Stories, Outcomes |
| Expansion Proposal | `expansion_proposal` | Google Docs | Usage Gaps, Growth Potential, Pricing |
| Negotiation Brief | `negotiation_brief` | Google Docs | Contract History, Competitor Intel, Leverage |

### 4. Risk Specialist (⚠️)

| Card | Task Type | Output | Data Sources |
|------|-----------|--------|--------------|
| Risk Assessment | `risk_assessment` | Google Docs + Sheets | Health Signals, Engagement Drops, Tickets |
| Save Play | `save_play` | Google Docs | Risk Factors, Playbooks, Action Plan |
| Escalation Report | `escalation_report` | Google Docs | Issue Timeline, Stakeholders, Resolution |
| Resolution Plan | `resolution_plan` | Google Docs + Sheets | Open Issues, Dependencies, Timeline |

### 5. Strategic CSM (🎯)

| Card | Task Type | Output | Data Sources |
|------|-----------|--------|--------------|
| QBR Presentation | `qbr_generation` | Google Slides + Sheets | Full 360, Metrics, Health, Goals |
| Executive Briefing | `executive_briefing` | Google Slides | Key Metrics, Exec Summary, Asks |
| Account Plan | `account_plan` | Google Docs + Sheets | Strategy, Goals, Timeline, Owners |
| Transformation Roadmap | `transformation_roadmap` | Google Slides | Current State, Future State, Milestones |

### 6. General Mode (📊)

| Card | Task Type | Output | Data Sources |
|------|-----------|--------|--------------|
| Portfolio Dashboard | `portfolio_dashboard` | Google Sheets | All Customers, Health Scores, ARR, Renewals |
| Team Metrics | `team_metrics` | Google Sheets + Slides | CSM Performance, Coverage, Outcomes |
| Renewal Pipeline | `renewal_pipeline` | Google Sheets | Upcoming Renewals, Forecasts, Risk |
| At-Risk Overview | `at_risk_overview` | Google Sheets + Docs | All At-Risk, Save Plays, Owners |

---

## Comprehensive Trigger Patterns

### 1.1 Kickoff Plan (`kickoff_plan`)

**Trigger Patterns (20+ variations):**
```
- "create kickoff plan"
- "kickoff plan for {customer}"
- "build kickoff agenda"
- "kickoff meeting plan"
- "new customer kickoff"
- "make a kickoff document"
- "generate kickoff plan"
- "prepare kickoff meeting"
- "kickoff deck"
- "kickoff presentation"
- "customer kickoff"
- "onboarding kickoff"
- "project kickoff"
- "start kickoff plan"
- "write kickoff plan"
- "draft kickoff agenda"
- "setup kickoff meeting"
- "plan the kickoff"
- "kickoff materials"
- "kickoff prep"
- "get kickoff ready"
- "kickoff call prep"
```

**Data Sources:**
- Customer 360 (company info, ARR, tier)
- Stakeholders (contacts, roles)
- Contract terms (start date, scope)
- Onboarding playbook

**Editable Preview Sections:**
- [ ] Meeting title (editable text)
- [ ] Attendees list (add/remove)
- [ ] Agenda items (reorder, edit, add/remove)
- [ ] Goals (editable list)
- [ ] Next steps (editable list)
- [ ] Notes section (free text)

**Output:** Google Docs with agenda template

---

### 1.2 30-60-90 Day Plan (`milestone_plan`)

**Trigger Patterns (20+ variations):**
```
- "30-60-90 day plan"
- "create 30 60 90 plan"
- "milestone plan"
- "build milestone plan"
- "onboarding milestones"
- "first 90 days plan"
- "90 day plan"
- "30 60 90"
- "create milestones"
- "onboarding timeline"
- "success milestones"
- "customer milestones"
- "milestone tracker"
- "implementation plan"
- "onboarding plan"
- "rollout plan"
- "deployment plan"
- "go-live plan"
- "launch plan"
- "activation plan"
- "ramp plan"
- "adoption milestones"
```

**Data Sources:**
- Customer goals
- Product complexity
- Resource availability
- Similar customer benchmarks

**Editable Preview Sections:**
- [ ] 30-day goals (editable list with checkboxes)
- [ ] 60-day goals (editable list)
- [ ] 90-day goals (editable list)
- [ ] Key milestones (add/remove with dates)
- [ ] Success criteria (editable)
- [ ] Owner assignments (dropdown)

**Output:** Sheets tracker + Docs plan

---

### 1.3 Stakeholder Map (`stakeholder_map`)

**Trigger Patterns (20+ variations):**
```
- "stakeholder map"
- "map stakeholders"
- "show org chart"
- "who are the contacts"
- "stakeholder mapping"
- "org chart"
- "organization chart"
- "contact map"
- "relationship map"
- "power map"
- "influence map"
- "decision makers"
- "key contacts"
- "who's who"
- "contact list"
- "stakeholder analysis"
- "map the org"
- "show me the stakeholders"
- "customer contacts"
- "account contacts"
- "buyer map"
- "champion map"
```

**Data Sources:**
- CRM contacts
- Meeting attendees
- Email engagement
- LinkedIn data (if available)

**Editable Preview Sections:**
- [ ] Contact cards (edit name, role, influence level)
- [ ] Relationship lines (connect/disconnect)
- [ ] Add new stakeholder
- [ ] Role classification (dropdown: Champion, Sponsor, Blocker, etc.)
- [ ] Engagement level (slider: Low/Medium/High)
- [ ] Notes per contact

**Output:** Slides with visual map

---

### 1.4 Training Schedule (`training_schedule`)

**Trigger Patterns (20+ variations):**
```
- "training schedule"
- "create training schedule"
- "build training plan"
- "schedule trainings"
- "onboarding training calendar"
- "training calendar"
- "training sessions"
- "setup training"
- "plan trainings"
- "training timeline"
- "enablement schedule"
- "learning schedule"
- "user training"
- "team training"
- "training dates"
- "schedule user training"
- "book training sessions"
- "training roadmap"
- "certification schedule"
- "onboarding sessions"
- "product training"
- "feature training"
```

**Data Sources:**
- User roles
- Feature list
- Availability windows
- Learning paths

**Editable Preview Sections:**
- [ ] Session list (add/remove)
- [ ] Date/time picker per session
- [ ] Attendee groups (multi-select)
- [ ] Topics per session (editable)
- [ ] Duration (dropdown)
- [ ] Trainer assignment

**Output:** Sheets calendar

---

### 2.1 Usage Analysis (`usage_analysis`)

**Trigger Patterns (20+ variations):**
```
- "usage analysis"
- "analyze usage"
- "usage report"
- "how are they using the product"
- "adoption analysis"
- "usage metrics"
- "show usage"
- "product usage"
- "feature usage"
- "usage trends"
- "usage patterns"
- "activity report"
- "engagement report"
- "utilization report"
- "login analysis"
- "user activity"
- "adoption report"
- "usage summary"
- "usage dashboard"
- "analyze adoption"
- "what features are they using"
- "show me their usage"
```

**Data Sources:**
- Usage metrics
- Feature adoption rates
- Login frequency
- Power user identification

**Editable Preview Sections:**
- [ ] Time range selector
- [ ] Feature filters (multi-select)
- [ ] User segment filters
- [ ] Chart types toggle
- [ ] Recommendation text (editable)
- [ ] Custom insights (add)

**Output:** Sheets with charts + Docs summary

---

### 2.2 Feature Campaign (`feature_campaign`)

**Trigger Patterns (20+ variations):**
```
- "feature campaign"
- "feature adoption campaign"
- "drive feature usage"
- "promote feature"
- "increase adoption"
- "adoption campaign"
- "feature rollout"
- "feature launch"
- "promote features"
- "drive adoption"
- "feature push"
- "enablement campaign"
- "feature enablement"
- "boost adoption"
- "improve feature usage"
- "feature awareness"
- "feature marketing"
- "internal campaign"
- "user campaign"
- "adoption drive"
- "feature promotion"
- "get them using feature X"
```

**Data Sources:**
- Low adoption features
- User segments
- Success stories
- Best practices

**Editable Preview Sections:**
- [ ] Target features (multi-select)
- [ ] User segments (multi-select)
- [ ] Campaign timeline (date picker)
- [ ] Messaging templates (editable)
- [ ] Success metrics (editable)
- [ ] Touchpoints (add/remove)

**Output:** Docs campaign plan

---

### 2.3 Champion Development (`champion_development`)

**Trigger Patterns (20+ variations):**
```
- "champion plan"
- "champion development"
- "develop champions"
- "identify power users"
- "build advocates"
- "champion program"
- "power user plan"
- "advocate development"
- "find champions"
- "champion identification"
- "super user program"
- "advocate plan"
- "promoter development"
- "champion strategy"
- "grow champions"
- "nurture champions"
- "champion engagement"
- "power user development"
- "find advocates"
- "create champions"
- "champion network"
- "build champion community"
```

**Data Sources:**
- Power users
- Engagement scores
- NPS promoters
- Training completion

**Editable Preview Sections:**
- [ ] Champion candidates (edit, add/remove)
- [ ] Development activities (checklist)
- [ ] Recognition rewards (editable)
- [ ] Communication plan (editable)
- [ ] Success metrics (editable)
- [ ] Timeline (date picker)

**Output:** Docs plan

---

### 2.4 Training Program (`training_program`)

**Trigger Patterns (20+ variations):**
```
- "training program"
- "build training program"
- "create training curriculum"
- "training materials"
- "enablement program"
- "learning program"
- "certification program"
- "training curriculum"
- "course outline"
- "training content"
- "education program"
- "learning path"
- "training modules"
- "onboarding curriculum"
- "user education"
- "product training program"
- "feature training program"
- "skill development"
- "competency program"
- "training framework"
- "learning framework"
- "enablement curriculum"
```

**Data Sources:**
- Feature gaps
- User roles
- Learning styles
- Available content

**Editable Preview Sections:**
- [ ] Module list (add/remove, reorder)
- [ ] Learning objectives per module (editable)
- [ ] Assessment criteria (editable)
- [ ] Prerequisites (editable)
- [ ] Duration per module
- [ ] Certification requirements

**Output:** Slides curriculum + Sheets tracker

---

### 3.1 Renewal Forecast (`renewal_forecast`)

**Trigger Patterns (20+ variations):**
```
- "renewal forecast"
- "predict renewal"
- "will they renew"
- "renewal probability"
- "renewal prediction"
- "forecast renewal"
- "renewal outlook"
- "renewal risk"
- "renewal likelihood"
- "renewal chance"
- "what's the renewal outlook"
- "renewal analysis"
- "renewal assessment"
- "renewal health"
- "renewal status"
- "renewal projection"
- "will they churn"
- "churn prediction"
- "retention forecast"
- "renewal score"
- "renewal confidence"
- "are they going to renew"
```

**Data Sources:**
- Health trends
- Engagement metrics
- Risk signals
- Historical patterns

**Editable Preview Sections:**
- [ ] Probability score (view, can adjust factors)
- [ ] Risk factors (toggle on/off)
- [ ] Positive signals (editable)
- [ ] Recommended actions (editable)
- [ ] Timeline to renewal
- [ ] Confidence notes (free text)

**Output:** Sheets forecast model

---

### 3.2 Value Summary (`value_summary`)

**Trigger Patterns (20+ variations):**
```
- "value summary"
- "show ROI"
- "business value"
- "value realization"
- "ROI report"
- "value report"
- "ROI summary"
- "value delivered"
- "business impact"
- "success summary"
- "outcomes summary"
- "value proof"
- "ROI analysis"
- "value metrics"
- "show the value"
- "prove value"
- "value case"
- "business case"
- "customer value"
- "impact summary"
- "results summary"
- "what value have we delivered"
```

**Data Sources:**
- ROI metrics
- Success outcomes
- Time/cost savings
- Customer quotes

**Editable Preview Sections:**
- [ ] Value metrics (edit values)
- [ ] Success stories (edit, add/remove)
- [ ] Testimonials (edit)
- [ ] Before/after comparisons (edit)
- [ ] ROI calculation (adjustable)
- [ ] Executive summary (free text)

**Output:** Slides presentation

---

### 3.3 Expansion Proposal (`expansion_proposal`)

**Trigger Patterns (20+ variations):**
```
- "expansion proposal"
- "upsell opportunity"
- "growth proposal"
- "expand account"
- "upsell proposal"
- "expansion plan"
- "growth plan"
- "upsell plan"
- "cross-sell proposal"
- "expansion opportunity"
- "growth opportunity"
- "land and expand"
- "account expansion"
- "increase deal"
- "grow the account"
- "add more licenses"
- "add more seats"
- "upgrade proposal"
- "tier upgrade"
- "premium proposal"
- "enterprise upgrade"
- "expansion business case"
```

**Data Sources:**
- Usage gaps
- Growth signals
- Product roadmap
- Pricing tiers

**Editable Preview Sections:**
- [ ] Proposed expansion (editable)
- [ ] Pricing options (editable table)
- [ ] Business case (free text)
- [ ] ROI projections (editable)
- [ ] Timeline (date picker)
- [ ] Next steps (editable list)

**Output:** Docs proposal

---

### 3.4 Negotiation Brief (`negotiation_brief`)

**Trigger Patterns (20+ variations):**
```
- "negotiation brief"
- "renewal negotiation"
- "pricing discussion prep"
- "contract negotiation"
- "deal negotiation"
- "pricing negotiation"
- "contract prep"
- "negotiation prep"
- "deal prep"
- "renewal prep"
- "negotiation strategy"
- "pricing strategy"
- "discount strategy"
- "contract strategy"
- "renewal strategy"
- "prepare for negotiation"
- "get ready for renewal talk"
- "pricing conversation"
- "contract conversation"
- "deal strategy"
- "negotiation playbook"
- "pricing brief"
```

**Data Sources:**
- Contract history
- Competitor intel
- Value delivered
- Market pricing

**Editable Preview Sections:**
- [ ] Current terms (editable table)
- [ ] Leverage points (editable list)
- [ ] Walk-away points (editable)
- [ ] Counter strategies (editable)
- [ ] Pricing benchmarks (view/edit)
- [ ] Internal notes (free text)

**Output:** Docs brief

---

### 4.1 Risk Assessment (`risk_assessment`)

**Trigger Patterns (20+ variations):**
```
- "risk assessment"
- "assess risk"
- "what are the risks"
- "churn risk"
- "risk analysis"
- "risk report"
- "risk evaluation"
- "health risk"
- "customer risk"
- "account risk"
- "evaluate risk"
- "risk score"
- "risk factors"
- "at-risk assessment"
- "churn assessment"
- "retention risk"
- "risk review"
- "analyze risk"
- "what's the risk"
- "how at risk are they"
- "churn likelihood"
- "risk profile"
```

**Data Sources:**
- Health signals
- Engagement drops
- Support tickets
- NPS scores

**Editable Preview Sections:**
- [ ] Risk score (view, see breakdown)
- [ ] Risk factors (toggle, edit severity)
- [ ] Trend charts (time range selector)
- [ ] Mitigation actions (editable list)
- [ ] Owner assignment (dropdown)
- [ ] Notes (free text)

**Output:** Docs + Sheets assessment

---

### 4.2 Save Play (`save_play`)

**Trigger Patterns (20+ variations):**
```
- "save play"
- "create save play"
- "save this customer"
- "retention plan"
- "prevent churn"
- "rescue plan"
- "save plan"
- "churn prevention"
- "retention strategy"
- "save strategy"
- "rescue strategy"
- "win back plan"
- "keep the customer"
- "prevent them from leaving"
- "stop churn"
- "save the account"
- "retention playbook"
- "save playbook"
- "turnaround plan"
- "recovery plan"
- "intervention plan"
- "customer save"
```

**Data Sources:**
- Risk factors
- Playbook templates
- Similar saves
- Resources available

**Editable Preview Sections:**
- [ ] Situation summary (editable)
- [ ] Root causes (editable list)
- [ ] Action items (add/remove, reorder)
- [ ] Owner per action (dropdown)
- [ ] Timeline (date picker per action)
- [ ] Success metrics (editable)

**Output:** Docs save play

---

### 4.3 Escalation Report (`escalation_report`)

**Trigger Patterns (20+ variations):**
```
- "escalation report"
- "escalate issue"
- "executive escalation"
- "issue report"
- "escalation document"
- "exec escalation"
- "management escalation"
- "leadership escalation"
- "escalate to leadership"
- "escalate to management"
- "escalation brief"
- "escalation summary"
- "issue escalation"
- "problem escalation"
- "critical escalation"
- "urgent escalation"
- "prepare escalation"
- "write escalation"
- "draft escalation"
- "escalation email"
- "escalation deck"
- "get help with this customer"
```

**Data Sources:**
- Issue timeline
- Stakeholders involved
- Previous attempts
- Business impact

**Editable Preview Sections:**
- [ ] Issue summary (editable)
- [ ] Timeline events (add/remove, edit dates)
- [ ] Impact metrics (editable)
- [ ] Resolution request (editable)
- [ ] Supporting evidence (add/remove)
- [ ] Requested actions (editable list)

**Output:** Docs report

---

### 4.4 Resolution Plan (`resolution_plan`)

**Trigger Patterns (20+ variations):**
```
- "resolution plan"
- "fix issues"
- "issue resolution"
- "action plan"
- "remediation plan"
- "fix plan"
- "problem resolution"
- "issue fix"
- "solution plan"
- "corrective action"
- "fix the issues"
- "resolve issues"
- "address issues"
- "problem fix"
- "issues action plan"
- "resolution strategy"
- "how do we fix this"
- "what's the plan to fix"
- "get this resolved"
- "resolution roadmap"
- "issue tracker"
- "problem tracker"
```

**Data Sources:**
- Open issues
- Dependencies
- Resources
- Timeline constraints

**Editable Preview Sections:**
- [ ] Issues list (add/remove, edit)
- [ ] Action items per issue (add/remove)
- [ ] Owner per action (dropdown)
- [ ] Due dates (date picker)
- [ ] Status per item (dropdown)
- [ ] Dependencies (link issues)

**Output:** Docs + Sheets tracker

---

### 5.1 QBR Presentation (`qbr_generation`)
**Already Implemented** ✅

---

### 5.2 Executive Briefing (`executive_briefing`)

**Trigger Patterns (20+ variations):**
```
- "executive briefing"
- "exec summary"
- "board update"
- "leadership brief"
- "exec brief"
- "executive summary"
- "leadership update"
- "exec update"
- "c-level brief"
- "executive report"
- "management brief"
- "stakeholder brief"
- "executive deck"
- "leadership deck"
- "exec presentation"
- "brief for executives"
- "prepare exec update"
- "write exec summary"
- "executive overview"
- "senior leadership brief"
- "VP brief"
- "director brief"
```

**Data Sources:**
- Key metrics
- Strategic goals
- Risk summary
- Asks/requests

**Editable Preview Sections:**
- [ ] Headlines (editable)
- [ ] Key metrics (edit values, select which to show)
- [ ] Strategic updates (editable list)
- [ ] Asks (editable list with priority)
- [ ] Talking points (add/remove)
- [ ] Slide count selector

**Output:** Slides (5-7 slides max)

---

### 5.3 Account Plan (`account_plan`)

**Trigger Patterns (20+ variations):**
```
- "account plan"
- "strategic plan"
- "account strategy"
- "planning document"
- "strategic account plan"
- "customer plan"
- "success plan"
- "account roadmap"
- "strategy document"
- "account planning"
- "strategic planning"
- "customer strategy"
- "account goals"
- "annual plan"
- "yearly plan"
- "quarterly plan"
- "account objectives"
- "plan for the account"
- "what's the plan"
- "create account plan"
- "build account strategy"
- "long-term plan"
```

**Data Sources:**
- Customer goals
- Product roadmap
- Success metrics
- Resource allocation

**Editable Preview Sections:**
- [ ] Account overview (editable)
- [ ] Strategic objectives (add/remove, edit)
- [ ] Action items (add/remove)
- [ ] Timeline (Gantt-style view)
- [ ] Owner assignments (dropdown)
- [ ] Success metrics (editable)

**Output:** Docs + Sheets

---

### 5.4 Transformation Roadmap (`transformation_roadmap`)

**Trigger Patterns (20+ variations):**
```
- "transformation roadmap"
- "change management"
- "digital transformation"
- "journey map"
- "transformation plan"
- "change roadmap"
- "modernization plan"
- "evolution roadmap"
- "maturity roadmap"
- "customer journey"
- "transformation strategy"
- "change plan"
- "adoption roadmap"
- "capability roadmap"
- "growth roadmap"
- "progress roadmap"
- "advancement plan"
- "next phase plan"
- "transformation phases"
- "journey phases"
- "maturity model"
- "where are they going"
```

**Data Sources:**
- Current state
- Target state
- Milestones
- Dependencies

**Editable Preview Sections:**
- [ ] Vision statement (editable)
- [ ] Phase names (editable)
- [ ] Milestones per phase (add/remove)
- [ ] Success criteria (editable)
- [ ] Timeline (visual editor)
- [ ] Dependencies (drag to connect)

**Output:** Slides roadmap

---

### 6.1 Portfolio Dashboard (`portfolio_dashboard`)

**Trigger Patterns (20+ variations):**
```
- "portfolio dashboard"
- "my portfolio"
- "book of business"
- "all my customers"
- "customer portfolio"
- "account portfolio"
- "my accounts"
- "show my customers"
- "customer dashboard"
- "portfolio overview"
- "my book"
- "portfolio summary"
- "all accounts"
- "customer list"
- "account list"
- "portfolio health"
- "portfolio metrics"
- "show portfolio"
- "generate portfolio"
- "my customer base"
- "full portfolio"
- "general dashboard"
```

**Data Sources:**
- All customers
- Health scores
- ARR totals
- Renewal dates

**Editable Preview Sections:**
- [ ] Filter by health (multi-select)
- [ ] Filter by segment (multi-select)
- [ ] Sort options (dropdown)
- [ ] Columns to show (toggle)
- [ ] Date range (picker)
- [ ] Custom notes column

**Output:** Sheets dashboard

---

### 6.2 Team Metrics (`team_metrics`)

**Trigger Patterns (20+ variations):**
```
- "team metrics"
- "team performance"
- "CSM metrics"
- "team dashboard"
- "team report"
- "team analytics"
- "CSM performance"
- "team health"
- "team KPIs"
- "manager dashboard"
- "leadership metrics"
- "team summary"
- "CSM dashboard"
- "rep performance"
- "team numbers"
- "show team metrics"
- "how is my team doing"
- "team stats"
- "team data"
- "CSM stats"
- "team overview"
- "staff metrics"
```

**Data Sources:**
- All CSMs
- Customer assignments
- Health scores
- Activities

**Editable Preview Sections:**
- [ ] CSM filter (multi-select)
- [ ] Metric selection (toggle which KPIs)
- [ ] Time range (picker)
- [ ] Benchmark comparison (toggle)
- [ ] Chart types (toggle)
- [ ] Export columns (toggle)

**Output:** Sheets + Slides

---

### 6.3 Renewal Pipeline (`renewal_pipeline`)

**Trigger Patterns (20+ variations):**
```
- "renewal pipeline"
- "upcoming renewals"
- "renewal forecast"
- "what's renewing"
- "renewals coming up"
- "renewal calendar"
- "renewal schedule"
- "pipeline report"
- "renewal tracker"
- "renewal list"
- "show renewals"
- "renewals this quarter"
- "renewals this month"
- "renewal summary"
- "pipeline summary"
- "renewal overview"
- "what renewals do I have"
- "when are renewals"
- "renewal dates"
- "upcoming renewal dates"
- "renewal timeline"
- "all renewals"
```

**Data Sources:**
- Renewal dates
- Health scores
- ARR values
- Risk levels

**Editable Preview Sections:**
- [ ] Date range filter (picker)
- [ ] Risk level filter (multi-select)
- [ ] Owner filter (multi-select)
- [ ] ARR threshold (slider)
- [ ] Group by (dropdown: month/quarter/risk)
- [ ] Columns to show (toggle)

**Output:** Sheets pipeline

---

### 6.4 At-Risk Overview (`at_risk_overview`)

**Trigger Patterns (20+ variations):**
```
- "at-risk overview"
- "at risk overview"
- "at-risk customers"
- "who's at risk"
- "risk report"
- "risk overview"
- "customers at risk"
- "accounts at risk"
- "churn risk report"
- "red accounts"
- "unhealthy customers"
- "show at-risk"
- "risky customers"
- "risk dashboard"
- "at-risk dashboard"
- "churn dashboard"
- "all at-risk"
- "who is at risk"
- "which customers are at risk"
- "risk summary"
- "at-risk summary"
- "problem customers"
```

**Data Sources:**
- Risk scores
- Health trends
- Save plays
- Owners

**Editable Preview Sections:**
- [ ] Risk threshold filter (slider)
- [ ] Owner filter (multi-select)
- [ ] Segment filter (multi-select)
- [ ] Sort by (dropdown)
- [ ] Show save plays (toggle)
- [ ] Export options (checkboxes)

**Output:** Sheets + Docs

---

## Technical Implementation

### Files to Modify/Create:

1. `server/src/services/cadg/taskClassifier.ts` - Add all new task types with comprehensive patterns
2. `server/src/services/cadg/artifactGenerator.ts` - Add generation functions
3. `server/src/services/cadg/types.ts` - Add new TaskType values
4. `database/migrations/054_seed_capabilities.sql` - Add new capabilities
5. `server/src/routes/cadg.ts` - Handle new preview types
6. `components/AIPanel/CADGCardPreview.tsx` - **NEW** Generic editable preview component

### Download Endpoints (Add to cadg.ts):

```typescript
// PDF Download
GET /api/cadg/artifact/:artifactId/download?format=pdf
GET /api/cadg/artifact/:artifactId/download?format=pptx
GET /api/cadg/artifact/:artifactId/download?format=docx
GET /api/cadg/artifact/:artifactId/download?format=xlsx

// Data Export
GET /api/cadg/artifact/:artifactId/export-sources
```

### Task Type Enum Updates:

```typescript
export type TaskType =
  // Onboarding
  | 'kickoff_plan'
  | 'milestone_plan'
  | 'stakeholder_map'
  | 'training_schedule'
  // Adoption
  | 'usage_analysis'
  | 'feature_campaign'
  | 'champion_development'
  | 'training_program'
  // Renewal
  | 'renewal_forecast'
  | 'value_summary'
  | 'expansion_proposal'
  | 'negotiation_brief'
  // Risk
  | 'risk_assessment'
  | 'save_play'
  | 'escalation_report'
  | 'resolution_plan'
  // Strategic
  | 'qbr_generation'
  | 'executive_briefing'
  | 'account_plan'
  | 'transformation_roadmap'
  // General
  | 'portfolio_dashboard'
  | 'team_metrics'
  | 'renewal_pipeline'
  | 'at_risk_overview'
  // Existing
  | 'email_drafting'
  | 'meeting_prep'
  | 'document_creation'
  | 'presentation_creation'
  | 'data_analysis'
  | 'custom';
```

---

## Success Criteria

1. ✅ All 24 card types can be triggered via natural language (20+ patterns each)
2. ✅ Each card gathers data from appropriate sources
3. ✅ Each card generates Google Workspace files
4. ✅ Each card shows **EDITABLE** HITL preview before generation
5. ✅ Each card supports **PDF download**
6. ✅ Each card supports **native format download** (PPTX/DOCX/XLSX)
7. ✅ Each card supports **CSV data export**
8. ✅ Beautiful, consistent UI matching existing card styling
9. ✅ General mode works without customer context
10. ✅ Template mode works when no customer selected
