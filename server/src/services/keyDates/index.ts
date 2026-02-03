/**
 * Key Dates Service (PRD-109)
 *
 * Handles key date tracking and reminder generation for customer relationships.
 * Supports multiple date types with configurable reminder schedules.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { slackService } from '../slack/index.js';

// ============================================
// Types (Mirror of frontend types)
// ============================================

export type KeyDateType =
  | 'contract_anniversary'
  | 'renewal'
  | 'go_live_anniversary'
  | 'stakeholder_birthday'
  | 'company_founding'
  | 'custom_milestone';

export type RecurrencePattern = 'yearly' | 'monthly' | 'quarterly' | 'none';

export type ReminderStatus = 'pending' | 'sent' | 'dismissed' | 'expired';

export type ReminderUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface KeyDate {
  id: string;
  customerId: string;
  customerName?: string;
  stakeholderId?: string;
  stakeholderName?: string;
  dateType: KeyDateType;
  dateValue: string;
  title: string;
  description?: string;
  reminderDaysBefore: number;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern;
  lastRemindedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface KeyDateReminder {
  id: string;
  keyDateId: string;
  keyDate: KeyDate;
  scheduledFor: string;
  daysUntil: number;
  status: ReminderStatus;
  urgency: ReminderUrgency;
  suggestedActions: SuggestedAction[];
  customerContext: CustomerContext;
  sentAt?: string;
  dismissedAt?: string;
  dismissedBy?: string;
}

export interface SuggestedAction {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'gift' | 'document' | 'task';
  title: string;
  description: string;
  priority: 'primary' | 'secondary';
  templateId?: string;
}

export interface CustomerContext {
  customerSince?: string;
  totalRevenue?: number;
  healthScore?: number;
  healthStatus?: 'excellent' | 'good' | 'at_risk' | 'critical';
  recentInteractions?: number;
  lastContactDate?: string;
}

export interface CreateKeyDateInput {
  customerId: string;
  stakeholderId?: string;
  dateType: KeyDateType;
  dateValue: string;
  title: string;
  description?: string;
  reminderDaysBefore?: number;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
}

export interface UpdateKeyDateInput {
  dateType?: KeyDateType;
  dateValue?: string;
  title?: string;
  description?: string;
  reminderDaysBefore?: number;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
}

export interface KeyDateFilters {
  customerId?: string;
  stakeholderId?: string;
  dateType?: KeyDateType;
  fromDate?: string;
  toDate?: string;
  upcoming?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// Default Suggested Actions
// ============================================

const DEFAULT_ACTIONS: Record<KeyDateType, SuggestedAction[]> = {
  contract_anniversary: [
    { id: 'anniversary-email', type: 'email', title: 'Send personalized anniversary note', description: 'Celebrate the partnership milestone', priority: 'primary' },
    { id: 'anniversary-roi', type: 'document', title: 'Share ROI summary / value report', description: 'Demonstrate value delivered', priority: 'secondary' },
    { id: 'anniversary-call', type: 'call', title: 'Consider executive thank-you call', description: 'Personal touch for key accounts', priority: 'secondary' },
  ],
  renewal: [
    { id: 'renewal-prep', type: 'document', title: 'Prepare renewal package', description: 'Compile proposal with usage data', priority: 'primary' },
    { id: 'renewal-meeting', type: 'meeting', title: 'Schedule renewal discussion', description: 'Book meeting to discuss terms', priority: 'primary' },
  ],
  go_live_anniversary: [
    { id: 'golive-email', type: 'email', title: 'Send adoption milestone email', description: 'Celebrate successful adoption', priority: 'primary' },
    { id: 'golive-review', type: 'meeting', title: 'Schedule adoption review', description: 'Review usage and optimize', priority: 'secondary' },
  ],
  stakeholder_birthday: [
    { id: 'birthday-wish', type: 'email', title: 'Send birthday wishes', description: 'Personalized birthday message', priority: 'primary' },
    { id: 'birthday-gift', type: 'gift', title: 'Consider a small gift', description: 'For key stakeholders', priority: 'secondary' },
  ],
  company_founding: [
    { id: 'founding-congrats', type: 'email', title: 'Send congratulations', description: 'Acknowledge company milestone', priority: 'primary' },
  ],
  custom_milestone: [
    { id: 'custom-acknowledge', type: 'email', title: 'Acknowledge milestone', description: 'Personalized acknowledgment', priority: 'primary' },
    { id: 'custom-task', type: 'task', title: 'Create follow-up task', description: 'Set reminder for follow-up', priority: 'secondary' },
  ],
};

// ============================================
// Key Dates Service
// ============================================

export class KeyDatesService {
  private supabase: SupabaseClient | null = null;
  private keyDatesCache: Map<string, KeyDate> = new Map();
  private remindersCache: Map<string, KeyDateReminder> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // CRUD Operations
  // ============================================

  async createKeyDate(input: CreateKeyDateInput): Promise<KeyDate> {
    const keyDate: KeyDate = {
      id: uuidv4(),
      customerId: input.customerId,
      stakeholderId: input.stakeholderId,
      dateType: input.dateType,
      dateValue: input.dateValue,
      title: input.title,
      description: input.description,
      reminderDaysBefore: input.reminderDaysBefore ?? 7,
      isRecurring: input.isRecurring ?? (input.dateType !== 'custom_milestone'),
      recurrencePattern: input.recurrencePattern ?? 'yearly',
      createdAt: new Date().toISOString(),
    };

    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('key_dates').insert({
          id: keyDate.id,
          customer_id: keyDate.customerId,
          stakeholder_id: keyDate.stakeholderId,
          date_type: keyDate.dateType,
          date_value: keyDate.dateValue,
          title: keyDate.title,
          description: keyDate.description,
          reminder_days_before: keyDate.reminderDaysBefore,
          is_recurring: keyDate.isRecurring,
          recurrence_pattern: keyDate.recurrencePattern,
          created_at: keyDate.createdAt,
        });

        if (error) {
          console.error('[KeyDates] Failed to create key date:', error);
        }
      } catch (e) {
        console.error('[KeyDates] Database error:', e);
      }
    }

    this.keyDatesCache.set(keyDate.id, keyDate);
    console.log(`[KeyDates] Created key date: ${keyDate.title} (${keyDate.id})`);
    return keyDate;
  }

  async getKeyDate(id: string): Promise<KeyDate | null> {
    // Check cache first
    if (this.keyDatesCache.has(id)) {
      return this.keyDatesCache.get(id)!;
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('key_dates')
          .select(`
            *,
            customers(name),
            stakeholders(name)
          `)
          .eq('id', id)
          .single();

        if (data && !error) {
          const keyDate = this.mapDbToKeyDate(data);
          this.keyDatesCache.set(keyDate.id, keyDate);
          return keyDate;
        }
      } catch (e) {
        console.error('[KeyDates] Failed to get key date:', e);
      }
    }

    return null;
  }

  async updateKeyDate(id: string, input: UpdateKeyDateInput): Promise<KeyDate | null> {
    const existing = await this.getKeyDate(id);
    if (!existing) return null;

    const updated: KeyDate = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    if (this.supabase) {
      try {
        await this.supabase.from('key_dates').update({
          date_type: updated.dateType,
          date_value: updated.dateValue,
          title: updated.title,
          description: updated.description,
          reminder_days_before: updated.reminderDaysBefore,
          is_recurring: updated.isRecurring,
          recurrence_pattern: updated.recurrencePattern,
          updated_at: updated.updatedAt,
        }).eq('id', id);
      } catch (e) {
        console.error('[KeyDates] Failed to update key date:', e);
      }
    }

    this.keyDatesCache.set(id, updated);
    return updated;
  }

  async deleteKeyDate(id: string): Promise<boolean> {
    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('key_dates').delete().eq('id', id);
        if (error) {
          console.error('[KeyDates] Failed to delete key date:', error);
          return false;
        }
      } catch (e) {
        console.error('[KeyDates] Database error:', e);
        return false;
      }
    }

    this.keyDatesCache.delete(id);
    console.log(`[KeyDates] Deleted key date: ${id}`);
    return true;
  }

  async listKeyDates(filters: KeyDateFilters = {}): Promise<{ keyDates: KeyDate[]; total: number }> {
    if (this.supabase) {
      try {
        let query = this.supabase
          .from('key_dates')
          .select(`
            *,
            customers(name),
            stakeholders(name)
          `, { count: 'exact' });

        if (filters.customerId) {
          query = query.eq('customer_id', filters.customerId);
        }
        if (filters.stakeholderId) {
          query = query.eq('stakeholder_id', filters.stakeholderId);
        }
        if (filters.dateType) {
          query = query.eq('date_type', filters.dateType);
        }
        if (filters.fromDate) {
          query = query.gte('date_value', filters.fromDate);
        }
        if (filters.toDate) {
          query = query.lte('date_value', filters.toDate);
        }
        if (filters.upcoming) {
          query = query.gte('date_value', new Date().toISOString().split('T')[0]);
        }
        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }

        query = query.order('date_value', { ascending: true });

        if (filters.limit) {
          query = query.limit(filters.limit);
        }
        if (filters.offset) {
          query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
        }

        const { data, error, count } = await query;

        if (data && !error) {
          const keyDates = data.map(this.mapDbToKeyDate);
          return { keyDates, total: count || keyDates.length };
        }
      } catch (e) {
        console.error('[KeyDates] Failed to list key dates:', e);
      }
    }

    // Fallback to cache
    let results = Array.from(this.keyDatesCache.values());

    if (filters.customerId) {
      results = results.filter(kd => kd.customerId === filters.customerId);
    }
    if (filters.dateType) {
      results = results.filter(kd => kd.dateType === filters.dateType);
    }
    if (filters.upcoming) {
      const today = new Date().toISOString().split('T')[0];
      results = results.filter(kd => kd.dateValue >= today);
    }

    results.sort((a, b) => a.dateValue.localeCompare(b.dateValue));

    return { keyDates: results, total: results.length };
  }

  // ============================================
  // Reminder Generation
  // ============================================

  async getUpcomingReminders(
    days: number = 30,
    userId?: string
  ): Promise<KeyDateReminder[]> {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    const { keyDates } = await this.listKeyDates({
      fromDate: today.toISOString().split('T')[0],
      toDate: endDate.toISOString().split('T')[0],
    });

    const reminders: KeyDateReminder[] = [];

    for (const keyDate of keyDates) {
      const dateValue = new Date(keyDate.dateValue);
      const daysUntil = Math.ceil((dateValue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Only create reminder if within the reminder window
      if (daysUntil <= keyDate.reminderDaysBefore) {
        const reminder = await this.createReminder(keyDate, daysUntil);
        reminders.push(reminder);
      }
    }

    // Sort by urgency and days until
    reminders.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return a.daysUntil - b.daysUntil;
    });

    return reminders;
  }

  private async createReminder(keyDate: KeyDate, daysUntil: number): Promise<KeyDateReminder> {
    const urgency = this.calculateUrgency(daysUntil, keyDate.dateType);
    const customerContext = await this.getCustomerContext(keyDate.customerId);
    const suggestedActions = DEFAULT_ACTIONS[keyDate.dateType] || [];

    const reminder: KeyDateReminder = {
      id: uuidv4(),
      keyDateId: keyDate.id,
      keyDate,
      scheduledFor: keyDate.dateValue,
      daysUntil,
      status: 'pending',
      urgency,
      suggestedActions,
      customerContext,
    };

    this.remindersCache.set(reminder.id, reminder);
    return reminder;
  }

  private calculateUrgency(daysUntil: number, dateType: KeyDateType): ReminderUrgency {
    // Renewal dates get higher urgency
    if (dateType === 'renewal') {
      if (daysUntil <= 1) return 'critical';
      if (daysUntil <= 7) return 'high';
      if (daysUntil <= 14) return 'medium';
      return 'low';
    }

    // Contract anniversaries are important
    if (dateType === 'contract_anniversary') {
      if (daysUntil <= 1) return 'high';
      if (daysUntil <= 7) return 'medium';
      return 'low';
    }

    // Default urgency calculation
    if (daysUntil <= 1) return 'high';
    if (daysUntil <= 3) return 'medium';
    return 'low';
  }

  private async getCustomerContext(customerId: string): Promise<CustomerContext> {
    if (!this.supabase) {
      return {};
    }

    try {
      const { data: customer } = await this.supabase
        .from('customers')
        .select('created_at, arr, health_score')
        .eq('id', customerId)
        .single();

      if (!customer) return {};

      const healthScore = customer.health_score || 0;
      let healthStatus: CustomerContext['healthStatus'] = 'good';
      if (healthScore >= 80) healthStatus = 'excellent';
      else if (healthScore >= 60) healthStatus = 'good';
      else if (healthScore >= 40) healthStatus = 'at_risk';
      else healthStatus = 'critical';

      return {
        customerSince: customer.created_at,
        totalRevenue: customer.arr,
        healthScore,
        healthStatus,
      };
    } catch (e) {
      console.error('[KeyDates] Failed to get customer context:', e);
      return {};
    }
  }

  // ============================================
  // Reminder Actions
  // ============================================

  async dismissReminder(reminderId: string, userId: string): Promise<void> {
    const reminder = this.remindersCache.get(reminderId);
    if (reminder) {
      reminder.status = 'dismissed';
      reminder.dismissedAt = new Date().toISOString();
      reminder.dismissedBy = userId;
      this.remindersCache.set(reminderId, reminder);
    }

    if (this.supabase) {
      try {
        await this.supabase.from('key_date_reminders').upsert({
          id: reminderId,
          status: 'dismissed',
          dismissed_at: new Date().toISOString(),
          dismissed_by: userId,
        });
      } catch (e) {
        console.error('[KeyDates] Failed to dismiss reminder:', e);
      }
    }
  }

  async markReminderSent(reminderId: string, keyDateId: string): Promise<void> {
    const reminder = this.remindersCache.get(reminderId);
    if (reminder) {
      reminder.status = 'sent';
      reminder.sentAt = new Date().toISOString();
      this.remindersCache.set(reminderId, reminder);
    }

    // Update last_reminded_at on the key date
    if (this.supabase) {
      try {
        await this.supabase.from('key_dates').update({
          last_reminded_at: new Date().toISOString(),
        }).eq('id', keyDateId);
      } catch (e) {
        console.error('[KeyDates] Failed to update last reminded:', e);
      }
    }
  }

  // ============================================
  // Slack Notifications
  // ============================================

  async sendSlackReminder(userId: string, reminder: KeyDateReminder, channelId: string): Promise<void> {
    const { keyDate, daysUntil, customerContext, suggestedActions } = reminder;

    // Format date
    const dateStr = new Date(keyDate.dateValue).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Build context section
    const contextLines = [];
    if (customerContext.customerSince) {
      contextLines.push(`Customer Since: ${new Date(customerContext.customerSince).toLocaleDateString()}`);
    }
    if (customerContext.totalRevenue) {
      contextLines.push(`Total Revenue: $${customerContext.totalRevenue.toLocaleString()}`);
    }
    if (customerContext.healthStatus) {
      const healthEmoji = {
        excellent: ':star:',
        good: ':white_check_mark:',
        at_risk: ':warning:',
        critical: ':x:',
      }[customerContext.healthStatus];
      contextLines.push(`Relationship Health: ${healthEmoji} ${customerContext.healthStatus.charAt(0).toUpperCase() + customerContext.healthStatus.slice(1)}`);
    }

    // Build suggested actions section
    const actionsText = suggestedActions
      .map(action => `- ${action.title}`)
      .join('\n');

    // Build Slack blocks
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:calendar: Key Date Reminder: ${keyDate.customerName || 'Customer'}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Upcoming:* ${keyDate.title}`,
          },
          {
            type: 'mrkdwn',
            text: `*Date:* ${dateStr} (${daysUntil} ${daysUntil === 1 ? 'day' : 'days'} away)`,
          },
        ],
      },
    ];

    if (contextLines.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Context:*\n${contextLines.join('\n')}`,
        },
      } as any);
    }

    if (actionsText) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Suggested Actions:*\n${actionsText}`,
        },
      } as any);
    }

    // Add action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Draft Email', emoji: true },
          action_id: `key_date_email_${reminder.id}`,
          style: 'primary',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Customer', emoji: true },
          action_id: `key_date_view_${keyDate.customerId}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Dismiss', emoji: true },
          action_id: `key_date_dismiss_${reminder.id}`,
        },
      ],
    } as any);

    try {
      await slackService.sendMessage(userId, {
        channel: channelId,
        text: `Key Date Reminder: ${keyDate.title} for ${keyDate.customerName || 'Customer'} - ${daysUntil} days away`,
        blocks,
      });

      await this.markReminderSent(reminder.id, keyDate.id);
      console.log(`[KeyDates] Sent Slack reminder for ${keyDate.title}`);
    } catch (error) {
      console.error('[KeyDates] Failed to send Slack reminder:', error);
      throw error;
    }
  }

  // ============================================
  // Bulk Operations
  // ============================================

  async importFromContract(
    customerId: string,
    contractData: {
      startDate?: string;
      renewalDate?: string;
      goLiveDate?: string;
    }
  ): Promise<KeyDate[]> {
    const imported: KeyDate[] = [];

    if (contractData.startDate) {
      const keyDate = await this.createKeyDate({
        customerId,
        dateType: 'contract_anniversary',
        dateValue: contractData.startDate,
        title: 'Contract Anniversary',
        description: 'Annual contract start anniversary',
        isRecurring: true,
        recurrencePattern: 'yearly',
      });
      imported.push(keyDate);
    }

    if (contractData.renewalDate) {
      const keyDate = await this.createKeyDate({
        customerId,
        dateType: 'renewal',
        dateValue: contractData.renewalDate,
        title: 'Contract Renewal',
        description: 'Contract renewal date',
        reminderDaysBefore: 30,
        isRecurring: false,
        recurrencePattern: 'none',
      });
      imported.push(keyDate);
    }

    if (contractData.goLiveDate) {
      const keyDate = await this.createKeyDate({
        customerId,
        dateType: 'go_live_anniversary',
        dateValue: contractData.goLiveDate,
        title: 'Go-Live Anniversary',
        description: 'Product launch anniversary',
        isRecurring: true,
        recurrencePattern: 'yearly',
      });
      imported.push(keyDate);
    }

    return imported;
  }

  async getKeyDatesByCustomer(customerId: string): Promise<KeyDate[]> {
    const { keyDates } = await this.listKeyDates({ customerId });
    return keyDates;
  }

  // ============================================
  // Database Mapping
  // ============================================

  private mapDbToKeyDate(data: any): KeyDate {
    return {
      id: data.id,
      customerId: data.customer_id,
      customerName: data.customers?.name,
      stakeholderId: data.stakeholder_id,
      stakeholderName: data.stakeholders?.name,
      dateType: data.date_type,
      dateValue: data.date_value,
      title: data.title,
      description: data.description,
      reminderDaysBefore: data.reminder_days_before || 7,
      isRecurring: data.is_recurring || false,
      recurrencePattern: data.recurrence_pattern || 'none',
      lastRemindedAt: data.last_reminded_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

// Singleton instance
export const keyDatesService = new KeyDatesService();
