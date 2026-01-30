# PRD-101: Integration Disconnected

## Metadata
- **PRD ID**: PRD-101
- **Category**: D - Alerts & Triggers
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Integration Monitoring, Webhook System, Technical Health Tracking

---

## 1. Overview

### 1.1 Problem Statement
When a customer's integration disconnects (API token expires, webhook fails, SSO breaks), it can significantly impact their ability to use the product effectively. These technical issues often go unnoticed by customers until they need the integration, creating frustration and support burden. Proactive detection and communication builds trust and prevents escalations.

### 1.2 Solution Summary
Implement an automated monitoring system that detects integration disconnections, authentication failures, and webhook delivery issues. When detected, alert both the CSM and the customer's technical contact with clear guidance on how to resolve the issue.

### 1.3 Success Metrics
- Detect integration failures within 1 hour
- Resolve 80% of integration issues before customer notices
- Reduce integration-related support tickets by 50%
- Maintain 99%+ integration uptime for monitored connections

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** know when a customer's integration disconnects
**So that** I can proactively help them resolve it before it impacts their workflow

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want the alert to include diagnosis information, so I can explain the issue to the customer.

**US-3**: As a Technical Contact at the customer, I want direct notification of integration issues with fix instructions.

**US-4**: As a CSM, I want to track integration reliability over time for each customer, so I can identify chronic issues.

---

## 3. Functional Requirements

### 3.1 Disconnection Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Monitor OAuth token expiration/refresh failures | Must |
| FR-1.2 | Monitor API authentication failures | Must |
| FR-1.3 | Monitor webhook delivery failures | Must |
| FR-1.4 | Monitor SSO authentication issues | Should |
| FR-1.5 | Track integration health metrics (success rate, latency) | Should |
| FR-1.6 | Detect partial failures (some endpoints working, others not) | Should |

### 3.2 Alert Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Create risk_signal with type "integration_disconnected" | Must |
| FR-2.2 | Include integration type, failure reason, and impact scope | Must |
| FR-2.3 | Include troubleshooting steps | Must |
| FR-2.4 | Severity based on integration criticality and customer ARR | Must |
| FR-2.5 | Deduplicate alerts for same ongoing issue | Must |

### 3.3 Resolution Guidance

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Provide specific reauthorization instructions | Must |
| FR-3.2 | Include direct link to reconnect (if self-serve) | Must |
| FR-3.3 | Offer to schedule technical support call | Should |
| FR-3.4 | Track resolution status | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
CREATE TABLE integration_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  integration_type VARCHAR(100) NOT NULL, -- salesforce, slack, google, custom_api
  integration_id TEXT,
  status VARCHAR(50) DEFAULT 'healthy', -- healthy, degraded, disconnected
  last_successful_sync TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  failure_reason TEXT,
  error_code TEXT,
  is_critical BOOLEAN DEFAULT false,
  alerted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  integration_type VARCHAR(100),
  event_type VARCHAR(50), -- auth_failure, webhook_failed, sync_error, reconnected
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Workflow Definition

```yaml
workflow: integration_disconnection_response
version: 1.0
trigger:
  type: event
  event: integration_status_changed
  filter:
    new_status: disconnected

steps:
  - id: assess_impact
    action: analyze_integration_criticality
    config:
      customer_id: "{{customer.id}}"
      integration_type: "{{integration_type}}"

  - id: notify_csm
    action: slack_dm
    config:
      message_template: "integration_disconnected_alert"
      urgency: "{{severity}}"
      include_troubleshooting: true

  - id: notify_technical_contact
    condition: "{{technical_contact_exists}}"
    action: send_email
    config:
      to: "{{technical_contact.email}}"
      template: "integration_disconnected_customer"
      requires_approval: false # Technical notifications can auto-send

  - id: create_task
    action: create_task
    config:
      title: "Integration disconnected: {{integration_type}} for {{customer.name}}"
      due_date_offset_hours: 4
      priority: "{{severity == 'critical' ? 'critical' : 'high'}}"

  - id: update_health_score
    condition: "{{is_critical}}"
    action: update_health_score
    config:
      adjustment: -10
      reason: "Critical integration disconnected"
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:electric_plug: Integration Disconnected: TechCorp

Integration: Salesforce CRM Sync
Status: DISCONNECTED
Since: Jan 29, 2026 at 10:45 AM (3 hours ago)

Error: OAuth token expired and refresh failed
Error Code: INVALID_GRANT

Impact:
- CRM data sync stopped
- Health score updates not pushing to Salesforce
- This is marked as a CRITICAL integration

Customer Context:
- ARR: $200,000
- Technical Contact: Bob Smith (IT Admin)
- Previous disconnection: Never

Troubleshooting Steps:
1. Customer needs to reauthorize Salesforce connection
2. Direct them to: Settings > Integrations > Salesforce > Reconnect
3. If issue persists, check Salesforce API permissions

[Send Fix Instructions] [Schedule Tech Call] [View Integration Status]
```

### 5.2 Customer Email (Auto-Send)

```
Subject: Action Required: Your Salesforce integration needs reauthorization

Hi {{technical_contact_name}},

We noticed that your Salesforce integration with {{product_name}} has disconnected. This means data sync between the systems is currently paused.

What happened:
{{failure_reason}}

To fix this (takes about 2 minutes):
1. Log in to {{product_name}}
2. Go to Settings > Integrations > Salesforce
3. Click "Reconnect" and authorize the connection

[Reconnect Salesforce Now]

If you run into any issues, reply to this email and we'll help you sort it out.

Best regards,
The {{product_name}} Team
```

---

## 6. Related PRDs
- PRD-139: Integration Added - Health Check
- PRD-079: Technical Environment Summary
- PRD-020: Integration Usage Data - Technical Health Score
