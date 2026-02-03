/**
 * Ticket Parser Service
 * PRD-004: Parse support ticket exports from various platforms
 *
 * Supports:
 * - Zendesk CSV exports
 * - Intercom CSV exports
 * - Freshdesk CSV exports
 * - Generic CSV format
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';

// ============================================
// Types
// ============================================

export type TicketPlatform = 'zendesk' | 'intercom' | 'freshdesk' | 'generic';
export type TicketPriority = 'urgent' | 'high' | 'normal' | 'low';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';

export interface ParsedTicket {
  id: string;
  externalId: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  subject: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string;
  tags: string[];
  assignee?: string;
  createdAt: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
  firstResponseAt?: Date;
  csatScore?: number;
  escalationCount: number;
  isEscalated: boolean;
  source: TicketPlatform;
  metadata: Record<string, any>;
}

export interface TicketColumnMapping {
  ticketId?: string;
  customerEmail?: string;
  customerName?: string;
  subject?: string;
  description?: string;
  status?: string;
  priority?: string;
  category?: string;
  tags?: string;
  assignee?: string;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
  firstResponseAt?: string;
  csatScore?: string;
  escalated?: string;
  [key: string]: string | undefined;
}

export interface TicketUploadResult {
  success: boolean;
  uploadId: string;
  platform: TicketPlatform;
  totalTickets: number;
  uniqueCustomers: number;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  suggestedMapping: TicketColumnMapping;
  headers: string[];
  previewData: Record<string, any>[];
  errors?: string[];
}

export interface TicketDataset {
  uploadId: string;
  tickets: ParsedTicket[];
  platform: TicketPlatform;
  customersMap: Map<string, string[]>; // email -> ticket IDs
  dateRange: { start: Date; end: Date };
}

// ============================================
// Column Pattern Definitions by Platform
// ============================================

const ZENDESK_PATTERNS: Record<string, RegExp[]> = {
  ticketId: [/^id$/i, /^ticket[\s_-]?id$/i, /^#$/i],
  customerEmail: [/^requester[\s_-]?(email)?$/i, /^email$/i, /^submitter$/i],
  customerName: [/^requester[\s_-]?name$/i, /^name$/i, /^submitter[\s_-]?name$/i],
  subject: [/^subject$/i, /^title$/i, /^ticket[\s_-]?subject$/i],
  description: [/^description$/i, /^content$/i, /^body$/i, /^comment$/i],
  status: [/^status$/i, /^ticket[\s_-]?status$/i],
  priority: [/^priority$/i, /^urgency$/i],
  category: [/^type$/i, /^category$/i, /^ticket[\s_-]?type$/i],
  tags: [/^tags$/i, /^labels$/i],
  assignee: [/^assignee[\s_-]?(name|email)?$/i, /^assigned[\s_-]?to$/i, /^agent$/i],
  createdAt: [/^created[\s_-]?(at|date)?$/i, /^submitted[\s_-]?(at|date)?$/i, /^opened[\s_-]?(at|date)?$/i],
  updatedAt: [/^updated[\s_-]?(at|date)?$/i, /^modified[\s_-]?(at|date)?$/i],
  resolvedAt: [/^resolved[\s_-]?(at|date)?$/i, /^solved[\s_-]?(at|date)?$/i, /^closed[\s_-]?(at|date)?$/i],
  firstResponseAt: [/^first[\s_-]?response[\s_-]?(at|time)?$/i],
  csatScore: [/^satisfaction[\s_-]?(score|rating)?$/i, /^csat$/i, /^rating$/i],
  escalated: [/^escalat(ed|ion)$/i, /^is[\s_-]?escalated$/i],
};

const INTERCOM_PATTERNS: Record<string, RegExp[]> = {
  ticketId: [/^conversation[\s_-]?id$/i, /^id$/i],
  customerEmail: [/^user[\s_-]?email$/i, /^contact[\s_-]?email$/i, /^email$/i],
  customerName: [/^user[\s_-]?name$/i, /^contact[\s_-]?name$/i, /^name$/i],
  subject: [/^title$/i, /^subject$/i, /^first[\s_-]?message$/i],
  description: [/^body$/i, /^content$/i, /^message$/i],
  status: [/^state$/i, /^status$/i],
  priority: [/^priority$/i, /^urgency$/i],
  category: [/^tag$/i, /^type$/i, /^category$/i],
  tags: [/^tags$/i, /^labels$/i],
  assignee: [/^assigned[\s_-]?admin$/i, /^admin$/i, /^assignee$/i],
  createdAt: [/^created[\s_-]?at$/i, /^started[\s_-]?at$/i],
  updatedAt: [/^updated[\s_-]?at$/i, /^last[\s_-]?activity$/i],
  resolvedAt: [/^closed[\s_-]?at$/i, /^resolved[\s_-]?at$/i],
  csatScore: [/^rating$/i, /^csat$/i],
};

const FRESHDESK_PATTERNS: Record<string, RegExp[]> = {
  ticketId: [/^ticket[\s_-]?id$/i, /^display[\s_-]?id$/i, /^id$/i],
  customerEmail: [/^requester[\s_-]?email$/i, /^contact[\s_-]?email$/i, /^email$/i],
  customerName: [/^requester[\s_-]?name$/i, /^contact[\s_-]?name$/i],
  subject: [/^subject$/i, /^title$/i],
  description: [/^description$/i, /^ticket[\s_-]?description$/i],
  status: [/^status$/i],
  priority: [/^priority$/i],
  category: [/^type$/i, /^ticket[\s_-]?type$/i],
  tags: [/^tags$/i],
  assignee: [/^agent[\s_-]?(name|email)?$/i, /^assigned[\s_-]?to$/i],
  createdAt: [/^created[\s_-]?at$/i, /^created[\s_-]?time$/i],
  updatedAt: [/^updated[\s_-]?at$/i],
  resolvedAt: [/^resolved[\s_-]?at$/i, /^closed[\s_-]?at$/i],
  firstResponseAt: [/^first[\s_-]?response[\s_-]?time$/i, /^initial[\s_-]?response[\s_-]?time$/i],
  csatScore: [/^survey[\s_-]?(score|rating)$/i, /^csat$/i],
};

// ============================================
// Ticket Parser Service
// ============================================

export class TicketParserService {
  private supabase: SupabaseClient | null = null;
  private uploadCache: Map<string, { rows: Record<string, any>[]; mapping: TicketColumnMapping; platform: TicketPlatform }> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // File Parsing
  // ============================================

  /**
   * Parse CSV content from a buffer or string
   */
  parseCSV(content: string | Buffer): { headers: string[]; rows: Record<string, any>[] } {
    let textContent: string;

    if (Buffer.isBuffer(content)) {
      textContent = content.toString('utf-8');
      // Handle BOM
      if (textContent.charCodeAt(0) === 0xFEFF) {
        textContent = textContent.slice(1);
      }
    } else {
      textContent = content;
    }

    // Detect delimiter
    const delimiter = this.detectDelimiter(textContent);

    // Parse lines handling quoted values
    const lines = this.parseLines(textContent);
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    // Extract headers
    const headers = this.parseLine(lines[0], delimiter);

    // Parse data rows
    const rows: Record<string, any>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseLine(line, delimiter);
      const row: Record<string, any> = {};

      headers.forEach((header, index) => {
        const value = values[index]?.trim() || '';
        row[header] = this.parseValue(value);
      });

      rows.push(row);
    }

    return { headers, rows };
  }

  /**
   * Parse Excel file (XLSX) - simplified implementation
   * In production, would use xlsx library
   */
  parseExcel(content: Buffer): { headers: string[]; rows: Record<string, any>[] } {
    // For now, we'll require CSV format
    // In a production implementation, use xlsx library:
    // import * as XLSX from 'xlsx';
    // const workbook = XLSX.read(content);
    // const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // return XLSX.utils.sheet_to_json(sheet, { header: 1 });
    throw new Error('Excel format not yet supported. Please export as CSV.');
  }

  // ============================================
  // Platform Detection
  // ============================================

  /**
   * Detect the ticket platform from headers
   */
  detectPlatform(headers: string[]): TicketPlatform {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    // Zendesk indicators
    const zendeskIndicators = ['requester', 'satisfaction', 'via', 'brand', 'solved at'];
    if (zendeskIndicators.some(ind => normalizedHeaders.some(h => h.includes(ind)))) {
      return 'zendesk';
    }

    // Intercom indicators
    const intercomIndicators = ['conversation id', 'admin', 'started at', 'user id'];
    if (intercomIndicators.some(ind => normalizedHeaders.some(h => h.includes(ind)))) {
      return 'intercom';
    }

    // Freshdesk indicators
    const freshdeskIndicators = ['display id', 'requester', 'agent', 'ticket type', 'group'];
    if (freshdeskIndicators.some(ind => normalizedHeaders.some(h => h.includes(ind)))) {
      return 'freshdesk';
    }

    return 'generic';
  }

  /**
   * Suggest column mapping based on detected platform
   */
  suggestColumnMapping(headers: string[], platform: TicketPlatform): TicketColumnMapping {
    const patterns = this.getPlatformPatterns(platform);
    const mapping: TicketColumnMapping = {};

    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().trim();

      for (const [field, fieldPatterns] of Object.entries(patterns)) {
        for (const pattern of fieldPatterns) {
          if (pattern.test(normalizedHeader)) {
            if (!mapping[field]) {
              mapping[field] = header;
            }
            break;
          }
        }
      }
    }

    return mapping;
  }

  private getPlatformPatterns(platform: TicketPlatform): Record<string, RegExp[]> {
    switch (platform) {
      case 'zendesk':
        return ZENDESK_PATTERNS;
      case 'intercom':
        return INTERCOM_PATTERNS;
      case 'freshdesk':
        return FRESHDESK_PATTERNS;
      default:
        // Use Zendesk patterns as generic fallback (most common)
        return ZENDESK_PATTERNS;
    }
  }

  // ============================================
  // Upload Processing
  // ============================================

  /**
   * Process uploaded ticket file
   */
  async processUpload(
    content: string | Buffer,
    fileName: string,
    userId: string
  ): Promise<TicketUploadResult> {
    const uploadId = uuidv4();
    const errors: string[] = [];

    // Parse content
    const { headers, rows } = this.parseCSV(content);

    if (rows.length === 0) {
      return {
        success: false,
        uploadId,
        platform: 'generic',
        totalTickets: 0,
        uniqueCustomers: 0,
        dateRange: { start: null, end: null },
        suggestedMapping: {},
        headers,
        previewData: [],
        errors: ['No data found in file'],
      };
    }

    // Detect platform
    const platform = this.detectPlatform(headers);

    // Suggest mapping
    const suggestedMapping = this.suggestColumnMapping(headers, platform);

    // Calculate stats
    const customerEmails = new Set<string>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    const dateColumn = suggestedMapping.createdAt;
    const emailColumn = suggestedMapping.customerEmail;

    for (const row of rows) {
      // Track unique customers
      if (emailColumn && row[emailColumn]) {
        customerEmails.add(String(row[emailColumn]).toLowerCase());
      }

      // Track date range
      if (dateColumn && row[dateColumn]) {
        const date = new Date(row[dateColumn]);
        if (!isNaN(date.getTime())) {
          if (!minDate || date < minDate) minDate = date;
          if (!maxDate || date > maxDate) maxDate = date;
        }
      }
    }

    // Cache the upload for later processing
    this.uploadCache.set(uploadId, { rows, mapping: suggestedMapping, platform });

    // Store in database if available
    if (this.supabase) {
      await this.supabase.from('ticket_uploads').insert({
        id: uploadId,
        user_id: userId,
        file_name: fileName,
        platform,
        total_tickets: rows.length,
        unique_customers: customerEmails.size,
        date_range_start: minDate?.toISOString(),
        date_range_end: maxDate?.toISOString(),
        suggested_mapping: suggestedMapping,
        headers,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    }

    return {
      success: true,
      uploadId,
      platform,
      totalTickets: rows.length,
      uniqueCustomers: customerEmails.size,
      dateRange: { start: minDate, end: maxDate },
      suggestedMapping,
      headers,
      previewData: rows.slice(0, 10),
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Confirm mapping and parse tickets
   */
  async confirmMappingAndParse(
    uploadId: string,
    mapping: TicketColumnMapping,
    userId: string
  ): Promise<TicketDataset> {
    const cached = this.uploadCache.get(uploadId);

    if (!cached) {
      throw new Error('Upload not found. Please re-upload the file.');
    }

    const { rows, platform } = cached;
    const tickets: ParsedTicket[] = [];
    const customersMap = new Map<string, string[]>();

    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const row of rows) {
      const ticket = this.mapRowToTicket(row, mapping, platform);
      tickets.push(ticket);

      // Track by customer
      if (ticket.customerEmail) {
        const existing = customersMap.get(ticket.customerEmail) || [];
        existing.push(ticket.id);
        customersMap.set(ticket.customerEmail, existing);
      }

      // Track date range
      if (ticket.createdAt) {
        if (!minDate || ticket.createdAt < minDate) minDate = ticket.createdAt;
        if (!maxDate || ticket.createdAt > maxDate) maxDate = ticket.createdAt;
      }
    }

    // Update database status
    if (this.supabase) {
      await this.supabase
        .from('ticket_uploads')
        .update({
          status: 'parsed',
          confirmed_mapping: mapping,
          parsed_at: new Date().toISOString(),
        })
        .eq('id', uploadId);
    }

    return {
      uploadId,
      tickets,
      platform,
      customersMap,
      dateRange: {
        start: minDate || new Date(),
        end: maxDate || new Date(),
      },
    };
  }

  /**
   * Map a raw row to a ParsedTicket
   */
  private mapRowToTicket(
    row: Record<string, any>,
    mapping: TicketColumnMapping,
    platform: TicketPlatform
  ): ParsedTicket {
    const getValue = (field: keyof TicketColumnMapping): any => {
      const column = mapping[field];
      return column ? row[column] : undefined;
    };

    const parseDate = (value: any): Date | undefined => {
      if (!value) return undefined;
      const date = new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    };

    const parseStatus = (value: any): TicketStatus => {
      if (!value) return 'open';
      const normalized = String(value).toLowerCase();
      if (['solved', 'resolved', 'closed', 'done'].some(s => normalized.includes(s))) {
        return normalized.includes('closed') ? 'closed' : 'resolved';
      }
      if (['pending', 'waiting', 'on-hold', 'hold'].some(s => normalized.includes(s))) {
        return 'pending';
      }
      return 'open';
    };

    const parsePriority = (value: any): TicketPriority => {
      if (!value) return 'normal';
      const normalized = String(value).toLowerCase();
      if (['urgent', 'critical', 'p1', '1'].some(p => normalized.includes(p))) return 'urgent';
      if (['high', 'p2', '2'].some(p => normalized.includes(p))) return 'high';
      if (['low', 'p4', '4', 'minor'].some(p => normalized.includes(p))) return 'low';
      return 'normal';
    };

    const parseTags = (value: any): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      return String(value).split(/[,;|]/).map(t => t.trim()).filter(Boolean);
    };

    const parseNumber = (value: any): number | undefined => {
      if (value === null || value === undefined) return undefined;
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    };

    const parseBoolean = (value: any): boolean => {
      if (!value) return false;
      const normalized = String(value).toLowerCase();
      return ['true', 'yes', '1', 'escalated'].some(b => normalized.includes(b));
    };

    const externalId = String(getValue('ticketId') || uuidv4());
    const createdAt = parseDate(getValue('createdAt')) || new Date();

    return {
      id: uuidv4(),
      externalId,
      customerEmail: getValue('customerEmail')?.toLowerCase?.(),
      customerName: getValue('customerName'),
      subject: getValue('subject') || 'No subject',
      description: getValue('description'),
      status: parseStatus(getValue('status')),
      priority: parsePriority(getValue('priority')),
      category: getValue('category'),
      tags: parseTags(getValue('tags')),
      assignee: getValue('assignee'),
      createdAt,
      updatedAt: parseDate(getValue('updatedAt')),
      resolvedAt: parseDate(getValue('resolvedAt')),
      firstResponseAt: parseDate(getValue('firstResponseAt')),
      csatScore: parseNumber(getValue('csatScore')),
      escalationCount: parseBoolean(getValue('escalated')) ? 1 : 0,
      isEscalated: parseBoolean(getValue('escalated')),
      source: platform,
      metadata: row,
    };
  }

  // ============================================
  // Utility Methods
  // ============================================

  private detectDelimiter(content: string): string {
    const firstLine = content.split('\n')[0];
    const delimiters = [',', ';', '\t', '|'];
    let bestDelimiter = ',';
    let maxCount = 0;

    for (const delimiter of delimiters) {
      const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = delimiter;
      }
    }

    return bestDelimiter;
  }

  private parseLines(content: string): string[] {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (char === '"') {
        inQuotes = !inQuotes;
        currentLine += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && content[i + 1] === '\n') {
          i++;
        }
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = '';
      } else {
        currentLine += char;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine);
    }

    return lines;
  }

  private parseLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentValue += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue.trim());
    return values;
  }

  private parseValue(value: string): any {
    if (value === '' || value.toLowerCase() === 'null' || value.toLowerCase() === 'n/a') {
      return null;
    }

    // Boolean
    if (value.toLowerCase() === 'true' || value.toLowerCase() === 'yes') return true;
    if (value.toLowerCase() === 'false' || value.toLowerCase() === 'no') return false;

    // Number
    const cleanedNumber = value.replace(/[$,]/g, '');
    if (/^-?\d+\.?\d*$/.test(cleanedNumber)) {
      const num = parseFloat(cleanedNumber);
      return isNaN(num) ? value : num;
    }

    return value;
  }

  /**
   * Get cached upload data
   */
  getCachedUpload(uploadId: string): { rows: Record<string, any>[]; mapping: TicketColumnMapping; platform: TicketPlatform } | undefined {
    return this.uploadCache.get(uploadId);
  }

  /**
   * Clear cached upload
   */
  clearCachedUpload(uploadId: string): void {
    this.uploadCache.delete(uploadId);
  }
}

// Singleton instance
export const ticketParser = new TicketParserService();
export default ticketParser;
