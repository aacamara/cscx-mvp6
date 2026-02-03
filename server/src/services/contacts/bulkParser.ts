/**
 * Bulk Contact Parser Service (PRD-025)
 * Parses CSV/Excel contact uploads with smart column mapping
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  RawContact,
  ParsedContact,
  ContactUploadResult,
  ContactColumnMapping,
  SuggestedMapping,
  CustomerMatch,
  ParseError,
  ContactImportJob,
  ContactImportStatus,
} from './types.js';

// Column mapping patterns for contact fields
const CONTACT_FIELD_PATTERNS: Record<keyof ContactColumnMapping, RegExp[]> = {
  name: [
    /^(first[\s_-]?)?name$/i,
    /^(full[\s_-]?)?name$/i,
    /^contact[\s_-]?name$/i,
    /^person$/i,
  ],
  email: [
    /^(e-?mail|email)[\s_-]?(address)?$/i,
    /^contact[\s_-]?email$/i,
    /^work[\s_-]?email$/i,
  ],
  company: [
    /^company[\s_-]?(name)?$/i,
    /^organization$/i,
    /^org$/i,
    /^employer$/i,
    /^account[\s_-]?name$/i,
  ],
  title: [
    /^(job[\s_-]?)?title$/i,
    /^position$/i,
    /^role$/i,
    /^designation$/i,
  ],
  phone: [
    /^phone[\s_-]?(number)?$/i,
    /^mobile$/i,
    /^cell$/i,
    /^telephone$/i,
    /^contact[\s_-]?number$/i,
  ],
  linkedinUrl: [
    /^linkedin[\s_-]?(url|profile|link)?$/i,
    /^li[\s_-]?url$/i,
    /^linkedin$/i,
  ],
  department: [
    /^department$/i,
    /^dept$/i,
    /^team$/i,
    /^division$/i,
  ],
  notes: [
    /^notes?$/i,
    /^comments?$/i,
    /^remarks?$/i,
    /^description$/i,
  ],
};

class BulkContactParser {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Parse CSV content and extract contacts
   */
  async parseCSV(
    content: string | Buffer,
    options: { delimiter?: string; encoding?: BufferEncoding } = {}
  ): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
    let textContent: string;

    // Handle buffer or string
    if (Buffer.isBuffer(content)) {
      try {
        textContent = content.toString('utf-8');
        // Check for encoding issues
        if (textContent.includes('\uFFFD')) {
          textContent = content.toString('latin1');
        }
      } catch {
        textContent = content.toString('latin1');
      }
    } else {
      textContent = content;
    }

    // Remove BOM
    if (textContent.charCodeAt(0) === 0xfeff) {
      textContent = textContent.slice(1);
    }

    // Detect delimiter
    const delimiter = options.delimiter || this.detectDelimiter(textContent);

    // Parse rows
    const lines = this.parseLines(textContent);
    const headers = this.parseLine(lines[0], delimiter).map(h => h.trim());

    const rows: Record<string, any>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const values = this.parseLine(line, delimiter);
      const row: Record<string, any> = {};

      headers.forEach((header, index) => {
        const value = values[index]?.trim() || '';
        row[header] = value || null;
      });

      rows.push(row);
    }

    return { headers, rows };
  }

  /**
   * Parse Excel content (uses xlsx library if available)
   */
  async parseExcel(
    content: Buffer,
    options: { sheet?: string } = {}
  ): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
    let XLSX: any;
    try {
      XLSX = await import('xlsx');
    } catch {
      throw new Error('Excel parsing requires the xlsx library. Please install it with: npm install xlsx');
    }

    const workbook = XLSX.read(content, { type: 'buffer', cellDates: true });
    const sheetName = options.sheet || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (jsonData.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = jsonData[0].map((h: any) => String(h || '').trim());
    const rows: Record<string, any>[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      const rowData = jsonData[i];
      if (!rowData || rowData.every((cell: any) => !cell)) continue;

      const row: Record<string, any> = {};
      headers.forEach((header, index) => {
        const value = rowData[index];
        row[header] = value === undefined || value === null ? null : value;
      });
      rows.push(row);
    }

    return { headers, rows };
  }

  /**
   * Process uploaded contact file
   */
  async processUpload(
    userId: string,
    fileName: string,
    content: string | Buffer,
    customMapping?: ContactColumnMapping
  ): Promise<ContactUploadResult> {
    // Determine file type and parse
    const isExcel = /\.(xlsx?|xls)$/i.test(fileName);
    const { headers, rows } = isExcel
      ? await this.parseExcel(Buffer.isBuffer(content) ? content : Buffer.from(content))
      : await this.parseCSV(content);

    // Suggest column mappings
    const suggestedMappings = this.suggestColumnMappings(headers);
    const columnMapping = customMapping || this.createMappingFromSuggestions(suggestedMappings);

    // Validate mapping has at least name field
    if (!columnMapping.name) {
      const nameField = suggestedMappings.find(s => s.suggestedField === 'name');
      if (nameField) {
        columnMapping.name = nameField.column;
      }
    }

    // Parse contacts from rows
    const parsedContacts: ParsedContact[] = [];
    const parseErrors: ParseError[] = [];

    rows.forEach((row, index) => {
      try {
        const contact = this.mapRowToContact(row, columnMapping, index);
        if (contact.name) {
          parsedContacts.push(contact);
        } else {
          parseErrors.push({
            rowIndex: index + 2, // +2 for header row and 0-indexing
            error: 'Missing required name field',
          });
        }
      } catch (error: any) {
        parseErrors.push({
          rowIndex: index + 2,
          error: error.message || 'Failed to parse row',
        });
      }
    });

    // Match contacts to customers by email domain
    const customerMatches = await this.matchContactsToCustomers(parsedContacts);

    // Find unknown companies
    const unknownCompanies = this.findUnknownCompanies(parsedContacts, customerMatches);

    // Create upload record
    const uploadId = await this.createImportJob(userId, fileName, parsedContacts.length);

    return {
      uploadId,
      fileName,
      totalContacts: parsedContacts.length,
      parsedContacts,
      customerMatches,
      unknownCompanies,
      headers,
      columnMapping,
      suggestedMappings,
      parseErrors,
    };
  }

  /**
   * Suggest column mappings based on header names
   */
  suggestColumnMappings(headers: string[]): SuggestedMapping[] {
    const suggestions: SuggestedMapping[] = [];

    for (const header of headers) {
      let bestMatch: { field: keyof ContactColumnMapping; confidence: number } | null = null;

      for (const [field, patterns] of Object.entries(CONTACT_FIELD_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(header)) {
            const confidence = pattern.source.includes('^') && pattern.source.includes('$') ? 0.95 : 0.75;
            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = { field: field as keyof ContactColumnMapping, confidence };
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

  /**
   * Create mapping from suggestions
   */
  createMappingFromSuggestions(suggestions: SuggestedMapping[]): ContactColumnMapping {
    const mapping: ContactColumnMapping = {};

    // Sort by confidence (highest first) to handle conflicts
    const sorted = [...suggestions].sort((a, b) => b.confidence - a.confidence);

    for (const suggestion of sorted) {
      if (suggestion.confidence >= 0.7 && !mapping[suggestion.suggestedField]) {
        mapping[suggestion.suggestedField] = suggestion.column;
      }
    }

    return mapping;
  }

  /**
   * Map a row to contact using column mapping
   */
  private mapRowToContact(
    row: Record<string, any>,
    mapping: ContactColumnMapping,
    rowIndex: number
  ): ParsedContact {
    const getValue = (field: keyof ContactColumnMapping): string | undefined => {
      const column = mapping[field];
      if (!column) return undefined;
      const value = row[column];
      return value === null || value === undefined ? undefined : String(value).trim();
    };

    // Handle name parsing (might be split into first/last)
    let name = getValue('name') || '';
    if (!name) {
      // Try combining first and last name if available in row
      const firstName = row['First Name'] || row['FirstName'] || row['first_name'] || '';
      const lastName = row['Last Name'] || row['LastName'] || row['last_name'] || '';
      if (firstName || lastName) {
        name = `${firstName} ${lastName}`.trim();
      }
    }

    return {
      name,
      email: this.normalizeEmail(getValue('email')),
      company: getValue('company'),
      title: getValue('title'),
      phone: this.normalizePhone(getValue('phone')),
      linkedinUrl: this.normalizeLinkedInUrl(getValue('linkedinUrl')),
      department: getValue('department'),
      notes: getValue('notes'),
      rowIndex,
      originalData: row,
    };
  }

  /**
   * Match contacts to existing customers by email domain
   */
  private async matchContactsToCustomers(contacts: ParsedContact[]): Promise<CustomerMatch[]> {
    if (!this.supabase) {
      return this.mockMatchContactsToCustomers(contacts);
    }

    // Extract unique email domains
    const domains = new Map<string, ParsedContact[]>();
    for (const contact of contacts) {
      if (contact.email) {
        const domain = contact.email.split('@')[1]?.toLowerCase();
        if (domain) {
          if (!domains.has(domain)) {
            domains.set(domain, []);
          }
          domains.get(domain)!.push(contact);
        }
      }
    }

    // Query customers that might match these domains
    const { data: customers } = await this.supabase
      .from('customers')
      .select('id, name, metadata')
      .or(
        Array.from(domains.keys())
          .map(d => `name.ilike.%${d.split('.')[0]}%`)
          .join(',')
      );

    const matches: CustomerMatch[] = [];
    const matchedCompanies = new Set<string>();

    // Also match by company name from contacts
    for (const contact of contacts) {
      if (contact.company) {
        const normalizedCompany = contact.company.toLowerCase().replace(/\s+(inc|llc|ltd|corp|co)\.?$/i, '').trim();
        const customer = customers?.find(c =>
          c.name.toLowerCase().replace(/\s+(inc|llc|ltd|corp|co)\.?$/i, '').trim() === normalizedCompany
        );
        if (customer && !matchedCompanies.has(customer.id)) {
          matchedCompanies.add(customer.id);
          matches.push({
            company: contact.company,
            customerId: customer.id,
            customerName: customer.name,
            contactCount: contacts.filter(c => c.company?.toLowerCase() === contact.company?.toLowerCase()).length,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Mock customer matching for testing
   */
  private mockMatchContactsToCustomers(contacts: ParsedContact[]): CustomerMatch[] {
    const companies = new Map<string, number>();
    for (const contact of contacts) {
      const company = contact.company || this.extractCompanyFromEmail(contact.email);
      if (company) {
        companies.set(company, (companies.get(company) || 0) + 1);
      }
    }

    return Array.from(companies.entries()).map(([company, count]) => ({
      company,
      customerId: `mock-${company.toLowerCase().replace(/\s+/g, '-')}`,
      customerName: company,
      contactCount: count,
    }));
  }

  /**
   * Find companies not matched to existing customers
   */
  private findUnknownCompanies(
    contacts: ParsedContact[],
    customerMatches: CustomerMatch[]
  ): string[] {
    const matchedCompanies = new Set(customerMatches.map(m => m.company.toLowerCase()));
    const unknownCompanies = new Set<string>();

    for (const contact of contacts) {
      const company = contact.company || this.extractCompanyFromEmail(contact.email);
      if (company && !matchedCompanies.has(company.toLowerCase())) {
        unknownCompanies.add(company);
      }
    }

    return Array.from(unknownCompanies);
  }

  /**
   * Create import job record
   */
  private async createImportJob(
    userId: string,
    fileName: string,
    totalContacts: number
  ): Promise<string> {
    const id = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (!this.supabase) {
      return id;
    }

    const { error } = await this.supabase
      .from('contact_import_jobs')
      .insert({
        id,
        user_id: userId,
        file_name: fileName,
        status: 'parsing',
        total_contacts: totalContacts,
        processed_contacts: 0,
      });

    if (error) {
      console.error('Failed to create import job:', error);
    }

    return id;
  }

  /**
   * Update import job status
   */
  async updateImportJobStatus(
    jobId: string,
    status: ContactImportStatus,
    data?: Partial<ContactImportJob>
  ): Promise<void> {
    if (!this.supabase) return;

    const updates: Record<string, any> = { status };
    if (data?.processedContacts !== undefined) {
      updates.processed_contacts = data.processedContacts;
    }
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
    if (data?.errorMessage) {
      updates.error_message = data.errorMessage;
    }

    await this.supabase
      .from('contact_import_jobs')
      .update(updates)
      .eq('id', jobId);
  }

  /**
   * Get import job by ID
   */
  async getImportJob(jobId: string): Promise<ContactImportJob | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('contact_import_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      fileName: data.file_name,
      status: data.status,
      totalContacts: data.total_contacts,
      processedContacts: data.processed_contacts,
      errorMessage: data.error_message,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    };
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

  private normalizeEmail(email?: string): string | undefined {
    if (!email) return undefined;
    const normalized = email.toLowerCase().trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : undefined;
  }

  private normalizePhone(phone?: string): string | undefined {
    if (!phone) return undefined;
    // Remove non-digit characters except + at the start
    const normalized = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    return normalized.length >= 10 ? normalized : undefined;
  }

  private normalizeLinkedInUrl(url?: string): string | undefined {
    if (!url) return undefined;
    // Ensure it's a LinkedIn URL
    if (url.includes('linkedin.com')) {
      return url.startsWith('http') ? url : `https://${url}`;
    }
    // Might be just the username
    if (/^[a-zA-Z0-9-]+$/.test(url)) {
      return `https://www.linkedin.com/in/${url}`;
    }
    return undefined;
  }

  private extractCompanyFromEmail(email?: string): string | undefined {
    if (!email) return undefined;
    const domain = email.split('@')[1];
    if (!domain) return undefined;
    // Remove common TLDs and capitalize
    const company = domain.split('.')[0];
    return company.charAt(0).toUpperCase() + company.slice(1);
  }
}

export const bulkContactParser = new BulkContactParser();
export default bulkContactParser;
