/**
 * NPS Survey Parser Service
 *
 * PRD-005: NPS Survey Results -> Sentiment Analysis
 *
 * Parses NPS survey exports from various platforms (Delighted, SurveyMonkey,
 * Typeform, Qualtrics, etc.) and normalizes data for analysis.
 */

import { v4 as uuidv4 } from 'uuid';
import { csvParser, ParsedCSV } from '../fileUpload/csvParser.js';

// ============================================
// Types
// ============================================

export type SurveyPlatform =
  | 'delighted'
  | 'surveymonkey'
  | 'typeform'
  | 'qualtrics'
  | 'google_forms'
  | 'hubspot'
  | 'generic';

export type NPSCategory = 'promoter' | 'passive' | 'detractor';

export interface NPSSurveyRow {
  id: string;
  respondentEmail?: string;
  respondentName?: string;
  customerId?: string;
  customerName?: string;
  score: number;
  category: NPSCategory;
  verbatim?: string;
  timestamp: Date;
  source: SurveyPlatform;
  rawData: Record<string, unknown>;
}

export interface NPSDistribution {
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
  promoterPercent: number;
  passivePercent: number;
  detractorPercent: number;
  npsScore: number;
}

export interface ParsedNPSSurvey {
  id: string;
  platform: SurveyPlatform;
  surveyPeriod: {
    start: Date;
    end: Date;
  };
  responses: NPSSurveyRow[];
  distribution: NPSDistribution;
  hasVerbatim: boolean;
  columnMapping: NPSColumnMapping;
  parseWarnings: string[];
}

export interface NPSColumnMapping {
  score: string;
  email?: string;
  name?: string;
  customerId?: string;
  customerName?: string;
  verbatim?: string;
  timestamp?: string;
}

// ============================================
// Platform Detection Patterns
// ============================================

const PLATFORM_PATTERNS: Record<SurveyPlatform, {
  headers: RegExp[];
  scoreRange?: { min: number; max: number };
}> = {
  delighted: {
    headers: [
      /^person_email$/i,
      /^survey_response$/i,
      /^score$/i,
      /^comment$/i,
    ],
  },
  surveymonkey: {
    headers: [
      /^respondent\s*id$/i,
      /^collector\s*id$/i,
      /^how\s*likely.*recommend/i,
    ],
  },
  typeform: {
    headers: [
      /^submitted\s*at$/i,
      /^token$/i,
      /^network\s*id$/i,
    ],
  },
  qualtrics: {
    headers: [
      /^responseid$/i,
      /^progress$/i,
      /^finished$/i,
      /^recordeddate$/i,
    ],
  },
  google_forms: {
    headers: [
      /^timestamp$/i,
      /^email\s*address$/i,
    ],
  },
  hubspot: {
    headers: [
      /^contact\s*id$/i,
      /^company\s*name$/i,
      /^nps\s*score$/i,
    ],
  },
  generic: {
    headers: [],
  },
};

// Column name patterns for auto-detection
const COLUMN_PATTERNS = {
  score: [
    /^(nps[\s_-]?)?score$/i,
    /^how\s*(likely|would).*recommend/i,
    /^rating$/i,
    /^survey_response$/i,
    /^nps$/i,
  ],
  email: [
    /^(respondent[\s_-]?)?(e[\s_-]?)?mail$/i,
    /^person[\s_-]?email$/i,
    /^email[\s_-]?address$/i,
    /^contact[\s_-]?email$/i,
  ],
  name: [
    /^(respondent[\s_-]?)?name$/i,
    /^(first[\s_-]?)?name$/i,
    /^person[\s_-]?name$/i,
    /^contact[\s_-]?name$/i,
    /^full[\s_-]?name$/i,
  ],
  customerId: [
    /^customer[\s_-]?id$/i,
    /^account[\s_-]?id$/i,
    /^company[\s_-]?id$/i,
    /^client[\s_-]?id$/i,
  ],
  customerName: [
    /^customer[\s_-]?name$/i,
    /^company[\s_-]?name$/i,
    /^account[\s_-]?name$/i,
    /^organization$/i,
  ],
  verbatim: [
    /^(verbatim|comment|feedback|reason|response[\s_-]?text)$/i,
    /^why.*score/i,
    /^please\s*(explain|share|tell)/i,
    /^additional[\s_-]?comments?$/i,
    /^open[\s_-]?ended/i,
  ],
  timestamp: [
    /^(submitted[\s_-]?)?(at|on|date|time(stamp)?)$/i,
    /^created[\s_-]?(at|date)$/i,
    /^response[\s_-]?date$/i,
    /^date$/i,
  ],
};

