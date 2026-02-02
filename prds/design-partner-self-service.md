# PRD: Design Partner Self-Service Onboarding

## Overview
Enable design partners to onboard their own customers into CSCX.AI through self-service tools. Design partners can upload contracts to start AI-powered onboarding or bulk import customers via CSV with a downloadable template.

## Problem Statement
Currently, design partners can only explore pre-seeded demo customers. To truly evaluate CSCX.AI for their organization, they need to:
1. Test the onboarding workflow with their actual contracts
2. Import their existing customer portfolio to see the platform in action
3. Experience the full value proposition with real-world data

## User Stories

### US-001: Contract Upload for Single Customer Onboarding
**Description:** As a design partner, I want to upload a customer contract to start an AI-powered onboarding flow.

**Acceptance Criteria:**
- "New Onboarding" button visible in Onboarding view for design partners
- Clicking opens contract upload modal
- Accepts PDF, DOCX, or plain text paste
- AI extracts: company name, ARR, contract dates, stakeholders, entitlements
- Creates new customer record with `is_demo = false` and `owner_id = current_user`
- Redirects to AI chat with extracted context pre-loaded
- Shows [SANDBOX] label to indicate this is their private data
- Typecheck passes
- Verify in browser using dev-browser skill

### US-002: CSV Template Download from Customer View
**Description:** As a design partner, I want to download a CSV template so I know the correct format for bulk import.

**Acceptance Criteria:**
- "Download Template" button in Customer List view header (for design partners)
- Downloads `cscx-customer-template.csv` with headers and 2 example rows
- Template columns: name, industry, arr, health_score, stage, renewal_date, csm_name, primary_contact_name, primary_contact_email, primary_contact_title
- Example rows show realistic sample data with clear placeholders
- Button styled as secondary action (not primary CTA)
- Typecheck passes

### US-003: CSV Bulk Customer Upload
**Description:** As a design partner, I want to upload a CSV file to import multiple customers at once.

**Acceptance Criteria:**
- "Import Customers" button in Customer List view header (for design partners)
- Opens file picker for CSV files only
- Validates CSV headers match expected columns
- Shows preview table of first 5 rows before import
- Displays validation errors inline (missing required fields, invalid data types)
- On confirm, creates customer records with `is_demo = false` and `owner_id = current_user`
- Shows success toast with count: "Imported X customers"
- New customers appear in list immediately
- Typecheck passes
- Verify in browser using dev-browser skill

### US-004: Design Partner Data Isolation
**Description:** As a design partner, my imported customers should be private and not visible to other users.

**Acceptance Criteria:**
- Add `owner_id` column to customers table (nullable, UUID references auth.users)
- Design partner uploaded customers have `owner_id = current_user_id`
- Query filter: design partners see `is_demo = true OR owner_id = current_user_id`
- Admins see all customers (no owner filter)
- Demo customers have `owner_id = NULL` (visible to all design partners)
- Typecheck passes

### US-005: Sandbox Label for User-Uploaded Data
**Description:** As a design partner, I should clearly see which customers are my private uploads vs shared demos.

**Acceptance Criteria:**
- Customer cards show badge: "DEMO" (orange) for demo customers, "YOUR DATA" (blue) for user uploads
- Customer detail view shows banner explaining data ownership
- AI chat context indicates when working with user-uploaded customer
- Clear visual distinction in all customer lists
- Typecheck passes
- Verify in browser using dev-browser skill

### US-006: Contract Extraction Results Preview
**Description:** As a design partner, I want to review extracted contract data before creating the customer.

**Acceptance Criteria:**
- After AI extracts contract data, show editable preview form
- Fields: Company Name, ARR, Contract Start/End, Stakeholders (editable list), Entitlements (editable list)
- "Edit" button to modify any extracted field
- "Confirm & Start Onboarding" button to proceed
- "Cancel" button to discard and return to upload
- Highlight low-confidence extractions (if available from AI)
- Typecheck passes
- Verify in browser using dev-browser skill

## Technical Implementation

### Database Migration
```sql
-- Add owner_id to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Index for efficient owner filtering
CREATE INDEX IF NOT EXISTS idx_customers_owner_id ON public.customers(owner_id);
```

