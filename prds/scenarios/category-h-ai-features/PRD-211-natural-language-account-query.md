# PRD-211: Natural Language Account Query

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-211 |
| **Title** | Natural Language Account Query |
| **Category** | H: AI-Powered Features |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs need to quickly access account information but currently must navigate through multiple screens, run reports, or execute specific queries. This interrupts workflow and requires knowledge of where data lives. CSMs should be able to ask questions in natural language like "What's the health score for Acme Corp?" or "Show me all accounts renewing next quarter" and get immediate, contextual answers.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to ask "Tell me about [account name]" and get a comprehensive summary including health score, ARR, renewal date, recent activity, and risk signals.
2. **As a CSM**, I want to ask "What accounts need attention today?" and see a prioritized list based on health scores, pending tasks, and recent signals.
3. **As a CSM**, I want to ask "Who are the key stakeholders at [account]?" and see contact information, roles, and relationship status.
4. **As a CSM**, I want to ask "What's happening with [account]'s usage?" and see usage trends, adoption scores, and anomalies.
5. **As a CSM**, I want to ask complex questions like "Show me enterprise accounts with declining health scores in the manufacturing industry" and get filtered results.

### Secondary User Stories
1. **As a CSM Manager**, I want to ask "How is my team's portfolio health?" and see aggregate metrics across all team accounts.
2. **As a CSM**, I want to ask follow-up questions that maintain context from previous queries.
3. **As a CSM**, I want to export query results to a report or spreadsheet.

## Acceptance Criteria

### Core Functionality
- [ ] System understands natural language queries about accounts, stakeholders, health scores, usage, renewals, and risk signals
- [ ] Queries can reference accounts by name (exact or fuzzy match)
- [ ] System returns structured responses with relevant data visualizations where appropriate
- [ ] Response time under 3 seconds for simple queries, under 10 seconds for complex aggregations
- [ ] System maintains conversation context for follow-up questions within a session

### Query Types Supported
- [ ] Account summary ("Tell me about X")
- [ ] Account list queries ("Show me accounts with...")
- [ ] Metric queries ("What's the health score for...")
- [ ] Stakeholder queries ("Who are the contacts at...")
- [ ] Usage queries ("How is X using the product?")
- [ ] Timeline queries ("What happened with X last month?")
- [ ] Comparison queries ("Compare X and Y accounts")
- [ ] Aggregation queries ("Total ARR at risk this quarter")

### Data Sources
- [ ] Customers table (name, ARR, industry, stage, health_score, renewal_date)
- [ ] Stakeholders table (contacts, roles, sentiment)
- [ ] Usage metrics (DAU, WAU, MAU, adoption_score, feature_adoption)
- [ ] Risk signals (type, severity, status)
- [ ] Meetings and meeting analyses
- [ ] Activity log (recent interactions)
- [ ] Renewal pipeline

### Error Handling
- [ ] Graceful handling of ambiguous account names (prompt for clarification)
- [ ] Clear messaging when no data is available
- [ ] Suggestions for reformulating unclear queries
- [ ] Fallback to keyword search when NL parsing fails

## Technical Specification

### Architecture
```
User Query → NL Parser (Claude) → Intent Classification → Query Builder → Database Query → Response Formatter → AI Summary → User
```

### Components

#### 1. Intent Classifier
- Uses Claude to classify query intent into categories:
  - `account_summary` - General account information
  - `account_list` - Filtered list of accounts
  - `metric_query` - Specific metric values
  - `stakeholder_query` - Contact/relationship information
  - `usage_query` - Product usage data
  - `timeline_query` - Historical events
  - `comparison_query` - Compare multiple accounts
  - `aggregation_query` - Portfolio-level metrics

#### 2. Entity Extractor
- Extract account names (fuzzy matching against customers table)
- Extract date ranges ("last month", "Q1 2026", "next 90 days")
- Extract filters (industry, segment, health score thresholds)
- Extract metrics of interest

#### 3. Query Builder
- Converts extracted intents and entities into database queries
- Supports complex joins across customers, stakeholders, usage_metrics, risk_signals
- Applies CSM-scoped filters (user can only query their assigned accounts)

#### 4. Response Formatter
- Structures data for presentation
- Generates summary text using Claude
- Creates inline visualizations (sparklines, health indicators)

### API Endpoints

#### POST /api/ai/query
```json
{
  "query": "Tell me about Acme Corp",
  "session_id": "optional-for-context",
  "include_visualization": true
}
```

