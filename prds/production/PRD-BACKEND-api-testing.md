# PRD: Backend API Testing & Fixes

## Overview
Verify all backend API endpoints work correctly and handle edge cases gracefully.

## Problem Statement
Before production, all API endpoints must:
- Return correct data with proper status codes
- Handle authentication and authorization
- Validate input and return meaningful errors
- Not expose sensitive information

## User Stories

### US-001: Test Customer List Endpoint
**Description:** As a developer, I need GET /api/customers to return correct data.

**Acceptance Criteria:**
- Returns 200 with array of customers
- Admin sees all customers
- Design partner sees only demo + own customers
- Includes customer fields: id, name, industry, arr, health_score, stage, is_demo, owner_id
- Typecheck passes

### US-002: Test Customer Detail Endpoint
**Description:** As a developer, I need GET /api/customers/:id to return full customer data.

**Acceptance Criteria:**
- Returns 200 with single customer object
- Returns 404 for non-existent customer
- Includes all customer fields and relationships
- Authorization check prevents access to others' data
- Typecheck passes

### US-003: Test Customer Creation Endpoint
**Description:** As a developer, I need POST /api/customers to create customers.

**Acceptance Criteria:**
- Returns 201 with created customer
- Validates required fields (name)
- Sets owner_id for design partners
- Handles duplicate names gracefully
- Typecheck passes

### US-004: Test Contract Parsing Endpoint
**Description:** As a developer, I need POST /api/contracts/parse to extract contract data.

**Acceptance Criteria:**
- Accepts multipart/form-data with file
- Returns extracted data: company name, ARR, stakeholders, entitlements
- Handles PDF and DOCX files
- Returns meaningful error for invalid files
- Includes confidence scores
- Typecheck passes

### US-005: Test CSV Import Endpoint
**Description:** As a developer, I need POST /api/customers/import-csv to bulk import.

**Acceptance Criteria:**
- Accepts multipart/form-data with CSV file
- Validates required fields (name, arr)
- Returns { imported: number, errors: array }
- Sets owner_id for imported customers
- Handles partial failures (some rows fail, others succeed)
- Typecheck passes

### US-006: Test Template Download Endpoint
**Description:** As a developer, I need GET /api/customers/template to download CSV template.

**Acceptance Criteria:**
- Returns 200 with Content-Type: text/csv
- Includes Content-Disposition header for download
- CSV has correct headers
- Includes 2 example rows
- Typecheck passes

### US-007: Test Auth Endpoints
**Description:** As a developer, I need authentication endpoints to work correctly.

**Acceptance Criteria:**
- POST /api/auth/validate-invite validates invite codes
- Returns { valid: true } for valid code, { valid: false, reason } for invalid
- Handles expired codes
- Handles max uses reached
- Typecheck passes

### US-008: Test Chat/LangChain Endpoint
**Description:** As a developer, I need POST /api/langchain/chat to handle AI conversations.

**Acceptance Criteria:**
- Accepts { message, customerId?, conversationId? }
- Returns AI response with context awareness
- Handles missing customer context gracefully
- Maintains conversation history
- Typecheck passes

## Technical Implementation

### API Test Script
```typescript
// Test helper
async function testEndpoint(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`http://localhost:3001${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json() };
}
```
