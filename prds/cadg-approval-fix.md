# PRD: CADG Plan Approval Fix

## Overview
Fix the CADG (Context-Aware Agentic Document Generation) plan approval flow to handle cases where no customer is selected (General Mode).

## Problem Statement
When a user creates a QBR or other document in "General Mode" (no customer selected), clicking "Approve & Generate" fails with "Failed to approve plan" error. The artifact generator requires a customer ID to create the Google Workspace folder structure.

## Current Behavior
1. User types "Create a QBR" in General Mode
2. CADG correctly detects generative request and creates execution plan
3. CADGPlanCard displays with plan details and Approve/Reject buttons
4. User clicks "Approve & Generate"
5. Request to POST /api/cadg/plan/:planId/approve fails
6. Error: "Failed to approve plan"

## Expected Behavior
1. If customer is selected: Create document in customer's Google Drive folder
2. If no customer (General Mode):
   - Option A: Create document in user's personal "CSCX Templates" folder
   - Option B: Generate a downloadable template without Google Drive integration
   - Option C: Show a customer picker before approving

## Technical Details

### Root Cause
In `server/src/services/cadg/artifactGenerator.ts`, the `generateQBRWithGoogleWorkspace` function requires a valid `customerId` to:
1. Create/get customer folder in Google Drive via `driveService.getOrCreateCustomerFolder()`
2. Fetch customer data for QBR content generation

### Affected Files
- `server/src/services/cadg/artifactGenerator.ts` - Main artifact generation logic
- `server/src/routes/cadg.ts` - Approval endpoint
- `components/AIPanel/CADGPlanCard.tsx` - Frontend approval UI
- `components/AgentControlCenter/index.tsx` - AgentControlCenter integration

## Proposed Solution

### Option A: Template Mode for General Use (Recommended)
When no customer is selected:
1. Generate a template document with placeholder data
2. Save to user's "CSCX Templates" folder in Google Drive
3. Show preview with template markers

### User Stories

#### US-001: Handle null customer in artifact generator
- Check if customerId is null before calling customer-specific functions
- If null, use generic template data instead of customer data
- Create folder at "CSCX Templates/{taskType}/" instead of customer folder
- Typecheck passes

#### US-002: Update CADGPlanCard to show template mode
- Detect when plan has no customer context
- Update card header to show "Template Mode"
- Approval button text changes to "Generate Template"
- Success message indicates template was created
- Typecheck passes, verify in browser

#### US-003: Add template data generation
- Create getTemplateData() function in artifactGenerator
- Returns placeholder company data (e.g., "ACME Corp", fake metrics)
- Use for all section content when customerId is null
- Typecheck passes

#### US-004: Create user templates folder in Drive
- Add getOrCreateUserTemplatesFolder(userId) to driveService
- Creates "CSCX Templates" folder if not exists
- Returns folder ID for artifact storage
- Typecheck passes

#### US-005: Update approval endpoint for template mode
- Modify POST /api/cadg/plan/:planId/approve
- Detect when plan.customer_id is null
- Call artifact generator with template flag
- Return appropriate success message
- Typecheck passes

## Acceptance Criteria
1. User can "Create a QBR" in General Mode without error
2. Generated template uses placeholder data
3. Template is saved to user's Google Drive "CSCX Templates" folder
4. Success message shows template was created with download link
5. Existing customer-specific flow continues to work unchanged

## Priority
P1 - Blocks core CADG functionality demo

## Dependencies
- Google Drive API access configured
- User has Google OAuth connected
- Existing CADG infrastructure (completed)
