# PRD: Production-Ready Chat UI

## Overview
Elevate the existing CSCX.AI chat implementation to production quality with performance optimizations, UX polish, and command center capabilities.

## Prime Directive
**Preserve what works, fix what's broken, add what's missing.**

The existing AgentControlCenter, Message.tsx, SSE streaming, and WebSocket integration are solid. This PRD focuses on gaps identified in the audit.

---

## User Stories

### Performance Optimization

#### CHAT-001: Virtualize Message List
**Description**: Implement virtualized scrolling for the message list to handle 100+ messages without lag.

**Acceptance Criteria**:
- Use react-window or similar for virtualized list
- Smooth scrolling with 1000+ messages
- Preserve scroll position on new messages
- Auto-scroll to bottom on new message (unless user scrolled up)
- Typecheck passes

#### CHAT-002: Code-Split AgentControlCenter
**Description**: Split the 80KB AgentControlCenter into lazy-loaded chunks.

**Acceptance Criteria**:
- Main chat component < 30KB initial
- InteractiveActions lazy loaded
- ChatHistoryDropdown lazy loaded
- WorkspaceDataPanel lazy loaded
- No flash of loading state for critical path
- Typecheck passes

### UX Polish (ChatGPT/Claude Level)

#### CHAT-003: Add Keyboard Shortcuts
**Description**: Implement keyboard shortcuts for power users.

**Acceptance Criteria**:
- Cmd+Enter to send message
- Cmd+K opens command palette (if exists) or focuses input
- Escape closes modals/dropdowns
- Arrow keys navigate message history in input
- Shortcuts work globally when chat is focused
- Typecheck passes

#### CHAT-004: Copy Button on Code Blocks
**Description**: Add a copy-to-clipboard button on all code blocks in messages.

**Acceptance Criteria**:
- Copy button appears on hover over code block
- Click copies code content to clipboard
- Shows "Copied!" feedback for 2 seconds
- Works for inline and block code
- Typecheck passes

#### CHAT-005: Message Actions on Hover
**Description**: Add action buttons that appear when hovering over messages.

**Acceptance Criteria**:
- Actions appear on message hover (right side)
- Copy message content button
- Retry button for failed messages
- Delete button for user messages (with confirmation)
- Actions fade in/out smoothly
- Typecheck passes

#### CHAT-006: Loading Skeletons
**Description**: Replace spinners with loading skeletons for better perceived performance.

**Acceptance Criteria**:
- Skeleton for message list loading
- Skeleton for chat history dropdown
- Skeleton pulse animation matches brand
- Skeletons match actual content layout
- Typecheck passes

#### CHAT-007: Optimistic Updates
**Description**: Show user messages immediately before server confirmation.

**Acceptance Criteria**:
- User message appears instantly on send
- Subtle "sending" indicator on message
- Updates to "sent" on server confirmation
- Falls back to error state if send fails
- Retry available on failed messages
- Typecheck passes

### Production Hardening

#### CHAT-008: Offline Mode with Message Queue
**Description**: Queue messages when offline and send when connection restored.

**Acceptance Criteria**:
- Detect offline state via navigator.onLine
- Queue messages in localStorage when offline
- Show "offline" indicator in chat header
- Process queue on reconnection (FIFO)
- Show queued message count
- Typecheck passes

#### CHAT-009: Smooth Scroll to New Messages
**Description**: Implement smooth scrolling behavior for new messages.

**Acceptance Criteria**:
- New messages scroll into view smoothly
- If user scrolled up, show "New messages" button
- Clicking button scrolls to bottom
- Auto-scroll resumes when user scrolls to bottom
- Typecheck passes

#### CHAT-010: Auto-Focus Input After Send
**Description**: Ensure input is always focused after sending a message.

**Acceptance Criteria**:
- Input focused after message send
- Input focused after clicking in chat area
- Input focused after modal closes
- Works on mobile (soft keyboard)
- Typecheck passes

### Agent Command Center

#### CHAT-011: Intent Classifier Layer
**Description**: Add an intent classification layer that routes messages to appropriate agents.

**Acceptance Criteria**:
- Classifies intents: chat, data_query, admin_action, help
- Routes to appropriate specialist agent
- Falls back to general chat for unclear intents
- Classification happens before streaming starts
- Typecheck passes

#### CHAT-012: Inline Rich Response Types
**Description**: Support rich response types beyond text (tables, cards, charts).

**Acceptance Criteria**:
- Render markdown tables as styled HTML tables
- Support info/warning/error card components
- JSON responses render as collapsible trees
- Lists render with proper bullet styling
- Typecheck passes

---

## Technical Notes

### Virtualization Library
Recommend `@tanstack/react-virtual` (formerly react-virtual) - smaller than react-window, better DX.

### Code Splitting Pattern
```typescript
const InteractiveActions = React.lazy(() => import('./InteractiveActions'));
const ChatHistoryDropdown = React.lazy(() => import('./ChatHistoryDropdown'));
```

### Keyboard Shortcuts
Use existing KeyboardContext or add to it. Don't add new dependencies.

### Offline Detection
```typescript
const [isOnline, setIsOnline] = useState(navigator.onLine);
useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);
```

---

## Out of Scope
- Redesigning the visual appearance
- Changing the streaming implementation
- Database schema changes
- New backend endpoints (unless required)

## Success Metrics
- Message list handles 1000+ messages at 60fps
- Initial bundle < 50KB for chat critical path
- All keyboard shortcuts functional
- Zero console errors in production
