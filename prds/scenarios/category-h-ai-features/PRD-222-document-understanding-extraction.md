# PRD-222: Document Understanding & Extraction

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-222 |
| **Title** | Document Understanding & Extraction |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs deal with various customer documents: contracts, proposals, SOWs, support tickets exports, and custom reports. Manually extracting relevant information from these documents is time-consuming and error-prone. AI should automatically understand document types, extract structured data, and integrate findings into the customer record.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to upload any document and have AI extract relevant customer information.
2. **As a CSM**, I want extracted data automatically linked to the correct customer record.
3. **As a CSM**, I want to ask questions about uploaded documents ("What's the SLA guarantee?").
4. **As a CSM**, I want to compare documents ("What changed from the last contract?").
5. **As a CSM**, I want key information highlighted without reading entire documents.

### Secondary User Stories
1. **As a CSM**, I want documents automatically categorized (contract, proposal, invoice, etc.).
2. **As a CSM**, I want alerts when document content conflicts with system data.
3. **As a CS Leader**, I want standardized data extraction across all customer documents.

## Acceptance Criteria

### Core Functionality
- [ ] Support for PDF, Word, Excel, image files (JPG, PNG)
- [ ] Automatic document type classification
- [ ] Structured data extraction based on document type
- [ ] Natural language Q&A about document content
- [ ] Document comparison and diff highlighting

### Document Types Supported
- [ ] Contracts (MSA, order forms, amendments)
- [ ] Proposals and quotes
- [ ] Statements of Work (SOW)
- [ ] Invoices and payment records
- [ ] Support ticket exports
- [ ] Meeting notes and agendas
- [ ] Product feedback compilations
- [ ] Compliance/security questionnaires

### Extraction Capabilities
- [ ] Named entity recognition (companies, people, dates, amounts)
- [ ] Table extraction with structure preservation
- [ ] Key term identification
- [ ] Obligation and commitment extraction
- [ ] Timeline and milestone detection

## Technical Specification

### Architecture

```
Document Upload → Format Converter → Type Classifier → Extraction Pipeline → Schema Mapper → Database Integration
                                            ↓
                                    Vector Embedding (for Q&A)
```

### Document Processing Pipeline

#### 1. Format Handling

```typescript
interface DocumentInput {
  file_path: string;
  file_type: string;
  customer_id?: string;
  metadata?: Record<string, any>;
}

async function processDocument(input: DocumentInput): Promise<ProcessedDocument> {
  // Convert to text/structured format
  let content: DocumentContent;

  switch (input.file_type) {
    case 'pdf':
      content = await extractPDF(input.file_path);  // OCR if needed
      break;
    case 'docx':
      content = await extractWord(input.file_path);
      break;
    case 'xlsx':
      content = await extractExcel(input.file_path);
      break;
    case 'image':
      content = await extractImage(input.file_path);  // OCR
      break;
  }

  return { content, original_file: input.file_path };
}
```

#### 2. Document Type Classification

Using Claude for classification:

```typescript
const DOCUMENT_TYPES = [
  'contract', 'amendment', 'proposal', 'sow',
  'invoice', 'support_export', 'meeting_notes',
  'feedback', 'security_questionnaire', 'other'
];

async function classifyDocument(content: string): Promise<DocumentClassification> {
  const prompt = `
    Classify this document into one of these categories:
    ${DOCUMENT_TYPES.join(', ')}

    Document content (first 5000 chars):
    ${content.slice(0, 5000)}

    Provide:
    1. Primary classification
    2. Confidence (0-1)
    3. Reasoning
    4. Alternative classifications (if applicable)
  `;

  return await claude.analyze(prompt);
}
```

#### 3. Extraction Schema by Document Type

```typescript
interface ContractExtraction {
  parties: Party[];
  effective_date: Date;
  end_date: Date;
  auto_renewal: boolean;
  renewal_notice_days: number;
  contract_value: number;
  payment_terms: string;
  sla_terms: SLATerm[];
  entitlements: Entitlement[];
  obligations: Obligation[];
  termination_clauses: string[];
  key_contacts: Contact[];
}

interface SOWExtraction {
  project_name: string;
  scope: string[];
  deliverables: Deliverable[];
  timeline: Milestone[];
  pricing: PricingItem[];
  assumptions: string[];
  out_of_scope: string[];
  acceptance_criteria: string[];
}

interface InvoiceExtraction {
  invoice_number: string;
  invoice_date: Date;
  due_date: Date;
  amount: number;
  line_items: LineItem[];
  payment_status: string;
}
```

### API Endpoints

#### POST /api/documents/upload
```json
{
  "file": "base64 or file reference",
  "file_name": "contract_2026.pdf",
  "customer_id": "optional - will try to detect",
  "expected_type": "optional - contract"
}
```

Response:
```json
{
  "document_id": "uuid",
  "status": "processing",
  "estimated_time_seconds": 30
}
```

#### GET /api/documents/{id}
```json
{
  "document_id": "uuid",
  "file_name": "contract_2026.pdf",
  "document_type": "contract",
  "classification_confidence": 0.95,
  "customer_id": "uuid",
  "customer_name": "TechCorp Industries",
  "extraction": {
    "parties": [
      { "name": "TechCorp Industries", "role": "customer" },
      { "name": "Our Company", "role": "vendor" }
    ],
    "effective_date": "2026-01-01",
    "end_date": "2027-12-31",
    "contract_value": 150000,
    "payment_terms": "Net 30",
    "entitlements": [
      {
        "name": "Enterprise License",
        "quantity": 100,
        "unit": "seats"
      }
    ],
    "key_dates": [
      { "event": "Contract Start", "date": "2026-01-01" },
      { "event": "First QBR Due", "date": "2026-04-01" },
      { "event": "Renewal Notice Deadline", "date": "2027-09-30" }
    ]
  },
  "conflicts": [
    {
      "field": "contract_value",
      "document_value": 150000,
      "system_value": 120000,
      "severity": "high"
    }
  ],
  "processed_at": "2026-01-29T10:00:00Z"
}
```

