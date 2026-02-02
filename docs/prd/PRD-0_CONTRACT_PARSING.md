# PRD-0: Contract Parsing + Entitlements Normalization

**Priority**: TOP (Foundation for platform value)
**Status**: 🔴 Not Started
**Owner**: Claude Code (Principal Engineer)
**Created**: 2026-02-01

---

## 1. Goal

Enable the platform to ingest multiple contract types (PDF/DOCX/Google Docs), parse entitlements, normalize them into a structured table, and make them usable in chat + customer/observability views.

This is foundational because:
- Design partners need to see their customer entitlements
- Chat must answer questions about contracts and renewal terms
- Health scoring depends on entitlement utilization data

---

## 2. Scope

### In Scope
- Contract upload via Chat UI
- Contract upload via Knowledge Base UI
- PDF, DOCX, Google Docs text extraction
- Entitlements parsing and normalization
- HITL review UI for editing/confirming
- Entitlement versioning (history, active set)
- Chat queryable entitlements
- Scanned PDF OCR (best-effort)

### Out of Scope
- Contract generation/editing
- E-signature integration
- Amendment auto-merge (manual review)
- Multi-language contracts (English only MVP)

---

## 3. User Stories

### US-1: Upload Contract via Chat
**As a** CSM
**I want to** upload a contract file in the chat
**So that** the system can parse and track entitlements

**Acceptance Criteria:**
- Drag-drop or file picker in chat UI
- Supports PDF, DOCX, Google Docs links
- Shows upload progress and parsing status
- Creates Contract record linked to customer

### US-2: Upload Contract via KB
**As a** CSM
**I want to** upload contracts through the Knowledge Base UI
**So that** I can manage contracts alongside other documents

**Acceptance Criteria:**
- Upload button in KB view
- Customer selector for association
- Same parsing pipeline as chat upload

### US-3: View Parsed Entitlements
**As a** CSM
**I want to** see extracted entitlements in a structured table
**So that** I can verify and use the data

**Acceptance Criteria:**
- Entitlements table shows all extracted fields
- Confidence score per field
- Link to source contract
- Filter by customer, status, date

### US-4: HITL Review Entitlements
**As a** CSM
**I want to** review and correct extracted entitlements
**So that** only accurate data is used

**Acceptance Criteria:**
- Edit any extracted field
- Mark fields as "verified"
- "Finalize" button to publish
- Audit trail of changes

### US-5: Query Entitlements in Chat
**As a** CSM
**I want to** ask chat about entitlements
**So that** I get quick answers with citations

**Acceptance Criteria:**
- "What are Acme's entitlements?" returns structured answer
- "When does Acme's contract renew?" returns date
- "Do they have premium support?" returns yes/no with evidence
- Answers cite source contract

### US-6: Entitlement History
**As a** CSM
**I want to** see entitlement version history
**So that** I can track changes over time

**Acceptance Criteria:**
- Version list with timestamps
- Diff view between versions
- Mark one version as "active"
- Previous versions read-only

---

## 4. Functional Requirements

### 4.1 Contract Upload

| ID | Requirement |
|----|-------------|
| FR-1.1 | Support file upload via drag-drop and file picker |
| FR-1.2 | Accept PDF, DOCX, and Google Docs URL |
| FR-1.3 | Max file size: 50MB |
| FR-1.4 | Store original file in Supabase Storage |
| FR-1.5 | Associate contract with customer_id |
| FR-1.6 | Support contract types: MSA, SOW, Order Form, Amendment |

### 4.2 Text Extraction

| ID | Requirement |
|----|-------------|
| FR-2.1 | Extract text from PDF using pdf-parse |
| FR-2.2 | Extract text from DOCX using mammoth |
| FR-2.3 | Extract text from Google Docs via API |
| FR-2.4 | OCR for scanned PDFs using Tesseract (best-effort) |
| FR-2.5 | Handle multi-page documents |
| FR-2.6 | Preserve section structure where possible |

### 4.3 Entitlement Parsing

| ID | Requirement |
|----|-------------|
| FR-3.1 | Use Claude to extract entitlements with structured output |
| FR-3.2 | Extract: SKUs, quantities, limits, usage units |
| FR-3.3 | Extract: support tier, SLA terms |
| FR-3.4 | Extract: start date, end date, effective date, renewal terms |
| FR-3.5 | Extract: pricing tiers (if present) |
| FR-3.6 | Extract: special clauses, exclusions |
| FR-3.7 | Assign confidence score (0-1) per field |
| FR-3.8 | Handle amendments (flag override of prior terms) |

### 4.4 Data Model

