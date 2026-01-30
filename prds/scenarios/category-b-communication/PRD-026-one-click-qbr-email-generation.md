# PRD-026: One-Click QBR Email Generation

## Metadata
- **PRD ID**: PRD-026
- **Category**: B - Customer Communication
- **Priority**: P0
- **Estimated Complexity**: Medium
- **Dependencies**: PRD-001 (QBR Document Generation), Google Workspace Integration

## Scenario Description
A CSM needs to quickly send a professional QBR invitation or follow-up email to customer stakeholders. The system should auto-generate a personalized email that includes QBR scheduling details, agenda preview, and relevant metrics summary, allowing the CSM to review and send with a single click after approval.

## User Story
**As a** CSM using the Chat UI,
**I want to** generate a complete QBR email with one command,
**So that** I can efficiently communicate QBR details to stakeholders without manual drafting.

## Trigger
- CSM types: "Send QBR email to [customer]" or "Generate QBR invite for [customer]"
- CSM clicks "QBR Email" quick action in customer context
- Automated trigger 14 days before scheduled QBR date

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| QBR data model | `qbrs` table | Implemented | Stores QBR metadata, attendees, status |
| Gmail send capability | `server/src/services/google/gmail.ts` | Implemented | `sendEmail()` function with approval |
| Email drafting | Communicator agent | Implemented | Can draft emails with context |
| QBR templates | `server/src/services/google/docs.ts` | Implemented | QBR Report template exists |
| Customer stakeholders | `stakeholders` table | Implemented | Contact info available |

### What's Missing
- [ ] QBR email template specifically for invitations/follow-ups
- [ ] One-click command recognition in Chat UI
- [ ] Auto-population of QBR metrics in email body
- [ ] Smart attendee selection based on stakeholder roles
- [ ] QBR date/time formatting for email
- [ ] Agenda preview generation for email inclusion

## Detailed Workflow

### Step 1: Command Recognition
- Chat UI recognizes QBR email intent from natural language
- System identifies target customer and QBR type (invite vs. follow-up)

### Step 2: Data Aggregation
- Fetch customer profile and stakeholders
- Retrieve latest QBR record or create placeholder
- Pull health score, usage metrics, recent wins/challenges
- Identify appropriate attendees based on roles

### Step 3: Email Generation
- Select appropriate template (invite vs. follow-up)
- Populate with customer-specific data
- Generate agenda preview with key discussion topics
- Include proposed meeting times or confirmed schedule

### Step 4: Review and Approval
- Display draft in Chat UI for CSM review
- Allow inline edits before sending
- Submit for HITL approval (send_email policy)

### Step 5: Delivery and Logging
- Send via Gmail API upon approval
- Log activity to `agent_activity_log`
- Update QBR record status if applicable

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/google/gmail.ts` | Modify | Add `generateQBREmail()` helper |
| `server/src/agents/specialists/communicator.ts` | Modify | Add QBR email skill |
| `server/src/templates/emails/qbr-invite.ts` | Create | QBR invitation email template |
| `server/src/templates/emails/qbr-followup.ts` | Create | QBR follow-up email template |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/qbr-email` | POST | Generate and send QBR email |
| `GET /api/customers/:id/qbr-email/preview` | GET | Preview QBR email content |

### Database Changes
None required - uses existing tables.

## Chat UI Flow
```
CSM: Send QBR email to Acme Corp
System: I'll generate a QBR invitation email for Acme Corp.

Gathering information:
- Customer: Acme Corp ($250K ARR)
- Primary stakeholders: Jane Smith (VP Ops), Bob Chen (Director)
- Health Score: 78 (Stable)
- Next QBR: Q1 2026 (not yet scheduled)

Draft email ready for review:

---
Subject: Acme Corp Q1 2026 Quarterly Business Review - Let's Schedule

Hi Jane and Bob,

I hope this message finds you well! As we approach the end of Q4, I wanted to reach out about scheduling our Q1 2026 Quarterly Business Review.

**Proposed Agenda:**
- Platform performance review (78 health score, stable trend)
- Usage highlights and adoption metrics
- Roadmap preview for upcoming features
- Strategic alignment for H1 2026

**Suggested Times:**
- Tuesday, Jan 14 at 2:00 PM
- Wednesday, Jan 15 at 10:00 AM

Please let me know which time works best, or suggest alternatives.

Best regards,
[CSM Name]
---

[Edit Draft] [Send for Approval] [Cancel]

CSM: Send for approval
System: Email submitted for approval. You'll be notified when it's ready to send.

[Approval notification]
System: Your QBR email to Acme Corp has been approved and sent successfully.
```

## Acceptance Criteria
- [ ] CSM can generate QBR email with single natural language command
- [ ] Email includes customer-specific metrics (health score, ARR, usage)
- [ ] Stakeholders auto-selected based on roles (executives, primary contacts)
- [ ] Email follows HITL approval policy before sending
- [ ] Activity logged to agent_activity_log
- [ ] Support for both invitation and follow-up email types
- [ ] CSM can edit draft before approval submission

## Ralph Loop Notes
- **Learning**: Track which email templates have highest response rates
- **Optimization**: Suggest optimal send times based on historical engagement
- **Personalization**: Learn CSM's writing style preferences over time

### Completion Signal
```
<promise>PRD-026-COMPLETE</promise>
```
