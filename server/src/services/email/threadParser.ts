/**
 * Email Thread Parser Service (PRD-009)
 *
 * Parses email files in EML, MSG, and text formats.
 * Reconstructs thread chronology and identifies participants.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Types
export interface ParsedEmail {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  from: {
    name?: string;
    email: string;
  };
  to: Array<{ name?: string; email: string }>;
  cc?: Array<{ name?: string; email: string }>;
  subject: string;
  date: Date;
  bodyText: string;
  bodyHtml?: string;
  hasAttachments: boolean;
  attachmentNames?: string[];
}

export interface EmailParticipant {
  name?: string;
  email: string;
  role: 'sender' | 'recipient' | 'cc';
  messageCount: number;
  firstSeen: Date;
  lastSeen: Date;
  isInternal: boolean;
}

export interface ParsedThread {
  id: string;
  subject: string;
  messages: ParsedEmail[];
  participants: EmailParticipant[];
  startDate: Date;
  endDate: Date;
  duration: number; // in milliseconds
  messageCount: number;
  hasAttachments: boolean;
}

export interface ThreadParseResult {
  success: boolean;
  thread?: ParsedThread;
  error?: string;
  warnings?: string[];
}

// Initialize Supabase
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

/**
 * Email Thread Parser Service
 */
export class EmailThreadParser {
  private internalDomains: Set<string>;

  constructor(internalDomains: string[] = []) {
    this.internalDomains = new Set(internalDomains.map(d => d.toLowerCase()));
  }

  /**
   * Set internal domains for participant classification
   */
  setInternalDomains(domains: string[]): void {
    this.internalDomains = new Set(domains.map(d => d.toLowerCase()));
  }

