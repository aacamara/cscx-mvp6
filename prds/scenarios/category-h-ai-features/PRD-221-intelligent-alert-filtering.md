# PRD-221: Intelligent Alert Filtering

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-221 |
| **Title** | Intelligent Alert Filtering |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs receive numerous alerts daily from various triggers (health score changes, usage drops, renewal approaching, etc.). Alert fatigue leads to important signals being missed while noise consumes attention. AI should intelligently filter, prioritize, and bundle alerts to ensure CSMs see what matters most without being overwhelmed.

## User Stories

### Primary User Stories
1. **As a CSM**, I want alerts intelligently ranked by actual business impact.
2. **As a CSM**, I want related alerts bundled together (multiple signals for same account).
3. **As a CSM**, I want AI to filter out noise (false positives, minor fluctuations).
4. **As a CSM**, I want to understand why an alert is important (context).
5. **As a CSM**, I want to train the system by marking alerts as useful or not.

### Secondary User Stories
1. **As a CSM**, I want quiet hours where only critical alerts come through.
2. **As a CSM**, I want alert summaries rather than individual notifications.
3. **As a CSM Manager**, I want to see which alerts are being ignored across the team.

## Acceptance Criteria

### Core Functionality
- [ ] AI scoring of alerts based on business impact
- [ ] Related alert bundling (same account, same timeframe)
- [ ] Noise filtering (statistical anomaly vs meaningful change)
- [ ] Context enrichment (why this matters now)
- [ ] Feedback loop for alert quality improvement