| ID | Requirement |
|----|-------------|
| FR-4.1 | contracts table stores file reference + metadata |
| FR-4.2 | entitlements table keyed by customer_id + contract_id |
| FR-4.3 | entitlement_versions for history tracking |
| FR-4.4 | Status field: draft, pending_review, finalized |
| FR-4.5 | Confidence scores stored per field |

### 4.5 HITL Review

| ID | Requirement |
|----|-------------|
| FR-5.1 | Review UI shows all extracted fields |
| FR-5.2 | Inline editing for each field |
| FR-5.3 | Side-by-side view of source text and extracted data |
| FR-5.4 | "Finalize" creates new version, marks active |
| FR-5.5 | Finalized entitlements visible in customer view |

### 4.6 Chat Integration

| ID | Requirement |
|----|-------------|
| FR-6.1 | Agent tool: get_customer_entitlements(customer_id) |
| FR-6.2 | Agent tool: search_contracts(query) |
| FR-6.3 | Answers include citations to source contract |
| FR-6.4 | Support natural language queries about terms |

---

## 5. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Contract parsing latency | < 30 seconds for 50-page doc |
| NFR-2 | Extraction accuracy | > 85% on standard contracts |
| NFR-3 | File storage durability | 99.9% (Supabase default) |
| NFR-4 | API response time | < 500ms for entitlements query |
| NFR-5 | Concurrent uploads | Support 10 simultaneous |

---

## 6. Data Model Changes

### New Tables

```sql
-- Contracts table (enhanced)
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  workspace_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- pdf, docx, gdoc
  file_size INTEGER,
  contract_type TEXT, -- msa, sow, order_form, amendment
  status TEXT DEFAULT 'pending', -- pending, parsing, parsed, error
  extracted_text TEXT,
  parsed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entitlements table
CREATE TABLE entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id),
  customer_id UUID REFERENCES customers(id),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft', -- draft, pending_review, finalized

  -- Core fields
  sku TEXT,
  product_name TEXT,
  quantity INTEGER,
  quantity_unit TEXT,
  usage_limit INTEGER,
  usage_unit TEXT,

  -- Support
  support_tier TEXT,
  sla_response_time TEXT,
  sla_resolution_time TEXT,

  -- Dates
  start_date DATE,
  end_date DATE,
  effective_date DATE,
  renewal_date DATE,
  renewal_terms TEXT,
  auto_renew BOOLEAN,

  -- Pricing
  unit_price DECIMAL(12,2),
  total_price DECIMAL(12,2),
  currency TEXT DEFAULT 'USD',
  billing_frequency TEXT,

  -- Confidence scores (0-1)
  confidence_sku DECIMAL(3,2),
  confidence_quantity DECIMAL(3,2),
  confidence_dates DECIMAL(3,2),
  confidence_pricing DECIMAL(3,2),
  confidence_overall DECIMAL(3,2),

  -- Metadata
  special_clauses TEXT[],
  exclusions TEXT[],
  notes TEXT,
  source_section TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  finalized_by UUID
);

-- Entitlement edit history
CREATE TABLE entitlement_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id UUID REFERENCES entitlements(id),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edited_by UUID,
  edited_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contracts_customer ON contracts(customer_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_entitlements_customer ON entitlements(customer_id);
CREATE INDEX idx_entitlements_active ON entitlements(is_active) WHERE is_active = true;
```

---

## 7. API Contracts

### Upload Contract
```
POST /api/contracts/upload
Content-Type: multipart/form-data

Request:
- file: File (PDF, DOCX) or
- google_doc_url: string
- customer_id: string
- contract_type?: string

Response:
{
  "id": "uuid",
  "status": "parsing",
  "message": "Contract uploaded, parsing in progress"
}
```

### Get Contract Status
```
GET /api/contracts/:id

Response:
{
  "id": "uuid",
  "status": "parsed",
  "file_name": "contract.pdf",
  "contract_type": "msa",
  "entitlements_count": 5,
  "parsed_at": "2026-02-01T10:00:00Z"
}
```

### Get Entitlements
```
GET /api/entitlements?customer_id=uuid

Response:
{
  "entitlements": [
    {
      "id": "uuid",
      "contract_id": "uuid",
      "sku": "ENTERPRISE-PLAN",
      "product_name": "Enterprise License",
      "quantity": 100,
      "quantity_unit": "seats",
      "start_date": "2026-01-01",
      "end_date": "2027-01-01",
      "confidence_overall": 0.92,
      "status": "finalized"
    }
  ],
  "total": 5
}
```

### Update Entitlement (HITL)
```
PATCH /api/entitlements/:id

Request:
{
  "sku": "ENTERPRISE-PLAN-V2",
  "quantity": 150
}

Response:
{
  "id": "uuid",
  "updated_fields": ["sku", "quantity"],
  "status": "pending_review"
}
```

