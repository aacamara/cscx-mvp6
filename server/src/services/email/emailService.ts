/**
 * Email Sync Service (PRD: Email Integration)
 *
 * Fetches emails from Gmail and stores them in the emails table.
 * Supports syncing recent emails and tracking sync status.
 */

import { google, gmail_v1 } from 'googleapis';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { googleOAuth } from '../google/oauth.js';

// Types
export interface SyncedEmail {
  id: string;
  userId: string;
  gmailId: string;
  threadId: string;
  subject: string;
  fromEmail: string;
  fromName?: string;
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  date: Date;
  bodyText: string;
  bodyHtml?: string;
  snippet?: string;
  labels: string[];
  isRead: boolean;
  isImportant: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors: string[];
  lastSyncAt: Date;
}

export interface SyncStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncSuccess?: boolean;
  lastSyncError?: string;
  emailsSynced: number;
}

// Initialize Supabase
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

/**
 * Email Sync Service
 */
export class EmailService {
  private supabase: SupabaseClient | null = supabase;

  /**
   * Get Gmail API client for a user
   */
  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * Fetch recent emails from Gmail and store in database
   * @param userId - User ID
   * @param days - Number of days back to fetch (default: 30)
   * @param organizationId - Organization ID for filtering
   */
  async fetchRecentEmails(userId: string, days: number = 30, organizationId: string | null = null): Promise<SyncResult> {
    const errors: string[] = [];
    let syncedCount = 0;
    const startTime = new Date();

    try {
      // Calculate date range
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - days);
      const afterQuery = `after:${Math.floor(afterDate.getTime() / 1000)}`;

      const gmail = await this.getGmailClient(userId);

      // Fetch message list
      let pageToken: string | undefined;
      const allMessages: gmail_v1.Schema$Message[] = [];

      do {
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: afterQuery,
          maxResults: 100,
          pageToken,
        });

