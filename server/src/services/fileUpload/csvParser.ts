/**
 * CSV Parser Service
 * Parses, validates, and processes CSV file uploads for churn analysis
 *
 * Features:
 * - Automatic encoding detection (UTF-8, ISO-8859-1, etc.)
 * - Header detection and smart column mapping
 * - Data validation and type inference
 * - Preview generation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Types
export interface ParsedCSV {
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
  columnCount: number;
  detectedEncoding: string;
  columnTypes: Record<string, ColumnType>;
}

export interface ColumnType {
  type: 'string' | 'number' | 'date' | 'email' | 'percentage' | 'boolean';
  nullable: boolean;
  sampleValues: any[];
}

export interface ColumnMapping {
  customerName?: string;
  customerEmail?: string;
  monthlyActiveUsers?: string;
  loginFrequency?: string;
  lastLoginDate?: string;
  supportTickets?: string;
  healthScore?: string;
  arr?: string;
  usageScore?: string;
  npsScore?: string;
  [key: string]: string | undefined;
}

export interface SuggestedMapping {
  column: string;
  suggestedField: string;
  confidence: number;
}

export interface UploadedFileRecord {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  status: 'pending' | 'parsing' | 'parsed' | 'analyzed' | 'failed';
  rowCount: number;
  columnCount: number;
  headers: string[];
  columnMapping: ColumnMapping;
  previewData: Record<string, any>[];
  detectedEncoding: string;
  errorMessage?: string;
  createdAt: Date;
  parsedAt?: Date;
}

// Known field patterns for auto-mapping
const FIELD_PATTERNS: Record<string, RegExp[]> = {
  customerName: [
    /^(customer|company|account|client)[\s_-]?name$/i,
    /^name$/i,
    /^company$/i,
    /^account$/i
  ],
  customerEmail: [
    /^(customer|contact|primary)[\s_-]?email$/i,
    /^email[\s_-]?(address)?$/i,
    /^e-?mail$/i
  ],
  monthlyActiveUsers: [
    /^(monthly[\s_-]?)?active[\s_-]?users?$/i,
    /^mau$/i,
    /^active[\s_-]?user[\s_-]?count$/i,
    /^users?$/i
  ],
  loginFrequency: [
    /^login[\s_-]?(frequency|count|times?)$/i,
    /^logins?[\s_-]?(per[\s_-]?(month|week))?$/i,
    /^session[\s_-]?count$/i
  ],
  lastLoginDate: [
    /^last[\s_-]?(login|active|seen)[\s_-]?(date|at)?$/i,
    /^last[\s_-]?activity$/i,
    /^last[\s_-]?session$/i
  ],
  supportTickets: [
    /^(support[\s_-]?)?(tickets?|cases?|issues?)[\s_-]?(count|open)?$/i,
    /^open[\s_-]?tickets?$/i,
    /^support[\s_-]?requests?$/i
  ],
  healthScore: [
    /^health[\s_-]?score$/i,
    /^customer[\s_-]?health$/i,
    /^health$/i
  ],
  arr: [
    /^arr$/i,
    /^annual[\s_-]?(recurring[\s_-]?)?revenue$/i,
    /^mrr$/i,
    /^revenue$/i,
    /^contract[\s_-]?value$/i
  ],
  usageScore: [
    /^usage[\s_-]?score$/i,
    /^adoption[\s_-]?score$/i,
    /^utilization$/i
  ],
  npsScore: [
    /^nps[\s_-]?(score)?$/i,
    /^net[\s_-]?promoter[\s_-]?score$/i,
    /^csat$/i,
    /^satisfaction[\s_-]?(score)?$/i
  ],
  daysInactive: [
    /^days?[\s_-]?(since[\s_-]?)?(last[\s_-]?)?(login|active|inactive)$/i,
    /^inactive[\s_-]?days?$/i
  ],
  usageChange: [
    /^usage[\s_-]?(change|trend|delta)$/i,
    /^mau[\s_-]?(change|trend)$/i,
    /^growth[\s_-]?rate$/i
  ]
};

class CSVParserService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Parse CSV content from a string or buffer
   */
  async parseCSV(
    content: string | Buffer,
    options: {
      delimiter?: string;
      encoding?: BufferEncoding;
      hasHeaders?: boolean;
    } = {}
  ): Promise<ParsedCSV> {
    let textContent: string;
    let detectedEncoding = 'UTF-8';

    // Handle buffer or string
    if (Buffer.isBuffer(content)) {
      // Try UTF-8 first, then fall back to latin1 (ISO-8859-1)
      try {
        textContent = content.toString('utf-8');
        // Check for encoding issues (replacement character)
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

    // Remove BOM if present
    if (textContent.charCodeAt(0) === 0xFEFF) {
      textContent = textContent.slice(1);
    }

    // Detect delimiter
    const delimiter = options.delimiter || this.detectDelimiter(textContent);

    // Parse rows
    const lines = this.parseLines(textContent);
    const hasHeaders = options.hasHeaders !== false;

    // Parse headers
    const headerLine = lines[0];
    const headers = this.parseLine(headerLine, delimiter);

    // Parse data rows
    const dataLines = hasHeaders ? lines.slice(1) : lines;
    const rows: Record<string, any>[] = [];

    for (const line of dataLines) {
      if (line.trim() === '') continue;

      const values = this.parseLine(line, delimiter);
      const row: Record<string, any> = {};

      headers.forEach((header, index) => {
        const value = values[index]?.trim() || '';
        row[header] = this.parseValue(value);
      });

      rows.push(row);
    }

    // Detect column types
    const columnTypes = this.detectColumnTypes(headers, rows);

    return {
      headers,
      rows,
      rowCount: rows.length,
      columnCount: headers.length,
      detectedEncoding,
      columnTypes
    };
  }

  /**
   * Detect the most likely delimiter
   */
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

  /**
   * Parse content into lines, handling quoted newlines
   */
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
          i++; // Skip the \n in \r\n
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

  /**
   * Parse a single line into values
   */
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

  /**
   * Parse a value to its appropriate type
   */
  private parseValue(value: string): any {
    if (value === '' || value.toLowerCase() === 'null' || value.toLowerCase() === 'n/a') {
      return null;
    }

    // Boolean
    if (value.toLowerCase() === 'true' || value.toLowerCase() === 'yes') return true;
    if (value.toLowerCase() === 'false' || value.toLowerCase() === 'no') return false;

    // Number (including currency)
    const cleanedNumber = value.replace(/[$,]/g, '');
    if (/^-?\d+\.?\d*$/.test(cleanedNumber)) {
      const num = parseFloat(cleanedNumber);
      return isNaN(num) ? value : num;
    }

    // Percentage
    if (/^-?\d+\.?\d*%$/.test(value)) {
      return parseFloat(value.replace('%', '')) / 100;
    }

    return value;
  }

  /**
   * Detect column types based on values
   */
  private detectColumnTypes(headers: string[], rows: Record<string, any>[]): Record<string, ColumnType> {
    const columnTypes: Record<string, ColumnType> = {};

    for (const header of headers) {
      const values = rows.map(row => row[header]).filter(v => v !== null && v !== undefined);
      const sampleValues = values.slice(0, 5);

      let type: ColumnType['type'] = 'string';
      let nullable = values.length < rows.length;

      // Check for email
      if (values.some(v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) {
        type = 'email';
      }
      // Check for date
      else if (values.every(v => typeof v === 'string' && !isNaN(Date.parse(v)))) {
        type = 'date';
      }
      // Check for number
      else if (values.every(v => typeof v === 'number')) {
        type = 'number';
        // Check if it's a percentage (0-1 range)
        if (values.every(v => v >= 0 && v <= 1)) {
          type = 'percentage';
        }
      }
      // Check for boolean
      else if (values.every(v => typeof v === 'boolean')) {
        type = 'boolean';
      }

      columnTypes[header] = { type, nullable, sampleValues };
    }

    return columnTypes;
  }

  /**
   * Suggest column mappings based on header names
   */
  suggestColumnMappings(headers: string[]): SuggestedMapping[] {
    const suggestions: SuggestedMapping[] = [];

    for (const header of headers) {
      let bestMatch: { field: string; confidence: number } | null = null;

      for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(header)) {
            const confidence = pattern.source.includes('^') && pattern.source.includes('$') ? 0.9 : 0.7;
            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = { field, confidence };
            }
          }
        }
      }

      if (bestMatch) {
        suggestions.push({
          column: header,
          suggestedField: bestMatch.field,
          confidence: bestMatch.confidence
        });
      }
    }

    return suggestions;
  }

  /**
   * Create column mapping from suggestions
   */
  createMappingFromSuggestions(suggestions: SuggestedMapping[]): ColumnMapping {
    const mapping: ColumnMapping = {};

    // Only use high-confidence suggestions
    for (const suggestion of suggestions) {
      if (suggestion.confidence >= 0.7) {
        mapping[suggestion.suggestedField] = suggestion.column;
      }
    }

    return mapping;
  }

  /**
   * Save uploaded file record to database
   */
  async saveUploadedFile(
    userId: string,
    fileName: string,
    content: string | Buffer,
    options: { customerId?: string } = {}
  ): Promise<UploadedFileRecord> {
    // Parse the CSV
    const parsed = await this.parseCSV(content);

    // Suggest mappings
    const suggestions = this.suggestColumnMappings(parsed.headers);
    const columnMapping = this.createMappingFromSuggestions(suggestions);

    // Create preview (first 10 rows)
    const previewData = parsed.rows.slice(0, 10);

    // Calculate file size
    const fileSize = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, 'utf-8');

    if (!this.supabase) {
      // Return in-memory record for testing
      const record: UploadedFileRecord = {
        id: `temp-${Date.now()}`,
        userId,
        fileName,
        fileType: 'csv',
        status: 'parsed',
        rowCount: parsed.rowCount,
        columnCount: parsed.columnCount,
        headers: parsed.headers,
        columnMapping,
        previewData,
        detectedEncoding: parsed.detectedEncoding,
        createdAt: new Date(),
        parsedAt: new Date()
      };
      return record;
    }

    // Save to database
    const { data, error } = await (this.supabase as any)
      .from('uploaded_files')
      .insert({
        user_id: userId,
        customer_id: options.customerId,
        file_name: fileName,
        file_type: 'csv',
        file_size: fileSize,
        mime_type: 'text/csv',
        status: 'parsed',
        row_count: parsed.rowCount,
        column_count: parsed.columnCount,
        headers: parsed.headers,
        column_mapping: columnMapping,
        preview_data: previewData,
        detected_encoding: parsed.detectedEncoding,
        parsed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save uploaded file: ${error.message}`);
    }

    return this.mapToUploadedFileRecord(data);
  }

  /**
   * Get uploaded file by ID
   */
  async getUploadedFile(fileId: string): Promise<UploadedFileRecord | null> {
    if (!this.supabase) return null;

    const { data, error } = await (this.supabase as any)
      .from('uploaded_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error || !data) return null;

    return this.mapToUploadedFileRecord(data);
  }

  /**
   * Update column mapping for a file
   */
  async updateColumnMapping(fileId: string, mapping: ColumnMapping): Promise<void> {
    if (!this.supabase) return;

    const { error } = await (this.supabase as any)
      .from('uploaded_files')
      .update({ column_mapping: mapping })
      .eq('id', fileId);

    if (error) {
      throw new Error(`Failed to update column mapping: ${error.message}`);
    }
  }

  /**
   * Update file status
   */
  async updateFileStatus(
    fileId: string,
    status: UploadedFileRecord['status'],
    errorMessage?: string
  ): Promise<void> {
    if (!this.supabase) return;

    const updates: any = { status };
    if (errorMessage) {
      updates.error_message = errorMessage;
    }
    if (status === 'analyzed') {
      updates.analyzed_at = new Date().toISOString();
    }

    const { error } = await (this.supabase as any)
      .from('uploaded_files')
      .update(updates)
      .eq('id', fileId);

    if (error) {
      throw new Error(`Failed to update file status: ${error.message}`);
    }
  }

  /**
   * Get all rows from an uploaded file
   */
  async getFileRows(fileId: string, content: string | Buffer): Promise<Record<string, any>[]> {
    const parsed = await this.parseCSV(content);
    return parsed.rows;
  }

  /**
   * Map database row to record type
   */
  private mapToUploadedFileRecord(data: any): UploadedFileRecord {
    return {
      id: data.id,
      userId: data.user_id,
      fileName: data.file_name,
      fileType: data.file_type,
      status: data.status,
      rowCount: data.row_count,
      columnCount: data.column_count,
      headers: data.headers || [],
      columnMapping: data.column_mapping || {},
      previewData: data.preview_data || [],
      detectedEncoding: data.detected_encoding,
      errorMessage: data.error_message,
      createdAt: new Date(data.created_at),
      parsedAt: data.parsed_at ? new Date(data.parsed_at) : undefined
    };
  }

  /**
   * Validate that required fields are mapped
   */
  validateMapping(mapping: ColumnMapping): { valid: boolean; missing: string[] } {
    const required = ['customerName'];
    const missing = required.filter(field => !mapping[field]);

    return {
      valid: missing.length === 0,
      missing
    };
  }
}

// Singleton instance
export const csvParser = new CSVParserService();
export default csvParser;
