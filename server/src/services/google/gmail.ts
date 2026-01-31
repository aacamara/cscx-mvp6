/**
 * Gmail Service
 * Handles Gmail API operations: reading, drafting, and sending emails
 */

import { google, gmail_v1 } from 'googleapis';
import { googleOAuth } from './oauth.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Types
export interface EmailThread {
  id: string;

  gmailThreadId: string;
  subject: string;
  snippet: string;
  participants: string[];
  messageCount: number;
  lastMessageAt: Date;
  isUnread: boolean;
  labels: string[];
}

export interface EmailMessage {
  id: string;
  threadId: string;
  gmailMessageId: string;
  from: {
    email: string;
    name?: string;
  };
  to: string[];
  cc: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  sentAt: Date;
  isInbound: boolean;
  hasAttachments: boolean;
}

export interface DraftEmail {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  threadId?: string; // For replies
  inReplyTo?: string; // Message ID for threading
}

export interface SendEmailOptions extends DraftEmail {
  saveToDb?: boolean;
  customerId?: string;
}

export class GmailService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Get Gmail API client for a user
   */
  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * List email threads
   */
  async listThreads(
    userId: string,
    options: {
      maxResults?: number;
      query?: string;
      labelIds?: string[];
      pageToken?: string;
    } = {}
  ): Promise<{ threads: EmailThread[]; nextPageToken?: string }> {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.threads.list({
      userId: 'me',
      maxResults: options.maxResults || 20,
      q: options.query,
      labelIds: options.labelIds,
      pageToken: options.pageToken,
    });

    const threads: EmailThread[] = [];

    if (response.data.threads) {
      for (const thread of response.data.threads) {
        if (thread.id) {
          // Get thread details
          const threadDetail = await gmail.users.threads.get({
            userId: 'me',
            id: thread.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          });

          const messages = threadDetail.data.messages || [];
          const firstMessage = messages[0];
          const lastMessage = messages[messages.length - 1];

          // Extract headers
          const getHeader = (msg: gmail_v1.Schema$Message, name: string): string => {
            const header = msg.payload?.headers?.find(
              h => h.name?.toLowerCase() === name.toLowerCase()
            );
            return header?.value || '';
          };

          // Get participants
          const participants = new Set<string>();
          for (const msg of messages) {
            const from = getHeader(msg, 'From');
            const to = getHeader(msg, 'To');
            if (from) participants.add(this.extractEmail(from));
            if (to) {
              to.split(',').forEach(email => participants.add(this.extractEmail(email.trim())));
            }
          }

          threads.push({
            id: thread.id,
            gmailThreadId: thread.id,
            subject: getHeader(firstMessage, 'Subject') || '(No Subject)',
            snippet: thread.snippet || '',
            participants: Array.from(participants),
            messageCount: messages.length,
            lastMessageAt: new Date(parseInt(lastMessage.internalDate || '0')),
            isUnread: lastMessage.labelIds?.includes('UNREAD') || false,
            labels: lastMessage.labelIds || [],
          });
        }
      }
    }

    return {
      threads,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  /**
   * Get a single thread with all messages
   */
  async getThread(userId: string, threadId: string): Promise<{
    thread: EmailThread;
    messages: EmailMessage[];
  }> {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });

    const messages: EmailMessage[] = [];
    const gmailMessages = response.data.messages || [];

    // Get user's email for inbound detection
    const tokens = await googleOAuth.getTokens(userId);
    const userEmail = tokens?.google_email || '';

    for (const msg of gmailMessages) {
      if (!msg.id) continue;

      const getHeader = (name: string): string => {
        const header = msg.payload?.headers?.find(
          h => h.name?.toLowerCase() === name.toLowerCase()
        );
        return header?.value || '';
      };

      // Extract body
      let bodyText = '';
      let bodyHtml = '';

      const extractBody = (part: gmail_v1.Schema$MessagePart) => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.parts) {
          part.parts.forEach(extractBody);
        }
      };

      if (msg.payload) {
        extractBody(msg.payload);
      }

      const fromEmail = this.extractEmail(getHeader('From'));
      const isInbound = fromEmail.toLowerCase() !== userEmail.toLowerCase();

      messages.push({
        id: msg.id,
        threadId: threadId,
        gmailMessageId: msg.id,
        from: {
          email: fromEmail,
          name: this.extractName(getHeader('From')),
        },
        to: getHeader('To').split(',').map(e => this.extractEmail(e.trim())).filter(Boolean),
        cc: getHeader('Cc').split(',').map(e => this.extractEmail(e.trim())).filter(Boolean),
        subject: getHeader('Subject') || '(No Subject)',
        bodyText,
        bodyHtml,
        sentAt: new Date(parseInt(msg.internalDate || '0')),
        isInbound,
        hasAttachments: (msg.payload?.parts?.some(p => p.filename && p.filename.length > 0)) || false,
      });
    }

    const firstMessage = gmailMessages[0];
    const lastMessage = gmailMessages[gmailMessages.length - 1];

    const getHeader = (msg: gmail_v1.Schema$Message, name: string): string => {
      const header = msg.payload?.headers?.find(
        h => h.name?.toLowerCase() === name.toLowerCase()
      );
      return header?.value || '';
    };

    const participants = new Set<string>();
    for (const msg of messages) {
      participants.add(msg.from.email);
      msg.to.forEach(e => participants.add(e));
    }

    const thread: EmailThread = {
      id: threadId,
      gmailThreadId: threadId,
      subject: getHeader(firstMessage, 'Subject') || '(No Subject)',
      snippet: response.data.snippet || '',
      participants: Array.from(participants),
      messageCount: messages.length,
      lastMessageAt: new Date(parseInt(lastMessage.internalDate || '0')),
      isUnread: lastMessage.labelIds?.includes('UNREAD') || false,
      labels: lastMessage.labelIds || [],
    };

    return { thread, messages };
  }

  /**
   * Create a draft email
   */
  async createDraft(userId: string, draft: DraftEmail): Promise<string> {
    const gmail = await this.getGmailClient(userId);

    const message = this.buildMimeMessage(draft);

    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: Buffer.from(message).toString('base64url'),
          threadId: draft.threadId,
        },
      },
    });

    return response.data.id || '';
  }

  /**
   * Send an email
   */
  async sendEmail(userId: string, email: SendEmailOptions): Promise<string> {
    const gmail = await this.getGmailClient(userId);

    const message = this.buildMimeMessage(email);

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: Buffer.from(message).toString('base64url'),
        threadId: email.threadId,
      },
    });

    // Save to database if requested
    if (email.saveToDb && this.supabase && response.data.id) {
      const tokens = await googleOAuth.getTokens(userId);

      // Type assertion needed until Supabase types are regenerated
      await (this.supabase as any).from('gmail_messages').insert({
        user_id: userId,
        gmail_message_id: response.data.id,
        thread_id: email.threadId,
        from_email: tokens?.google_email,
        to_emails: email.to,
        cc_emails: email.cc || [],
        subject: email.subject,
        body_text: email.bodyText || this.stripHtml(email.bodyHtml),
        body_html: email.bodyHtml,
        sent_at: new Date().toISOString(),
        is_inbound: false,
      });
    }

    return response.data.id || '';
  }

  /**
   * Get draft by ID
   */
  async getDraft(userId: string, draftId: string): Promise<{
    id: string;
    to: string[];
    cc: string[];
    subject: string;
    bodyHtml: string;
    bodyText: string;
  }> {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.drafts.get({
      userId: 'me',
      id: draftId,
      format: 'full',
    });

    const msg = response.data.message;
    if (!msg?.payload) {
      throw new Error('Draft not found');
    }

    const getHeader = (name: string): string => {
      const header = msg.payload?.headers?.find(
        h => h.name?.toLowerCase() === name.toLowerCase()
      );
      return header?.value || '';
    };

    let bodyText = '';
    let bodyHtml = '';

    const extractBody = (part: gmail_v1.Schema$MessagePart) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };

    extractBody(msg.payload);

    return {
      id: draftId,
      to: getHeader('To').split(',').map(e => this.extractEmail(e.trim())).filter(Boolean),
      cc: getHeader('Cc').split(',').map(e => this.extractEmail(e.trim())).filter(Boolean),
      subject: getHeader('Subject') || '',
      bodyHtml,
      bodyText,
    };
  }

  /**
   * Update a draft
   */
  async updateDraft(userId: string, draftId: string, draft: DraftEmail): Promise<void> {
    const gmail = await this.getGmailClient(userId);

    const message = this.buildMimeMessage(draft);

    await gmail.users.drafts.update({
      userId: 'me',
      id: draftId,
      requestBody: {
        message: {
          raw: Buffer.from(message).toString('base64url'),
          threadId: draft.threadId,
        },
      },
    });
  }

  /**
   * Delete a draft
   */
  async deleteDraft(userId: string, draftId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);

    await gmail.users.drafts.delete({
      userId: 'me',
      id: draftId,
    });
  }

  /**
   * Search emails with query
   */
  async searchEmails(
    userId: string,
    query: string,
    maxResults: number = 20
  ): Promise<EmailThread[]> {
    const { threads } = await this.listThreads(userId, {
      query,
      maxResults,
    });
    return threads;
  }

  /**
   * Get emails from a specific sender
   */
  async getEmailsFromSender(userId: string, senderEmail: string): Promise<EmailThread[]> {
    return this.searchEmails(userId, `from:${senderEmail}`);
  }

  /**
   * Get unread emails
   */
  async getUnreadEmails(userId: string, maxResults: number = 20): Promise<EmailThread[]> {
    return this.searchEmails(userId, 'is:unread', maxResults);
  }

  /**
   * Mark thread as read
   */
  async markAsRead(userId: string, threadId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);

    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }

  /**
   * Mark thread as unread
   */
  async markAsUnread(userId: string, threadId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);

    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: {
        addLabelIds: ['UNREAD'],
      },
    });
  }

  /**
   * Archive a thread
   */
  async archiveThread(userId: string, threadId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);

    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: {
        removeLabelIds: ['INBOX'],
      },
    });
  }

  /**
   * Trash a thread
   */
  async trashThread(userId: string, threadId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);

    await gmail.users.threads.trash({
      userId: 'me',
      id: threadId,
    });
  }

  /**
   * Star a thread
   */
  async starThread(userId: string, threadId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);

    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: {
        addLabelIds: ['STARRED'],
      },
    });
  }

  /**
   * Unstar a thread
   */
  async unstarThread(userId: string, threadId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);

    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: {
        removeLabelIds: ['STARRED'],
      },
    });
  }

  /**
   * Send a draft
   */
  async sendDraft(userId: string, draftId: string): Promise<string> {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.drafts.send({
      userId: 'me',
      requestBody: {
        id: draftId,
      },
    });

    return response.data.id || '';
  }

  /**
   * Apply label to thread
   */
  async addLabel(userId: string, threadId: string, labelId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);

    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
  }

  /**
   * Get all labels
   */
  async getLabels(userId: string): Promise<{ id: string; name: string }[]> {
    const gmail = await this.getGmailClient(userId);

    const response = await gmail.users.labels.list({
      userId: 'me',
    });

    return (response.data.labels || []).map(label => ({
      id: label.id || '',
      name: label.name || '',
    }));
  }

  // ==================== Helper Methods ====================

  /**
   * Build MIME message from draft
   */
  private buildMimeMessage(draft: DraftEmail): string {
    const boundary = `boundary_${Date.now()}`;

    const headers = [
      `To: ${draft.to.join(', ')}`,
      draft.cc?.length ? `Cc: ${draft.cc.join(', ')}` : null,
      draft.bcc?.length ? `Bcc: ${draft.bcc.join(', ')}` : null,
      `Subject: ${draft.subject}`,
      draft.inReplyTo ? `In-Reply-To: ${draft.inReplyTo}` : null,
      draft.inReplyTo ? `References: ${draft.inReplyTo}` : null,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ].filter(Boolean).join('\r\n');

    const textPart = draft.bodyText || this.stripHtml(draft.bodyHtml);

    const body = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      textPart,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      '',
      draft.bodyHtml,
      `--${boundary}--`,
    ].join('\r\n');

    return `${headers}\r\n\r\n${body}`;
  }

  /**
   * Extract email address from "Name <email>" format
   */
  private extractEmail(str: string): string {
    const match = str.match(/<([^>]+)>/);
    return match ? match[1] : str.trim();
  }

  /**
   * Extract name from "Name <email>" format
   */
  private extractName(str: string): string | undefined {
    const match = str.match(/^([^<]+)</);
    return match ? match[1].trim().replace(/"/g, '') : undefined;
  }

  /**
   * Strip HTML tags from string
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Sync threads to database
   */
  async syncThreadsToDb(
    userId: string,
    customerId?: string,
    options: { maxResults?: number; query?: string } = {}
  ): Promise<number> {
    if (!this.supabase) return 0;

    const { threads } = await this.listThreads(userId, options);
    let synced = 0;

    for (const thread of threads) {
      // Type assertion needed until Supabase types are regenerated
      const { error } = await (this.supabase as any)
        .from('gmail_threads')
        .upsert({
          user_id: userId,
          customer_id: customerId,
          gmail_thread_id: thread.gmailThreadId,
          subject: thread.subject,
          snippet: thread.snippet,
          participants: thread.participants,
          labels: thread.labels,
          message_count: thread.messageCount,
          last_message_at: thread.lastMessageAt.toISOString(),
          is_unread: thread.isUnread,
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,gmail_thread_id',
        });

      if (!error) synced++;
    }

    return synced;
  }

  // ==================== QBR Email Helpers (PRD-026) ====================

  /**
   * Generate QBR email data for a customer
   * @param customerId - Customer ID to generate QBR email for
   * @param type - Type of QBR email ('invite' or 'followup')
   * @param options - Additional options for email generation
   */
  async generateQBREmailData(
    customerId: string,
    type: 'invite' | 'followup',
    options: {
      quarter?: string;
      year?: number;
      proposedDates?: Array<{ date: string; time: string }>;
      scheduledDate?: string;
      meetingDate?: string;
      highlights?: string[];
      actionItems?: Array<{ task: string; owner: string; dueDate?: string }>;
      customMessage?: string;
      documentUrl?: string;
      presentationUrl?: string;
    } = {}
  ): Promise<{
    customer: {
      id: string;
      name: string;
      arr: number;
      healthScore: number;
      healthTrend: 'improving' | 'stable' | 'declining';
    };
    stakeholders: Array<{ name: string; email: string; title?: string }>;
    qbr: {
      quarter: string;
      year: number;
      proposedDates?: Array<{ date: string; time: string }>;
      scheduledDate?: string;
      meetingDate?: string;
      documentUrl?: string;
      presentationUrl?: string;
    };
  }> {
    if (!this.supabase) {
      throw new Error('Database connection required for QBR email generation');
    }

    // Fetch customer data
    const { data: customer, error: customerError } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    // Fetch stakeholders
    const { data: stakeholders } = await this.supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId);

    // Determine health trend from recent metrics
    let healthTrend: 'improving' | 'stable' | 'declining' = 'stable';
    const { data: recentMetrics } = await this.supabase
      .from('usage_metrics')
      .select('health_score')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(5);

    if (recentMetrics && recentMetrics.length >= 2) {
      const scores = recentMetrics.map((m: any) => m.health_score || 0).filter((s: number) => s > 0);
      if (scores.length >= 2) {
        const recent = scores.slice(0, 2).reduce((a: number, b: number) => a + b, 0) / 2;
        const older = scores.slice(-2).reduce((a: number, b: number) => a + b, 0) / 2;
        if (recent > older + 5) healthTrend = 'improving';
        else if (recent < older - 5) healthTrend = 'declining';
      }
    }

    // Determine current quarter if not provided
    const now = new Date();
    const currentQuarter = options.quarter || `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
    const currentYear = options.year || now.getFullYear();

    // Format stakeholders for email
    const formattedStakeholders = (stakeholders || [])
      .filter((s: any) => s.email)
      .map((s: any) => ({
        name: s.name || 'Stakeholder',
        email: s.email,
        title: s.role || s.title,
      }));

    // If no stakeholders, try to use primary contact from customer
    if (formattedStakeholders.length === 0 && customer.primary_contact_email) {
      formattedStakeholders.push({
        name: customer.primary_contact_name || 'Primary Contact',
        email: customer.primary_contact_email,
        title: customer.primary_contact_title,
      });
    }

    return {
      customer: {
        id: customerId,
        name: customer.name,
        arr: customer.arr || 0,
        healthScore: customer.health_score || 70,
        healthTrend,
      },
      stakeholders: formattedStakeholders,
      qbr: {
        quarter: currentQuarter,
        year: currentYear,
        proposedDates: options.proposedDates,
        scheduledDate: options.scheduledDate,
        meetingDate: options.meetingDate,
        documentUrl: options.documentUrl,
        presentationUrl: options.presentationUrl,
      },
    };
  }

// ==================== PRD-190: Gmail Integration ====================

  /**
   * Get email threads for a specific customer
   * Matches threads by domain and stakeholder emails
   */
  async getCustomerThreads(
    userId: string,
    customerId: string,
    options: {
      maxResults?: number;
      includeArchived?: boolean;
      sinceDays?: number;
    } = {}
  ): Promise<EmailThread[]> {
    if (!this.supabase) {
      throw new Error('Database connection required');
    }

    // Get customer data
    const { data: customer, error: customerError } = await this.supabase
      .from('customers')
      .select('name, domain')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    // Get stakeholder emails
    const { data: stakeholders } = await this.supabase
      .from('stakeholders')
      .select('email')
      .eq('customer_id', customerId);

    const stakeholderEmails = (stakeholders || [])
      .map((s: any) => s.email)
      .filter(Boolean);

    // Build Gmail query
    const queryParts: string[] = [];

    // Match by domain
    if (customer.domain) {
      queryParts.push(`from:*@${customer.domain}`);
      queryParts.push(`to:*@${customer.domain}`);
    }

    // Match by stakeholder emails
    for (const email of stakeholderEmails.slice(0, 5)) { // Limit to prevent query length issues
      queryParts.push(`from:${email}`);
      queryParts.push(`to:${email}`);
    }

    // Add date filter
    if (options.sinceDays) {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - options.sinceDays);
      const dateStr = sinceDate.toISOString().split('T')[0].replace(/-/g, '/');
      queryParts.push(`after:${dateStr}`);
    }

    const query = `{${queryParts.join(' ')}}`;

    const { threads } = await this.listThreads(userId, {
      query,
      maxResults: options.maxResults || 50,
    });

    return threads;
  }

  /**
   * Sync customer emails to database and calculate metrics
   */
  async syncCustomerEmails(
    userId: string,
    customerId: string,
    options: {
      maxResults?: number;
      sinceDays?: number;
    } = {}
  ): Promise<{
    threadsSynced: number;
    metricsUpdated: boolean;
    newThreadIds: string[];
  }> {
    if (!this.supabase) {
      throw new Error('Database connection required');
    }

    const threads = await this.getCustomerThreads(userId, customerId, options);
    const newThreadIds: string[] = [];
    let synced = 0;

    for (const thread of threads) {
      const { data: existing } = await (this.supabase as any)
        .from('email_thread_mapping')
        .select('id')
        .eq('user_id', userId)
        .eq('gmail_thread_id', thread.gmailThreadId)
        .single();

      if (!existing) {
        newThreadIds.push(thread.gmailThreadId);
      }

      const { error } = await (this.supabase as any)
        .from('email_thread_mapping')
        .upsert({
          user_id: userId,
          customer_id: customerId,
          gmail_thread_id: thread.gmailThreadId,
          subject: thread.subject,
          snippet: thread.snippet,
          participants: thread.participants,
          message_count: thread.messageCount,
          last_message_at: thread.lastMessageAt.toISOString(),
          is_unread: thread.isUnread,
          labels: thread.labels,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,gmail_thread_id',
        });

      if (!error) synced++;
    }

    // Calculate and update metrics
    const metricsUpdated = await this.updateCustomerEmailMetrics(userId, customerId, threads);

    return {
      threadsSynced: synced,
      metricsUpdated,
      newThreadIds,
    };
  }

  /**
   * Calculate and update email metrics for a customer
   */
  private async updateCustomerEmailMetrics(
    userId: string,
    customerId: string,
    threads: EmailThread[]
  ): Promise<boolean> {
    if (!this.supabase) return false;

    // Get user email for inbound/outbound detection
    const tokens = await googleOAuth.getTokens(userId);
    const userEmail = tokens?.google_email?.toLowerCase() || '';

    let emailsSent = 0;
    let emailsReceived = 0;
    let lastOutbound: Date | null = null;
    let lastInbound: Date | null = null;
    const uniqueRecipients = new Set<string>();
    let totalResponseHours = 0;
    let responseCount = 0;

    for (const thread of threads) {
      // Get full thread details to analyze messages
      try {
        const { messages } = await this.getThread(userId, thread.gmailThreadId);

        for (const msg of messages) {
          if (msg.isInbound) {
            emailsReceived++;
            if (!lastInbound || msg.sentAt > lastInbound) {
              lastInbound = msg.sentAt;
            }
          } else {
            emailsSent++;
            if (!lastOutbound || msg.sentAt > lastOutbound) {
              lastOutbound = msg.sentAt;
            }
            msg.to.forEach(email => uniqueRecipients.add(email.toLowerCase()));
          }
        }

        // Calculate response times within thread
        for (let i = 1; i < messages.length; i++) {
          if (messages[i].isInbound !== messages[i - 1].isInbound) {
            const hours = (messages[i].sentAt.getTime() - messages[i - 1].sentAt.getTime()) / (1000 * 60 * 60);
            if (hours < 168) { // Only count responses within a week
              totalResponseHours += hours;
              responseCount++;
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to get thread details: ${thread.gmailThreadId}`);
      }
    }

    const avgResponseHours = responseCount > 0 ? totalResponseHours / responseCount : null;
    const avgThreadDepth = threads.length > 0
      ? threads.reduce((sum, t) => sum + t.messageCount, 0) / threads.length
      : null;

    const today = new Date().toISOString().split('T')[0];

    const { error } = await (this.supabase as any)
      .from('email_metrics')
      .upsert({
        customer_id: customerId,
        user_id: userId,
        metric_date: today,
        emails_sent: emailsSent,
        emails_received: emailsReceived,
        avg_response_hours: avgResponseHours,
        total_threads: threads.length,
        avg_thread_depth: avgThreadDepth,
        last_outbound_at: lastOutbound?.toISOString() || null,
        last_inbound_at: lastInbound?.toISOString() || null,
        unique_recipients: uniqueRecipients.size,
      }, {
        onConflict: 'customer_id,user_id,metric_date',
      });

    return !error;
  }

  /**
   * Get email metrics for a customer
   */
  async getCustomerEmailMetrics(
    userId: string,
    customerId: string,
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<{
    emailsSent: number;
    emailsReceived: number;
    avgResponseHours: number | null;
    totalThreads: number;
    avgThreadDepth: number | null;
    lastOutboundAt: Date | null;
    lastInboundAt: Date | null;
    engagementScore: number;
    trend: Array<{ date: string; sent: number; received: number }>;
  }> {
    if (!this.supabase) {
      throw new Error('Database connection required');
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const { data: metrics, error } = await (this.supabase as any)
      .from('email_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .eq('user_id', userId)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: true });

    if (error || !metrics || metrics.length === 0) {
      return {
        emailsSent: 0,
        emailsReceived: 0,
        avgResponseHours: null,
        totalThreads: 0,
        avgThreadDepth: null,
        lastOutboundAt: null,
        lastInboundAt: null,
        engagementScore: 0,
        trend: [],
      };
    }

    // Aggregate metrics
    const totals = metrics.reduce(
      (acc: any, m: any) => ({
        sent: acc.sent + (m.emails_sent || 0),
        received: acc.received + (m.emails_received || 0),
        threads: acc.threads + (m.total_threads || 0),
        responseSum: acc.responseSum + (m.avg_response_hours || 0),
        responseCount: acc.responseCount + (m.avg_response_hours ? 1 : 0),
        depthSum: acc.depthSum + (m.avg_thread_depth || 0),
        depthCount: acc.depthCount + (m.avg_thread_depth ? 1 : 0),
      }),
      { sent: 0, received: 0, threads: 0, responseSum: 0, responseCount: 0, depthSum: 0, depthCount: 0 }
    );

    const lastMetric = metrics[metrics.length - 1];

    // Calculate engagement score
    let engagementScore = 0;
    const totalEmails = totals.sent + totals.received;
    if (totalEmails > 0) {
      engagementScore = Math.min(100, totalEmails * 5);
    }
    if (totals.responseSum > 0 && totals.responseCount > 0) {
      const avgResponse = totals.responseSum / totals.responseCount;
      if (avgResponse <= 24) engagementScore = Math.min(100, engagementScore + 20);
      else if (avgResponse <= 48) engagementScore = Math.min(100, engagementScore + 10);
    }

    return {
      emailsSent: totals.sent,
      emailsReceived: totals.received,
      avgResponseHours: totals.responseCount > 0 ? totals.responseSum / totals.responseCount : null,
      totalThreads: totals.threads,
      avgThreadDepth: totals.depthCount > 0 ? totals.depthSum / totals.depthCount : null,
      lastOutboundAt: lastMetric.last_outbound_at ? new Date(lastMetric.last_outbound_at) : null,
      lastInboundAt: lastMetric.last_inbound_at ? new Date(lastMetric.last_inbound_at) : null,
      engagementScore,
      trend: metrics.map((m: any) => ({
        date: m.metric_date,
        sent: m.emails_sent || 0,
        received: m.emails_received || 0,
      })),
    };
  }

  /**
   * Match an email thread to a customer based on participants
   */
  async matchThreadToCustomer(
    userId: string,
    participants: string[]
  ): Promise<{
    customerId: string;
    customerName: string;
    matchType: 'domain' | 'stakeholder' | 'thread_participant';
    confidence: number;
  } | null> {
    if (!this.supabase) return null;

    const emails = participants.map(p => p.toLowerCase());
    const domains = [...new Set(emails.map(e => e.split('@')[1]).filter(Boolean))];

    // Try to match by stakeholder email first (highest confidence)
    for (const email of emails) {
      const { data: stakeholder } = await (this.supabase as any)
        .from('stakeholders')
        .select('customer_id, customers(id, name)')
        .eq('email', email)
        .single();

      if (stakeholder?.customer_id) {
        return {
          customerId: stakeholder.customer_id,
          customerName: stakeholder.customers?.name || 'Unknown',
          matchType: 'stakeholder',
          confidence: 0.95,
        };
      }
    }

    // Try to match by domain
    for (const domain of domains) {
      // Skip common email providers
      if (['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
        continue;
      }

      const { data: customer } = await (this.supabase as any)
        .from('customers')
        .select('id, name')
        .eq('domain', domain)
        .single();

      if (customer?.id) {
        return {
          customerId: customer.id,
          customerName: customer.name,
          matchType: 'domain',
          confidence: 0.85,
        };
      }
    }

    // Try to match by existing thread mappings
    for (const email of emails) {
      const { data: mapping } = await (this.supabase as any)
        .from('email_thread_mapping')
        .select('customer_id, customers(id, name)')
        .eq('user_id', userId)
        .contains('participants', [email])
        .not('customer_id', 'is', null)
        .limit(1)
        .single();

      if (mapping?.customer_id) {
        return {
          customerId: mapping.customer_id,
          customerName: mapping.customers?.name || 'Unknown',
          matchType: 'thread_participant',
          confidence: 0.7,
        };
      }
    }

    return null;
  }

  /**
   * Get email templates
   */
  async getTemplates(
    category?: string
  ): Promise<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    variables: string[];
    usageCount: number;
  }>> {
    if (!this.supabase) {
      throw new Error('Database connection required');
    }

    let query = (this.supabase as any)
      .from('email_templates')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get templates: ${error.message}`);
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description || '',
      category: t.category,
      subject: t.subject,
      bodyHtml: t.body_html,
      bodyText: t.body_text || '',
      variables: t.variables || [],
      usageCount: t.usage_count || 0,
    }));
  }

  /**
   * Get a template by ID
   */
  async getTemplate(templateId: string): Promise<{
    id: string;
    name: string;
    description: string;
    category: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    variables: string[];
  } | null> {
    if (!this.supabase) return null;

    const { data, error } = await (this.supabase as any)
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      category: data.category,
      subject: data.subject,
      bodyHtml: data.body_html,
      bodyText: data.body_text || '',
      variables: data.variables || [],
    };
  }

  /**
   * Apply variable substitution to a template
   */
  applyTemplateVariables(
    template: { subject: string; bodyHtml: string; bodyText?: string },
    variables: Record<string, string | number | string[]>
  ): { subject: string; bodyHtml: string; bodyText: string } {
    let subject = template.subject;
    let bodyHtml = template.bodyHtml;
    let bodyText = template.bodyText || this.stripHtml(template.bodyHtml);

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const replacement = Array.isArray(value)
        ? value.map(v => `<li>${v}</li>`).join('\n')
        : String(value);
      const textReplacement = Array.isArray(value)
        ? value.map(v => `- ${v}`).join('\n')
        : String(value);

      subject = subject.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), textReplacement);
      bodyHtml = bodyHtml.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
      bodyText = bodyText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), textReplacement);
    }

    return { subject, bodyHtml, bodyText };
  }

  /**
   * Record template usage for analytics
   */
  async recordTemplateUsage(templateId: string): Promise<void> {
    if (!this.supabase) return;

    await (this.supabase as any)
      .from('email_templates')
      .update({ usage_count: this.supabase.raw('usage_count + 1') })
      .eq('id', templateId);
  }

  /**
   * Log email send for audit trail
   */
  async logEmailSend(
    userId: string,
    options: {
      customerId?: string;
      gmailMessageId?: string;
      gmailThreadId?: string;
      recipients: { to: string[]; cc?: string[]; bcc?: string[] };
      subject: string;
      templateId?: string;
      wasAiAssisted?: boolean;
      approvalId?: string;
    }
  ): Promise<void> {
    if (!this.supabase) return;

    await (this.supabase as any)
      .from('email_send_log')
      .insert({
        user_id: userId,
        customer_id: options.customerId || null,
        gmail_message_id: options.gmailMessageId || null,
        gmail_thread_id: options.gmailThreadId || null,
        recipients: options.recipients,
        subject: options.subject,
        template_id: options.templateId || null,
        was_ai_assisted: options.wasAiAssisted || false,
        approval_id: options.approvalId || null,
        sent_at: new Date().toISOString(),
      });
  }

  /**
   * Get email send history for a customer
   */
  async getEmailSendHistory(
    userId: string,
    customerId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Array<{
    id: string;
    subject: string;
    recipients: { to: string[]; cc?: string[]; bcc?: string[] };
    sentAt: Date;
    wasAiAssisted: boolean;
    templateName?: string;
  }>> {
    if (!this.supabase) return [];

    const { data, error } = await (this.supabase as any)
      .from('email_send_log')
      .select(`
        id,
        subject,
        recipients,
        sent_at,
        was_ai_assisted,
        email_templates(name)
      `)
      .eq('user_id', userId)
      .eq('customer_id', customerId)
      .order('sent_at', { ascending: false })
      .range(options.offset || 0, (options.offset || 0) + (options.limit || 20) - 1);

    if (error) return [];

    return (data || []).map((d: any) => ({
      id: d.id,
      subject: d.subject,
      recipients: d.recipients,
      sentAt: new Date(d.sent_at),
      wasAiAssisted: d.was_ai_assisted,
      templateName: d.email_templates?.name,
    }));
  }

  /**
   * Send email with HITL approval requirement
   */
  async sendEmailWithApproval(
    userId: string,
    email: SendEmailOptions & { customerId?: string; templateId?: string }
  ): Promise<{
    success: boolean;
    messageId?: string;
    requiresApproval: boolean;
    approvalId?: string;
    error?: string;
  }> {
    // For now, send directly (HITL can be added via approval service)
    try {
      const messageId = await this.sendEmail(userId, email);

      // Log the send
      await this.logEmailSend(userId, {
        customerId: email.customerId,
        gmailMessageId: messageId,
        gmailThreadId: email.threadId,
        recipients: {
          to: email.to,
          cc: email.cc,
          bcc: email.bcc,
        },
        subject: email.subject,
        templateId: email.templateId,
        wasAiAssisted: false,
      });

      // Record template usage if applicable
      if (email.templateId) {
        await this.recordTemplateUsage(email.templateId);
      }

      return {
        success: true,
        messageId,
        requiresApproval: false,
      };
    } catch (error) {
      return {
        success: false,
        requiresApproval: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  /**
   * Search customer emails
   */
  async searchCustomerEmails(
    userId: string,
    customerId: string,
    searchQuery: string,
    maxResults: number = 20
  ): Promise<EmailThread[]> {
    if (!this.supabase) {
      throw new Error('Database connection required');
    }

    // Get customer domain for scoping
    const { data: customer } = await this.supabase
      .from('customers')
      .select('domain')
      .eq('id', customerId)
      .single();

    // Build combined query
    let query = searchQuery;
    if (customer?.domain) {
      query = `(${searchQuery}) {from:*@${customer.domain} to:*@${customer.domain}}`;
    }

    return this.searchEmails(userId, query, maxResults);
  }
}

// Singleton instance
export const gmailService = new GmailService();
