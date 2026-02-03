# PRD: Agent Chat UI & Backend

## Introduction

The Agent Chat UI & Backend provides a modern, responsive chat interface for interacting with CSCX's multi-specialist AI agents. This includes the real-time chat experience, message streaming, tool execution visualization, approval workflows, and the backend infrastructure supporting agent orchestration, session management, and observability.

This is the core interaction paradigm for CSCX—where CSMs engage with AI agents to accomplish Customer Success tasks efficiently.

## Goals

- Deliver a fast, intuitive chat experience for agent interactions
- Support real-time message streaming with typing indicators
- Visualize tool calls and agent reasoning transparently
- Integrate approval workflows seamlessly into chat flow
- Enable agent switching and context preservation
- Provide robust backend for multi-agent orchestration

## User Stories

### US-001: Chat message input
**Description:** As a CSM, I want to send messages to agents so that I can request assistance.

**Acceptance Criteria:**
- [ ] Text input field with send button
- [ ] Enter to send, Shift+Enter for newline
- [ ] Message length limit indicator (4000 chars)
- [ ] Paste support for text and images
- [ ] Input disabled while agent is responding
- [ ] Draft auto-save to prevent message loss
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Message streaming
**Description:** As a CSM, I want to see agent responses stream in real-time so that I don't wait for long responses.

**Acceptance Criteria:**
- [ ] Text streams word-by-word as generated
- [ ] Cursor/typing indicator during streaming
- [ ] Smooth scrolling to keep latest content visible
- [ ] Cancel button to stop streaming mid-response
- [ ] Streaming works on slow connections
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Agent thinking indicator
**Description:** As a CSM, I want to see when agents are thinking so that I know the system is working.

**Acceptance Criteria:**
- [ ] "Thinking..." indicator with animated dots
- [ ] Show agent name that's thinking
- [ ] Duration timer (optional, for transparency)
- [ ] Expandable thinking preview (optional, show reasoning)
- [ ] Indicator disappears when response starts streaming
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Tool call visualization
**Description:** As a CSM, I want to see when agents use tools so that I understand what's happening.

**Acceptance Criteria:**
- [ ] Tool call card showing tool name and icon
- [ ] Tool parameters displayed (collapsible for complex params)
- [ ] Tool result shown after execution
- [ ] Success/failure indicator
- [ ] Duration of tool execution
- [ ] Link to detailed trace for debugging
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Inline approval requests
**Description:** As a CSM, I want approval requests to appear in chat so that I can approve without context switching.

**Acceptance Criteria:**
- [ ] Approval card appears inline when agent requests approval
- [ ] Card shows action type, recipient, content preview
- [ ] Approve/Reject buttons on card
- [ ] Edit option before approving (modify email, meeting time)
- [ ] Approval status updates in real-time
- [ ] Expired approvals marked clearly
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Agent selector
**Description:** As a CSM, I want to select which agent to talk to so that I engage the right specialist.

**Acceptance Criteria:**
- [ ] Agent dropdown/tabs showing all available agents
- [ ] Agent icons and descriptions
- [ ] Current agent indicator
- [ ] Switch agent mid-conversation
- [ ] Auto-routing option (orchestrator chooses)
- [ ] Recently used agents for quick access
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Conversation history
**Description:** As a CSM, I want to scroll through conversation history so that I have context.

**Acceptance Criteria:**
- [ ] Full conversation history visible
- [ ] Infinite scroll for long conversations
- [ ] Jump to top/bottom buttons
- [ ] Search within conversation
- [ ] Message timestamps
- [ ] Load older messages without losing position
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Session management
**Description:** As a CSM, I want to start new sessions and access old ones so that I can manage conversations.

**Acceptance Criteria:**
- [ ] New session button creates fresh context
- [ ] Session list in sidebar
- [ ] Session titles (auto-generated or editable)
- [ ] Session timestamps and message counts
- [ ] Delete session option
- [ ] Sessions grouped by customer context
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Customer context panel
**Description:** As a CSM, I want to see customer context alongside chat so that agents have relevant data.

**Acceptance Criteria:**
- [ ] Customer selector to set context
- [ ] Customer summary card (name, ARR, health, renewal)
- [ ] Recent activity feed
- [ ] Quick stats (meetings, emails, tasks)
- [ ] Link to full customer detail
- [ ] Context persists across messages
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Message actions
**Description:** As a CSM, I want message actions so that I can interact with agent outputs.

**Acceptance Criteria:**
- [ ] Copy message text
- [ ] Copy code blocks with one click
- [ ] React/rate message (helpful/not helpful)
- [ ] Report issue with message
- [ ] Share message (link to specific message)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: Markdown rendering
**Description:** As a CSM, I want messages to render markdown so that formatting is clear.

