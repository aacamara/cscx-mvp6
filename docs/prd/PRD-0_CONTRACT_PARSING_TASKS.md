# PRD-0: Contract Parsing - Task List

**PRD**: [PRD-0_CONTRACT_PARSING.md](./PRD-0_CONTRACT_PARSING.md)
**Status**: 🟡 In Progress
**Last Updated**: 2026-02-01

---

## Phase 1: Database Schema + Core API (Day 1) ✅

### Task 1.1: Create Database Migration ✅
- [x] Create migration file for contracts table enhancement (`067_prd0_contract_parsing.sql`)
- [x] Create migration file for entitlements table (enhanced with PRD-0 fields)
- [x] Create migration file for entitlement_edits table
- [x] Add indexes for performance
- [ ] Run migration locally
- [ ] Verify schema in Supabase

### Task 1.2: Contract Upload Endpoint ✅
- [x] Create `POST /api/contracts/upload` route (already existed)
- [x] Implement file validation (type, size)
- [x] Implement Supabase Storage upload
- [x] Create contract record in database
- [x] Return contract ID and status
- [x] Add Zod validation schema (partial - uses manual validation)

### Task 1.3: Contract Status Endpoint ✅
- [x] Create `GET /api/contracts/:id` route (already existed)
- [x] Return contract details and parsing status
- [x] Include entitlement count if parsed

---

## Phase 2: Text Extraction (Day 1-2) ✅

### Task 2.1: PDF Extraction Service ✅
- [x] Implement pdf-parse extraction (in `contractParser.ts`)
- [x] Handle multi-page documents
- [x] Return extracted text with metadata
- [x] Fallback to Gemini multimodal for complex PDFs

### Task 2.2: DOCX Extraction Service ✅
- [x] Implement mammoth extraction (in `contractParser.ts`)
- [x] Preserve section structure
- [x] Return extracted text with metadata

### Task 2.3: Google Docs Extraction ✅
- [x] Implement Google Docs API content fetch (in `contractParser.ts`)
- [x] Handle permission errors gracefully
- [x] Return extracted text
- [x] Support both URLs and document IDs

### Task 2.4: OCR Service (Best-Effort) ✅
- [x] Gemini multimodal as OCR fallback for scanned PDFs
- [x] Handles low-quality scans via multimodal
- [ ] Consider Tesseract.js for offline OCR (future enhancement)

### Task 2.5: Unified Extractor ✅
- [x] ContractParser routes to correct extractor based on file type
- [x] Handle errors uniformly
- [x] Update contract status on completion/failure

---

## Phase 3: Entitlement Parsing (Day 2) ✅

### Task 3.1: Claude Parsing Service ✅
- [x] Claude API call with extraction prompt (in `claude.ts`)
- [x] JSON schema for entitlements
- [x] Parse response into structured data

### Task 3.2: Confidence Scoring ✅
- [x] Implement confidence score calculation (in `contractParser.ts`)
- [x] Per-field confidence based on extraction certainty
- [x] Overall confidence aggregation

### Task 3.3: Entitlements Storage ✅
- [x] Create entitlement records from parsed data
- [x] Link to contract and customer
- [x] Set initial status to 'draft' (pending_review on edit)
- [x] Store confidence scores

### Task 3.4: Amendment Handling
- [ ] Detect amendment contract type
- [ ] Link to prior contract if referenced
- [ ] Flag overridden fields
- [ ] Preserve amendment chain

---

## Phase 4: HITL Review API (Day 3) ✅

### Task 4.1: Get Entitlements Endpoint ✅
- [x] Create `GET /api/entitlements` route
- [x] Filter by customer_id, contract_id, status
- [x] Include confidence scores
- [x] Paginate results

### Task 4.2: Update Entitlement Endpoint ✅
- [x] Create `PATCH /api/entitlements/:id` route
- [x] Validate field updates (Zod schema)
- [x] Create edit history record
- [x] Update status to 'pending_review'

### Task 4.3: Finalize Endpoint ✅
- [x] Create `POST /api/entitlements/:id/finalize` route
- [x] Increment version number
- [x] Set is_active flag
- [x] Deactivate previous active version
- [x] Update status to 'finalized'

### Task 4.4: Version History Endpoint ✅
- [x] Create `GET /api/entitlements/:id/history` route
- [x] Return all edits with timestamps
- [x] Include edit history per version

---

## Phase 5: HITL Review UI (Day 3)

### Task 5.1: Entitlements Table Component
- [ ] Create `components/Entitlements/EntitlementsTable.tsx`
- [ ] Display entitlements in sortable table
- [ ] Show confidence indicators
- [ ] Add filter controls
- [ ] Link to review modal

