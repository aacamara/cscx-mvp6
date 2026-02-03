# PRD: Multi-Channel Communications

## Introduction

Multi-Channel Communications extends CSCX beyond Gmail to support Slack, Microsoft Teams, and SMS as communication channels. CSMs can reach customers through their preferred channels, and agents can draft/send messages across all channels with unified HITL approval.

This addresses the reality that not all stakeholders respond to email, and modern CS requires meeting customers where they are.

## Goals

- Support Slack, Microsoft Teams, and SMS alongside existing Gmail
- Unified inbox showing all channel conversations per customer
- Agents can draft messages for any channel
- HITL approval works consistently across channels
- Channel preference tracked per stakeholder
- Message templates work across channels with formatting adaptation

## User Stories

### US-001: Connect Slack workspace
**Description:** As a CSM, I want to connect my Slack workspace so that I can communicate with customers via Slack.

**Acceptance Criteria:**
- [ ] OAuth flow to connect Slack workspace
- [ ] Permission scopes: channels:read, chat:write, users:read
- [ ] Store Slack workspace token securely
- [ ] Test connection with sample message to self
- [ ] Disconnect option with token revocation
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Connect Microsoft Teams
**Description:** As a CSM, I want to connect Microsoft Teams so that I can communicate with customers via Teams.

**Acceptance Criteria:**
- [ ] OAuth flow to connect Microsoft 365 account
- [ ] Permission scopes: Chat.ReadWrite, User.Read
- [ ] Store Microsoft token with refresh token
- [ ] Test connection with sample message
- [ ] Disconnect option with token revocation
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Configure SMS (Twilio)
**Description:** As an admin, I want to configure SMS via Twilio so that CSMs can send text messages.

**Acceptance Criteria:**
- [ ] Twilio account SID, auth token, phone number configuration
- [ ] Test SMS to admin phone number
- [ ] SMS sender ID customization
- [ ] Character limit warnings (160 chars)
- [ ] Opt-out handling (STOP keyword)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Unified inbox view
**Description:** As a CSM, I want to see all customer communications in one place so that I have complete context.

**Acceptance Criteria:**
- [ ] Inbox tab showing all messages across channels
- [ ] Filter by channel (Email, Slack, Teams, SMS)
- [ ] Filter by customer
- [ ] Conversation threading within channel
- [ ] Unread indicators
- [ ] Quick reply from inbox
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Agent channel selection
**Description:** As an agent, I want to select the appropriate channel when drafting messages so that I reach stakeholders effectively.

**Acceptance Criteria:**
- [ ] `draft_message` tool accepts channel parameter (email, slack, teams, sms)
- [ ] Agent considers stakeholder channel preference
- [ ] Agent considers message urgency (SMS for urgent)
- [ ] Agent considers message length (SMS for short, email for long)
- [ ] Draft includes channel-appropriate formatting
- [ ] Typecheck passes

### US-006: Channel-aware templates
**Description:** As a CSM, I want message templates to adapt to each channel so that formatting is appropriate.

**Acceptance Criteria:**
- [ ] Templates auto-adapt: full HTML for email, markdown for Slack/Teams, plain text for SMS
- [ ] Template preview shows channel-specific rendering
- [ ] Long templates warn when used for SMS
- [ ] Template variables work across channels
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Stakeholder channel preference
**Description:** As a CSM, I want to track each stakeholder's preferred channel so that I reach them effectively.

**Acceptance Criteria:**
- [ ] Channel preference field on stakeholder record
- [ ] Auto-detect preference from response patterns
- [ ] Override preference manually
- [ ] Show preference indicator on stakeholder list
- [ ] Agent uses preference when selecting channel
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Slack channel integration
**Description:** As a CSM, I want to post to shared Slack channels so that I can communicate with customer teams.

**Acceptance Criteria:**
- [ ] List shared channels with customer workspace
- [ ] Select channel when drafting Slack message
- [ ] Option to DM specific user or post to channel
- [ ] Thread replies in existing conversations
- [ ] Typecheck passes

### US-009: Cross-channel approval queue
**Description:** As a CSM, I want approvals to show channel context so that I review messages appropriately.

**Acceptance Criteria:**
- [ ] Approval card shows target channel with icon
- [ ] Preview shows channel-specific formatting
- [ ] Modify message before approval
- [ ] Change channel before sending (if appropriate)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Message delivery tracking
**Description:** As a CSM, I want to see delivery status for all channels so that I know messages were received.

**Acceptance Criteria:**
- [ ] Email: sent, delivered, opened, clicked
- [ ] Slack: sent, delivered, read (if available)
- [ ] Teams: sent, delivered, read
- [ ] SMS: sent, delivered, failed
- [ ] Delivery status in message history
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: OAuth tokens stored in `integrations` table with channel_type, access_token, refresh_token, expires_at
- FR-2: Messages stored in `messages` table with channel, direction (inbound/outbound), status, content, metadata
- FR-3: Slack integration uses Bolt SDK for event handling
- FR-4: Teams integration uses Microsoft Graph API
- FR-5: SMS uses Twilio REST API with webhook for inbound
- FR-6: Inbound messages create notifications and update conversation view
- FR-7: Template rendering uses Handlebars with channel-specific formatters
- FR-8: Rate limiting: Slack (1/sec), Teams (4/sec), SMS (1/sec per number)
- FR-9: Retry logic for transient failures (3 attempts with exponential backoff)
- FR-10: Audit log for all messages with channel, recipient, timestamp

## Non-Goals

- No WhatsApp integration (requires Facebook Business verification)
- No voice calls (separate Zoom/phone integration scope)
- No chatbot auto-responses (agent drafts, human approves)
- No cross-workspace Slack Connect (too complex for MVP)
- No message scheduling (send immediately after approval)

## Technical Considerations

- Slack requires event subscriptions URL for real-time inbound
- Teams requires Azure AD app registration with correct permissions
- Twilio webhooks need signature validation for security
- Consider message queue (Bull) for outbound to handle rate limits
- Slack formatting uses mrkdwn, Teams uses HTML, SMS is plain text
- OAuth refresh flows need background job for token rotation

## Design Considerations

- Channel icons should be instantly recognizable
- Unified inbox should feel like a modern messaging app
- Channel selection should be contextual, not overwhelming
- Mobile-friendly for CSMs on the go

## Success Metrics

- 60% of customers have at least one non-email touchpoint within 90 days
- Response rate improves by 25% with channel-appropriate outreach
- Time to first response reduced by 40% with multi-channel
- SMS open rate >95% for urgent communications

## Open Questions

- Should we support Slack app installation in customer workspaces?
- How to handle customers with multiple Slack workspaces?
- Should SMS require separate phone number per CSM?
- How to handle international SMS regulations (GDPR, TCPA)?
