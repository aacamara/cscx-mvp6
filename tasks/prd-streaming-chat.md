# PRD: Streaming Chat Implementation

## Introduction

Implement Server-Sent Events (SSE) streaming for agent chat responses. Currently, users wait 30-60 seconds for responses with no feedback. This is a **CRITICAL UX BLOCKER** - users will abandon the product without real-time streaming.

## Goals

- Stream agent responses token-by-token to the UI
- Show typing indicators during agent thinking
- Display tool calls as they happen
- Reduce perceived latency from 60s to <1s for first token
- Handle connection drops gracefully

## User Stories

### US-001: Implement SSE endpoint
**Description:** As a system, chat responses should stream via Server-Sent Events.

**Acceptance Criteria:**
- [ ] Create `POST /api/agents/chat/stream` endpoint
- [ ] Return `Content-Type: text/event-stream`
- [ ] Stream tokens as `data: {"token": "Hello"}` events
- [ ] Send `data: {"done": true}` on completion
- [ ] Handle client disconnect (abort signal)
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-002: Stream Gemini responses
**Description:** As a system, Gemini API responses should stream to client.

**Acceptance Criteria:**
- [ ] Use `generateContentStream()` instead of `generateContent()`
- [ ] Forward each chunk to SSE response
- [ ] Maintain total token count for billing
- [ ] Handle stream errors gracefully
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-003: Stream Claude responses
**Description:** As a system, Claude API responses should stream to client.

**Acceptance Criteria:**
- [ ] Use Anthropic streaming API
- [ ] Forward each text delta to SSE response
- [ ] Handle thinking blocks (don't stream, just indicate)
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-004: Stream tool call events
**Description:** As a user, I want to see when agents use tools.

**Acceptance Criteria:**
- [ ] Send `data: {"type": "tool_start", "name": "draft_email", "params": {...}}` when tool called
- [ ] Send `data: {"type": "tool_end", "name": "draft_email", "result": {...}}` when complete
- [ ] Include tool execution duration
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-005: Update ChatPanel for streaming
**Description:** As a user, I want to see responses appear word-by-word.

**Acceptance Criteria:**
- [ ] Use `EventSource` or `fetch` with ReadableStream
- [ ] Append tokens to message as they arrive
- [ ] Show cursor/typing indicator during streaming
- [ ] Auto-scroll to bottom as content streams
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-006: Add cancel button
**Description:** As a user, I want to stop a long response.

**Acceptance Criteria:**
- [ ] Show "Stop" button while streaming
- [ ] Clicking stop aborts the fetch/EventSource
- [ ] Server detects disconnect and stops generation
- [ ] Message shows "[Stopped by user]" suffix
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-007: Handle connection errors
**Description:** As a user, I want graceful error handling for dropped connections.

**Acceptance Criteria:**
- [ ] Detect connection drop (offline, server restart)
- [ ] Show "Connection lost, retrying..." message
- [ ] Auto-retry with exponential backoff (1s, 2s, 4s)
- [ ] After 3 retries, show "Please refresh" error
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-008: Maintain message history
**Description:** As a system, streamed messages should be saved to database.

**Acceptance Criteria:**
- [ ] Save complete message to agent_messages after stream ends
- [ ] Include tool calls in message metadata
- [ ] Store token counts for analytics
- [ ] Run `npx tsc --noEmit` - exits with code 0

## Functional Requirements

- FR-1: First token must arrive within 2 seconds of request
- FR-2: Tool calls must be visible before their results
- FR-3: Stream must work on slow 3G connections
- FR-4: Multiple concurrent streams per user supported
- FR-5: Stream state survives page refresh (resume from history)

## Non-Goals

- No WebSocket implementation (SSE is simpler and sufficient)
- No voice streaming (future enhancement)
- No collaborative typing (single user per session)

## Technical Considerations

- Express requires `res.flushHeaders()` for SSE
- Use `res.write()` not `res.send()` for streaming
- Set `Cache-Control: no-cache` header
- Consider nginx buffering settings for production
- Test with slow network simulation

## Success Metrics

- Time to first token <2 seconds
- User abandonment during chat reduced by 80%
- No "request timeout" errors in production logs
