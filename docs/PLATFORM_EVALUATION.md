# CSCX.AI Platform Evaluation

**Date:** January 15, 2026
**Purpose:** Assess whether CSCX.AI is a truly agentic system and identify improvements for MVP customer deployment.

---

## Executive Summary

**Verdict: 70% Agentic / 30% Chatbot Wrapper**

CSCX.AI is a **"Supervised Agent System"** - agents make autonomous decisions about routing, tool selection, and action proposals, but all consequential actions require human approval (HITL pattern). This is a deliberate design choice for safety.

---

## 1. Agentic Capabilities Assessment

### What's Agentic

| Capability | Implementation | File Reference |
|------------|----------------|----------------|
| **Multi-Agent Orchestration** | 10 specialist agents with intelligent routing | `server/src/langchain/agents/orchestrator.ts` |
| **Intelligent Routing** | 4-tier: keyword → context → health score → LLM | `orchestrator.ts:238-251` |
| **Real Tool Execution** | Gmail, Calendar, Tasks - actual API calls | `server/src/services/approval.ts:380-411` |
| **Agent Handoffs** | Agents can transfer to other specialists mid-conversation | `specialists/index.ts:156-171` |
| **20 Tools Available** | Read-only + action tools with structured parameters | `server/src/langchain/tools/index.ts` |
| **Observability** | Full tracing of agent runs, steps, tool calls | `server/src/services/agentTracer.ts` |

### What's NOT Agentic

| Gap | Current State | Impact |
|-----|---------------|--------|
| **Persistent Memory** | In-memory sessions (lost on restart) | Conversations don't survive deployments |
| **Proactive Behavior** | Agents only respond to prompts | Can't alert: "Customer X at risk" |
| **Multi-Step Planning** | No autonomous goal decomposition | Can't execute complex workflows alone |
| **Learning** | Feedback stored but not used | Doesn't improve from past interactions |
| **CRM Integration** | Read-only contract search | Can't update Salesforce/HubSpot |

---

## 2. Agent Architecture

### Specialists (10 total)

```
├── onboarding    - New customer setup, kickoff meetings, 30-60-90 day plans
├── adoption      - Product usage tracking, feature enablement, training
├── renewal       - Renewal management, expansion, commercial negotiations
├── risk          - At-risk detection, save plays, escalation
├── strategic     - Executive relationships, QBRs, strategic planning
├── email         - Customer communications, drafting
├── meeting       - Scheduling, preparation, follow-ups
├── knowledge     - Playbook search, best practices
├── research      - Company research, stakeholder mapping
└── analytics     - Health scoring, usage metrics, trends
```

### Routing Logic

```typescript
// 4-tier routing in orchestrator.ts
1. Follow-up detection  → Continue with current specialist
2. Keyword matching     → Match against specialist keywords
3. Context routing      → Route by health score, renewal date
4. LLM routing          → Claude decides if above methods fail
```

### Tools by Category

**Read-Only (Execute Immediately):**
- `get_todays_meetings`, `get_upcoming_meetings`
- `get_recent_emails`, `search_google_drive`
- `search_knowledge_base`, `calculate_health_score`
- `search_contracts`

**Action Tools (Require HITL Approval):**
- `schedule_meeting` - Creates Google Calendar events
- `draft_email` - Sends via Gmail API
- `create_task` - Creates in Supabase
- `handoff_to_specialist` - Transfers conversation

---

## 3. Current Roadmap Status

### Completed Features

| Feature | Status | Evidence |
|---------|--------|----------|
| Contract parsing & intelligence | ✅ Done | Gemini + Claude integration |
| Multi-agent orchestration | ✅ Done | 10 specialists working |
| Google Workspace integration | ✅ Done | Gmail, Calendar, Drive APIs |
| HITL approval flow | ✅ Done | Email, meetings, tasks |
| Task management | ✅ Done | Create/list/complete tasks |
| Health checks | ✅ Done | `/health` with service checks |
| Circuit breakers | ✅ Done | Claude, Gemini, Supabase |
| Agent observability | ✅ Done | Tracing, WebSocket updates |

### In Progress / Blocked

| Feature | Status | Blocker |
|---------|--------|---------|
| Session persistence | ⚠️ Code ready | Frontend build broke deployment |
| Authentication | ⚠️ Partial | OAuth UI exists, not enforced |

### Not Started

| Feature | Priority |
|---------|----------|
| Feature flags system | Medium |
| PR preview deployments | Low |
| Analytics dashboard | High |
| Proactive agent jobs | High |

