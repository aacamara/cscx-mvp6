# PRD: Map Agent Quick-Action Buttons to CADG Cards

## Problem
The 5 CS Agent quick-action buttons in the Agent Control Center use old action IDs and chat-based fallback messages. They don't route through the CADG card system, so clicking "Generate Forecast" gives a plain text response instead of an editable CADG card with HITL approval, PDF export, etc.

## Current State
`components/AgentControlCenter/AgentCard.tsx` defines `AGENT_ACTIONS`:

### Current Onboarding Actions
| Button | Action ID | What Happens |
|--------|----------|-------------|
| Schedule Kickoff | `kickoff` | Sends chat message |
| Generate 30-60-90 Plan | `plan_30_60_90` | Sends chat message |
| Map Stakeholders | `stakeholder_map` | Sends chat message |
| Send Welcome Sequence | `welcome_sequence` | Sends chat message |
| AI Meeting Prep | `meeting_prep` | Sends chat message |

### Current Adoption Actions
| Button | Action ID | What Happens |
|--------|----------|-------------|
| Analyze Usage | `usage_analysis` | Sends chat message |
| Create Adoption Campaign | `adoption_campaign` | Sends chat message |
| Deploy Feature Training | `feature_training` | Sends chat message |
| Identify Champions | `champion_program` | Sends chat message |

### Current Renewal Actions
| Button | Action ID | What Happens |
|--------|----------|-------------|
| Generate Forecast | `renewal_forecast` | Sends chat message |
| Create Value Summary | `value_summary` | Sends chat message |
| Find Expansion Opps | `expansion_analysis` | Sends chat message |
| Start Renewal Playbook | `renewal_playbook` | Sends chat message |
| AI Draft Email | `draft_email` | Opens email composer |

### Current Risk Actions
| Button | Action ID | What Happens |
|--------|----------|-------------|
| Run Risk Assessment | `risk_assessment` | Sends chat message |
| Create Save Play | `save_play` | Sends chat message |
| Escalate Issue | `escalation` | Sends chat message |
| Deep Health Check | `health_check` | Sends chat message |
| AI Churn Prediction | `churn_prediction` | Sends chat message |

### Current Strategic Actions
| Button | Action ID | What Happens |
|--------|----------|-------------|
| Prepare QBR | `qbr_prep` | Sends chat message |
| Executive Briefing | `exec_briefing` | Sends chat message |
| Account Planning | `account_plan` | Sends chat message |
| Strategic Success Plan | `success_plan` | Sends chat message |
| AI Meeting Prep | `meeting_prep` | Sends chat message |
| AI Draft Email | `draft_email` | Opens email composer |

## Solution

### 1. Update AGENT_ACTIONS to Match CADG TaskTypes
Map every button's `id` to the exact CADG `TaskType` string. Add missing card types.

```typescript
export const AGENT_ACTIONS: Record<CSAgentType, { id: string; label: string; icon: string; cadgTaskType?: TaskType }[]> = {
  onboarding: [
    { id: 'kickoff_plan', label: 'Create Kickoff Plan', icon: '📅', cadgTaskType: 'kickoff_plan' },
    { id: 'milestone_plan', label: 'Generate 30-60-90 Plan', icon: '📋', cadgTaskType: 'milestone_plan' },
    { id: 'stakeholder_map', label: 'Map Stakeholders', icon: '👥', cadgTaskType: 'stakeholder_map' },
    { id: 'training_schedule', label: 'Training Schedule', icon: '📚', cadgTaskType: 'training_schedule' },
    { id: 'meeting_prep', label: 'AI Meeting Prep', icon: '🤖' },
  ],
  adoption: [
    { id: 'usage_analysis', label: 'Analyze Usage', icon: '📊', cadgTaskType: 'usage_analysis' },
    { id: 'feature_campaign', label: 'Feature Campaign', icon: '🎯', cadgTaskType: 'feature_campaign' },
    { id: 'champion_development', label: 'Develop Champions', icon: '🏆', cadgTaskType: 'champion_development' },
    { id: 'training_program', label: 'Training Program', icon: '📚', cadgTaskType: 'training_program' },
  ],
  renewal: [
    { id: 'renewal_forecast', label: 'Renewal Forecast', icon: '🔮', cadgTaskType: 'renewal_forecast' },
    { id: 'value_summary', label: 'Value Summary', icon: '💎', cadgTaskType: 'value_summary' },
    { id: 'expansion_proposal', label: 'Expansion Proposal', icon: '📈', cadgTaskType: 'expansion_proposal' },
    { id: 'negotiation_brief', label: 'Negotiation Brief', icon: '🤝', cadgTaskType: 'negotiation_brief' },
    { id: 'draft_email', label: 'AI Draft Email', icon: '✨' },
  ],
  risk: [
    { id: 'risk_assessment', label: 'Risk Assessment', icon: '⚠️', cadgTaskType: 'risk_assessment' },
    { id: 'save_play', label: 'Create Save Play', icon: '🛡️', cadgTaskType: 'save_play' },
    { id: 'escalation_report', label: 'Escalation Report', icon: '🚨', cadgTaskType: 'escalation_report' },
    { id: 'resolution_plan', label: 'Resolution Plan', icon: '✅', cadgTaskType: 'resolution_plan' },
  ],
  strategic: [
    { id: 'qbr_generation', label: 'Prepare QBR', icon: '📊', cadgTaskType: 'qbr_generation' },
    { id: 'executive_briefing', label: 'Executive Briefing', icon: '👔', cadgTaskType: 'executive_briefing' },
    { id: 'account_plan', label: 'Account Plan', icon: '🗺️', cadgTaskType: 'account_plan' },
    { id: 'transformation_roadmap', label: 'Transformation Roadmap', icon: '🚀', cadgTaskType: 'transformation_roadmap' },
    { id: 'draft_email', label: 'AI Draft Email', icon: '✨' },
  ],
};
```

