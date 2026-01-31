# PRD: Agent Center Customer Context Dropdown

## Overview
Add a dropdown selector in the Agent Center header that allows users to select a customer context while chatting. This enables context-aware conversations without leaving the chat interface.

## Current State
- Agent Center goes directly to chat in "General Mode"
- No way to select customer context
- Header shows only "AI Assistant" with static text

## Desired State
- Header includes a customer dropdown selector
- User can switch between "General Mode" and specific customers
- Selected customer context is passed to AgentControlCenter
- Chat updates initial message based on selected customer

---

## Implementation

### Location
`/Users/azizcamara/CSCX V7/components/AgentCenterView.tsx`

### Changes

1. **Keep customer fetching** (already exists)
   - `customers` state is already populated on mount
   - `loadingCustomers` state tracks loading

2. **Add customer selection state**
   - `selectedCustomer` state already exists, just needs to be settable

3. **Update header with dropdown**
   - Replace static "AI Assistant" header with:
     - Dropdown showing "General Mode" + all customers
     - Selected customer name displayed
     - Customer health/ARR shown when selected

4. **Pass context to AgentControlCenter**
   - Already passing `customer={buildCustomerContext(selectedCustomer)}`
   - Just need to allow changing `selectedCustomer`

---

## UI Design

```
┌─────────────────────────────────────────────────────────────┐
│  🤖  [▼ General Mode                              ]         │
│       └─ General Mode                                       │
│          ─────────────                                      │
│          Acme Corp ($120K ARR • 85% health)                │
│          TechStart Inc ($45K ARR • 72% health)             │
│          GlobalTech ($250K ARR • 91% health)               │
│          ...                                                │
└─────────────────────────────────────────────────────────────┘
```

When customer selected:
```
┌─────────────────────────────────────────────────────────────┐
│  🤖  [▼ Acme Corp                                 ]         │
│       $120K ARR • 85% health • active                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

1. Dropdown shows "General Mode" as first option
2. All customers listed below with ARR and health score
3. Selecting a customer updates the chat context
4. Chat initial message changes based on selection
5. Can switch back to General Mode at any time
6. Dropdown styled consistently with app theme