### Customer Query Logic
```typescript
// In server/src/routes/customers.ts
const ADMIN_EMAILS = ['azizcamara2@gmail.com'];
const userEmail = req.headers['x-user-email'] as string;
const userId = req.headers['x-user-id'] as string;
const isAdmin = ADMIN_EMAILS.includes(userEmail?.toLowerCase());

let query = supabase.from('customers').select('*');

if (!isAdmin) {
  // Design partners see: demo customers OR their own uploads
  query = query.or(`is_demo.eq.true,owner_id.eq.${userId}`);
}
```

### CSV Template Format
```csv
name,industry,arr,health_score,stage,renewal_date,csm_name,primary_contact_name,primary_contact_email,primary_contact_title
"Acme Corp","Technology",250000,85,"active","2026-12-31","Jane Smith","John Doe","john@acme.com","VP Engineering"
"Example Inc","SaaS",150000,70,"onboarding","2027-06-30","","Sarah Connor","sarah@example.com","CTO"
```

### CSV Validation Rules
```typescript
const requiredFields = ['name', 'arr'];
const numericFields = ['arr', 'health_score'];
const enumFields = {
  stage: ['active', 'onboarding', 'at_risk', 'churned', 'expanding']
};
const dateFields = ['renewal_date'];
```

### Component Structure
```
components/
├── CustomerImport/
│   ├── CSVTemplateDownload.tsx    # Download template button
│   ├── CSVUploadModal.tsx         # Upload and preview modal
│   ├── CSVPreviewTable.tsx        # Preview with validation
│   └── ValidationErrors.tsx       # Error display component
├── ContractUpload/
│   └── ExtractionPreview.tsx      # Review extracted data
```

## API Endpoints

### POST /api/customers/import
- Accepts: `multipart/form-data` with CSV file
- Validates CSV format and data
- Creates customer records with owner_id
- Returns: `{ imported: number, errors: ValidationError[] }`

### GET /api/customers/template
- Returns: CSV file download with headers and examples
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="cscx-customer-template.csv"`

## UI/UX Specifications

### Customer List Header (Design Partners)
```
┌─────────────────────────────────────────────────────────────────┐
│  Customers                              [Download Template] [Import] │
├─────────────────────────────────────────────────────────────────┤
│  [Search...]                            Filter: All ▾           │
└─────────────────────────────────────────────────────────────────┘
```

### Customer Card Badges
```
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  [DEMO]  Acme Corp           │    │  [YOUR DATA]  My Customer    │
│  $250K ARR • 85% Health      │    │  $180K ARR • 72% Health      │
└──────────────────────────────┘    └──────────────────────────────┘
```

### CSV Import Modal Flow
```
Step 1: File Selection
┌─────────────────────────────────────────────┐
│        Import Customers from CSV            │
│                                             │
│    ┌───────────────────────────────────┐   │
│    │   📁 Drop CSV file here or click  │   │
│    │       to browse                    │   │
│    └───────────────────────────────────┘   │
│                                             │
│    Need the template? [Download it here]    │
│                                   [Cancel]  │
└─────────────────────────────────────────────┘

Step 2: Preview & Validate
┌─────────────────────────────────────────────┐
│        Review Import (12 customers)         │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Name          ARR       Stage       │   │
│  ├─────────────────────────────────────┤   │
│  │ Company A     $50,000   active      │   │
│  │ Company B     $120,000  onboarding  │   │
│  │ ⚠ Company C   invalid   -          │   │
│  │ Company D     $80,000   at_risk     │   │
│  │ ... and 8 more                      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ⚠ 1 row has errors (will be skipped)      │
│                                             │
│              [Cancel] [Import 11 Customers] │
└─────────────────────────────────────────────┘
```

## Success Metrics
- 50%+ of design partners upload at least one contract
- 30%+ of design partners import customers via CSV
- Average import size: 5-20 customers
- <5% import error rate after template usage
- 90%+ of contract extractions accepted without edits

## Security Considerations
- Validate file types strictly (CSV only for import, PDF/DOCX for contracts)
- Limit CSV file size (max 5MB)
- Rate limit imports (max 100 customers per import, 500 per day)
- Sanitize all imported data before database insert
- Ensure owner_id isolation at query level (defense in depth)

## Dependencies
- Existing contract parsing via Gemini (already implemented)
- Supabase for data storage
- x-user-email and x-user-id headers from AuthContext

## Non-Goals
- Team sharing of imported customers (each user's data is private)
- Customer data export
- Automatic CRM sync for design partners
- Real integrations (Salesforce, HubSpot) for design partners
