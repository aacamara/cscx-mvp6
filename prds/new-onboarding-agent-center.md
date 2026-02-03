# PRD: New Onboarding via Agent Center

## Overview
Redirect the "New Onboarding" button in Dashboard > Customers to open the Agent Center chat with the onboarding specialist, enabling users to start the onboarding process directly from the AI assistant.

---

## Current Behavior
- "New Onboarding" button in Dashboard > Customers tab
- Clicking it navigates to `UnifiedOnboarding` component
- Separate, dedicated onboarding workflow view

## Desired Behavior
- "New Onboarding" button navigates to Agent Center
- Agent Center automatically triggers onboarding mode
- Shows contract upload interface within Agent Center
- After contract parsing, AI assistant has full context to guide onboarding

---

## Technical Changes

### 1. App.tsx
- Modify `handleNewOnboarding` to navigate to `agent-center` view
- Pass a flag or prop to indicate onboarding mode should be triggered

### 2. AgentCenterView.tsx
- Accept optional prop to auto-trigger onboarding mode
- When triggered, show contract upload UI
- After contract parsed, set context and show relevant initial message

### 3. Observability.tsx
- No changes needed (already calls `onNewOnboarding` prop)

---

## Flow Diagram
```
Dashboard > Customers > "New Onboarding" button
    ↓
Navigate to Agent Center (with onboardingMode=true)
    ↓
Agent Center shows contract upload
    ↓
User uploads contract
    ↓
Contract parsed → context set
    ↓
AI Assistant ready to guide onboarding
```

---

## Acceptance Criteria
1. "New Onboarding" button navigates to Agent Center
2. Contract upload UI appears automatically in Agent Center
3. After parsing, AI has full customer context
4. User can proceed with onboarding guidance via chat
