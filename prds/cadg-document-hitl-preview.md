# CADG Document HITL Preview

## Overview

Transform CADG document generation from auto-creation to an interactive Human-in-the-Loop (HITL) workflow. Users can review, edit, enhance with AI, and approve documents before they're created in Google Docs.

## Problem Statement

Currently when CADG generates documents (success plans, account plans, onboarding plans, etc.), they're automatically created in Google Docs without user review. Users want to:
- Review document content before creation
- Edit sections and content inline
- Get AI suggestions for improvement
- Approve the final version before it goes to Google Docs

## User Stories

### US-001: Create CADGDocumentPreview component shell

**As a user**, I want to see a preview modal for CADG-generated documents with editable sections.

**Acceptance Criteria:**
- Create `components/AIPanel/CADGDocumentPreview.tsx`
- Component accepts props: document (title, sections), customer (id, name), onSave, onCancel
- Display editable input for document title
- Display editable sections with title and content fields
- Each section content is a rich textarea with min-height 150px
- Show customer name in header
- Include Cancel and Create Document buttons
- Style with Tailwind matching CADGEmailPreview
- Typecheck passes

### US-002: Add document preview state management

**As a developer**, I need state management for tracking edits and modifications to the document preview.

**Acceptance Criteria:**
- Add useState for draft fields (title, sections array)
- Add useState for original fields to track modifications
- Add isModified computed value comparing draft to original
- Add isSaving loading state
- Add error state for save failures
- Warn user when closing with unsaved changes (window.confirm)
- Support adding/removing sections dynamically
- Typecheck passes

### US-003: Add Claude suggestions for documents

**As a user**, I want to get AI suggestions to improve my document sections before saving.

**Acceptance Criteria:**
- Add "Get Claude Suggestions" button for each section
- Button calls POST `/api/cadg/document/suggest` with section content and customer context
- Display loading spinner while fetching suggestion
- Show suggestion in a card with border-blue-500 styling below the section
- Include Apply and Dismiss buttons on suggestion card
- Apply button merges suggestion into section content
- Dismiss button hides the suggestion card
- Typecheck passes

### US-004: Create document suggestions API endpoint

**As a developer**, I need a backend endpoint that generates Claude suggestions for document improvement.

**Acceptance Criteria:**
- Add POST `/api/cadg/document/suggest` route in `server/src/routes/cadg.ts`
- Accept body: { sectionTitle, sectionContent, documentTitle, customerId }
- Fetch customer context using contextAggregator
- Call Claude with prompt asking for section improvement suggestions
- Return { suggestion: string } response
- Handle errors gracefully with 500 status
- Typecheck passes

### US-005: Modify CADG plan approval for document preview mode

**As a user**, when I approve a document plan, I want to see the preview instead of immediately creating.

**Acceptance Criteria:**
- Modify POST `/api/cadg/plan/:id/approve` in `server/src/routes/cadg.ts`
- When task type is 'document_creation', return preview data instead of creating
- Response includes: title, sections array (each with title, content), customer context
- Use actual customer data from database
- Add isDocumentPreview: true flag to response
- Other artifact types continue with current flow
- Typecheck passes

### US-006: Integrate document preview into CADGPlanCard

**As a user**, clicking approve on a document plan should show the preview modal.

**Acceptance Criteria:**
- Modify `components/AIPanel/CADGPlanCard.tsx`
- Add showDocumentPreview state boolean
- Add documentPreviewData state to hold preview response
- When approval response has isDocumentPreview: true, set states and show CADGDocumentPreview
- Pass onSave callback that calls new document save endpoint
- Pass onCancel callback that closes preview and resets state
- Typecheck passes

### US-007: Create document save endpoint

**As a developer**, I need an endpoint to create the finalized document after user review.

**Acceptance Criteria:**
- Add POST `/api/cadg/document/save` route in `server/src/routes/cadg.ts`
- Accept body: { planId, title, sections, customerId, outputFormat }
- Create document via Google Docs API using existing integration
- Save to customer's folder in Drive
- Update execution_plans status to 'completed'
- Record activity in agent_activities table
- Return { success: true, documentId, documentUrl, savedAt }
- Handle Google API errors with meaningful error messages
- Typecheck passes

### US-008: Handle save success and error states

**As a user**, I want clear feedback when my document is created or if creation fails.

**Acceptance Criteria:**
- Show loading spinner on Create Document button while saving
- Disable all inputs during save
- On success: close preview modal
- On success: update plan card to show 'Completed' status with document link
- On error: show error message in red below save button
- On error: keep modal open so user can retry
- Typecheck passes

## Technical Notes

### Document Structure
```typescript
interface DocumentSection {
  id: string;
  title: string;
  content: string;
}

interface DocumentData {
  title: string;
  sections: DocumentSection[];
}
```

### API Response for Document Preview
```json
{
  "success": true,
  "isDocumentPreview": true,
  "preview": {
    "title": "Success Plan - Acme Corp",
    "sections": [
      { "id": "1", "title": "Executive Summary", "content": "..." },
      { "id": "2", "title": "Goals & Objectives", "content": "..." },
      { "id": "3", "title": "Timeline", "content": "..." }
    ],
    "customer": {
      "id": "customer-id",
      "name": "Acme Corp",
      "healthScore": 85
    }
  },
  "planId": "plan-id"
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `components/AIPanel/CADGDocumentPreview.tsx` | CREATE | Document preview/edit modal |
| `components/AIPanel/CADGPlanCard.tsx` | MODIFY | Integration with plan approval flow |
| `server/src/routes/cadg.ts` | MODIFY | API endpoints for suggest and save |
| `server/src/services/cadg/reasoningEngine.ts` | MODIFY | generateDocumentSuggestion function |
| `server/src/services/cadg/artifactGenerator.ts` | MODIFY | generateDocumentPreview function |
