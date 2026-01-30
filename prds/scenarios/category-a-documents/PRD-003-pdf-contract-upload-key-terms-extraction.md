# PRD-003: PDF Contract Upload → Key Terms Extraction

## Metadata
- **PRD ID**: PRD-003
- **Category**: A - Documents & Data Processing
- **Priority**: P0
- **Estimated Complexity**: Medium
- **Dependencies**: Contract parsing service, AI extraction engine

## Scenario Description
A CSM receives a new customer contract as a PDF and needs to quickly extract key terms including ARR, contract dates, entitlements, stakeholders, SLA terms, and auto-renewal clauses. The system uses AI to parse the PDF and extract structured data, presenting it for review and storage in the customer record.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload a PDF contract and have key terms automatically extracted,
**So that** I can quickly onboard customers without manually reading through lengthy contracts.

## Trigger
CSM uploads a PDF file via the Chat UI with a message like "Extract the key terms from this contract."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Contract document parsing | CAPABILITIES_INVENTORY.md | Implemented | PDF and plain text support |
| AI extraction | Claude/Gemini | Implemented | Extracts structured data |
| Contracts table | `contracts` table | Implemented | Stores parsed contract data |
| Entitlements table | `entitlements` table | Implemented | Stores contract entitlements |
| Stakeholders table | `stakeholders` table | Implemented | Stores contact information |
| Contract upload in onboarding | UnifiedOnboarding | Implemented | Basic flow exists |

### What's Missing
- [ ] Standalone contract upload via Chat UI (outside onboarding flow)
- [ ] Enhanced extraction for SLA terms, auto-renewal clauses
- [ ] Side-by-side PDF viewer with extracted data
- [ ] Extraction confidence scores per field
- [ ] Manual correction with AI learning

## Detailed Workflow

### Step 1: File Upload
**User Action**: CSM uploads PDF contract via Chat UI
**System Response**:
- Validates PDF file (not password protected, readable)
- Extracts text content from PDF
- Confirms receipt and begins analysis

### Step 2: AI Extraction
**User Action**: None (automatic)
**System Response**:
- AI analyzes contract text
- Extracts key terms into structured format
- Calculates confidence score for each extraction
- Displays results in formatted view

### Step 3: Review & Correct
**User Action**: CSM reviews extracted data, corrects any errors
**System Response**:
- Provides inline editing for each field
- Shows original PDF text that led to extraction
- Highlights low-confidence extractions
- Validates corrections against expected formats

### Step 4: Save & Link
**User Action**: CSM confirms extracted data
**System Response**:
- Creates/updates customer record
- Stores contract in contracts table
- Creates entitlement records
- Creates/links stakeholder records
- Uploads PDF to customer workspace in Drive

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/contracts/enhancedExtractor.ts` | Enhanced contract term extraction |
| `server/src/services/contracts/slaParser.ts` | SLA-specific term extraction |
| `components/Contract/ContractViewer.tsx` | Side-by-side PDF and data view |
| `components/Contract/ExtractionEditor.tsx` | Inline editing for extracted fields |
| `server/src/routes/contracts.ts` | Add standalone extraction endpoint |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/contracts/upload` | POST | Upload PDF for extraction |
| `POST /api/contracts/extract` | POST | Extract terms from uploaded PDF |
| `PUT /api/contracts/:id/corrections` | PUT | Save manual corrections |
| `POST /api/contracts/:id/confirm` | POST | Confirm and save to database |

### Extracted Fields
| Field | Type | Confidence Indicator |
|-------|------|---------------------|
| Company Name | String | High/Medium/Low |
| Contract ARR | Currency | High/Medium/Low |
| Contract Term | String | High/Medium/Low |
| Start Date | Date | High/Medium/Low |
| End Date | Date | High/Medium/Low |
| Auto-Renewal | Boolean + Terms | High/Medium/Low |
| Payment Terms | String | High/Medium/Low |
| SLA Commitments | Array | High/Medium/Low |
| Entitlements | Array | High/Medium/Low |
| Stakeholders | Array | High/Medium/Low |
| Technical Requirements | Array | High/Medium/Low |
| Termination Clause | String | High/Medium/Low |

## Chat UI Flow
```
CSM: [Uploads enterprise_agreement_acme.pdf] Extract key terms from this contract

System: 📄 Analyzing contract: enterprise_agreement_acme.pdf (12 pages)

Extracting key terms...

✅ Contract Analysis Complete

**Company Information**
- Company Name: Acme Corporation ✓ (High confidence)
- Industry: Technology (Detected from context)

**Financial Terms**
- Annual Contract Value: $125,000/year ✓ (High confidence)
- Payment Terms: Net 30 ⚠️ (Medium confidence - verify page 8)
- Billing Frequency: Annual, upfront

**Contract Dates**
- Start Date: January 1, 2026 ✓
- End Date: December 31, 2028 ✓
- Term Length: 36 months
- Auto-Renewal: Yes, 12-month periods unless cancelled 60 days prior ⚠️

**Entitlements**
| Item | Quantity | Unit Price |
|------|----------|------------|
| Enterprise License | 500 seats | $200/seat |
| Premium Support | 1 | $25,000/year |
| Implementation | 1 | Included |

**Key Stakeholders**
- Sarah Chen, VP of Operations (sarah.chen@acme.com) - Signatory
- Mike Johnson, IT Director (m.johnson@acme.com) - Technical Contact

**SLA Commitments**
- Uptime: 99.9% availability
- Support Response: 4 hours for critical issues
- Data Retention: 7 years

**⚠️ Items Requiring Attention**
1. Payment Terms (page 8) - Could be Net 30 or Net 45
2. Data residency clause mentioned but not clearly specified

Would you like me to:
[Save to Customer Record] [View Original PDF] [Edit Extracted Data]

CSM: The payment terms are Net 45, please correct that

System: Updated Payment Terms to "Net 45" ✓

Any other corrections needed?

CSM: Save to customer record

System: ✅ Contract saved!

- Created customer record: Acme Corporation
- Stored contract with ARR: $125,000
- Created 3 entitlement records
- Added 2 stakeholders
- Uploaded PDF to customer workspace: CSCX - Acme Corporation/04 - Contracts/

Next steps:
- Schedule kickoff meeting with stakeholders?
- Start onboarding workflow?
```

## Acceptance Criteria
- [ ] PDF uploads up to 50MB are supported
- [ ] Multi-page PDFs (up to 100 pages) are processed correctly
- [ ] Extraction completes within 60 seconds for typical contracts
- [ ] Confidence scores accurately reflect extraction reliability
- [ ] Low-confidence items are clearly highlighted for review
- [ ] Side-by-side view shows PDF page where data was extracted
- [ ] Manual corrections update extraction results immediately
- [ ] Saved contracts create proper records in all related tables
- [ ] PDF is uploaded to correct customer workspace folder
- [ ] Scanned PDFs with OCR are handled with appropriate warnings

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-003-COMPLETE</promise>
```

### Success Metrics
- Extraction accuracy > 90% for standard contract formats
- CSM correction rate < 15% of extracted fields
- Time savings: 15+ minutes per contract vs manual review
