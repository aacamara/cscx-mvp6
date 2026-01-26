# Agent Workflow Orchestration System

## Overview

The Agent Workflow System enables all 5 CS agents to execute multi-step workflows that orchestrate Google Workspace services (Sheets, Drive, Gmail, Calendar, Docs, Slides). Each workflow fetches real data, processes it, creates outputs, and returns to chat for Human-in-the-Loop (HITL) approval.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React)                            │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ AgentControlCenter │  │ WorkflowProgress │  │ QuickActions   │  │
│  └────────┬────────┘  └────────┬─────────┘  └───────┬────────┘  │
│           │                    │                     │           │
│           └────────────────────┼─────────────────────┘           │
│                                ▼                                 │
│                    POST /api/workflows/execute-action            │
└────────────────────────────────┼────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────┐
│                      Backend (Express)                           │
│                                ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  AgentWorkflowService                        ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   ││
│  │  │ 25 Workflow  │  │ Workflow     │  │ Action→Workflow  │   ││
│  │  │ Definitions  │  │ Executor     │  │ Mapping          │   ││
│  │  └──────────────┘  └──────┬───────┘  └──────────────────┘   ││
│  └───────────────────────────┼──────────────────────────────────┘│
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Google Workspace Services                       ││
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐ ││
│  │  │ Sheets │ │ Drive  │ │ Gmail  │ │Calendar│ │ Docs/Slides│ ││
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Workflow Definitions (25 Total)

### Onboarding Agent (5 workflows)
| Workflow ID | Name | Data Sources | Outputs |
|-------------|------|--------------|---------|
| `create_kickoff_package` | Create Kickoff Package | Drive, Calendar | Folder, Slides, Doc |
| `generate_onboarding_plan` | Generate Onboarding Plan | Drive, Sheets | Doc, Sheet |
| `create_welcome_sequence` | Create Welcome Sequence | Gmail | Email drafts |
| `setup_customer_workspace` | Setup Customer Workspace | Drive | Folder structure |
| `create_training_materials` | Create Training Materials | Drive | Doc, Slides |

### Adoption Agent (5 workflows)
| Workflow ID | Name | Data Sources | Outputs |
|-------------|------|--------------|---------|
| `analyze_usage_metrics` | Analyze Usage Metrics | Sheets | Sheet, Doc |
| `create_adoption_report` | Create Adoption Report | Sheets, Drive | Doc, Sheet |
| `generate_training_recommendations` | Generate Training Recommendations | Sheets | Doc |
| `create_feature_rollout_plan` | Create Feature Rollout Plan | Sheets, Drive | Doc, Sheet |
| `build_champion_playbook` | Build Champion Playbook | Sheets, Gmail | Doc |

### Renewal Agent (5 workflows)
| Workflow ID | Name | Data Sources | Outputs |
|-------------|------|--------------|---------|
| `generate_renewal_forecast` | Generate Renewal Forecast | Sheets, Drive, Gmail, Calendar | Folder, Sheet |
| `create_qbr_package` | Create QBR Package | Sheets, Drive, Calendar | Folder, Slides, Doc, Sheet |
| `build_value_summary` | Build Value Summary | Sheets, Gmail | Doc |
| `create_renewal_proposal` | Create Renewal Proposal | Sheets, Drive | Doc, Sheet |
| `analyze_expansion_opportunities` | Analyze Expansion Opportunities | Sheets, Gmail, Calendar | Sheet, Doc |

### Risk Agent (5 workflows)
| Workflow ID | Name | Data Sources | Outputs |
|-------------|------|--------------|---------|
| `run_health_assessment` | Run Health Assessment | Sheets, Gmail, Calendar | Sheet, Doc |
| `create_save_play` | Create Save Play | Sheets, Gmail, Drive | Doc, Sheet |
| `generate_escalation_report` | Generate Escalation Report | Sheets, Gmail | Doc, Slides |
| `analyze_churn_signals` | Analyze Churn Signals | Sheets, Gmail, Calendar | Sheet, Doc |
| `create_recovery_plan` | Create Recovery Plan | Sheets, Drive | Doc, Sheet |

### Strategic Agent (5 workflows)
| Workflow ID | Name | Data Sources | Outputs |
|-------------|------|--------------|---------|
| `create_account_plan` | Create Account Plan | Drive, Sheets, Gmail, Calendar | Folder, Doc, Sheet |
| `generate_executive_briefing` | Generate Executive Briefing | Sheets, Drive | Slides, Doc |
| `build_success_story` | Build Success Story | Sheets, Drive, Gmail | Doc, Slides |
| `create_partnership_proposal` | Create Partnership Proposal | Drive, Sheets | Doc, Slides |
| `analyze_strategic_opportunities` | Analyze Strategic Opportunities | Sheets, Drive, Gmail, Calendar | Sheet, Doc |

## Workflow Execution Flow

