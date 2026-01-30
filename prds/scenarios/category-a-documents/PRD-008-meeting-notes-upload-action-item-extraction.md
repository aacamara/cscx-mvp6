# PRD-008: Meeting Notes Upload → Action Item Extraction

## Metadata
- **PRD ID**: PRD-008
- **Category**: A - Documents & Data Processing
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Meeting intelligence service, AI extraction

## Scenario Description
A CSM uploads meeting notes (from Notion, Google Docs, Word, or plain text) and the system automatically extracts action items, assigns owners, detects commitments made, identifies risks discussed, and creates follow-up tasks.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload meeting notes and have action items automatically extracted,
**So that** I can ensure nothing falls through the cracks after customer meetings.

## Trigger
CSM uploads a document or pastes meeting notes via Chat UI with a message like "Extract action items from these meeting notes."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Meeting analysis | `meeting_analyses` table | Implemented | For transcripts |
| Action item extraction | Meeting intelligence | Implemented | From transcripts |
| Commitment tracking | `meeting_analyses.commitments` | Implemented | JSONB field |
| Meeting prep automation | Apps Script | Implemented | Pre-meeting briefs |
| Transcript processing | Zoom/Otter integration | Implemented | Auto-processed |

### What's Missing
- [ ] Manual meeting notes upload
- [ ] Multi-format document parsing (Notion, Docs, Word)
- [ ] Action item assignment to specific stakeholders
- [ ] Task creation from action items
- [ ] Integration with meeting records
- [ ] Historical action item tracking

## Detailed Workflow

### Step 1: Notes Upload
**User Action**: CSM uploads document or pastes text
**System Response**:
- Accepts multiple formats (PDF, DOCX, TXT, Markdown, direct paste)
- Detects document structure
- Associates with customer if identifiable
- Reports: "Analyzing meeting notes for Acme Corp kickoff meeting..."