        if (response.data.messages) {
          allMessages.push(...response.data.messages);
        }

        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken && allMessages.length < 500); // Limit to 500 emails per sync

      console.log(`[EmailService] Found ${allMessages.length} messages to sync for user ${userId}`);

      // Fetch and store each message
      for (const msgRef of allMessages) {
        if (!msgRef.id) continue;

        try {
          const email = await this.fetchAndStoreEmail(gmail, userId, msgRef.id, organizationId);
          if (email) {
            syncedCount++;
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Message ${msgRef.id}: ${errMsg}`);
        }
      }

      // Update sync status
      await this.updateSyncStatus(userId, {
        connected: true,
        lastSyncAt: startTime,
        lastSyncSuccess: errors.length === 0,
        lastSyncError: errors.length > 0 ? errors.slice(0, 5).join('; ') : undefined,
        emailsSynced: syncedCount,
      }, organizationId);

      console.log(`[EmailService] Sync complete: ${syncedCount} emails synced, ${errors.length} errors`);

      return {
        success: errors.length === 0,
        syncedCount,
        errors,
        lastSyncAt: startTime,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[EmailService] Sync failed:`, errMsg);

      await this.updateSyncStatus(userId, {
        connected: true,
        lastSyncAt: startTime,
        lastSyncSuccess: false,
        lastSyncError: errMsg,
        emailsSynced: syncedCount,
      }, organizationId);

      return {
        success: false,
        syncedCount,
        errors: [errMsg],
        lastSyncAt: startTime,
      };
    }
  }

  /**
   * Fetch a single email and store it in the database
   */
  private async fetchAndStoreEmail(
    gmail: gmail_v1.Gmail,
    userId: string,
    messageId: string,
    organizationId: string | null = null
  ): Promise<SyncedEmail | null> {
    if (!this.supabase) return null;

    // Fetch full message
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const msg = response.data;
    if (!msg.id || !msg.threadId) return null;

    // Extract headers
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string): string => {
      const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    // Parse from address
    const fromRaw = getHeader('From');
    const fromParsed = this.parseEmailAddress(fromRaw);

    // Parse to/cc/bcc addresses
    const toEmails = this.parseEmailList(getHeader('To'));
    const ccEmails = this.parseEmailList(getHeader('Cc'));
    const bccEmails = this.parseEmailList(getHeader('Bcc'));

    // Extract body content
    const { bodyText, bodyHtml } = this.extractBody(msg.payload);

    // Check for attachments
    const hasAttachments = this.checkAttachments(msg.payload);

    // Parse labels
    const labels = msg.labelIds || [];
    const isRead = !labels.includes('UNREAD');
    const isImportant = labels.includes('IMPORTANT');
    const isStarred = labels.includes('STARRED');

    // Prepare email record
    const email: SyncedEmail = {
      id: '', // Will be set by database
      userId,
      gmailId: msg.id,
      threadId: msg.threadId,
      subject: getHeader('Subject') || '(No Subject)',
      fromEmail: fromParsed.email,
      fromName: fromParsed.name,
      toEmails,
      ccEmails,
      bccEmails,
      date: new Date(parseInt(msg.internalDate || '0')),
      bodyText,
      bodyHtml,
      snippet: msg.snippet || undefined,
      labels,
      isRead,
      isImportant,
      isStarred,
      hasAttachments,
    };

    // Store in database
    const { data, error } = await this.supabase
      .from('emails')
      .upsert({
        user_id: userId,
        gmail_id: email.gmailId,
        thread_id: email.threadId,
        subject: email.subject,
        from_email: email.fromEmail,
        from_name: email.fromName,
        to_emails: email.toEmails,
        cc_emails: email.ccEmails,
        bcc_emails: email.bccEmails,
        date: email.date.toISOString(),
        body_text: email.bodyText,
        body_html: email.bodyHtml,
        snippet: email.snippet,
        labels: email.labels,
        is_read: email.isRead,
        is_important: email.isImportant,
        is_starred: email.isStarred,
        has_attachments: email.hasAttachments,
        synced_at: new Date().toISOString(),
        ...(organizationId ? { organization_id: organizationId } : {}),
      }, {
        onConflict: 'user_id,gmail_id',
      })
      .select('id')
      .single();

    if (error) {
      console.warn(`[EmailService] Failed to store email ${email.gmailId}:`, error.message);
      return null;
    }

    email.id = data?.id || '';

    // Try to match email to a customer
    if (email.id) {
      await this.matchAndLinkEmail(
        userId,
        email.id,
        email.fromEmail,
        email.toEmails,
        email.subject,
        email.bodyText,
        organizationId
      );
    }

    return email;
  }

  /**
   * Extract body content from message payload
   */
  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): {
    bodyText: string;
    bodyHtml?: string;
  } {
    if (!payload) return { bodyText: '' };

    let bodyText = '';
    let bodyHtml: string | undefined;

    const extractPart = (part: gmail_v1.Schema$MessagePart) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        part.parts.forEach(extractPart);
      }
    };

    // Check direct body first
    if (payload.body?.data) {
      if (payload.mimeType === 'text/plain') {
        bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } else if (payload.mimeType === 'text/html') {
        bodyHtml = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        bodyText = this.htmlToText(bodyHtml);
      }
    }

    // Check parts
    if (payload.parts) {
      payload.parts.forEach(extractPart);
    }

    // If we only have HTML, convert to text
    if (!bodyText && bodyHtml) {
      bodyText = this.htmlToText(bodyHtml);
    }

    return { bodyText, bodyHtml };
  }

  /**
   * Check if message has attachments
   */
  private checkAttachments(payload: gmail_v1.Schema$MessagePart | undefined): boolean {
    if (!payload) return false;

    const checkPart = (part: gmail_v1.Schema$MessagePart): boolean => {
      if (part.filename && part.filename.length > 0) {
        return true;
      }
      if (part.parts) {
        return part.parts.some(checkPart);
      }
      return false;
    };

    return checkPart(payload);
  }

  /**
   * Parse email address from "Name <email>" format
   */
  private parseEmailAddress(str: string): { email: string; name?: string } {
    if (!str) return { email: '' };

    const match = str.match(/^(?:"?([^"<]*)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?$/);
    if (match) {
      return {
        email: match[2].trim().toLowerCase(),
        name: match[1]?.trim() || undefined,
      };
    }
    return { email: str.trim().toLowerCase() };
  }

  /**
   * Parse email list from comma-separated string
   */
  private parseEmailList(str: string): string[] {
    if (!str) return [];
    return str
      .split(',')
      .map(s => this.parseEmailAddress(s.trim()).email)
      .filter(Boolean);
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Update sync status for a user
   */
  private async updateSyncStatus(
    userId: string,
    status: Partial<SyncStatus> & { emailsSynced?: number },
    organizationId: string | null = null
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('email_sync_status')
      .upsert({
        user_id: userId,
        connected: status.connected ?? true,
        last_sync_at: status.lastSyncAt?.toISOString(),
        last_sync_success: status.lastSyncSuccess,
        last_sync_error: status.lastSyncError,
        emails_synced: status.emailsSynced,
        updated_at: new Date().toISOString(),
        ...(organizationId ? { organization_id: organizationId } : {}),
      }, {
        onConflict: 'user_id',
      });
  }

  /**
   * Get sync status for a user
   */
  async getSyncStatus(userId: string, organizationId: string | null = null): Promise<SyncStatus | null> {
    if (!this.supabase) return null;

    let query = this.supabase
      .from('email_sync_status')
      .select('*')
      .eq('user_id', userId);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.single();

    if (error || !data) return null;

    return {
      connected: data.connected,
      lastSyncAt: data.last_sync_at ? new Date(data.last_sync_at) : undefined,
      lastSyncSuccess: data.last_sync_success,
      lastSyncError: data.last_sync_error,
      emailsSynced: data.emails_synced || 0,
    };
  }

  /**
   * Get emails for a user
   */
  async getEmails(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      customerId?: string;
      query?: string;
      unreadOnly?: boolean;
      importantOnly?: boolean;
    } = {},
    organizationId: string | null = null
  ): Promise<SyncedEmail[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('emails')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }

    if (options.unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (options.importantOnly) {
      query = query.eq('is_important', true);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[EmailService] Failed to fetch emails:', error.message);
      return [];
    }

    return (data || []).map(this.mapDbToEmail);
  }

  /**
   * Map database record to SyncedEmail type
   */
  private mapDbToEmail(row: any): SyncedEmail {
    return {
      id: row.id,
      userId: row.user_id,
      gmailId: row.gmail_id,
      threadId: row.thread_id,
      subject: row.subject,
      fromEmail: row.from_email,
      fromName: row.from_name,
      toEmails: row.to_emails || [],
      ccEmails: row.cc_emails || [],
      bccEmails: row.bcc_emails || [],
      date: new Date(row.date),
      bodyText: row.body_text || '',
      bodyHtml: row.body_html,
      snippet: row.snippet,
      labels: row.labels || [],
      isRead: row.is_read,
      isImportant: row.is_important,
      isStarred: row.is_starred,
      hasAttachments: row.has_attachments,
    };
  }

  // ==================== Customer Matching (US-004) ====================

  /**
   * Match result with customer ID, match method, and confidence
   */
  private async matchEmailToCustomer(
    userId: string,
    email: { fromEmail: string; toEmails: string[]; subject: string; bodyText: string },
    organizationId: string | null = null
  ): Promise<{ customerId: string; matchedBy: string; confidence: number } | null> {
    if (!this.supabase) return null;

    // Collect all email addresses from the email
    const allEmails = [email.fromEmail, ...email.toEmails].filter(Boolean);

    // Strategy 1: Match by stakeholder email (highest confidence)
    const stakeholderMatch = await this.matchByStakeholderEmail(userId, allEmails, organizationId);
    if (stakeholderMatch) {
      return { customerId: stakeholderMatch, matchedBy: 'stakeholder', confidence: 1.0 };
    }

    // Strategy 2: Match by domain (high confidence)
    const senderDomain = this.extractDomain(email.fromEmail);
    if (senderDomain) {
      const domainMatch = await this.matchByDomain(userId, senderDomain, organizationId);
      if (domainMatch) {
        return { customerId: domainMatch, matchedBy: 'domain', confidence: 0.9 };
      }
    }

    // Strategy 3: Match by customer name mention (lower confidence)
    const mentionMatch = await this.matchByNameMention(userId, email.subject, email.bodyText, organizationId);
    if (mentionMatch) {
      return { customerId: mentionMatch.customerId, matchedBy: 'mention', confidence: mentionMatch.confidence };
    }

    return null;
  }

  /**
   * Match by stakeholder email address
   */
  private async matchByStakeholderEmail(userId: string, emails: string[], organizationId: string | null = null): Promise<string | null> {
    if (!this.supabase || emails.length === 0) return null;

    // Look up stakeholders with these email addresses
    let query = this.supabase
      .from('stakeholders')
      .select('customer_id, customers!inner(csm_id)')
      .in('email', emails.map(e => e.toLowerCase()));

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: stakeholders, error } = await query.limit(1);

    if (error || !stakeholders || stakeholders.length === 0) return null;

    // Verify the customer belongs to this user (CSM)
    const stakeholder = stakeholders[0] as any;
    if (stakeholder.customers?.csm_id === userId) {
      return stakeholder.customer_id;
    }

    return null;
  }

  /**
   * Match by sender domain against customer domain
   */
  private async matchByDomain(userId: string, senderDomain: string, organizationId: string | null = null): Promise<string | null> {
    if (!this.supabase || !senderDomain) return null;

    // Skip common email providers
    const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com'];
    if (commonProviders.includes(senderDomain.toLowerCase())) {
      return null;
    }

    // Look up customers with this domain
    let query = this.supabase
      .from('customers')
      .select('id')
      .eq('csm_id', userId)
      .eq('domain', senderDomain.toLowerCase());

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: customers, error } = await query.limit(1);

    if (error || !customers || customers.length === 0) return null;

    return customers[0].id;
  }

  /**
   * Match by customer name mention in subject/body
   */
  private async matchByNameMention(
    userId: string,
    subject: string,
    bodyText: string,
    organizationId: string | null = null
  ): Promise<{ customerId: string; confidence: number } | null> {
    if (!this.supabase) return null;

    // Get all customer names for this user
    let query = this.supabase
      .from('customers')
      .select('id, name')
      .eq('csm_id', userId);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: customers, error } = await query;

    if (error || !customers || customers.length === 0) return null;

    const searchText = `${subject} ${bodyText}`.toLowerCase();
    let bestMatch: { customerId: string; confidence: number } | null = null;

    for (const customer of customers) {
      const customerName = customer.name.toLowerCase();

      // Skip very short names (too prone to false positives)
      if (customerName.length < 3) continue;

      // Check for mention in subject (higher confidence) or body (lower confidence)
      const inSubject = subject.toLowerCase().includes(customerName);
      const inBody = bodyText.toLowerCase().includes(customerName);

      if (inSubject || inBody) {
        const confidence = inSubject ? 0.7 : 0.5;

        // Keep the best match (highest confidence)
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { customerId: customer.id, confidence };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string | null {
    if (!email) return null;
    const parts = email.toLowerCase().split('@');
    return parts.length === 2 ? parts[1] : null;
  }

  /**
   * Link unmatched emails to customers
   * Processes emails without customer_id and tries to match them
   */
  async linkEmailsToCustomers(userId: string, organizationId: string | null = null): Promise<{
    processed: number;
    matched: number;
    errors: string[];
  }> {
    if (!this.supabase) {
      return { processed: 0, matched: 0, errors: ['Database not configured'] };
    }

    const errors: string[] = [];
    let processed = 0;
    let matched = 0;

    // Get unlinked emails for this user
    let query = this.supabase
      .from('emails')
      .select('id, from_email, to_emails, subject, body_text')
      .eq('user_id', userId)
      .is('customer_id', null);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: emails, error } = await query.limit(500);

    if (error) {
      return { processed: 0, matched: 0, errors: [error.message] };
    }

    console.log(`[EmailService] Processing ${emails?.length || 0} unlinked emails for user ${userId}`);

    for (const email of emails || []) {
      processed++;

      try {
        const match = await this.matchEmailToCustomer(userId, {
          fromEmail: email.from_email,
          toEmails: email.to_emails || [],
          subject: email.subject || '',
          bodyText: email.body_text || '',
        }, organizationId);

        if (match) {
          let updateQuery = this.supabase
            .from('emails')
            .update({
              customer_id: match.customerId,
              matched_by: match.matchedBy,
              match_confidence: match.confidence,
            })
            .eq('id', email.id);

          if (organizationId) {
            updateQuery = updateQuery.eq('organization_id', organizationId);
          }

          const { error: updateError } = await updateQuery;

          if (updateError) {
            errors.push(`Email ${email.id}: ${updateError.message}`);
          } else {
            matched++;
          }
        }
      } catch (err) {
        errors.push(`Email ${email.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    console.log(`[EmailService] Linked ${matched}/${processed} emails to customers`);

    return { processed, matched, errors };
  }

  /**
   * Match a single email to a customer and update the record
   * Called during sync to link emails as they're stored
   */
  async matchAndLinkEmail(
    userId: string,
    emailId: string,
    fromEmail: string,
    toEmails: string[],
    subject: string,
    bodyText: string,
    organizationId: string | null = null
  ): Promise<boolean> {
    if (!this.supabase) return false;

    const match = await this.matchEmailToCustomer(userId, {
      fromEmail,
      toEmails,
      subject,
      bodyText,
    }, organizationId);

    if (match) {
      let updateQuery = this.supabase
        .from('emails')
        .update({
          customer_id: match.customerId,
          matched_by: match.matchedBy,
          match_confidence: match.confidence,
        })
        .eq('id', emailId);

      if (organizationId) {
        updateQuery = updateQuery.eq('organization_id', organizationId);
      }

      const { error } = await updateQuery;

      return !error;
    }

    return false;
  }
}

// Singleton instance
export const emailService = new EmailService();
export default emailService;
