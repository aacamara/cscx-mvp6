/**
 * CSCX.AI Billing Parser Service
 * PRD-007: Financial Data Upload -> Revenue Analysis
 *
 * Parses financial data exports (CSV, Excel) for revenue analysis.
 * Supports invoice, payment, and billing history formats.
 * Multi-currency support with automatic detection.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import * as XLSX from 'xlsx';

// ============================================
// Types
// ============================================

export interface ParsedFinancialData {
  fileId: string;
  fileName: string;
  fileType: 'csv' | 'xlsx';

  // Detection results
  dataType: 'billing_history' | 'invoices' | 'payments' | 'combined';
  detectedCurrency: string;

  // Statistics
  totalTransactions: number;
  customerCount: number;
  dateRange: {
    start: string;
    end: string;
    months: number;
  };
  totalRevenue: number;

  // Column mapping
  columnMapping: ColumnMapping;
  suggestedMappings: SuggestedMapping[];
  unmappedColumns: string[];

  // Data
  transactions: Transaction[];
  previewData: Transaction[];

  // Validation
  validationErrors: ValidationError[];
  warnings: string[];
}

export interface ColumnMapping {
  customerId?: string;
  customerName?: string;
  amount?: string;
  date?: string;
  dueDate?: string;
  type?: string;
  status?: string;
  invoiceNumber?: string;
  currency?: string;
  description?: string;
}

export interface SuggestedMapping {
  column: string;
  suggestedField: keyof ColumnMapping;
  confidence: number;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  type: 'invoice' | 'payment' | 'credit_memo' | 'refund' | 'adjustment';
  date: string;
  dueDate?: string;
  amount: number;
  currency: string;
  amountPaid?: number;
  status: 'pending' | 'paid' | 'overdue' | 'disputed' | 'voided' | 'partial';
  invoiceNumber?: string;
  description?: string;
  daysOverdue?: number;
  sourceRow: number;
  rawData?: Record<string, unknown>;
}

// Column pattern matchers for auto-detection
const COLUMN_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  customerId: [
    /^(customer|account|client)[\s_-]?(id|number|#|code)$/i,
    /^id$/i,
    /^acct[\s_-]?(id|num)?$/i
  ],
  customerName: [
    /^(customer|account|client|company)[\s_-]?name$/i,
    /^name$/i,
    /^company$/i,
    /^account$/i,
    /^client$/i
  ],
  amount: [
    /^(amount|total|value|sum|price)$/i,
    /^invoice[\s_-]?(amount|total|value)$/i,
    /^payment[\s_-]?(amount)$/i,
    /^(arr|mrr|revenue)$/i,
    /^gross[\s_-]?amount$/i
  ],
  date: [
    /^(date|transaction[\s_-]?date|invoice[\s_-]?date|payment[\s_-]?date)$/i,
    /^(created|posted)[\s_-]?(date|at)?$/i,
    /^period[\s_-]?(start)?$/i,
    /^billing[\s_-]?date$/i
  ],
  dueDate: [
    /^due[\s_-]?date$/i,
    /^payment[\s_-]?due[\s_-]?(date)?$/i,
    /^(net[\s_-]?)?terms[\s_-]?date$/i
  ],
  type: [
    /^(type|transaction[\s_-]?type|line[\s_-]?type)$/i,
    /^(category|classification)$/i,
    /^doc[\s_-]?type$/i
  ],
  status: [
    /^(status|state|payment[\s_-]?status|invoice[\s_-]?status)$/i,
    /^(paid|payment)[\s_-]?(status)?$/i
  ],
  invoiceNumber: [
    /^(invoice[\s_-]?)?(number|#|num|no|id)$/i,
    /^doc[\s_-]?(number|#|id)$/i,
    /^reference$/i
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

class BillingParserService {
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
   * Parse financial data from file buffer
   */
  async parseFinancialData(
    content: Buffer,
    fileName: string,
    options: {
      fileType?: 'csv' | 'xlsx';
      existingMapping?: ColumnMapping;
    } = {}
  ): Promise<ParsedFinancialData> {
    const fileType = options.fileType || this.detectFileType(fileName);
    const fileId = `fin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

    // Parse transactions
    const { transactions, validationErrors, warnings } = this.parseTransactions(
      rawRows,
      columnMapping,
      detectedCurrency
    );

    // Calculate statistics
    const uniqueCustomers = new Set(transactions.map(t => t.customerId || t.customerName));
    const dates = transactions
      .map(t => new Date(t.date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const startDate = dates[0] || new Date();
    const endDate = dates[dates.length - 1] || new Date();
    const months = this.monthsBetween(startDate, endDate);

    const totalRevenue = transactions
      .filter(t => t.type === 'invoice' || t.type === 'payment')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Detect data type
    const dataType = this.detectDataType(transactions);

    return {
      fileId,
      fileName,
      fileType,
      dataType,
      detectedCurrency,
      totalTransactions: transactions.length,
      customerCount: uniqueCustomers.size,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        months
      },
      totalRevenue,
      columnMapping,
      suggestedMappings,
      unmappedColumns,
      transactions,
      previewData: transactions.slice(0, 10),
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
      let bestMatch: { field: keyof ColumnMapping; confidence: number } | null = null;

      for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(header)) {
            // Exact match = high confidence, partial = lower
            const confidence = pattern.source.includes('^') && pattern.source.includes('$') ? 0.95 : 0.75;
            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = { field: field as keyof ColumnMapping, confidence };
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
  private createMappingFromSuggestions(suggestions: SuggestedMapping[]): ColumnMapping {
    const mapping: ColumnMapping = {};

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
  // Transaction Parsing
  // ============================================

  /**
   * Parse transactions from raw rows
   */
  private parseTransactions(
    rows: Record<string, any>[],
    mapping: ColumnMapping,
    defaultCurrency: string
  ): {
    transactions: Transaction[];
    validationErrors: ValidationError[];
    warnings: string[];
  } {
    const transactions: Transaction[] = [];
    const validationErrors: ValidationError[] = [];
    const warnings: string[] = [];

    for (const row of rows) {
      const rowNumber = row._rowNumber || 0;

      // Extract values using mapping
      const customerId = this.getValue(row, mapping.customerId);
      const customerName = this.getValue(row, mapping.customerName) || customerId;
      const amountStr = this.getValue(row, mapping.amount);
      const dateStr = this.getValue(row, mapping.date);
      const dueDateStr = this.getValue(row, mapping.dueDate);
      const typeStr = this.getValue(row, mapping.type);
      const statusStr = this.getValue(row, mapping.status);
      const invoiceNumber = this.getValue(row, mapping.invoiceNumber);
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

      // Parse date
      const date = this.parseDate(dateStr);
      if (!date) {
        validationErrors.push({
          row: rowNumber,
          column: mapping.date || 'date',
          message: `Invalid date: "${dateStr}"`,
          severity: 'warning'
        });
      }

      // Parse transaction type
      const type = this.parseTransactionType(typeStr, amount);

      // Parse status
      const status = this.parseStatus(statusStr, dueDateStr);

      // Calculate days overdue
      const daysOverdue = this.calculateDaysOverdue(dueDateStr, status);

      transactions.push({
        id: `txn-${rowNumber}-${Date.now()}`,
        customerId: customerId || this.generateCustomerId(customerName),
        customerName: customerName || customerId,
        type,
        date: date || new Date().toISOString().split('T')[0],
        dueDate: this.parseDate(dueDateStr) || undefined,
        amount: Math.abs(amount),
        currency,
        status,
        invoiceNumber: invoiceNumber || undefined,
        description: description || undefined,
        daysOverdue,
        sourceRow: rowNumber,
        rawData: row
      });
    }

    // Add warnings for potential issues
    if (transactions.length > 0 && !mapping.customerId && !mapping.customerName) {
      warnings.push('No customer column detected. Please verify customer mapping.');
    }
    if (!mapping.amount) {
      warnings.push('No amount column detected. Please verify amount mapping.');
    }
    if (!mapping.date) {
      warnings.push('No date column detected. Dates may be inaccurate.');
    }

    return { transactions, validationErrors, warnings };
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

  private parseTransactionType(
    value: string,
    amount: number
  ): Transaction['type'] {
    const lower = value.toLowerCase();

    if (lower.includes('payment') || lower.includes('receipt')) {
      return 'payment';
    }
    if (lower.includes('credit') || lower.includes('memo')) {
      return 'credit_memo';
    }
    if (lower.includes('refund')) {
      return 'refund';
    }
    if (lower.includes('adjust')) {
      return 'adjustment';
    }
    if (lower.includes('invoice') || lower.includes('billing')) {
      return 'invoice';
    }

    // Infer from amount sign
    return amount >= 0 ? 'invoice' : 'payment';
  }

  private parseStatus(statusStr: string, dueDateStr?: string): Transaction['status'] {
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
    if (lower.includes('pending') || lower.includes('open') || lower.includes('unpaid')) {
      // Check if overdue based on due date
      if (dueDateStr) {
        const dueDate = new Date(dueDateStr);
        if (!isNaN(dueDate.getTime()) && dueDate < new Date()) {
          return 'overdue';
        }
      }
      return 'pending';
    }

    // Default to pending
    return 'pending';
  }

  private calculateDaysOverdue(dueDateStr?: string, status?: Transaction['status']): number | undefined {
    if (status === 'paid' || status === 'voided') return undefined;
    if (!dueDateStr) return undefined;

    const dueDate = new Date(dueDateStr);
    if (isNaN(dueDate.getTime())) return undefined;

    const today = new Date();
    const diffMs = today.getTime() - dueDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : undefined;
  }

  private detectCurrency(rows: Record<string, any>[], mapping: ColumnMapping): string {
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

  private detectDataType(transactions: Transaction[]): ParsedFinancialData['dataType'] {
    const types = new Set(transactions.map(t => t.type));

    if (types.size === 1) {
      if (types.has('invoice')) return 'invoices';
      if (types.has('payment')) return 'payments';
    }

    if (types.has('invoice') && types.has('payment')) {
      return 'billing_history';
    }

    return 'combined';
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
   * Save parsed financial data to database
   */
  async saveFinancialUpload(
    userId: string,
    parsedData: ParsedFinancialData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: true }; // In-memory mode
    }

    try {
      const { error } = await (this.supabase as any)
        .from('financial_uploads')
        .insert({
          id: parsedData.fileId,
          user_id: userId,
          file_name: parsedData.fileName,
          file_type: parsedData.fileType,
          data_type: parsedData.dataType,
          detected_currency: parsedData.detectedCurrency,
          total_transactions: parsedData.totalTransactions,
          customer_count: parsedData.customerCount,
          date_range_start: parsedData.dateRange.start,
          date_range_end: parsedData.dateRange.end,
          total_revenue: parsedData.totalRevenue,
          column_mapping: parsedData.columnMapping,
          validation_errors: parsedData.validationErrors,
          warnings: parsedData.warnings,
          status: 'parsed',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Save transactions in batches
      const batchSize = 100;
      for (let i = 0; i < parsedData.transactions.length; i += batchSize) {
        const batch = parsedData.transactions.slice(i, i + batchSize).map(t => ({
          id: t.id,
          upload_id: parsedData.fileId,
          customer_id: t.customerId,
          customer_name: t.customerName,
          transaction_type: t.type,
          transaction_date: t.date,
          due_date: t.dueDate,
          amount: t.amount,
          currency: t.currency,
          status: t.status,
          invoice_number: t.invoiceNumber,
          description: t.description,
          days_overdue: t.daysOverdue,
          source_row: t.sourceRow
        }));

        const { error: txnError } = await (this.supabase as any)
          .from('financial_transactions')
          .insert(batch);

        if (txnError) {
          console.error('Error saving transaction batch:', txnError);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving financial upload:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save financial data'
      };
    }
  }

  /**
   * Get parsed financial data by file ID
   */
  async getFinancialUpload(fileId: string): Promise<ParsedFinancialData | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await (this.supabase as any)
        .from('financial_uploads')
        .select('*')
        .eq('id', fileId)
        .single();

      if (error || !data) return null;

      // Get transactions
      const { data: transactions } = await (this.supabase as any)
        .from('financial_transactions')
        .select('*')
        .eq('upload_id', fileId)
        .order('transaction_date', { ascending: false });

      return {
        fileId: data.id,
        fileName: data.file_name,
        fileType: data.file_type,
        dataType: data.data_type,
        detectedCurrency: data.detected_currency,
        totalTransactions: data.total_transactions,
        customerCount: data.customer_count,
        dateRange: {
          start: data.date_range_start,
          end: data.date_range_end,
          months: this.monthsBetween(new Date(data.date_range_start), new Date(data.date_range_end))
        },
        totalRevenue: data.total_revenue,
        columnMapping: data.column_mapping || {},
        suggestedMappings: [],
        unmappedColumns: [],
        transactions: (transactions || []).map((t: any) => ({
          id: t.id,
          customerId: t.customer_id,
          customerName: t.customer_name,
          type: t.transaction_type,
          date: t.transaction_date,
          dueDate: t.due_date,
          amount: t.amount,
          currency: t.currency,
          status: t.status,
          invoiceNumber: t.invoice_number,
          description: t.description,
          daysOverdue: t.days_overdue,
          sourceRow: t.source_row
        })),
        previewData: [],
        validationErrors: data.validation_errors || [],
        warnings: data.warnings || []
      };
    } catch (error) {
      console.error('Error fetching financial upload:', error);
      return null;
    }
  }
}

// Export singleton instance
export const billingParser = new BillingParserService();
export default billingParser;
