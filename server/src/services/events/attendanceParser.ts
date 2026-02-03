/**
 * Event Attendance Parser Service
 * PRD-018: Parse and validate event attendance data uploads
 *
 * Features:
 * - Supports CSV/Excel from common event platforms (Zoom, Hopin, Eventbrite)
 * - Smart column mapping with pattern recognition
 * - Customer record association
 * - Validation and error reporting
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  EventAttendanceRecord,
  EventType,
  AttendanceStatus,
  AttendanceColumnMapping,
  AttendanceFieldSuggestion,
  AttendanceUploadResult,
} from '../../../../types/eventEngagement.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Known field patterns for auto-mapping
const ATTENDANCE_FIELD_PATTERNS: Record<keyof AttendanceColumnMapping, RegExp[]> = {
  customer_name: [
    /^(customer|company|account|organization|org)[\s_-]?name$/i,
    /^company$/i,
    /^account$/i,
    /^organization$/i,
  ],
  customer_id: [
    /^(customer|company|account)[\s_-]?id$/i,
    /^account[\s_-]?number$/i,
  ],
  user_email: [
    /^(user|attendee|participant|registrant)[\s_-]?email$/i,
    /^email[\s_-]?(address)?$/i,
    /^e-?mail$/i,
  ],
  user_name: [
    /^(user|attendee|participant|registrant)[\s_-]?name$/i,
    /^(full[\s_-]?)?name$/i,
    /^first[\s_-]?name$/i,
  ],
  event_name: [
    /^(event|webinar|session|meeting)[\s_-]?name$/i,
    /^(event|webinar|session)[\s_-]?title$/i,
    /^topic$/i,
  ],
  event_type: [
    /^(event|webinar|session)[\s_-]?type$/i,
    /^type$/i,
    /^category$/i,
  ],
  event_date: [
    /^(event|webinar|session)[\s_-]?date$/i,
    /^date$/i,
    /^start[\s_-]?date$/i,
    /^occurred[\s_-]?at$/i,
  ],
  attendance_status: [
    /^(attendance|status|attended)$/i,
    /^(attend|join)[\s_-]?status$/i,
    /^participated$/i,
  ],
  registration_date: [
    /^(registration|registered|signup)[\s_-]?date$/i,
    /^registered[\s_-]?at$/i,
  ],
  duration_minutes: [
    /^(duration|time[\s_-]?in[\s_-]?session)[\s_-]?(minutes|mins?)?$/i,
    /^minutes[\s_-]?attended$/i,
    /^attendance[\s_-]?duration$/i,
  ],
  asked_questions: [
    /^(asked[\s_-]?)?questions?$/i,
    /^q[\s_-]?&[\s_-]?a$/i,
    /^participated[\s_-]?in[\s_-]?q[\s_-]?a$/i,
  ],
  submitted_feedback: [
    /^(submitted[\s_-]?)?feedback$/i,
    /^survey[\s_-]?completed$/i,
    /^post[\s_-]?event[\s_-]?feedback$/i,
  ],
};

// Event type normalization map
const EVENT_TYPE_MAP: Record<string, EventType> = {
  webinar: 'webinar',
  'web seminar': 'webinar',
  'online seminar': 'webinar',
  'user group': 'user_group',
  'usergroup': 'user_group',
  'user meeting': 'user_group',
  'customer advisory': 'user_group',
  training: 'training',
  'training session': 'training',
  workshop: 'workshop',
  'hands-on': 'workshop',
  conference: 'conference',
  summit: 'conference',
  'annual conference': 'conference',
  meetup: 'meetup',
  'meet up': 'meetup',
  networking: 'meetup',
};

// Attendance status normalization map
const ATTENDANCE_STATUS_MAP: Record<string, AttendanceStatus> = {
  attended: 'attended',
  yes: 'attended',
  joined: 'attended',
  present: 'attended',
  '1': 'attended',
  true: 'attended',
  registered: 'registered',
  'no show': 'no_show',
  'no-show': 'no_show',
  noshow: 'no_show',
  absent: 'no_show',
  'did not attend': 'no_show',
  no: 'no_show',
  '0': 'no_show',
  false: 'no_show',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

class AttendanceParserService {
  /**
   * Parse CSV content into attendance records
   */
  async parseCSV(
    content: string | Buffer,
    options: {
      delimiter?: string;
      hasHeaders?: boolean;
      columnMapping?: AttendanceColumnMapping;
    } = {}
  ): Promise<{
    headers: string[];
    rows: Record<string, any>[];
    suggestedMapping: AttendanceFieldSuggestion[];
  }> {
    let textContent: string;

    // Handle buffer or string
    if (Buffer.isBuffer(content)) {
      try {
        textContent = content.toString('utf-8');
        if (textContent.includes('\uFFFD')) {
          textContent = content.toString('latin1');
        }
      } catch {
        textContent = content.toString('latin1');
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

    // Parse lines
    const lines = this.parseLines(textContent);
    const hasHeaders = options.hasHeaders !== false;

    // Parse headers
    const headers = this.parseLine(lines[0], delimiter);

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

    // Suggest column mappings
    const suggestedMapping = this.suggestColumnMappings(headers);

    return { headers, rows, suggestedMapping };
  }

  /**
   * Process parsed attendance data and create records
   */
  async processAttendanceData(
    rows: Record<string, any>[],
    columnMapping: AttendanceColumnMapping,
    userId: string
  ): Promise<AttendanceUploadResult> {
    const result: AttendanceUploadResult = {
      success: true,
      file_id: `att-${Date.now()}`,
      total_records: rows.length,
      unique_users: 0,
      unique_customers: 0,
      unique_events: 0,
      event_type_counts: {
        webinar: 0,
        user_group: 0,
        training: 0,
        conference: 0,
        workshop: 0,
        meetup: 0,
        other: 0,
      },
      date_range: { start: '', end: '' },
      unmapped_customers: 0,
      errors: [],
      warnings: [],
    };

    const uniqueUsers = new Set<string>();
    const uniqueCustomers = new Set<string>();
    const uniqueEvents = new Set<string>();
    const dates: Date[] = [];
    const attendanceRecords: EventAttendanceRecord[] = [];

    // Get customer mapping for association
    const customerMap = await this.getCustomerMapping();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed, account for header

      try {
        // Extract values using column mapping
        const userEmail = this.getValue(row, columnMapping.user_email);
        const userName = this.getValue(row, columnMapping.user_name);
        const eventName = this.getValue(row, columnMapping.event_name);
        const eventDateStr = this.getValue(row, columnMapping.event_date);
        const customerNameRaw = this.getValue(row, columnMapping.customer_name);
        const eventTypeRaw = this.getValue(row, columnMapping.event_type);
        const statusRaw = this.getValue(row, columnMapping.attendance_status);

        // Validate required fields
        if (!userEmail && !userName) {
          result.warnings.push(`Row ${rowNum}: Missing user identifier`);
          continue;
        }

        if (!eventName) {
          result.warnings.push(`Row ${rowNum}: Missing event name`);
          continue;
        }

        // Parse event date
        const eventDate = eventDateStr ? this.parseDate(eventDateStr) : null;
        if (!eventDate) {
          result.warnings.push(`Row ${rowNum}: Invalid or missing event date`);
        } else {
          dates.push(eventDate);
        }

        // Normalize event type
        const eventType = this.normalizeEventType(eventTypeRaw);
        result.event_type_counts[eventType]++;

        // Normalize attendance status
        const attendanceStatus = this.normalizeAttendanceStatus(statusRaw);

        // Try to match customer
        let customerId: string | undefined;
        let customerName = customerNameRaw;

        if (customerNameRaw) {
          // Try exact match first
          customerId = customerMap.get(customerNameRaw.toLowerCase());

          // Try partial match
          if (!customerId) {
            for (const [name, id] of customerMap.entries()) {
              if (name.includes(customerNameRaw.toLowerCase()) ||
                  customerNameRaw.toLowerCase().includes(name)) {
                customerId = id;
                break;
              }
            }
          }

          if (!customerId) {
            result.unmapped_customers++;
            // Try to infer from email domain
            if (userEmail) {
              const domain = userEmail.split('@')[1]?.toLowerCase();
              if (domain) {
                for (const [name, id] of customerMap.entries()) {
                  if (name.includes(domain.split('.')[0])) {
                    customerId = id;
                    customerName = name;
                    break;
                  }
                }
              }
            }
          }
        }

        // Track unique values
        if (userEmail) uniqueUsers.add(userEmail.toLowerCase());
        if (customerName) uniqueCustomers.add(customerName.toLowerCase());
        uniqueEvents.add(eventName.toLowerCase());

        // Create attendance record
        const record: EventAttendanceRecord = {
          id: `rec-${Date.now()}-${i}`,
          event_id: `evt-${eventName.toLowerCase().replace(/\s+/g, '-')}`,
          event_name: eventName,
          event_type: eventType,
          event_date: eventDate?.toISOString() || '',
          customer_id: customerId || '',
          customer_name: customerName || '',
          user_email: userEmail || '',
          user_name: userName || '',
          attendance_status: attendanceStatus,
          registration_date: this.getValue(row, columnMapping.registration_date),
          duration_minutes: this.parseNumber(this.getValue(row, columnMapping.duration_minutes)),
          asked_questions: this.parseBoolean(this.getValue(row, columnMapping.asked_questions)),
          submitted_feedback: this.parseBoolean(this.getValue(row, columnMapping.submitted_feedback)),
          created_at: new Date().toISOString(),
        };

        attendanceRecords.push(record);
      } catch (err) {
        result.errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Calculate date range
    if (dates.length > 0) {
      dates.sort((a, b) => a.getTime() - b.getTime());
      result.date_range.start = dates[0].toISOString().split('T')[0];
      result.date_range.end = dates[dates.length - 1].toISOString().split('T')[0];
    }

    // Set unique counts
    result.unique_users = uniqueUsers.size;
    result.unique_customers = uniqueCustomers.size;
    result.unique_events = uniqueEvents.size;

    // Store records
    await this.storeAttendanceRecords(attendanceRecords, result.file_id, userId);

    result.success = result.errors.length === 0;

    return result;
  }

  /**
   * Get customer name to ID mapping
   */
  private async getCustomerMapping(): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    if (!supabase) {
      // Return mock mapping
      const mockCustomers = [
        { id: 'cust-1', name: 'TechCorp' },
        { id: 'cust-2', name: 'DataPro' },
        { id: 'cust-3', name: 'CloudMax' },
        { id: 'cust-4', name: 'Acme Corp' },
        { id: 'cust-5', name: 'BetaInc' },
      ];
      mockCustomers.forEach(c => map.set(c.name.toLowerCase(), c.id));
      return map;
    }

    const { data: customers } = await supabase
      .from('customers')
      .select('id, name');

    if (customers) {
      customers.forEach(c => {
        if (c.name) {
          map.set(c.name.toLowerCase(), c.id);
        }
      });
    }

    return map;
  }

  /**
   * Store attendance records
   */
  private async storeAttendanceRecords(
    records: EventAttendanceRecord[],
    fileId: string,
    userId: string
  ): Promise<void> {
    if (!supabase) {
      console.log(`[AttendanceParser] Stored ${records.length} records (in-memory)`);
      return;
    }

    // Store in event_attendance table
    const { error } = await supabase
      .from('event_attendance')
      .insert(records.map(r => ({
        ...r,
        file_id: fileId,
        uploaded_by: userId,
      })));

    if (error) {
      console.error('Error storing attendance records:', error);
      throw new Error(`Failed to store attendance records: ${error.message}`);
    }

    console.log(`[AttendanceParser] Stored ${records.length} records`);
  }

  /**
   * Suggest column mappings based on header names
   */
  suggestColumnMappings(headers: string[]): AttendanceFieldSuggestion[] {
    const suggestions: AttendanceFieldSuggestion[] = [];

    for (const header of headers) {
      let bestMatch: { field: keyof AttendanceColumnMapping; confidence: number } | null = null;

      for (const [field, patterns] of Object.entries(ATTENDANCE_FIELD_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(header)) {
            const confidence = pattern.source.includes('^') && pattern.source.includes('$') ? 0.95 : 0.75;
            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = { field: field as keyof AttendanceColumnMapping, confidence };
            }
          }
        }
      }

      if (bestMatch) {
        suggestions.push({
          column: header,
          suggestedField: bestMatch.field,
          confidence: bestMatch.confidence,
        });
      }
    }

    return suggestions;
  }

  // ============================================
  // Helper Methods
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
    return value;
  }

  private getValue(row: Record<string, any>, column?: string): string {
    if (!column) return '';
    return String(row[column] ?? '').trim();
  }

  private parseDate(value: string): Date | null {
    if (!value) return null;

    // Try common date formats
    const formats = [
      // ISO format
      /^\d{4}-\d{2}-\d{2}/,
      // US format
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // EU format
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})/,
    ];

    for (const format of formats) {
      if (format.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Try parsing directly
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  private parseNumber(value: string): number | undefined {
    if (!value) return undefined;
    const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? undefined : num;
  }

  private parseBoolean(value: string): boolean {
    if (!value) return false;
    const lower = value.toLowerCase();
    return ['true', 'yes', '1', 'y'].includes(lower);
  }

  private normalizeEventType(value: string): EventType {
    if (!value) return 'other';
    const lower = value.toLowerCase().trim();
    return EVENT_TYPE_MAP[lower] || 'other';
  }

  private normalizeAttendanceStatus(value: string): AttendanceStatus {
    if (!value) return 'attended';
    const lower = value.toLowerCase().trim();
    return ATTENDANCE_STATUS_MAP[lower] || 'attended';
  }
}

// Export singleton instance
export const attendanceParser = new AttendanceParserService();
export default attendanceParser;
