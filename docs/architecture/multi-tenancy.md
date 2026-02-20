# Multi-Tenancy Architecture

## Overview

CSCX.AI uses organization-scoped data isolation. Every database query is filtered by `organization_id` through middleware helpers.

## Core Files

- `server/src/middleware/auth.ts` - JWT verification + org resolution
- `server/src/middleware/orgFilter.ts` - Org-scoped query helpers

## Org Resolution Flow

1. JWT token verified via Supabase
2. `org_members` table checked (Phase 2+)
3. Falls back to `workspace_members` (Phase 1)
4. `x-organization-id` header accepted from authenticated frontend
5. `req.organizationId` set for all downstream handlers

## Query Helpers (orgFilter.ts)

| Helper | Purpose |
|--------|---------|
| `applyOrgFilter()` | Strict org filtering on queries |
| `applyOrgFilterInclusive()` | Org + shared (null) data |
| `withOrgId()` | Adds org_id to inserts |
| `filterInMemoryByOrg()` | In-memory filtering for fallback stores |

## Rules for New Code

1. Every new route MUST use auth middleware
2. Every database query MUST use `applyOrgFilter` or `applyOrgFilterInclusive`
3. Every insert MUST use `withOrgId` to set organization_id
4. Every new migration table MUST include `organization_id` column
5. No raw Supabase queries that bypass org filtering

## Per-Customer Workspace Isolation

Each customer gets an isolated Google Drive folder:

```
CSCX - {CustomerName}/
├── 01 - Onboarding/
├── 02 - Meetings/
├── 03 - QBRs/
├── 04 - Contracts/
└── 05 - Reports/
```
