# CSCX.AI Test Strategy

**Version**: 1.0
**Last Updated**: 2026-02-02
**Status**: Active

## Overview

This document outlines the comprehensive testing strategy for CSCX.AI to ensure production readiness and maintain quality as the platform evolves.

## Test Pyramid

```
                    ┌─────────┐
                    │   E2E   │  (10%)
                    │  Tests  │
                   ─┴─────────┴─
                  ┌─────────────┐
                  │ Integration │  (30%)
                  │    Tests    │
                 ─┴─────────────┴─
                ┌─────────────────┐
                │   Unit Tests    │  (60%)
                │                 │
               ─┴─────────────────┴─
```

## Test Categories

### 1. Unit Tests

**Location**: `server/src/**/__tests__/*.test.ts`

**Coverage Areas**:
- Contract parsing logic
- Entitlement extraction
- Confidence score calculation
- Agent routing logic
- Utility functions

**Framework**: Vitest

**Run Command**:
```bash
cd server && npm run test:run
```

### 2. Integration Tests

**Location**: `server/src/**/__tests__/*.integration.test.ts`

**Coverage Areas**:
- API endpoint behavior
- Database operations
- Service interactions
- Authentication flows
- Agent orchestration

**Current Tests**:
- `api.integration.test.ts` - Health endpoints, CORS, request validation
- `contractParser.integration.test.ts` - Text extraction, MIME handling
- `agentic-agents.test.ts` - Agent routing, execution
- `agentic-e2e.test.ts` - Full agent flow
- `specialist-integration.test.ts` - Scheduler, Communicator, Researcher
- `entitlements.test.ts` - HITL workflow

### 3. E2E Tests

**Location**: `test-screenshots/`

**Coverage Areas**:
- Full user flows
- PRD acceptance criteria
- Visual regression

**Files**:
- `verify-all-prds.cjs` - Comprehensive PRD verification (25 checks)
- `test-new-views.cjs` - Frontend component verification

**Run Command**:
```bash
node test-screenshots/verify-all-prds.cjs
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run with coverage report |
| `npm run test:all` | Lint + typecheck + tests |

## Current Test Statistics

```
Test Files:  11 passed | 1 skipped (12)
Tests:       204 passed | 17 skipped (221)
Duration:    ~1.3s
```

## PRD Verification Checks (25 total)

### PRD-0: Contract Parsing
- [x] Migration file exists
- [x] GET /api/entitlements works

### PRD-1: Gated Login
- [x] POST /api/auth/validate-invite rejects invalid codes
- [x] POST /api/customers/import works

### PRD-2: Knowledge Base
- [x] POST /api/kb/sync works
- [x] GET /api/kb/search works
- [x] GET /api/kb/status works

### PRD-3: Agent Inbox
- [x] GET /api/actions works
- [x] GET /api/approvals endpoint exists
- [x] AgentActionsView.tsx exists

### PRD-4: Support Tickets
- [x] POST /api/support/tickets works
- [x] AI troubleshooting suggestions work
- [x] SupportTickets.tsx exists

### PRD-5: Admin Dashboard
- [x] GET /api/admin/overview works
- [x] AdminDashboard.tsx exists

### PRD-6: Health Checks
- [x] GET /health/live works
- [x] GET /health/ready works
- [x] GET /health works

### PRD-7: Error Handling
- [x] errorHandler.ts exists
- [x] 404 errors return proper status

### PRD-8: Test Infrastructure
- [x] npm run test:all exists
- [x] npm run test:run exists
- [x] npm run test:coverage exists

### PRD-9: Logging
- [x] logger.ts exists

### PRD-10: Security
- [x] Helmet middleware configured

## Test Data & Fixtures

### Contract Fixtures
Located in test files, covering:
- Standard MSA contracts
- SOW with line items
- Order forms with seat counts
- Amendments
- Minimal information contracts

### Mock Services
- Supabase client mocked for unit tests
- Claude/Gemini responses mocked
- Google Workspace APIs mocked

## CI/CD Integration

### Pre-merge Checks
1. `npm run lint` - ESLint
2. `npm run typecheck` - TypeScript
3. `npm run test:run` - All tests

### Deployment Gates
- All tests must pass
- No TypeScript errors
- No security vulnerabilities (npm audit)

## Adding New Tests

### Unit Test Template
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('FeatureName', () => {
  it('should do something', () => {
    // Arrange
    const input = {};

    // Act
    const result = featureFunction(input);

    // Assert
    expect(result).toBeDefined();
  });
});
```

### Integration Test Template
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('API Endpoint', () => {
  beforeAll(async () => {
    // Setup
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should handle request', async () => {
    const response = await fetch('/api/endpoint');
    expect(response.ok).toBe(true);
  });
});
```

## Coverage Targets

| Metric | Current | Target |
|--------|---------|--------|
| Lines | ~30% | 70% |
| Functions | ~40% | 70% |
| Branches | ~35% | 60% |
| Statements | ~30% | 70% |

## Maintenance

- Review test coverage monthly
- Update fixtures when data models change
- Add tests for every new feature
- Run full suite before releases