**Acceptance Criteria:**
- [ ] Headers, bold, italic, strikethrough
- [ ] Code blocks with syntax highlighting
- [ ] Bullet and numbered lists
- [ ] Links (clickable, open in new tab)
- [ ] Tables rendered properly
- [ ] Images rendered inline
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-012: Backend: Agent orchestration
**Description:** As a system, I need robust orchestration so that agents respond reliably.

**Acceptance Criteria:**
- [ ] 4-tier routing (follow-up → keyword → context → LLM)
- [ ] Specialist agent selection and invocation
- [ ] Tool execution with error handling
- [ ] HITL approval integration at tool layer
- [ ] Context window management (summarization at limit)
- [ ] Typecheck passes

### US-013: Backend: Session persistence
**Description:** As a system, I need session persistence so that conversations survive restarts.

**Acceptance Criteria:**
- [ ] Sessions saved to database after each message
- [ ] In-memory cache for active sessions
- [ ] Session recovery on server restart
- [ ] Context preserved across API calls
- [ ] Session expiry after 7 days of inactivity
- [ ] Typecheck passes

### US-014: Backend: Real-time streaming
**Description:** As a system, I need WebSocket streaming so that UI receives real-time updates.

**Acceptance Criteria:**
- [ ] WebSocket connection for each active session
- [ ] Stream tokens as they're generated
- [ ] Stream tool calls and results
- [ ] Heartbeat for connection health
- [ ] Graceful reconnection on disconnect
- [ ] Fallback to polling if WebSocket unavailable
- [ ] Typecheck passes

### US-015: Backend: Rate limiting
**Description:** As a system, I need rate limiting so that resources are protected.

**Acceptance Criteria:**
- [ ] Rate limit per user (10 messages/minute)
- [ ] Rate limit per organization (100 messages/minute)
- [ ] Circuit breaker for AI provider failures
- [ ] Queue excess requests during high load
- [ ] Clear error messages when rate limited
- [ ] Typecheck passes

### US-016: Error handling UI
**Description:** As a CSM, I want clear error messages so that I know when something goes wrong.

**Acceptance Criteria:**
- [ ] Friendly error message in chat for failures
- [ ] Retry button for transient errors
- [ ] Specific messages for rate limits, timeouts, AI errors
- [ ] "Report this issue" link with error context
- [ ] Errors don't break subsequent messages
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-017: Mobile responsive design
**Description:** As a CSM, I want the chat to work on mobile so that I can use it on the go.

**Acceptance Criteria:**
- [ ] Chat fills mobile viewport
- [ ] Keyboard doesn't obscure input
- [ ] Touch-friendly buttons and targets
- [ ] Agent selector works on mobile
- [ ] Customer context collapsible on mobile
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-018: Keyboard shortcuts
**Description:** As a CSM, I want keyboard shortcuts so that I can work faster.

**Acceptance Criteria:**
- [ ] Cmd/Ctrl+Enter to send message
- [ ] Cmd/Ctrl+K to start new session
- [ ] Cmd/Ctrl+/ to toggle agent selector
- [ ] Escape to cancel streaming
- [ ] Arrow keys to navigate session list
- [ ] Shortcuts help modal (Cmd+?)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Chat UI built with React 19, TailwindCSS
- FR-2: WebSocket via socket.io for real-time communication
- FR-3: Messages stored in `agent_messages` with session_id, role, content, metadata
- FR-4: Sessions stored in `agent_sessions` with customer_id, title, created_at
- FR-5: Orchestrator routes to specialists based on 4-tier logic
- FR-6: Tools invoked via LangChain tool executor with HITL middleware
- FR-7: Streaming uses Server-Sent Events or WebSocket frames
- FR-8: Rate limiting via Redis with sliding window algorithm
- FR-9: Session cache in memory (LRU) with 1000 session limit
- FR-10: Error logging with Sentry or similar for debugging

## Non-Goals

- No voice input (text only for v1)
- No file uploads in chat (use dedicated upload flows)
- No @mentions of humans in chat (collaboration is separate)
- No chat export to PDF (use trace viewer for records)
- No multi-user chat (single user per session)

## Technical Considerations

- WebSocket connection management with reconnection logic
- Token streaming requires server-sent events or chunked responses
- Large conversation histories need virtualization (react-window)
- Tool call timeouts (30 sec) to prevent hanging
- Consider persistent connection pool for AI provider
- Mobile: iOS Safari has specific keyboard quirks

## Design Considerations

- Chat should feel native and responsive (no lag)
- Tool calls shouldn't feel intrusive (collapsible by default)
- Approval cards should stand out but not obstruct
- Dark mode support
- Consistent spacing and typography
- Loading states for every async operation

## Success Metrics

- Message send to first token <1 second
- Full response latency <10 seconds for typical queries
- WebSocket reconnection success rate >99%
- User session length >10 minutes average
- Agent helpfulness rating >4/5

## Open Questions

- Should we support conversation branching (edit and regenerate)?
- Should agents remember across sessions (long-term memory)?
- How to handle very long tool outputs (truncate, collapse, link)?
- Should we support code execution in chat (Jupyter-style)?
