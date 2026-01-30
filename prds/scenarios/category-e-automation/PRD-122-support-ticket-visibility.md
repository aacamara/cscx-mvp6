# PRD-122: Support Ticket → CSM Visibility

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-122 |
| **Title** | Support Ticket → CSM Visibility |
| **Category** | E: Workflow Automation |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs often lack visibility into support tickets for their accounts, discovering issues only when customers escalate directly. This reactive position damages trust and prevents proactive relationship management.

## User Story
**As a** CSM
**I want** automatic notification and visibility when support tickets are created or updated for my accounts
**So that** I can stay informed about customer issues and proactively support resolution

## Functional Requirements

### FR-1: Ticket Detection
- Monitor support ticket systems for:
  - New ticket creation for assigned accounts
  - Ticket status changes
  - Priority escalations
  - Customer replies
  - Resolution and closure
- Support integrations: Zendesk, Intercom, Salesforce Service Cloud

### FR-2: Intelligent Filtering
- Filter notifications based on:
  - Ticket priority (P1/P2 always, P3/P4 configurable)
  - Customer tier (enterprise always, configurable for others)
  - Issue type (security, downtime always escalate)
  - Ticket age (notify if aging beyond SLA)
- Avoid notification fatigue with smart batching

### FR-3: CSM Notification
- Notify CSM via configured channels:
  - Slack DM for urgent tickets
  - Email digest for routine tickets
  - In-app notification always
- Include ticket context:
  - Customer name and health score
  - Ticket summary and priority
  - Assigned support rep
  - Current status and age

### FR-4: Customer Dashboard Integration
- Display support tickets in customer profile:
  - Open tickets count and list
  - Recent closed tickets
  - Ticket trends over time
  - CSAT scores from tickets
- Highlight concerning patterns

### FR-5: Context Enrichment
- Add relevant context to ticket view:
  - Customer health score
  - Recent CSM interactions
  - Upcoming renewals
  - Related previous tickets
  - Stakeholder contact info

### FR-6: CSM Actions
- Enable CSM actions from ticket view:
  - Add internal note
  - Request escalation
  - Reach out to customer
  - Loop in team member
  - Link to risk signal

### FR-7: Ticket Pattern Analysis
- Analyze ticket patterns for insights:
  - Recurring issues
  - Feature gaps
  - Training needs
  - Risk indicators
- Generate recommendations

## Non-Functional Requirements

### NFR-1: Timeliness
- P1/P2 ticket notification < 5 minutes
- P3/P4 ticket notification < 1 hour (or batched daily)
- Real-time dashboard updates

### NFR-2: Completeness
- 100% ticket capture
- No missed escalations
- Full ticket history available

### NFR-3: Privacy
- Respect ticket privacy settings
- Only show to assigned CSM
- Audit access logs

## Technical Specifications

### Data Model
```typescript
interface SupportTicket {
  id: string;
  externalId: string;
  source: 'zendesk' | 'intercom' | 'salesforce_service';
  customerId: string;
  subject: string;
  description: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'new' | 'open' | 'pending' | 'solved' | 'closed';
  category: string;
  assignedAgent: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  csat: number | null;
  firstResponseTime: number | null;
  resolutionTime: number | null;
}

interface TicketNotification {
  ticketId: string;
  customerId: string;
  csmId: string;
  notificationType: 'new' | 'update' | 'escalation' | 'resolution' | 'aging';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  channels: ('slack' | 'email' | 'in_app')[];
  sentAt: Date;
  acknowledgedAt: Date | null;
}
```

### API Endpoints
- `GET /api/tickets/customer/:customerId` - Get customer tickets
- `GET /api/tickets/:ticketId` - Get ticket details
- `POST /api/tickets/:ticketId/note` - Add CSM note
- `POST /api/tickets/:ticketId/escalate` - Request escalation
- `GET /api/tickets/csm/:csmId/summary` - Get CSM ticket summary

### Agent Involvement
| Agent | Role |
|-------|------|
| Monitor | Track ticket activity |
| Orchestrator | Route notifications |
| Researcher | Analyze patterns |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Zendesk | IN | Tickets, updates |
| Intercom | IN | Conversations |
| Salesforce Service | IN | Cases |
| Slack | OUT | CSM notifications |
| Email | OUT | Digest notifications |

## UI/UX Requirements

### Customer Profile Tickets Section
- Open tickets prominently displayed
- Priority color coding
- Quick expand for details
- Status timeline view

### Ticket List View
- Filterable by customer, priority, status
- Sortable by age, priority, customer
- Bulk actions for acknowledgment
- Export capability

### Notification Settings
- Per-CSM configuration
- Priority threshold selection
- Channel preferences
- Batch timing options

## Acceptance Criteria

### AC-1: Ticket Detection
- [ ] New tickets detected within SLA
- [ ] Status changes captured
- [ ] Escalations flagged immediately

### AC-2: Notification Delivery
- [ ] P1/P2 tickets notify within 5 minutes
- [ ] Notifications include required context
- [ ] Correct channels used

### AC-3: Dashboard Integration
- [ ] Tickets visible in customer profile
- [ ] Count accurate and real-time
- [ ] History accessible

### AC-4: CSM Actions
- [ ] Internal notes sync to support system
- [ ] Escalation request processed
- [ ] Customer outreach tracked

### AC-5: Pattern Analysis
- [ ] Recurring issues identified
- [ ] Risk signals generated appropriately
- [ ] Recommendations actionable

## Dependencies
- PRD-184: Zendesk Ticket Integration
- PRD-185: Intercom Conversation Sync
- PRD-087: Support Ticket Spike → Escalation
- PRD-156: Support Metrics Dashboard

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Notification overload | High | Medium | Smart filtering and batching |
| Stale data | Medium | Medium | Real-time sync, cache invalidation |
| Integration downtime | Low | High | Queue notifications, retry logic |

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| CSM awareness | 100% | P1/P2 tickets acknowledged |
| Proactive outreach | > 30% | CSM contact before customer escalates |
| Time to acknowledge | < 4 hours | Notification to CSM action |
| Customer satisfaction | +10% | CSAT score improvement |

## Implementation Notes
- Use webhook subscriptions where available
- Implement polling fallback for systems without webhooks
- Consider ticket deduplication for multi-channel submissions
- Build notification preference UI early
