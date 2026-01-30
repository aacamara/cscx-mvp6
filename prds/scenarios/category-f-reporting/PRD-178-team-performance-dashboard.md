# PRD-178: Team Performance Dashboard

## Metadata
- **PRD ID**: PRD-178
- **Category**: F - Reporting & Analytics
- **Priority**: P1
- **Estimated Complexity**: High
- **Dependencies**: PRD-151 (Weekly Summary), User Management

## Scenario Description
CS leaders need visibility into team performance across key metrics including retention, response times, activity levels, and portfolio health. The dashboard should enable comparison across team members while supporting coaching conversations.

## User Story
**As a** CS leader,
**I want to** view a dashboard of team performance metrics,
**So that** I can identify coaching opportunities and recognize high performers.

## Trigger
- Leader navigates to Reports > Team Performance
- Leader asks: "How is my team performing?"
- Weekly automated team summary email

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| User assignments | `customers.csm_id` | Implemented | Customer ownership |
| Activity log | `agent_activity_log` | Implemented | CSM activities tracked |
| Health scores | `health_score_history` | Implemented | Portfolio health |
| Customer data | `customers` table | Implemented | ARR, status, etc. |

### What's Missing
- [ ] Team-level aggregation queries
- [ ] CSM performance scoring algorithm
- [ ] Activity benchmarking
- [ ] Response time tracking
- [ ] Goal setting and tracking
- [ ] Leaderboard and gamification

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/reports/teamPerformance.ts` | Create | Team metrics service |
| `server/src/routes/reports.ts` | Modify | Add team performance endpoint |
| `components/Reports/TeamPerformance.tsx` | Create | Team dashboard UI |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/reports/team-performance` | GET | Get team performance data |
| `GET /api/reports/team-performance/:userId` | GET | Get individual CSM metrics |
| `POST /api/reports/team-performance/goals` | POST | Set team goals |

### Database Changes
```sql
CREATE TABLE csm_goals (
  id UUID PRIMARY KEY,
  user_id UUID,
  metric VARCHAR(50),
  target_value DECIMAL,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ
);
```

## Chat UI Flow
```
Leader: How is my team performing this month?
System: Generating Team Performance Dashboard...

**Team Performance - January 2026**

| CSM | Portfolio | Retention | NRR | Health Avg | Activity Score |
|-----|-----------|-----------|-----|------------|----------------|
| Sarah Chen | $2.5M | 98% | 112% | 82 | 95 |
| Mike Torres | $1.8M | 95% | 105% | 78 | 88 |
| Jennifer Park | $2.1M | 92% | 98% | 75 | 82 |
| Team Avg | $2.1M | 95% | 105% | 78 | 88 |

**Highlights:**
- 🏆 Sarah Chen: Highest retention and expansion
- 📈 Mike Torres: Improved from 90% → 95% retention
- ⚠️ Jennifer Park: Below target on NRR (goal: 105%)

**Team Goals Progress:**
- Retention: 95% / 96% goal (99% to target)
- NRR: 105% / 110% goal (95% to target)
- Avg Health: 78 / 80 goal (97% to target)

[View Individual Details] [Set New Goals] [Export Report]
```

## Acceptance Criteria
- [ ] Display team-level and individual CSM metrics
- [ ] Support key metrics: retention, NRR, health score, activity
- [ ] Compare against goals and benchmarks
- [ ] Trend over time (MoM, QoQ)
- [ ] Drill-down to individual CSM details
- [ ] Goal setting and tracking
- [ ] Export and scheduling capabilities

## Ralph Loop Notes
- **Learning**: Identify which metrics correlate with customer outcomes
- **Optimization**: Suggest realistic goals based on historical performance
- **Personalization**: Highlight coaching opportunities per leader

### Completion Signal
```
<promise>PRD-178-COMPLETE</promise>
```
