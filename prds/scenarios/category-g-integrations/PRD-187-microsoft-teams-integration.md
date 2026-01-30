# PRD-187: Microsoft Teams Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-187 |
| **Title** | Microsoft Teams Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations using Microsoft Teams as their primary communication platform cannot receive CSCX.AI notifications where they work. CSMs in Microsoft-centric environments need the same notification and collaboration capabilities available to Slack users.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to receive health alerts in Teams so that I stay informed without leaving my primary workspace.
2. **As a CSM**, I want to take quick actions from Teams notifications to respond faster to customer issues.
3. **As a CS Leader**, I want team channels configured for escalation alerts and portfolio updates.

### Secondary User Stories
4. **As a CSM**, I want daily digest messages in Teams summarizing my portfolio.
5. **As a System Admin**, I want to configure which notifications go to Teams vs other channels.

## Functional Requirements

### FR-1: Microsoft Graph Authentication
- Support Microsoft OAuth 2.0 via Azure AD
- Request permissions:
  - `Chat.ReadWrite`
  - `ChannelMessage.Send`
  - `User.Read`
  - `Team.ReadBasic.All`
- App registration in Azure AD

### FR-2: Direct Message Notifications
- Send personal alerts via Teams chat
- Support Adaptive Cards for rich formatting
- Notification types:
  - Health score alerts
  - Renewal reminders
  - Escalation notices
  - Task assignments
  - Approval requests

### FR-3: Channel Notifications
- Post to configured team channels
- Channel message types:
  - Critical escalations
  - Portfolio summaries
  - Team announcements
- Support multiple team/channel configs

### FR-4: Adaptive Card Actions
- Interactive card buttons:
  - View in CSCX.AI
  - Acknowledge alert
  - Snooze notification
  - Quick status update
- Action handling via webhook

### FR-5: Teams Bot
- Conversational bot in Teams
- Commands:
  - `/cscx status` - portfolio summary
  - `/cscx account [name]` - account details
  - `/cscx alerts` - pending alerts
- Natural language queries

### FR-6: Tab App
- CSCX.AI embedded as Teams tab
- SSO with Microsoft account
- Customer context from conversation

## Non-Functional Requirements

### NFR-1: Performance
- Message delivery < 5 seconds
- Bot response < 3 seconds
- Handle rate limits (30 messages/second/app)

### NFR-2: Security
- Azure AD compliance
- Token encryption
- Audit logging

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/teams/connect
GET    /api/integrations/teams/callback
POST   /api/integrations/teams/webhook
POST   /api/teams/send
GET    /api/teams/channels
PUT    /api/teams/preferences
POST   /api/teams/bot/messages
```

### Microsoft Graph API Usage
```javascript
// Send chat message
POST https://graph.microsoft.com/v1.0/chats/{chat-id}/messages
{
  "body": {
    "contentType": "html",
    "content": "<attachment id=\"card\"></attachment>"
  },
  "attachments": [{
    "id": "card",
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "type": "AdaptiveCard",
      "body": [{
        "type": "TextBlock",
        "text": "Health Score Alert: Acme Corp",
        "weight": "bolder"
      }],
      "actions": [{
        "type": "Action.OpenUrl",
        "title": "View Account",
        "url": "https://app.cscx.ai/customers/123"
      }]
    }
  }]
}

// Send channel message
POST https://graph.microsoft.com/v1.0/teams/{team-id}/channels/{channel-id}/messages
```

### Database Schema
```sql
CREATE TABLE teams_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  tenant_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  teams_user_id TEXT,
  chat_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE teams_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  teams_user_id TEXT,
  team_id TEXT,
  channel_id TEXT,
  notification_types TEXT[],
  delivery_method VARCHAR(10),
  quiet_start TIME,
  quiet_end TIME,
  timezone VARCHAR(50)
);
```

## User Interface

### Teams Tab App
- Embedded CSCX.AI dashboard
- Account quick view
- Alert summary

### Notification Settings (CSCX.AI)
- Teams connection status
- Channel configuration
- Notification type toggles
- Test message button

## Acceptance Criteria

### AC-1: Authentication
- [ ] Azure AD OAuth completes successfully
- [ ] Token refresh works
- [ ] Multi-tenant support works

### AC-2: Notifications
- [ ] DM notifications deliver correctly
- [ ] Channel posts work
- [ ] Adaptive Cards render properly

### AC-3: Bot Functionality
- [ ] Bot responds to commands
- [ ] Natural language queries work
- [ ] Actions execute correctly

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Send alert to Teams" | Test notification |
| "Configure Teams channel" | Open settings |
| "Post summary to Teams" | Send digest |

## Success Metrics
| Metric | Target |
|--------|--------|
| Message delivery rate | > 99.9% |
| Bot response time | < 3 seconds |
| User adoption (Teams orgs) | > 70% |

## Related PRDs
- PRD-186: Slack Notification Integration
- PRD-107: Health Score Threshold Alert
