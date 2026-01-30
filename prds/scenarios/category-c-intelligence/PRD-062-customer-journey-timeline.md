# PRD-062: Customer Journey Timeline

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Provide a comprehensive, chronological timeline view of all customer interactions, milestones, and events across the entire customer lifecycle. This unified timeline aggregates data from emails, meetings, support tickets, product usage, contract events, and internal notes to give CSMs complete context on the customer's journey.

## User Story
As a CSM, I want to see a complete timeline of everything that has happened with a customer so that I can quickly understand their history, identify patterns, and prepare for conversations with full context.

As a new CSM taking over an account, I want to review the customer's journey timeline so that I can get up to speed quickly without asking the previous CSM for a lengthy handoff.

## Trigger
- Navigation: Customer Detail > Timeline Tab
- Natural language: "Show me the timeline for [Account]"
- Variations: "What's the history with [Account]?", "Account timeline", "Journey view"

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to display |
| Date Range | Object | No | Start/end filter (default: all) |
| Event Types | String[] | No | Filter by event type |
| Include Internal | Boolean | No | Show internal notes (default: true) |

## Event Types
### Customer-Facing Events
| Type | Source | Icon | Description |
|------|--------|------|-------------|
| `meeting` | Calendar, Zoom | Calendar | Scheduled meetings |
| `email_sent` | Gmail | Outbox | Emails sent to customer |
| `email_received` | Gmail | Inbox | Emails from customer |
| `call` | Zoom, Transcript | Phone | Phone/video calls |
| `support_ticket` | Integration | Ticket | Support tickets |
| `nps_survey` | Survey | Star | NPS responses |
| `qbr` | QBRs table | Presentation | QBR meetings |
| `training` | Sessions | Graduation | Training sessions |

### Contract Events
| Type | Source | Icon | Description |
|------|--------|------|-------------|
| `contract_signed` | Contracts | Document | Initial contract |
| `contract_renewed` | Contracts | Refresh | Renewal |
| `contract_expanded` | Contracts | Growth | Expansion |
| `contract_amendment` | Contracts | Edit | Changes |

### Health Events
| Type | Source | Icon | Description |
|------|--------|------|-------------|
| `health_change` | Health History | Heart | Significant change |
| `risk_signal` | Risk Signals | Warning | Risk detected |
| `risk_resolved` | Risk Signals | Check | Risk resolved |

### Usage Events
| Type | Source | Icon | Description |
|------|--------|------|-------------|
| `usage_milestone` | Usage Metrics | Trophy | Usage achievement |
| `feature_adopted` | Usage Events | Star | New feature adoption |
| `usage_drop` | Usage Metrics | TrendDown | Significant decline |

### Internal Events
| Type | Source | Icon | Description |
|------|--------|------|-------------|
| `internal_note` | Notes | Note | CSM notes |
| `csm_change` | Activity Log | UserSwitch | CSM assignment |
| `escalation` | Save Plays | Alert | Internal escalation |

## Process Flow
```
Request Timeline
       │
       ▼
┌──────────────────────────┐
│ Fetch Customer Context   │
│ (Basic info, ownership)  │
└───────────┬──────────────┘
            │
    ┌───────┴───────┐
    │ Parallel Fetch │
    └───────┬───────┘
            │
┌───────────┼───────────────┬────────────────┬─────────────────┐
▼           ▼               ▼                ▼                 ▼
Meetings  Emails        Contracts       Health/Risk        Usage
History   (Gmail)       Events          Events             Events
   │         │              │                │                 │
   └─────────┴──────────────┴────────────────┴─────────────────┘
                            │
                            ▼
             ┌──────────────────────────┐
             │ Merge & Sort by Date     │
             │ (Chronological order)    │
             └───────────┬──────────────┘
                         │
                         ▼
             ┌──────────────────────────┐
             │ Group by Period          │
             │ (Day, Week, Month)       │
             └───────────┬──────────────┘
                         │
                         ▼
                Render Timeline
```

