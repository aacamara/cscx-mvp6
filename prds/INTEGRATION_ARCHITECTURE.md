# CSCX.AI v3 - Integration Architecture Plan

## Overview

This document outlines how 275 PRD implementations integrate into the CSCX.AI frontend architecture. The platform uses a **Hybrid UI approach** combining a minimal dashboard with AI-powered feature access.

## Current UI Structure

```
App.tsx (5 views)
├── /customers          → CustomerList.tsx
├── /customers/:id      → CustomerDetail.tsx (with WorkspacePanel)
├── /onboarding         → UnifiedOnboarding.tsx (with AIPanel)
├── /login              → Login.tsx
└── /auth-callback      → AuthCallback.tsx
```

### Key UI Components
| Component | Location | Purpose |
|-----------|----------|---------|
| AIPanel | `components/AIPanel/` | Context-aware chat assistant |
| WorkspacePanel | `components/WorkspacePanel.tsx` | Per-customer Google Workspace |
| AgentControlCenter | `components/AgentControlCenter/` | Agent observability (modal) |
| CustomerDetail | `components/CustomerDetail.tsx` | 360° customer view with tabs |

---

## Integration Strategy: Hybrid UI

### Tier 1: Dashboard Features (Always Visible)
High-frequency features with dedicated UI placement.

| Feature | PRD | UI Location | Component |
|---------|-----|-------------|-----------|
| At-Risk Portfolio | PRD-061 | Dashboard Card | `<AtRiskPortfolioCard />` |
| Renewal Pipeline | PRD-059 | Dashboard Card | `<RenewalPipelineCard />` |
| Health Score Overview | PRD-153 | Dashboard Card | `<HealthScorePortfolio />` |
| Today's Tasks | PRD-149 | Dashboard Card | `<TaskAssignmentCard />` |
| Active Alerts | PRD-107 | Dashboard Card | `<AlertsOverviewCard />` |
| Weekly Summary | PRD-151 | Dashboard Card | `<WeeklySummaryCard />` |

### Tier 2: Customer Detail Tabs
Features accessed within customer context.

| Feature | PRD | Tab Name | Component |
|---------|-----|----------|-----------|
| Health Score Trends | PRD-060 | Health | `<HealthScoreTrends />` |
| Stakeholder Map | PRD-063 | Contacts | `<StakeholderMap />` |
| Product Adoption | PRD-064 | Usage | `<ProductAdoptionDashboard />` |
| Support History | PRD-065 | Support | `<SupportHistory />` |
| Contract Terms | PRD-067 | Contract | `<ContractTermsView />` |
| Communication Timeline | PRD-034 | Activity | `<CommunicationTimeline />` |
| Sentiment Analysis | PRD-218 | Sentiment | `<SentimentPanel />` |
| Expansion Signals | PRD-103 | Opportunities | `<ExpansionSignals />` |

### Tier 3: AI Panel Actions
Features invoked through chat commands. The AI Panel renders appropriate components.

#### Document Generation (Category A)
```
User: "Upload customer data from CSV"
→ AI renders <CSVUploadWizard />

User: "Import contracts for Acme"
→ AI renders <PDFContractUpload customerId="..." />
```

#### Communication (Category B)
```
User: "Generate QBR email for Acme"
→ AI renders <QBREmailGenerator customerId="..." />

User: "Create renewal proposal"
→ AI renders <RenewalProposalGenerator />

User: "Draft check-in email for silent accounts"
→ AI renders <CheckInEmailGenerator />
```

#### Intelligence (Category C)
```
User: "Show churn prediction for my portfolio"
→ AI renders <ChurnPredictionView />

User: "Compare Acme to similar accounts"
→ AI renders <BenchmarkComparison customerId="..." />

User: "What's the NRR for Q4?"
→ AI renders <NRRCalculator period="Q4" />
```

