/**
 * Welcome Sequence Generator Service
 * PRD-028: Generates personalized welcome email sequences for new customers
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  generateWelcomeDay1Email,
  generateWelcomeDay3Email,
  generateWelcomeDay7Email,
  generateWelcomeDay14Email,
  generateWelcomeDay30Email,
  WELCOME_SEQUENCE_TEMPLATE,
} from '../../templates/emails/index.js';

// Types
export interface CustomerData {
  id: string;
  name: string;
  arr?: number;
  industry?: string;
  segment?: string;
  stage?: string;
}

export interface StakeholderData {
  id: string;
  name: string;
  email: string;
  role?: string;
  title?: string;
  isPrimary?: boolean;
}

export interface CSMData {
  name: string;
  email: string;
  title?: string;
  calendarLink?: string;
}

export interface OnboardingData {
  startDate: Date;
  kickoffDate?: Date;
  kickoffTime?: string;
  meetingLink?: string;
  attendees?: Array<{ name: string; role: string }>;
}

export interface SequenceGenerationOptions {
  customerId: string;
  userId: string;
  customer: CustomerData;
  primaryContact: StakeholderData;
  csm: CSMData;
  onboarding: OnboardingData;
  productName?: string;
  entitlements?: Array<{ name: string; description?: string }>;
  customVariables?: Record<string, any>;
}

export interface GeneratedSequence {
  id: string;
  customerId: string;
  name: string;
  sequenceType: string;
  status: 'draft' | 'scheduled';
  startDate: Date;
  totalEmails: number;
  items: GeneratedSequenceItem[];
}

export interface GeneratedSequenceItem {
  id: string;
  itemOrder: number;
  dayOffset: number;
  sendTime: string;
  scheduledAt: Date;
  purpose: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  toEmail: string;
  status: 'pending';
}

/**
 * Welcome Sequence Generator
 * Creates personalized 5-email welcome sequences for onboarding customers
 */
export class WelcomeSequenceGenerator {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Generate a complete welcome sequence for a customer
   */
  async generateSequence(options: SequenceGenerationOptions): Promise<GeneratedSequence> {
    const {
      customerId,
      userId,
      customer,
      primaryContact,
      csm,
      onboarding,
      productName = 'our platform',
      entitlements = [],
    } = options;

    const sequenceId = uuidv4();
    const startDate = onboarding.startDate;

    // Generate all 5 emails
    const items: GeneratedSequenceItem[] = [];

    // Day 1 - Welcome
    const day1 = generateWelcomeDay1Email({
      customerName: customer.name,
      contactName: primaryContact.name,
      contactTitle: primaryContact.title,
      csmName: csm.name,
      csmEmail: csm.email,
      csmTitle: csm.title,
      arr: customer.arr,
      productName,
      kickoffDate: onboarding.kickoffDate
        ? this.formatDate(onboarding.kickoffDate)
        : undefined,
      calendarLink: csm.calendarLink,
    });

    items.push({
      id: uuidv4(),
      itemOrder: 1,
      dayOffset: 0,
      sendTime: '09:00',
      scheduledAt: this.calculateSendDate(startDate, 0, '09:00'),
      purpose: 'welcome',
      subject: day1.subject,
      bodyHtml: day1.bodyHtml,
      bodyText: day1.bodyText,
      toEmail: primaryContact.email,
      status: 'pending',
    });

    // Day 3 - Kickoff Prep
    const day3 = generateWelcomeDay3Email({
      customerName: customer.name,
      contactName: primaryContact.name,
      csmName: csm.name,
      csmEmail: csm.email,
      kickoffDate: onboarding.kickoffDate
        ? this.formatDate(onboarding.kickoffDate)
        : this.formatDate(this.calculateSendDate(startDate, 3, '10:00')),
      kickoffTime: onboarding.kickoffTime || '10:00 AM',
      meetingLink: onboarding.meetingLink,
      attendees: onboarding.attendees,
    });

    items.push({
      id: uuidv4(),
      itemOrder: 2,
      dayOffset: 2,
      sendTime: '08:00',
      scheduledAt: this.calculateSendDate(startDate, 2, '08:00'),
      purpose: 'kickoff_prep',
      subject: day3.subject,
      bodyHtml: day3.bodyHtml,
      bodyText: day3.bodyText,
      toEmail: primaryContact.email,
      status: 'pending',
    });

    // Day 7 - Resources
    const day7 = generateWelcomeDay7Email({
      customerName: customer.name,
      contactName: primaryContact.name,
      csmName: csm.name,
      csmEmail: csm.email,
      productName,
      entitlements,
    });

    items.push({
      id: uuidv4(),
      itemOrder: 3,
      dayOffset: 6,
      sendTime: '10:00',
      scheduledAt: this.calculateSendDate(startDate, 6, '10:00'),
      purpose: 'resources',
      subject: day7.subject,
      bodyHtml: day7.bodyHtml,
      bodyText: day7.bodyText,
      toEmail: primaryContact.email,
      status: 'pending',
    });

    // Day 14 - Check-in
    const day14 = generateWelcomeDay14Email({
      customerName: customer.name,
      contactName: primaryContact.name,
      csmName: csm.name,
      csmEmail: csm.email,
      productName,
    });

    items.push({
      id: uuidv4(),
      itemOrder: 4,
      dayOffset: 13,
      sendTime: '10:00',
      scheduledAt: this.calculateSendDate(startDate, 13, '10:00'),
      purpose: 'check_in',
      subject: day14.subject,
      bodyHtml: day14.bodyHtml,
      bodyText: day14.bodyText,
      toEmail: primaryContact.email,
      status: 'pending',
    });

    // Day 30 - Milestone
    const day30 = generateWelcomeDay30Email({
      customerName: customer.name,
      contactName: primaryContact.name,
      csmName: csm.name,
      csmEmail: csm.email,
      productName,
    });

    items.push({
      id: uuidv4(),
      itemOrder: 5,
      dayOffset: 29,
      sendTime: '10:00',
      scheduledAt: this.calculateSendDate(startDate, 29, '10:00'),
      purpose: 'milestone',
      subject: day30.subject,
      bodyHtml: day30.bodyHtml,
      bodyText: day30.bodyText,
      toEmail: primaryContact.email,
      status: 'pending',
    });

    const sequence: GeneratedSequence = {
      id: sequenceId,
      customerId,
      name: `${customer.name} Welcome Sequence`,
      sequenceType: 'welcome',
      status: 'draft',
      startDate,
      totalEmails: items.length,
      items,
    };

    return sequence;
  }

