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
}

// Singleton instance
export const gmailService = new GmailService();
