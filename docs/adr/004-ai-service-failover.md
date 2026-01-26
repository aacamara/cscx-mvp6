# ADR-004: AI Service Failover with Circuit Breakers

## Status
Accepted

## Context

CSCX.AI depends on external AI services (Claude, Gemini). These services can:
- Have outages
- Rate limit requests
- Experience latency spikes
- Return errors intermittently

A naive implementation would fail entirely when any AI service is down. We needed resilience.

## Decision

We implemented **Circuit Breakers + Automatic Failover**.

**Circuit Breaker Pattern:**
- Three states: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery)
- Opens after 5 consecutive failures
- Stays open for 30 seconds before testing
- Closes after 3 successful requests in HALF_OPEN

**Failover Chain:**
- Primary: Gemini 2.0 Flash (fast, cheap, good for most tasks)
- Fallback: Claude (better reasoning, used when Gemini circuit opens)
- Routing: Claude Haiku (always used for agent routing decisions)

**Per-Service Breakers:**
- `claude` - For Claude API calls
- `gemini` - For Gemini API calls
- `supabase` - For database calls

**Retry Logic:**
- Max 3 retries with exponential backoff
- Jitter to prevent thundering herd
- Only retries on transient errors (5xx, timeouts)

## Consequences

**Benefits:**
- System stays up even when one AI service is down
- Failed services recover automatically (no manual intervention)
- Prevents cascade failures from hammering failing services
- Observable via `/health` endpoint

**Drawbacks:**
- Added complexity in AI service wrappers
- Failover may use more expensive model (Claude vs Gemini)
- Circuit state is in-memory (resets on deploy)

**DO NOT remove circuit breakers** - They exist because we experienced real outages during development. Gemini had a 2-hour outage; circuit breaker kept the app running on Claude.

## Metadata
- **Subsystem:** services/ai, services/circuitBreaker
- **Key files:**
  - `server/src/services/circuitBreaker.ts` (circuit breaker implementation)
  - `server/src/services/retry.ts` (retry logic)
  - `server/src/services/gemini.ts` (Gemini with breaker)
  - `server/src/services/claude.ts` (Claude with breaker)
  - `server/src/services/health.ts` (exposes breaker status)
- **Related ADRs:** None
