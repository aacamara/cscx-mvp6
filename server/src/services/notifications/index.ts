/**
 * Notification Service
 *
 * Unified service for sending notifications via multiple channels:
 * - In-app notifications (database)
 * - Email notifications
 * - Slack webhooks
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { sendSlackAlert, type SlackAlertType } from './slack.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export type NotificationType =
  | 'renewal_reminder'
  | 'health_alert'
  | 'action_complete'
  | 'escalation'
  | 'risk_signal'
  | 'churn_alert'
  | 'approval_required'
  | 'system';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  type: NotificationType;
  title: string;
  body: string;
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
  customerId?: string;
  customerName?: string;
  actionUrl?: string;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  slackWebhook?: string;
  renewalAlerts: boolean;
  healthAlerts: boolean;
  churnAlerts: boolean;
  escalationAlerts: boolean;
}

/**
 * Send a notification to a user via all enabled channels
 */
export async function sendNotification(
  userId: string,
  notification: Notification
): Promise<{
  inApp: boolean;
  email: boolean;
  slack: boolean;
}> {
  const results = {
    inApp: false,
    email: false,
    slack: false,
  };

  // Get user preferences
  const prefs = await getUserPreferences(userId);

  // 1. Always save to database (in-app notification)
  try {
    results.inApp = await saveNotification(userId, notification);
  } catch (error) {
    console.error('Failed to save in-app notification:', error);
  }

  // 2. Send email if enabled
  if (prefs.emailNotifications && shouldSendEmail(notification.type, prefs)) {
    try {
      results.email = await sendEmailNotification(userId, notification);
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  // 3. Send Slack if webhook configured and type matches preferences
  if (prefs.slackWebhook && shouldSendSlack(notification.type, prefs)) {
    try {
      results.slack = await sendSlackNotification(prefs.slackWebhook, notification);
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }

  return results;
}

/**
 * Save notification to database
 */
async function saveNotification(userId: string, notification: Notification): Promise<boolean> {
  if (!supabase) {
    console.log('[Mock] Saved notification:', notification.title);
    return true;
  }

  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    priority: notification.priority || 'medium',
    data: notification.data || {},
    customer_id: notification.customerId,
    action_url: notification.actionUrl,
    read_at: null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Error saving notification:', error);
    return false;
  }

  return true;
}

/**
 * Get user notification preferences
 */
async function getUserPreferences(userId: string): Promise<NotificationPreferences> {
  const defaults: NotificationPreferences = {
    emailNotifications: true,
    renewalAlerts: true,
    healthAlerts: true,
    churnAlerts: true,
    escalationAlerts: true,
  };

  if (!supabase) {
    return defaults;
  }

  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data) {
    return defaults;
  }

  return {
    emailNotifications: data.email_notifications ?? true,
    slackWebhook: data.slack_webhook,
    renewalAlerts: data.renewal_alerts ?? true,
    healthAlerts: data.health_alerts ?? true,
    churnAlerts: data.churn_alerts ?? true,
    escalationAlerts: data.escalation_alerts ?? true,
  };
}

/**
 * Check if email should be sent for this notification type
 */
function shouldSendEmail(type: NotificationType, prefs: NotificationPreferences): boolean {
  switch (type) {
    case 'renewal_reminder':
      return prefs.renewalAlerts;
    case 'health_alert':
    case 'risk_signal':
      return prefs.healthAlerts;
    case 'churn_alert':
      return prefs.churnAlerts;
    case 'escalation':
      return prefs.escalationAlerts;
    case 'approval_required':
    case 'action_complete':
      return prefs.emailNotifications;
    default:
      return prefs.emailNotifications;
  }
}

/**
 * Check if Slack should be notified for this type
 */
function shouldSendSlack(type: NotificationType, prefs: NotificationPreferences): boolean {
  // Same logic as email for now
  return shouldSendEmail(type, prefs);
}

/**
 * Send email notification (placeholder - would use an email service like SendGrid)
 */
async function sendEmailNotification(
  userId: string,
  notification: Notification
): Promise<boolean> {
  // In a real implementation, this would:
  // 1. Get user's email from database
  // 2. Use an email service (SendGrid, AWS SES, etc.) to send

  console.log(`[Mock] Email notification to user ${userId}:`, {
    title: notification.title,
    body: notification.body.substring(0, 100),
  });

  // For now, just return success
  return true;
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(
  webhookUrl: string,
  notification: Notification
): Promise<boolean> {
  // Map notification type to Slack alert type
  const slackTypeMap: Record<NotificationType, SlackAlertType> = {
    renewal_reminder: 'renewal_soon',
    health_alert: 'health_drop',
    risk_signal: 'risk_signal',
    churn_alert: 'churn_risk',
    escalation: 'escalation',
    approval_required: 'action_required',
    action_complete: 'info',
    system: 'info',
  };

  return sendSlackAlert(webhookUrl, {
    type: slackTypeMap[notification.type] || 'info',
    title: notification.title,
    message: notification.body,
    customer: notification.customerName ? {
      id: notification.customerId || '',
      name: notification.customerName,
    } : undefined,
    priority: notification.priority,
    actionUrl: notification.actionUrl,
    fields: notification.data,
  });
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(
  userId: string,
  limit: number = 20
): Promise<Notification[]> {
  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map(n => ({
    type: n.type,
    title: n.title,
    body: n.body,
    priority: n.priority,
    data: n.data,
    customerId: n.customer_id,
    actionUrl: n.action_url,
  }));
}

/**
 * Mark notifications as read
 */
export async function markAsRead(notificationIds: string[]): Promise<boolean> {
  if (!supabase) {
    return true;
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', notificationIds);

  return !error;
}

/**
 * Schedule renewal reminder notifications
 */
export async function scheduleRenewalAlerts(): Promise<number> {
  if (!supabase) {
    console.log('[Mock] Would schedule renewal alerts');
    return 0;
  }

  let alertsSent = 0;
  const alertDays = [90, 60, 30, 14, 7];

  for (const days of alertDays) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    // Find customers with renewals on this date
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, arr, health_score, assigned_csm_id')
      .eq('renewal_date', targetDateStr);

    if (!customers) continue;

    for (const customer of customers) {
      if (!customer.assigned_csm_id) continue;

      const urgency = days <= 14 ? 'urgent' : days <= 30 ? 'high' : 'medium';

      await sendNotification(customer.assigned_csm_id, {
        type: 'renewal_reminder',
        title: `Renewal Alert: ${customer.name}`,
        body: `${customer.name} renewal in ${days} days - $${(customer.arr || 0).toLocaleString()} ARR. Health score: ${customer.health_score || 'N/A'}`,
        priority: urgency as NotificationPriority,
        customerId: customer.id,
        customerName: customer.name,
        data: {
          daysToRenewal: days,
          arr: customer.arr,
          healthScore: customer.health_score,
        },
        actionUrl: `/customers/${customer.id}`,
      });

      alertsSent++;
    }
  }

  return alertsSent;
}

/**
 * Send health drop alerts
 */
export async function sendHealthDropAlerts(
  customerId: string,
  customerName: string,
  previousScore: number,
  newScore: number,
  csmUserId: string
): Promise<boolean> {
  const drop = previousScore - newScore;

  if (drop < 10) {
    return false; // Not significant enough
  }

  const priority: NotificationPriority =
    newScore < 40 ? 'urgent' :
    newScore < 60 ? 'high' :
    'medium';

  const result = await sendNotification(csmUserId, {
    type: 'health_alert',
    title: `Health Drop Alert: ${customerName}`,
    body: `${customerName}'s health score dropped ${drop} points (${previousScore} → ${newScore}). Immediate attention may be required.`,
    priority,
    customerId,
    customerName,
    data: {
      previousScore,
      newScore,
      drop,
    },
    actionUrl: `/customers/${customerId}`,
  });

  return result.inApp || result.email || result.slack;
}

/**
 * Update user notification preferences
 */
export async function updatePreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<boolean> {
  if (!supabase) {
    return true;
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      email_notifications: preferences.emailNotifications,
      slack_webhook: preferences.slackWebhook,
      renewal_alerts: preferences.renewalAlerts,
      health_alerts: preferences.healthAlerts,
      churn_alerts: preferences.churnAlerts,
      escalation_alerts: preferences.escalationAlerts,
    });

  return !error;
}

export default {
  sendNotification,
  getUnreadNotifications,
  markAsRead,
  scheduleRenewalAlerts,
  sendHealthDropAlerts,
  updatePreferences,
};
