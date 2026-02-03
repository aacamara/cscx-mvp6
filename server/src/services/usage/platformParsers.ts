/**
 * Platform Parsers Service
 * PRD-006: Parse usage data exports from analytics platforms
 *
 * Supported platforms:
 * - Pendo
 * - Amplitude
 * - Mixpanel
 * - Generic CSV
 */

import { csvParser, ParsedCSV } from '../fileUpload/csvParser.js';

// ============================================
// TYPES
// ============================================

export type AnalyticsPlatform = 'pendo' | 'amplitude' | 'mixpanel' | 'generic';

export interface UsageDataRow {
  customerId: string;
  customerName: string;
  userId?: string;
  userEmail?: string;
  featureName: string;
  eventType: string;
  timestamp: Date;
  duration?: number; // in seconds
  metadata?: Record<string, unknown>;
}

export interface ParsedUsageData {
  platform: AnalyticsPlatform;
  rows: UsageDataRow[];
  totalEvents: number;
  uniqueCustomers: number;
  uniqueUsers: number;
  uniqueFeatures: number;
  dateRange: {
    start: Date;
    end: Date;
  };
  featuresTracked: string[];
  columnMapping: UsageColumnMapping;
}

export interface UsageColumnMapping {
  customerId?: string;
  customerName?: string;
  userId?: string;
  userEmail?: string;
  featureName?: string;
  eventType?: string;
  timestamp?: string;
  duration?: string;
}

export interface PlatformDetectionResult {
  platform: AnalyticsPlatform;
  confidence: number;
  detectedColumns: string[];
}

// ============================================
// PLATFORM DETECTION PATTERNS
// ============================================

const PENDO_PATTERNS = {
  columns: [
    /^visitor[\s_-]?id$/i,
    /^account[\s_-]?id$/i,
    /^feature[\s_-]?name$/i,
    /^page[\s_-]?name$/i,
    /^guide[\s_-]?name$/i,
    /^event[\s_-]?time$/i,
    /^time[\s_-]?on[\s_-]?page$/i,
  ],
  identifiers: ['pendo', 'visitorId', 'accountId', 'guideId'],
};

const AMPLITUDE_PATTERNS = {
  columns: [
    /^user[\s_-]?id$/i,
    /^device[\s_-]?id$/i,
    /^event[\s_-]?type$/i,
    /^event[\s_-]?name$/i,
    /^event[\s_-]?time$/i,
    /^session[\s_-]?id$/i,
    /^amplitude[\s_-]?id$/i,
  ],
  identifiers: ['amplitude', 'event_type', '$amplitude'],
};

const MIXPANEL_PATTERNS = {
  columns: [
    /^\$distinct[\s_-]?id$/i,
    /^\$user[\s_-]?id$/i,
    /^mp[\s_-]/i,
    /^\$event$/i,
    /^\$time$/i,
    /^\$city$/i,
    /^\$browser$/i,
  ],
  identifiers: ['mixpanel', '$distinct_id', 'mp_', '$lib'],
};

// ============================================
// PLATFORM PARSERS CLASS
// ============================================

class PlatformParsersService {
  /**
   * Detect the analytics platform from CSV headers and content
   */
  detectPlatform(parsedCSV: ParsedCSV): PlatformDetectionResult {
    const headers = parsedCSV.headers.map(h => h.toLowerCase());
    const firstRow = parsedCSV.rows[0] || {};

    // Check for Pendo
    const pendoMatches = this.countPatternMatches(headers, PENDO_PATTERNS.columns);
    const pendoIdentifiers = this.checkIdentifiers(parsedCSV, PENDO_PATTERNS.identifiers);

    // Check for Amplitude
    const amplitudeMatches = this.countPatternMatches(headers, AMPLITUDE_PATTERNS.columns);
    const amplitudeIdentifiers = this.checkIdentifiers(parsedCSV, AMPLITUDE_PATTERNS.identifiers);

    // Check for Mixpanel
    const mixpanelMatches = this.countPatternMatches(headers, MIXPANEL_PATTERNS.columns);
    const mixpanelIdentifiers = this.checkIdentifiers(parsedCSV, MIXPANEL_PATTERNS.identifiers);

    // Calculate confidence scores
    const scores: Array<{ platform: AnalyticsPlatform; score: number }> = [
      { platform: 'pendo', score: pendoMatches * 10 + (pendoIdentifiers ? 30 : 0) },
      { platform: 'amplitude', score: amplitudeMatches * 10 + (amplitudeIdentifiers ? 30 : 0) },
      { platform: 'mixpanel', score: mixpanelMatches * 10 + (mixpanelIdentifiers ? 30 : 0) },
    ];

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const bestMatch = scores[0];
    const confidence = Math.min(100, bestMatch.score);

    // If confidence is too low, fall back to generic
    if (confidence < 20) {
      return {
        platform: 'generic',
        confidence: 50,
        detectedColumns: headers,
      };
    }

    return {
      platform: bestMatch.platform,
      confidence,
      detectedColumns: headers,
    };
  }

