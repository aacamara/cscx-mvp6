# CADG Email HITL Preview

## Overview

Transform the CADG email drafting flow from auto-generation to an interactive Human-in-the-Loop (HITL) workflow. When a user requests an email via CADG, instead of immediately generating and sending, present an editable preview where users can review, modify, enhance with AI, and approve before sending.

## Problem Statement

Currently, when CADG generates an email:
1. It shows "Template Mode" even when a customer is selected
2. Users cannot preview the email content before approval
3. There's no ability to edit subject, body, or recipients
4. No AI enhancement option for improving the draft
5. Approval sends immediately without final review

Users need a workflow similar to the existing EmailComposer component that allows reviewing and refining emails before they're sent.

## Goals

1. **Preview Before Send**: Show full email preview with generated content
2. **Editable Draft**: Allow editing subject, body, recipients before sending
3. **AI Enhancement**: Integrate Claude suggestions for improving drafts
4. **Customer Context**: Display actual customer data, not template placeholders
5. **Approval Workflow**: Require explicit user approval after review

## Inspiration Components

### EmailComposer (`components/AgentControlCenter/InteractiveActions/EmailComposer/index.tsx`)
- Multi-step wizard pattern (recipients → template → compose → attachments → preview)
- Editable fields at each step
- Template selection with customization

### EmailPreviewModal (`components/AgentControlCenter/EmailPreviewModal.tsx`)
- Editable To, CC, Subject, Body fields
- "Get Claude Suggestions" button for AI improvements
- Apply/Dismiss suggestion controls
- Final Send action

## Proposed User Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User: "Draft an email to TechCorp about their renewal"      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ CADG: Gathers customer context, generates draft             │
│ - Customer: TechCorp (not Template Mode)                    │
│ - Health Score, ARR, Renewal Date from Customer360          │
│ - Contact info from stakeholders                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ CADGEmailPreview Component (NEW)                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ To: [sarah@techcorp.com] [+]                            │ │
│ │ CC: [john@techcorp.com] [+]                             │ │
│ │ Subject: [Your TechCorp Renewal - Let's Discuss]        │ │
│ │ ───────────────────────────────────────────────────────│ │
│ │ Dear Sarah,                                             │ │
│ │                                                         │ │
│ │ I wanted to reach out regarding TechCorp's upcoming     │ │
│ │ renewal on March 15th. Given your team's strong         │ │
│ │ engagement (85% feature adoption) and positive health   │ │
│ │ score of 82, I believe we're well-positioned for a      │ │
│ │ smooth renewal discussion...                            │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [✨ Get Claude Suggestions]                                 │
│                                                             │
│ ┌─ AI Suggestion ─────────────────────────────────────────┐ │
│ │ Consider mentioning the 3 support tickets resolved      │ │
│ │ this month to reinforce your team's commitment.         │ │
│ │                                                         │ │
│ │ [Apply] [Dismiss]                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Cancel]                              [Send Email ✓]        │
└─────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### User Stories

#### US-001: Create CADGEmailPreview Component
**Description**: As a user, I want to see a preview of the generated email before it's sent.

**Acceptance Criteria**:
- Create `components/AIPanel/CADGEmailPreview.tsx`
- Display editable To, CC, Subject, Body fields
- Pre-populate with CADG-generated content
- Show customer name (not "Template Mode") in header
- Typecheck passes

#### US-002: Integrate Preview into CADG Plan Card
**Description**: As a user, when I approve an email plan, I want to see the preview instead of immediately sending.

**Acceptance Criteria**:
- Modify `CADGPlanCard.tsx` to show preview on email artifact approval
- Pass generated email data to CADGEmailPreview component
- Only show preview for email-type artifacts
- Other artifact types (QBR, analysis) continue with current flow
- Typecheck passes

#### US-003: Add Claude Suggestions Feature
**Description**: As a user, I want to get AI suggestions to improve my email draft.

**Acceptance Criteria**:
- Add "Get Claude Suggestions" button to CADGEmailPreview
- Call Claude API with email context and customer data
- Display suggestion in dismissible card
- "Apply" button integrates suggestion into email body
- "Dismiss" button hides suggestion
- Typecheck passes

#### US-004: Implement Email Send from Preview
**Description**: As a user, after reviewing and editing, I want to send the email with one click.