```
1. User clicks Quick Action (e.g., "Generate Forecast")
           │
           ▼
2. Frontend calls POST /api/workflows/execute-action
           │
           ▼
3. Backend checks ACTION_TO_WORKFLOW mapping
           │
           ▼
4. WorkflowExecutor.execute() starts
           │
           ├─► Step 1: FETCHING
           │   - Fetch from Sheets (health scores, metrics)
           │   - Fetch from Drive (contracts, reports)
           │   - Fetch from Gmail (customer emails)
           │   - Fetch from Calendar (meeting history)
           │
           ├─► Step 2: PROCESSING
           │   - Analyze fetched data
           │   - Generate insights
           │   - Prepare output content
           │
           ├─► Step 3: CREATING
           │   - Create folders in Drive
           │   - Create Docs/Sheets/Slides
           │   - Populate with processed data
           │
           └─► Step 4: AWAITING REVIEW
               - Return to chat with output links
               - Display Approve/Reject buttons
                        │
                        ▼
5. User reviews and clicks Approve/Reject
           │
           ▼
6. Workflow completes with final status
```

## Demo Mode

When Google Workspace is not connected, the system automatically runs in **Demo Mode**:

- Simulates data fetching with realistic delays
- Generates sample data (health scores, emails, calendar events)
- Creates placeholder output files
- Full HITL approval flow still works

This allows testing the complete UI/UX without requiring Google OAuth.

## API Endpoints

### List Workflows
```
GET /api/workflows
GET /api/workflows?agentType=renewal
```

### Get Workflow Details
```
GET /api/workflows/:workflowId
```

### Execute Workflow
```
POST /api/workflows/execute
{
  "workflowId": "generate_renewal_forecast",
  "userId": "user-123",
  "agentType": "renewal",
  "customerId": "acme-corp",
  "customerName": "Acme Corp",
  "customerARR": 150000
}
```

### Execute from Action
```
POST /api/workflows/execute-action
{
  "actionId": "renewal_forecast",
  "userId": "user-123",
  "agentType": "renewal",
  "customerId": "acme-corp",
  "customerName": "Acme Corp"
}
```

### Get Execution Status
```
GET /api/workflows/execution/:executionId
```

### Approve/Reject Execution
```
POST /api/workflows/execution/:executionId/approve
POST /api/workflows/execution/:executionId/reject
```

## Frontend Components

### WorkflowProgress Component
Displays real-time workflow execution progress:
- Workflow name and agent icon
- Step-by-step progress with status indicators
- Output file links (when available)
- Approve/Reject buttons for HITL flow

### Integration with AgentControlCenter
- `handleAgentAction()` now checks for workflow mapping
- Automatically executes workflows when available
- Falls back to chat-based handling if no workflow
- Polls for status updates every 2 seconds

## File Structure

```
server/src/services/agentWorkflows/
├── types.ts                    # Type definitions
├── workflowExecutor.ts         # Execution engine
├── index.ts                    # Service API & exports
└── definitions/
    ├── onboardingWorkflows.ts  # 5 workflows
    ├── adoptionWorkflows.ts    # 5 workflows
    ├── renewalWorkflows.ts     # 5 workflows
    ├── riskWorkflows.ts        # 5 workflows
    └── strategicWorkflows.ts   # 5 workflows

server/src/routes/
└── workflows.ts                # REST API routes

components/AgentControlCenter/
├── index.tsx                   # Main component (updated)
├── WorkflowProgress.tsx        # NEW: Progress display
└── styles.css                  # Updated with workflow styles
```

## Action to Workflow Mapping

| Action ID | Workflow ID | Agent |
|-----------|-------------|-------|
| `kickoff` | `create_kickoff_package` | Onboarding |
| `plan_30_60_90` | `generate_onboarding_plan` | Onboarding |
| `welcome_sequence` | `create_welcome_sequence` | Onboarding |
| `stakeholder_map` | `setup_customer_workspace` | Onboarding |
| `usage_analysis` | `analyze_usage_metrics` | Adoption |
| `adoption_campaign` | `create_adoption_report` | Adoption |
| `feature_training` | `generate_training_recommendations` | Adoption |
| `champion_program` | `build_champion_playbook` | Adoption |
| `renewal_forecast` | `generate_renewal_forecast` | Renewal |
| `qbr_prep` | `create_qbr_package` | Renewal |
| `value_summary` | `build_value_summary` | Renewal |
| `renewal_playbook` | `create_renewal_proposal` | Renewal |
| `expansion_analysis` | `analyze_expansion_opportunities` | Renewal |
| `risk_assessment` | `run_health_assessment` | Risk |
| `save_play` | `create_save_play` | Risk |
| `escalation` | `generate_escalation_report` | Risk |
| `health_check` | `analyze_churn_signals` | Risk |
| `account_plan` | `create_account_plan` | Strategic |
| `exec_briefing` | `generate_executive_briefing` | Strategic |
| `success_plan` | `build_success_story` | Strategic |

## Production Setup

1. Configure Google OAuth with required scopes (see `GOOGLE_WORKSPACE_DEMO_DATA.md`)
2. Create customer workspace folder structure in Drive
3. Populate spreadsheets with customer data
4. Connect Google account in the app
5. Workflows will automatically switch from demo to production mode

## Future Enhancements

- [ ] WebSocket real-time updates (instead of polling)
- [ ] Workflow templates customization
- [ ] Batch workflow execution
- [ ] Workflow scheduling
- [ ] Apps Script automation triggers
- [ ] Workflow analytics and history