  /**
   * Count how many patterns match the headers
   */
  private countPatternMatches(headers: string[], patterns: RegExp[]): number {
    let matches = 0;
    for (const pattern of patterns) {
      if (headers.some(h => pattern.test(h))) {
        matches++;
      }
    }
    return matches;
  }

  /**
   * Check if identifiers exist in the data
   */
  private checkIdentifiers(parsedCSV: ParsedCSV, identifiers: string[]): boolean {
    const content = JSON.stringify(parsedCSV.rows.slice(0, 5)).toLowerCase();
    return identifiers.some(id => content.includes(id.toLowerCase()));
  }

  /**
   * Parse usage data based on detected platform
   */
  async parseUsageData(
    content: string | Buffer,
    suggestedPlatform?: AnalyticsPlatform,
    customMapping?: Partial<UsageColumnMapping>
  ): Promise<ParsedUsageData> {
    // First, parse the CSV
    const parsedCSV = await csvParser.parseCSV(content);

    // Detect platform if not provided
    const detection = this.detectPlatform(parsedCSV);
    const platform = suggestedPlatform || detection.platform;

    // Get column mapping based on platform
    const mapping = this.getColumnMapping(parsedCSV.headers, platform, customMapping);

    // Parse rows based on platform
    const rows = this.parseRows(parsedCSV.rows, mapping, platform);

    // Calculate aggregates
    const uniqueCustomers = new Set(rows.map(r => r.customerId));
    const uniqueUsers = new Set(rows.filter(r => r.userId).map(r => r.userId));
    const uniqueFeatures = new Set(rows.map(r => r.featureName));

    const timestamps = rows.map(r => r.timestamp.getTime()).filter(t => !isNaN(t));
    const minTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
    const maxTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

    return {
      platform,
      rows,
      totalEvents: rows.length,
      uniqueCustomers: uniqueCustomers.size,
      uniqueUsers: uniqueUsers.size,
      uniqueFeatures: uniqueFeatures.size,
      dateRange: {
        start: new Date(minTimestamp),
        end: new Date(maxTimestamp),
      },
      featuresTracked: Array.from(uniqueFeatures),
      columnMapping: mapping,
    };
  }

  /**
   * Get column mapping for a specific platform
   */
  getColumnMapping(
    headers: string[],
    platform: AnalyticsPlatform,
    customMapping?: Partial<UsageColumnMapping>
  ): UsageColumnMapping {
    const headerLower = headers.map(h => h.toLowerCase());

    let mapping: UsageColumnMapping = {};

    switch (platform) {
      case 'pendo':
        mapping = this.getPendoMapping(headers, headerLower);
        break;
      case 'amplitude':
        mapping = this.getAmplitudeMapping(headers, headerLower);
        break;
      case 'mixpanel':
        mapping = this.getMixpanelMapping(headers, headerLower);
        break;
      case 'generic':
      default:
        mapping = this.getGenericMapping(headers, headerLower);
    }

    // Apply custom overrides
    if (customMapping) {
      mapping = { ...mapping, ...customMapping };
    }

    return mapping;
  }

  /**
   * Pendo-specific column mapping
   */
  private getPendoMapping(headers: string[], headerLower: string[]): UsageColumnMapping {
    return {
      customerId: this.findColumn(headers, headerLower, [
        /^account[\s_-]?id$/i,
        /^customer[\s_-]?id$/i,
        /^company[\s_-]?id$/i,
      ]),
      customerName: this.findColumn(headers, headerLower, [
        /^account[\s_-]?name$/i,
        /^company[\s_-]?name$/i,
        /^customer[\s_-]?name$/i,
      ]),
      userId: this.findColumn(headers, headerLower, [
        /^visitor[\s_-]?id$/i,
        /^user[\s_-]?id$/i,
      ]),
      userEmail: this.findColumn(headers, headerLower, [
        /^visitor[\s_-]?email$/i,
        /^email$/i,
      ]),
      featureName: this.findColumn(headers, headerLower, [
        /^feature[\s_-]?name$/i,
        /^page[\s_-]?name$/i,
        /^guide[\s_-]?name$/i,
        /^event[\s_-]?name$/i,
      ]),
      eventType: this.findColumn(headers, headerLower, [
        /^event[\s_-]?type$/i,
        /^action$/i,
        /^type$/i,
      ]),
      timestamp: this.findColumn(headers, headerLower, [
        /^event[\s_-]?time$/i,
        /^timestamp$/i,
        /^time$/i,
        /^date$/i,
      ]),
      duration: this.findColumn(headers, headerLower, [
        /^time[\s_-]?on[\s_-]?page$/i,
        /^duration$/i,
        /^time[\s_-]?spent$/i,
      ]),
    };
  }