### Alert Processing
- [ ] Real-time alert scoring as alerts are generated
- [ ] Alert deduplication (don't alert on same thing twice)
- [ ] Alert correlation (connect related signals)
- [ ] Priority override for truly critical situations
- [ ] Delivery timing optimization

### Filtering Rules
- [ ] Filter minor fluctuations (health score +/- 5 points)
- [ ] Filter expected patterns (known seasonal dips)
- [ ] Filter already-known issues (active save play)
- [ ] Filter resolved situations (issue fixed but metric lag)
- [ ] Elevate patterns (3rd time this signal occurred)

## Technical Specification

### Architecture

```
Raw Alert → Alert Processor → AI Scorer → Bundler → Delivery Optimizer → User
                  ↓               ↓
            Filter Engine    Feedback Loop
```

### Alert Scoring Model

```typescript
interface AlertScore {
  raw_alert_id: string;
  impact_score: number;      // 0-100 business impact
  urgency_score: number;     // 0-100 time sensitivity
  confidence_score: number;  // 0-100 signal reliability
  final_score: number;       // Weighted combination
  factors: ScoreFactor[];
  delivery_recommendation: 'immediate' | 'digest' | 'suppress';
}

interface ScoreFactor {
  factor: string;
  weight: number;
  value: number;
  contribution: number;
  explanation: string;
}
```

### Scoring Algorithm

```typescript
function scoreAlert(alert: RawAlert, context: AlertContext): AlertScore {
  let impactScore = 0;
  let urgencyScore = 0;
  let confidenceScore = 0;

  // Account impact factors
  impactScore += getARRImpact(context.customer.arr);           // Higher ARR = higher impact
  impactScore += getHealthImpact(context.customer.health);     // Lower health = higher impact
  impactScore += getRenewalImpact(context.customer.renewal);   // Closer renewal = higher impact

  // Signal factors
  confidenceScore += getSignalReliability(alert.type);         // Some signals more reliable
  confidenceScore += getChangeVelocity(alert.metric_change);   // Rapid change = more reliable
  confidenceScore -= getNoiseLevel(alert.type, context);       // Account for normal variance

  // Urgency factors
  urgencyScore += getTimeSensitivity(alert.type);              // Escalations urgent
  urgencyScore += getDeadlineProximity(context);               // Near deadline = urgent
  urgencyScore -= getDuplication(alert, context.recent_alerts);// Already alerted = less urgent

  // Combine with weights
  const finalScore = (
    impactScore * 0.4 +
    urgencyScore * 0.35 +
    confidenceScore * 0.25
  );

  return {
    raw_alert_id: alert.id,
    impact_score: impactScore,
    urgency_score: urgencyScore,
    confidence_score: confidenceScore,
    final_score: finalScore,
    factors: generateFactors(...),
    delivery_recommendation: getDeliveryRecommendation(finalScore, context)
  };
}
```

### Alert Bundling

```typescript
interface AlertBundle {
  bundle_id: string;
  customer_id: string;
  alerts: ScoredAlert[];
  bundle_score: number;
  bundle_title: string;
  bundle_summary: string;
  recommended_action: string;
  created_at: Date;
}

function bundleAlerts(alerts: ScoredAlert[]): AlertBundle[] {
  // Group by customer
  const byCustomer = groupBy(alerts, 'customer_id');

  return Object.entries(byCustomer).map(([customerId, customerAlerts]) => {
    // Sort by score
    const sorted = customerAlerts.sort((a, b) => b.final_score - a.final_score);

    // Generate bundle summary using Claude
    const summary = generateBundleSummary(sorted);

    return {
      bundle_id: generateId(),
      customer_id: customerId,
      alerts: sorted,
      bundle_score: Math.max(...sorted.map(a => a.final_score)),
      bundle_title: summary.title,
      bundle_summary: summary.summary,
      recommended_action: summary.action
    };
  });
}
```

### API Endpoints

#### GET /api/alerts
```json
{
  "filters": {
    "min_score": 50,
    "status": "unread",
    "customer_id": "optional"
  },
  "format": "bundled" | "individual"
}
```

Response (bundled):
```json
{
  "bundles": [
    {
      "bundle_id": "uuid",
      "customer_name": "TechCorp Industries",
      "customer_id": "uuid",
      "bundle_score": 85,
      "title": "Multiple risk signals detected",
      "summary": "TechCorp shows converging risk signals: health dropped 15 points, usage down 30%, and champion went silent.",
      "alert_count": 3,
      "alerts": [
        {
          "id": "alert-1",
          "type": "health_score_drop",
          "score": 85,
          "detail": "Health score dropped from 65 to 50"
        },
        {
          "id": "alert-2",
          "type": "usage_drop",
          "score": 75,
          "detail": "DAU down 30% week over week"
        },
        {
          "id": "alert-3",
          "type": "engagement_drop",
          "score": 70,
          "detail": "No response to last 2 emails"
        }
      ],
      "recommended_action": "Schedule urgent check-in call",
      "created_at": "2026-01-29T08:00:00Z"
    }
  ],
  "suppressed_count": 12,
  "digest_count": 8
}
```

#### POST /api/alerts/{id}/feedback
```json
{
  "feedback": "helpful" | "not_helpful" | "already_knew" | "false_positive",
  "notes": "optional"
}
```

### Database Schema

```sql
CREATE TABLE alert_scores (
  id UUID PRIMARY KEY,
  raw_alert_id UUID,
  impact_score INTEGER,
  urgency_score INTEGER,
  confidence_score INTEGER,
  final_score INTEGER,
  factors JSONB,
  delivery_recommendation VARCHAR(20),
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_bundles (
  id UUID PRIMARY KEY,
  customer_id UUID,
  alert_ids UUID[],
  bundle_score INTEGER,
  title TEXT,
  summary TEXT,
  recommended_action TEXT,
  status VARCHAR(20) DEFAULT 'unread',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_feedback (
  id UUID PRIMARY KEY,
  alert_id UUID,
  user_id TEXT,
  feedback VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_suppressions (
  id UUID PRIMARY KEY,
  user_id TEXT,
  suppression_type VARCHAR(50),
  customer_id UUID,
  alert_type VARCHAR(50),
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## UI/UX Design

### Smart Alert Feed
```
┌─────────────────────────────────────────────────────────┐
│ ALERTS                                    🔔 5 priority │
│ [All] [Priority] [By Account] [Suppressed (12)]         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ CRITICAL                                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔴 TechCorp - Multiple risk signals      Score: 85  │ │
│ │ ───────────────────────────────────────────────────  │ │
│ │ Converging risk: health -15, usage -30%, silence    │ │
│ │                                                     │ │
│ │ 3 related alerts:                                   │ │
│ │ • Health score: 65 → 50 (critical threshold)       │ │
│ │ • Usage: DAU down 30%                              │ │
│ │ • Engagement: No response to last 2 emails          │ │
│ │                                                     │ │
│ │ Why this matters: $250K ARR, renewal in 60 days    │ │
│ │                                                     │ │
│ │ [Schedule Call] [View Account] [Snooze]             │ │
│ │                                                     │ │
│ │ Was this helpful? [👍] [👎] [Already knew]         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ HIGH PRIORITY                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🟠 Acme Corp - Renewal prep needed       Score: 72  │ │
│ │ Renewal in 45 days, no QBR scheduled yet            │ │
│ │ [Schedule QBR] [View Account]                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ 📊 DIGEST (8 alerts)                                    │
│ Lower priority alerts bundled in daily digest           │
│ [View Digest]                                           │
│                                                         │
│ 🔇 SUPPRESSED (12 alerts)                               │
│ Filtered: 5 minor fluctuations, 4 duplicates, 3 known  │
│ [Review Suppressed]                                     │
└─────────────────────────────────────────────────────────┘
```

### Alert Settings
```
┌─────────────────────────────────────────────────────────┐
│ ALERT PREFERENCES                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ DELIVERY SETTINGS                                       │
│ ─────────────────                                       │
│ Immediate alerts: Score > [75] ▼                        │
│ Daily digest: Score [50] - [75]                         │
│ Suppress: Score < [50]                                  │
│                                                         │
│ QUIET HOURS                                             │
│ ───────────                                             │
│ ☑ Enable quiet hours                                    │
│   From: [6:00 PM] To: [8:00 AM]                        │
│   ☑ Allow critical alerts (Score > 90)                 │
│                                                         │
│ NOISE FILTERING                                         │
│ ───────────────                                         │
│ ☑ Filter minor health score changes (< 10 points)      │
│ ☑ Filter known seasonal patterns                        │
│ ☑ Filter accounts with active save plays               │
│ ☐ Filter all non-critical alerts                        │
│                                                         │
│ [Save Preferences]                                      │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Alert/trigger system (existing)
- Health score calculation
- Claude API for summarization
- Real-time processing pipeline

### Related PRDs
- PRD-086: Usage Drop Alert → Check-In Workflow
- PRD-107: Health Score Threshold Alert
- PRD-217: Automated Insight Generation

## Success Metrics

### Quantitative
- Alert fatigue reduction: 50% fewer total alerts shown
- Critical alert visibility: 100% of Score>80 alerts seen
- False positive rate: < 10%
- Action rate on alerts: > 50% (up from baseline)

### Qualitative
- CSMs feel alerts are relevant and actionable
- Important signals are never missed
- Alert bundling makes context clear

## Rollout Plan

### Phase 1: Scoring (Week 1-2)
- Basic impact scoring algorithm
- Priority-based delivery
- Simple filtering rules

### Phase 2: Bundling (Week 3-4)
- Related alert bundling
- AI-generated summaries
- Recommended actions

### Phase 3: Feedback (Week 5-6)
- Feedback collection UI
- Learning from feedback
- Personal preference tuning

### Phase 4: Intelligence (Week 7-8)
- Pattern-based filtering
- Quiet hours
- Cross-account correlation

## Open Questions
1. What's the right default threshold for immediate vs digest?
2. Should managers be able to set team-wide alert policies?
3. How do we handle alerts that span multiple accounts?
4. What's the retention policy for suppressed alerts?
