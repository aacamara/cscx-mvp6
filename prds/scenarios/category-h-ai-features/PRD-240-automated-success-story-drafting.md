# PRD-240: Automated Success Story Drafting

## Metadata
- **PRD ID**: PRD-240
- **Category**: H - AI-Powered Features
- **Priority**: P2
- **Estimated Complexity**: Medium
- **Dependencies**: PRD-048 (Case Study Request), PRD-137 (Goal Achieved)

## Scenario Description
When customers achieve significant milestones or outcomes, the AI should automatically draft success stories that can be used for case studies, testimonials, and internal sharing. The draft should include key metrics, narrative elements, and customer quotes.

## User Story
**As a** CSM who achieved great results with a customer,
**I want** the AI to draft a success story,
**So that** I can easily share wins and create marketing content.

## Trigger
- CSM asks: "Create a success story for [customer]"
- Major milestone achieved (renewal, expansion, goal met)
- Customer provides positive feedback or NPS

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Customer data | `customers` table | Implemented | Profile and metrics |
| Meeting notes | `transcripts` table | Implemented | Customer quotes |
| Health score | `health_score_history` | Implemented | Improvement tracking |
| Goals | Customer goals tracked | Partial | Success criteria |

### What's Missing
- [ ] Success story template library
- [ ] Automated narrative generation
- [ ] Metrics extraction and formatting
- [ ] Quote identification from transcripts
- [ ] Image/visual generation
- [ ] Approval workflow for publishing

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/content/successStory.ts` | Create | Success story generator |
| `server/src/templates/successStory.ts` | Create | Story templates |
| `components/SuccessStoryEditor.tsx` | Create | Story editing UI |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/content/success-story` | POST | Generate success story |
| `GET /api/content/success-story/:id` | GET | Get story draft |
| `PUT /api/content/success-story/:id` | PUT | Edit story |
| `POST /api/content/success-story/:id/publish` | POST | Submit for approval |

### Database Changes
```sql
CREATE TABLE success_stories (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  title TEXT,
  summary TEXT,
  narrative TEXT,
  metrics JSONB,
  quotes JSONB,
  status VARCHAR(50),
  created_by UUID,
  approved_by UUID,
  created_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);
```

## Chat UI Flow
```
CSM: Create a success story for TechFlow's 40% efficiency improvement
System: Drafting success story for TechFlow Inc...

**Success Story Draft**

---

**Title:** How TechFlow Inc Achieved 40% Efficiency Gains with CSCX.AI

**Summary:**
TechFlow Inc, a fast-growing SaaS company, transformed their customer success operations using CSCX.AI, resulting in a 40% improvement in CSM efficiency and 15% increase in retention.

**The Challenge:**
Before implementing CSCX.AI, TechFlow's CS team struggled with manual processes, scattered customer data, and reactive rather than proactive engagement. CSMs spent 60% of their time on administrative tasks.

**The Solution:**
TechFlow deployed CSCX.AI's WorkspaceAgent to automate routine tasks, centralize customer intelligence, and enable proactive engagement.

**Key Results:**
📊 40% improvement in CSM efficiency
📈 15% increase in customer retention
⏱️ 50% reduction in time-to-value
💰 $500K saved in operational costs

**Customer Quote:**
*"CSCX.AI has been transformational for our team. We've gone from firefighting to strategic partnership with our customers."*
— Sarah Chen, VP of Customer Success, TechFlow Inc

---

**Extracted from:**
- QBR presentation (Jan 2026)
- Meeting transcript (Dec 15, 2025)
- Health score improvement data

[Edit Draft] [Request Customer Approval] [Share Internally]
```

## Acceptance Criteria
- [ ] Generate complete success story from customer data
- [ ] Include quantifiable metrics with comparisons
- [ ] Extract relevant quotes from meeting transcripts
- [ ] Follow professional case study format
- [ ] Allow CSM editing before publishing
- [ ] Customer approval workflow
- [ ] Multiple output formats (web, PDF, slides)
- [ ] Integration with marketing content system

## Ralph Loop Notes
- **Learning**: Track which story elements resonate with audiences
- **Optimization**: Improve narrative generation based on feedback
- **Personalization**: Learn writing style preferences per CSM

### Completion Signal
```
<promise>PRD-240-COMPLETE</promise>
```