  /**
   * Amplitude-specific column mapping
   */
  private getAmplitudeMapping(headers: string[], headerLower: string[]): UsageColumnMapping {
    return {
      customerId: this.findColumn(headers, headerLower, [
        /^group[\s_-]?id$/i,
        /^company[\s_-]?id$/i,
        /^account[\s_-]?id$/i,
      ]),
      customerName: this.findColumn(headers, headerLower, [
        /^group[\s_-]?name$/i,
        /^company[\s_-]?name$/i,
      ]),
      userId: this.findColumn(headers, headerLower, [
        /^user[\s_-]?id$/i,
        /^amplitude[\s_-]?id$/i,
      ]),
      userEmail: this.findColumn(headers, headerLower, [
        /^email$/i,
        /^user[\s_-]?email$/i,
      ]),
      featureName: this.findColumn(headers, headerLower, [
        /^event[\s_-]?name$/i,
        /^event[\s_-]?type$/i,
      ]),
      eventType: this.findColumn(headers, headerLower, [
        /^event[\s_-]?type$/i,
        /^type$/i,
      ]),
      timestamp: this.findColumn(headers, headerLower, [
        /^event[\s_-]?time$/i,
        /^client[\s_-]?event[\s_-]?time$/i,
        /^server[\s_-]?upload[\s_-]?time$/i,
        /^timestamp$/i,
      ]),
      duration: this.findColumn(headers, headerLower, [
        /^session[\s_-]?length$/i,
        /^duration$/i,
      ]),
    };
  }

  /**
   * Mixpanel-specific column mapping
   */
  private getMixpanelMapping(headers: string[], headerLower: string[]): UsageColumnMapping {
    return {
      customerId: this.findColumn(headers, headerLower, [
        /^\$company[\s_-]?id$/i,
        /^company[\s_-]?id$/i,
        /^account[\s_-]?id$/i,
      ]),
      customerName: this.findColumn(headers, headerLower, [
        /^\$company[\s_-]?name$/i,
        /^company[\s_-]?name$/i,
      ]),
      userId: this.findColumn(headers, headerLower, [
        /^\$distinct[\s_-]?id$/i,
        /^\$user[\s_-]?id$/i,
        /^user[\s_-]?id$/i,
      ]),
      userEmail: this.findColumn(headers, headerLower, [
        /^\$email$/i,
        /^email$/i,
      ]),
      featureName: this.findColumn(headers, headerLower, [
        /^\$event$/i,
        /^event$/i,
        /^event[\s_-]?name$/i,
      ]),
      eventType: this.findColumn(headers, headerLower, [
        /^event[\s_-]?type$/i,
        /^type$/i,
      ]),
      timestamp: this.findColumn(headers, headerLower, [
        /^\$time$/i,
        /^time$/i,
        /^timestamp$/i,
      ]),
      duration: this.findColumn(headers, headerLower, [
        /^duration$/i,
        /^\$duration$/i,
      ]),
    };
  }

  /**
   * Generic column mapping (best-effort)
   */
  private getGenericMapping(headers: string[], headerLower: string[]): UsageColumnMapping {
    return {
      customerId: this.findColumn(headers, headerLower, [
        /^customer[\s_-]?(id)?$/i,
        /^account[\s_-]?(id)?$/i,
        /^company[\s_-]?(id)?$/i,
        /^org[\s_-]?(id)?$/i,
        /^tenant[\s_-]?(id)?$/i,
      ]),
      customerName: this.findColumn(headers, headerLower, [
        /^customer[\s_-]?name$/i,
        /^account[\s_-]?name$/i,
        /^company[\s_-]?name$/i,
        /^company$/i,
        /^customer$/i,
      ]),
      userId: this.findColumn(headers, headerLower, [
        /^user[\s_-]?(id)?$/i,
        /^member[\s_-]?(id)?$/i,
      ]),
      userEmail: this.findColumn(headers, headerLower, [
        /^email$/i,
        /^user[\s_-]?email$/i,
      ]),
      featureName: this.findColumn(headers, headerLower, [
        /^feature[\s_-]?(name)?$/i,
        /^event[\s_-]?name$/i,
        /^action[\s_-]?name$/i,
        /^page[\s_-]?name$/i,
        /^event$/i,
        /^feature$/i,
      ]),
      eventType: this.findColumn(headers, headerLower, [
        /^event[\s_-]?type$/i,
        /^type$/i,
        /^action[\s_-]?type$/i,
      ]),
      timestamp: this.findColumn(headers, headerLower, [
        /^timestamp$/i,
        /^date$/i,
        /^time$/i,
        /^event[\s_-]?time$/i,
        /^created[\s_-]?at$/i,
      ]),
      duration: this.findColumn(headers, headerLower, [
        /^duration$/i,
        /^time[\s_-]?spent$/i,
        /^session[\s_-]?length$/i,
      ]),
    };
  }

