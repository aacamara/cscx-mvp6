# CSCX.AI MVP Production Guide

## Overview

This is the **MVP version** of CSCX.AI with the **Sequential Handoff Flow** - a coherent user journey from contract upload to agent execution.

### What's Different from the Original

| Feature | Original (cscx-parsing) | MVP (cscx-mvp) |
|---------|------------------------|----------------|
| **Flow** | Two separate views (toggle) | Single sequential flow |
| **Data sharing** | One-way copy on switch | Full context passed to agents |
| **Transition** | Manual button click | Automatic with handoff screen |
| **Agent context** | Basic customer info only | Full contract + plan data |
| **User experience** | Confusing dual-mode | Clear wizard → execution path |

---

## User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        CSCX.AI MVP                              │
│                   User-Controlled Flow                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: CONTRACT UPLOAD                                       │
│  ─────────────────────────                                      │
│  • Upload PDF, paste text, or use sample                        │
│  • DocuSign integration available                               │
│  Status: Blue indicator                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: CONTRACT PARSING & REVIEW                             │
│  ──────────────────────────────────                             │
│  • Extracts: Entitlements, Stakeholders, Tech Specs, Tasks      │
│  • User can review/verify extracted data via TABS               │
│  • Stay as long as needed - NO auto-transition                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: INTELLIGENCE GENERATION                               │
│  ────────────────────────────────                               │
│  • Executive summary                                            │
│  • Company research                                             │
│  • 30-60-90 day plan                                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ✅ Contract Analysis Complete                              │  │
│  │ Ready to deploy AI agents for [Company Name]              │  │
│  │                                    [🚀 Deploy Agents]     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (User clicks Deploy Agents)
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: HANDOFF SCREEN                                        │
│  ────────────────────────                                       │
│  [← Back to Contract Review]              [Ready to Deploy]     │
│                                                                 │
│  ┌─────────────────────────┐  ┌───────────────────────────┐    │
│  │ Ready to Execute        │  │ Customer Summary          │    │
│  │ • 5 Entitlements        │  │ • Company name            │    │
│  │ • 3 Stakeholders        │  │ • ARR                     │    │
│  │ • 4 Tech Specs          │  │ • Contract period         │    │
│  │ • 12 Plan Tasks         │  │                           │    │
│  │                         │  │ Key Stakeholders          │    │
│  │ [🚀 Deploy Agents]      │  │ • Name (Role)             │    │
│  └─────────────────────────┘  │                           │    │
│                               │ Quick Review              │    │
│  What happens next?           │ • Review Entitlements     │    │
│  🎯 Onboarding Agent...       │ • Review Tech Specs       │    │
│  🎙 Meeting Agent...          │ • Review Agent Tasks      │    │
│  📚 Training Agent...         └───────────────────────────┘    │
│                                                                 │
│  Status: Yellow indicator                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (User clicks Deploy Agents & Start)
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5: AGENT EXECUTION                                       │
│  ───────────────────────                                        │
│  • Agent Control Center with FULL context                       │
│  • Onboarding Agent has all contract data + plan                │
│  • Can deploy Meeting, Training, Intelligence agents            │
│  • Human-in-the-loop approvals for critical actions             │
│  • Sidebar shows plan progress                                  │
│  Status: Green indicator                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Key User Controls

| Screen | User Actions |
|--------|-------------|
| **Contract Review** | Review tabs, stay as long as needed |
| **After Plan Generated** | Click "Deploy Agents" when ready |
| **Handoff Screen** | Back to Review, Quick Review links, Deploy |
| **Agent Execution** | Chat, approve actions, Start Over |

---

## Technical Architecture

### Frontend State Flow

```typescript
// App.tsx manages three phases
type AppPhase = 'onboarding' | 'handoff' | 'execution';

// Contract data flows through:
contractData → customerContext → AgentControlCenter

// Full context sent to backend agents:
{
  name, arr, products, stakeholders,      // Basic
  contractPeriod, entitlements,           // Contract details
  technicalRequirements, contractTasks,   // Specs & tasks
  plan: { phases, milestones, ... }       // Generated plan
}
```

### Backend Agent Context

The backend agents now receive the full contract context:

```typescript
// POST /api/agents/chat
{
  sessionId: string,
  message: string,
  context: {
    // Customer basics
    name: "Acme Corp",
    arr: 500000,

    // Contract data
    entitlements: [...],
    stakeholders: [...],
    technicalRequirements: [...],
    contractTasks: [...],

    // Generated plan
    plan: {
      timelineDays: 90,
      phases: [...],
      riskFactors: [...],
    }
  }
}
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- Gemini API key

### 1. Install Dependencies

```bash
cd /Users/azizcamara/Downloads/cscx-mvp

