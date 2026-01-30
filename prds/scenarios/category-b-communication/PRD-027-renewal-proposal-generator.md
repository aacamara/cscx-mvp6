# PRD-027: Renewal Proposal Generator

## Metadata
- **PRD ID**: PRD-027
- **Category**: B - Customer Communication
- **Priority**: P0
- **Estimated Complexity**: High
- **Dependencies**: Google Workspace Integration, Renewal Pipeline Data

## Scenario Description
A CSM needs to create and send a professional renewal proposal to a customer approaching their contract end date. The system generates a comprehensive proposal document that includes current contract terms, proposed renewal terms, value delivered summary, and pricing options, then drafts an accompanying email for delivery.

## User Story
**As a** CSM using the Chat UI,
**I want to** generate a complete renewal proposal with supporting email,
**So that** I can efficiently initiate renewal conversations with accurate, personalized content.

## Trigger
- CSM types: "Create renewal proposal for [customer]" or "Generate renewal package for [customer]"
- CSM clicks "Renewal Proposal" quick action
- Automated trigger 60 days before contract end date

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Renewal pipeline | `renewal_pipeline` table | Implemented | Tracks renewal stages and metrics |
| Contract data | `contracts` table | Implemented | Current terms, ARR, dates |
| Docs templates | `server/src/services/google/docs.ts` | Implemented | Renewal Proposal template exists |
| Slides templates | `server/src/services/google/slides.ts` | Implemented | Renewal Presentation template |
| Gmail integration | `server/src/services/google/gmail.ts` | Implemented | Email sending with approval |
| Drive integration | `server/src/services/google/drive.ts` | Implemented | File sharing capabilities |

### What's Missing
- [ ] Renewal proposal content generator with value summary
- [ ] Multi-tier pricing option generator
- [ ] ROI/value calculation engine for proposal
- [ ] Proposal-specific email template
- [ ] Document + email bundled workflow
- [ ] Renewal proposal tracking (opened, downloaded)

## Detailed Workflow

### Step 1: Data Collection
- Fetch current contract terms and entitlements
- Retrieve renewal pipeline record
- Aggregate value metrics (usage, health score trends, outcomes)
- Identify expansion opportunities if applicable

### Step 2: Proposal Document Generation
- Create Google Doc using Renewal Proposal template
- Populate with customer-specific data
- Generate value summary section with metrics
- Include pricing options (flat renewal, growth, reduction)

### Step 3: Supporting Materials (Optional)
- Generate Renewal Presentation slides if requested
- Create pricing comparison spreadsheet if multi-tier

### Step 4: Email Drafting
- Draft cover email with proposal summary
- Attach/link proposal document
- Include call-to-action and next steps

### Step 5: Review and Delivery
- Present complete package to CSM for review
- Allow edits to documents and email
- Share document with appropriate permissions
- Send email upon HITL approval

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/renewal/proposalGenerator.ts` | Create | Renewal proposal generation logic |
| `server/src/templates/emails/renewal-proposal.ts` | Create | Proposal cover email template |
| `server/src/agents/specialists/communicator.ts` | Modify | Add renewal proposal skill |
| `server/src/services/google/docs.ts` | Modify | Enhanced variable substitution |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/renewal-proposal` | POST | Generate complete renewal proposal package |
| `GET /api/customers/:id/renewal-proposal/preview` | GET | Preview proposal content before generation |
| `POST /api/customers/:id/renewal-proposal/send` | POST | Send proposal email with attachments |

### Database Changes
| Table | Change | Description |
|-------|--------|-------------|
| `renewal_pipeline` | Add column | `proposal_doc_url` - Link to generated proposal |
| `renewal_pipeline` | Add column | `proposal_sent_at` - Timestamp of proposal delivery |

## Chat UI Flow
```
CSM: Create renewal proposal for TechFlow Inc
System: I'll generate a renewal proposal for TechFlow Inc.

Gathering contract and value data:
- Current ARR: $180,000
- Contract ends: March 31, 2026 (62 days away)
- Health Score: 85 (Growing)
- Usage trend: +23% YoY
- Key wins: 40% efficiency improvement, 3 new use cases adopted

Generating proposal...

Renewal Proposal Package Ready:

📄 **Proposal Document** (Google Doc)
- Executive Summary
- Partnership Timeline & Achievements
- Value Delivered: $540K estimated impact
- Renewal Options:
  • Option A: Flat renewal at $180K (current)
  • Option B: Growth tier at $210K (+2 seats, premium support)
  • Option C: Enterprise upgrade at $275K (full platform)
- Next Steps & Timeline

📧 **Cover Email Draft**
---
Subject: TechFlow Inc Partnership Renewal Proposal - FY2026

Hi Sarah,

As we approach the renewal of our partnership, I'm excited to share our proposal for continuing and expanding our collaboration...

[Full email preview]
---

[Edit Proposal] [Edit Email] [Generate Slides] [Send Package]

CSM: Send package
System: I'll share the proposal document and send the email.

Document shared with sarah@techflow.com (view access)
Email submitted for approval.

[Approval notification]
System: Renewal proposal sent to TechFlow Inc. Document has been shared and email delivered.
```

## Acceptance Criteria
- [ ] Generate complete renewal proposal document with value summary
- [ ] Include multiple pricing/tier options in proposal
- [ ] Auto-calculate ROI/value metrics from historical data
- [ ] Draft accompanying email with proposal link
- [ ] Share document with appropriate stakeholder permissions
- [ ] Follow HITL approval for email sending
- [ ] Update renewal_pipeline record with proposal details
- [ ] Log all activities to agent_activity_log

## Ralph Loop Notes
- **Learning**: Track which proposal options customers select most
- **Optimization**: Identify optimal pricing strategies per segment
- **Personalization**: Adjust value messaging based on customer priorities

### Completion Signal
```
<promise>PRD-027-COMPLETE</promise>
```
