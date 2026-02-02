# CADG Email HITL Preview

## Overview

Human-in-the-Loop (HITL) workflow for CADG email drafting. Instead of auto-sending emails, users can now review, edit, enhance with AI, and approve before sending.

## Features

### 1. Email Preview Modal (`components/AIPanel/CADGEmailPreview.tsx`)
- Editable To, CC, Subject, Body fields
- Customer context display in header (name, health score)
- Modified indicator when draft differs from original
- Unsaved changes warning on cancel

### 2. Claude Suggestions (`POST /api/cadg/email/suggest`)
- "Get Claude Suggestions" button for AI improvement
- Context-aware suggestions using customer data
- Apply/Dismiss suggestion workflow
- Suggestions integrate into email body

### 3. Preview Mode in Plan Approval
- When `taskType === 'email_drafting'`, approval returns preview instead of sending
- Response includes `isPreview: true` flag
- Full email content returned for editing

### 4. Email Send Endpoint (`POST /api/cadg/email/send`)
- Final send after user review
- Uses Gmail API via existing OAuth
- Logs activity to customer timeline
- Updates plan status to 'completed'

## Architecture

```
User Request: "draft email about renewal"
         │
         ▼
┌─────────────────────────────────────┐
│ POST /api/cadg/plan                 │
│ Creates plan with taskType:         │
│ 'email_drafting'                    │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ POST /api/cadg/plan/:id/approve     │
│ Detects email artifact              │
│ Returns isPreview: true + content   │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ CADGEmailPreview Component          │
│ - Shows editable email              │
│ - Get Claude Suggestions            │
│ - Edit fields                       │
└─────────────────────────────────────┘
         │
         ▼ (User clicks Send)
┌─────────────────────────────────────┐
│ POST /api/cadg/email/send           │
│ - Send via Gmail API                │
│ - Log to agent_activities           │
│ - Update plan status                │
└─────────────────────────────────────┘
```

## API Endpoints

### POST /api/cadg/email/suggest

**Request:**
```json
{
  "subject": "string",
  "body": "string",
  "customerId": "string | null"
}
```

**Response:**
```json
{
  "success": true,
  "suggestion": "string"
}
```

### POST /api/cadg/plan/:id/approve (Email Artifacts)

**Response when email:**
```json
{
  "success": true,
  "isPreview": true,
  "preview": {
    "to": ["email@example.com"],
    "cc": [],
    "subject": "Email subject",
    "body": "Email body content",
    "customer": {
      "id": "customer-id",
      "name": "Customer Name",
      "healthScore": 85,
      "renewalDate": "2026-03-15"
    }
  },
  "planId": "plan-id"
}
```

### POST /api/cadg/email/send

**Request:**
```json
{
  "planId": "string",
  "to": ["string"],
  "cc": ["string"],
  "subject": "string",
  "body": "string",
  "customerId": "string | null"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "gmail-message-id",
  "sentAt": "2026-02-01T10:30:00Z"
}
```

## Files

| File | Purpose |
|------|---------|
| `components/AIPanel/CADGEmailPreview.tsx` | Email preview/edit modal |
| `components/AIPanel/CADGPlanCard.tsx` | Integration with plan approval flow |
| `server/src/routes/cadg.ts` | API endpoints for suggest and send |
| `server/src/services/cadg/reasoningEngine.ts` | generateSuggestion function |
| `server/src/services/cadg/artifactGenerator.ts` | generateEmailPreview function |

## Component Props

### CADGEmailPreview

```typescript
interface CADGEmailPreviewProps {
  email: {
    to: string[];
    cc: string[];
    subject: string;
    body: string;
  };
  customer: {
    id: string;
    name: string;
    healthScore?: number;
    renewalDate?: string;
  };
  onSend: (email: EmailData) => Promise<void>;
  onCancel: () => void;
}
```

## User Flow

1. User asks CADG to draft an email
2. CADG creates execution plan with `taskType: 'email_drafting'`
3. User clicks "Approve" on plan card
4. Instead of sending, **Email Preview modal appears**
5. User can:
   - Edit To, CC, Subject, Body fields
   - Click "Get Claude Suggestions" for AI improvements
   - Apply or dismiss suggestions
6. User clicks "Send Email"
7. Email sent via Gmail API
8. Activity logged to customer timeline
9. Modal closes, plan card shows "Completed"

## Status

✅ Complete - All 8 user stories implemented

- US-001: CADGEmailPreview component ✅
- US-002: State management ✅
- US-003: Claude suggestions UI ✅
- US-004: Suggestions API endpoint ✅
- US-005: Preview mode in approval ✅
- US-006: CADGPlanCard integration ✅
- US-007: Email send endpoint ✅
- US-008: Success/error handling ✅