## Output Format
```markdown
## Customer Journey Timeline: Acme Corp
Customer Since: January 15, 2024 (12 months)
Total Events: 156

### Quick Stats
| Metric | Value |
|--------|-------|
| Meetings | 24 |
| Emails Exchanged | 89 |
| Support Tickets | 12 |
| Health Changes | 8 |
| Contract Events | 3 |

### Filter: [All Events ▼] Date Range: [All Time ▼]

---

### January 2026

#### January 28, 2026
**10:30 AM** - Meeting: Monthly Check-In
- Attendees: Sarah Chen, Mike Johnson, You
- Duration: 45 minutes
- Summary: Discussed Q1 goals, expansion to marketing team
- Sentiment: Positive
- [View Recording] [View Notes]

**9:15 AM** - Email Sent: Follow-up on analytics demo
- To: Sarah Chen
- Subject: Re: Analytics Module Questions
- [View Thread]

---

#### January 21, 2026
**2:00 PM** - Health Score Change: 78 → 85 (+7)
- Reason: Usage increase, positive NPS received
- [View Details]

**11:00 AM** - NPS Survey Response: Score 9
- Comment: "The team loves the new dashboard features!"
- [View Response] [Send Thank You]

---

### December 2025

#### December 15, 2025
**3:30 PM** - Support Ticket Opened: API Integration Issue
- Priority: High
- Status: Resolved (Dec 18)
- Resolution Time: 3 days
- [View Ticket]

---

### Key Milestones

#### Contract Events
- **Jan 15, 2024**: Initial contract signed - $120,000 ARR
- **Jul 15, 2024**: Contract expanded - +$30,000 ARR
- **Jan 15, 2025**: Renewal signed - $150,000 ARR

#### Stakeholder Changes
- **Mar 10, 2024**: Champion identified (Sarah Chen)
- **Sep 5, 2024**: Exec sponsor added (Tom Williams, CEO)

#### Health Journey
[Visual chart showing health score over time with key events marked]

---

### Activity Heatmap
[Calendar heatmap showing interaction density by day]

### Communication Summary
| Direction | Count | Avg Response Time |
|-----------|-------|-------------------|
| Outbound | 52 | - |
| Inbound | 37 | 4.2 hours |
| Meetings | 24 | - |
```

## Visualization Components
```typescript
interface TimelineView {
  events: TimelineEvent[];
  milestones: Milestone[];
  stats: {
    totalEvents: number;
    byType: Record<EventType, number>;
    communicationBalance: CommunicationStats;
  };
  charts: {
    healthOverTime: LineChart;
    activityHeatmap: CalendarHeatmap;
    eventTypeDistribution: PieChart;
  };
}

interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: EventType;
  title: string;
  description: string;
  participants?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  source: string;
  links: EventLink[];
  internal: boolean;
}
```

## Acceptance Criteria
- [ ] All event types displayed correctly with icons
- [ ] Events sorted chronologically (newest first by default)
- [ ] Filtering by event type works
- [ ] Date range filtering works
- [ ] Events grouped by day/week/month
- [ ] Links to source systems functional
- [ ] Health score chart displayed
- [ ] Activity heatmap shows interaction density
- [ ] Internal notes toggle works
- [ ] Pagination for large timelines (>100 events)
- [ ] Search within timeline

## API Endpoint
```
GET /api/intelligence/timeline/:customerId
  Query: ?startDate=2025-01-01&types=meeting,email&limit=100

Response: {
  customer: CustomerSummary;
  events: TimelineEvent[];
  milestones: Milestone[];
  stats: TimelineStats;
  pagination: {
    total: number;
    page: number;
    hasMore: boolean;
  };
}
```

## Data Sources
| Source | Table/API | Events Retrieved |
|--------|-----------|------------------|
| Meetings | `meetings` + Google Calendar | All scheduled meetings |
| Emails | Gmail API | Sent/received emails |
| Contracts | `contracts` | Contract events |
| Health | `health_score_history` | Significant changes |
| Risk | `risk_signals` | Signal events |
| Usage | `usage_metrics` | Usage milestones |
| Support | Integration (Zendesk, etc.) | Tickets |
| QBRs | `qbrs` | QBR sessions |
| Notes | Internal notes table | CSM notes |
| Activity | `agent_activity_log` | System events |

## Performance Requirements
| Requirement | Target |
|-------------|--------|
| Initial Load (100 events) | < 2 seconds |
| Scroll/Load More | < 500ms |
| Filter Application | < 300ms |
| Search Results | < 1 second |

## Error Handling
| Error | Response |
|-------|----------|
| No events found | Show empty state with "No activity recorded yet" |
| Gmail not connected | Show available data, note "Connect Gmail for email history" |
| Large timeline | Paginate with "Load More" button |

## Success Metrics
| Metric | Target |
|--------|--------|
| Timeline Views per CSM/week | > 15 |
| Time Spent on Timeline | 3-5 minutes avg |
| Handoff Preparation Time | -50% reduction |
| CSM Context Before Calls | +40% report feeling prepared |

## Future Enhancements
- AI-generated journey summary
- Predictive events ("Renewal due in 30 days")
- Comparative timelines (account A vs B)
- Share timeline snapshot externally
- Mobile-optimized timeline view

## Related PRDs
- PRD-056: "Tell Me About [Account]" Command
- PRD-077: Meeting History & Outcomes
- PRD-065: Support History Summary
- PRD-081: Account Notes Search
