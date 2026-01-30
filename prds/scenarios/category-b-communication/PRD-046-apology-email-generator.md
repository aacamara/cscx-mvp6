# PRD-046: Apology Email Generator

## Metadata
- **PRD ID**: PRD-046
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Gmail Integration, Incident Data, Customer Impact Assessment

## Scenario Description
A CSM needs to apologize to a customer for a service issue, bug, outage, or other problem. The system generates a sincere, professional apology email that acknowledges the issue, takes responsibility, explains what happened (if appropriate), and outlines remediation steps.

## User Story
**As a** CSM using the Chat UI,
**I want to** generate professional apology emails,
**So that** I can address customer issues quickly with appropriate messaging that maintains trust.

## Trigger
- CSM types: "Apologize to [customer] for [issue]" or "Send apology for [incident] to [customer]"
- Major incident affects customer
- Support escalation requires CSM follow-up
- Missed commitment or SLA breach

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Risk signals | `risk_signals` table | Implemented | Track incidents |
| Email drafting | Communicator agent | Implemented | Can draft sensitive emails |
| Customer history | Multiple tables | Implemented | Context available |

### What's Missing
- [ ] Apology email templates by issue type
- [ ] Incident impact assessment integration
- [ ] Remediation tracking
- [ ] Apology appropriateness guidance
- [ ] Post-apology follow-up automation

## Detailed Workflow

### Step 1: Issue Assessment
- Understand the issue and its impact
- Determine customer-specific impact
- Identify root cause (if known)
- Assess remediation status

### Step 2: Apology Strategy
- Determine appropriate tone based on:
  - Issue severity
  - Customer relationship
  - Responsibility (our fault vs. external)
- Decide on compensation/goodwill (if any)

### Step 3: Apology Generation
- Draft sincere acknowledgment
- Take appropriate responsibility
- Explain what happened (without excuses)
- Outline remediation and prevention
- Offer next steps or make-good

### Step 4: Follow-up Plan
- Schedule follow-up check-in
- Track issue resolution
- Monitor customer sentiment recovery

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/apology-outage.ts` | Create | Outage apology template |
| `server/src/templates/emails/apology-bug.ts` | Create | Bug/issue apology template |
| `server/src/templates/emails/apology-service.ts` | Create | Service failure apology template |
| `server/src/templates/emails/apology-missed.ts` | Create | Missed commitment apology template |
| `server/src/services/communication/apologyGenerator.ts` | Create | Apology generation logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/apology` | POST | Generate apology email |
| `GET /api/incidents/:id/customer-impact` | GET | Get customer-specific incident impact |

### Database Changes
| Table | Change | Description |
|-------|--------|-------------|
| `incident_communications` | Create | Track apology/incident communications |
| `customers` | Add column | `last_apology_date` - Track apology frequency |

## Chat UI Flow
```
CSM: Apologize to DataFlow for yesterday's outage
System: I'll help you apologize to DataFlow for the outage.

Incident Details:
- Incident: Platform outage
- Date: January 27, 2026
- Duration: 3 hours (2:00 PM - 5:00 PM EST)
- Root cause: Database failover issue
- Customer impact: DataFlow experienced API failures, affecting their data sync

DataFlow Context:
- Health Score: 68 (dropped 8 points this week)
- ARR: $185,000
- Relationship: Strong (2 years)
- Open support tickets: 3 related to outage

Recommended approach: Sincere apology + remediation plan

📧 **Apology Email**
---
Subject: Sincere Apology for Yesterday's Outage - DataFlow

Hi Michael,

I'm reaching out personally to apologize for the platform outage yesterday that impacted your team's operations.

**What Happened:**
On January 27th between 2:00-5:00 PM EST, a database failover issue caused API failures that disrupted your data synchronization processes. This was unacceptable, and I take full responsibility for the impact on your team.

**The Impact on DataFlow:**
We know this affected your afternoon data syncs and likely caused delays in your downstream processes. I understand how critical reliable data flow is to your operations.

**What We've Done:**
• Root cause identified and fixed within hours
• Redundancy improvements deployed overnight
• Your 3 open support tickets are being prioritized (expected resolution: today)

**What We're Doing to Prevent This:**
• Additional failover testing implemented
• Enhanced monitoring alerts (we'll know before you do)
• Detailed post-mortem being shared with affected customers

**Making This Right:**
I'd like to offer DataFlow one month of service credit ($15,416) as a gesture of goodwill. Additionally, I'm scheduling a 30-minute call for this week to ensure your team is fully back on track.

I value our partnership deeply, and I'm committed to earning back your trust.

Please reach out anytime - I'm here for you.

Sincerely,
[CSM Name]
[Direct phone number]
---

[Edit] [Adjust Compensation] [Send]

CSM: Send
System: Apology email sent to DataFlow.

Follow-up scheduled: Check-in call for January 30, 2026.
```

## Acceptance Criteria
- [ ] Generate appropriate apology based on issue type
- [ ] Include specific incident details and timeline
- [ ] Acknowledge customer-specific impact
- [ ] Explain root cause without making excuses
- [ ] Outline remediation and prevention steps
- [ ] Support compensation/goodwill offers
- [ ] Schedule follow-up automatically
- [ ] Track apology frequency per customer
- [ ] Follow HITL approval for sensitive communications

## Ralph Loop Notes
- **Learning**: Track which apology approaches best restore trust
- **Optimization**: Identify appropriate compensation levels by issue type
- **Personalization**: Adjust tone based on relationship and severity

### Completion Signal
```
<promise>PRD-046-COMPLETE</promise>
```
