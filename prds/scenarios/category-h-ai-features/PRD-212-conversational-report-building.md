# PRD-212: Conversational Report Building

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-212 |
| **Title** | Conversational Report Building |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Creating reports in traditional CS platforms requires navigating complex report builders, understanding filter syntax, and knowing which fields exist. CSMs often need quick insights but don't have time to build formal reports. They should be able to describe what they want in natural language and have the system generate the report automatically.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to say "Create a report showing all my accounts by health score" and get a formatted report instantly.
2. **As a CSM**, I want to ask "Show me a chart of renewal revenue by quarter" and see a visualization.
3. **As a CSM Manager**, I want to request "Generate a weekly summary of at-risk accounts for my team" and receive a formatted document.
4. **As a CSM**, I want to refine reports conversationally: "Add the account owner column" or "Filter to just enterprise accounts."
5. **As a CSM**, I want to save reports generated from conversation for future use.

### Secondary User Stories
1. **As a CSM**, I want to schedule conversationally-built reports to run weekly.
2. **As a CSM**, I want to export reports to Google Sheets or PDF.
3. **As a CSM**, I want to share reports with my manager directly from chat.

## Acceptance Criteria

### Core Functionality
- [ ] System understands natural language requests for reports and dashboards
- [ ] Generates appropriate visualizations (tables, charts, metrics cards)
- [ ] Supports iterative refinement through conversation
- [ ] Reports can be saved, named, and scheduled
- [ ] Exports to Google Sheets, PDF, and shareable links

### Report Types Supported
- [ ] Tabular reports (account lists, stakeholder directories)
- [ ] Metric summaries (portfolio health, ARR totals)
- [ ] Time-series charts (health trends, usage over time)
- [ ] Comparison charts (account vs account, period vs period)
- [ ] Funnel visualizations (onboarding stages, renewal pipeline)
- [ ] Distribution charts (health score distribution, ARR by segment)

### Conversation Features
- [ ] Multi-turn refinement ("Now group by industry")
- [ ] Undo/redo support ("Go back to the previous version")
- [ ] Clarification requests when query is ambiguous
- [ ] Suggestions for additional insights

## Technical Specification

### Architecture
```
User Request → Intent Parser → Report Schema Generator → Data Query → Visualization Engine → Report Renderer → Export Service
```

### Components

#### 1. Report Intent Parser
Uses Claude to extract:
- Report type (table, chart, metric)
- Data entities (accounts, stakeholders, usage, etc.)
- Metrics to include
- Filters and groupings
- Time ranges
- Visualization preferences

#### 2. Report Schema Generator
```typescript
interface ReportSchema {
  type: 'table' | 'chart' | 'metric' | 'dashboard';
  title: string;
  description: string;
  dataSource: DataSource;
  columns?: ColumnDefinition[];
  chartConfig?: ChartConfiguration;
  filters: Filter[];
  groupBy?: string[];
  orderBy?: OrderConfig;
  limit?: number;
}

interface DataSource {
  entity: 'customers' | 'stakeholders' | 'usage_metrics' | 'risk_signals' | 'renewals';
  joins?: JoinDefinition[];
  aggregations?: AggregationConfig[];
}
```

#### 3. Visualization Engine
- Generates chart specifications compatible with frontend charting library
- Supports: bar, line, area, pie, gauge, table, metric card
- Auto-selects appropriate visualization based on data shape

#### 4. Report Persistence
```sql
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  schema JSONB NOT NULL,
  conversation_history JSONB,
  schedule JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

#### POST /api/ai/report/build
```json
{
  "request": "Show me a report of accounts by health score with ARR",
  "session_id": "conversation-context",
  "existing_report_id": "optional-for-refinement"
}
```

Response:
```json
{
  "report_id": "temp-uuid",
  "schema": { ... },
  "data": [ ... ],
  "visualization": {
    "type": "table",
    "config": { ... }
  },
  "suggestions": [
    "Add trend indicators",
    "Group by segment",
    "Filter to at-risk only"
  ],
  "actions": ["save", "export_sheets", "export_pdf", "schedule"]
}
```

#### POST /api/reports/save
```json
{
  "report_id": "temp-uuid",
  "name": "Weekly Health Report",
  "schedule": {
    "frequency": "weekly",
    "day": "monday",
    "time": "08:00"
  }
}
```

### Integration with Google Workspace
- Export to Google Sheets using existing sheets.ts service
- Export to Google Slides for presentations
- Use existing document templates with report data injection

## UI/UX Design

### Chat-Based Report Building
```
User: "Create a report showing accounts at risk of churning"

AI: I'll create an at-risk accounts report. Here's what I've generated:

[Report Preview]
Title: At-Risk Accounts Report
Type: Table with risk indicators

| Account | Health | ARR | Risk Signals | Days to Renewal |
|---------|--------|-----|--------------|-----------------|
| TechCorp | 35 | $120K | 3 active | 45 |
| GlobalCo | 42 | $85K | 2 active | 90 |
...

Would you like to:
- Add more columns (usage trends, last contact)
- Apply filters (segment, CSM)
- Change visualization (chart view)
- Save this report

User: "Add usage trend and sort by ARR descending"

AI: Updated. The report now includes usage trends and is sorted by ARR:

[Updated Report Preview]
...
```

### Report Builder Panel
- Live preview updates as conversation progresses
- Column drag-and-drop reordering
- Click-to-filter on values
- Chart type selector with previews

### Saved Reports Gallery
- Grid view of saved reports
- Quick run/refresh
- Edit via conversation or traditional UI
- Schedule indicator badges

## Dependencies

### Required Infrastructure
- Claude API for NL processing
- Chart rendering library (Recharts/Chart.js)
- PDF generation service
- Google Sheets API integration (existing)

### Related PRDs
- PRD-180: Custom Report Builder
- PRD-151: Personal Weekly Summary Report
- PRD-211: Natural Language Account Query

## Success Metrics

### Quantitative
- Report generation accuracy > 90%
- Average report creation time < 60 seconds (vs 5+ minutes traditional)
- 70% of generated reports saved or exported
- 30% of reports scheduled for recurring delivery

### Qualitative
- Users prefer conversational builder over traditional UI
- Reports meet CSM needs without manual adjustment
- Reduced requests to data team for custom reports

## Rollout Plan

### Phase 1: Basic Reports (Week 1-2)
- Table reports with filtering
- Account list reports
- Basic export to CSV

### Phase 2: Visualizations (Week 3-4)
- Chart generation (bar, line, pie)
- Metric cards and dashboards
- Google Sheets export

### Phase 3: Advanced Features (Week 5-6)
- Multi-turn conversation refinement
- Save and schedule reports
- PDF export with branding

### Phase 4: Polish (Week 7-8)
- Report templates library
- Sharing and permissions
- Performance optimization

## Open Questions
1. How detailed should the report schema be exposed to users?
2. Should we support report sharing across team members?
3. What's the storage/retention policy for saved reports?
4. How do we handle very large result sets?
