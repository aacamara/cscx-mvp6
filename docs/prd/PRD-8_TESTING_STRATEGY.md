# PRD-8: Comprehensive Testing Strategy

**Status**: 🔴 Not Started
**Priority**: P0 - Critical
**Last Updated**: 2026-02-01

---

## Goal

"Run every single test possible" and enforce it via CI.

---

## Testing Pyramid

```
        /\
       /  \  E2E Tests (Playwright)
      /----\  - Core user journeys
     /      \ - Cross-browser
    /--------\
   /          \ Integration Tests
  /  Service   \ - API contracts
 /   Tests      \ - DB interactions
/----------------\
|                 | Unit Tests
|  Pure Logic     | - Business rules
|  Utilities      | - Parsers, formatters
|_________________| - State machines
```

---

## Test Categories

### Unit Tests (Target: 80% coverage)
- Business logic (parsing, scoring, matching)
- Utility functions
- State transitions
- Validation schemas

**Tools:** Vitest

### Integration Tests
- API endpoint tests
- Database query tests
- External service mocks (Claude, Google APIs)
- Job queue tests

**Tools:** Vitest + Supertest

### E2E Tests
- Complete user journeys
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile viewport testing

**Tools:** Playwright

### Security Tests
- Dependency audit (`npm audit`)
- SAST scanning
- Permission boundary tests
- XSS/injection tests

**Tools:** npm audit, ESLint security plugin

---

## Test Suites

### PRD-0: Contract Parsing
```
tests/
  unit/
    contract-parser.test.ts
    confidence-scoring.test.ts
    entitlement-normalizer.test.ts
  integration/
    contract-upload-flow.test.ts
    entitlement-api.test.ts
  fixtures/
    msa-standard.pdf
    sow-with-amendments.pdf
    order-form-multi-line.docx
    scanned-contract.pdf
    google-doc-contract.txt
    complex-multi-product.pdf
  e2e/
    contract-parsing-flow.spec.ts
```

### PRD-1: Auth + Onboarding
```
tests/
  unit/
    invite-code-hash.test.ts
    rate-limiter.test.ts
  integration/
    oauth-flow.test.ts
    invite-validation.test.ts
    customer-import.test.ts
  e2e/
    login-with-invite.spec.ts
    onboarding-flow.spec.ts
    import-customers.spec.ts
```

### PRD-3: Agent Inbox
```
tests/
  unit/
    action-state-machine.test.ts
  integration/
    action-creation.test.ts
    approval-flow.test.ts
  e2e/
    agent-inbox-workflow.spec.ts
```

### PRD-4: Support Tickets
```
tests/
  integration/
    ticket-creation.test.ts
    prompt-generation.test.ts
  e2e/
    submit-support-ticket.spec.ts
```

### PRD-5: Admin Dashboard
```
tests/
  integration/
    metrics-aggregation.test.ts
    admin-permission.test.ts
  e2e/
    admin-dashboard.spec.ts
```

---

## CI Pipeline Integration

```yaml
# .github/workflows/ci.yml or cloudbuild.yaml equivalent
jobs:
  test:
    steps:
      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Unit tests
        run: npm run test:unit

      - name: Integration tests
        run: npm run test:integration

      - name: Security audit
        run: npm audit --audit-level=high

      - name: E2E tests
        run: npm run test:e2e

      - name: Coverage report
        run: npm run test:coverage
        # Fail if coverage < 70%
```

---

## Test Commands

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "vitest run --config vitest.unit.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:coverage": "vitest run --coverage",
    "test:all": "npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm audit",
    "test:watch": "vitest"
  }
}
```

---

## Coverage Requirements

| Category | Minimum |
|----------|---------|
| Overall | 70% |
| Critical paths (auth, payments) | 90% |
| API routes | 80% |
| Business logic | 85% |

---

## Fixture Requirements

### Contract Parsing Fixtures (6+ required)
1. Standard MSA (PDF)
2. SOW with amendments (PDF)
3. Order form with line items (DOCX)
4. Scanned contract (PDF - OCR test)
5. Google Doc contract
6. Complex multi-product agreement

Each fixture must have:
- Expected parsed output (JSON)
- Confidence thresholds
- Edge cases documented

---

## CI Gate Requirements

The following must pass before merge:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Lint clean
- [ ] Type check clean
- [ ] No high/critical vulnerabilities in dependencies
- [ ] Coverage >= 70%

---

## Definition of Done

- [ ] TEST_STRATEGY.md documented
- [ ] Unit test coverage >= 70%
- [ ] Integration tests for all services
- [ ] E2E tests for all core flows
- [ ] Contract parsing fixture tests (6+)
- [ ] Agent Inbox tests
- [ ] Support ticket tests
- [ ] Admin dashboard tests
- [ ] Security checks in CI
- [ ] CI blocks on test failures
- [ ] `npm run test:all` works locally and in CI
