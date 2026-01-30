# PRD-080: Custom Alert Configuration

## Metadata
- **PRD ID**: PRD-080
- **Category**: C - Account Intelligence
- **Priority**: P2
- **Estimated Complexity**: Medium
- **Dependencies**: PRD-086 (Usage Drop Alert), Trigger Engine

## Scenario Description
CSMs need the ability to create personalized alert rules for specific accounts or segments. The system should allow configuration of custom thresholds, conditions, and notification preferences so CSMs can be proactively alerted about issues that matter most to their portfolio.

## User Story
**As a** CSM managing a diverse portfolio,
**I want to** create custom alert rules with specific thresholds,
**So that** I receive relevant notifications tailored to each account's unique situation.

## Trigger
- CSM types: "Create alert for [customer] when [condition]"
- CSM accesses Alert Configuration from customer detail view
- CSM uses "Custom Alerts" section in Settings

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Triggers table | `triggers` table | Implemented | Stores trigger definitions |
| Trigger engine | `server/src/services/triggers/` | Implemented | Executes trigger logic |
| Risk signals | `risk_signals` table | Implemented | Stores detected signals |
| Health score tracking | `health_score_history` table | Implemented | Historical health data |

### What's Missing
- [ ] Custom threshold configuration UI
- [ ] Per-account alert rule creation
- [ ] Segment-based alert rules
- [ ] Alert rule templates library
- [ ] Notification channel preferences (Slack, email, in-app)
- [ ] Alert frequency/cooldown settings per rule

## Detailed Workflow

### Step 1: Rule Definition
- CSM specifies target (customer, segment, or portfolio-wide)
- Selects metric to monitor (health score, usage, engagement, etc.)
- Defines threshold and condition (above, below, change by)

### Step 2: Notification Setup
- Choose notification channels
- Set urgency level
- Configure cooldown period
- Add custom message template

### Step 3: Rule Activation
- Validate rule configuration
- Save to triggers table
- Enable real-time monitoring

### Step 4: Alert Execution
- Trigger engine evaluates conditions
- Fire alerts when thresholds crossed
- Log alert history for analysis

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/routes/triggers.ts` | Modify | Add custom alert CRUD endpoints |
| `server/src/services/triggers/customAlerts.ts` | Create | Custom alert logic |
| `components/AlertConfigModal.tsx` | Create | Alert configuration UI |
| `components/CustomerDetail/AlertsTab.tsx` | Create | Per-customer alerts view |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/triggers/custom` | POST | Create custom alert rule |
| `GET /api/triggers/custom` | GET | List user's custom alerts |
| `PUT /api/triggers/custom/:id` | PUT | Update alert rule |
| `DELETE /api/triggers/custom/:id` | DELETE | Delete alert rule |

### Database Changes
```sql
ALTER TABLE triggers ADD COLUMN rule_type VARCHAR(50) DEFAULT 'system';
ALTER TABLE triggers ADD COLUMN notification_channels JSONB;
ALTER TABLE triggers ADD COLUMN template_id UUID;
```

## Chat UI Flow
```
CSM: Create an alert for Acme Corp when health score drops below 60
System: I'll set up a custom alert for Acme Corp.

Alert Configuration:
- Customer: Acme Corp
- Metric: Health Score
- Condition: Drops below 60
- Current Value: 78

Notification Settings:
- Channels: Slack (default), Email
- Urgency: High
- Cooldown: 24 hours

[Create Alert] [Customize Settings] [Cancel]

CSM: Create Alert
System: Custom alert created successfully. You'll be notified via Slack and email when Acme Corp's health score drops below 60.
```

## Acceptance Criteria
- [ ] CSM can create custom alerts for specific customers
- [ ] Support for multiple metrics (health score, usage, NPS, etc.)
- [ ] Configurable thresholds with comparison operators
- [ ] Multiple notification channel support
- [ ] Cooldown periods prevent alert fatigue
- [ ] Alert history viewable per customer
- [ ] Bulk alert creation for segments

## Ralph Loop Notes
- **Learning**: Track which custom alerts lead to successful interventions
- **Optimization**: Suggest optimal thresholds based on historical data
- **Personalization**: Recommend alert rules based on portfolio patterns

### Completion Signal
```
<promise>PRD-080-COMPLETE</promise>
```