#### Alerts (Category D)
```
User: "Show usage drop alerts"
→ AI renders <UsageDropAlerts />

User: "What accounts have support escalations?"
→ AI renders <SupportEscalationList />
```

#### Automation (Category E)
```
User: "Set up onboarding sequence for new customer"
→ AI renders <OnboardingSequenceBuilder />

User: "Create QBR prep automation"
→ AI renders <QBRAutoPrepConfig />
```

#### Reporting (Category F)
```
User: "Generate team performance report"
→ AI renders <TeamPerformanceDashboard />

User: "Show renewal forecast"
→ AI renders <RenewalForecastReport />
```

### Tier 4: Command Palette (Cmd+K)
Power user access to all features via fuzzy search.

```typescript
// Command registry structure
const commands = [
  { id: 'qbr-email', label: 'Generate QBR Email', component: QBREmailGenerator },
  { id: 'churn-risk', label: 'View Churn Risk', component: ChurnPredictionView },
  { id: 'renewal-proposal', label: 'Create Renewal Proposal', component: RenewalProposalGenerator },
  // ... 275 commands
];
```

---

## Component Organization

### New Directory Structure
```
components/
├── AIPanel/                    # Existing - Chat interface
├── Dashboard/                  # NEW - Dashboard cards
│   ├── AtRiskPortfolioCard.tsx
│   ├── RenewalPipelineCard.tsx
│   ├── HealthScorePortfolio.tsx
│   ├── TaskAssignmentCard.tsx
│   ├── AlertsOverviewCard.tsx
│   └── index.tsx
├── CustomerDetail/             # EXPAND - Customer context features
│   ├── tabs/
│   │   ├── HealthTab.tsx
│   │   ├── ContactsTab.tsx
│   │   ├── UsageTab.tsx
│   │   ├── SupportTab.tsx
│   │   ├── ContractTab.tsx
│   │   └── ActivityTab.tsx
│   └── index.tsx
├── Documents/                  # Category A
│   ├── CSVUploadWizard.tsx
│   ├── PDFContractUpload.tsx
│   ├── ExcelUpload.tsx
│   └── ...
├── Communication/              # Category B
│   ├── QBREmailGenerator.tsx
│   ├── RenewalProposalGenerator.tsx
│   ├── OnboardingSequenceBuilder.tsx
│   └── ...
├── Intelligence/               # Category C
│   ├── ChurnPredictionView.tsx
│   ├── BenchmarkComparison.tsx
│   ├── CohortAnalysis.tsx
│   └── ...
├── Alerts/                     # Category D
│   ├── UsageDropAlerts.tsx
│   ├── SupportEscalationList.tsx
│   ├── ChampionDepartureAlert.tsx
│   └── ...
├── Automation/                 # Category E
│   ├── OnboardingAutomation.tsx
│   ├── QBRAutoPrepConfig.tsx
│   ├── RenewalReminder.tsx
│   └── ...
├── Reporting/                  # Category F
│   ├── TeamPerformanceDashboard.tsx
│   ├── RenewalForecastReport.tsx
│   ├── ChurnAnalysisReport.tsx
│   └── ...
├── Integrations/               # Category G
│   ├── SalesforceSync.tsx
│   ├── HubSpotIntegration.tsx
│   ├── SlackNotifications.tsx
│   └── ...
├── AIFeatures/                 # Category H
│   ├── SmartRecommendations.tsx
│   ├── SentimentAnalysis.tsx
│   ├── MeetingPrep.tsx
│   └── ...
├── Collaboration/              # Category I
│   ├── TeamWorkspace.tsx
│   ├── ActivityFeed.tsx
│   ├── CommentSystem.tsx
│   └── ...
├── Mobile/                     # Category J
│   ├── TouchGestures.tsx
│   ├── OfflineMode.tsx
│   └── ...
└── CommandPalette/             # NEW - Cmd+K interface
    ├── CommandPalette.tsx
    ├── commands.ts
    └── index.tsx
```

---

## AI Panel Integration