### Task 5.2: HITL Review Modal
- [ ] Create `components/Entitlements/EntitlementReviewModal.tsx`
- [ ] Split view: source text | form fields
- [ ] Editable form with validation
- [ ] Confidence badges per field
- [ ] Save Draft and Finalize buttons

### Task 5.3: Contract Upload in Chat
- [ ] Add file drop zone to chat input
- [ ] Handle file upload via existing mechanism
- [ ] Route contract files to contract upload endpoint
- [ ] Show parsing status in chat
- [ ] Add "Review Entitlements" action

### Task 5.4: Contract Upload in KB
- [ ] Add "Upload Contract" button to KB view
- [ ] Customer and contract type selectors
- [ ] File drop zone
- [ ] Progress indicator
- [ ] Navigate to review after parsing

---

## Phase 6: Chat Integration (Day 4)

### Task 6.1: Entitlements Agent Tool
- [ ] Create `get_customer_entitlements` tool
- [ ] Query finalized entitlements
- [ ] Format for chat response
- [ ] Include confidence info

### Task 6.2: Contract Search Tool
- [ ] Create `search_contracts` tool
- [ ] Full-text search on extracted text
- [ ] Return relevant sections
- [ ] Include citations

### Task 6.3: Update Orchestrator
- [ ] Register new tools
- [ ] Route entitlement queries appropriately
- [ ] Ensure citations in responses

### Task 6.4: Customer View Integration
- [ ] Add entitlements section to CustomerDetail
- [ ] Show active entitlements
- [ ] Link to full entitlements view
- [ ] Show renewal dates prominently

---

## Phase 7: Testing (Day 4-5)

### Task 7.1: Unit Tests
- [ ] Test PDF extraction
- [ ] Test DOCX extraction
- [ ] Test parsing logic
- [ ] Test confidence scoring
- [ ] Test version management

### Task 7.2: Integration Tests
- [ ] Test upload → parse → store flow
- [ ] Test HITL edit flow
- [ ] Test finalize flow
- [ ] Test chat query flow

### Task 7.3: Fixture Tests
- [ ] Create 6+ synthetic contract fixtures
- [ ] Test parsing accuracy per fixture
- [ ] Document expected vs actual

### Task 7.4: E2E Tests
- [ ] Test full chat upload flow
- [ ] Test KB upload flow
- [ ] Test HITL review flow
- [ ] Test chat entitlement queries

---

## Phase 8: Deployment (Day 5)

### Task 8.1: Staging Deploy
- [ ] Run migrations on staging
- [ ] Deploy code to staging
- [ ] Verify all endpoints work

### Task 8.2: Staging Smoke Tests
- [ ] Upload test contract
- [ ] Verify parsing completes
- [ ] Review and finalize entitlements
- [ ] Query via chat
- [ ] Check customer view

### Task 8.3: Production Deploy
- [ ] Run migrations on production
- [ ] Deploy code to production

### Task 8.4: Production Smoke Tests
- [ ] Repeat staging smoke tests
- [ ] Monitor for errors
- [ ] Verify performance

---

## Completion Checklist

- [ ] All tasks complete
- [ ] All tests passing
- [ ] Staging smoke tests pass
- [ ] Production smoke tests pass
- [ ] Documentation updated
- [ ] PRD-0 marked complete in PRODUCTION_READINESS.md

---

## Implementation Notes

### Files Created/Modified

1. **Migration**: `database/migrations/067_prd0_contract_parsing.sql`
   - Enhanced contracts table with PRD-0 fields
   - Enhanced entitlements table with versioning, status, confidence scores
   - Created entitlement_edits table for HITL audit trail
   - Added performance indexes

2. **Routes**: `server/src/routes/entitlements.ts` (NEW)
   - GET /api/entitlements - List with filters
   - GET /api/entitlements/:id - Single entitlement
   - PATCH /api/entitlements/:id - HITL update
   - POST /api/entitlements/:id/finalize - Finalize
   - GET /api/entitlements/:id/history - Version history

3. **Services**: `server/src/services/supabase.ts` (ENHANCED)
   - listEntitlements()
   - getEntitlement()
   - updateEntitlement()
   - saveEntitlementEdit()
   - getEntitlementEdits()
   - finalizeEntitlement()
   - getEntitlementVersionHistory()

4. **Parser**: `server/src/services/contractParser.ts` (ENHANCED)
   - Added Google Docs extraction support
   - extractGoogleDocId() helper

5. **Routes**: `server/src/routes/contracts.ts` (ENHANCED)
   - Added google_doc_url parameter support

6. **Index**: `server/src/index.ts` (ENHANCED)
   - Registered /api/entitlements routes