// ============================================
// NPS Parser Service
// ============================================

class NPSParserService {
  /**
   * Parse NPS survey data from CSV/Excel content
   */
  async parseNPSSurvey(
    content: string | Buffer,
    options: {
      platform?: SurveyPlatform;
      columnMapping?: Partial<NPSColumnMapping>;
      customerId?: string;
    } = {}
  ): Promise<ParsedNPSSurvey> {
    // Parse the raw CSV
    const parsed = await csvParser.parseCSV(content);

    // Detect platform if not specified
    const platform = options.platform || this.detectPlatform(parsed.headers);

    // Auto-detect column mapping
    const columnMapping = this.detectColumnMapping(
      parsed.headers,
      options.columnMapping
    );

    // Validate we have a score column
    if (!columnMapping.score) {
      throw new Error(
        'Could not detect NPS score column. Please specify the score column manually.'
      );
    }

    // Parse responses
    const { responses, warnings } = this.parseResponses(
      parsed.rows,
      columnMapping,
      platform,
      options.customerId
    );

    // Calculate distribution
    const distribution = this.calculateDistribution(responses);

    // Determine survey period
    const timestamps = responses
      .map(r => r.timestamp)
      .filter(t => !isNaN(t.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const surveyPeriod = {
      start: timestamps[0] || new Date(),
      end: timestamps[timestamps.length - 1] || new Date(),
    };

    return {
      id: uuidv4(),
      platform,
      surveyPeriod,
      responses,
      distribution,
      hasVerbatim: responses.some(r => r.verbatim && r.verbatim.trim().length > 0),
      columnMapping,
      parseWarnings: warnings,
    };
  }

  /**
   * Detect the survey platform from headers
   */
  private detectPlatform(headers: string[]): SurveyPlatform {
    const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));

    for (const [platform, config] of Object.entries(PLATFORM_PATTERNS)) {
      if (platform === 'generic') continue;

      const matchCount = config.headers.filter(pattern =>
        headers.some(h => pattern.test(h))
      ).length;

      // Require at least 2 matches for confidence
      if (matchCount >= 2) {
        return platform as SurveyPlatform;
      }
    }

    return 'generic';
  }

  /**
   * Detect column mapping from headers
   */
  private detectColumnMapping(
    headers: string[],
    override?: Partial<NPSColumnMapping>
  ): NPSColumnMapping {
    const mapping: NPSColumnMapping = {
      score: '',
    };

    // Apply overrides first
    if (override) {
      Object.assign(mapping, override);
    }

    // Auto-detect remaining fields
    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
      // Skip if already specified
      if (mapping[field as keyof NPSColumnMapping]) continue;

      for (const header of headers) {
        if (patterns.some(pattern => pattern.test(header))) {
          (mapping as Record<string, string>)[field] = header;
          break;
        }
      }
    }

