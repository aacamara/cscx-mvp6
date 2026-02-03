/**
 * Social Mention Parser Service (PRD-019)
 *
 * Parses CSV exports from social listening tools:
 * - Sprout Social
 * - Hootsuite
 * - Brandwatch
 * - Generic CSV formats
 *
 * Maps fields intelligently and normalizes data.
 */

import {
  SocialPlatform,
  ParsedMentionRow,
  MentionEngagement,
  UploadResult,
  CSVFieldMapping,
  DEFAULT_CSV_FIELD_MAPPINGS,
} from '../../../../types/socialMention.js';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface ParsedMention {
  id: string;
  platform: SocialPlatform;
  author: string;
  author_handle?: string;
  author_followers?: number;
  author_verified?: boolean;
  content: string;
  posted_at: string;
  engagement: MentionEngagement;
  url?: string;
}

interface ParseResult {
  mentions: ParsedMention[];
  failed_rows: number;
  errors: string[];
}

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parse CSV content into structured mention data
 */
export function parseCSV(
  content: string,
  sourceTool?: 'sprout_social' | 'hootsuite' | 'brandwatch' | 'generic'
): ParseResult {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);

  if (lines.length < 2) {
    return { mentions: [], failed_rows: 0, errors: ['CSV file is empty or has no data rows'] };
  }

  // Parse header row
  const headers = parseCSVRow(lines[0]);
  const fieldMapping = mapFields(headers, sourceTool);

  const mentions: ParsedMention[] = [];
  const errors: string[] = [];
  let failedRows = 0;

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVRow(lines[i]);
      const row = createRowObject(headers, values);
      const mention = parseMentionRow(row, fieldMapping);

      if (mention) {
        mentions.push(mention);
      } else {
        failedRows++;
      }
    } catch (error) {
      failedRows++;
      if (errors.length < 10) {
        errors.push(`Row ${i + 1}: ${(error as Error).message}`);
      }
    }
  }

  return { mentions, failed_rows: failedRows, errors };
}

/**
 * Parse a single CSV row handling quoted values
 */
function parseCSVRow(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
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
 * Create an object from headers and values
 */
function createRowObject(headers: string[], values: string[]): ParsedMentionRow {
  const row: Record<string, unknown> = {};

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim();
    row[header] = values[i] || '';
  }

  return row as ParsedMentionRow;
}

// ============================================================================
// Field Mapping
// ============================================================================

interface MappedFields {
  platform?: string;
  author?: string;
  author_handle?: string;
  followers?: string;
  verified?: string;
  content?: string;
  date?: string;
  likes?: string;
  shares?: string;
  comments?: string;
  reach?: string;
  url?: string;
}

/**
 * Map CSV headers to our standard fields
 */
function mapFields(
  headers: string[],
  sourceTool?: string
): MappedFields {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  const mapping = getFieldMappings(sourceTool);
  const mapped: MappedFields = {};

  // Find best match for each field
  for (const [field, possibleNames] of Object.entries(mapping)) {
    for (const name of possibleNames) {
      const index = normalizedHeaders.indexOf(name.toLowerCase());
      if (index !== -1) {
        (mapped as Record<string, string>)[field] = headers[index];
        break;
      }
    }
  }

  return mapped;
}

/**
 * Get field mappings based on source tool
 */
function getFieldMappings(sourceTool?: string): CSVFieldMapping {
  // Tool-specific mappings
  const toolMappings: Record<string, Partial<CSVFieldMapping>> = {
    sprout_social: {
      platform: ['Network', 'Platform'],
      author: ['Author Name', 'Profile Name'],
      author_handle: ['Author Handle', 'Profile Handle'],
      content: ['Message', 'Text', 'Content'],
      date: ['Date', 'Created Time', 'Timestamp'],
      likes: ['Likes', 'Reactions'],
      shares: ['Shares', 'Retweets'],
      comments: ['Comments', 'Replies'],
    },
    hootsuite: {
      platform: ['Network', 'Social Network'],
      author: ['Author', 'User'],
      author_handle: ['Screen Name', 'Handle'],
      content: ['Content', 'Message'],
      date: ['Date', 'Post Date'],
      likes: ['Likes', 'Favorites'],
      shares: ['Shares', 'Retweets'],
      comments: ['Replies', 'Comments'],
    },
    brandwatch: {
      platform: ['Page Type', 'Site Type'],
      author: ['Author', 'Username'],
      content: ['Full Text', 'Snippet'],
      date: ['Date', 'Added'],
      likes: ['Likes'],
      shares: ['Shares', 'Retweets'],
      reach: ['Impressions', 'Reach'],
    },
  };

  if (sourceTool && toolMappings[sourceTool]) {
    return {
      ...DEFAULT_CSV_FIELD_MAPPINGS,
      ...toolMappings[sourceTool],
    } as CSVFieldMapping;
  }

  return DEFAULT_CSV_FIELD_MAPPINGS;
}

// ============================================================================
// Row Parsing
// ============================================================================

/**
 * Parse a single mention row into structured data
 */
