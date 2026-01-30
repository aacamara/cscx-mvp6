# PRD-126: Product Update → Impact Assessment

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-126 |
| **Title** | Product Update → Impact Assessment |
| **Category** | E: Workflow Automation |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When product updates are released, CSMs struggle to understand which customers are affected and how to communicate changes effectively. Without automated impact assessment, customers may be surprised by changes or miss valuable new features.

## User Story
**As a** CSM
**I want** automatic impact assessment when product updates are released
**So that** I can proactively communicate relevant changes to affected customers and drive adoption of new features

## Functional Requirements

### FR-1: Product Update Detection
- Detect product updates via:
  - Release notes publication
  - Feature flag changes
  - Version deployment notifications
  - Manual update entry
- Classify update type: feature, improvement, fix, deprecation, breaking change

### FR-2: Customer Impact Analysis
- Analyze impact per customer:
  - Feature relevance based on usage patterns
  - Entitlement eligibility
  - Technical compatibility
  - Workflow disruption potential
- Categorize: positive impact, neutral, action required, at risk

### FR-3: CSM Notification
- Notify CSMs about impacted customers:
  - List of affected accounts
  - Impact severity per account
  - Recommended communication approach
  - Talking points and FAQs
- Prioritize by customer tier and impact

### FR-4: Communication Templates
- Generate customized communications:
  - Announcement email templates
  - FAQ responses
  - Training invitation
  - Feature enablement guide
- Personalize per customer context

### FR-5: Adoption Tracking
- Track feature adoption post-release:
  - Feature enablement status
  - Usage metrics
  - Customer feedback
- Identify adoption blockers

### FR-6: Deprecation Management
- For deprecations and breaking changes:
  - Migration timeline tracking
  - Customer readiness assessment
  - Escalation for at-risk customers
  - Progress reporting

## Non-Functional Requirements

### NFR-1: Timeliness
- Impact assessment within 4 hours of release
- CSM notification same business day

### NFR-2: Accuracy
- Impact classification > 90% accurate
- No missed breaking changes

## Technical Specifications

### Data Model
```typescript
interface ProductUpdateImpact {
  id: string;
  updateId: string;
  updateType: 'feature' | 'improvement' | 'fix' | 'deprecation' | 'breaking';
  releasedAt: Date;
  customerImpacts: CustomerImpact[];
  communicationTemplates: CommunicationTemplate[];
  adoptionMetrics: AdoptionMetric[];
}

interface CustomerImpact {
  customerId: string;
  impactType: 'positive' | 'neutral' | 'action_required' | 'at_risk';
  relevanceScore: number;
  recommendedAction: string;
  notifiedAt: Date | null;
  adoptionStatus: 'not_started' | 'in_progress' | 'completed';
}
```

### API Endpoints
- `POST /api/product-updates` - Log product update
- `GET /api/product-updates/:id/impact` - Get impact assessment
- `POST /api/product-updates/:id/notify-csms` - Notify CSMs
- `GET /api/product-updates/customer/:customerId` - Customer updates

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Product/Release System | IN | Update details |
| Usage Data | IN | Feature relevance |
| Gmail | OUT | Customer communications |
| Slack | OUT | CSM notifications |

## Acceptance Criteria

- [ ] Updates detected and classified
- [ ] Impact analysis per customer accurate
- [ ] CSMs notified promptly
- [ ] Communication templates generated
- [ ] Adoption tracked post-release

## Dependencies
- PRD-033: Product Update Announcement
- PRD-099: High-Value Feature Released
- PRD-159: Product Adoption Report

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Assessment time | < 4 hours | Release to assessment |
| Communication rate | > 80% | Affected customers contacted |
| Feature adoption | +25% | Adoption within 30 days |

## Implementation Notes
- Integrate with product team's release process
- Build feature-customer mapping from usage data
- Consider tiered communication strategy
