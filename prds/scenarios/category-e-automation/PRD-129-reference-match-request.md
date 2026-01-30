# PRD-129: Reference Needed → Match + Request

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-129 |
| **Title** | Reference Needed → Match + Request |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When sales or marketing needs customer references, finding appropriate matches and coordinating requests is manual and time-consuming. CSMs must manually search for suitable customers, assess willingness, and coordinate the request.

## User Story
**As a** CSM
**I want** automatic reference matching when a reference request is made
**So that** I can quickly provide suitable references while protecting customer relationships

## Functional Requirements

### FR-1: Reference Request Detection
- Detect reference needs via:
  - Sales reference request submission
  - Marketing campaign request
  - Manual request in system
  - Prospect deal stage trigger
- Capture requirements: industry, use case, size, features

### FR-2: Customer Matching
- Match references based on:
  - Industry alignment
  - Use case similarity
  - Company size match
  - Feature usage overlap
  - Geographic proximity
  - Reference history (not overused)
- Score and rank matches

### FR-3: Eligibility Assessment
- Assess customer eligibility:
  - Health score threshold (> 75)
  - NPS promoter (9-10)
  - Contract status (active, not churning)
  - Reference willingness (past response)
  - Relationship strength
  - Recent support issues (none)

### FR-4: CSM Approval
- Present matches to CSM:
  - Match score and reasoning
  - Customer context
  - Last reference date
  - Relationship considerations
- CSM approves/rejects each match

### FR-5: Reference Request
- Generate reference request to customer:
  - Personalized ask email
  - Context about requester
  - Time commitment expected
  - Incentive offered (if any)
- Queue for CSM review before sending

### FR-6: Response Tracking
- Track response:
  - Accepted, declined, no response
  - Scheduling coordination
  - Reference completion
  - Feedback from both parties

### FR-7: Reference Database
- Maintain reference database:
  - Willing references
  - Reference frequency
  - Preferred formats (call, case study, video)
  - Topics comfortable discussing
  - Availability windows

## Non-Functional Requirements

### NFR-1: Timeliness
- Match generation < 30 minutes
- CSM notification immediate

### NFR-2: Quality
- Match relevance > 80%
- Customer protection prioritized

### NFR-3: Tracking
- Full reference history
- Usage limits enforced

## Technical Specifications

### Data Model
```typescript
interface ReferenceRequest {
  id: string;
  requestType: 'sales' | 'marketing' | 'analyst' | 'other';
  requestedBy: string;
  requirements: {
    industry: string[];
    useCase: string[];
    companySize: string;
    features: string[];
    geography: string[];
    format: 'call' | 'case_study' | 'video' | 'any';
  };
  matches: ReferenceMatch[];
  status: 'pending_match' | 'pending_approval' | 'pending_request' |
          'awaiting_response' | 'scheduled' | 'completed' | 'cancelled';
  selectedMatch: string | null;
  outcome: ReferenceOutcome | null;
  createdAt: Date;
  completedAt: Date | null;
}

interface ReferenceMatch {
  customerId: string;
  matchScore: number;
  matchReasons: string[];
  eligibilityScore: number;
  lastReferenceDate: Date | null;
  csmApproval: 'pending' | 'approved' | 'rejected';
  csmNotes: string | null;
}

interface CustomerReferenceProfile {
  customerId: string;
  isWilling: boolean;
  preferredFormats: string[];
  topicsComfortable: string[];
  availabilityNotes: string;
  referenceCount: number;
  lastReferenceDate: Date | null;
  maxReferencesPerQuarter: number;
  npsScore: number;
}
```

### API Endpoints
- `POST /api/references/request` - Submit reference request
- `GET /api/references/request/:id/matches` - Get matches
- `PUT /api/references/match/:matchId/approve` - CSM approval
- `POST /api/references/match/:matchId/send-request` - Send request
- `GET /api/references/customer/:customerId/profile` - Reference profile

### Agent Involvement
| Agent | Role |
|-------|------|
| Researcher | Find matching customers |
| Orchestrator | Coordinate workflow |
| Communicator | Draft request email |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Customer Data | IN | Matching criteria |
| NPS Data | IN | Promoter scores |
| Gmail | OUT | Reference request |
| Calendar | OUT | Scheduling |
| Salesforce | IN/OUT | Deal context |

## Acceptance Criteria

- [ ] Requests trigger matching workflow
- [ ] Matches relevant and scored
- [ ] Eligibility criteria enforced
- [ ] CSM approval required
- [ ] Request personalized appropriately
- [ ] Response tracking accurate

## Dependencies
- PRD-043: Reference Request to Customer
- PRD-048: Case Study Request
- PRD-037: Feedback/Testimonial Request

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Match relevance | > 80% | Requester feedback |
| Request acceptance | > 50% | Accepted / requested |
| Time to reference | < 7 days | Request to completion |
| Customer satisfaction | Neutral+ | Post-reference survey |

## Implementation Notes
- Build matching algorithm with weights
- Implement reference frequency limits
- Consider advocate program integration
- Track reference impact on deals
