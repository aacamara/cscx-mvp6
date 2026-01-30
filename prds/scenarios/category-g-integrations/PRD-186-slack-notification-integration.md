# PRD-186: Slack Notification Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-186 |
| **Title** | Slack Notification Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs live in Slack throughout their workday but must constantly switch to CSCX.AI to check for alerts and updates. Critical notifications about customer health changes, escalations, and renewal risks are missed or delayed because they don't surface where CSMs are already working.

## User Stories

### Primary User Stories
1. **As a CSM**, I want health score drop alerts in Slack so that I can respond immediately without checking another tool.
2. **As a CSM**, I want to receive daily digest messages summarizing my portfolio status in Slack.
3. **As a CS Leader**, I want team-wide alerts for critical escalations posted to a shared channel.

### Secondary User Stories
4. **As a CSM**, I want to take quick actions from Slack notifications (acknowledge, snooze, view details).
5. **As a CSM**, I want to customize which alerts go to Slack vs email vs in-app only.

## Functional Requirements

### FR-1: OAuth Bot Installation
- Support Slack OAuth 2.0 for bot installation
- Request scopes:
  - `chat:write` - send messages
  - `channels:read` - list channels
  - `users:read` - user lookup
  - `users:read.email` - match by email
  - `im:write` - send DMs
  - `reactions:write` - add reactions
- Bot token storage per workspace

### FR-2: Direct Message Notifications
- Send personal alerts to CSM via DM
- Notification types:
  - Health score change
  - Renewal approaching
  - Escalation created
  - Task due
  - Approval request
- Rich message formatting with Block Kit

### FR-3: Channel Notifications
- Configure team channels for broadcasts
- Channel message types:
  - Critical escalations
  - Churn alerts
  - Team announcements
  - Weekly summaries
- Support multiple channel configurations

### FR-4: Interactive Messages
- Action buttons in notifications:
  - View in CSCX.AI (deep link)
  - Acknowledge alert
  - Snooze reminder
  - Quick reply
- Modal dialogs for additional context

### FR-5: Daily Digest
- Scheduled summary message to each CSM
- Contents:
  - Portfolio health overview
  - Tasks due today
  - Upcoming renewals
  - At-risk accounts
- Configurable delivery time

### FR-6: Notification Preferences
- Per-user notification settings:
  - Channel vs DM preference
  - Notification types enabled
  - Quiet hours
  - Urgency thresholds
- Per-team default settings

## Non-Functional Requirements

### NFR-1: Performance
- Notification delivery < 3 seconds
- Support 1000+ messages per minute
- Handle rate limiting gracefully

### NFR-2: Reliability
- 99.9% message delivery rate
- Retry failed messages
- Queue during Slack outages

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/slack/connect
GET    /api/integrations/slack/callback
POST   /api/integrations/slack/webhook
POST   /api/slack/send
GET    /api/slack/channels
PUT    /api/slack/preferences
```

### Slack API Usage
```javascript
// Send DM notification
POST https://slack.com/api/chat.postMessage
{
  "channel": "U123ABC456",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": ":warning: *Health Score Alert*\n*Acme Corp* dropped from 85 to 62"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "View Account"},
          "url": "https://app.cscx.ai/customers/123"
        },
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "Acknowledge"},
          "action_id": "acknowledge_alert"
        }
      ]
    }
  ]
}

// Handle button interaction
POST /api/integrations/slack/webhook
{
  "type": "block_actions",
  "actions": [{"action_id": "acknowledge_alert"}]
}
```

### Database Schema
Uses existing `slack_connections` table plus:
```sql
CREATE TABLE slack_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  slack_user_id TEXT,
  channel_id TEXT,
  notification_types TEXT[], -- health_drop, escalation, renewal, task
  delivery_method VARCHAR(10), -- dm, channel
  quiet_start TIME,
  quiet_end TIME,
  timezone VARCHAR(50),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE slack_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  notification_type VARCHAR(50),
  message_ts TEXT,
  channel_id TEXT,
  delivered_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ
);
```

## User Interface

### Slack App Home
- Portfolio summary
- Quick links to key accounts
- Configure preferences button

### Notification Settings (CSCX.AI)
- Toggle notification types
- Select delivery channel
- Set quiet hours
- Test notification button

## Acceptance Criteria

### AC-1: Installation
- [ ] Slack OAuth completes successfully
- [ ] Bot appears in workspace
- [ ] User mapping by email works

### AC-2: Notifications
- [ ] Health alerts send to correct users
- [ ] Rich formatting renders correctly
- [ ] Action buttons function properly

### AC-3: Preferences
- [ ] Users can customize notifications
- [ ] Quiet hours respected
- [ ] Channel preferences honored

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Send alert to Slack" | Test notification |
| "Update my Slack preferences" | Open settings |
| "Post to #cs-team channel" | Send to channel |

## Success Metrics
| Metric | Target |
|--------|--------|
| Notification delivery rate | > 99.9% |
| Alert response time improvement | 50% faster |
| CSM satisfaction with alerts | > 4/5 |

## Related PRDs
- PRD-187: Microsoft Teams Integration
- PRD-107: Health Score Threshold Alert
- PRD-150: End of Day → Daily Summary