**Acceptance Criteria**:
- "Send Email" button calls email send API
- Uses Gmail API via existing OAuth integration
- Shows success/error toast notification
- Closes preview modal on success
- Records activity in customer timeline
- Typecheck passes

#### US-005: Update CADG Backend for Preview Mode
**Description**: As a developer, I need the CADG API to support preview mode for emails.

**Acceptance Criteria**:
- Modify `/api/cadg/plan/:id/approve` for email artifacts
- Return generated email content instead of sending immediately
- Add new endpoint `/api/cadg/email/send` for final send
- Include customer data in response (not template data)
- Typecheck passes

#### US-006: Handle Edits and Re-enhancement
**Description**: As a user, I want to edit the email and get new suggestions based on my changes.

**Acceptance Criteria**:
- All fields in preview are editable
- "Get Claude Suggestions" works on edited content
- Track if email was modified from original
- Warn if discarding unsaved changes
- Typecheck passes

## API Changes

### Existing Endpoint Modification

**POST `/api/cadg/plan/:id/approve`**

When artifact type is `email`:
```json
{
  "action": "approve",
  "previewMode": true  // NEW: Request preview instead of send
}
```

Response:
```json
{
  "success": true,
  "preview": {
    "to": ["sarah@techcorp.com"],
    "cc": ["john@techcorp.com"],
    "subject": "Your TechCorp Renewal - Let's Discuss",
    "body": "Dear Sarah,\n\nI wanted to reach out...",
    "customer": {
      "id": "cust_123",
      "name": "TechCorp",
      "healthScore": 82,
      "renewalDate": "2026-03-15"
    }
  }
}
```

### New Endpoint

**POST `/api/cadg/email/send`**

Request:
```json
{
  "planId": "plan_123",
  "to": ["sarah@techcorp.com"],
  "cc": ["john@techcorp.com"],
  "subject": "Your TechCorp Renewal - Let's Discuss",
  "body": "Dear Sarah,\n\nI wanted to reach out...",
  "customerId": "cust_123"
}
```

Response:
```json
{
  "success": true,
  "messageId": "msg_abc123",
  "sentAt": "2026-02-01T10:30:00Z"
}
```

## Component Structure

```
components/AIPanel/
├── CADGPlanCard.tsx           # Existing - modified
├── CADGEmailPreview.tsx       # NEW - Main preview component
└── CADGEmailPreview/
    ├── index.tsx              # Container with state management
    ├── EmailForm.tsx          # Editable fields (to, cc, subject, body)
    ├── AISuggestionCard.tsx   # Claude suggestion display
    └── types.ts               # TypeScript interfaces
```

## State Management

```typescript
interface CADGEmailPreviewState {
  // Original generated content
  original: {
    to: string[];
    cc: string[];
    subject: string;
    body: string;
  };

  // Current editable state
  draft: {
    to: string[];
    cc: string[];
    subject: string;
    body: string;
  };

  // Customer context
  customer: {
    id: string;
    name: string;
    healthScore: number;
    renewalDate: string;
  };

  // AI suggestions
  suggestion: {
    loading: boolean;
    content: string | null;
    applied: boolean;
  };

  // UI state
  isModified: boolean;
  isSending: boolean;
  error: string | null;
}
```

## Success Metrics

1. **Email Quality**: Track edit rate before sending (lower = better initial generation)
2. **AI Adoption**: Percentage of emails where suggestions are applied
3. **Time to Send**: Time from preview open to send (faster = better UX)
4. **Completion Rate**: Emails previewed vs emails sent (higher = better)

## Out of Scope

- Attachments (can be added in future iteration)
- Rich text editor (plain text with line breaks for now)
- Multiple recipient input via paste (manual add only)
- Email scheduling (sends immediately)
- Draft saving (must complete in session)

## Dependencies

- Existing Gmail OAuth integration
- Claude API for suggestions
- Customer360 data access tools
- Supabase for activity logging

## Risks

1. **OAuth Token Expiry**: Handle refresh tokens for Gmail API
2. **Large Email Bodies**: May need to truncate for Claude context window
3. **Customer Selection**: Ensure customer context is properly passed from chat

## Timeline

- US-001: CADGEmailPreview component
- US-002: Integration with CADGPlanCard
- US-003: Claude suggestions feature
- US-004: Email send implementation
- US-005: Backend API changes
- US-006: Edit/re-enhance handling
