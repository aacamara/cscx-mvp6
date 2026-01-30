# PRD-262: Push Notifications

## Metadata
- **PRD ID**: PRD-262
- **Title**: Push Notifications
- **Category**: J - Mobile & Accessibility
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-261 (Mobile UI), Notification system

---

## Problem Statement

CSMs miss time-sensitive alerts when away from their desktop - renewal deadlines, health score drops, escalations, and approval requests. Email notifications are often delayed or buried, leading to missed opportunities and slower response times.

## User Story

> As a CSM, I want to receive push notifications on my mobile device for urgent customer matters so that I can respond quickly even when I'm away from my desk.

---

## Functional Requirements

### FR-1: Notification Types
- **FR-1.1**: Critical alerts (health drop, escalation)
- **FR-1.2**: Approval requests requiring action
- **FR-1.3**: @mention notifications
- **FR-1.4**: Task due reminders
- **FR-1.5**: Customer activity alerts (optional)

### FR-2: Notification Preferences
- **FR-2.1**: Per-category enable/disable
- **FR-2.2**: Quiet hours configuration
- **FR-2.3**: Priority filtering (critical only, all)
- **FR-2.4**: Per-customer override
- **FR-2.5**: Delivery channel preference (push, email, both)

### FR-3: Rich Notifications
- **FR-3.1**: Customer name and context in notification
- **FR-3.2**: Quick actions from notification
- **FR-3.3**: Expandable detail view
- **FR-3.4**: Notification grouping by customer
- **FR-3.5**: Inline reply capability

### FR-4: Delivery Management
- **FR-4.1**: Reliable delivery with retry
- **FR-4.2**: Deduplication of similar alerts
- **FR-4.3**: Rate limiting to prevent spam
- **FR-4.4**: Read receipt tracking
- **FR-4.5**: Expiration for time-sensitive notifications

### FR-5: Cross-Device Sync
- **FR-5.1**: Notification badge sync across devices
- **FR-5.2**: Read status sync
- **FR-5.3**: Dismissal sync
- **FR-5.4**: Notification history accessible everywhere

---

## Non-Functional Requirements

### NFR-1: Reliability
- 99.5% delivery rate within 30 seconds

### NFR-2: Battery
- Minimal battery impact on mobile devices

### NFR-3: Privacy
- Sensitive data not exposed in lock screen preview

---

## Technical Approach

### Push Service Architecture

```typescript
// Notification service
interface PushNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: {
    customer_id?: string;
    entity_type?: string;
    entity_id?: string;
    deep_link?: string;
    actions?: NotificationAction[];
  };
  priority: 'critical' | 'high' | 'normal' | 'low';
  ttl?: number; // Time to live in seconds
  collapse_key?: string; // For grouping/replacing
}

interface NotificationAction {
  id: string;
  label: string;
  action_type: 'approve' | 'dismiss' | 'reply' | 'navigate';
  payload?: any;
}

type NotificationType =
  | 'health_alert'
  | 'escalation'
  | 'approval_request'
  | 'mention'
  | 'task_due'
  | 'renewal_reminder'
  | 'message';
```

### Data Model

```sql
-- push_subscriptions table
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  platform VARCHAR(20) NOT NULL, -- 'web', 'ios', 'android'
  endpoint TEXT NOT NULL, -- Push service endpoint
  auth_key TEXT, -- For web push
  p256dh_key TEXT, -- For web push
  device_token TEXT, -- For native
  device_name VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- notification_preferences table
CREATE TABLE notification_preferences (
  user_id UUID REFERENCES users(id) PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,

  -- Per-type preferences
  health_alerts BOOLEAN DEFAULT true,
  escalations BOOLEAN DEFAULT true,
  approval_requests BOOLEAN DEFAULT true,
  mentions BOOLEAN DEFAULT true,
  task_reminders BOOLEAN DEFAULT true,
  renewal_reminders BOOLEAN DEFAULT true,
  customer_activity BOOLEAN DEFAULT false,

  -- Priority filter
  min_priority VARCHAR(20) DEFAULT 'normal', -- 'critical', 'high', 'normal', 'low'

  -- Quiet hours (in user's timezone)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_override_critical BOOLEAN DEFAULT true,

  -- Delivery
  prefer_push BOOLEAN DEFAULT true,
  prefer_email BOOLEAN DEFAULT true,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- notification_history table
CREATE TABLE notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(500),
  body TEXT,
  data JSONB,
  priority VARCHAR(20),

  -- Delivery status
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Action taken
  action_taken VARCHAR(50),
  action_data JSONB,

  -- Metadata
  collapse_key VARCHAR(200),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id, is_active);
CREATE INDEX idx_notif_history_user ON notification_history(user_id, sent_at DESC);
CREATE INDEX idx_notif_history_unread ON notification_history(user_id) WHERE read_at IS NULL;
```

