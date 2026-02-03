/**
 * Feedback Parser Service
 * PRD-010: Product Feedback Upload - Theme Clustering
 *
 * Parses various feedback formats (CSV, Excel, documents)
 * and extracts structured feedback items with customer attribution.
 *
 * Features:
 * - Multi-format support (CSV, Excel, text documents)
 * - Automatic source detection (survey, support, interview, etc.)
 * - Customer attribution linking
 * - Date range extraction
 * - Encoding detection
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types
// ============================================

export type FeedbackSource =
  | 'survey'
  | 'support_ticket'
  | 'interview'
  | 'feature_request'
  | 'nps_verbatim'
  | 'email'
  | 'call_transcript'
  | 'other';

export interface ParsedFeedbackItem {
  id: string;
  text: string;
  source: FeedbackSource;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerSegment?: string;
  customerArr?: number;
  respondentName?: string;
  respondentRole?: string;
  submittedAt?: Date;
  rawData: Record<string, unknown>;
}

export interface FeedbackParseResult {
  uploadId: string;
  fileName: string;
  totalItems: number;
  sources: Record<FeedbackSource, number>;
  customersRepresented: number;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  items: ParsedFeedbackItem[];
  columnMapping: FeedbackColumnMapping;
  detectedEncoding: string;
}

export interface FeedbackColumnMapping {
  feedbackText?: string;
  customerName?: string;
  customerEmail?: string;
  customerId?: string;
  customerSegment?: string;
  customerArr?: string;
  respondentName?: string;
  respondentRole?: string;
  source?: string;
  submittedAt?: string;
  [key: string]: string | undefined;
}

export interface FeedbackUploadRecord {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  status: 'pending' | 'parsing' | 'parsed' | 'clustered' | 'reported' | 'failed';
  totalItems: number;
  customersRepresented: number;
  sourceBreakdown: Record<FeedbackSource, number>;
  dateRange: { start: string | null; end: string | null };
  columnMapping: FeedbackColumnMapping;
  errorMessage?: string;
  createdAt: Date;
  parsedAt?: Date;
  clusteredAt?: Date;
}

// ============================================
// Field Patterns for Auto-Mapping
// ============================================

const FEEDBACK_FIELD_PATTERNS: Record<string, RegExp[]> = {
  feedbackText: [
    /^feedback$/i,
    /^comment[s]?$/i,
    /^verbatim$/i,
    /^response$/i,
    /^text$/i,
    /^message$/i,
    /^description$/i,
    /^content$/i,
    /^suggestion[s]?$/i,
    /^note[s]?$/i
  ],
  customerName: [
    /^(customer|company|account|client)[\s_-]?name$/i,
    /^name$/i,
    /^company$/i,
    /^account$/i,
    /^organization$/i
  ],
  customerEmail: [
    /^(customer|contact|primary)[\s_-]?email$/i,
    /^email[\s_-]?(address)?$/i,
    /^e-?mail$/i
  ],
  customerId: [
    /^(customer|account|client)[\s_-]?id$/i,
    /^id$/i,
    /^external[\s_-]?id$/i
  ],
  customerSegment: [
    /^segment$/i,
    /^tier$/i,
    /^(customer[\s_-]?)?(segment|tier|type)$/i,
    /^category$/i
  ],
  customerArr: [
    /^arr$/i,
    /^annual[\s_-]?(recurring[\s_-]?)?revenue$/i,
    /^mrr$/i,
    /^revenue$/i,
    /^contract[\s_-]?value$/i
  ],
  respondentName: [
    /^(respondent|submitter|user)[\s_-]?name$/i,
    /^submitted[\s_-]?by$/i,
    /^author$/i
  ],
  respondentRole: [
    /^(respondent|user|contact)[\s_-]?(role|title|position)$/i,
    /^role$/i,
    /^title$/i,
    /^job[\s_-]?title$/i
  ],
  source: [
    /^source$/i,
    /^origin$/i,
    /^channel$/i,
    /^type$/i,
    /^feedback[\s_-]?type$/i
  ],
  submittedAt: [
    /^(submitted|created|date)[\s_-]?(at|on|date|time)?$/i,
    /^date$/i,
    /^timestamp$/i,
    /^when$/i
  ]
};

// Source detection patterns
const SOURCE_PATTERNS: Array<{ pattern: RegExp; source: FeedbackSource }> = [
  { pattern: /survey|nps|csat|ces|questionnaire/i, source: 'survey' },
  { pattern: /ticket|support|help[\s_-]?desk|case/i, source: 'support_ticket' },
  { pattern: /interview|call|conversation|meeting/i, source: 'interview' },
  { pattern: /feature[\s_-]?request|idea|suggestion|enhancement/i, source: 'feature_request' },
  { pattern: /nps|net[\s_-]?promoter/i, source: 'nps_verbatim' },
  { pattern: /email|message|correspondence/i, source: 'email' },
  { pattern: /transcript|recording/i, source: 'call_transcript' }
];

// ============================================
// Service Class
// ============================================

class FeedbackParserService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Parse feedback from CSV content
   */
  async parseFeedbackCSV(
    content: string | Buffer,
    options: {
      fileName: string;
      userId: string;
      delimiter?: string;
      encoding?: BufferEncoding;
    }
  ): Promise<FeedbackParseResult> {
    let textContent: string;
    let detectedEncoding = 'UTF-8';

    // Handle buffer or string
    if (Buffer.isBuffer(content)) {
      try {
        textContent = content.toString('utf-8');
        if (textContent.includes('\uFFFD')) {
          textContent = content.toString('latin1');
          detectedEncoding = 'ISO-8859-1';
        }
      } catch {
        textContent = content.toString('latin1');
        detectedEncoding = 'ISO-8859-1';
      }
    } else {
      textContent = content;
    }

    // Remove BOM
    if (textContent.charCodeAt(0) === 0xFEFF) {
      textContent = textContent.slice(1);
    }

    // Detect delimiter
    const delimiter = options.delimiter || this.detectDelimiter(textContent);

    // Parse lines
    const lines = this.parseLines(textContent);
    if (lines.length < 2) {
      throw new Error('File must have at least a header row and one data row');
    }

    // Parse headers and create mapping
    const headers = this.parseLine(lines[0], delimiter);
    const columnMapping = this.suggestColumnMapping(headers);

    // Validate we have a feedback text column
    if (!columnMapping.feedbackText) {
      // Try to find the most likely feedback column
      const longestTextColumn = this.findLongestTextColumn(headers, lines.slice(1), delimiter);
      if (longestTextColumn) {
        columnMapping.feedbackText = longestTextColumn;
      } else {
        throw new Error('Could not identify a feedback text column. Please ensure your file has a column for feedback content.');
      }
    }

    // Parse data rows
    const items: ParsedFeedbackItem[] = [];
    const customerIds = new Set<string>();
    const sourceCounts: Record<FeedbackSource, number> = {
      survey: 0,
      support_ticket: 0,
      interview: 0,
      feature_request: 0,
      nps_verbatim: 0,
      email: 0,
      call_transcript: 0,
      other: 0
    };
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const values = this.parseLine(line, delimiter);
      const rawData: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        rawData[header] = values[idx]?.trim() || null;
      });

      // Extract feedback text
      const feedbackText = columnMapping.feedbackText
        ? String(rawData[columnMapping.feedbackText] || '').trim()
        : '';

      if (!feedbackText) continue; // Skip empty feedback

      // Detect source
      let source: FeedbackSource = 'other';
      if (columnMapping.source && rawData[columnMapping.source]) {
        source = this.detectSource(String(rawData[columnMapping.source]));
      } else {
        // Try to detect from filename or content
        source = this.detectSource(options.fileName) || this.detectSource(feedbackText) || 'other';
      }

      // Parse date
      let submittedAt: Date | undefined;
      if (columnMapping.submittedAt && rawData[columnMapping.submittedAt]) {
        const dateValue = rawData[columnMapping.submittedAt];
        const parsed = new Date(String(dateValue));
        if (!isNaN(parsed.getTime())) {
          submittedAt = parsed;
          if (!minDate || parsed < minDate) minDate = parsed;
          if (!maxDate || parsed > maxDate) maxDate = parsed;
        }
      }

      // Extract customer info
      const customerId = columnMapping.customerId
        ? String(rawData[columnMapping.customerId] || '').trim() || undefined
        : undefined;
      const customerName = columnMapping.customerName
        ? String(rawData[columnMapping.customerName] || '').trim() || undefined
        : undefined;
      const customerEmail = columnMapping.customerEmail
        ? String(rawData[columnMapping.customerEmail] || '').trim() || undefined
        : undefined;

      if (customerId || customerName || customerEmail) {
        customerIds.add(customerId || customerName || customerEmail || '');
      }

      // Parse ARR
      let customerArr: number | undefined;
      if (columnMapping.customerArr && rawData[columnMapping.customerArr]) {
        const arrValue = String(rawData[columnMapping.customerArr]).replace(/[$,]/g, '');
        const parsed = parseFloat(arrValue);
        if (!isNaN(parsed)) {
          customerArr = parsed;
        }
      }

      const item: ParsedFeedbackItem = {
        id: uuidv4(),
        text: feedbackText,
        source,
        customerId,
        customerName,
        customerEmail,
        customerSegment: columnMapping.customerSegment
          ? String(rawData[columnMapping.customerSegment] || '').trim() || undefined
          : undefined,
        customerArr,
        respondentName: columnMapping.respondentName
          ? String(rawData[columnMapping.respondentName] || '').trim() || undefined
          : undefined,
        respondentRole: columnMapping.respondentRole
          ? String(rawData[columnMapping.respondentRole] || '').trim() || undefined
          : undefined,
        submittedAt,
        rawData
      };

      items.push(item);
      sourceCounts[source]++;
    }

    const uploadId = uuidv4();

    // Save to database
    if (this.supabase) {
      await this.saveFeedbackUpload({
        id: uploadId,
        userId: options.userId,
        fileName: options.fileName,
        fileType: 'csv',
        status: 'parsed',
        totalItems: items.length,
        customersRepresented: customerIds.size,
        sourceBreakdown: sourceCounts,
        dateRange: {
          start: minDate?.toISOString() || null,
          end: maxDate?.toISOString() || null
        },
        columnMapping,
        createdAt: new Date(),
        parsedAt: new Date()
      });

      // Save individual feedback items
      await this.saveFeedbackItems(uploadId, items);
    }

    return {
      uploadId,
      fileName: options.fileName,
      totalItems: items.length,
      sources: sourceCounts,
      customersRepresented: customerIds.size,
      dateRange: {
        start: minDate,
        end: maxDate
      },
      items,
      columnMapping,
      detectedEncoding
    };
  }

  /**
   * Parse feedback from plain text document
   */
  async parseFeedbackDocument(
    content: string,
    options: {
      fileName: string;
      userId: string;
      source?: FeedbackSource;
    }
  ): Promise<FeedbackParseResult> {
    // Split content into feedback items
    // Use double newlines or numbered lists as separators
    const separatorPatterns = [
      /\n{2,}/,                    // Double newlines
      /\n\d+[\.\)]\s*/,           // Numbered list (1. or 1))
      /\n[-*]\s*/,                // Bullet points
      /---+/,                     // Horizontal rules
    ];

    let feedbackTexts: string[] = [];
    let bestSplit: string[] = [];

    for (const pattern of separatorPatterns) {
      const split = content.split(pattern).filter(t => t.trim().length > 10);
      if (split.length > bestSplit.length) {
        bestSplit = split;
      }
    }

    feedbackTexts = bestSplit.length > 1 ? bestSplit : [content];

    const uploadId = uuidv4();
    const source = options.source || this.detectSource(options.fileName) || 'other';
    const items: ParsedFeedbackItem[] = feedbackTexts.map(text => ({
      id: uuidv4(),
      text: text.trim(),
      source,
      rawData: { original_text: text }
    }));

    const sourceCounts: Record<FeedbackSource, number> = {
      survey: 0, support_ticket: 0, interview: 0, feature_request: 0,
      nps_verbatim: 0, email: 0, call_transcript: 0, other: 0
    };
    sourceCounts[source] = items.length;

    // Save to database
    if (this.supabase) {
      await this.saveFeedbackUpload({
        id: uploadId,
        userId: options.userId,
        fileName: options.fileName,
        fileType: 'document',
        status: 'parsed',
        totalItems: items.length,
        customersRepresented: 0,
        sourceBreakdown: sourceCounts,
        dateRange: { start: null, end: null },
        columnMapping: {},
        createdAt: new Date(),
        parsedAt: new Date()
      });

      await this.saveFeedbackItems(uploadId, items);
    }

    return {
      uploadId,
      fileName: options.fileName,
      totalItems: items.length,
      sources: sourceCounts,
      customersRepresented: 0,
      dateRange: { start: null, end: null },
      items,
      columnMapping: {},
      detectedEncoding: 'UTF-8'
    };
  }

  /**
   * Get feedback upload record
   */
  async getFeedbackUpload(uploadId: string): Promise<FeedbackUploadRecord | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('feedback_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (error || !data) return null;
    return this.mapDbUploadRecord(data);
  }

  /**
   * Get feedback items for an upload
   */
  async getFeedbackItems(uploadId: string): Promise<ParsedFeedbackItem[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('feedback_items')
      .select('*')
      .eq('upload_id', uploadId);

    if (error || !data) return [];
    return data.map(this.mapDbFeedbackItem);
  }

  /**
   * Update upload status
   */
  async updateUploadStatus(
    uploadId: string,
    status: FeedbackUploadRecord['status'],
    errorMessage?: string
  ): Promise<void> {
    if (!this.supabase) return;

    const updates: Record<string, unknown> = { status };
    if (errorMessage) updates.error_message = errorMessage;
    if (status === 'clustered') updates.clustered_at = new Date().toISOString();

    await this.supabase
      .from('feedback_uploads')
      .update(updates)
      .eq('id', uploadId);
  }

  // ============================================
  // Private Methods
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
        if (char === '\r' && content[i + 1] === '\n') i++;
        if (currentLine.trim()) lines.push(currentLine);
        currentLine = '';
      } else {
        currentLine += char;
      }
    }

    if (currentLine.trim()) lines.push(currentLine);
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

  private suggestColumnMapping(headers: string[]): FeedbackColumnMapping {
    const mapping: FeedbackColumnMapping = {};

    for (const header of headers) {
      for (const [field, patterns] of Object.entries(FEEDBACK_FIELD_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(header)) {
            mapping[field] = header;
            break;
          }
        }
        if (mapping[field]) break;
      }
    }

    return mapping;
  }

  private findLongestTextColumn(
    headers: string[],
    dataLines: string[],
    delimiter: string
  ): string | null {
    const avgLengths: Record<string, number> = {};

    for (const header of headers) {
      avgLengths[header] = 0;
    }

    const sampleSize = Math.min(10, dataLines.length);
    for (let i = 0; i < sampleSize; i++) {
      const values = this.parseLine(dataLines[i], delimiter);
      headers.forEach((header, idx) => {
        avgLengths[header] += (values[idx]?.length || 0) / sampleSize;
      });
    }

    // Find column with longest average text
    let bestColumn: string | null = null;
    let maxLength = 30; // Minimum threshold for feedback text

    for (const [header, avgLen] of Object.entries(avgLengths)) {
      if (avgLen > maxLength) {
        maxLength = avgLen;
        bestColumn = header;
      }
    }

    return bestColumn;
  }

  private detectSource(text: string): FeedbackSource {
    for (const { pattern, source } of SOURCE_PATTERNS) {
      if (pattern.test(text)) {
        return source;
      }
    }
    return 'other';
  }

  private async saveFeedbackUpload(record: FeedbackUploadRecord): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('feedback_uploads').insert({
      id: record.id,
      user_id: record.userId,
      file_name: record.fileName,
      file_type: record.fileType,
      status: record.status,
      total_items: record.totalItems,
      customers_represented: record.customersRepresented,
      source_breakdown: record.sourceBreakdown,
      date_range: record.dateRange,
      column_mapping: record.columnMapping,
      created_at: record.createdAt.toISOString(),
      parsed_at: record.parsedAt?.toISOString()
    });
  }

  private async saveFeedbackItems(uploadId: string, items: ParsedFeedbackItem[]): Promise<void> {
    if (!this.supabase || items.length === 0) return;

    const records = items.map(item => ({
      id: item.id,
      upload_id: uploadId,
      text: item.text,
      source: item.source,
      customer_id: item.customerId,
      customer_name: item.customerName,
      customer_email: item.customerEmail,
      customer_segment: item.customerSegment,
      customer_arr: item.customerArr,
      respondent_name: item.respondentName,
      respondent_role: item.respondentRole,
      submitted_at: item.submittedAt?.toISOString(),
      raw_data: item.rawData
    }));

    // Batch insert
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await this.supabase.from('feedback_items').insert(batch);
    }
  }

  private mapDbUploadRecord(data: Record<string, unknown>): FeedbackUploadRecord {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      fileName: data.file_name as string,
      fileType: data.file_type as string,
      status: data.status as FeedbackUploadRecord['status'],
      totalItems: data.total_items as number,
      customersRepresented: data.customers_represented as number,
      sourceBreakdown: data.source_breakdown as Record<FeedbackSource, number>,
      dateRange: data.date_range as { start: string | null; end: string | null },
      columnMapping: data.column_mapping as FeedbackColumnMapping,
      errorMessage: data.error_message as string | undefined,
      createdAt: new Date(data.created_at as string),
      parsedAt: data.parsed_at ? new Date(data.parsed_at as string) : undefined,
      clusteredAt: data.clustered_at ? new Date(data.clustered_at as string) : undefined
    };
  }

  private mapDbFeedbackItem(data: Record<string, unknown>): ParsedFeedbackItem {
    return {
      id: data.id as string,
      text: data.text as string,
      source: data.source as FeedbackSource,
      customerId: data.customer_id as string | undefined,
      customerName: data.customer_name as string | undefined,
      customerEmail: data.customer_email as string | undefined,
      customerSegment: data.customer_segment as string | undefined,
      customerArr: data.customer_arr as number | undefined,
      respondentName: data.respondent_name as string | undefined,
      respondentRole: data.respondent_role as string | undefined,
      submittedAt: data.submitted_at ? new Date(data.submitted_at as string) : undefined,
      rawData: data.raw_data as Record<string, unknown>
    };
  }
}

// Singleton instance
export const feedbackParser = new FeedbackParserService();
export default feedbackParser;
