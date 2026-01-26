# CSCX.AI MVP Changelog

## Version 1.0.0 - January 7, 2026

### New Features

#### Sequential Handoff Flow
- **User-controlled transitions** - No auto-transitions, user decides when to proceed
- **Deploy Agents button** - Appears after contract analysis is complete
- **Handoff screen** - Comprehensive review before agent execution
- **Back navigation** - Can return to contract review at any time
- **Quick Review links** - Jump to specific sections (Entitlements, Tech Specs, Tasks)

#### Enhanced Agent Control Center
- **Full context passing** - Agents receive complete contract data and plan
- **Plan progress tracking** - Shows task completion in sidebar
- **Contract data indicator** - Shows when contract data is loaded
- **Stakeholder-aware actions** - Quick actions reference actual stakeholder names

#### Improved UX
- **Phase indicator** - Blue (Setup) → Yellow (Ready) → Green (Executing)
- **Stats dashboard** - Shows counts before deploying
- **Customer summary** - Key details visible on handoff screen

### Technical Changes

#### App.tsx
- Removed auto-transition to handoff screen
- Added "Contract Analysis Complete" banner with Deploy button
- Enhanced HandoffScreen with full review capabilities
- Added Quick Review navigation buttons

#### AgentControlCenter/index.tsx
- New props: `contractData`, `plan`, `initialMessage`
- `buildFullContext()` - Sends complete context to backend
- `initializeSession()` - Pre-loads context on agent start
- Plan progress calculation from tasks

#### types/agents.ts
- Extended `CustomerContext` with contract fields
- Added `ContractTask` interface

#### New Files
- `context/OnboardingContext.tsx` - Shared state provider (optional)
- `vite-env.d.ts` - TypeScript env definitions
- `docs/mvp/MVP_GUIDE.md` - Complete setup guide
- `docs/mvp/DEPLOYMENT_CHECKLIST.md` - Production launch guide
- `docs/mvp/CHANGELOG.md` - This file

### Flow Diagram

```
UPLOAD CONTRACT
      ↓
PARSE & EXTRACT
  • Entitlements
  • Stakeholders
  • Tech Specs
  • Tasks
  • Pricing
      ↓
GENERATE INTELLIGENCE
  • Summary
  • Company Research
  • 30-60-90 Plan
      ↓
┌─────────────────────────────────┐
│ ✅ Contract Analysis Complete   │
│ [🚀 Deploy Agents]              │  ← USER CLICKS WHEN READY
└─────────────────────────────────┘
      ↓
HANDOFF SCREEN
  • Stats dashboard
  • Customer summary
  • Stakeholder list
  • What happens next
  • Quick Review links
  • [← Back to Review]
  • [🚀 Deploy Agents]
      ↓
AGENT EXECUTION
  • Full context loaded
  • Onboarding Agent active
  • HITL approvals enabled
```

### Bug Fixes
- Fixed TypeScript error: `specification` → `requirement` in TechnicalRequirement
- Fixed TypeScript error: `milestones` → `tasks` in OnboardingPhase
- Added vite-env.d.ts for import.meta.env types

### Dependencies
- No new dependencies added
- Node modules reinstalled for clean copy

---

## Migration from Original

If upgrading from `cscx-parsing`:

1. The `view` toggle is replaced by `phase` state
2. Agent Control Center now expects additional props
3. Env files need to be copied: `server/.env`, `.env.local`

Original preserved at: `/Users/azizcamara/Downloads/cscx-parsing`
