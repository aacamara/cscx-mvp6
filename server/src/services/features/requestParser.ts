/**
 * Feature Request Parser Service
 * PRD-016: Feature Request List Prioritization Scoring
 *
 * Parses and validates feature request uploads from CSV/Excel files,
 * matches to customer records, and enriches with customer data.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { csvParser } from '../fileUpload/csvParser.js';
import {
  RawFeatureRequest,
  ParsedFeatureRequest,
  FeatureRequestUploadResult,
  FeatureRequestUpload,
} from './types.js';

// Column name patterns for auto-detection
const COLUMN_PATTERNS = {
  customer: [/^(customer|company|account|client)[\s_-]?(name)?$/i, /^name$/i],
  customerEmail: [/^(customer|contact|primary)?[\s_-]?email$/i, /^e-?mail$/i],
  request: [/^(feature)?[\s_-]?request$/i, /^description$/i, /^feedback$/i, /^ask$/i],
  urgency: [/^urgency$/i, /^priority$/i, /^importance$/i],
  context: [/^context$/i, /^notes$/i, /^details$/i, /^additional[\s_-]?info$/i],
  source: [/^source$/i, /^channel$/i, /^origin$/i],
  submittedAt: [/^(submitted|created|date)[\s_-]?(at|on)?$/i, /^timestamp$/i],
  submittedBy: [/^(submitted|reported)[\s_-]?by$/i, /^contact[\s_-]?name$/i],
};

class FeatureRequestParserService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Parse feature request data from CSV/Excel upload
   */
  async parseUpload(
    content: string | Buffer,
    fileName: string,
    userId: string
  ): Promise<FeatureRequestUploadResult> {
    const startTime = Date.now();

    try {
      // Parse CSV content
      const parsed = await csvParser.parseCSV(content);

      // Auto-detect column mappings
      const columnMapping = this.detectColumnMapping(parsed.headers);

      // Validate required columns
      if (!columnMapping.customer) {
        throw new Error('Could not detect customer column. Please ensure your file has a "Customer" or "Company" column.');
      }
      if (!columnMapping.request) {
        throw new Error('Could not detect request column. Please ensure your file has a "Request" or "Description" column.');
      }

      // Extract raw requests
      const rawRequests = parsed.rows.map(row => this.extractRequest(row, columnMapping));

      // Match to customer records and enrich
      const { enrichedRequests, matchedCount, unmatchedCustomers } =
        await this.enrichWithCustomerData(rawRequests);

      // Calculate date range
      const dates = enrichedRequests
        .filter(r => r.submittedAt)
        .map(r => new Date(r.submittedAt!).getTime())
        .sort((a, b) => a - b);

      const dateRange = dates.length > 0 ? {
        start: new Date(dates[0]).toISOString().split('T')[0],
        end: new Date(dates[dates.length - 1]).toISOString().split('T')[0],
      } : undefined;

      // Generate upload ID
      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // Save to database if available
      if (this.supabase) {
        await this.saveUpload(uploadId, userId, fileName, enrichedRequests);
      }

      return {
        success: true,
        uploadId,
        fileName,
        totalRequests: enrichedRequests.length,
        matchedCustomers: matchedCount,
        unmatchedCustomers,
        dateRange,
        parsedRequests: enrichedRequests,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[FeatureRequestParser] Parse error:', error);
      throw error;
    }
  }

  /**
   * Detect column mappings from headers
   */
  private detectColumnMapping(headers: string[]): Record<string, string | undefined> {
    const mapping: Record<string, string | undefined> = {};

    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
      for (const header of headers) {
        if (patterns.some(pattern => pattern.test(header))) {
          mapping[field] = header;
          break;
        }
      }
    }

    return mapping;
  }

  /**
   * Extract a raw feature request from a CSV row
   */
  private extractRequest(
    row: Record<string, any>,
    mapping: Record<string, string | undefined>
  ): RawFeatureRequest {
    const urgencyValue = mapping.urgency ? row[mapping.urgency]?.toString().toLowerCase() : undefined;
    const urgency = this.normalizeUrgency(urgencyValue);

    const sourceValue = mapping.source ? row[mapping.source]?.toString().toLowerCase() : undefined;
    const source = this.normalizeSource(sourceValue);

    return {
      customer: mapping.customer ? row[mapping.customer]?.toString().trim() : '',
      customerEmail: mapping.customerEmail ? row[mapping.customerEmail]?.toString().trim() : undefined,
      request: mapping.request ? row[mapping.request]?.toString().trim() : '',
      urgency,
      context: mapping.context ? row[mapping.context]?.toString().trim() : undefined,
      source,
      submittedAt: mapping.submittedAt ? row[mapping.submittedAt]?.toString() : undefined,
      submittedBy: mapping.submittedBy ? row[mapping.submittedBy]?.toString().trim() : undefined,
    };
  }

  /**
   * Normalize urgency value to standard enum
   */
  private normalizeUrgency(value?: string): 'critical' | 'high' | 'medium' | 'low' | undefined {
    if (!value) return undefined;

    const normalized = value.toLowerCase().trim();

    if (['critical', 'urgent', 'blocker', 'p0', 'p1'].includes(normalized)) {
      return 'critical';
    }
    if (['high', 'important', 'p2'].includes(normalized)) {
      return 'high';
    }
    if (['medium', 'normal', 'p3'].includes(normalized)) {
      return 'medium';
    }
    if (['low', 'nice-to-have', 'p4', 'minor'].includes(normalized)) {
      return 'low';
    }

    return 'medium'; // Default
  }

  /**
   * Normalize source value to standard enum
   */
  private normalizeSource(value?: string): 'survey' | 'call' | 'ticket' | 'email' | 'meeting' | 'other' {
    if (!value) return 'other';

    const normalized = value.toLowerCase().trim();

    if (normalized.includes('survey') || normalized.includes('nps') || normalized.includes('csat')) {
      return 'survey';
    }
    if (normalized.includes('call') || normalized.includes('phone')) {
      return 'call';
    }
    if (normalized.includes('ticket') || normalized.includes('support') || normalized.includes('zendesk')) {
      return 'ticket';
    }
    if (normalized.includes('email') || normalized.includes('mail')) {
      return 'email';
    }
    if (normalized.includes('meeting') || normalized.includes('qbr') || normalized.includes('review')) {
      return 'meeting';
    }

    return 'other';
  }

  /**
   * Enrich requests with customer data from database
   */
  private async enrichWithCustomerData(
    rawRequests: RawFeatureRequest[]
  ): Promise<{
    enrichedRequests: ParsedFeatureRequest[];
    matchedCount: number;
    unmatchedCustomers: string[];
  }> {
    // Get unique customer names/emails
    const customerIdentifiers = new Set<string>();
    rawRequests.forEach(r => {
      if (r.customer) customerIdentifiers.add(r.customer.toLowerCase());
      if (r.customerEmail) customerIdentifiers.add(r.customerEmail.toLowerCase());
    });

    // Fetch customer data from database
    const customerMap = await this.fetchCustomerData(Array.from(customerIdentifiers));

    const enrichedRequests: ParsedFeatureRequest[] = [];
    const unmatchedCustomers: string[] = [];
    let matchedCount = 0;

    for (let i = 0; i < rawRequests.length; i++) {
      const raw = rawRequests[i];

      // Try to match customer
      const customerData = this.matchCustomer(raw, customerMap);

      if (customerData) {
        matchedCount++;
        enrichedRequests.push({
          ...raw,
          id: `req-${Date.now()}-${i}`,
          customerId: customerData.id,
          customerName: customerData.name,
          arr: customerData.arr,
          segment: customerData.segment,
          healthScore: customerData.healthScore,
          renewalDate: customerData.renewalDate,
          requestNormalized: this.normalizeRequestText(raw.request),
        });
      } else {
        // Create with default values for unmatched customers
        if (!unmatchedCustomers.includes(raw.customer)) {
          unmatchedCustomers.push(raw.customer);
        }

        enrichedRequests.push({
          ...raw,
          id: `req-${Date.now()}-${i}`,
          customerId: `unknown-${raw.customer.toLowerCase().replace(/\s+/g, '-')}`,
          customerName: raw.customer,
          arr: 0,
          segment: 'smb',
          requestNormalized: this.normalizeRequestText(raw.request),
        });
      }
    }

    return {
      enrichedRequests,
      matchedCount,
      unmatchedCustomers,
    };
  }

  /**
   * Fetch customer data from database
   */
  private async fetchCustomerData(
    identifiers: string[]
  ): Promise<Map<string, {
    id: string;
    name: string;
    email?: string;
    arr: number;
    segment: 'enterprise' | 'mid-market' | 'smb' | 'startup';
    healthScore?: number;
    renewalDate?: string;
  }>> {
    const customerMap = new Map();

    if (!this.supabase || identifiers.length === 0) {
      return customerMap;
    }

    try {
      // Query customers by name or email
      const { data: customers, error } = await this.supabase
        .from('customers')
        .select('id, name, email, arr, segment, health_score, renewal_date')
        .or(`name.ilike.any(${JSON.stringify(identifiers.map(i => `%${i}%`))}),email.ilike.any(${JSON.stringify(identifiers.map(i => `%${i}%`))})`);

      if (error) {
        console.error('[FeatureRequestParser] Customer query error:', error);
        return customerMap;
      }

      for (const customer of customers || []) {
        const key = customer.name.toLowerCase();
        customerMap.set(key, {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          arr: customer.arr || 0,
          segment: this.normalizeSegment(customer.segment),
          healthScore: customer.health_score,
          renewalDate: customer.renewal_date,
        });

        // Also map by email if available
        if (customer.email) {
          customerMap.set(customer.email.toLowerCase(), customerMap.get(key));
        }
      }
    } catch (error) {
      console.error('[FeatureRequestParser] Error fetching customers:', error);
    }

    return customerMap;
  }

  /**
   * Match a raw request to customer data
   */
  private matchCustomer(
    raw: RawFeatureRequest,
    customerMap: Map<string, any>
  ): any | null {
    // Try exact match by name
    if (customerMap.has(raw.customer.toLowerCase())) {
      return customerMap.get(raw.customer.toLowerCase());
    }

    // Try match by email
    if (raw.customerEmail && customerMap.has(raw.customerEmail.toLowerCase())) {
      return customerMap.get(raw.customerEmail.toLowerCase());
    }

    // Try fuzzy match on name
    const customerLower = raw.customer.toLowerCase();
    for (const [key, value] of customerMap.entries()) {
      if (key.includes(customerLower) || customerLower.includes(key)) {
        return value;
      }
    }

    return null;
  }

  /**
   * Normalize segment value
   */
  private normalizeSegment(segment?: string): 'enterprise' | 'mid-market' | 'smb' | 'startup' {
    if (!segment) return 'smb';

    const normalized = segment.toLowerCase();

    if (normalized.includes('enterprise') || normalized.includes('strategic')) {
      return 'enterprise';
    }
    if (normalized.includes('mid') || normalized.includes('market')) {
      return 'mid-market';
    }
    if (normalized.includes('startup') || normalized.includes('early')) {
      return 'startup';
    }

    return 'smb';
  }

  /**
   * Normalize request text for comparison and grouping
   */
  private normalizeRequestText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Save upload to database
   */
  private async saveUpload(
    uploadId: string,
    userId: string,
    fileName: string,
    requests: ParsedFeatureRequest[]
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      // Save upload record
      await this.supabase.from('feature_request_uploads').insert({
        id: uploadId,
        user_id: userId,
        file_name: fileName,
        status: 'parsed',
        total_requests: requests.length,
        unique_groups: 0,
        metadata: {
          parsedAt: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Save individual requests
      const requestRecords = requests.map(r => ({
        id: r.id,
        upload_id: uploadId,
        customer_id: r.customerId,
        customer_name: r.customerName,
        request_text: r.request,
        normalized_text: r.requestNormalized,
        urgency: r.urgency || 'medium',
        source: r.source || 'other',
        context: r.context,
        arr: r.arr,
        segment: r.segment,
        created_at: new Date().toISOString(),
      }));

      await this.supabase.from('feature_requests').insert(requestRecords);
    } catch (error) {
      console.error('[FeatureRequestParser] Error saving upload:', error);
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId: string): Promise<FeatureRequestUpload | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('feature_request_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      fileName: data.file_name,
      status: data.status,
      totalRequests: data.total_requests,
      uniqueGroups: data.unique_groups,
      errorMessage: data.error_message,
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

// Singleton instance
export const featureRequestParser = new FeatureRequestParserService();
export default featureRequestParser;