    return mapping;
  }

  /**
   * Parse individual responses from rows
   */
  private parseResponses(
    rows: Record<string, unknown>[],
    mapping: NPSColumnMapping,
    platform: SurveyPlatform,
    defaultCustomerId?: string
  ): { responses: NPSSurveyRow[]; warnings: string[] } {
    const responses: NPSSurveyRow[] = [];
    const warnings: string[] = [];
    let skippedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Extract score
        const scoreRaw = row[mapping.score];
        const score = this.parseScore(scoreRaw);

        if (score === null) {
          skippedCount++;
          continue;
        }

        // Validate score is in NPS range
        if (score < 0 || score > 10) {
          warnings.push(`Row ${i + 2}: Score ${score} is outside valid NPS range (0-10)`);
          continue;
        }

        // Extract timestamp
        let timestamp = new Date();
        if (mapping.timestamp && row[mapping.timestamp]) {
          const parsed = new Date(row[mapping.timestamp] as string);
          if (!isNaN(parsed.getTime())) {
            timestamp = parsed;
          }
        }

        // Build response record
        const response: NPSSurveyRow = {
          id: uuidv4(),
          respondentEmail: mapping.email
            ? this.normalizeEmail(row[mapping.email] as string)
            : undefined,
          respondentName: mapping.name
            ? String(row[mapping.name] || '').trim()
            : undefined,
          customerId: mapping.customerId
            ? String(row[mapping.customerId] || '').trim()
            : defaultCustomerId,
          customerName: mapping.customerName
            ? String(row[mapping.customerName] || '').trim()
            : undefined,
          score,
          category: this.getCategory(score),
          verbatim: mapping.verbatim
            ? this.normalizeVerbatim(row[mapping.verbatim])
            : undefined,
          timestamp,
          source: platform,
          rawData: row,
        };

        responses.push(response);
      } catch (error) {
        warnings.push(`Row ${i + 2}: Failed to parse - ${(error as Error).message}`);
      }
    }

    if (skippedCount > 0) {
      warnings.push(`Skipped ${skippedCount} rows with invalid or missing scores`);
    }

    return { responses, warnings };
  }

  /**
   * Parse a score value from various formats
   */
  private parseScore(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Math.round(value);

    const str = String(value).trim();
    if (str === '' || str.toLowerCase() === 'n/a') return null;

    // Handle "9 - Extremely Likely" format
    const match = str.match(/^(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }

    return null;
  }

  /**
   * Get NPS category from score
   */
  private getCategory(score: number): NPSCategory {
    if (score >= 9) return 'promoter';
    if (score >= 7) return 'passive';
    return 'detractor';
  }

  /**
   * Normalize email address
   */
  private normalizeEmail(value: unknown): string | undefined {
    if (!value) return undefined;
    const email = String(value).trim().toLowerCase();
    // Basic email validation
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return email;
    }
    return undefined;
  }

  /**
   * Normalize verbatim feedback
   */
  private normalizeVerbatim(value: unknown): string | undefined {
    if (!value) return undefined;
    const text = String(value).trim();
    if (text.length === 0 || text.toLowerCase() === 'n/a') return undefined;
    return text;
  }

  /**
   * Calculate NPS distribution
   */
  private calculateDistribution(responses: NPSSurveyRow[]): NPSDistribution {
    const total = responses.length;
    const promoters = responses.filter(r => r.category === 'promoter').length;
    const passives = responses.filter(r => r.category === 'passive').length;
    const detractors = responses.filter(r => r.category === 'detractor').length;

    const promoterPercent = total > 0 ? Math.round((promoters / total) * 100) : 0;
    const passivePercent = total > 0 ? Math.round((passives / total) * 100) : 0;
    const detractorPercent = total > 0 ? Math.round((detractors / total) * 100) : 0;

    return {
      promoters,
      passives,
      detractors,
      total,
      promoterPercent,
      passivePercent,
      detractorPercent,
      npsScore: promoterPercent - detractorPercent,
    };
  }

  /**
   * Suggest column mappings for a set of headers
   */
  suggestColumnMappings(headers: string[]): Array<{
    header: string;
    suggestedField: keyof NPSColumnMapping;
    confidence: number;
  }> {
    const suggestions: Array<{
      header: string;
      suggestedField: keyof NPSColumnMapping;
      confidence: number;
    }> = [];

    for (const header of headers) {
      for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(header)) {
            suggestions.push({
              header,
              suggestedField: field as keyof NPSColumnMapping,
              confidence: pattern.source.includes('^') ? 0.9 : 0.7,
            });
            break;
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Validate an NPS survey before analysis
   */
  validateSurvey(survey: ParsedNPSSurvey): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Must have responses
    if (survey.responses.length === 0) {
      errors.push('No valid responses found in the survey data');
    }

    // Warn if no verbatim
    if (!survey.hasVerbatim) {
      warnings.push(
        'No verbatim feedback found - sentiment analysis will use scores only'
      );
    }

    // Warn if few responses
    if (survey.responses.length < 10) {
      warnings.push(
        `Only ${survey.responses.length} responses - NPS may not be statistically significant`
      );
    }

    // Warn if no customer mapping
    const hasCustomerMapping = survey.responses.some(
      r => r.customerId || r.customerName
    );
    if (!hasCustomerMapping) {
      warnings.push(
        'No customer identification found - responses cannot be linked to accounts'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [...warnings, ...survey.parseWarnings],
    };
  }
}

export const npsParser = new NPSParserService();
export default npsParser;
