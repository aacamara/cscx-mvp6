# PRD-139: Integration Added → Health Check

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-139 |
| **Title** | Integration Added → Health Check |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When customers add new integrations, there's no systematic verification that the integration is working correctly and delivering value. Broken or underutilized integrations contribute to poor adoption and churn risk.

## User Story
**As a** CSM
**I want** automatic health checks when customers add new integrations
**So that** I can ensure integrations are working and customers are getting value

## Functional Requirements

### FR-1: Integration Detection
- Detect new integration setup:
  - Integration connection event
  - API key generation
  - OAuth completion
  - Manual entry
- Identify integration type and purpose

### FR-2: Health Check Scheduling
- Schedule verification checks:
  - Immediate: Connection test
  - Day 1: First sync verification
  - Day 7: Usage verification
  - Day 30: Value assessment
- Customize by integration type

### FR-3: Technical Verification
- Verify technical health:
  - Connection status
  - Data flow confirmation
  - Error rates
  - Sync completion
  - API call success rates

### FR-4: Usage Verification
- Check integration usage:
  - Active users
  - Feature utilization
  - Data freshness
  - Workflow adoption

### FR-5: CSM Notification
- Alert CSM to issues:
  - Connection failures
  - Low usage
  - High error rates
  - Stale data
- Include troubleshooting guidance

### FR-6: Customer Outreach
- Trigger proactive outreach:
  - Setup assistance offer
  - Best practices sharing
  - Training invitation
  - Success story sharing

### FR-7: Integration Dashboard
- Provide visibility:
  - All customer integrations
  - Health status per integration
  - Usage metrics
  - Issue history

## Non-Functional Requirements

### NFR-1: Coverage
- All integration types monitored
- No blind spots

### NFR-2: Accuracy
- Accurate health assessment
- Low false positive alerts

## Technical Specifications

### Data Model
```typescript
interface IntegrationHealthCheck {
  id: string;
  customerId: string;
  integration: {
    id: string;
    type: string;
    name: string;
    connectedAt: Date;
  };
  checks: HealthCheck[];
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  issues: IntegrationIssue[];
  usage: {
    activeUsers: number;
    lastUsed: Date;
    dataFreshness: number;
  };
  outreach: {
    sent: boolean;
    type: string | null;
    sentAt: Date | null;
  };
  lastCheckedAt: Date;
}

interface HealthCheck {
  type: 'connection' | 'sync' | 'usage' | 'value';
  scheduledFor: Date;
  completedAt: Date | null;
  result: 'pass' | 'fail' | 'warning' | 'pending';
  details: Record<string, any>;
}
```

### API Endpoints
- `POST /api/integrations/:id/health-check` - Trigger check
- `GET /api/integrations/customer/:customerId` - List integrations
- `GET /api/integrations/:id/status` - Integration status
- `POST /api/integrations/:id/outreach` - Send outreach

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Integration APIs | IN | Health status |
| Usage Data | IN | Utilization metrics |
| Gmail | OUT | Outreach emails |
| Slack | OUT | CSM alerts |

## Acceptance Criteria

- [ ] New integrations detected
- [ ] Health checks scheduled and executed
- [ ] Technical verification accurate
- [ ] Usage tracked correctly
- [ ] CSM alerted to issues
- [ ] Dashboard available

## Dependencies
- PRD-101: Integration Disconnected
- PRD-020: Integration Usage Data → Technical Health Score

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Check coverage | 100% | Integrations monitored |
| Issue detection | > 90% | Problems identified |
| Integration success | > 80% | Healthy at day 30 |

## Implementation Notes
- Build integration health framework
- Create check templates per integration type
- Implement progressive check scheduling
- Connect with support for escalation
