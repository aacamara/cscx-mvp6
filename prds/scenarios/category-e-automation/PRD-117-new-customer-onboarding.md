# PRD-117: New Customer Assignment → Onboarding

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-117 |
| **Title** | New Customer Assignment → Onboarding |
| **Category** | E: Workflow Automation |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When a new customer is assigned to a CSM, there's a critical window to begin onboarding smoothly. Currently, CSMs must manually set up customer workspaces, research the company, prepare welcome materials, and schedule kickoff meetings. This delays time-to-value and creates inconsistent onboarding experiences.

## User Story
**As a** CSM
**I want** automated onboarding initialization when a new customer is assigned to me
**So that** I can immediately engage with the customer with all preparation done and provide a consistent, high-quality onboarding experience

## Functional Requirements

### FR-1: Assignment Detection
- Detect new customer assignment via:
  - Salesforce opportunity won trigger
  - Manual customer creation in CSCX
  - CRM sync detecting new account ownership
  - API webhook from deal desk
- Trigger onboarding workflow within 5 minutes of assignment

### FR-2: Customer Workspace Setup
- Create Google Drive folder structure:
  ```
  CSCX - {CustomerName}/
  ├── 01 - Onboarding/
  ├── 02 - Meetings/
  ├── 03 - QBRs/
  ├── 04 - Contracts/
  └── 05 - Reports/
  ```
- Generate initial documents:
  - Onboarding Plan (from template)
  - Success Plan (draft)
  - Health Score Tracker (spreadsheet)
- Store folder references in customer record

### FR-3: Company Research
- Auto-research new customer:
  - Company overview and recent news
  - Industry context and trends
  - Key stakeholders from LinkedIn
  - Competitor landscape
  - Similar customer references
- Store research in customer profile

### FR-4: Welcome Email Preparation
- Generate personalized welcome email draft:
  - Congratulations on partnership
  - CSM introduction
  - What to expect in onboarding
  - Proposed kickoff meeting time slots
  - Resource links
- Queue for CSM approval

### FR-5: Kickoff Meeting Scheduling
- Check CSM calendar availability
- Propose 3 meeting time options
- Generate Calendly-style link or calendar hold
- Include meeting agenda template
- Set up Zoom meeting link

### FR-6: Internal Notification
- Notify relevant parties:
  - CSM via Slack with customer brief
  - CS Manager with assignment confirmation
  - Sales handoff notification
  - Support team awareness alert
- Include quick action buttons

### FR-7: Onboarding Plan Generation
- Create 30-60-90 day onboarding plan based on:
  - Contract terms and entitlements
  - Customer segment (enterprise, mid-market, SMB)
  - Product(s) purchased
  - Implementation complexity
- Identify key milestones and success criteria

## Non-Functional Requirements

### NFR-1: Performance
- Complete all setup tasks within 15 minutes
- Workspace creation < 2 minutes
- Research compilation < 5 minutes

### NFR-2: Reliability
- 99.9% success rate for workspace creation
- Retry failed operations automatically
- Manual fallback for blocked operations

### NFR-3: Customization
- Support customer segment-specific templates
- Allow CSM to customize generated materials
- Maintain brand consistency across outputs

## Technical Specifications

### Data Model
```typescript
interface OnboardingInitialization {
  customerId: string;
  assignedCsmId: string;
  assignedAt: Date;
  workspaceSetup: {
    folderId: string;
    folderUrl: string;
    documentsCreated: DocumentRef[];
  };
  research: {
    companyOverview: string;
    recentNews: NewsItem[];
    stakeholders: Stakeholder[];
    competitorLandscape: string;
    similarCustomers: CustomerRef[];
  };
  welcomeEmail: {
    draftId: string;
    approvalId: string;
    status: 'pending' | 'approved' | 'sent';
  };
  kickoffMeeting: {
    proposedSlots: TimeSlot[];
    meetingLink: string;
    agendaDocId: string;
  };
  onboardingPlan: {
    documentId: string;
    phases: OnboardingPhase[];
    milestones: Milestone[];
  };
  completedAt: Date;
  status: 'in_progress' | 'completed' | 'failed';
}
```

### API Endpoints
- `POST /api/workflows/onboarding/initialize` - Trigger onboarding setup
- `GET /api/workflows/onboarding/:customerId/status` - Check setup status
- `POST /api/workflows/onboarding/:customerId/approve-welcome` - Approve welcome email
- `POST /api/workflows/onboarding/:customerId/schedule-kickoff` - Confirm kickoff slot

### Agent Involvement
| Agent | Role |
|-------|------|
| Orchestrator | Coordinate onboarding initialization |
| Researcher | Company research and stakeholder mapping |
| Communicator | Welcome email drafting |
| Scheduler | Kickoff meeting scheduling |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Salesforce | IN | Opportunity won, account data |
| Google Drive | OUT | Workspace creation |
| Google Docs | OUT | Document generation |
| Google Calendar | OUT | Kickoff scheduling |
| Gmail | OUT | Welcome email |
| LinkedIn | IN | Stakeholder research |
| Slack | OUT | Internal notifications |

## UI/UX Requirements

### Onboarding Dashboard
- Visual progress indicator for setup steps
- Checklist view of completed/pending items
- Quick access to generated documents
- Calendar view of proposed kickoff slots

### Assignment Notification
- Rich notification card with customer summary
- One-click approve welcome email
- Quick schedule kickoff button
- Link to full customer profile

## Acceptance Criteria

### AC-1: Trigger Detection
- [ ] Salesforce opportunity won triggers within 5 minutes
- [ ] Manual customer creation triggers immediately
- [ ] Duplicate triggers are deduplicated

### AC-2: Workspace Setup
- [ ] All 5 folders created with correct naming
- [ ] Documents generated from correct templates
- [ ] Folder permissions set correctly
- [ ] Links stored in customer record

### AC-3: Research Quality
- [ ] Company overview accurate and current
- [ ] At least 3 key stakeholders identified
- [ ] Recent news from last 90 days
- [ ] Competitor information relevant

### AC-4: Welcome Email
- [ ] Personalized with customer and CSM names
- [ ] Includes all required sections
- [ ] Requires approval before sending
- [ ] Tracking enabled for opens/clicks

### AC-5: Kickoff Scheduling
- [ ] Proposes 3 valid time slots
- [ ] Respects CSM calendar availability
- [ ] Meeting link pre-generated
- [ ] Agenda template attached

### AC-6: Notifications
- [ ] CSM notified via Slack within 5 minutes
- [ ] Notification includes actionable summary
- [ ] Quick actions functional

## Dependencies
- PRD-028: Onboarding Welcome Sequence
- PRD-056: "Tell Me About [Account]" Command
- PRD-181: Salesforce Bi-Directional Sync
- PRD-188: Google Calendar Sync

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Google API rate limits | Medium | Medium | Queue and retry with backoff |
| Research data unavailable | Medium | Low | Proceed with partial data, flag gaps |
| Template mismatch | Low | Medium | Validate customer segment, fallback to generic |

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Setup completion time | < 15 min | End-to-end timing |
| Time to first customer contact | < 24 hours | Assignment to welcome sent |
| Kickoff scheduling rate | > 80% | Meetings booked within 7 days |
| CSM satisfaction | > 4.5/5 | Survey after first 10 uses |

## Implementation Notes
- Leverage existing `WorkspaceService` for folder creation
- Use `ResearchAgent` for company intelligence
- Template variables: `{{customerName}}`, `{{csmName}}`, `{{segment}}`, `{{products}}`
- Consider async processing with status polling for long-running operations
