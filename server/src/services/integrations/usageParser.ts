/**
 * Integration Usage Data Parser
 * PRD-020: Parse CSV/JSON integration usage data for technical health analysis
 *
 * Features:
 * - Accepts CSV and JSON formats
 * - Auto-detects field mappings
 * - Validates and normalizes data
 * - Associates data with customer integrations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  IntegrationUsageRecord,
  WebhookDeliveryRecord,
  ParsedIntegrationData,
  IntegrationDataType,
} from './types.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// FIELD MAPPING PATTERNS
// ============================================

const API_FIELD_PATTERNS: Record<string, RegExp[]> = {
  timestamp: [
    /^(timestamp|time|date|created_at|request_time|event_time)$/i,
    /^(datetime|ts|event_date)$/i,
  ],
  endpoint: [
    /^(endpoint|path|url|uri|route|api_path|request_path)$/i,
  ],
  method: [
    /^(method|http_method|request_method|verb)$/i,
  ],
  statusCode: [
    /^(status|status_code|http_status|response_code|code)$/i,
  ],
  latencyMs: [
    /^(latency|latency_ms|response_time|duration|duration_ms|elapsed|elapsed_ms)$/i,
  ],
  errorCode: [
    /^(error_code|err_code|error_type|error)$/i,
  ],
  errorMessage: [
    /^(error_message|error_msg|message|error_description)$/i,
  ],
  integrationName: [
    /^(integration|integration_name|service|service_name|source|api_name)$/i,
  ],
  integrationType: [
    /^(integration_type|type|service_type|category)$/i,
  ],
  userId: [
    /^(user_id|user|account_id|client_id)$/i,
  ],
  requestSize: [
    /^(request_size|req_size|request_bytes|payload_size)$/i,
  ],
  responseSize: [
    /^(response_size|res_size|response_bytes)$/i,
  ],
};

const WEBHOOK_FIELD_PATTERNS: Record<string, RegExp[]> = {
  timestamp: [
    /^(timestamp|time|date|created_at|delivery_time|sent_at)$/i,
  ],
  webhookId: [
    /^(webhook_id|id|hook_id)$/i,
  ],
  webhookName: [
    /^(webhook_name|name|hook_name|endpoint_name)$/i,
  ],
  eventType: [
    /^(event_type|event|type|trigger)$/i,
  ],
  status: [
    /^(status|delivery_status|state|result)$/i,
  ],
  latencyMs: [
    /^(latency|latency_ms|response_time|delivery_time_ms)$/i,
  ],
  httpStatusCode: [
    /^(http_status|status_code|response_code)$/i,
  ],
  failureReason: [
    /^(failure_reason|error|error_message|reason)$/i,
  ],
  retryCount: [
    /^(retry_count|retries|attempt|attempts)$/i,
  ],
};

// ============================================
// USAGE PARSER SERVICE
// ============================================

class UsageParserService {
  /**
   * Parse integration usage data from file content
   */
  async parseIntegrationData(
    content: string,
    fileType: 'json' | 'csv',
    options: {
      customerId: string;
      customerName?: string;
    }
  ): Promise<ParsedIntegrationData> {
    const parseErrors: string[] = [];
    let rawData: Record<string, unknown>[];

    // Parse raw content
    if (fileType === 'json') {
      try {
        const parsed = JSON.parse(content);
        rawData = Array.isArray(parsed) ? parsed : parsed.data || parsed.records || [parsed];
      } catch (err) {
        throw new Error(`Invalid JSON format: ${(err as Error).message}`);
      }
    } else {
      rawData = this.parseCSV(content);
    }

    if (rawData.length === 0) {
      throw new Error('No data found in file');
    }

    // Detect data type (API calls or webhooks or mixed)
    const { apiCalls, webhooks, mappingErrors } = this.categorizeAndMap(rawData);
    parseErrors.push(...mappingErrors);

    // Get customer name
    let customerName = options.customerName;
    if (!customerName && supabase) {
      const { data } = await supabase
        .from('customers')
        .select('name')
        .eq('id', options.customerId)
        .single();
      customerName = data?.name || 'Unknown Customer';
    }
    customerName = customerName || 'Unknown Customer';

    // Calculate date range
    const allTimestamps = [
      ...apiCalls.map(a => a.timestamp),
      ...webhooks.map(w => w.timestamp),
    ].filter(Boolean).sort();

    const dateRange = {
      start: allTimestamps[0] || new Date().toISOString(),
      end: allTimestamps[allTimestamps.length - 1] || new Date().toISOString(),
    };

    // Get unique integrations
    const integrations = [...new Set(apiCalls.map(a => a.integrationName))];

    return {
      customerId: options.customerId,
      customerName,
      dateRange,
      summary: {
        totalApiCalls: apiCalls.length,
        totalWebhookDeliveries: webhooks.length,
        integrationCount: integrations.length,
        integrations,
      },
      apiCalls,
      webhooks,
      parseErrors,
    };
  }

  /**
   * Parse CSV content to array of objects
   */
  private parseCSV(content: string): Record<string, unknown>[] {
    const lines = this.parseLines(content);
    if (lines.length < 2) return [];

    const delimiter = this.detectDelimiter(lines[0]);
    const headers = this.parseLine(lines[0], delimiter);
    const rows: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseLine(lines[i], delimiter);
      const row: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        row[header] = this.parseValue(values[index] || '');
      });
      rows.push(row);
    }

    return rows;
  }

  /**
   * Parse content into lines handling quoted newlines
   */
  private parseLines(content: string): string[] {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    // Remove BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

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

  /**
   * Detect CSV delimiter
   */
  private detectDelimiter(line: string): string {
    const delimiters = [',', ';', '\t', '|'];
    let best = ',';
    let max = 0;
    for (const d of delimiters) {
      const count = (line.match(new RegExp(`\\${d}`, 'g')) || []).length;
      if (count > max) {
        max = count;
        best = d;
      }
    }
    return best;
  }

  /**
   * Parse a single CSV line
   */
  private parseLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  /**
   * Parse a string value to appropriate type
   */
  private parseValue(value: string): unknown {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null') return null;
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    const num = parseFloat(trimmed.replace(/[,$]/g, ''));
    if (!isNaN(num) && /^-?\d+\.?\d*$/.test(trimmed.replace(/[,$]/g, ''))) return num;
    return trimmed;
  }

  /**
   * Categorize raw data and map to typed records
   */
  private categorizeAndMap(rawData: Record<string, unknown>[]): {
    apiCalls: IntegrationUsageRecord[];
    webhooks: WebhookDeliveryRecord[];
    mappingErrors: string[];
  } {
    const apiCalls: IntegrationUsageRecord[] = [];
    const webhooks: WebhookDeliveryRecord[] = [];
    const mappingErrors: string[] = [];

    // Detect field mappings from first record
    const sample = rawData[0];
    const fields = Object.keys(sample);

    const apiMapping = this.detectFieldMapping(fields, API_FIELD_PATTERNS);
    const webhookMapping = this.detectFieldMapping(fields, WEBHOOK_FIELD_PATTERNS);

    // Determine if data is API calls, webhooks, or mixed
    const hasApiFields = apiMapping.statusCode || apiMapping.endpoint;
    const hasWebhookFields = webhookMapping.webhookId || webhookMapping.eventType;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];

      // Try to parse as webhook first if it has webhook-specific fields
      if (hasWebhookFields && (row[webhookMapping.webhookId!] || row[webhookMapping.eventType!])) {
        const webhook = this.mapToWebhook(row, webhookMapping, i);
        if (webhook) {
          webhooks.push(webhook);
          continue;
        }
      }

      // Parse as API call
      if (hasApiFields) {
        const apiCall = this.mapToApiCall(row, apiMapping, i);
        if (apiCall) {
          apiCalls.push(apiCall);
        } else {
          mappingErrors.push(`Row ${i + 1}: Could not map to API call or webhook`);
        }
      }
    }

    return { apiCalls, webhooks, mappingErrors };
  }

  /**
   * Detect field mapping from patterns
   */
  private detectFieldMapping(
    fields: string[],
    patterns: Record<string, RegExp[]>
  ): Record<string, string | undefined> {
    const mapping: Record<string, string | undefined> = {};

    for (const [targetField, regexPatterns] of Object.entries(patterns)) {
      for (const field of fields) {
        for (const pattern of regexPatterns) {
          if (pattern.test(field)) {
            mapping[targetField] = field;
            break;
          }
        }
        if (mapping[targetField]) break;
      }
    }

    return mapping;
  }

  /**
   * Map raw row to API call record
   */
  private mapToApiCall(
    row: Record<string, unknown>,
    mapping: Record<string, string | undefined>,
    index: number
  ): IntegrationUsageRecord | null {
    const timestamp = this.extractTimestamp(row, mapping.timestamp);
    if (!timestamp) return null;

    const statusCode = this.extractNumber(row, mapping.statusCode) || 0;
    const method = this.extractMethod(row, mapping.method);

    return {
      timestamp,
      endpoint: this.extractString(row, mapping.endpoint) || '/unknown',
      method,
      statusCode,
      latencyMs: this.extractNumber(row, mapping.latencyMs) || 0,
      errorCode: statusCode >= 400 ? this.extractString(row, mapping.errorCode) : undefined,
      errorMessage: statusCode >= 400 ? this.extractString(row, mapping.errorMessage) : undefined,
      integrationName: this.extractString(row, mapping.integrationName) || 'Unknown Integration',
      integrationType: this.extractIntegrationType(row, mapping.integrationType),
      userId: this.extractString(row, mapping.userId),
      requestSize: this.extractNumber(row, mapping.requestSize),
      responseSize: this.extractNumber(row, mapping.responseSize),
    };
  }

  /**
   * Map raw row to webhook record
   */
  private mapToWebhook(
    row: Record<string, unknown>,
    mapping: Record<string, string | undefined>,
    index: number
  ): WebhookDeliveryRecord | null {
    const timestamp = this.extractTimestamp(row, mapping.timestamp);
    if (!timestamp) return null;

    const statusStr = this.extractString(row, mapping.status)?.toLowerCase() || 'unknown';
    let status: WebhookDeliveryRecord['status'] = 'pending';
    if (statusStr.includes('deliver') || statusStr === 'success' || statusStr === 'ok') {
      status = 'delivered';
    } else if (statusStr.includes('fail') || statusStr === 'error') {
      status = 'failed';
    } else if (statusStr.includes('retry')) {
      status = 'retrying';
    }

    return {
      timestamp,
      webhookId: this.extractString(row, mapping.webhookId) || `webhook-${index}`,
      webhookName: this.extractString(row, mapping.webhookName) || 'Unknown Webhook',
      eventType: this.extractString(row, mapping.eventType) || 'unknown',
      status,
      latencyMs: this.extractNumber(row, mapping.latencyMs),
      httpStatusCode: this.extractNumber(row, mapping.httpStatusCode),
      failureReason: status === 'failed' ? this.extractString(row, mapping.failureReason) : undefined,
      retryCount: this.extractNumber(row, mapping.retryCount) || 0,
    };
  }

  /**
   * Extract timestamp from row
   */
  private extractTimestamp(row: Record<string, unknown>, field?: string): string | null {
    if (!field) {
      // Try common timestamp field names
      const commonFields = ['timestamp', 'time', 'date', 'created_at', 'datetime'];
      for (const f of commonFields) {
        if (row[f]) {
          const parsed = this.parseTimestamp(row[f]);
          if (parsed) return parsed;
        }
      }
      return new Date().toISOString();
    }

    return this.parseTimestamp(row[field]);
  }

  /**
   * Parse various timestamp formats
   */
  private parseTimestamp(value: unknown): string | null {
    if (!value) return null;

    if (typeof value === 'number') {
      // Unix timestamp (seconds or milliseconds)
      const ts = value > 1e12 ? value : value * 1000;
      return new Date(ts).toISOString();
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    return null;
  }

  /**
   * Extract number from row
   */
  private extractNumber(row: Record<string, unknown>, field?: string): number | undefined {
    if (!field || row[field] === undefined || row[field] === null) return undefined;
    const val = row[field];
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val.replace(/[,$]/g, ''));
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  /**
   * Extract string from row
   */
  private extractString(row: Record<string, unknown>, field?: string): string | undefined {
    if (!field || row[field] === undefined || row[field] === null) return undefined;
    return String(row[field]);
  }

  /**
   * Extract HTTP method
   */
  private extractMethod(row: Record<string, unknown>, field?: string): IntegrationUsageRecord['method'] {
    const val = this.extractString(row, field)?.toUpperCase();
    if (val === 'GET' || val === 'POST' || val === 'PUT' || val === 'DELETE' || val === 'PATCH') {
      return val;
    }
    return 'GET';
  }

  /**
   * Extract integration type
   */
  private extractIntegrationType(row: Record<string, unknown>, field?: string): IntegrationDataType {
    const val = this.extractString(row, field)?.toLowerCase();
    if (val) {
      if (val.includes('salesforce')) return 'salesforce';
      if (val.includes('slack')) return 'slack';
      if (val.includes('hubspot')) return 'hubspot';
      if (val.includes('google')) return 'google';
      if (val.includes('zoom')) return 'zoom';
      if (val.includes('webhook')) return 'webhook';
      if (val.includes('api') || val.includes('custom')) return 'custom_api';
    }
    return 'api';
  }

  /**
   * Save parsed data to database
   */
  async saveParsedData(
    uploadId: string,
    data: ParsedIntegrationData
  ): Promise<void> {
    if (!supabase) return;

    // Save API calls in batches
    const batchSize = 500;
    for (let i = 0; i < data.apiCalls.length; i += batchSize) {
      const batch = data.apiCalls.slice(i, i + batchSize).map(call => ({
        upload_id: uploadId,
        customer_id: data.customerId,
        timestamp: call.timestamp,
        endpoint: call.endpoint,
        method: call.method,
        status_code: call.statusCode,
        latency_ms: call.latencyMs,
        error_code: call.errorCode,
        error_message: call.errorMessage,
        integration_name: call.integrationName,
        integration_type: call.integrationType,
        user_id: call.userId,
        request_size: call.requestSize,
        response_size: call.responseSize,
      }));

      await supabase.from('integration_api_calls').insert(batch);
    }

    // Save webhooks in batches
    for (let i = 0; i < data.webhooks.length; i += batchSize) {
      const batch = data.webhooks.slice(i, i + batchSize).map(wh => ({
        upload_id: uploadId,
        customer_id: data.customerId,
        timestamp: wh.timestamp,
        webhook_id: wh.webhookId,
        webhook_name: wh.webhookName,
        event_type: wh.eventType,
        status: wh.status,
        latency_ms: wh.latencyMs,
        http_status_code: wh.httpStatusCode,
        failure_reason: wh.failureReason,
        retry_count: wh.retryCount,
      }));

      await supabase.from('integration_webhooks').insert(batch);
    }
  }
}

// Export singleton instance
export const usageParser = new UsageParserService();
export default usageParser;