  /**
   * Find a column by patterns
   */
  private findColumn(headers: string[], headerLower: string[], patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const index = headerLower.findIndex(h => pattern.test(h));
      if (index >= 0) {
        return headers[index];
      }
    }
    return undefined;
  }

  /**
   * Parse rows into UsageDataRow format
   */
  private parseRows(
    rows: Record<string, any>[],
    mapping: UsageColumnMapping,
    platform: AnalyticsPlatform
  ): UsageDataRow[] {
    const result: UsageDataRow[] = [];

    for (const row of rows) {
      try {
        const customerId = mapping.customerId ? String(row[mapping.customerId] || '') : '';
        const customerName = mapping.customerName ? String(row[mapping.customerName] || '') : customerId;
        const featureName = mapping.featureName ? String(row[mapping.featureName] || 'unknown') : 'unknown';
        const eventType = mapping.eventType ? String(row[mapping.eventType] || 'feature_used') : 'feature_used';

        // Parse timestamp
        let timestamp = new Date();
        if (mapping.timestamp && row[mapping.timestamp]) {
          const parsed = this.parseTimestamp(row[mapping.timestamp], platform);
          if (parsed) timestamp = parsed;
        }

        // Parse duration
        let duration: number | undefined;
        if (mapping.duration && row[mapping.duration]) {
          duration = this.parseDuration(row[mapping.duration]);
        }

        // Skip rows without customer ID
        if (!customerId) continue;

        result.push({
          customerId,
          customerName,
          userId: mapping.userId ? String(row[mapping.userId] || '') : undefined,
          userEmail: mapping.userEmail ? String(row[mapping.userEmail] || '') : undefined,
          featureName: this.normalizeFeatureName(featureName),
          eventType,
          timestamp,
          duration,
          metadata: row,
        });
      } catch (err) {
        // Skip malformed rows
        console.warn('Failed to parse row:', err);
      }
    }

    return result;
  }

  /**
   * Parse timestamp from various formats
   */
  private parseTimestamp(value: any, platform: AnalyticsPlatform): Date | null {
    if (!value) return null;

    // Handle Unix timestamps (milliseconds)
    if (typeof value === 'number') {
      // If it looks like seconds, convert to milliseconds
      if (value < 10000000000) {
        return new Date(value * 1000);
      }
      return new Date(value);
    }

    // Handle string dates
    if (typeof value === 'string') {
      // Try ISO format first
      const isoDate = new Date(value);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }

      // Try Unix timestamp as string
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        if (numValue < 10000000000) {
          return new Date(numValue * 1000);
        }
        return new Date(numValue);
      }
    }

    return null;
  }

  /**
   * Parse duration value to seconds
   */
  private parseDuration(value: any): number | undefined {
    if (typeof value === 'number') {
      // Assume seconds if reasonable, milliseconds if large
      return value > 100000 ? value / 1000 : value;
    }

    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return num > 100000 ? num / 1000 : num;
      }
    }

    return undefined;
  }

  /**
   * Normalize feature names for consistency
   */
  private normalizeFeatureName(name: string): string {
    // Remove common prefixes
    let normalized = name
      .replace(/^(feature|page|event|action)[\s_-]+/i, '')
      .trim();

    // Convert to Title Case
    normalized = normalized
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return normalized || 'Unknown';
  }

  /**
   * Validate parsed usage data
   */
  validateParsedData(data: ParsedUsageData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.totalEvents === 0) {
      errors.push('No valid usage events found in the file');
    }

    if (data.uniqueCustomers === 0) {
      errors.push('No customer identifiers detected. Please map the customer ID column.');
    }

    if (data.uniqueFeatures === 0) {
      errors.push('No feature names detected. Please map the feature/event column.');
    }

    if (data.dateRange.start > data.dateRange.end) {
      errors.push('Invalid date range detected');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
export const platformParsers = new PlatformParsersService();
export default platformParsers;
