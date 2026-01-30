# PRD-056: "Tell Me About [Account]" Command

## Category
**Category C: Account Intelligence**

## Priority
**P0** - Foundation Tier

## Overview
Enable CSMs to instantly retrieve a comprehensive account briefing through natural language by asking "Tell me about [Account Name]". This foundational intelligence capability provides a 360-degree view of any customer account in seconds, consolidating data from all connected sources into an actionable summary.

## User Story
As a CSM, I want to ask "Tell me about Acme Corp" and instantly receive a comprehensive account summary so that I can quickly prepare for meetings, respond to stakeholder questions, or understand an account's current state without manual data gathering.

## Trigger
- Natural language command: "Tell me about [Account Name]"
- Variations: "Brief me on [Account]", "What's the story with [Account]?", "Give me the rundown on [Account]", "Account summary for [Account]"

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Account Name | String | Yes | Customer/company name (fuzzy matching supported) |
| Focus Area | String | No | Optional: "health", "renewal", "stakeholders", "usage" |
| Time Period | String | No | Optional: "last 30 days", "this quarter", etc. |

## Process Flow
```
User Request
    │
    ▼
┌─────────────────────────┐
│ Parse Account Identifier │
│ (Fuzzy name matching)   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Fetch Core Customer Data │
│ (customers table)        │
└───────────┬─────────────┘
            │
    ┌───────┴───────┐
    │ Parallel Fetch │
    └───────┬───────┘
            │
    ┌───────┼───────────────┬────────────────┬─────────────────┐
    ▼       ▼               ▼                ▼                 ▼
┌──────┐ ┌──────────┐ ┌───────────┐ ┌───────────────┐ ┌──────────────┐
│Health│ │Stakeholders│ │Risk Signals│ │Usage Metrics │ │Recent Activity│
│Score │ │& Contacts │ │& Alerts   │ │& Adoption    │ │& Meetings    │
└──┬───┘ └─────┬────┘ └─────┬─────┘ └───────┬──────┘ └──────┬───────┘
   │           │             │               │                │
   └───────────┴─────────────┴───────────────┴────────────────┘
                             │
                             ▼
               ┌─────────────────────────┐
               │ AI Synthesizes Summary  │
               │ (Claude analysis)       │
               └───────────┬─────────────┘
                           │
                           ▼
               ┌─────────────────────────┐
               │ Generate Structured     │
               │ Account Briefing        │
               └───────────┬─────────────┘
                           │
                           ▼
                  Display to CSM
```

## Output Format
### Account Briefing Structure
```markdown
## [Account Name] - Account Briefing
Generated: [Timestamp]

### Quick Stats
| Metric | Value | Trend |
|--------|-------|-------|
| ARR | $XXX,XXX | +X% YoY |
| Health Score | XX/100 | [Growing/Stable/Declining] |
| Stage | [Active/At-Risk/Onboarding] | |
| Renewal Date | [Date] | [X days away] |
| CSM | [Name] | |

### Executive Summary
[2-3 sentence AI-generated summary of the account's current state,
highlighting key wins, concerns, and opportunities]

### Key Stakeholders
| Name | Role | Sentiment | Last Contact |
|------|------|-----------|--------------|
| [Name] | [Title] | [Positive/Neutral/Negative] | [Date] |

### Health Indicators
- **Usage Score**: XX/100 - [Brief explanation]
- **Engagement Score**: XX/100 - [Brief explanation]
- **Sentiment Score**: XX/100 - [Brief explanation]

### Active Risk Signals
- [Risk 1]: [Severity] - [Description]
- [Risk 2]: [Severity] - [Description]

### Recent Activity (Last 30 Days)
- [Date]: [Activity type] - [Description]
- [Date]: [Activity type] - [Description]

### Expansion Opportunities
- [Opportunity 1]: $XX,XXX potential - [Stage]

### Recommended Actions
1. [Action 1] - [Priority]
2. [Action 2] - [Priority]
```

## Data Sources
| Source | Table/API | Data Retrieved |
|--------|-----------|----------------|
| Core Profile | `customers` | name, ARR, industry, stage, health_score, renewal_date |
| Stakeholders | `stakeholders` | All contacts with roles, sentiment |
| Contracts | `contracts` | Active contract terms, entitlements |
| Usage Metrics | `usage_metrics` | DAU, MAU, adoption score, trends |
| Risk Signals | `risk_signals` | Active unresolved signals |
| Meetings | `meetings` + `meeting_analyses` | Recent meeting history, outcomes |
| Health History | `health_score_history` | Score trends over time |
| Expansion | `expansion_opportunities` | Active opportunities |
| Renewal | `renewal_pipeline` | Renewal stage, probability |
| QBRs | `qbrs` | Recent QBR outcomes |

## AI Processing
### Synthesis Prompt
```
You are a Customer Success AI analyst. Given the following account data,
generate a concise executive summary and recommended actions.

Account Data:
{{customer_data}}

Focus on:
1. Overall account health trajectory
2. Key relationship strengths and gaps
3. Immediate concerns requiring attention
4. Growth opportunities
5. Time-sensitive items

Be specific, actionable, and data-driven in your analysis.
```

## Acceptance Criteria
- [ ] Fuzzy name matching works with partial names and typos
- [ ] Response generated within 5 seconds
- [ ] All data sections populated when data exists
- [ ] Graceful handling when data is missing (show "No data available")
- [ ] AI summary is coherent and actionable
- [ ] Trends calculated correctly (comparing to previous period)
- [ ] Risk signals sorted by severity
- [ ] Recommended actions are specific and prioritized
- [ ] Works via chat command and programmatic API

## API Endpoint
```
GET /api/intelligence/account-briefing/:customerId
POST /api/intelligence/account-briefing/search
  Body: { "accountName": "Acme Corp", "focusArea": "health" }
```

## Dependencies
- Customer data populated in `customers` table
- Health score calculation service active
- Usage metrics ingestion configured
- AI model (Claude) available for synthesis

## Error Handling
| Error | Response |
|-------|----------|
| Account not found | "I couldn't find an account matching '[name]'. Did you mean [suggestions]?" |
| Multiple matches | "I found multiple accounts: [list]. Which one did you mean?" |
| Data incomplete | Show available data with "[Section] - No data available" for missing sections |
| AI synthesis fails | Return structured data without AI summary |

## Success Metrics
| Metric | Target |
|--------|--------|
| Response Time | < 5 seconds |
| Usage Frequency | > 10 queries/CSM/week |
| Data Completeness | > 80% of sections populated |
| CSM Satisfaction | > 4.5/5 rating |

## Future Enhancements
- Voice command support: "Hey CSCX, tell me about Acme"
- Comparative mode: "Tell me about Acme compared to their peers"
- Time-travel mode: "Tell me about Acme as of last quarter"
- Export to PDF/Doc for sharing
- Slack slash command: `/cscx-account Acme Corp`

## Related PRDs
- PRD-057: "What Accounts Need Attention?" Briefing
- PRD-058: Account Comparison Tool
- PRD-069: Account Success Metrics
- PRD-211: Natural Language Account Query