  /**
   * Parse an email file based on its format
   */
  async parseFile(
    content: Buffer,
    fileName: string,
    options?: {
      internalDomains?: string[];
      customerId?: string;
    }
  ): Promise<ThreadParseResult> {
    const warnings: string[] = [];

    if (options?.internalDomains) {
      this.setInternalDomains(options.internalDomains);
    }

    const extension = fileName.toLowerCase().split('.').pop();

    try {
      let messages: ParsedEmail[];

      switch (extension) {
        case 'eml':
          messages = await this.parseEML(content);
          break;
        case 'msg':
          messages = await this.parseMSG(content);
          break;
        case 'txt':
          messages = this.parseTextExport(content.toString('utf-8'));
          break;
        default:
          // Try to auto-detect format
          const contentStr = content.toString('utf-8');
          if (contentStr.includes('From:') && contentStr.includes('To:')) {
            messages = this.parseTextExport(contentStr);
            warnings.push('Format auto-detected as text export');
          } else {
            return {
              success: false,
              error: `Unsupported file format: ${extension}. Supported formats: .eml, .msg, .txt`,
            };
          }
      }

      if (messages.length === 0) {
        return {
          success: false,
          error: 'No email messages found in the file',
        };
      }

      // Build the thread
      const thread = this.buildThread(messages);

      // Store the parsed thread
      const storedId = await this.storeThread(thread, options?.customerId);
      thread.id = storedId;

      return {
        success: true,
        thread,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      console.error('Email parsing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse email file',
      };
    }
  }

  /**
   * Parse EML format (RFC 822)
   */
  private async parseEML(content: Buffer): Promise<ParsedEmail[]> {
    const messages: ParsedEmail[] = [];
    const contentStr = content.toString('utf-8');

    // Split by message boundaries (for forwarded threads)
    const messageParts = this.splitEMLMessages(contentStr);

    for (const part of messageParts) {
      const message = this.parseEMLMessage(part);
      if (message) {
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Split EML content into individual messages
   */
  private splitEMLMessages(content: string): string[] {
    // Look for forwarded message markers
    const forwardMarkers = [
      /---------- Forwarded message ---------/g,
      /-----Original Message-----/g,
      /From:.*Sent:.*To:.*Subject:/g,
    ];

    // For now, treat the whole content as one message
    // In production, would recursively extract forwarded/quoted content
    return [content];
  }

  /**
   * Parse a single EML message
   */
  private parseEMLMessage(content: string): ParsedEmail | null {
    // Extract headers
    const headerMatch = content.match(/^([\s\S]*?)\r?\n\r?\n/);
    if (!headerMatch) return null;

    const headers = headerMatch[1];
    const body = content.slice(headerMatch[0].length);

    // Parse headers
    const getHeader = (name: string): string | undefined => {
      const regex = new RegExp(`^${name}:\\s*(.+?)(?=\\r?\\n(?:[\\w-]+:|$))`, 'ims');
      const match = headers.match(regex);
      return match ? match[1].trim().replace(/\r?\n\s+/g, ' ') : undefined;
    };

    const from = getHeader('From');
    const to = getHeader('To');
    const subject = getHeader('Subject');
    const date = getHeader('Date');
    const messageId = getHeader('Message-ID') || getHeader('Message-Id');
    const inReplyTo = getHeader('In-Reply-To');
    const references = getHeader('References');

    if (!from || !to || !subject) return null;

    // Parse body (handle multipart)
    const { text: bodyText, html: bodyHtml } = this.parseBody(body, headers);

    // Check for attachments
    const hasAttachments = content.includes('Content-Disposition: attachment') ||
      content.includes('filename=');

    return {
      messageId: messageId || this.generateMessageId(),
      inReplyTo: inReplyTo ? this.extractMessageId(inReplyTo) : undefined,
      references: references ? this.parseReferences(references) : undefined,
      from: this.parseEmailAddress(from),
      to: to.split(',').map(addr => this.parseEmailAddress(addr.trim())),
      cc: getHeader('Cc')?.split(',').map(addr => this.parseEmailAddress(addr.trim())),
      subject: this.decodeSubject(subject),
      date: date ? new Date(date) : new Date(),
      bodyText,
      bodyHtml,
      hasAttachments,
    };
  }

  /**
   * Parse MSG format (Microsoft Outlook)
   * Note: Full MSG parsing requires a dedicated library like node-msg-parser
   * This is a simplified implementation
   */
  private async parseMSG(content: Buffer): Promise<ParsedEmail[]> {
    // MSG files are complex binary format
    // For production, use a library like 'msg-reader' or 'node-msg-parser'

    // Try to extract text content as fallback
    const textContent = content.toString('utf-8').replace(/[^\x20-\x7E\r\n]/g, ' ');

    // Look for common patterns in MSG text extraction
    const fromMatch = textContent.match(/From:\s*([^\r\n]+)/i);
    const toMatch = textContent.match(/To:\s*([^\r\n]+)/i);
    const subjectMatch = textContent.match(/Subject:\s*([^\r\n]+)/i);
    const dateMatch = textContent.match(/Date:\s*([^\r\n]+)/i);

    if (fromMatch && toMatch && subjectMatch) {
      return [{
        messageId: this.generateMessageId(),
        from: this.parseEmailAddress(fromMatch[1]),
        to: toMatch[1].split(/[,;]/).map(addr => this.parseEmailAddress(addr.trim())),
        subject: subjectMatch[1],
        date: dateMatch ? new Date(dateMatch[1]) : new Date(),
        bodyText: this.extractMSGBody(textContent),
        hasAttachments: false,
      }];
    }

    throw new Error('Unable to parse MSG file. Consider converting to EML format.');
  }

  /**
   * Extract body from MSG text content
   */
  private extractMSGBody(content: string): string {
    // Remove headers and extract body
    const lines = content.split(/\r?\n/);
    let inBody = false;
    const bodyLines: string[] = [];

    for (const line of lines) {
      if (inBody) {
        bodyLines.push(line);
      } else if (line.trim() === '' || line.match(/^[\s-]+$/)) {
        inBody = true;
      }
    }

    return bodyLines.join('\n').trim() || content;
  }

  /**
   * Parse text export format (Gmail exports, manual copies)
   */
  private parseTextExport(content: string): ParsedEmail[] {
    const messages: ParsedEmail[] = [];

    // Common patterns for email thread exports
    const emailPatterns = [
      // Pattern 1: "On [date], [name] <email> wrote:"
      /On\s+([^\n]+?),?\s+(.+?)\s*<([^>]+)>\s*wrote:[\r\n]+([\s\S]*?)(?=(?:On\s+[^\n]+?,?\s+.+?\s*<[^>]+>\s*wrote:|$))/gi,
      // Pattern 2: "From: [name] <email>\nDate: [date]\nTo: [to]\nSubject: [subject]"
      /From:\s*([^\r\n]+)\r?\nDate:\s*([^\r\n]+)\r?\nTo:\s*([^\r\n]+)\r?\nSubject:\s*([^\r\n]+)\r?\n\r?\n([\s\S]*?)(?=(?:From:|$))/gi,
      // Pattern 3: Gmail-style "---------- Forwarded message ---------"
      /---------- Forwarded message ---------\r?\nFrom:\s*([^\r\n]+)\r?\nDate:\s*([^\r\n]+)\r?\nSubject:\s*([^\r\n]+)\r?\nTo:\s*([^\r\n]+)\r?\n\r?\n([\s\S]*?)(?=(?:---------- Forwarded message ---------|$))/gi,
    ];

    // Try each pattern
    for (const pattern of emailPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const email = this.extractFromPattern(match, pattern);
        if (email) {
          messages.push(email);
        }
      }
      if (messages.length > 0) break;
    }

    // Fallback: treat entire content as single message
    if (messages.length === 0) {
      const singleEmail = this.parseSingleTextEmail(content);
      if (singleEmail) {
        messages.push(singleEmail);
      }
    }

    return messages;
  }

  /**
   * Extract email from regex pattern match
   */
  private extractFromPattern(match: RegExpExecArray, pattern: RegExp): ParsedEmail | null {
    const patternStr = pattern.source;

    // Pattern 1: "On [date], [name] <email> wrote:"
    if (patternStr.includes('wrote:')) {
      const [, dateStr, name, email, body] = match;
      return {
        messageId: this.generateMessageId(),
        from: { name: name.trim(), email: email.trim() },
        to: [], // Will be inferred from thread context
        subject: 'Re: (extracted from thread)',
        date: this.parseFlexibleDate(dateStr) || new Date(),
        bodyText: body.trim(),
        hasAttachments: false,
      };
    }

    // Pattern 2: Standard header format
    if (patternStr.includes('From:') && patternStr.includes('Date:')) {
      const [, from, date, to, subject, body] = match;
      return {
        messageId: this.generateMessageId(),
        from: this.parseEmailAddress(from),
        to: to.split(/[,;]/).map(addr => this.parseEmailAddress(addr.trim())),
        subject: subject.trim(),
        date: this.parseFlexibleDate(date) || new Date(),
        bodyText: body.trim(),
        hasAttachments: false,
      };
    }

    return null;
  }

  /**
   * Parse a single text email
   */
  private parseSingleTextEmail(content: string): ParsedEmail | null {
    const lines = content.split(/\r?\n/);
    const headers: Record<string, string> = {};
    let bodyStart = 0;

    // Extract headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        bodyStart = i + 1;
        break;
      }
      const headerMatch = line.match(/^([A-Za-z-]+):\s*(.+)$/);
      if (headerMatch) {
        headers[headerMatch[1].toLowerCase()] = headerMatch[2];
      }
    }

    const from = headers['from'];
    const to = headers['to'];
    const subject = headers['subject'] || '(No Subject)';
    const date = headers['date'];

    if (!from && !to) {
      // Treat entire content as body
      return {
        messageId: this.generateMessageId(),
        from: { email: 'unknown@unknown.com' },
        to: [{ email: 'unknown@unknown.com' }],
        subject: '(Extracted email thread)',
        date: new Date(),
        bodyText: content,
        hasAttachments: false,
      };
    }

    return {
      messageId: this.generateMessageId(),
      from: from ? this.parseEmailAddress(from) : { email: 'unknown@unknown.com' },
      to: to ? to.split(/[,;]/).map(addr => this.parseEmailAddress(addr.trim())) : [],
      subject,
      date: date ? this.parseFlexibleDate(date) || new Date() : new Date(),
      bodyText: lines.slice(bodyStart).join('\n').trim(),
      hasAttachments: false,
    };
  }

  /**
   * Parse email body (handle multipart MIME)
   */
  private parseBody(body: string, headers: string): { text: string; html?: string } {
    const contentType = headers.match(/Content-Type:\s*([^\r\n;]+)/i)?.[1]?.toLowerCase();
    const boundary = headers.match(/boundary="?([^";\r\n]+)"?/i)?.[1];

    if (contentType?.includes('multipart') && boundary) {
      return this.parseMultipartBody(body, boundary);
    }

    // Single part
    if (contentType?.includes('text/html')) {
      return {
        text: this.htmlToText(body),
        html: body,
      };
    }

    return { text: this.decodeQuotedPrintable(body) };
  }

