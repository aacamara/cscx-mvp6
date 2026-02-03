# AIPanel - Agent Instructions

## Purpose

Context-aware AI assistant embedded in workflows. Provides help without leaving the current view.

## Design Principles

1. **Non-blocking**: Appears in sidebar, doesn't obstruct main content
2. **Context-aware**: Knows current customer, workflow phase, data
3. **Collapsible**: Can minimize to maximize main content
4. **Responsive**: Works in 30% width column

## Component Structure

```
AIPanel/
├── index.tsx           # Main container
├── ChatInterface.tsx   # Message input/display
├── ContextBadge.tsx    # Shows current context
├── SuggestionChips.tsx # Quick action suggestions
└── MinimizedView.tsx   # Collapsed state
```

## Props Interface

```typescript
interface AIPanelProps {
  // Context
  customerId?: string;
  customerName?: string;
  context?: 'onboarding' | 'customer-detail' | 'general';

  // Workflow context (for onboarding)
  phase?: OnboardingPhase;
  contractData?: ContractData;

  // Callbacks
  onActionRequest?: (action: AgentAction) => void;
  onCollapse?: () => void;
  onExpand?: () => void;

  // UI
  defaultCollapsed?: boolean;
  className?: string;
}
```

## Context Injection

The panel automatically provides context to the agent:

```typescript
// Built automatically from props
const agentContext = {
  customerContext: {
    id: customerId,
    name: customerName,
    health: customer?.health_score,
    arr: customer?.arr,
    tier: customer?.tier
  },
  workflowContext: {
    phase,
    contractData,
    stakeholders: stakeholders.length
  },
  userIntent: context // 'onboarding' | 'customer-detail' | 'general'
};
```

## Suggested Actions

Based on context, show relevant quick actions:

```typescript
const SUGGESTIONS: Record<string, string[]> = {
  onboarding: [
    'Parse this contract',
    'Map stakeholders',
    'Create success plan',
    'Schedule kickoff'
  ],
  'customer-detail': [
    'Summarize this customer',
    'What are the risks?',
    'Draft a check-in email',
    'Prepare for QBR'
  ],
  general: [
    'How can I help?',
    'Show my at-risk accounts',
    'What renewals are coming up?'
  ]
};
```

## Layout Integration

```tsx
// UnifiedOnboarding.tsx - Two-column layout
<div className="flex h-full">
  {/* Main content - 70% */}
  <div className="w-[70%] overflow-auto">
    <OnboardingContent />
  </div>

  {/* AI Panel - 30% */}
  <div className="w-[30%] border-l border-gray-700">
    <AIPanel
      customerId={customerId}
      context="onboarding"
      phase={phase}
      contractData={contractData}
      onActionRequest={handleAction}
    />
  </div>
</div>
```

## Common Gotchas

### 1. Don't Duplicate State
```tsx
// ❌ BAD - duplicating customer data
const AIPanel = ({ customerId }) => {
  const [customer, setCustomer] = useState(null);
  useEffect(() => fetchCustomer(customerId), [customerId]);
  // Now have duplicate state
};

// ✅ GOOD - receive from parent
const AIPanel = ({ customer }) => {
  // Use parent's customer data directly
};
```

### 2. Action Callbacks
```tsx
// ❌ BAD - AIPanel directly modifies workspace
const AIPanel = () => {
  const handleUpload = async (file) => {
    await driveService.upload(file); // Direct action
  };
};

// ✅ GOOD - delegate to parent
const AIPanel = ({ onActionRequest }) => {
  const handleUpload = (file) => {
    onActionRequest({ type: 'upload_file', data: file });
  };
};
```

### 3. Height Management
```tsx
// ❌ BAD - fixed height
<div className="h-[600px]">

// ✅ GOOD - fill available space
<div className="flex flex-col h-full">
  <Header className="flex-shrink-0" />
  <Messages className="flex-grow overflow-auto" />
  <Input className="flex-shrink-0" />
</div>
```

### 4. Collapsed State
```tsx
// Remember collapsed state in localStorage
const [collapsed, setCollapsed] = useState(() => {
  return localStorage.getItem('aiPanelCollapsed') === 'true';
});

useEffect(() => {
  localStorage.setItem('aiPanelCollapsed', String(collapsed));
}, [collapsed]);
```

## Testing

1. Expand/collapse → State persists
2. Send message → Response includes context
3. Click suggestion → Populates input
4. Resize window → Layout adapts
5. Different contexts → Suggestions change