### Step 2: Content Analysis
**User Action**: None (automatic)
**System Response**:
- AI extracts meeting metadata (date, attendees, topic)
- Identifies action items with context
- Detects commitments (both ours and customer's)
- Flags risk signals or concerns mentioned
- Notes expansion opportunities discussed

### Step 3: Action Item Review
**User Action**: CSM reviews extracted items
**System Response**:
- Displays action items in structured format
- Shows confidence level for each extraction
- Allows editing and owner assignment
- Suggests due dates based on urgency keywords

### Step 4: Task Creation
**User Action**: CSM approves action items
**System Response**:
- Creates tasks from approved action items
- Links tasks to customer record
- Sends notifications to assignees
- Updates meeting record if linked

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/meetings/notesParser.ts` | Parse various document formats |
| `server/src/services/analysis/actionExtractor.ts` | Extract action items from text |
| `server/src/services/meetings/taskCreator.ts` | Create tasks from action items |
| `components/Meetings/NotesUploader.tsx` | Notes upload UI |
| `components/Meetings/ActionItemEditor.tsx` | Review and edit action items |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/meetings/notes/upload` | POST | Upload meeting notes |
| `POST /api/meetings/notes/analyze` | POST | Extract action items |
| `PUT /api/meetings/notes/:id/actions` | PUT | Update action items |
| `POST /api/meetings/notes/:id/create-tasks` | POST | Create tasks from actions |

### Extracted Elements
| Element | Description | Confidence Indicator |
|---------|-------------|---------------------|
| Action Items | Tasks with owner, due date, description | High/Medium/Low |
| Commitments (Ours) | Promises made to customer | High/Medium/Low |
| Commitments (Theirs) | Customer promises | High/Medium/Low |
| Risk Signals | Concerns or issues mentioned | High/Medium/Low |
| Expansion Signals | Upsell/cross-sell opportunities | High/Medium/Low |
| Follow-up Topics | Items for next meeting | High/Medium/Low |

## Chat UI Flow
```
CSM: [Pastes meeting notes]

---
Acme Corp Kickoff Meeting
Date: January 28, 2026
Attendees: Sarah Chen (Acme), Mike Johnson (Acme), Lisa (CSCX)

Discussion:
- Reviewed implementation timeline, Sarah expressed concern about the 6-week timeline being too aggressive given their team's availability. We agreed to extend to 8 weeks.
- Mike needs API documentation sent by Friday for his team to start integration planning.
- Acme will provide their data migration requirements by Feb 5.
- Sarah mentioned they might want to add 50 more seats if the pilot goes well.
- Discussed training schedule - we'll conduct 3 sessions: admin training, end-user basics, and advanced features.
- Sarah asked about SAML integration - I said I'd check with product team on timeline.
- Next meeting scheduled for Feb 10 to review progress.
---

System: 📋 Analyzing meeting notes...

Customer identified: **Acme Corp**
Meeting type: **Kickoff Meeting**
Date: January 28, 2026

---

**✅ Action Items Extracted**

| # | Action Item | Owner | Due Date | Confidence |
|---|-------------|-------|----------|------------|
| 1 | Send API documentation to Mike | You (CSM) | Jan 31 | ✓ High |
| 2 | Check with product on SAML integration timeline | You (CSM) | Feb 3 | ✓ High |
| 3 | Schedule 3 training sessions | You (CSM) | Feb 7 | Medium |
| 4 | Provide data migration requirements | Acme (Sarah) | Feb 5 | ✓ High |

---

**🤝 Commitments Made**

**Our Commitments:**
- Extended implementation timeline from 6 to 8 weeks
- Will provide API documentation by Friday
- Will check on SAML integration timeline

**Customer Commitments:**
- Provide data migration requirements by Feb 5

---

**⚠️ Risk Signals**
- Timeline concern: Customer team availability may be limited
- Dependency: Integration depends on timely API doc delivery

---

**🚀 Expansion Signal**
- Potential 50 additional seats if pilot succeeds (+$10K ARR estimate)

---

**📅 Next Meeting**
- February 10, 2026 - Progress review

Would you like me to:
[Create Tasks] [Edit Action Items] [Link to Meeting Record] [Add Expansion Opportunity]

CSM: Create tasks and add the expansion opportunity

System: ✅ Tasks Created!

📋 **Your Tasks:**
1. **Send API documentation to Mike**
   - Due: January 31, 2026
   - Customer: Acme Corp
   - Status: Not Started

2. **Check with product on SAML timeline**
   - Due: February 3, 2026
   - Customer: Acme Corp
   - Status: Not Started

3. **Schedule training sessions (3)**
   - Due: February 7, 2026
   - Customer: Acme Corp
   - Status: Not Started

📋 **Customer Task (for tracking):**
4. **Acme to provide data migration requirements**
   - Due: February 5, 2026
   - Owner: Sarah Chen
   - Status: Waiting on Customer

---

🚀 **Expansion Opportunity Created:**
- Customer: Acme Corp
- Type: Seat expansion
- Estimated Value: $10,000 ARR
- Timeline: Post-pilot (Q2 2026)
- Champion: Sarah Chen
- Stage: Early Discovery

All items linked to Acme Corp customer record. Would you like me to set a reminder to follow up with Acme on their data migration requirements?
```

## Acceptance Criteria
- [ ] Supports paste, PDF, DOCX, TXT, and Markdown input
- [ ] Correctly identifies action items with >85% accuracy
- [ ] Distinguishes between our commitments and customer commitments
- [ ] Assigns owners based on context clues in notes
- [ ] Suggests realistic due dates from urgency keywords ("by Friday", "next week")
- [ ] Risk signals extracted match those in transcript analysis
- [ ] Tasks created include proper context and customer linkage
- [ ] Expansion opportunities link to expansion_opportunities table
- [ ] Meeting record association when meeting date/customer match
- [ ] Processing completes within 15 seconds for typical notes

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-008-COMPLETE</promise>
```

### Success Metrics
- Action item extraction accuracy > 90%
- Tasks completed on time increase by > 20%
- No missed commitments for meetings with notes uploaded
