# CADG Document HITL Preview

## Overview

Human-in-the-Loop (HITL) workflow for CADG document generation. Instead of auto-creating documents in Google Docs, users can now review, edit, enhance with AI, and approve before creation.

## Features

### 1. Document Preview Modal (`components/AIPanel/CADGDocumentPreview.tsx`)
- Editable document title
- Dynamic sections with editable titles and content
- Add/remove sections dynamically
- Customer context display in header (name, health score)
- Modified indicator when draft differs from original
- Unsaved changes warning on cancel

### 2. Claude Suggestions (`POST /api/cadg/document/suggest`)
- "Get Claude Suggestions" button for each section
- Context-aware suggestions using customer data
- Apply/Dismiss suggestion workflow
- Suggestions integrate into section content

### 3. Preview Mode in Plan Approval
- When `taskType === 'document_creation'`, approval returns preview instead of creating
- Also triggers for queries containing "document", "success plan", "account plan"
- Response includes `isDocumentPreview: true` flag
- Full document content returned for editing

### 4. Document Save Endpoint (`POST /api/cadg/document/save`)
- Final save after user review
- Uses Google Docs API via existing OAuth
- Logs activity to customer timeline
- Updates plan status to 'completed'

## Architecture

```
User Request: "create a success plan"
         |
         v
+-----------------------------------------+
| POST /api/cadg/plan                     |
| Creates plan with taskType:             |
| 'document_creation'                     |
+-----------------------------------------+
         |
         v
+-----------------------------------------+
| POST /api/cadg/plan/:id/approve         |
| Detects document artifact               |
| Returns isDocumentPreview: true         |
+-----------------------------------------+
         |
         v
+-----------------------------------------+
| CADGDocumentPreview Component           |
| - Shows editable document               |
| - Get Claude Suggestions per section    |
| - Edit title and sections               |
| - Add/remove sections                   |
+-----------------------------------------+
         |
         v (User clicks Create Document)
+-----------------------------------------+
| POST /api/cadg/document/save            |
| - Create via Google Docs API            |
| - Log to agent_activities               |
| - Update plan status                    |
+-----------------------------------------+
```

## API Endpoints

### POST /api/cadg/document/suggest

**Request:**
```json
{
  "sectionTitle": "string",
  "sectionContent": "string",
  "documentTitle": "string",
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

### POST /api/cadg/plan/:id/approve (Document Artifacts)

**Response when document:**
```json
{
  "success": true,
  "isDocumentPreview": true,
  "preview": {
    "title": "Success Plan - Acme Corp",
    "sections": [
      { "id": "section-1", "title": "Executive Summary", "content": "..." },
      { "id": "section-2", "title": "Goals & Objectives", "content": "..." }
    ],
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

### POST /api/cadg/document/save

**Request:**
```json
{
  "planId": "string",
  "title": "string",
  "sections": [
    { "id": "string", "title": "string", "content": "string" }
  ],
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
| `components/AIPanel/CADGDocumentPreview.tsx` | Document preview/edit modal |
| `components/AIPanel/CADGPlanCard.tsx` | Integration with plan approval flow |
| `server/src/routes/cadg.ts` | API endpoints for suggest and save |
| `server/src/services/cadg/artifactGenerator.ts` | generateDocumentPreview function |

## Component Props

### CADGDocumentPreview

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

interface CustomerData {
  id: string;
  name: string;
  healthScore?: number;
  renewalDate?: string;
}

interface CADGDocumentPreviewProps {
  document: DocumentData;
  customer: CustomerData;
  onSave: (document: DocumentData) => Promise<void>;
  onCancel: () => void;
}
```

## User Flow

1. User asks CADG to create a document (success plan, account plan, etc.)
2. CADG creates execution plan with `taskType: 'document_creation'`
3. User clicks "Approve" on plan card
4. Instead of creating, **Document Preview modal appears**
5. User can:
   - Edit document title
   - Edit section titles and content
   - Add new sections
   - Remove sections
   - Click "Get Claude Suggestions" for AI improvements per section
   - Apply or dismiss suggestions
6. User clicks "Create Document"
7. Document created in Google Docs
8. Activity logged to customer timeline
9. Modal closes, plan card shows "Completed" with document link

## Document Types Supported

The preview automatically detects and adapts to these document types:
- **Success Plan** - Goals, metrics, timeline, resources
- **Account Plan** - Overview, strategy, growth opportunities
- **Onboarding Plan** - Timeline, milestones, training requirements
- **General Document** - Flexible structure

## Status

- Complete - All 8 user stories implemented

- US-001: CADGDocumentPreview component
- US-002: State management
- US-003: Claude suggestions UI
- US-004: Suggestions API endpoint
- US-005: Preview mode in approval
- US-006: CADGPlanCard integration
- US-007: Document save endpoint
- US-008: Success/error handling