---

## 4. Deployment Status

**Production URL:** https://cscx-api-938520514616.us-central1.run.app

**Current Revision:** `cscx-api-00040-4wk` (rolled back)

**Rollback Reason:** Frontend build with empty `VITE_API_URL` caused blank page. Session persistence backend works, frontend needs fixing.

---

## 5. Recommended MVP Improvements

### Tier 1 - Must Have for Customers

| Improvement | Effort | Impact | How |
|-------------|--------|--------|-----|
| **Fix session persistence** | 1 hour | High | Fix frontend build, redeploy |
| **Auto-approve safe actions** | 2 hours | High | Skip approval for read-only tools |
| **Email templates library** | 3 hours | Medium | Pre-approved templates for common scenarios |
| **Basic analytics dashboard** | 4 hours | High | Agent usage stats, approval metrics |

### Tier 2 - Nice to Have

| Improvement | Effort | Impact |
|-------------|--------|--------|
| Scheduled agent jobs (proactive outreach) | 1 day | High |
| Salesforce/HubSpot read integration | 1 day | Medium |
| Slack notifications for approvals | 4 hours | Medium |
| Multi-user support per account | 1 day | Medium |

---

## 6. Quick Wins for More Agency

### 1. Auto-approve safe actions

```typescript
// In server/src/services/approval.ts
const SAFE_ACTIONS = ['get_todays_meetings', 'search_knowledge_base', 'calculate_health_score'];

async requestApproval(userId, actionType, actionData) {
  if (SAFE_ACTIONS.includes(actionType)) {
    return this.executeAction(userId, actionType, actionData); // No approval needed
  }
  // ... existing approval flow
}
```

### 2. Add proactive triggers

```typescript
// New file: server/src/jobs/proactive.ts
import cron from 'node-cron';

// Run daily at 9am
cron.schedule('0 9 * * *', async () => {
  const atRiskCustomers = await getCustomersWithHealthBelow(50);
  for (const customer of atRiskCustomers) {
    await orchestrator.execute(
      "Draft a check-in email for this at-risk customer",
      { customerContext: customer, autoApprove: false }
    );
    // Creates pending approval for CSM to review
  }
});
```

### 3. Persistent memory for smarter context

```typescript
// Before each agent call in orchestrator
const conversationHistory = await sessionService.getConversationHistory(sessionId, 50);
const customerInteractions = await getRecentInteractions(customerId, 30); // Last 30 days

const enrichedContext = {
  ...context,
  previousConversations: conversationHistory,
  recentActivity: customerInteractions
};
```

---

## 7. Key Files Reference

### Agent System
- `server/src/langchain/agents/orchestrator.ts` - Main routing engine
- `server/src/langchain/agents/specialists/index.ts` - Specialist definitions
- `server/src/langchain/tools/index.ts` - All 20 tools

### Execution & Approval
- `server/src/services/approval.ts` - HITL flow & action execution
- `server/src/services/google/calendar.ts` - Calendar integration
- `server/src/services/google/gmail.ts` - Email integration

### API Routes
- `server/src/routes/agents.ts` - Agent endpoints
- `server/src/routes/langchain.ts` - `/api/ai/chat` endpoint

### Session (needs deployment fix)
- `server/src/services/session.ts` - Supabase persistence

---

## 8. Next Steps for Tomorrow

1. **Fix session persistence deployment**
   - Issue: Frontend build with `VITE_API_URL=""` causes blank page
   - Solution: Debug locally, ensure relative URLs work, redeploy

2. **Add basic analytics endpoint**
   - Track: agent calls per day, approval rate, most used specialists
   - Endpoint: `GET /api/analytics/agents`

3. **Consider auto-approval for read-only tools**
   - Reduces friction for common lookups
   - Keeps approval for emails/meetings/tasks

4. **Document for end users**
   - What can the AI assistant do?
   - How to approve/reject actions?
   - What specialists are available?

---

## 9. Verdict

**Is it ready for customers?**

| Aspect | Ready? | Notes |
|--------|--------|-------|
| Core agent functionality | ✅ Yes | Works well |
| Google integrations | ✅ Yes | Real emails/meetings |
| Approval flow | ✅ Yes | Safe and auditable |
| Session persistence | ⚠️ Almost | Code ready, deployment issue |
| Analytics/visibility | ❌ No | Managers can't see activity |
| Proactive features | ❌ No | Only reactive to prompts |

**Recommendation:** Fix session persistence, add basic analytics, then ready for pilot customers.
