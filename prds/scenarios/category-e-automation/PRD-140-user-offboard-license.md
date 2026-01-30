# PRD-140: User Offboarded → License Reclaim

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-140 |
| **Title** | User Offboarded → License Reclaim |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When users leave a customer organization, their licenses often remain allocated, wasting customer resources and creating shadow accounts. CSMs aren't aware of these changes to help optimize license utilization.

## User Story
**As a** CSM
**I want** automatic detection when users are offboarded
**So that** I can help customers reclaim licenses and optimize their subscription

## Functional Requirements

### FR-1: User Offboard Detection
- Detect user removal:
  - User deactivated in product
  - Email bounce (inactive email)
  - SSO removal detected
  - Manual report
  - Extended inactivity (90+ days)

### FR-2: License Impact Analysis
- Analyze license impact:
  - License type freed
  - Cost savings opportunity
  - Utilization rate change
  - Recommendation for reallocation

### FR-3: CSM Notification
- Notify CSM of offboard:
  - User details
  - License type
  - Customer impact
  - Recommended action
- Include context for conversation

### FR-4: Stakeholder Alert
- Optionally alert customer admin:
  - License available notification
  - Reassignment suggestion
  - Optimization opportunity
- Configurable per customer

### FR-5: License Tracking
- Update license tracking:
  - Available licenses count
  - Utilization metrics
  - Trend analysis
  - Cost optimization potential

### FR-6: Champion/Stakeholder Check
- Special handling for key contacts:
  - Flag if champion left
  - Trigger risk signal
  - Recommend relationship assessment
  - Update stakeholder map

### FR-7: Bulk Offboard Support
- Handle mass changes:
  - Org restructure detection
  - Layoff impact assessment
  - Risk escalation if significant
  - Aggregate reporting

## Non-Functional Requirements

### NFR-1: Timeliness
- Detection within 24 hours
- Champion departure escalated immediately

### NFR-2: Accuracy
- No false positives on active users
- Champion detection reliable

## Technical Specifications

### Data Model
```typescript
interface UserOffboardEvent {
  id: string;
  customerId: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    licenseType: string;
  };
  detection: {
    method: 'deactivation' | 'bounce' | 'sso' | 'inactivity' | 'manual';
    detectedAt: Date;
    confidence: 'high' | 'medium' | 'low';
  };
  impact: {
    licenseFreed: boolean;
    licenseCost: number;
    isChampion: boolean;
    isStakeholder: boolean;
    riskSignalCreated: boolean;
  };
  actions: {
    csmNotified: boolean;
    customerNotified: boolean;
    licenseReclaimed: boolean;
    stakeholderMapUpdated: boolean;
  };
  createdAt: Date;
}
```

### API Endpoints
- `POST /api/users/offboard` - Record offboard
- `GET /api/users/offboards/customer/:customerId` - Customer offboards
- `GET /api/licenses/customer/:customerId` - License status
- `POST /api/users/:id/reclaim-license` - Reclaim license

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Usage Data | IN | User activity |
| SSO/Identity | IN | User status |
| Email | IN | Bounce detection |
| Slack | OUT | CSM notification |
| Risk Signals | OUT | Champion departure |

## Acceptance Criteria

- [ ] Offboards detected accurately
- [ ] License impact analyzed
- [ ] CSM notified appropriately
- [ ] Champion departures escalated
- [ ] License tracking updated
- [ ] Bulk offboards handled

## Dependencies
- PRD-088: Champion Departure Alert
- PRD-071: White Space Analysis
- PRD-095: Executive Change Detected

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Detection rate | > 90% | Offboards identified |
| License reclaim | > 50% | Freed licenses reused |
| Champion detection | 100% | No missed champion departures |

## Implementation Notes
- Monitor user activity patterns
- Implement email bounce tracking
- Build stakeholder importance scoring
- Connect with billing for license counts
