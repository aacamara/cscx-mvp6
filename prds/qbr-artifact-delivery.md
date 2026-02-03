# PRD: QBR Artifact Delivery

## Overview
Enhance the post-generation experience for QBR artifacts with rich previews, download options, and data source exports.

## Problem Statement
After a QBR is generated, users need to:
1. See a summary of what was created
2. Access the document via direct link
3. Download the document locally
4. Export the underlying data sources (metrics, health scores, etc.) as CSV for further analysis

## User Stories

### US-001: Display artifact summary after generation
- After successful generation, show summary card in chat
- Include: document title, type, sections generated, data sources used
- Show thumbnail/preview if available
- Display generation timestamp and duration
- Typecheck passes

### US-002: Add direct link to generated artifact
- Include Google Drive/Slides link in success response
- Make link clickable and open in new tab
- Show appropriate icon (Slides, Sheets, Docs) based on artifact type
- Handle case where Drive permissions may prevent access
- Typecheck passes

### US-003: Add download button for artifacts
- Add "Download" button next to artifact link
- For Slides: export as PDF or PPTX
- For Sheets: export as XLSX or CSV
- For Docs: export as PDF or DOCX
- Use Google Drive export API
- Show download progress indicator
- Typecheck passes

### US-004: Export data sources as CSV
- Add "Export Data Sources" button
- Compile all data used in generation:
  - Customer metrics (health score, NPS, ARR, etc.)
  - Engagement data (DAU, feature adoption, etc.)
  - Risk signals and their sources
  - Knowledge base excerpts used
- Generate CSV with headers and data
- Trigger browser download
- Typecheck passes

### US-005: Create ArtifactSuccessCard component
- Create components/AIPanel/ArtifactSuccessCard.tsx
- Display artifact metadata, links, and action buttons
- Include summary of what was generated
- Show list of data sources with relevance scores
- Integrate download and export functionality
- Typecheck passes

## Acceptance Criteria
1. After QBR generation, user sees rich summary card
2. User can click link to open document in Google Drive
3. User can download document in multiple formats
4. User can export underlying data as CSV
5. All actions have loading states and error handling

## Priority
P2 - Enhances demo experience

## Dependencies
- CADG approval fix completed
- Google Drive API access
- Artifact generation working
