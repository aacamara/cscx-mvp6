# CADG Meeting Prep HITL Preview

## Overview

Human-in-the-Loop (HITL) workflow for CADG meeting preparation. Instead of auto-generating static markdown, users can now review, edit, enhance with AI, and approve meeting prep briefs before saving.

## Features

### 1. Meeting Prep Preview Modal (`components/AIPanel/CADGMeetingPrepPreview.tsx`)
- Editable meeting title
- Editable attendees list (comma-separated)
- Dynamic agenda items with add/remove
- Dynamic talking points with add/remove
- Dynamic risks/concerns with add/remove
- Customer context display in header (name, health score)
- Modified indicator when draft differs from original
- Unsaved changes warning on cancel

### 2. Claude Suggestions (`POST /api/cadg/meeting-prep/suggest`)
- "Suggest Agenda" button for agenda items
- "Suggest Points" button for talking points
- Context-aware suggestions using customer data
- Apply All / Dismiss workflow for bulk actions
- Individual suggestion items can be added one at a time

### 3. Preview Mode in Plan Approval
- When `taskType === 'meeting_prep'`, approval returns preview instead of markdown
- Also triggers for queries containing "meeting prep", "prep for meeting"
- Response includes `isMeetingPrepPreview: true` flag
- Full meeting prep content returned for editing

### 4. Meeting Prep Save Endpoint (`POST /api/cadg/meeting-prep/save`)
- Final save after user review
- Creates Google Doc with formatted content
- Logs activity to customer timeline
- Updates plan status to 'completed'

## Architecture

```
User Request: "prep for my meeting with Acme"
         |
         v
+-----------------------------------------+
| POST /api/cadg/plan                     |
| Creates plan with taskType:             |
| 'meeting_prep'                          |
+-----------------------------------------+
         |
         v
+-----------------------------------------+
| POST /api/cadg/plan/:id/approve         |
| Detects meeting prep artifact           |
| Returns isMeetingPrepPreview: true      |
+-----------------------------------------+
         |
         v
+-----------------------------------------+
| CADGMeetingPrepPreview Component        |
| - Shows editable meeting prep           |
| - Suggest Agenda / Suggest Points       |
| - Edit title, attendees, items          |
| - Add/remove agenda, points, risks      |
+-----------------------------------------+
         |
         v (User clicks Save)
+-----------------------------------------+
| POST /api/cadg/meeting-prep/save        |
| - Create Google Doc with content        |
| - Log to agent_activities               |
| - Update plan status                    |
+-----------------------------------------+
```

## API Endpoints

### POST /api/cadg/meeting-prep/suggest

**Request:**
```json
{
  "suggestionType": "agenda" | "talking_points",
  "currentItems": ["existing item 1", "existing item 2"],
  "customerId": "string | null",
  "meetingContext": "Meeting with Acme Corp"
}
```

**Response:**
```json
{
  "success": true,
  "suggestions": ["Suggested item 1", "Suggested item 2", "Suggested item 3"]
}
```

### POST /api/cadg/plan/:id/approve (Meeting Prep)

**Response when meeting prep:**
```json
{
  "success": true,
  "isMeetingPrepPreview": true,
  "preview": {
    "title": "QBR Prep - Acme Corp",
    "attendees": ["john@acme.com", "sarah@acme.com"],
    "agenda": [
      { "id": "agenda-1", "topic": "Q4 Review" },
      { "id": "agenda-2", "topic": "Roadmap Discussion" }
    ],
    "talkingPoints": [
      { "id": "tp-1", "point": "Celebrate 40% adoption increase" },
      { "id": "tp-2", "point": "Address support ticket backlog" }
    ],
    "risks": [
      { "id": "risk-1", "risk": "Renewal decision pending" }
    ],
    "customer": {
      "id": "customer-id",
      "name": "Acme Corp",
      "healthScore": 75,
      "renewalDate": "2026-04-15"
    }
  },
  "planId": "plan-id"
}
```

### POST /api/cadg/meeting-prep/save

**Request:**
```json
{
  "planId": "string",
  "title": "string",
  "attendees": ["string"],
  "agenda": [{ "id": "string", "topic": "string" }],
  "talkingPoints": [{ "id": "string", "point": "string" }],
  "risks": [{ "id": "string", "risk": "string" }],
  "customerId": "string | null"
}
```

**Response:**
```json
{
  "success": true,
  "documentId": "google-doc-id",
  "documentUrl": "https://docs.google.com/...",
  "savedAt": "2026-02-01T10:30:00Z"
}
```

## Files

| File | Purpose |
|------|---------|
| `components/AIPanel/CADGMeetingPrepPreview.tsx` | Meeting prep preview/edit modal |
| `components/AIPanel/CADGPlanCard.tsx` | Integration with plan approval flow |
| `server/src/routes/cadg.ts` | API endpoints for suggest and save |
| `server/src/services/cadg/artifactGenerator.ts` | generateMeetingPrepPreview function |

## Component Props

### CADGMeetingPrepPreview

```typescript
interface AgendaItem {
  id: string;
  topic: string;
  duration?: string;
  notes?: string;
}

interface TalkingPoint {
  id: string;
  point: string;
  supporting?: string;
}

interface RiskItem {
  id: string;
  risk: string;
  mitigation?: string;
}

interface MeetingPrepData {
  title: string;
  attendees: string[];
  agenda: AgendaItem[];
  talkingPoints: TalkingPoint[];
  risks: RiskItem[];
}

interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGMeetingPrepPreviewProps {
  meetingPrep: MeetingPrepData;
  customer: CustomerData;
  onSave: (meetingPrep: MeetingPrepData) => Promise<void>;
  onCancel: () => void;
}
```

## User Flow

1. User asks CADG to prepare for a meeting
2. CADG creates execution plan with `taskType: 'meeting_prep'`
3. User clicks "Approve" on plan card
4. Instead of markdown output, **Meeting Prep Preview modal appears**
5. User can:
   - Edit meeting title
   - Edit attendee list
   - Add/remove/edit agenda items
   - Add/remove/edit talking points
   - Add/remove/edit risks
   - Click "Suggest Agenda" or "Suggest Points" for AI suggestions
   - Apply individual or all suggestions
6. User clicks "Save Meeting Prep"
7. Document created in Google Docs with formatted content
8. Activity logged to customer timeline
9. Modal closes, plan card shows "Completed" with document link

## Status

- Complete - All 8 user stories implemented

- US-001: CADGMeetingPrepPreview component
- US-002: State management
- US-003: Claude suggestions UI (agenda + talking points)
- US-004: Suggestions API endpoint
- US-005: Preview mode in approval
- US-006: CADGPlanCard integration
- US-007: Meeting prep save endpoint
- US-008: Success/error handling
