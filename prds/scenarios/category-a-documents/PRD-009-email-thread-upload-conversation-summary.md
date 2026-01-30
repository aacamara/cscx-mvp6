# PRD-009: Email Thread Upload → Conversation Summary

## Metadata
- **PRD ID**: PRD-009
- **Category**: A - Documents & Data Processing
- **Priority**: P2
- **Estimated Complexity**: Medium
- **Dependencies**: Gmail integration, AI summarization

## Scenario Description
A CSM uploads an email thread export (or forwards a thread) to get a comprehensive summary of the conversation, key points, action items, sentiment analysis, and relationship context. This helps CSMs quickly get up to speed on customer communications.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload an email thread and receive a comprehensive summary,
**So that** I can quickly understand the conversation history without reading every email.

## Trigger
CSM uploads email thread (EML, MSG, or text export) or pastes email content via Chat UI with a message like "Summarize this email thread."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Gmail thread retrieval | Gmail integration | Implemented | Can list and get threads |
| Email search | Gmail integration | Implemented | Can search by customer |
| Email summarization | Chat capabilities | Partial | Can summarize if pasted |
| Sentiment analysis | Meeting analyses | Implemented | Applicable to emails |

### What's Missing
- [ ] Email file upload (EML, MSG formats)
- [ ] Thread structure parsing
- [ ] Multi-email conversation flow analysis
- [ ] Email-specific action item extraction
- [ ] Response time and engagement metrics
- [ ] Relationship health indicators from email patterns

## Detailed Workflow

### Step 1: Email Upload
**User Action**: CSM uploads email file or pastes thread content
**System Response**:
- Parses email format (EML, MSG, text)
- Reconstructs thread chronology
- Identifies participants and roles
- Associates with customer record

### Step 2: Thread Analysis
**User Action**: None (automatic)
**System Response**:
- Summarizes overall thread topic and resolution
- Extracts key points from each email
- Identifies tone and sentiment shifts
- Detects open questions and pending items
- Notes any escalation or urgency

### Step 3: Insights Display
**User Action**: CSM reviews summary
**System Response**:
- Shows timeline view of conversation
- Displays key takeaways
- Lists action items and commitments
- Shows sentiment progression
- Highlights relationship indicators

### Step 4: Actions
**User Action**: CSM takes action
**System Response**:
- Offers to draft reply
- Creates tasks from action items
- Logs summary to customer timeline
- Suggests next steps

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/email/threadParser.ts` | Parse EML and MSG files |
| `server/src/services/analysis/emailSummarizer.ts` | Email thread summarization |
| `server/src/services/analysis/conversationFlow.ts` | Analyze conversation dynamics |
| `components/Email/ThreadViewer.tsx` | Thread visualization |
| `components/Email/ConversationSummary.tsx` | Summary display component |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/email/thread/upload` | POST | Upload email thread file |
| `POST /api/email/thread/summarize` | POST | Generate thread summary |
| `GET /api/email/thread/:id/timeline` | GET | Get conversation timeline |
| `POST /api/email/thread/:id/draft-reply` | POST | Draft response |

### Analysis Outputs
| Output | Description |
|--------|-------------|
| Thread Summary | 2-3 sentence overview |
| Key Points | Bulleted list of important topics |
| Action Items | Tasks and owners identified |
| Sentiment Arc | How tone changed over thread |
| Response Metrics | Avg response time, thread duration |
| Relationship Signals | Warmth, urgency, frustration indicators |