  /**
   * Save a generated sequence to the database
   */
  async saveSequence(
    userId: string,
    sequence: GeneratedSequence
  ): Promise<{ success: boolean; sequenceId?: string; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      // Insert sequence
      const { data: sequenceData, error: sequenceError } = await this.supabase
        .from('email_sequences')
        .insert({
          id: sequence.id,
          customer_id: sequence.customerId,
          user_id: userId,
          name: sequence.name,
          sequence_type: sequence.sequenceType,
          status: sequence.status,
          start_date: sequence.startDate.toISOString(),
          total_emails: sequence.totalEmails,
          emails_sent: 0,
        })
        .select()
        .single();

      if (sequenceError) {
        console.error('Error saving sequence:', sequenceError);
        return { success: false, error: sequenceError.message };
      }

      // Insert sequence items
      const itemsToInsert = sequence.items.map(item => ({
        id: item.id,
        sequence_id: sequence.id,
        item_order: item.itemOrder,
        day_offset: item.dayOffset,
        send_time: item.sendTime,
        subject: item.subject,
        body_html: item.bodyHtml,
        body_text: item.bodyText,
        purpose: item.purpose,
        to_email: item.toEmail,
        status: item.status,
        scheduled_at: item.scheduledAt.toISOString(),
      }));

      const { error: itemsError } = await this.supabase
        .from('email_sequence_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Error saving sequence items:', itemsError);
        // Rollback sequence
        await this.supabase.from('email_sequences').delete().eq('id', sequence.id);
        return { success: false, error: itemsError.message };
      }

      return { success: true, sequenceId: sequence.id };
    } catch (error) {
      console.error('Error saving sequence:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Activate a sequence (change status from draft to scheduled)
   */
  async activateSequence(
    sequenceId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      const { error } = await this.supabase
        .from('email_sequences')
        .update({ status: 'scheduled', updated_at: new Date().toISOString() })
        .eq('id', sequenceId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Also update items to scheduled
      await this.supabase
        .from('email_sequence_items')
        .update({ status: 'scheduled', updated_at: new Date().toISOString() })
        .eq('sequence_id', sequenceId)
        .eq('status', 'pending');

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get a sequence by ID with all items
   */
  async getSequence(sequenceId: string): Promise<{
    sequence: any;
    items: any[];
  } | null> {
    if (!this.supabase) return null;

    const { data: sequence, error: seqError } = await this.supabase
      .from('email_sequences')
      .select('*')
      .eq('id', sequenceId)
      .single();

    if (seqError || !sequence) return null;

    const { data: items } = await this.supabase
      .from('email_sequence_items')
      .select('*')
      .eq('sequence_id', sequenceId)
      .order('item_order', { ascending: true });

    return { sequence, items: items || [] };
  }

  /**
   * Get all sequences for a customer
   */
  async getCustomerSequences(customerId: string): Promise<any[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('email_sequences')
      .select(`
        *,
        email_sequence_items (
          id, item_order, day_offset, subject, purpose, status, scheduled_at, sent_at
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customer sequences:', error);
      return [];
    }

    return data || [];
  }

  // Helper methods
  private calculateSendDate(startDate: Date, dayOffset: number, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const sendDate = new Date(startDate);
    sendDate.setDate(sendDate.getDate() + dayOffset);
    sendDate.setHours(hours, minutes, 0, 0);
    return sendDate;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

// Singleton instance
export const welcomeSequenceGenerator = new WelcomeSequenceGenerator();
