# PRD: Email Integration & Summarization

## Overview
Connect user's email (Gmail) and enable AI-powered email summarization and querying from the chat UI.

## Problem Statement
CSMs spend significant time reading emails. They need:
1. Quick summaries of important emails
2. Ability to query email history ("What did Sarah say about the renewal?")
3. AI-powered prioritization of emails requiring attention
4. Integration with customer context (emails about specific customers)

## User Stories

### US-001: Gmail OAuth connection flow
- Add "Connect Gmail" button to settings or workspace panel
- Implement OAuth2 flow for Gmail API access
- Request scopes: gmail.readonly, gmail.send (for future)
- Store refresh token securely for user
- Show connection status indicator
- Typecheck passes

### US-002: Fetch and index recent emails
- Create server/src/services/email/emailService.ts
- Implement fetchRecentEmails(userId, days) - fetch last N days
- Extract: subject, from, to, date, body (text), thread_id
- Store in emails table with user_id and optional customer_id matching
- Run initial sync on connection
- Typecheck passes

### US-003: Email summarization endpoint
- Create POST /api/email/summarize endpoint
- Accept: { emailIds: string[] } or { query: string, limit: number }
- Use Claude to generate summary of selected emails
- Return: summary, key_points, action_items, mentioned_customers
- Typecheck passes

### US-004: Query emails from chat
- Enable natural language email queries in AgentControlCenter
- Detect email-related queries: "emails from", "what did X say", "recent emails about"
- Route to email search/summarization
- Return formatted response with email excerpts and summaries
- Typecheck passes

### US-005: Email priority dashboard widget
- Create components/EmailPriorityWidget.tsx
- Show top 5 emails requiring attention
- Priority based on: sender importance, urgency keywords, customer health
- Quick actions: summarize, view, respond (future)
- Refresh automatically
- Typecheck passes

### US-006: Link emails to customers
- Match incoming emails to customers by:
  - Sender domain matching company domain
  - Stakeholder email addresses
  - Customer name mentions in subject/body
- Store customer_id on email records
- Show customer emails in customer detail view
- Typecheck passes

### US-007: Create emails database table
- Create database/migrations/066_emails.sql
- Columns: id, user_id, customer_id, gmail_id, thread_id, subject, from_email, from_name, to_emails, date, body_text, body_html, labels, is_read, is_important, summary, created_at
- Add indexes on user_id, customer_id, date
- Add RLS policies
- Typecheck passes

## Acceptance Criteria
1. User can connect Gmail via OAuth
2. Recent emails are synced and stored
3. User can ask "summarize my important emails" in chat
4. User can query "what did [stakeholder] say about [topic]"
5. Emails are linked to relevant customers
6. Email priority widget shows actionable items

## Priority
P2 - High value feature

## Dependencies
- Google OAuth infrastructure exists
- Gmail API enabled in Google Cloud project
- AgentControlCenter working
