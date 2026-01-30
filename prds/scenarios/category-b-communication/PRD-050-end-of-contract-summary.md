# PRD-050: End-of-Contract Summary

## Metadata
- **PRD ID**: PRD-050
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Gmail Integration, Contract Data, Metrics Aggregation

## Scenario Description
As a customer's contract approaches its end (renewal or churn), the CSM needs to send a comprehensive summary of the partnership period including value delivered, achievements, and either renewal proposal context or graceful offboarding information depending on the outcome.

## User Story
**As a** CSM using the Chat UI,
**I want to** generate end-of-contract summary communications,
**So that** I can properly close out contract periods with documentation of value delivered.

## Trigger
- CSM types: "Generate contract summary for [customer]" or "Send end-of-contract recap to [customer]"
- Contract expiration within 30 days
- Renewal completed (celebration summary)
- Churn confirmed (graceful exit summary)

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Contract data | `contracts` table | Implemented | Term dates, value |
| Customer metrics | Multiple tables | Implemented | Value data available |
| QBR data | `qbrs` table | Implemented | Historical achievements |
| Email drafting | Communicator agent | Implemented | Can draft summaries |

### What's Missing
- [ ] End-of-contract summary templates
- [ ] Value aggregation over contract term
- [ ] Graceful offboarding templates
- [ ] Contract period analytics
- [ ] Milestone compilation

## Detailed Workflow

### Step 1: Contract Analysis
- Determine contract outcome (renewing vs. churning)
- Calculate contract term dates
- Identify key metrics over contract period

### Step 2: Value Aggregation
- Compile achievements and milestones
- Calculate ROI and value metrics
- Gather testimonials and quotes
- Document challenges overcome

### Step 3: Summary Generation
- Generate appropriate summary:
  - **Renewal**: Value recap + excitement for next term
  - **Churn**: Value recap + graceful goodbye + door open

### Step 4: Delivery
- Send summary with appropriate tone
- Include relevant attachments
- Set follow-up if applicable

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/contract-summary-renewal.ts` | Create | Renewal summary template |
| `server/src/templates/emails/contract-summary-churn.ts` | Create | Churn summary template |
| `server/src/services/contracts/summaryGenerator.ts` | Create | Summary generation logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/contract-summary` | POST | Generate contract summary |
| `GET /api/customers/:id/contract-metrics` | GET | Get contract period metrics |

### Database Changes
| Table | Change | Description |
|-------|--------|-------------|
| `contract_summaries` | Create | Track summary communications |

## Chat UI Flow
```
CSM: Generate contract summary for InnovateTech
System: I'll generate an end-of-contract summary for InnovateTech.

Contract Details:
- Contract period: Jan 1, 2024 - Dec 31, 2025 (2 years)
- Status: Renewed for 2026-2027! 🎉
- Original ARR: $150K → Renewed ARR: $195K (+30%)

Aggregating partnership value...

Partnership Highlights (2024-2025):
- ROI: 4.5x ($675K documented value)
- Efficiency gains: 42% improvement
- Expansions: 2 (added 2 departments)
- QBRs completed: 8
- Major milestones: 5
- Training sessions: 12
- Support tickets resolved: 47 (avg 4hr response)

📧 **End-of-Contract Summary (Renewal)**
---
Subject: Celebrating 2 Amazing Years + Here's to 2 More! 🎉

Hi Sarah,

What an incredible two years it's been! As we close out your 2024-2025 contract and kick off our renewed partnership, I wanted to take a moment to celebrate everything InnovateTech has achieved.

**📊 By the Numbers (2024-2025):**

| Metric | Result |
|--------|--------|
| ROI | 4.5x ($675K value) |
| Efficiency Improvement | 42% |
| Team Adoption | 94% |
| Departments Onboarded | 3 (started with 1) |
| Training Completions | 127 |

**🏆 Key Milestones:**
✓ January 2024: Successful platform launch
✓ June 2024: First expansion (Marketing team)
✓ November 2024: Hit 90% adoption target
✓ March 2025: Second expansion (Finance team)
✓ September 2025: Documented $500K cost savings

**💬 What You Said:**
"This platform has transformed how we work. We can't imagine going back." - Sarah, VP Operations

**🚀 Looking Ahead (2026-2027):**
With your renewed contract, I'm excited to help InnovateTech:
- Explore our new AI automation features
- Expand to the remaining 2 departments
- Target 5x ROI by end of 2027

Thank you for being an amazing partner. Here's to the next chapter!

[Full Partnership Report PDF]

Cheers,
[CSM Name]
---

[Edit] [Attach Report] [Send]

CSM: Send
System: Contract summary sent to InnovateTech!
```

## Acceptance Criteria
- [ ] Calculate comprehensive metrics over contract period
- [ ] Compile milestones and achievements
- [ ] Generate appropriate summary (renewal vs. churn tone)
- [ ] Include quantified value and ROI
- [ ] Reference specific accomplishments and quotes
- [ ] Support attachment of detailed report
- [ ] Follow HITL approval before sending
- [ ] Track summary delivery

## Ralph Loop Notes
- **Learning**: Identify which metrics resonate most with customers
- **Optimization**: Improve value documentation throughout contract
- **Personalization**: Match summary style to customer preferences

### Completion Signal
```
<promise>PRD-050-COMPLETE</promise>
```
