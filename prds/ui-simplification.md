# PRD: UI Simplification - Navigation and Tab Cleanup

## Overview
Simplify the CSCX.AI interface by removing unused tabs and streamlining the Agent Center experience to go directly to chat.

## Goals
- Remove clutter from main navigation
- Streamline Dashboard to essential tabs only
- Make Agent Center go directly to chat without intermediate selection screens

---

## Changes

### 1. Main Navigation - Remove Tabs

**Remove from App.tsx (lines 278-328):**
- [ ] Remove **Mission Control** tab (line 324) - AgentObservability modal trigger
- [ ] Remove **Agent Studio** tab (line 302) - AgentStudio component

**Keep:**
- Dashboard
- Agent Center
- Knowledge Base

---

### 2. Dashboard - Simplify Sub-Tabs

**Location:** `/Users/azizcamara/CSCX V7/components/Observability.tsx`

**Remove tabs (lines 415-434):**
- [ ] Remove **Revenue** tab and `RevenueAnalytics` component render (lines 864-873)
- [ ] Remove **Engagement** tab and `EngagementMetricsReport` component render (lines 877-884)
- [ ] Remove **Metrics** tab and its content (lines 887-1266)

**Keep tabs:**
- Overview
- Customers
- Health Portfolio

**Update state type (line 147):**
- [ ] Change from `'overview' | 'customers' | 'metrics' | 'health-portfolio' | 'engagement' | 'revenue'`
- [ ] To: `'overview' | 'customers' | 'health-portfolio'`

---

### 3. Agent Center - Direct to Chat

**Location:** `/Users/azizcamara/CSCX V7/components/AgentCenterView.tsx`

**Remove customer selection page (lines 258-372):**
- [ ] Remove the "General Mode" card (line 277)
- [ ] Remove the "Customer Context" card (line 294)
- [ ] Remove the customer grid with search (lines 325-369)
- [ ] Set `showCustomerSelector` to `false` by default (line 52)
- [ ] Auto-select "General Mode" on component mount

**Remove Agent Center tabs (lines 438-460):**
- [ ] Remove **Tools** tab → MCPToolsBrowser (line 481)
- [ ] Remove **Triggers** tab → TriggersDashboard (line 483)
- [ ] Remove **Playbooks** tab → PlaybooksManager (line 485)
- [ ] Remove **Skills** tab → SkillsLibrary (line 492)
- [ ] Remove **Automations** tab → AutomationsPanel (line 499)
- [ ] Remove **Meetings** tab → MeetingIntelligenceViewer (line 501)

**Keep:**
- Chat tab only (AgentControlCenter)

**Result:** Clicking "Agent Center" goes directly to the chat interface without any intermediate screens or tab switching.

---

## Files to Modify

| File | Changes |
|------|---------|
| `App.tsx` | Remove Mission Control and Agent Studio from navigation |
| `components/Observability.tsx` | Remove Revenue, Engagement, Metrics tabs and components |
| `components/AgentCenterView.tsx` | Remove customer selector, remove all tabs except Chat, go directly to chat |

---

## Acceptance Criteria

1. Main navigation shows only: Dashboard, Agent Center, Knowledge Base
2. Dashboard shows only: Overview, Customers, Health Portfolio tabs
3. Clicking "Agent Center" immediately shows the chat interface (AgentControlCenter)
4. No customer selection screen in Agent Center
5. No Tools/Triggers/Playbooks/Skills/Automations/Meetings tabs in Agent Center