  /**
   * Parse multipart MIME body
   */
  private parseMultipartBody(body: string, boundary: string): { text: string; html?: string } {
    const parts = body.split(`--${boundary}`);
    let text = '';
    let html: string | undefined;

    for (const part of parts) {
      if (part.trim() === '' || part.trim() === '--') continue;

      const partContentType = part.match(/Content-Type:\s*([^\r\n;]+)/i)?.[1]?.toLowerCase();
      const partContent = part.replace(/^[\s\S]*?\r?\n\r?\n/, '').trim();

      if (partContentType?.includes('text/plain')) {
        text = this.decodeQuotedPrintable(partContent);
      } else if (partContentType?.includes('text/html')) {
        html = partContent;
        if (!text) {
          text = this.htmlToText(partContent);
        }
      }
    }

    return { text: text || body, html };
  }

  /**
   * Build a thread from parsed messages
   */
  private buildThread(messages: ParsedEmail[]): ParsedThread {
    // Sort by date (oldest first)
    const sortedMessages = [...messages].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Collect participants
    const participantMap = new Map<string, EmailParticipant>();

    for (const msg of sortedMessages) {
      // Process sender
      this.addParticipant(participantMap, msg.from, 'sender', msg.date);

      // Process recipients
      for (const to of msg.to) {
        this.addParticipant(participantMap, to, 'recipient', msg.date);
      }

      // Process CC
      for (const cc of msg.cc || []) {
        this.addParticipant(participantMap, cc, 'cc', msg.date);
      }
    }

    const participants = Array.from(participantMap.values());
    const startDate = sortedMessages[0].date;
    const endDate = sortedMessages[sortedMessages.length - 1].date;

    // Extract consistent subject (remove Re:, Fwd: prefixes)
    const subject = this.normalizeSubject(sortedMessages[0].subject);

    return {
      id: '', // Will be set after storage
      subject,
      messages: sortedMessages,
      participants,
      startDate,
      endDate,
      duration: endDate.getTime() - startDate.getTime(),
      messageCount: sortedMessages.length,
      hasAttachments: sortedMessages.some(m => m.hasAttachments),
    };
  }