### Component Registry
The AI Panel needs to know which components it can render:

```typescript
// server/src/agents/componentRegistry.ts
export const componentRegistry = {
  // Documents
  'csv-upload': { component: 'CSVUploadWizard', category: 'documents' },
  'pdf-contract': { component: 'PDFContractUpload', category: 'documents' },

  // Communication
  'qbr-email': { component: 'QBREmailGenerator', category: 'communication' },
  'renewal-proposal': { component: 'RenewalProposalGenerator', category: 'communication' },

  // Intelligence
  'churn-prediction': { component: 'ChurnPredictionView', category: 'intelligence' },
  'benchmark': { component: 'BenchmarkComparison', category: 'intelligence' },

  // ... all 275 features
};
```

### Agent Response Format
When the AI determines a component should be rendered:

```typescript
interface AgentResponse {
  type: 'text' | 'component' | 'action';
  content?: string;
  component?: {
    name: string;
    props: Record<string, any>;
  };
  action?: {
    type: string;
    payload: any;
  };
}
```

---

## Navigation Updates

### New Dashboard View
Add a dashboard as the default landing page:

```typescript
// App.tsx updates
const views = {
  'dashboard': DashboardView,      // NEW - Default landing
  'customers': CustomerList,
  'customer-detail': CustomerDetail,
  'onboarding': UnifiedOnboarding,
  'login': Login,
  'auth-callback': AuthCallback,
};
```

### Dashboard Layout
```
┌─────────────────────────────────────────────────────────────┐
│  CSCX.AI                    [Search] [Cmd+K] [Notifications]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ At-Risk (5) │  │ Renewals    │  │ Health      │         │
│  │ Accounts    │  │ This Month  │  │ Portfolio   │         │
│  │             │  │ $1.2M ARR   │  │ Avg: 72     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Tasks (12)  │  │ Alerts (3)  │  │ Weekly      │         │
│  │ Due Today   │  │ Need Action │  │ Summary     │         │
│  │             │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    AI Assistant                         ││
│  │  "What would you like to do today?"                     ││
│  │  [________________________________________________]     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Post-PRD)
1. Create Dashboard view with 6 core cards
2. Add CommandPalette component
3. Update App.tsx navigation
4. Create component registry

### Phase 2: Customer Detail Enhancement
1. Add new tabs to CustomerDetail
2. Wire up tab components
3. Add contextual actions

### Phase 3: AI Panel Wiring
1. Implement component rendering in AIPanel
2. Connect componentRegistry to agent responses
3. Add natural language → component mapping

### Phase 4: Polish
1. Consistent styling across all components
2. Loading states and error handling
3. Mobile responsiveness
4. Accessibility compliance

---

## File Mapping Reference

Quick reference for where PRD implementations should be integrated:

| PRD Range | Category | Component Directory | UI Access |
|-----------|----------|---------------------|-----------|
| 001-025 | Documents | `components/Documents/` | AI Panel |
| 026-055 | Communication | `components/Communication/` | AI Panel |
| 056-085 | Intelligence | `components/Intelligence/` | Dashboard + AI |
| 086-115 | Alerts | `components/Alerts/` | Dashboard + AI |
| 116-150 | Automation | `components/Automation/` | AI Panel |
| 151-180 | Reporting | `components/Reporting/` | AI Panel |
| 181-210 | Integrations | `components/Integrations/` | Settings |
| 211-240 | AI Features | `components/AIFeatures/` | AI Panel |
| 241-260 | Collaboration | `components/Collaboration/` | Dashboard |
| 261-275 | Mobile/Access | `components/Mobile/` | Global |

---

## Success Metrics

After integration, measure:
- **Feature discoverability**: Can users find features they need?
- **AI Panel usage**: % of features accessed via chat vs direct navigation
- **Command palette adoption**: Power user engagement
- **Task completion time**: How fast can common workflows be completed?

---

Last Updated: 2026-01-30