### Web Push Implementation

```typescript
// Service worker for web push
self.addEventListener('push', (event) => {
  const data = event.data?.json();

  const options: NotificationOptions = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: data.data,
    tag: data.collapse_key || data.id,
    renotify: true,
    requireInteraction: data.priority === 'critical',
    actions: data.data?.actions?.map(a => ({
      action: a.id,
      title: a.label
    }))
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action) {
    // Handle action button click
    handleNotificationAction(event.action, event.notification.data);
  } else {
    // Open the app
    event.waitUntil(
      clients.openWindow(event.notification.data.deep_link || '/')
    );
  }
});
```

### Server-Side Push Delivery

```typescript
import webPush from 'web-push';
import { apn, fcm } from './push-providers';

class PushService {
  async sendNotification(notification: PushNotification): Promise<void> {
    // Check preferences
    const prefs = await getNotificationPreferences(notification.user_id);
    if (!this.shouldSend(notification, prefs)) {
      return;
    }

    // Get subscriptions
    const subscriptions = await getPushSubscriptions(notification.user_id);

    // Send to each device
    await Promise.allSettled(subscriptions.map(sub => {
      switch (sub.platform) {
        case 'web':
          return this.sendWebPush(sub, notification);
        case 'ios':
          return this.sendAPNS(sub, notification);
        case 'android':
          return this.sendFCM(sub, notification);
      }
    }));

    // Record in history
    await recordNotification(notification);
  }

  private shouldSend(notification: PushNotification, prefs: NotificationPreferences): boolean {
    if (!prefs.enabled) return false;
    if (!prefs[notification.type]) return false;

    // Check quiet hours
    if (prefs.quiet_hours_enabled && this.isQuietHours(prefs)) {
      if (notification.priority !== 'critical' || !prefs.quiet_hours_override_critical) {
        return false;
      }
    }

    // Check priority filter
    const priorityOrder = ['low', 'normal', 'high', 'critical'];
    if (priorityOrder.indexOf(notification.priority) < priorityOrder.indexOf(prefs.min_priority)) {
      return false;
    }

    return true;
  }

  private async sendWebPush(sub: PushSubscription, notification: PushNotification): Promise<void> {
    await webPush.sendNotification(
      { endpoint: sub.endpoint, keys: { auth: sub.auth_key, p256dh: sub.p256dh_key } },
      JSON.stringify(notification),
      { TTL: notification.ttl || 3600 }
    );
  }
}
```

### API Endpoints

```typescript
// Subscriptions
POST   /api/push/subscribe
DELETE /api/push/unsubscribe
GET    /api/push/subscriptions

// Preferences
GET    /api/notifications/preferences
PATCH  /api/notifications/preferences

// History
GET    /api/notifications
PATCH  /api/notifications/:id/read
PATCH  /api/notifications/:id/dismiss
POST   /api/notifications/:id/action

// Testing
POST   /api/push/test (dev only)
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Push opt-in rate | 70%+ | Subscription tracking |
| Delivery success rate | 99.5% | Delivery logs |
| Click-through rate | 30%+ | Action tracking |
| Response time (critical) | < 5 min median | Timestamp analysis |

---

## Acceptance Criteria

- [ ] Web push works on Chrome, Firefox, Safari
- [ ] Rich notifications with customer context
- [ ] Quick actions functional from notification
- [ ] Notification preferences respected
- [ ] Quiet hours prevent non-critical alerts
- [ ] Critical alerts override quiet hours
- [ ] Read status syncs across devices
- [ ] Notification history accessible
- [ ] Rate limiting prevents spam
- [ ] Deep links open correct view

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 1 day |
| Web push service | 3 days |
| Service worker | 2 days |
| Notification preferences UI | 2 days |
| Push delivery logic | 2 days |
| Notification history | 2 days |
| Cross-device sync | 2 days |
| Testing | 2 days |
| **Total** | **16 days** |

---

## Notes

- Native push for iOS/Android requires app store apps
- Consider Firebase Cloud Messaging (FCM) for unified delivery
- Future: Notification bundling/digest
- Future: Smart notification timing based on activity patterns
- Future: AI-prioritized notification ordering
