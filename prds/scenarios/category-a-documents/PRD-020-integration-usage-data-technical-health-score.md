# PRD-020: Integration Usage Data → Technical Health Score

## Metadata
- **PRD ID**: PRD-020
- **Category**: A - Documents & Data Processing
- **Priority**: P1
- **Estimated Complexity**: High
- **Dependencies**: Technical monitoring, health score system

## Scenario Description
A CSM uploads integration usage data (API calls, webhook deliveries, error logs) and the system calculates a technical health score, identifies integration issues, detects degradation patterns, and recommends technical interventions before issues impact the customer relationship.

## User Story
**As a** CSM using the Chat UI,
**I want to** upload integration data and receive a technical health score,
**So that** I can proactively address technical issues before they affect customer satisfaction.

## Trigger
CSM uploads integration/API usage data via Chat UI with a message like "Calculate technical health from this integration data."

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Health score | `customers.health_score` | Implemented | General health |
| API usage ingestion | `/api/v1/usage` | Implemented | Can ingest API events |
| Usage metrics | `usage_metrics.api_calls` | Implemented | Stores API call counts |
| Circuit breakers | Internal monitoring | Implemented | For our integrations |

### What's Missing
- [ ] Technical health score component
- [ ] Integration error tracking
- [ ] Degradation pattern detection
- [ ] Webhook delivery monitoring
- [ ] Technical risk scoring
- [ ] Integration-specific recommendations
- [ ] Technical health trends

## Detailed Workflow

### Step 1: Integration Data Upload
**User Action**: CSM uploads integration/API data
**System Response**:
- Accepts CSV/JSON with API logs
- Maps fields: endpoint, status, latency, errors, timestamp
- Associates with customer integrations
- Reports: "Found 45,000 API calls and 234 webhook deliveries for 12 integrations"

### Step 2: Technical Analysis
**User Action**: System processes automatically
**System Response**:
- Calculates success rates per integration
- Identifies error patterns
- Detects latency issues
- Analyzes webhook reliability
- Computes technical health score

### Step 3: Issue Detection
**User Action**: CSM reviews technical health
**System Response**:
- Flags integrations with issues
- Shows degradation trends
- Identifies root cause patterns
- Prioritizes by business impact

### Step 4: Intervention & Support
**User Action**: CSM takes action
**System Response**:
- Creates technical support tickets
- Schedules technical review calls
- Drafts integration health reports
- Updates technical risk signals

## Technical Requirements

### Files to Create/Modify
| File | Purpose |
|------|---------|
| `server/src/services/integrations/usageParser.ts` | Parse integration data |
| `server/src/services/integrations/technicalHealthScorer.ts` | Calculate tech health |
| `server/src/services/integrations/degradationDetector.ts` | Detect issues |
| `components/Technical/HealthDashboard.tsx` | Technical health view |
| `components/Technical/IntegrationStatus.tsx` | Per-integration status |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/integrations/usage/upload` | POST | Upload integration data |
| `GET /api/integrations/:customerId/health` | GET | Technical health score |
| `GET /api/integrations/:customerId/issues` | GET | Current issues |
| `POST /api/integrations/:customerId/ticket` | POST | Create support ticket |

### Technical Health Score Components
| Component | Weight | Description |
|-----------|--------|-------------|
| API Success Rate | 30% | % of successful API calls |
| Latency Score | 20% | P95 latency vs SLA |
| Error Trend | 20% | Error rate direction |
| Webhook Reliability | 15% | Delivery success rate |
| Authentication Health | 15% | Token refresh, auth errors |

## Chat UI Flow
```
CSM: [Uploads acme_api_logs_jan2026.json] Calculate technical health from this integration data

System: 📊 Processing integration data...

Customer: Acme Corp
Found: 45,234 API calls
Webhook deliveries: 1,234
Date range: January 1-29, 2026
Integrations: 5 (Salesforce, Slack, Custom API x2, Webhook)

Calculating technical health...

---

**🔧 Technical Health Score: Acme Corp**

**Overall Technical Health: 72/100** ⚠️

```
Target: 90+    Current: 72
████████████████░░░░░░░░░░░░░░ 72%
```

Trend: ⬇️ Declining (-8 from last month)

---

**📊 Integration Health Breakdown**

| Integration | Health | Success Rate | Avg Latency | Issues |
|-------------|--------|--------------|-------------|--------|
| Salesforce Sync | 95 | 99.8% | 120ms | None |
| Slack Notifications | 88 | 98.2% | 45ms | Minor |
| Custom API (Data) | 62 | 94.5% | 890ms | ⚠️ High latency |
| Custom API (Reports) | 48 | 87.3% | 1,200ms | 🔴 Errors |
| Webhook (Events) | 71 | 92.1% | N/A | Delivery issues |

---

**🔴 Critical Issues**

**1. Custom API (Reports) - Score: 48**

```
Error Rate Trend:
Week 1: 2.1%  ██
Week 2: 5.4%  █████
Week 3: 8.9%  █████████
Week 4: 12.7% █████████████ ⚠️ Escalating
```