## Chat UI Flow
```
CSM: [Uploads email_thread.eml] Summarize this email thread

System: 📧 Analyzing email thread...

Thread identified:
- Subject: "Re: Implementation Timeline Questions"
- Participants: Sarah Chen (Acme), Mike Johnson (Acme), You
- Emails: 8 messages
- Duration: 5 days (Jan 23-28)

---

**📝 Thread Summary**

This thread discusses concerns about the implementation timeline for Acme Corp's deployment. Sarah initially expressed worry about meeting the 6-week deadline given resource constraints. After several exchanges, you proposed an extended 8-week timeline with adjusted milestones, which Sarah accepted. Mike raised technical questions about API access that remain partially unresolved.

---

**📌 Key Points**

1. **Timeline Extended** - Original 6-week plan extended to 8 weeks
2. **Resource Constraints** - Acme team has limited availability in February
3. **API Questions** - Mike needs documentation for integration planning
4. **Training Scheduling** - Need to coordinate with Sarah's team availability
5. **Go-Live Target** - Now targeting March 15 instead of March 1

---

**🕐 Conversation Timeline**

| Date | From | Key Content | Sentiment |
|------|------|-------------|-----------|
| Jan 23 | Sarah | "Concerned about 6-week timeline" | 😟 Worried |
| Jan 23 | You | Acknowledged, asked about constraints | 😊 Supportive |
| Jan 24 | Sarah | Listed team availability issues | 😐 Neutral |
| Jan 25 | You | Proposed 8-week alternative | 😊 Helpful |
| Jan 25 | Mike | Added API documentation request | 😐 Neutral |
| Jan 26 | You | Confirmed 8-week plan, will send docs | 😊 Positive |
| Jan 27 | Sarah | "Thank you, this works much better" | 😊 Relieved |
| Jan 28 | Mike | Follow-up on API docs timing | ❓ Waiting |

---

**✅ Action Items Identified**

| Item | Owner | Status |
|------|-------|--------|
| Send API documentation | You | 🔴 Pending (Mike waiting) |
| Confirm training dates | Sarah | 🟡 Discussed, not finalized |
| Update project timeline | You | ✅ Done in thread |

---

**💬 Sentiment Analysis**

```
Start: 😟 Worried/Concerned (Sarah's initial email)
Middle: 😐 Neutral (problem-solving exchanges)
End: 😊 Positive/Relieved (agreement reached)

Overall Arc: Negative → Positive ⬆️
```

---

**🚨 Open Items**

1. **API Documentation** - Mike asked on Jan 25 and followed up Jan 28
   ⚠️ This request is 3 days old without delivery

2. **Training Dates** - Mentioned but not scheduled

---

**💡 Relationship Insights**

- Sarah responds within 4 hours on average (engaged)
- Mike's tone is more technical/transactional
- Thread shows good collaboration and flexibility from both sides
- Your responsiveness (avg 6 hours) rated positively

Would you like me to:
[Draft Reply to Mike] [Create Tasks] [Log to Customer Timeline] [Find Related Threads]

CSM: Draft a reply to Mike about the API docs

System: 📧 Drafting reply to Mike...

**To:** Mike Johnson <m.johnson@acme.com>
**Cc:** Sarah Chen <sarah.chen@acme.com>
**Subject:** Re: Implementation Timeline Questions

Hi Mike,

Apologies for the delay on the API documentation! I'm attaching it now.

The documentation includes:
- Authentication guide
- Endpoint reference
- Code samples in Python and JavaScript
- Rate limiting details

I've also included our integration best practices guide which should help your team get started.

If you have any questions as you review, I'm happy to schedule a quick call to walk through the technical details.

Best,
[Your Name]

---

[Preview] [Edit] [Approve & Send]

📎 Suggested attachments:
- API_Documentation_v2.1.pdf
- Integration_Best_Practices.pdf

(Note: I'll need to search Drive for these docs - should I look for them?)
```

## Acceptance Criteria
- [ ] Supports EML, MSG, and plain text email formats
- [ ] Correctly reconstructs thread chronology from reply chains
- [ ] Identifies all participants and their roles
- [ ] Summary accurately captures thread resolution
- [ ] Key points are non-redundant and actionable
- [ ] Sentiment analysis reflects actual tone in emails
- [ ] Open/pending items are correctly flagged
- [ ] Response time metrics are accurate
- [ ] Draft replies maintain appropriate context
- [ ] Processing completes within 20 seconds for 10-email thread

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-009-COMPLETE</promise>
```

### Success Metrics
- Summary accuracy validated by CSM > 90%
- Time to understand thread reduced by > 75%
- Action items from email threads have higher completion rate
