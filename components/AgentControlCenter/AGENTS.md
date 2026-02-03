# AgentControlCenter - Agent Instructions

## Purpose

Main interface for interacting with CSCX AI agents. Handles chat, tool visualization, and HITL approvals.

## Component Structure

```
AgentControlCenter/
├── index.tsx           # Main orchestrator
├── ChatPanel.tsx       # Message input and history
├── MessageList.tsx     # Scrollable message container
├── MessageBubble.tsx   # Individual message display
├── ToolCallCard.tsx    # Tool execution visualization
├── PendingApprovals.tsx # HITL approval queue
├── ApprovalCard.tsx    # Single approval item
├── AgentSelector.tsx   # Switch between specialists
└── WorkspacePanel.tsx  # Customer workspace integration
```

## State Management

```typescript
interface AgentControlState {
  // Session
  sessionId: string | null;
  customerId: string | null;

  // Agent
  selectedAgent: AgentId | 'auto';
  isStreaming: boolean;

  // Messages
  messages: Message[];

  // Approvals
  pendingApprovals: Approval[];

  // UI
  showWorkspace: boolean;
  showTraceViewer: boolean;
}
```

## Key Features

### 1. Agent Selection
- 5 specialists + "Auto" (orchestrator routes)
- Visual agent cards with icons
- Active agent indicator
- Switch mid-conversation

### 2. Real-time Chat
- WebSocket streaming for tokens
- Typing indicator during generation
- Auto-scroll to latest message
- Cancel button for long responses

### 3. Tool Visualization
- Inline cards for tool calls
- Parameters displayed (collapsible)
- Result shown after execution
- Duration and status indicators

### 4. HITL Approvals
- Inline approval cards in chat
- Approve/Reject/Modify actions
- Preview of action details
- Expiration countdown

## WebSocket Events

```typescript
// Subscribed events
socket.on('message:start', () => setIsStreaming(true));
socket.on('message:token', ({ token }) => appendToken(token));
socket.on('message:end', () => setIsStreaming(false));
socket.on('tool:call', ({ name, params }) => addToolCall(name, params));
socket.on('tool:result', ({ id, result }) => updateToolResult(id, result));
socket.on('approval:created', (approval) => addApproval(approval));
socket.on('approval:resolved', ({ id, status }) => updateApproval(id, status));
```

## Props Interface

```typescript
interface AgentControlCenterProps {
  customerId?: string;           // Pre-selected customer
  sessionId?: string;            // Resume existing session
  defaultAgent?: AgentId;        // Default agent selection
  onSessionCreate?: (id: string) => void;
  onMessageSent?: (message: Message) => void;
}
```

## Common Gotchas

### 1. Session Management
```typescript
// ❌ BAD - creating new session on each message
await sendMessage({ message: text }); // No sessionId

// ✅ GOOD - reuse session
await sendMessage({ sessionId, message: text, customerId });
```

### 2. Scroll Behavior
```typescript
// Auto-scroll to bottom on new messages
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);
```

### 3. Approval Timeouts
```typescript
// Approvals expire after 24 hours
// Show countdown and handle expiration gracefully
const timeRemaining = approval.expires_at - Date.now();
if (timeRemaining < 0) {
  // Mark as expired, don't allow approve/reject
}
```

### 4. Mobile Layout
```typescript
// Collapse sidebar on mobile
const isMobile = useMediaQuery('(max-width: 768px)');

return (
  <div className={isMobile ? 'flex-col' : 'flex'}>
    {!isMobile && <Sidebar />}
    <ChatPanel />
  </div>
);
```

## Testing

1. Send message → Verify streaming response
2. Tool call → Verify card appears with params
3. Approval needed → Verify card appears, approve works
4. Switch agent → Verify routing changes
5. Mobile view → Verify responsive layout
