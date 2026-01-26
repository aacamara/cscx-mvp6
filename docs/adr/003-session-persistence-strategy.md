# ADR-003: Session Persistence Strategy

## Status
Accepted

## Context

Agent conversations need continuity. Users expect to resume where they left off. Without persistence:
- Server restarts lose all conversation history
- Users repeat context every session
- No cross-session learning possible

We considered:
1. **Pure in-memory** - Fast but ephemeral
2. **Redis** - Fast persistence but adds infrastructure
3. **Supabase (PostgreSQL)** - Already in stack, persistent, queryable
4. **Hybrid** - In-memory cache + Supabase persistence

## Decision

We chose **Hybrid: In-memory cache (30 min TTL) + Supabase persistence**.

**Session storage:**
- `agent_sessions` table - Session metadata, customer context
- `agent_messages` table - Full conversation history
- In-memory `sessionCache` Map - Hot sessions for fast access

**Key design choices:**

1. **Metadata in context column** - The `agent_sessions` table lacks a `metadata` column. Rather than migrate the schema, we store metadata inside the `context` JSONB column as `_metadata` key. This works but is a schema workaround.

2. **UUID validation** - Supabase expects UUID format for `user_id` and `customer_id`. Non-UUID values (like "test-user-123") are stored as `null` with originals preserved in `_metadata.original_user_id`.

3. **24-hour session expiry** - Sessions auto-expire after 24 hours of inactivity. Can be adjusted via `SESSION_EXPIRY_HOURS` env var.

4. **Message limit per retrieval** - `getConversationHistory()` defaults to last 20 messages to fit in LLM context window.

## Consequences

**Benefits:**
- Conversations survive server restarts
- Fast reads from cache for active sessions
- Queryable history for analytics
- Works with existing Supabase setup

**Drawbacks:**
- Cache invalidation complexity
- Schema workaround for metadata (should properly migrate)
- 24-hour expiry may be too short for some workflows

**Known issue (Jan 2026):** Session persistence code is ready but deployment broke due to unrelated frontend build issue. Backend works; needs frontend fix to redeploy.

## Metadata
- **Subsystem:** services/session
- **Key files:**
  - `server/src/services/session.ts` (SessionService class)
  - `server/src/routes/agents.ts` (session endpoints)
  - `server/src/routes/langchain.ts` (chat integration)
- **Related ADRs:** ADR-002
- **Database tables:** `agent_sessions`, `agent_messages`, `agent_actions`
