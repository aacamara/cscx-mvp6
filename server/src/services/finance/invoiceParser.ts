/**
 * CSCX.AI Invoice Parser Service
 * PRD-015: Invoice History Upload -> Payment Pattern Analysis
 *
 * Parses invoice data exports (CSV, Excel) for payment pattern analysis.
 * Supports various billing system formats with automatic column detection.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import * as XLSX from 'xlsx';

// ============================================
// Types
// ============================================

export interface ParsedInvoiceData {
  fileId: string;
  fileName: string;
  fileType: 'csv' | 'xlsx';

  // Statistics
  totalInvoices: number;
  customerCount: number;
  dateRange: {
    start: string;
    end: string;
    months: number;
  };
  totalInvoiced: number;
  totalCollected: number;

  // Column mapping
  columnMapping: InvoiceColumnMapping;
  suggestedMappings: SuggestedMapping[];
  unmappedColumns: string[];

  // Data
  invoices: InvoiceRecord[];
  previewData: InvoiceRecord[];

  // Validation
  validationErrors: ValidationError[];
  warnings: string[];
}

export interface InvoiceColumnMapping {
  invoiceId?: string;
  customerId?: string;
  customerName?: string;
  amount?: string;
  amountPaid?: string;
  invoiceDate?: string;
  dueDate?: string;
  paidDate?: string;
  status?: string;
  currency?: string;
  description?: string;
}

export interface SuggestedMapping {
  column: string;
  suggestedField: keyof InvoiceColumnMapping;
  confidence: number;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface InvoiceRecord {
  id: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  currency: string;
  invoiceDate: string;
  dueDate: string;
  paidDate?: string;
  status: 'paid' | 'pending' | 'overdue' | 'partial' | 'disputed' | 'voided';
  daysToPay?: number;
  daysOverdue?: number;
  description?: string;
  sourceRow: number;
}

// Column pattern matchers for auto-detection
const COLUMN_PATTERNS: Record<keyof InvoiceColumnMapping, RegExp[]> = {
  invoiceId: [
    /^(invoice[\s_-]?)?(id|number|#|num|no)$/i,
    /^doc[\s_-]?(number|#|id)$/i,
    /^inv[\s_-]?(no|#|id|number)$/i,
    /^reference$/i
  ],
  customerId: [
    /^(customer|account|client)[\s_-]?(id|number|#|code)$/i,
    /^acct[\s_-]?(id|num)?$/i
  ],
  customerName: [
    /^(customer|account|client|company)[\s_-]?name$/i,
    /^name$/i,
    /^company$/i,
    /^account$/i,
    /^client$/i,
    /^bill[\s_-]?to$/i
  ],
  amount: [
    /^(invoice[\s_-]?)?(amount|total|value)$/i,
    /^(total[\s_-]?)?(amount|due|billed)$/i,
    /^gross[\s_-]?amount$/i,
    /^amount[\s_-]?due$/i
  ],
  amountPaid: [
    /^(amount[\s_-]?)?paid$/i,
    /^payment[\s_-]?amount$/i,
    /^received$/i,
    /^collected$/i
  ],
  invoiceDate: [
    /^invoice[\s_-]?date$/i,
    /^(created|posted|issued)[\s_-]?(date|at)?$/i,
    /^billing[\s_-]?date$/i,
    /^date$/i
  ],
  dueDate: [
    /^due[\s_-]?date$/i,
    /^payment[\s_-]?due[\s_-]?(date)?$/i,
    /^(net[\s_-]?)?terms[\s_-]?date$/i,
    /^pay[\s_-]?by$/i
  ],
  paidDate: [
    /^(paid|payment)[\s_-]?date$/i,
    /^date[\s_-]?paid$/i,
    /^received[\s_-]?date$/i,
    /^cleared[\s_-]?date$/i
  ],
  status: [
    /^(status|state|payment[\s_-]?status|invoice[\s_-]?status)$/i,
    /^(paid|payment)[\s_-]?(status)?$/i
  ],
  currency: [
    /^(currency|curr)$/i,
    /^(currency[\s_-]?)?code$/i
  ],
  description: [
    /^(description|desc|memo|notes?)$/i,
    /^(line[\s_-]?)?item$/i,
    /^details?$/i
  ]
};

// Currency detection patterns
const CURRENCY_PATTERNS: Record<string, RegExp> = {
  USD: /^\$|USD/i,
  EUR: /^\u20AC|EUR/i,
  GBP: /^\u00A3|GBP/i,
  JPY: /^\u00A5|JPY/i,
  CAD: /CAD/i,
  AUD: /AUD/i
};

class InvoiceParserService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Main Parsing Methods
  // ============================================

  /**
   * Parse invoice data from file buffer
   */
  async parseInvoiceData(
    content: Buffer,
    fileName: string,
    options: {
      fileType?: 'csv' | 'xlsx';
      existingMapping?: InvoiceColumnMapping;
    } = {}
  ): Promise<ParsedInvoiceData> {
    const fileType = options.fileType || this.detectFileType(fileName);
    const fileId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Parse based on file type
    let rawRows: Record<string, any>[];
    let headers: string[];

    if (fileType === 'xlsx') {
      const result = this.parseExcel(content);
      rawRows = result.rows;
      headers = result.headers;
    } else {
      const result = this.parseCSV(content);
      rawRows = result.rows;
      headers = result.headers;
    }

    // Suggest column mappings
    const suggestedMappings = this.suggestColumnMappings(headers);
    const columnMapping = options.existingMapping || this.createMappingFromSuggestions(suggestedMappings);

    // Find unmapped columns
    const mappedColumns = Object.values(columnMapping).filter(Boolean);
    const unmappedColumns = headers.filter(h => !mappedColumns.includes(h));

    // Detect currency
    const detectedCurrency = this.detectCurrency(rawRows, columnMapping);

    // Parse invoices
    const { invoices, validationErrors, warnings } = this.parseInvoices(
      rawRows,
      columnMapping,
      detectedCurrency
    );

    // Calculate statistics
    const uniqueCustomers = new Set(invoices.map(i => i.customerId || i.customerName));
    const dates = invoices
      .map(i => new Date(i.invoiceDate))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const startDate = dates[0] || new Date();
    const endDate = dates[dates.length - 1] || new Date();
    const months = this.monthsBetween(startDate, endDate);

    const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
    const totalCollected = invoices.reduce((sum, i) => sum + i.amountPaid, 0);

    return {
      fileId,
      fileName,
      fileType,
      totalInvoices: invoices.length,
      customerCount: uniqueCustomers.size,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        months
      },
      totalInvoiced,
      totalCollected,
      columnMapping,
      suggestedMappings,
      unmappedColumns,
      invoices,
      previewData: invoices.slice(0, 10),
      validationErrors,
      warnings
    };
  }

  /**
   * Parse CSV content
   */
  private parseCSV(content: Buffer): { headers: string[]; rows: Record<string, any>[] } {
    let textContent: string;

    // Try UTF-8 first, then fall back to latin1
    try {
      textContent = content.toString('utf-8');
      if (textContent.includes('\uFFFD')) {
        textContent = content.toString('latin1');
      }
    } catch {
      textContent = content.toString('latin1');
    }

    // Remove BOM
    if (textContent.charCodeAt(0) === 0xFEFF) {
      textContent = textContent.slice(1);
    }

    // Detect delimiter
    const delimiter = this.detectDelimiter(textContent);

    // Parse lines
    const lines = this.parseLines(textContent);
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = this.parseLine(lines[0], delimiter);
    const rows: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;

      const values = this.parseLine(lines[i], delimiter);
      const row: Record<string, any> = { _rowNumber: i + 1 };

      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });

      rows.push(row);
    }

    return { headers, rows };
  }

  /**
   * Parse Excel content
   */
  private parseExcel(content: Buffer): { headers: string[]; rows: Record<string, any>[] } {
    const workbook = XLSX.read(content, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (jsonData.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = (jsonData[0] || []).map(h => String(h || '').trim());
    const rows: Record<string, any>[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      const rowData = jsonData[i];
      if (!rowData || rowData.every(cell => cell === null || cell === undefined || cell === '')) {
        continue;
      }

      const row: Record<string, any> = { _rowNumber: i + 1 };
      headers.forEach((header, index) => {
        let value = rowData[index];
        // Handle dates from Excel
        if (value instanceof Date) {
          value = value.toISOString().split('T')[0];
        }
        row[header] = value ?? '';
      });

      rows.push(row);
    }

    return { headers, rows };
  }

  // ============================================
  // Mapping Detection
  // ============================================

  /**
   * Suggest column mappings based on headers
   */
  private suggestColumnMappings(headers: string[]): SuggestedMapping[] {
    const suggestions: SuggestedMapping[] = [];

    for (const header of headers) {
      let bestMatch: { field: keyof InvoiceColumnMapping; confidence: number } | null = null;

      for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(header)) {
            // Exact match = high confidence, partial = lower
            const confidence = pattern.source.includes('^') && pattern.source.includes('$') ? 0.95 : 0.75;
            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = { field: field as keyof InvoiceColumnMapping, confidence };
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
   * Create mapping from suggestions
   */
  private createMappingFromSuggestions(suggestions: SuggestedMapping[]): InvoiceColumnMapping {
    const mapping: InvoiceColumnMapping = {};

    // Sort by confidence descending, then take first for each field
    const sortedSuggestions = [...suggestions].sort((a, b) => b.confidence - a.confidence);
    const usedFields = new Set<string>();

    for (const suggestion of sortedSuggestions) {
      if (suggestion.confidence >= 0.7 && !usedFields.has(suggestion.suggestedField)) {
        mapping[suggestion.suggestedField] = suggestion.column;
        usedFields.add(suggestion.suggestedField);
      }
    }

    return mapping;
  }

  // ============================================
  // Invoice Parsing
  // ============================================

  /**
   * Parse invoices from raw rows
   */
  private parseInvoices(
    rows: Record<string, any>[],
    mapping: InvoiceColumnMapping,
    defaultCurrency: string
  ): {
    invoices: InvoiceRecord[];
    validationErrors: ValidationError[];
    warnings: string[];
  } {
    const invoices: InvoiceRecord[] = [];
    const validationErrors: ValidationError[] = [];
    const warnings: string[] = [];

    for (const row of rows) {
      const rowNumber = row._rowNumber || 0;

      // Extract values using mapping
      const invoiceId = this.getValue(row, mapping.invoiceId);
      const customerId = this.getValue(row, mapping.customerId);
      const customerName = this.getValue(row, mapping.customerName) || customerId;
      const amountStr = this.getValue(row, mapping.amount);
      const amountPaidStr = this.getValue(row, mapping.amountPaid);
      const invoiceDateStr = this.getValue(row, mapping.invoiceDate);
      const dueDateStr = this.getValue(row, mapping.dueDate);
      const paidDateStr = this.getValue(row, mapping.paidDate);
      const statusStr = this.getValue(row, mapping.status);
      const currency = this.getValue(row, mapping.currency) || defaultCurrency;
      const description = this.getValue(row, mapping.description);

      // Validate required fields
      if (!customerName && !customerId) {
        validationErrors.push({
          row: rowNumber,
          column: mapping.customerName || 'customer',
          message: 'Missing customer identifier',
          severity: 'error'
        });
        continue;
      }

      // Parse amount
      const amount = this.parseAmount(amountStr);
      if (amount === null) {
        validationErrors.push({
          row: rowNumber,
          column: mapping.amount || 'amount',
          message: `Invalid amount: "${amountStr}"`,
          severity: 'error'
        });
        continue;
      }

      // Parse dates
      const invoiceDate = this.parseDate(invoiceDateStr);
      const dueDate = this.parseDate(dueDateStr);
      const paidDate = this.parseDate(paidDateStr);

      if (!invoiceDate) {
        validationErrors.push({
          row: rowNumber,
          column: mapping.invoiceDate || 'invoice_date',
          message: `Invalid invoice date: "${invoiceDateStr}"`,
          severity: 'warning'
        });
      }

      // Parse amount paid (default to 0 or full amount based on status)
      const amountPaid = this.parseAmount(amountPaidStr) ?? (paidDate ? amount : 0);

      // Determine status
      const status = this.parseInvoiceStatus(statusStr, amount, amountPaid, dueDate, paidDate);

      // Calculate days to pay
      let daysToPay: number | undefined;
      if (paidDate && invoiceDate) {
        const invoiceDateObj = new Date(invoiceDate);
        const paidDateObj = new Date(paidDate);
        daysToPay = Math.floor((paidDateObj.getTime() - invoiceDateObj.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Calculate days overdue
      let daysOverdue: number | undefined;
      if (status !== 'paid' && status !== 'voided' && dueDate) {
        const dueDateObj = new Date(dueDate);
        const today = new Date();
        const diff = Math.floor((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 0) daysOverdue = diff;
      }

      invoices.push({
        id: invoiceId || `inv-${rowNumber}-${Date.now()}`,
        customerId: customerId || this.generateCustomerId(customerName),
        customerName: customerName || customerId,
        invoiceNumber: invoiceId || `INV-${rowNumber}`,
        amount: Math.abs(amount),
        amountPaid: Math.abs(amountPaid),
        currency,
        invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
        dueDate: dueDate || invoiceDate || new Date().toISOString().split('T')[0],
        paidDate: paidDate || undefined,
        status,
        daysToPay,
        daysOverdue,
        description: description || undefined,
        sourceRow: rowNumber
      });
    }

    // Add warnings for potential issues
    if (invoices.length > 0 && !mapping.customerId && !mapping.customerName) {
      warnings.push('No customer column detected. Please verify customer mapping.');
    }
    if (!mapping.amount) {
      warnings.push('No amount column detected. Please verify amount mapping.');
    }
    if (!mapping.dueDate) {
      warnings.push('No due date column detected. Payment timing analysis may be limited.');
    }
    if (!mapping.paidDate) {
      warnings.push('No paid date column detected. Days-to-pay calculation may be inaccurate.');
    }

    return { invoices, validationErrors, warnings };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private detectFileType(fileName: string): 'csv' | 'xlsx' {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    return 'csv';
  }

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

  private getValue(row: Record<string, any>, column?: string): string {
    if (!column) return '';
    const value = row[column];
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private parseAmount(value: string): number | null {
    if (!value || value.trim() === '') return null;

    // Remove currency symbols and whitespace
    let cleaned = value.replace(/[$\u20AC\u00A3\u00A5,\s]/g, '');

    // Handle parentheses for negative numbers
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1);
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  private parseDate(value: string): string | null {
    if (!value || value.trim() === '') return null;

    // Try various date formats
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    // Try MM/DD/YYYY format
    const parts = value.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const [a, b, c] = parts.map(p => parseInt(p, 10));
      // MM/DD/YYYY
      if (a <= 12 && b <= 31 && c >= 1900) {
        return new Date(c, a - 1, b).toISOString().split('T')[0];
      }
      // DD/MM/YYYY
      if (b <= 12 && a <= 31 && c >= 1900) {
        return new Date(c, b - 1, a).toISOString().split('T')[0];
      }
      // YYYY/MM/DD
      if (a >= 1900) {
        return new Date(a, b - 1, c).toISOString().split('T')[0];
      }
    }

    return null;
  }

  private parseInvoiceStatus(
    statusStr: string,
    amount: number,
    amountPaid: number,
    dueDate: string | null,
    paidDate: string | null
  ): InvoiceRecord['status'] {
    const lower = statusStr.toLowerCase();

    if (lower.includes('paid') || lower.includes('settled') || lower.includes('closed')) {
      return 'paid';
    }
    if (lower.includes('dispute') || lower.includes('contested')) {
      return 'disputed';
    }
    if (lower.includes('void') || lower.includes('cancel')) {
      return 'voided';
    }
    if (lower.includes('partial')) {
      return 'partial';
    }
    if (lower.includes('overdue') || lower.includes('past due')) {
      return 'overdue';
    }

    // Infer from data
    if (paidDate || amountPaid >= amount) {
      return 'paid';
    }

    if (amountPaid > 0 && amountPaid < amount) {
      return 'partial';
    }

    if (dueDate) {
      const dueDateObj = new Date(dueDate);
      if (!isNaN(dueDateObj.getTime()) && dueDateObj < new Date()) {
        return 'overdue';
      }
    }

    return 'pending';
  }

  private detectCurrency(rows: Record<string, any>[], mapping: InvoiceColumnMapping): string {
    // First check if there's a currency column
    if (mapping.currency) {
      for (const row of rows.slice(0, 10)) {
        const currency = this.getValue(row, mapping.currency);
        if (currency && currency.length === 3) {
          return currency.toUpperCase();
        }
      }
    }

    // Check amount column for currency symbols
    if (mapping.amount) {
      for (const row of rows.slice(0, 10)) {
        const amount = this.getValue(row, mapping.amount);
        for (const [currency, pattern] of Object.entries(CURRENCY_PATTERNS)) {
          if (pattern.test(amount)) {
            return currency;
          }
        }
      }
    }

    return 'USD';
  }

  private monthsBetween(start: Date, end: Date): number {
    const months = (end.getFullYear() - start.getFullYear()) * 12;
    return months - start.getMonth() + end.getMonth() + 1;
  }

  private generateCustomerId(name: string): string {
    return `cust-${name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20)}`;
  }

  // ============================================
  // Database Operations
  // ============================================

  /**
   * Save parsed invoice data to database
   */
  async saveInvoiceUpload(
    userId: string,
    parsedData: ParsedInvoiceData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: true }; // In-memory mode
    }

    try {
      const { error } = await (this.supabase as any)
        .from('invoice_uploads')
        .insert({
          id: parsedData.fileId,
          user_id: userId,
          file_name: parsedData.fileName,
          file_type: parsedData.fileType,
          total_invoices: parsedData.totalInvoices,
          customer_count: parsedData.customerCount,
          date_range_start: parsedData.dateRange.start,
          date_range_end: parsedData.dateRange.end,
          total_invoiced: parsedData.totalInvoiced,
          total_collected: parsedData.totalCollected,
          column_mapping: parsedData.columnMapping,
          validation_errors: parsedData.validationErrors,
          warnings: parsedData.warnings,
          status: 'parsed',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Save invoices in batches
      const batchSize = 100;
      for (let i = 0; i < parsedData.invoices.length; i += batchSize) {
        const batch = parsedData.invoices.slice(i, i + batchSize).map(inv => ({
          id: inv.id,
          upload_id: parsedData.fileId,
          customer_id: inv.customerId,
          customer_name: inv.customerName,
          invoice_number: inv.invoiceNumber,
          amount: inv.amount,
          amount_paid: inv.amountPaid,
          currency: inv.currency,
          invoice_date: inv.invoiceDate,
          due_date: inv.dueDate,
          paid_date: inv.paidDate,
          status: inv.status,
          days_to_pay: inv.daysToPay,
          days_overdue: inv.daysOverdue,
          description: inv.description,
          source_row: inv.sourceRow
        }));

        const { error: invError } = await (this.supabase as any)
          .from('invoice_records')
          .insert(batch);

        if (invError) {
          console.error('Error saving invoice batch:', invError);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving invoice upload:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save invoice data'
      };
    }
  }

  /**
   * Get parsed invoice data by file ID
   */
  async getInvoiceUpload(fileId: string): Promise<ParsedInvoiceData | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await (this.supabase as any)
        .from('invoice_uploads')
        .select('*')
        .eq('id', fileId)
        .single();

      if (error || !data) return null;

      // Get invoices
      const { data: invoices } = await (this.supabase as any)
        .from('invoice_records')
        .select('*')
        .eq('upload_id', fileId)
        .order('invoice_date', { ascending: false });

      return {
        fileId: data.id,
        fileName: data.file_name,
        fileType: data.file_type,
        totalInvoices: data.total_invoices,
        customerCount: data.customer_count,
        dateRange: {
          start: data.date_range_start,
          end: data.date_range_end,
          months: this.monthsBetween(new Date(data.date_range_start), new Date(data.date_range_end))
        },
        totalInvoiced: data.total_invoiced,
        totalCollected: data.total_collected,
        columnMapping: data.column_mapping || {},
        suggestedMappings: [],
        unmappedColumns: [],
        invoices: (invoices || []).map((inv: any) => ({
          id: inv.id,
          customerId: inv.customer_id,
          customerName: inv.customer_name,
          invoiceNumber: inv.invoice_number,
          amount: inv.amount,
          amountPaid: inv.amount_paid,
          currency: inv.currency,
          invoiceDate: inv.invoice_date,
          dueDate: inv.due_date,
          paidDate: inv.paid_date,
          status: inv.status,
          daysToPay: inv.days_to_pay,
          daysOverdue: inv.days_overdue,
          description: inv.description,
          sourceRow: inv.source_row
        })),
        previewData: [],
        validationErrors: data.validation_errors || [],
        warnings: data.warnings || []
      };
    } catch (error) {
      console.error('Error fetching invoice upload:', error);
      return null;
    }
  }
}

// Export singleton instance
export const invoiceParser = new InvoiceParserService();
export default invoiceParser;