**Top Errors:**
| Error Code | Count | % of Errors | Description |
|------------|-------|-------------|-------------|
| 429 | 234 | 45% | Rate limit exceeded |
| 500 | 156 | 30% | Internal server error |
| 408 | 89 | 17% | Request timeout |
| 401 | 42 | 8% | Authentication failed |

**Root Cause Analysis:**
- 429 errors started Jan 15 (new report feature launched?)
- 500 errors correlate with large data requests
- Authentication errors occur every Sunday (token refresh issue?)

**Business Impact:**
- Report generation failing for 12.7% of requests
- Users experiencing slow/failed exports
- Likely driving support tickets

---

**⚠️ Warning: Webhook Delivery Issues**

**Delivery Success Rate: 92.1%** (Target: 99%)

Failed Deliveries by Reason:
| Reason | Count | % |
|--------|-------|---|
| Timeout | 67 | 68% |
| Connection refused | 23 | 23% |
| Invalid response | 9 | 9% |

**Pattern:** Failures cluster between 2-4 PM (high traffic period?)

---

**📈 Latency Analysis**

| Integration | P50 | P95 | P99 | SLA | Status |
|-------------|-----|-----|-----|-----|--------|
| Salesforce | 95ms | 180ms | 320ms | 500ms | ✅ OK |
| Slack | 32ms | 78ms | 145ms | 200ms | ✅ OK |
| Custom (Data) | 650ms | 1.2s | 2.1s | 1s | ⚠️ Warning |
| Custom (Reports) | 890ms | 2.4s | 5.8s | 2s | 🔴 Breach |

---

**🔍 Technical Risk Assessment**

| Risk Factor | Level | Impact |
|-------------|-------|--------|
| Report API Degradation | High | User frustration, support load |
| Rate Limiting | High | Feature adoption blocked |
| Webhook Reliability | Medium | Delayed notifications |
| Auth Token Issues | Low | Intermittent access |

**Overall Technical Risk: HIGH**

If not addressed:
- Users will lose trust in reporting feature
- Support tickets will increase
- May impact renewal conversation

---

**💡 Recommended Actions**

**Immediate (This Week):**
1. **Increase API rate limits** for Acme Corp
   - Current: 100 req/min → Recommend: 250 req/min
   - Will resolve 45% of errors

2. **Investigate 500 errors**
   - Schedule technical call with their dev team
   - Review large report requests

**Short-term (Next 2 Weeks):**
3. **Webhook endpoint optimization**
   - Their endpoint may need load balancing
   - Share best practices doc

4. **Token refresh audit**
   - Review Sunday auth failures
   - Possible timezone issue

Would you like me to:
[Create Support Ticket] [Schedule Technical Call] [Draft Technical Report] [Update Risk Signals]

CSM: Create support ticket and schedule a technical call

System: ✅ Actions Complete!

**🎫 Support Ticket Created:**

**Ticket #: TECH-2026-0142**
**Priority:** High
**Customer:** Acme Corp

**Subject:** API Performance Degradation - Reports Integration

**Description:**
Technical health analysis identified critical issues with Acme Corp's Reports integration:

1. **Error Rate:** 12.7% (up from 2.1% four weeks ago)
2. **Top Issue:** Rate limiting (429 errors) - 45% of failures
3. **Secondary:** Server errors (500) during large requests
4. **Impact:** Users experiencing failed report generation

**Recommended Actions:**
- Increase rate limits to 250 req/min
- Investigate 500 errors on large data requests
- Review authentication token refresh cycle

**Technical Data:** [Attached analysis report]

---

**📅 Technical Call Scheduled:**

**Meeting:** Acme Corp - Technical Health Review
**Date:** February 3, 2026 at 2:00 PM
**Duration:** 45 minutes
**Attendees:**
- You (CSM)
- Mike Johnson (Acme - Technical Lead)
- Kevin Wu (Acme - IT Director)
- [Technical Support Rep TBD]

**Agenda:**
1. Review integration health metrics
2. Discuss rate limit increase
3. Troubleshoot 500 errors
4. Webhook optimization best practices
5. Q&A and next steps

Calendar invite sent. I've also prepared a technical briefing document for your review.
```

## Acceptance Criteria
- [ ] Supports API log formats (JSON, CSV)
- [ ] Calculates technical health score accurately
- [ ] Identifies error patterns and trends
- [ ] Detects degradation before critical failure
- [ ] Provides root cause analysis for issues
- [ ] Assesses business impact of technical issues
- [ ] Creates actionable support tickets
- [ ] Integrates with overall health score
- [ ] Recommends specific technical interventions
- [ ] Processing completes within 2 minutes for 100K records

## Ralph Loop Notes
### Completion Signal
```
<promise>PRD-020-COMPLETE</promise>
```

### Success Metrics
- Technical issues identified > 5 days before customer report
- Integration-related churn reduction > 15%
- Technical support ticket resolution time improvement > 20%