# Frontend
npm install

# Backend
cd server && npm install
```

### 2. Configure Environment

```bash
# Copy example env files
cp .env.example .env.local
cp server/.env.example server/.env

# Edit server/.env
GEMINI_API_KEY=your_key_here
```

### 3. Run Locally

```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
npm run dev
```

### 4. Test the Flow

1. Open http://localhost:5173
2. Click "Use Sample Contract" or upload your own
3. Watch the parsing and intelligence generation
4. Review the handoff screen
5. Click "Deploy Agents & Start Execution"
6. Interact with the Onboarding Agent

---

## Production Deployment

### Option A: Quick Deploy (Recommended for MVP)

**Frontend**: Netlify or Vercel
```bash
# Build
npm run build

# Deploy to Netlify
netlify deploy --prod --dir=dist
```

**Backend**: Railway or Render
```bash
cd server
# Push to GitHub, connect to Railway/Render
```

### Option B: Google Cloud Run

```bash
# Build and push container
gcloud builds submit --config cloudbuild.yaml

# Deploy
gcloud run deploy cscx-api --image gcr.io/PROJECT/cscx-api
```

### Environment Variables for Production

```bash
# Frontend (.env.production)
VITE_API_URL=https://your-api.domain.com

# Backend
NODE_ENV=production
PORT=8080
GEMINI_API_KEY=xxx
CORS_ORIGIN=https://your-frontend.domain.com

# Optional: Supabase for persistence
SUPABASE_URL=xxx
SUPABASE_SERVICE_KEY=xxx
```

---

## What's Working Now

- [x] Contract upload (PDF, text, sample)
- [x] AI-powered contract parsing (Gemini)
- [x] Intelligence generation (summary, research, plan)
- [x] Sequential handoff flow
- [x] Agent Control Center with full context
- [x] Multi-agent orchestration
- [x] Human-in-the-loop approvals
- [x] Real-time agent status

## What's Needed for Production

### Priority 1: Must Have
- [ ] **Authentication** - User login (Supabase Auth)
- [ ] **Database** - Persist sessions and data (Supabase)
- [ ] **Error handling** - Better error messages and recovery

### Priority 2: Should Have
- [ ] **Email sending** - Actually send welcome emails (SendGrid/Resend)
- [ ] **Calendar integration** - Book meetings (Google Calendar API)
- [ ] **Multiple customers** - Customer list and selection

### Priority 3: Nice to Have
- [ ] **CRM sync** - Salesforce/HubSpot integration
- [ ] **Meeting transcription** - Record and transcribe calls
- [ ] **Training content** - Generate real training materials

---

## File Structure

```
cscx-mvp/
├── App.tsx                      # Main app with sequential flow
├── context/
│   └── OnboardingContext.tsx    # Shared state (optional)
├── components/
│   ├── ContractUpload.tsx       # Step 1: Upload
│   ├── OnboardingStep.tsx       # Step wrapper
│   ├── AgentControlCenter/      # Step 5: Execution
│   │   ├── index.tsx            # Main component (updated)
│   │   ├── AgentCard.tsx
│   │   ├── Message.tsx
│   │   └── ...
│   └── ...
├── types/
│   └── agents.ts                # Extended CustomerContext
├── server/
│   ├── src/
│   │   ├── agents/              # AI agents
│   │   ├── routes/              # API endpoints
│   │   └── services/            # Gemini, Supabase
│   └── ...
└── docs/
    └── mvp/
        ├── MVP_GUIDE.md         # This file
        └── DEPLOYMENT.md        # Detailed deployment
```

---

## Troubleshooting

### "Agent error: Failed to get response"
- Check backend is running on port 3001
- Verify GEMINI_API_KEY is set in server/.env
- Check browser console for CORS errors

### Contract parsing fails
- Ensure Gemini API key is valid
- Check VITE_GEMINI_API_KEY in .env.local

### Handoff screen doesn't appear
- Parsing or generation might have failed silently
- Check browser console for errors

---

## Next Steps

1. **Add Supabase** - Run `./scripts/setup-supabase.sh`
2. **Add Auth** - Follow docs/mvp/AUTH_GUIDE.md (to be created)
3. **Deploy** - Follow docs/mvp/DEPLOYMENT.md
4. **Get customers** - The product is ready for demos!

---

## Support

- Original codebase: `/Users/azizcamara/Downloads/cscx-parsing`
- MVP codebase: `/Users/azizcamara/Downloads/cscx-mvp`
- Gap analysis: `docs/GAP_ANALYSIS.md`