function parseMentionRow(
  row: ParsedMentionRow,
  mapping: MappedFields
): ParsedMention | null {
  // Content is required
  const content = getFieldValue(row, mapping.content, ['content', 'text', 'message']);
  if (!content || content.length < 5) {
    return null;
  }

  // Generate unique ID
  const id = crypto.randomUUID();

  // Parse platform
  const platformRaw = getFieldValue(row, mapping.platform, ['platform', 'network', 'source']);
  const platform = normalizePlatform(platformRaw);

  // Parse author info
  const author = getFieldValue(row, mapping.author, ['author', 'user', 'name']) || 'Unknown';
  const authorHandle = getFieldValue(row, mapping.author_handle, ['handle', 'username', 'screen_name']);
  const followersStr = getFieldValue(row, mapping.followers, ['followers', 'follower_count']);
  const authorFollowers = followersStr ? parseInt(followersStr.replace(/[,\s]/g, ''), 10) || undefined : undefined;
  const verifiedStr = getFieldValue(row, mapping.verified, ['verified', 'is_verified']);
  const authorVerified = verifiedStr ? ['true', 'yes', '1', 'verified'].includes(verifiedStr.toLowerCase()) : undefined;

  // Parse date
  const dateStr = getFieldValue(row, mapping.date, ['date', 'timestamp', 'posted_at', 'created_at']);
  const postedAt = parseDate(dateStr);

  // Parse engagement
  const likesStr = getFieldValue(row, mapping.likes, ['likes', 'favorites', 'reactions']);
  const sharesStr = getFieldValue(row, mapping.shares, ['shares', 'retweets', 'reposts']);
  const commentsStr = getFieldValue(row, mapping.comments, ['comments', 'replies']);
  const reachStr = getFieldValue(row, mapping.reach, ['reach', 'impressions']);

  const engagement: MentionEngagement = {
    likes: parseInt(likesStr?.replace(/[,\s]/g, '') || '0', 10) || 0,
    shares: parseInt(sharesStr?.replace(/[,\s]/g, '') || '0', 10) || 0,
    comments: parseInt(commentsStr?.replace(/[,\s]/g, '') || '0', 10) || 0,
    reach: reachStr ? parseInt(reachStr.replace(/[,\s]/g, ''), 10) || undefined : undefined,
  };

  // Parse URL
  const url = getFieldValue(row, mapping.url, ['url', 'link', 'permalink']);

  return {
    id,
    platform,
    author,
    author_handle: authorHandle || undefined,
    author_followers: authorFollowers,
    author_verified: authorVerified,
    content,
    posted_at: postedAt,
    engagement,
    url: url || undefined,
  };
}

/**
 * Get field value with fallbacks
 */
function getFieldValue(
  row: ParsedMentionRow,
  mappedField?: string,
  fallbacks: string[] = []
): string | undefined {
  // Try mapped field first
  if (mappedField && row[mappedField.toLowerCase()]) {
    const value = row[mappedField.toLowerCase()];
    return typeof value === 'string' ? value : String(value);
  }

  // Try fallbacks
  for (const fallback of fallbacks) {
    const value = row[fallback.toLowerCase()];
    if (value) {
      return typeof value === 'string' ? value : String(value);
    }
  }

  // Try all row keys
  for (const key of Object.keys(row)) {
    for (const fallback of fallbacks) {
      if (key.toLowerCase().includes(fallback.toLowerCase())) {
        const value = row[key];
        if (value) {
          return typeof value === 'string' ? value : String(value);
        }
      }
    }
  }

  return undefined;
}

/**
 * Normalize platform name to standard enum
 */
function normalizePlatform(platform?: string): SocialPlatform {
  if (!platform) return 'other';

  const normalized = platform.toLowerCase().trim();

  if (normalized.includes('twitter') || normalized.includes('x.com')) return 'twitter';
  if (normalized.includes('linkedin')) return 'linkedin';
  if (normalized.includes('g2') || normalized.includes('g2crowd')) return 'g2';
  if (normalized.includes('facebook') || normalized.includes('fb')) return 'facebook';
  if (normalized.includes('instagram') || normalized.includes('ig')) return 'instagram';
  if (normalized.includes('reddit')) return 'reddit';

  return 'other';
}

/**
 * Parse various date formats
 */
function parseDate(dateStr?: string): string {
  if (!dateStr) {
    return new Date().toISOString();
  }

  try {
    // Try ISO format first
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate.toISOString();
    }

    // Try common formats
    const formats = [
      // MM/DD/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
      // DD/MM/YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
      // YYYY-MM-DD
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }
    }

    // Fallback to current date
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ============================================================================
// Upload Processing
// ============================================================================

/**
 * Process an uploaded CSV file
 */
export function processUpload(
  content: string,
  fileName: string,
  sourceTool?: 'sprout_social' | 'hootsuite' | 'brandwatch' | 'generic'
): { uploadId: string; result: UploadResult; mentions: ParsedMention[] } {
  const uploadId = crypto.randomUUID();

  // Parse CSV
  const { mentions, failed_rows, errors } = parseCSV(content, sourceTool);

  // Get unique platforms
  const platforms = [...new Set(mentions.map(m => m.platform))];

  // Get date range
  const dates = mentions.map(m => new Date(m.posted_at).getTime());
  const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
  const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();

  const result: UploadResult = {
    upload_id: uploadId,
    total_rows: mentions.length + failed_rows,
    parsed_mentions: mentions.length,
    failed_rows,
    platforms,
    date_range: {
      start: minDate.toISOString(),
      end: maxDate.toISOString(),
    },
  };

  if (errors.length > 0) {
    console.warn(`[MentionParser] ${errors.length} parsing errors:`, errors.slice(0, 5));
  }

  return { uploadId, result, mentions };
}

// ============================================================================
// Exports
// ============================================================================

export const mentionParser = {
  parseCSV,
  processUpload,
  normalizePlatform,
  parseDate,
};

export default mentionParser;