  /**
   * Add or update a participant in the map
   */
  private addParticipant(
    map: Map<string, EmailParticipant>,
    address: { name?: string; email: string },
    role: 'sender' | 'recipient' | 'cc',
    messageDate: Date
  ): void {
    const key = address.email.toLowerCase();
    const existing = map.get(key);

    if (existing) {
      existing.messageCount++;
      if (messageDate < existing.firstSeen) existing.firstSeen = messageDate;
      if (messageDate > existing.lastSeen) existing.lastSeen = messageDate;
      // Upgrade role: sender > recipient > cc
      if (role === 'sender' && existing.role !== 'sender') {
        existing.role = 'sender';
      } else if (role === 'recipient' && existing.role === 'cc') {
        existing.role = 'recipient';
      }
    } else {
      const domain = address.email.split('@')[1]?.toLowerCase();
      map.set(key, {
        name: address.name,
        email: address.email,
        role,
        messageCount: 1,
        firstSeen: messageDate,
        lastSeen: messageDate,
        isInternal: domain ? this.internalDomains.has(domain) : false,
      });
    }
  }

  /**
   * Store parsed thread in database
   */
  private async storeThread(thread: ParsedThread, customerId?: string): Promise<string> {
    const id = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (supabase) {
      try {
        const { error } = await supabase.from('email_threads').insert({
          id,
          customer_id: customerId,
          subject: thread.subject,
          messages: JSON.stringify(thread.messages),
          participants: JSON.stringify(thread.participants),
          start_date: thread.startDate.toISOString(),
          end_date: thread.endDate.toISOString(),
          duration_ms: thread.duration,
          message_count: thread.messageCount,
          has_attachments: thread.hasAttachments,
          created_at: new Date().toISOString(),
        });

        if (error) {
          console.warn('Failed to store thread in database:', error.message);
        }
      } catch (err) {
        console.warn('Database storage error:', err);
      }
    }

    return id;
  }

