# PRD-119: Expansion Signal → Sales Routing

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-119 |
| **Title** | Expansion Signal → Sales Routing |
| **Category** | E: Workflow Automation |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs frequently identify expansion opportunities through customer interactions, usage patterns, and meeting discussions. However, routing these signals to sales is often manual, delayed, or inconsistent, resulting in missed revenue opportunities and poor handoff experiences.

## User Story
**As a** CSM
**I want** automatic routing of expansion signals to the appropriate sales team with full context
**So that** we can capitalize on opportunities quickly while maintaining a seamless customer experience

## Functional Requirements

### FR-1: Expansion Signal Detection
- Detect expansion signals from multiple sources:
  - Usage growth exceeding seat/license count
  - Feature adoption indicating need for upgrade
  - Explicit customer requests in meetings
  - Budget discussions in email threads
  - Health score above expansion threshold
  - Contract approaching capacity limits
- Classify signal strength: strong, moderate, exploratory

### FR-2: Signal Enrichment
- Enrich detected signal with context:
  - Current contract terms and entitlements
  - Usage metrics and trends
  - Relationship strength indicators
  - Previous expansion history
  - Competitive landscape
  - Budget cycle timing (if known)
  - Champion and decision-maker status

### FR-3: Sales Rep Matching
- Determine appropriate sales recipient:
  - Original AE (if still active)
  - Territory-based rep
  - Named account executive
  - Expansion sales specialist
  - CSM-assigned sales partner
- Support configurable routing rules

### FR-4: Opportunity Creation
- Create expansion opportunity record:
  - Auto-populate in Salesforce/HubSpot
  - Include expansion type (upsell, cross-sell, seats, tier)
  - Attach supporting context
  - Set initial stage and probability
  - Link to customer account
- Store in `expansion_opportunities` table

### FR-5: Handoff Communication
- Generate handoff package for sales:
  - Executive summary of opportunity
  - Customer health and relationship status
  - Key stakeholders and roles
  - Recommended approach
  - Potential objections and responses
  - Timeline considerations
- Send via Slack DM and email

### FR-6: CSM-Sales Coordination
- Create shared visibility:
  - Both CSM and sales see opportunity status
  - Activity log shared between teams
  - Meeting coordination enabled
  - Customer communication tracked
- Prevent duplicate outreach

### FR-7: Feedback Loop
- Track opportunity outcomes
- Update routing algorithms based on:
  - Win/loss rates by signal type
  - Time to close by rep
  - Customer feedback
- Continuous improvement of signal detection

## Non-Functional Requirements

### NFR-1: Speed
- Signal detection within 1 hour of occurrence
- Routing completion within 15 minutes
- Sales notification immediate

### NFR-2: Accuracy
- Signal precision > 80% (true expansion intent)
- Routing accuracy > 95% (correct sales rep)
- Context completeness > 90%

### NFR-3: Integration
- Seamless CRM synchronization
- Real-time status updates
- Bi-directional data flow

## Technical Specifications

### Data Model
```typescript
interface ExpansionSignal {
  id: string;
  customerId: string;
  signalType: 'usage_growth' | 'feature_adoption' | 'explicit_request' |
              'budget_discussion' | 'capacity_limit' | 'health_indicator';
  signalStrength: 'strong' | 'moderate' | 'exploratory';
  source: 'usage_data' | 'meeting_transcript' | 'email' | 'manual' | 'system';
  sourceReference: string;
  detectedAt: Date;
  details: Record<string, any>;
}

interface ExpansionRouting {
  signalId: string;
  customerId: string;
  routedToUserId: string;
  routedToRole: 'ae' | 'expansion_rep' | 'territory_rep';
  routingReason: string;
  opportunityId: string;
  handoffPackage: {
    summary: string;
    healthScore: number;
    arrCurrent: number;
    arrPotential: number;
    stakeholders: StakeholderInfo[];
    recommendedApproach: string;
    timeline: string;
  };
  status: 'pending' | 'acknowledged' | 'in_progress' | 'won' | 'lost';
  salesFeedback: string | null;
  outcomeArrChange: number | null;
  routedAt: Date;
  acknowledgedAt: Date | null;
  closedAt: Date | null;
}
```

### API Endpoints
- `POST /api/expansion/signal` - Log expansion signal
- `GET /api/expansion/:customerId/signals` - Get customer signals
- `POST /api/expansion/:signalId/route` - Route to sales
- `GET /api/expansion/:opportunityId/status` - Check opportunity status
- `POST /api/expansion/:opportunityId/feedback` - Record outcome

### Agent Involvement
| Agent | Role |
|-------|------|
| Monitor | Detect expansion signals from data |
| Researcher | Enrich signal with context |
| Expansion | Evaluate opportunity and route |
| Communicator | Generate handoff package |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Usage Data | IN | Growth patterns |
| Meeting Analysis | IN | Expansion mentions |
| Email Analysis | IN | Budget discussions |
| Salesforce | OUT | Opportunity creation |
| Slack | OUT | Sales notification |
| CRM | BI-DIR | Opportunity status |

## UI/UX Requirements

### Expansion Signal Dashboard
- List of detected signals by customer
- Signal strength indicators
- Status tracking (detected → routed → outcome)
- Filter by type, strength, status

### Routing Confirmation
- Preview of routing destination
- Edit opportunity details before routing
- Override routing if needed
- Add CSM notes

### Sales Handoff View
- Clean summary for sales rep
- Key metrics at a glance
- Stakeholder cards with roles
- Recommended next steps
- One-click acknowledge

## Acceptance Criteria

### AC-1: Signal Detection
- [ ] Usage growth signals detected within 1 hour
- [ ] Meeting transcript signals captured same day
- [ ] Manual signals can be logged by CSM
- [ ] Duplicate signals deduplicated

### AC-2: Signal Quality
- [ ] Context includes all required elements
- [ ] ARR potential estimate reasonable
- [ ] Stakeholders accurately identified

### AC-3: Routing Accuracy
- [ ] Correct sales rep identified > 95%
- [ ] Routing completes within 15 minutes
- [ ] Fallback routing works when primary unavailable

### AC-4: CRM Integration
- [ ] Opportunity created in Salesforce
- [ ] All fields properly populated
- [ ] Account linkage correct
- [ ] Stage and probability set

### AC-5: Sales Notification
- [ ] Slack DM sent immediately
- [ ] Handoff package complete
- [ ] Acknowledge button functional

### AC-6: Feedback Loop
- [ ] Outcome recorded when opportunity closes
- [ ] Win/loss data feeds back to system
- [ ] Reporting available on signal performance

## Dependencies
- PRD-103: Expansion Signal Detected
- PRD-060: Expansion Opportunity Finder
- PRD-181: Salesforce Bi-Directional Sync
- PRD-238: Expansion Propensity Modeling

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| False positive signals | Medium | Medium | Require CSM confirmation for weak signals |
| Sales rep not responsive | Medium | High | Escalation path after 48 hours |
| Customer contacted twice | Low | High | Shared activity log, coordination rules |

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Signal-to-opportunity rate | > 60% | Routed signals becoming opportunities |
| Opportunity win rate | > 30% | Closed won vs total routed |
| Time to acknowledgment | < 4 hours | Routing to sales response |
| ARR from routed signals | Track | Revenue attributed to automation |

## Implementation Notes
- Leverage existing `expansion_opportunities` table
- Use `MeetingAnalysisService` for transcript signals
- Implement configurable routing rules engine
- Consider ML model for signal strength scoring