### 2. Direct CADG Invocation from Buttons
In `handleAgentAction()` in `components/AgentControlCenter/index.tsx`:
- If the action has a `cadgTaskType`, call the CADG API directly (`/api/cadg/classify` then `/api/cadg/plan`)
- Skip the chat fallback for CADG actions
- Show the CADG card UI immediately

```typescript
const handleAgentAction = async (agentType: CSAgentType, actionId: string) => {
  const action = AGENT_ACTIONS[agentType]?.find(a => a.id === actionId);

  if (action?.cadgTaskType) {
    // Direct CADG invocation - skip chat
    const customerName = customer?.name || 'the customer';
    const cadgMessage = buildCadgTriggerMessage(action.cadgTaskType, customerName);
    setMessages(prev => [...prev, { isUser: true, message: cadgMessage }]);
    sendToAgent(cadgMessage);
    return;
  }

  // ... existing logic for non-CADG actions (email, meeting prep)
};
```

### 3. Build Optimized CADG Trigger Messages
Create a helper function that builds the ideal trigger message for each CADG task type:

```typescript
function buildCadgTriggerMessage(taskType: TaskType, customerName: string): string {
  const messages: Record<string, string> = {
    kickoff_plan: `Create a kickoff plan for ${customerName}`,
    milestone_plan: `Generate a 30-60-90 day milestone plan for ${customerName}`,
    stakeholder_map: `Map stakeholders for ${customerName}`,
    training_schedule: `Create a training schedule for ${customerName}`,
    usage_analysis: `Analyze usage patterns for ${customerName}`,
    feature_campaign: `Create a feature adoption campaign for ${customerName}`,
    champion_development: `Develop champions at ${customerName}`,
    training_program: `Create a training program for ${customerName}`,
    renewal_forecast: `Forecast renewal for ${customerName}`,
    value_summary: `Create a value summary for ${customerName}`,
    expansion_proposal: `Create an expansion proposal for ${customerName}`,
    negotiation_brief: `Prepare a negotiation brief for ${customerName}`,
    risk_assessment: `Run a risk assessment for ${customerName}`,
    save_play: `Create a save play for ${customerName}`,
    escalation_report: `Create an escalation report for ${customerName}`,
    resolution_plan: `Create a resolution plan for ${customerName}`,
    qbr_generation: `Create a QBR for ${customerName}`,
    executive_briefing: `Create an executive briefing for ${customerName}`,
    account_plan: `Create an account plan for ${customerName}`,
    transformation_roadmap: `Create a transformation roadmap for ${customerName}`,
    portfolio_dashboard: `Show my portfolio dashboard`,
    team_metrics: `Show team metrics`,
    renewal_pipeline: `Show renewal pipeline`,
    at_risk_overview: `Show at-risk customers overview`,
  };
  return messages[taskType] || `Help with ${taskType.replace(/_/g, ' ')}`;
}
```

### 4. Update Bottom Action Bar
The bottom quick actions in `index.tsx` (around line 1170-1210) also need updating:

```typescript
const bottomActions = [
  { id: 'start_onboarding', label: 'Start New\nOnboarding', icon: '🚀' },
  { id: 'schedule_meeting', label: 'Schedule\nMeeting', icon: '📅' },
  { id: 'send_email', label: 'Send\nEmail', icon: '✉️' },
  { id: 'create_document', label: 'Create\nDocument', icon: '📄' },
  { id: 'analyze_data', label: 'Analyze\nData', icon: '🤖' },
];
```
Keep these as-is since they're utility actions, not CADG-specific.

### 5. Add General Mode Quick Actions
When no customer is selected (General Mode), show portfolio-level CADG buttons:
```typescript
const generalModeActions = [
  { id: 'portfolio_dashboard', label: 'Portfolio Dashboard', icon: '📊', cadgTaskType: 'portfolio_dashboard' },
  { id: 'team_metrics', label: 'Team Metrics', icon: '📈', cadgTaskType: 'team_metrics' },
  { id: 'renewal_pipeline', label: 'Renewal Pipeline', icon: '🔮', cadgTaskType: 'renewal_pipeline' },
  { id: 'at_risk_overview', label: 'At-Risk Overview', icon: '⚠️', cadgTaskType: 'at_risk_overview' },
];
```

## Files to Modify
1. `components/AgentControlCenter/AgentCard.tsx` - Update AGENT_ACTIONS
2. `components/AgentControlCenter/index.tsx` - Update handleAgentAction + add General Mode actions
3. `components/AgentControlCenter/QuickActions.tsx` - Support General Mode rendering

## Acceptance Criteria
- [ ] Every agent button with a CADG card triggers the CADG flow (editable preview, HITL approval, download)
- [ ] Button labels match their CADG card purpose
- [ ] General Mode shows portfolio-level CADG buttons
- [ ] Non-CADG actions (email, meeting prep) still work as before
- [ ] Clicking a button shows the same card UI as typing the trigger in chat