  // ==================== Helper Methods ====================

  /**
   * Parse email address from "Name <email>" or plain email format
   */
  private parseEmailAddress(str: string): { name?: string; email: string } {
    const match = str.match(/^(?:"?([^"<]*)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?$/);
    if (match) {
      return {
        name: match[1]?.trim() || undefined,
        email: match[2].trim().toLowerCase(),
      };
    }
    return { email: str.trim().toLowerCase() };
  }

  /**
   * Extract message ID from header value
   */
  private extractMessageId(value: string): string {
    const match = value.match(/<([^>]+)>/);
    return match ? match[1] : value.trim();
  }

  /**
   * Parse References header into array
   */
  private parseReferences(value: string): string[] {
    const refs: string[] = [];
    const regex = /<([^>]+)>/g;
    let match;
    while ((match = regex.exec(value)) !== null) {
      refs.push(match[1]);
    }
    return refs;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Decode quoted-printable encoding
   */
  private decodeQuotedPrintable(text: string): string {
    return text
      .replace(/=\r?\n/g, '') // Remove soft line breaks
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  /**
   * Decode subject with possible encoding
   */
  private decodeSubject(subject: string): string {
    // Handle =?charset?encoding?text?= format
    return subject.replace(
      /=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi,
      (_, charset, encoding, text) => {
        if (encoding.toUpperCase() === 'B') {
          return Buffer.from(text, 'base64').toString('utf-8');
        } else {
          return this.decodeQuotedPrintable(text.replace(/_/g, ' '));
        }
      }
    );
  }

  /**
   * Normalize subject (remove Re:, Fwd:, etc.)
   */
  private normalizeSubject(subject: string): string {
    return subject.replace(/^(re:|fwd?:|aw:|sv:|fw:)\s*/gi, '').trim();
  }

  /**
   * Parse flexible date formats
   */
  private parseFlexibleDate(dateStr: string): Date | null {
    // Try standard parsing first
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try common formats
    const formats = [
      // "Jan 23, 2024 at 10:30 AM"
      /(\w+ \d{1,2}, \d{4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
      // "23/01/2024 10:30"
      /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2})/,
      // "2024-01-23T10:30:00"
      /(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        const parsed = new Date(match[0]);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    return null;
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
}

// Singleton instance
export const emailThreadParser = new EmailThreadParser();
