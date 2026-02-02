# CADG Meeting Prep HITL Preview

## Overview

Transform CADG meeting preparation from auto-generation to an interactive Human-in-the-Loop (HITL) workflow. Users can review, edit, enhance with AI, and approve meeting prep briefs before they're finalized.

## Problem Statement

Currently when CADG generates meeting preparation briefs, they're presented as static markdown. Users want to:
- Review the meeting prep content before finalizing
- Edit talking points and agenda items
- Get AI suggestions for additional discussion topics
- Add/remove sections based on meeting context
- Save the finalized prep to their Google Drive or export as PDF

## User Stories

### US-001: Create CADGMeetingPrepPreview component shell

**As a user**, I want to see a preview modal for CADG-generated meeting prep with editable sections.

**Acceptance Criteria:**
- Create `components/AIPanel/CADGMeetingPrepPreview.tsx`
- Component accepts props: meetingPrep (title, attendees, agenda, talkingPoints, risks, context), customer, onSave, onCancel
- Display meeting title as editable input
- Display attendees as editable comma-separated list
- Display agenda items as editable list with add/remove
- Display talking points as editable list with add/remove
- Display risks/concerns section
- Display customer context summary (read-only)
- Include Cancel and Save Meeting Prep buttons
- Style with Tailwind matching CADGEmailPreview
- Typecheck passes

### US-002: Add meeting prep state management

**As a developer**, I need state management for tracking edits and modifications to the meeting prep.

**Acceptance Criteria:**
- Add useState for draft fields (title, attendees, agenda, talkingPoints, risks)
- Add useState for original fields to track modifications
- Add isModified computed value comparing draft to original
- Add isSaving loading state
- Add error state for save failures
- Support adding/removing agenda items dynamically
- Support adding/removing talking points dynamically
- Warn user when closing with unsaved changes
- Typecheck passes

### US-003: Add Claude suggestions for meeting prep

**As a user**, I want to get AI suggestions to improve my meeting prep.

**Acceptance Criteria:**
- Add "Suggest More Talking Points" button
- Add "Suggest Agenda Items" button
- Buttons call POST `/api/cadg/meeting-prep/suggest` with context
- Display loading spinner while fetching suggestions
- Show suggestions in a card with Apply All / Dismiss buttons
- Apply All appends suggestions to existing list
- Individual suggestions can be applied or dismissed
- Typecheck passes

### US-004: Create meeting prep suggestions API endpoint

**As a developer**, I need a backend endpoint that generates Claude suggestions for meeting prep.

**Acceptance Criteria:**
- Add POST `/api/cadg/meeting-prep/suggest` route in `server/src/routes/cadg.ts`
- Accept body: { suggestionType: 'agenda' | 'talking_points', currentItems, customerId, meetingContext }
- Fetch customer context using contextAggregator
- Call Claude with prompt asking for additional items
- Return { suggestions: string[] } response
- Handle errors gracefully with 500 status
- Typecheck passes

### US-005: Modify CADG plan approval for meeting prep preview mode

**As a user**, when I approve a meeting prep plan, I want to see the preview instead of static output.

**Acceptance Criteria:**
- Modify POST `/api/cadg/plan/:id/approve` in `server/src/routes/cadg.ts`
- When task type is 'meeting_prep', return preview data instead of markdown
- Response includes: title, attendees, agenda, talkingPoints, risks, customerContext
- Use actual customer data and meeting context
- Add isMeetingPrepPreview: true flag to response
- Other task types continue with current flow
- Typecheck passes

### US-006: Integrate meeting prep preview into CADGPlanCard

**As a user**, clicking approve on a meeting prep plan should show the preview modal.

**Acceptance Criteria:**
- Modify `components/AIPanel/CADGPlanCard.tsx`
- Add showMeetingPrepPreview state boolean
- Add meetingPrepPreviewData state to hold preview response
- When approval response has isMeetingPrepPreview: true, show CADGMeetingPrepPreview
- Pass onSave callback that calls meeting prep save endpoint
- Pass onCancel callback that closes preview and resets state
- Typecheck passes

### US-007: Create meeting prep save endpoint

**As a developer**, I need an endpoint to save the finalized meeting prep.

**Acceptance Criteria:**
- Add POST `/api/cadg/meeting-prep/save` route in `server/src/routes/cadg.ts`
- Accept body: { planId, title, attendees, agenda, talkingPoints, risks, customerId, saveToGoogle }
- If saveToGoogle: Create Google Doc with meeting prep content
- Save to customer's Meetings folder in Drive
- Update execution_plans status to 'completed'
- Record activity in agent_activities table
- Return { success: true, documentId?, documentUrl?, savedAt }
- Support downloading as markdown/PDF without saving to Google
- Typecheck passes

### US-008: Handle save success and error states

**As a user**, I want clear feedback when my meeting prep is saved or if saving fails.

**Acceptance Criteria:**
- Show loading spinner on Save button while saving
- Disable all inputs during save
- Show save options: "Save to Google Drive" and "Download as PDF"
- On success: close preview modal
- On success: update plan card to show 'Completed' status
- On error: show error message in red
- On error: keep modal open so user can retry
- Typecheck passes

## Technical Notes

### Meeting Prep Structure
```typescript
interface MeetingPrepData {
  title: string;
  attendees: string[];
  agenda: AgendaItem[];
  talkingPoints: TalkingPoint[];
  risks: RiskItem[];
  customerContext: {
    healthScore?: number;
    renewalDate?: string;
    recentInteractions?: string[];
  };
}

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
```

### API Response for Meeting Prep Preview
```json
{
  "success": true,
  "isMeetingPrepPreview": true,
  "preview": {
    "title": "QBR Prep - Acme Corp",
    "attendees": ["john@acme.com", "sarah@acme.com"],
    "agenda": [
      { "id": "1", "topic": "Q4 Review", "duration": "15 min" },
      { "id": "2", "topic": "Roadmap Discussion", "duration": "20 min" }
    ],
    "talkingPoints": [
      { "id": "1", "point": "Celebrate 40% adoption increase" },
      { "id": "2", "point": "Address support ticket backlog" }
    ],
    "risks": [
      { "id": "1", "risk": "Renewal decision pending", "mitigation": "Confirm timeline with Sarah" }
    ],
    "customerContext": {
      "healthScore": 75,
      "renewalDate": "2026-04-15"
    }
  },
  "planId": "plan-id"
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `components/AIPanel/CADGMeetingPrepPreview.tsx` | CREATE | Meeting prep preview/edit modal |
| `components/AIPanel/CADGPlanCard.tsx` | MODIFY | Integration with plan approval flow |
| `server/src/routes/cadg.ts` | MODIFY | API endpoints for suggest and save |
| `server/src/services/cadg/reasoningEngine.ts` | MODIFY | generateMeetingPrepSuggestion function |
| `server/src/services/cadg/artifactGenerator.ts` | MODIFY | generateMeetingPrepPreview function |
