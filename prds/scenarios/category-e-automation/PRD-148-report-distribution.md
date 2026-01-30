# PRD-148: Report Generated → Distribution

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-148 |
| **Title** | Report Generated → Distribution |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When reports are generated (health scores, renewals, team performance), distribution is manual and inconsistent. The right stakeholders don't always receive reports, and there's no tracking of report consumption.

## User Story
**As a** CS Leader
**I want** automatic distribution when reports are generated
**So that** stakeholders receive timely information and I know who's engaging with reports

## Functional Requirements

### FR-1: Report Generation Detection
- Detect report generation:
  - Scheduled reports completed
  - On-demand reports generated
  - Dashboard exports created
  - Custom reports built
- Capture report metadata

### FR-2: Distribution List Management
- Configure distribution lists:
  - Per-report type
  - Role-based rules
  - Individual assignments
  - External recipients
- Support dynamic lists

### FR-3: Distribution Methods
- Support multiple channels:
  - Email attachment
  - Email link to view
  - Slack message
  - In-app notification
  - Shared drive upload
- Configurable per recipient

### FR-4: Personalization
- Customize distribution:
  - Executive summary for leaders
  - Detailed view for analysts
  - Filtered by portfolio (CSMs)
  - Highlighted sections by role

### FR-5: Scheduling
- Flexible distribution timing:
  - Immediate on generation
  - Scheduled time (e.g., 8 AM Monday)
  - Delayed for review
  - Time zone aware

### FR-6: Engagement Tracking
- Track report consumption:
  - Delivered successfully
  - Opened/viewed
  - Downloaded
  - Time spent viewing
  - Questions/feedback

### FR-7: Report History
- Maintain report archive:
  - Historical reports accessible
  - Version comparison
  - Trend analysis
  - Audit trail

## Non-Functional Requirements

### NFR-1: Reliability
- 100% distribution delivery
- Retry on failures

### NFR-2: Security
- Respect data permissions
- Secure external sharing

### NFR-3: Timeliness
- Distribution within 5 minutes of generation

## Technical Specifications

### Data Model
```typescript
interface ReportDistribution {
  id: string;
  report: {
    id: string;
    type: string;
    name: string;
    generatedAt: Date;
    generatedBy: string;
  };
  distribution: {
    listId: string;
    recipients: Recipient[];
    schedule: 'immediate' | 'scheduled';
    scheduledFor: Date | null;
  };
  deliveries: DeliveryStatus[];
  engagement: {
    opened: string[];
    downloaded: string[];
    avgViewTime: number;
    feedback: Feedback[];
  };
  createdAt: Date;
}

interface Recipient {
  userId: string;
  email: string;
  name: string;
  role: string;
  channel: 'email' | 'slack' | 'in_app' | 'drive';
  personalization: 'executive' | 'detailed' | 'filtered' | 'standard';
}

interface DeliveryStatus {
  recipientId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt: Date | null;
  failureReason: string | null;
}
```

### API Endpoints
- `POST /api/reports/:id/distribute` - Distribute report
- `GET /api/reports/:id/distribution` - Distribution status
- `GET /api/reports/:id/engagement` - Engagement metrics
- `PUT /api/distribution/lists/:id` - Update list
- `GET /api/reports/history` - Report archive

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Reporting Engine | IN | Generated reports |
| Gmail | OUT | Email distribution |
| Slack | OUT | Message distribution |
| Google Drive | OUT | File upload |
| Analytics | OUT | Engagement tracking |

## UI/UX Requirements

### Distribution Configuration
- List management interface
- Channel selection
- Personalization options
- Schedule settings

### Engagement Dashboard
- Delivery status
- Open rates
- Download tracking
- Feedback collection

## Acceptance Criteria

- [ ] Reports detected on generation
- [ ] Distribution lists managed
- [ ] Multiple channels supported
- [ ] Personalization applied
- [ ] Delivery tracked
- [ ] Engagement measured

## Dependencies
- PRD-151: Personal Weekly Summary Report
- PRD-179: Executive Summary Report
- PRD-180: Custom Report Builder

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Delivery rate | > 99% | Successfully delivered |
| Open rate | > 70% | Recipients viewing |
| Time to distribute | < 5 min | Generation to delivery |

## Implementation Notes
- Build distribution list engine
- Implement report personalization
- Set up engagement tracking
- Support external sharing securely
