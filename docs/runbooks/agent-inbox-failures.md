# Agent Inbox Action Execution Failures Runbook

**Version**: 1.0
**Last Updated**: 2026-02-02

## Overview

Agent Inbox manages HITL (Human-in-the-Loop) approval for agent actions like sending emails, booking meetings, and updating CRM records.

## Action Lifecycle

```
proposed → approved → executed → completed
    ↓         ↓           ↓
 rejected   timeout     failed
```

## Common Failures

### 1. Action Stuck in "Proposed"

**Symptoms**: Actions remain pending without user notification

**Diagnosis**:
```sql
SELECT id, action_type, status, created_at
FROM agent_actions
WHERE status = 'proposed'
AND created_at < NOW() - INTERVAL '1 hour';
```

**Causes**:
- Notification not sent
- User not logged in
- Action created without proper workspace context

**Resolution**:
1. Check WebSocket connection status
2. Verify user is in correct workspace
3. Re-trigger notification via API

### 2. Execution Fails After Approval

**Symptoms**: User approves but action fails

**Diagnosis**:
```sql
SELECT id, action_type, error_message, payload
FROM agent_actions
WHERE status = 'failed'
ORDER BY updated_at DESC LIMIT 10;
```

**Causes**:
- Google OAuth tokens expired
- External service unavailable
- Invalid payload data

**Resolution**:
1. Refresh OAuth tokens
2. Check external service status
3. Review and fix payload
4. Retry action: `POST /api/actions/:id/retry`

### 3. Email Send Failures

**Symptoms**: Draft approved but email not sent

**Diagnosis**:
```bash
# Check Gmail API status
curl -X GET "https://cscx-api-.../api/google/status"
```

**Causes**:
- Gmail API quota exceeded
- Invalid recipient address
- OAuth scope missing

**Resolution**:
1. Check Gmail quota in Google Console
2. Verify recipient email format
3. Re-authenticate with full scopes

### 4. Meeting Booking Failures

**Symptoms**: Calendar event not created

**Causes**:
- Calendar API permissions
- Conflicting event times
- Invalid attendee emails

**Resolution**:
1. Check Calendar API permissions
2. Verify time slot availability
3. Validate attendee list

### 5. Action Timeout

**Symptoms**: Action approved but never executed

**Causes**:
- Server restart during execution
- Network timeout
- Job queue backed up

**Resolution**:
1. Check Cloud Run instance logs
2. Verify job processor is running
3. Manually retry: `POST /api/actions/:id/retry`

## Monitoring

### Key Metrics
- Actions approved per hour
- Average time to approval
- Execution success rate
- Timeout rate

### Health Check
```bash
curl https://cscx-api-.../api/actions/health
```

## Recovery Procedures

### Bulk Retry Failed Actions
```sql
-- Find failed actions
SELECT id FROM agent_actions
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '24 hours';
```

```bash
# Retry each
for id in $(failed_ids); do
  curl -X POST "https://cscx-api-.../api/actions/$id/retry"
done
```

### Clear Stuck Actions
```sql
-- Mark old proposed actions as expired
UPDATE agent_actions
SET status = 'expired'
WHERE status = 'proposed'
AND created_at < NOW() - INTERVAL '24 hours';
```

## Escalation

1. **L1**: Retry failed actions, check logs
2. **L2**: OAuth refresh, external service investigation
3. **L3**: Architecture review, job queue issues
