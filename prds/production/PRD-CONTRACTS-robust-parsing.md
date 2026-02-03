# PRD: Robust Contract Parsing

## Overview
Ensure the contract parsing system can handle diverse contract formats from various industries, with varied entitlement structures, date formats, and stakeholder information.

## Problem Statement
Current contract parsing may fail or produce incomplete results for:
- Non-standard contract formats
- Industry-specific terminology
- Varied entitlement types (seats, usage, features, modules)
- Different date formats
- Missing or partial information

## User Stories

### US-001: Handle Multiple Entitlement Types
**Description:** As a CSM, I need the system to correctly parse entitlements regardless of how they're structured.

**Acceptance Criteria:**
- Parse seat-based entitlements (e.g., "50 user licenses")
- Parse usage-based entitlements (e.g., "10,000 API calls/month")
- Parse feature-based entitlements (e.g., "Premium Support included")
- Parse module-based entitlements (e.g., "Analytics Module, Reporting Module")
- Store all entitlement types in normalized format
- Typecheck passes

### US-002: Parse Various Date Formats
**Description:** As a CSM, I need contracts with different date formats to be parsed correctly.

**Acceptance Criteria:**
- Parse US format: MM/DD/YYYY
- Parse EU format: DD/MM/YYYY
- Parse ISO format: YYYY-MM-DD
- Parse written format: "January 1, 2026"
- Parse fiscal year references: "FY2026 Q1"
- Convert all to ISO format for storage
- Typecheck passes

### US-003: Extract Stakeholders from Various Formats
**Description:** As a CSM, I need stakeholder information extracted regardless of document structure.

**Acceptance Criteria:**
- Extract from signature blocks
- Extract from contact tables
- Extract from "Points of Contact" sections
- Extract from email mentions in body text
- Identify roles (Decision Maker, Technical Lead, Champion)
- Handle missing email/phone gracefully
- Typecheck passes

### US-004: Handle Missing Information Gracefully
**Description:** As a CSM, I need the system to work even with incomplete contracts.

**Acceptance Criteria:**
- If company name missing, prompt for input
- If ARR missing, allow manual entry
- If dates missing, set reasonable defaults
- If stakeholders missing, create empty list (not error)
- Show confidence scores for extracted fields
- Allow manual override of all fields
- Typecheck passes

### US-005: Industry-Specific Parsing
**Description:** As a CSM, I need contracts from different industries parsed correctly.

**Acceptance Criteria:**
- SaaS contracts: subscription terms, seats, features
- Enterprise contracts: multi-year, custom terms, SLAs
- Healthcare: HIPAA mentions, BAA references
- Finance: compliance terms, audit rights
- Map industry-specific terms to standard fields
- Typecheck passes

### US-006: Validate and Test Contract Parsing
**Description:** As a developer, I need tests that verify parsing works for diverse contracts.

**Acceptance Criteria:**
- Create test contracts for each scenario
- Test parsing returns expected structure
- Test error handling for malformed input
- Test confidence scoring accuracy
- All tests pass
- Typecheck passes

## Technical Implementation

### Enhanced Extraction Prompt
```typescript
const EXTRACTION_PROMPT = `
Extract the following from this contract:

1. Company Information:
   - Company name (required)
   - Industry (infer if not stated)

2. Financial Terms:
   - ARR/ACV (annual value)
   - Payment terms
   - Currency

3. Contract Period:
   - Start date (any format → ISO)
   - End date (any format → ISO)
   - Auto-renewal terms

4. Entitlements (normalize all types):
   - Type: seats | usage | feature | module | custom
   - Description
   - Quantity (if applicable)
   - Limits (if applicable)

5. Stakeholders:
   - Name
   - Role/Title
   - Email (if found)
   - Decision maker: yes/no

6. Confidence Scores (0-100):
   - company_name_confidence
   - arr_confidence
   - dates_confidence
   - stakeholders_confidence

Return JSON matching the ContractExtraction interface.
`;
```

### Normalized Entitlement Schema
```typescript
interface NormalizedEntitlement {
  type: 'seats' | 'usage' | 'feature' | 'module' | 'custom';
  description: string;
  quantity?: number;
  unit?: string;
  limit?: number;
  period?: 'monthly' | 'annual' | 'unlimited';
}
```