#### POST /api/documents/{id}/ask
```json
{
  "question": "What is the SLA for support response times?"
}
```

Response:
```json
{
  "answer": "According to Section 5.2, the SLA guarantees: Critical issues - 1 hour response, High - 4 hours, Medium - 8 hours, Low - 24 hours.",
  "source_sections": ["Section 5.2 - Service Level Agreement"],
  "confidence": 0.92,
  "relevant_text": "5.2 Service Levels. Provider shall respond to Customer support requests..."
}
```

#### POST /api/documents/compare
```json
{
  "document_id_1": "uuid",
  "document_id_2": "uuid",
  "focus_areas": ["pricing", "terms", "entitlements"]
}
```

Response:
```json
{
  "comparison_summary": "The new contract increases the seat count from 75 to 100 and extends the term by 1 year. Pricing increased by 15%.",
  "differences": [
    {
      "field": "seat_count",
      "doc1_value": 75,
      "doc2_value": 100,
      "change": "+33%"
    },
    {
      "field": "annual_value",
      "doc1_value": 120000,
      "doc2_value": 150000,
      "change": "+25%"
    }
  ],
  "new_in_doc2": [
    "Premium support tier added",
    "API access included"
  ],
  "removed_in_doc2": [
    "60-day termination clause (now 90 days)"
  ]
}
```

### Database Schema

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  file_name TEXT NOT NULL,
  file_type VARCHAR(20),
  file_url TEXT,
  document_type VARCHAR(50),
  classification_confidence DECIMAL(3,2),
  raw_text TEXT,
  extraction JSONB,
  embedding vector(1536),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_conflicts (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  field_name VARCHAR(100),
  document_value TEXT,
  system_value TEXT,
  severity VARCHAR(20),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_customer ON documents(customer_id);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops);
```

## UI/UX Design

### Document Upload & Processing
```
┌─────────────────────────────────────────────────────────┐
│ DOCUMENT PROCESSING                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌───────────────────────────────────────────────────┐   │
│ │  📄 TechCorp_Contract_2026.pdf                    │   │
│ │  ███████████████████████░░░░░  Processing... 75% │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ ✓ Document uploaded                                     │
│ ✓ Text extracted                                        │
│ ✓ Document classified: Contract (95% confidence)        │
│ ⏳ Extracting structured data...                        │
│ ○ Checking for conflicts                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Document Analysis View
```
┌─────────────────────────────────────────────────────────┐
│ TechCorp_Contract_2026.pdf              CONTRACT        │
│ Uploaded: Jan 29, 2026 | 24 pages                       │
├─────────────────────────────────────────────────────────┤
│ [Summary] [Extracted Data] [Q&A] [Compare] [Raw Text]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ SUMMARY                                                 │
│ ────────                                                │
│ 2-year enterprise contract with TechCorp Industries     │
│ for $150,000 annually. Includes 100 seats, premium      │
│ support, and API access. Auto-renewal with 90-day       │
│ notice requirement.                                     │
│                                                         │
│ KEY DATES                                               │
│ ─────────                                               │
│ • Contract Start: Jan 1, 2026                           │
│ • Contract End: Dec 31, 2027                            │
│ • Renewal Notice By: Sep 30, 2027                       │
│                                                         │
│ EXTRACTED DATA                                          │
│ ──────────────                                          │
│ Value:        $150,000/year                             │
│ Term:         24 months                                 │
│ Seats:        100                                       │
│ Support:      Premium (SLA: 1hr critical)               │
│ Auto-Renewal: Yes (90-day notice)                       │
│                                                         │
│ ⚠️ CONFLICTS DETECTED                                   │
│ ─────────────────────                                   │
│ ARR in system: $120,000 | Document: $150,000            │
│ [Update System] [Ignore] [Flag for Review]              │
│                                                         │
│ ASK A QUESTION                                          │
│ ───────────────                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ What are the termination conditions?                │ │
│ └─────────────────────────────────────────────────────┘ │
│ [Ask]                                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- PDF processing library (pdf.js, pdfplumber)
- OCR service (for scanned documents)
- Claude API for extraction and Q&A
- Vector database (pgvector)
- Google Drive integration for storage

### Related PRDs
- PRD-003: PDF Contract Upload → Key Terms Extraction
- PRD-067: Contract Terms Quick Reference
- PRD-205: DocuSign Contract Management

## Success Metrics

### Quantitative
- Extraction accuracy > 90% on key fields
- Document processing time < 60 seconds
- Q&A relevance > 85%
- Manual data entry reduced by 70%

### Qualitative
- CSMs trust extracted data
- Document search is fast and accurate
- Conflict detection prevents data issues

## Rollout Plan

### Phase 1: Basic Extraction (Week 1-2)
- PDF text extraction
- Contract extraction schema
- Basic data mapping

### Phase 2: Classification (Week 3-4)
- Document type classifier
- Multiple extraction schemas
- Conflict detection

### Phase 3: Q&A (Week 5-6)
- Document Q&A capability
- Vector search
- Source citation

### Phase 4: Comparison (Week 7-8)
- Document comparison
- Change tracking
- OCR for images

## Open Questions
1. How do we handle multi-language documents?
2. What's the storage strategy for large document volumes?
3. Should we extract and store full text or just key sections?
4. How do we handle confidential document content?
