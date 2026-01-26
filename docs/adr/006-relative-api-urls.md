# ADR-006: Relative API URLs for Frontend

## Status
Accepted

## Context

The frontend needs to call the backend API. Options:
1. **Hardcoded URL** - `http://localhost:3001` for dev, `https://prod.com` for prod
2. **Environment variable** - `VITE_API_URL` set at build time
3. **Relative URLs** - `/api/...` (works because same origin in production)

## Decision

We chose **relative URLs with empty fallback**.

**Pattern in components:**
```typescript
const API_URL = import.meta.env.VITE_API_URL || '';

// Results in:
// Dev (VITE_API_URL=http://localhost:3001): http://localhost:3001/api/customers
// Prod (VITE_API_URL=''): /api/customers (relative to current origin)
```

**Build commands:**
```bash
# Development
VITE_API_URL=http://localhost:3001 npm run dev

# Production build
VITE_API_URL="" npm run build
```

## Consequences

**Benefits:**
- No hardcoded production URLs in code
- Works with any deployment domain
- No CORS issues in production
- Single build works everywhere

**Drawbacks:**
- Must remember to set `VITE_API_URL=""` for production builds
- Local dev needs explicit URL (backend on different port)
- If build runs without env var, defaults to relative (usually correct)

**CRITICAL: Known Bug (Jan 2026)**

Some components had hardcoded `'http://localhost:3001'` as fallback instead of `''`:
```typescript
// BAD - breaks production
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// GOOD - works everywhere
const API_URL = import.meta.env.VITE_API_URL || '';
```

This caused CSP violations in production. Fixed in `GoogleConnectionWidget.tsx` but check any new components.

**When adding new API calls:**
1. Always use `import.meta.env.VITE_API_URL || ''`
2. Never hardcode localhost
3. Test production build locally before deploying

## Metadata
- **Subsystem:** frontend
- **Key files:**
  - `components/GoogleConnectionWidget.tsx` (was broken, now fixed)
  - `services/geminiService.ts`
  - `components/AIAssistant.tsx`
  - `components/AgentControlCenter/index.tsx`
- **Related ADRs:** ADR-005
