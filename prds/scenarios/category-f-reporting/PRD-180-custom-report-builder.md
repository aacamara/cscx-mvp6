# PRD-180: Custom Report Builder

## Metadata
- **PRD ID**: PRD-180
- **Category**: F - Reporting & Analytics
- **Priority**: P2
- **Estimated Complexity**: High
- **Dependencies**: All reporting PRDs, Data Warehouse

## Scenario Description
CSMs and leaders need the flexibility to create custom reports combining various metrics, filters, and visualizations. The report builder should allow drag-and-drop creation, saving templates, and scheduling delivery.

## User Story
**As a** CS leader with unique reporting needs,
**I want to** build custom reports without technical assistance,
**So that** I can answer specific business questions quickly.

## Trigger
- User navigates to Reports > Custom Report Builder
- User asks: "Create a report showing [specific criteria]"
- User wants to modify an existing report template

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Data sources | Various tables | Implemented | All data available |
| Basic reports | N/A | Implemented | Pre-built reports |
| Export capability | N/A | Partial | CSV exists |

### What's Missing
- [ ] Drag-and-drop report builder UI
- [ ] Custom metric definitions
- [ ] Advanced filtering and grouping
- [ ] Multiple visualization options
- [ ] Report template saving
- [ ] Scheduled report delivery
- [ ] Report sharing and permissions

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/reports/customBuilder.ts` | Create | Custom report engine |
| `server/src/routes/reports.ts` | Modify | Add custom report endpoints |
| `components/Reports/CustomBuilder.tsx` | Create | Report builder UI |
| `components/Reports/ReportCanvas.tsx` | Create | Drag-drop canvas |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/reports/custom` | POST | Create custom report |
| `GET /api/reports/custom` | GET | List saved reports |
| `PUT /api/reports/custom/:id` | PUT | Update report |
| `POST /api/reports/custom/:id/execute` | POST | Run report |
| `POST /api/reports/custom/:id/schedule` | POST | Schedule report |

### Database Changes
```sql
CREATE TABLE custom_reports (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  config JSONB,
  created_by UUID,
  is_template BOOLEAN DEFAULT false,
  shared_with JSONB,
  schedule JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## Chat UI Flow
```
CSM: Create a report showing at-risk accounts with ARR over $100K grouped by CSM
System: I'll help you build a custom report.

**Custom Report Builder**

**Data Source:** Customers
**Filters:**
- Health Score < 50 (At Risk)
- ARR > $100,000

**Columns Selected:**
- Customer Name
- ARR
- Health Score
- CSM Name
- Days Since Last Contact
- Primary Risk Factor

**Group By:** CSM Name
**Sort By:** ARR (Descending)

**Preview (5 of 12 results):**

| Customer | ARR | Health | CSM | Days Silent | Risk |
|----------|-----|--------|-----|-------------|------|
| TechCorp | $250K | 42 | Sarah | 15 | Usage Drop |
| DataFlow | $180K | 38 | Mike | 22 | Champion Left |
| CloudFirst | $150K | 45 | Sarah | 8 | Support Issues |

[Save Report] [Schedule Weekly] [Export CSV] [Add Visualization]
```

## Acceptance Criteria
- [ ] Select from available data sources (customers, renewals, etc.)
- [ ] Apply multiple filters with AND/OR logic
- [ ] Choose columns to display
- [ ] Group and sort results
- [ ] Multiple visualization types (table, chart, graph)
- [ ] Save as template for reuse
- [ ] Schedule recurring execution and delivery
- [ ] Share reports with team members
- [ ] Export to CSV, Excel, PDF

## Ralph Loop Notes
- **Learning**: Track most commonly created report types
- **Optimization**: Suggest report templates based on patterns
- **Personalization**: Remember user's preferred metrics and formats

### Completion Signal
```
<promise>PRD-180-COMPLETE</promise>
```