Response:
```json
{
  "intent": "account_summary",
  "entities": {
    "account_name": "Acme Corporation",
    "account_id": "uuid"
  },
  "data": {
    "customer": { ... },
    "stakeholders": [ ... ],
    "recent_activity": [ ... ],
    "risk_signals": [ ... ]
  },
  "summary": "Acme Corporation is a $150K ARR enterprise account in the manufacturing sector...",
  "visualizations": [ ... ],
  "suggestions": ["Ask about their usage trends", "View renewal timeline"]
}
```

### Database Queries

#### Account Summary Query
```sql
SELECT
  c.*,
  COUNT(DISTINCT s.id) as stakeholder_count,
  COUNT(DISTINCT rs.id) FILTER (WHERE rs.resolved_at IS NULL) as open_risk_signals,
  (SELECT score FROM health_score_history
   WHERE customer_id = c.id ORDER BY recorded_at DESC LIMIT 1) as latest_health_score
FROM customers c
LEFT JOIN stakeholders s ON s.customer_id = c.id
LEFT JOIN risk_signals rs ON rs.customer_id = c.id
WHERE c.id = $1 AND c.csm_id = $2
GROUP BY c.id;
```

### Integration Points
- **Chat UI**: Primary interface through AIPanel
- **Customer Detail**: Quick query from account context
- **Dashboard**: Portfolio-wide queries
- **Voice**: Future voice-enabled queries (PRD-264)

## UI/UX Design

### Chat Interface Integration
- Query input in AIPanel message input
- Streaming response with structured data cards
- Interactive elements for drilling down
- Quick action buttons for common follow-ups

### Response Card Types
1. **Account Summary Card**: Health gauge, ARR, renewal countdown, key metrics
2. **Account List Card**: Sortable table with key columns, click to expand
3. **Stakeholder Card**: Contact info, role badges, sentiment indicators
4. **Usage Chart Card**: Trend lines, comparison to benchmarks
5. **Risk Signal Card**: Severity badges, descriptions, resolution status

### Example Interaction Flow
```
User: "What accounts need attention today?"

AI: Based on current signals, here are your priority accounts:

[Account Card: TechCorp Industries]
- Health Score: 42 (down 15 from last week)
- Risk Signal: Usage dropped 40% this week
- Action: Schedule check-in call

[Account Card: Global Services Inc]
- Health Score: 55 (stable)
- Risk Signal: Champion departure detected
- Action: Multi-thread stakeholder outreach

[Quick Actions]
[Draft Check-In Email] [Schedule Meeting] [View All At-Risk]
```

## Dependencies

### Required Infrastructure
- Claude API access for NL processing
- Supabase database with full schema
- Real-time health score calculation

### Related PRDs
- PRD-056: "Tell Me About [Account]" Command (foundational)
- PRD-057: "What Accounts Need Attention?" Briefing
- PRD-223: Conversation Context Retention
- PRD-219: AI-Powered Universal Search

## Success Metrics

### Quantitative
- Query accuracy rate > 95% (correct intent classification)
- Response time < 3s for 90% of queries
- User adoption: > 50% of CSMs use daily within 30 days
- Reduction in navigation clicks by 40%

### Qualitative
- User satisfaction score > 4.5/5
- Reduction in "I can't find..." support requests
- Positive feedback on response relevance

## Rollout Plan

### Phase 1: Foundation (Week 1-2)
- Implement intent classifier with top 5 query types
- Account summary queries
- Basic account list queries

### Phase 2: Expansion (Week 3-4)
- Add metric, stakeholder, and usage queries
- Implement fuzzy account name matching
- Add conversation context retention

### Phase 3: Advanced (Week 5-6)
- Complex aggregation queries
- Comparison queries
- Export to report functionality

### Phase 4: Optimization (Week 7-8)
- Performance optimization
- Expand entity recognition
- Add query suggestions/autocomplete

## Open Questions
1. Should we cache common query results for performance?
2. How do we handle queries spanning multiple CSM portfolios (manager view)?
3. What's the appropriate level of detail in AI-generated summaries?
4. Should we log all queries for analytics and improvement?

## Appendix

### Sample Query → Intent Mappings
| Query | Intent | Entities |
|-------|--------|----------|
| "Tell me about Acme" | account_summary | account_name: "Acme" |
| "Show accounts with health < 50" | account_list | filter: health_score < 50 |
| "What's TechCorp's renewal date?" | metric_query | account: "TechCorp", metric: "renewal_date" |
| "Compare Acme and TechCorp" | comparison_query | accounts: ["Acme", "TechCorp"] |
| "Total ARR renewing in Q1" | aggregation_query | metric: "ARR", period: "Q1 2026" |