### Finalize Entitlements
```
POST /api/entitlements/:id/finalize

Response:
{
  "id": "uuid",
  "version": 2,
  "status": "finalized",
  "is_active": true,
  "finalized_at": "2026-02-01T10:30:00Z"
}
```

---

## 8. UI/UX Acceptance Criteria

### Chat Upload
- [ ] File drop zone visible in chat input area
- [ ] Progress indicator during upload
- [ ] "Parsing contract..." status message
- [ ] "Contract parsed. Found X entitlements." confirmation
- [ ] "Review entitlements" link/button

### KB Upload
- [ ] "Upload Contract" button in KB view
- [ ] Customer dropdown selector
- [ ] Contract type selector
- [ ] Drag-drop zone for file
- [ ] Upload progress indicator

### Entitlements Table
- [ ] Sortable columns
- [ ] Filter by customer, status, date range
- [ ] Confidence indicators (green/yellow/red)
- [ ] Link to source contract
- [ ] "Review" and "Finalize" buttons

### HITL Review Modal
- [ ] Split view: source text | extracted fields
- [ ] Editable form fields
- [ ] Field-level confidence scores
- [ ] "Save Draft" and "Finalize" buttons
- [ ] Confirmation dialog before finalize

---

## 9. Edge Cases

| Case | Handling |
|------|----------|
| Corrupted PDF | Return error, log for debugging |
| Scanned PDF with poor OCR | Flag low confidence, suggest manual review |
| Contract with no clear entitlements | Create contract record, empty entitlements, flag for review |
| Multi-currency pricing | Store currency per entitlement |
| Multiple effective dates | Create separate entitlement rows per date range |
| Amendment overrides | Link amendment to original, mark overridden fields |
| Duplicate upload | Detect by hash, prompt user to confirm |
| Very large file (>50MB) | Reject with clear error message |
| Unsupported format | Reject with supported formats list |

---

## 10. Test Plan

### Unit Tests
- [ ] PDF text extraction
- [ ] DOCX text extraction
- [ ] Entitlement parsing logic
- [ ] Confidence score calculation
- [ ] Version management logic

### Integration Tests
- [ ] Contract upload → storage → parse → DB
- [ ] HITL edit → version creation
- [ ] Finalize → active flag update
- [ ] Chat query → entitlement retrieval

### Fixture Tests (6+ contracts)
- [ ] Standard MSA with clear entitlements
- [ ] SOW with line items and pricing
- [ ] Order Form with seat counts
- [ ] Amendment overriding prior terms
- [ ] Contract with minimal information
- [ ] Scanned PDF (OCR test)

### E2E Tests
- [ ] Upload contract in chat → see parsed summary
- [ ] Review in HITL UI → edit fields → finalize
- [ ] Ask chat about entitlements → get accurate answer
- [ ] Check customer view shows entitlements

---

## 11. Rollout Plan

### Phase 1: Core Parsing (Day 1-2)
- Implement contract upload endpoints
- Implement text extraction
- Implement Claude-based parsing
- Create database schema

### Phase 2: HITL Review (Day 3)
- Build review UI component
- Implement edit/finalize flow
- Add version management

### Phase 3: Chat Integration (Day 4)
- Add agent tools for entitlements
- Update chat to show parsed summaries
- Add citation support

### Phase 4: Testing & Polish (Day 5)
- Run all tests
- Fix issues
- Deploy to staging
- Run smoke tests

---

## 12. Definition of Done

- [ ] All functional requirements implemented
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Fixture tests cover 6+ contract types
- [ ] HITL review UI complete and usable
- [ ] Chat queries return accurate answers
- [ ] Deployed to staging
- [ ] Staging smoke tests pass
- [ ] Deployed to production
- [ ] Production smoke tests pass
- [ ] Documentation updated
- [ ] Code reviewed (self-review)

---

## 13. Dependencies

- Supabase Storage (file upload)
- Claude API (parsing)
- pdf-parse library (PDF extraction)
- mammoth library (DOCX extraction)
- Google Docs API (Google Docs extraction)

---

## 14. Risks

| Risk | Mitigation |
|------|------------|
| Claude parsing accuracy | Iterate on prompts, use examples |
| Large file processing time | Async job queue, progress updates |
| OCR quality for scans | Set expectations, flag low confidence |
| Schema changes during dev | Use migrations, backwards compatible |

---

## Appendix: Example Parsing Prompt

```
You are a contract parsing expert. Extract all entitlements from the following contract text.

For each entitlement, extract:
- SKU or product identifier
- Product/service name
- Quantity and unit
- Usage limits
- Support tier and SLA terms
- Start date, end date, renewal date
- Pricing information
- Special clauses or exclusions

Return as JSON array with confidence scores (0-1) for each field.

Contract Text:
{contract_text}
```
