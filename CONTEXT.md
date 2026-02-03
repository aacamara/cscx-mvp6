# CSCX.AI v4 - Onboarding Flow Consolidation

## Version History
- **v3**: Workspace Agent Integration with Google Drive/Sheets
- **v4**: Onboarding Flow Consolidation (Current)

## What Changed in v4

### Overview
Consolidated all onboarding entry points into the **Onboarding Specialist agent** in Agent Studio and Agent Control Center. Removed duplicate navigation paths and created a seamless multi-step onboarding workflow.

### Files Modified

| File | Changes |
|------|---------|
| `App.tsx` | Removed "+ New Onboarding" navigation button |
| `components/AgentCenterView.tsx` | Removed "New Onboarding" card from mode selector, updated grid layout |
| `components/AgentControlCenter/index.tsx` | Added "Start New Onboarding" action button, integrated OnboardingFlow component |
| `components/AgentStudio/index.tsx` | Added "Start New Onboarding" action panel for Onboarding Specialist agent |
| `components/ContractUpload.tsx` | Simplified to show only file upload (removed DocuSign, Paste Text options) |
| `server/src/index.ts` | Registered new onboarding routes |
| `services/geminiService.ts` | Added `createOnboardingWorkspace()` function |

### Files Created

| File | Purpose |
|------|---------|
| `components/AgentStudio/OnboardingFlow.tsx` | Multi-step onboarding workflow component |
| `server/src/routes/onboarding.ts` | Backend endpoint for Google Workspace creation |

---

## Onboarding Flow Architecture

### User Journey
```
Agent Studio/Control Center → Select "Onboarding Specialist"
    │
    ▼
Click "🚀 Start New Onboarding"
    │
    ▼
Step 1: Contract Upload
    → File upload (PDF, Images, Text)
    → Or use sample contract
    │
    ▼
Step 2: Parsing (loading state)
    → "Analyzing contract with AI..."
    │
    ▼
Step 3: Review Extracted Data
    → Company name, ARR, stakeholders, entitlements
    │
    ▼
Step 4: Demo Complete View (Demo Mode)
    → Google Workspace created (mock)
    → Entitlements table
    → Stakeholders grid
    → Agent Automations panel
```

### Flow States (OnboardingFlow.tsx)
```typescript
type FlowStep =
  | 'google_check'      // Verify Google OAuth (skipped in demo)
  | 'contract_upload'   // Upload contract file
  | 'parsing'           // AI extraction in progress
  | 'review'            // Review extracted data
  | 'workspace_setup'   // Creating Drive + Sheets
  | 'complete'          // Success (production)
  | 'demo_complete';    // Success (demo mode)
```

### Demo Mode
The flow includes a `demoMode` flag that:
- Skips Google OAuth verification
- Shows mock Google Workspace results
- Displays sample entitlements and stakeholders
- Presents Agent Automation options

---

## Component Details

### OnboardingFlow.tsx
**Location**: `components/AgentStudio/OnboardingFlow.tsx`

**Props**:
```typescript
interface OnboardingFlowProps {
  agentId: string;
  onComplete: (result: OnboardingResult) => void;
  onCancel: () => void;
}
```

**Features**:
- Multi-step state machine
- Contract parsing with Claude API
- PDF support via Gemini multimodal
- Demo mode with mock data
- Progress indicators for each step
- Entitlements table display
- Stakeholder cards
- Automation action buttons

### ContractUpload.tsx
**Location**: `components/ContractUpload.tsx`

**Simplified to include only**:
- File upload box (drag & drop)
- Sample contract button
- Preview for uploaded files
- Support for: PDF, PNG, JPEG, WebP, TXT

**Removed**:
- DocuSign import option
- Paste text option
- Tab-based interface

---

## Backend Endpoint

### POST /api/onboarding/workspace

**Request**:
```typescript
{
  contractId: string;
  customerName: string;
  contractData: ContractExtraction;
  originalDocument?: {
    fileName: string;
    mimeType: string;
    content: string; // base64
  };
}
```

**Response**:
```typescript
{
  customerId: string;
  driveRootId: string;
  driveFolders: {
    root: string;
    onboarding: string;
    meetings: string;
    qbrs: string;
    contracts: string;
    reports: string;
  };
  sheetId: string;
  sheetUrl: string;
  contractFileId?: string;
}
```

**Operations**:
1. Create customer Drive folder structure
2. Upload contract to Contracts folder
3. Create Onboarding Tracker spreadsheet
4. Populate with extracted contract data
5. Update database records

---

## Contract Data Structure

```typescript
interface ContractExtraction {
  companyName: string;
  signedDate: string;
  contractLength: string;
  renewalDate: string;
  totalContractValue: string;
  arr: string;
  stakeholders: Array<{
    name: string;
    title: string;
    email: string;
    role: string;
  }>;
  entitlements: Array<{
    name: string;
    description: string;
    quantity: string;
    usageLimit: string;
  }>;
  keyTerms: string[];
  summary: string;
}
```

---

## Integration Points

### Agent Studio (index.tsx)
Shows "Start New Onboarding" action when Onboarding Specialist is selected:
```tsx
{selectedAgent?.id === 'agent_onboarding' && !showOnboardingFlow && (
  <AgentActionsPanel onStartOnboarding={() => setShowOnboardingFlow(true)} />
)}
```

### Agent Control Center (index.tsx)
Adds onboarding button to workspace actions:
```tsx
{activeAgentId === 'onboarding' && (
  <OnboardingActionButton onClick={() => setShowOnboardingFlow(true)} />
)}
```

---

## Development Notes

### Running the App
```bash
cd /Users/azizcamara/cscx-v3-backup-20260120-000003
npm run dev
```

### Environment Variables Required
- `VITE_ANTHROPIC_API_KEY` - Claude API key for contract parsing
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- Google Workspace APIs enabled in project

### Testing the Flow
1. Navigate to Agent Studio or Agent Control Center
2. Select "Onboarding Specialist" agent
3. Click "🚀 Start New Onboarding"
4. Upload a contract or use sample
5. Review extracted data
6. View demo completion with workspace results

---

## Future Enhancements
- [ ] Production Google Workspace integration (non-demo)
- [ ] DocuSign OAuth integration for contract import
- [ ] Real-time collaboration on extracted data
- [ ] Webhook notifications for onboarding milestones
- [ ] Custom onboarding templates per customer tier

---

## Date
**Created**: January 20, 2026
**Author**: Aziz Camara with Claude Code assistance
