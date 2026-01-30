# PRD-177: Year-over-Year Comparison Report

## Metadata
- **PRD ID**: PRD-177
- **Category**: F - Reporting & Analytics
- **Priority**: P2
- **Estimated Complexity**: Medium
- **Dependencies**: PRD-170 (Trend Analysis), Data Warehouse

## Scenario Description
CSMs and CS leaders need to compare key metrics year-over-year to understand growth patterns, identify seasonal trends, and measure improvement over time. The report should support multiple metrics and provide context for significant changes.

## User Story
**As a** CS leader,
**I want to** view year-over-year comparisons of key metrics,
**So that** I can understand long-term trends and measure team improvement.

## Trigger
- CSM asks: "Show me YoY comparison for [metric]"
- User navigates to Reports > Year-over-Year
- Scheduled monthly report generation

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Health score history | `health_score_history` table | Implemented | Historical health data |
| Revenue data | `customers.arr` | Implemented | Current ARR values |
| Usage metrics | `usage_metrics` table | Implemented | Historical usage |
| Reporting framework | N/A | Partial | Basic reports exist |

### What's Missing
- [ ] YoY calculation engine
- [ ] Multi-year data retention policies
- [ ] Seasonal adjustment algorithms
- [ ] Cohort-based comparisons
- [ ] Variance highlighting and explanation
- [ ] Export and scheduling capabilities

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/reports/yoyComparison.ts` | Create | YoY calculation service |
| `server/src/routes/reports.ts` | Modify | Add YoY endpoint |
| `components/Reports/YoYComparison.tsx` | Create | YoY report UI |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/reports/yoy` | GET | Get YoY comparison data |
| `GET /api/reports/yoy/:metric` | GET | Get specific metric YoY |

### Database Changes
None - uses existing historical tables.

## Chat UI Flow
```
CSM: Show me year-over-year comparison for retention
System: Generating Year-over-Year Retention Comparison...

**Retention Rate YoY Comparison**

| Period | This Year | Last Year | Change |
|--------|-----------|-----------|--------|
| Q1 | 94% | 89% | +5% ✅ |
| Q2 | 92% | 87% | +5% ✅ |
| Q3 | 95% | 91% | +4% ✅ |
| Q4 | 93% | 88% | +5% ✅ |

**Annual Summary:**
- FY2025: 93.5% retention
- FY2024: 88.8% retention
- Improvement: +4.7 percentage points

**Key Drivers:**
- Improved onboarding process (+2%)
- Proactive risk intervention (+1.5%)
- Enhanced support response (+1.2%)

[Export PDF] [Schedule Monthly] [Compare Other Metrics]
```

## Acceptance Criteria
- [ ] Compare metrics across calendar or fiscal years
- [ ] Support multiple metrics (retention, NRR, health score, etc.)
- [ ] Highlight significant variances with explanations
- [ ] Allow drill-down by segment or cohort
- [ ] Export to PDF and Excel
- [ ] Schedule recurring report delivery

## Ralph Loop Notes
- **Learning**: Track which YoY insights drive strategic decisions
- **Optimization**: Auto-highlight most significant changes
- **Personalization**: Remember preferred metrics per user

### Completion Signal
```
<promise>PRD-177-COMPLETE</promise>
```
