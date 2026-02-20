# CSCX.AI Security Rules

Rules for agents working on security-sensitive code.

## Authentication

- JWT verification via Supabase (`server/src/middleware/auth.ts`)
- Service role key used server-side only — NEVER exposed to clients
- Org resolution: `org_members` table → `workspace_members` fallback
- `x-organization-id` header accepted only from authenticated requests

## Authorization

- Every route MUST apply auth middleware
- Every query MUST use `applyOrgFilter` for org-scoped data
- Agent actions follow HITL approval matrix (see `docs/architecture/agent-system.md`)

## Data Isolation

- Organization-scoped queries via `orgFilter.ts` helpers
- Per-customer Google Workspace isolation via folder structure
- Agent context MUST NOT leak data across tenants
- LLM prompts MUST NOT include cross-tenant data

## Secrets Management

- API keys stored in environment variables, never in code
- `.env` files in `.gitignore`
- Cloud Run secrets injected via GCP Secret Manager
- GitHub Actions secrets for CI/CD

## Risk Classification

Changes to security-sensitive paths require maximum scrutiny.
See `.github/risk-policy.json` for the complete risk tier definitions.

**Critical paths** (human approval required):
- `server/src/middleware/auth.ts`
- `server/src/middleware/orgFilter.ts`
- `database/migrations/**/*.sql`

## Prohibited Actions

- Never add `@ts-ignore` to auth/security code
- Never bypass org filtering with raw queries
- Never expose stack traces in API error responses
- Never hardcode API keys or secrets
- Never modify `.github/risk-policy.json` without human approval
