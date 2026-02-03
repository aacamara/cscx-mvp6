/**
 * Training Data Parser Service
 * PRD-017: Parse training completion data from LMS or manual tracking
 *
 * Features:
 * - Parse CSV/Excel from common LMS platforms
 * - Smart column mapping for training fields
 * - Data validation and normalization
 * - User-to-customer association
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { csvParser } from '../fileUpload/csvParser.js';

// Types
export interface TrainingRecord {
  id?: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_role?: string;
  customer_id: string;
  course_id: string;
  course_name: string;
  course_type: CourseType;
  status: TrainingStatus;
  enrollment_date: string;
  completion_date?: string;
  score?: number;
  passing_score?: number;
  passed?: boolean;
  certification_earned?: string;
  certification_expires?: string;
  time_to_complete_days?: number;
  metadata?: Record<string, unknown>;
}

export type CourseType =
  | 'fundamentals'
  | 'admin'
  | 'advanced'
  | 'api'
  | 'reporting'
  | 'integration'
  | 'custom';

export type TrainingStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'expired';

export interface TrainingColumnMapping {
  user_id?: string;
  user_email?: string;
  user_name?: string;
  user_role?: string;
  course_id?: string;
  course_name?: string;
  course_type?: string;
  status?: string;
  enrollment_date?: string;
  completion_date?: string;
  score?: string;
  passing_score?: string;
  certification?: string;
  certification_expiry?: string;
  [key: string]: string | undefined;
}

export interface TrainingParseResult {
  success: boolean;
  file_id: string;
  file_name: string;
  total_records: number;
  unique_users: number;
  unique_courses: number;
  customer_id?: string;
  customer_name?: string;
  column_mapping: TrainingColumnMapping;
  records: TrainingRecord[];
  preview: TrainingRecord[];
  errors: string[];
}

export interface SuggestedMapping {
  column: string;
  suggestedField: string;
  confidence: number;
}

// Known field patterns for auto-mapping training data
const TRAINING_FIELD_PATTERNS: Record<string, RegExp[]> = {
  user_id: [
    /^(user[\s_-]?)?id$/i,
    /^(employee|learner|student)[\s_-]?id$/i,
    /^uid$/i
  ],
  user_email: [
    /^(user[\s_-]?)?(email|e-?mail)$/i,
    /^(learner|employee|student)[\s_-]?email$/i,
    /^email[\s_-]?address$/i
  ],
  user_name: [
    /^(user[\s_-]?)?(name|full[\s_-]?name)$/i,
    /^(learner|employee|student)[\s_-]?name$/i,
    /^name$/i
  ],
  user_role: [
    /^(user[\s_-]?)?(role|title|job[\s_-]?title)$/i,
    /^position$/i,
    /^department$/i
  ],
  course_id: [
    /^(course|training|module)[\s_-]?id$/i,
    /^course[\s_-]?code$/i,
    /^learning[\s_-]?path[\s_-]?id$/i
  ],
  course_name: [
    /^(course|training|module)[\s_-]?(name|title)$/i,
    /^(course|training)$/i,
    /^learning[\s_-]?path[\s_-]?name$/i
  ],
  course_type: [
    /^(course|training)[\s_-]?type$/i,
    /^category$/i,
    /^track$/i
  ],
  status: [
    /^(completion[\s_-]?)?(status|state)$/i,
    /^progress[\s_-]?status$/i,
    /^training[\s_-]?status$/i
  ],
  enrollment_date: [
    /^(enrollment|enroll(ed)?|start|registration)[\s_-]?date$/i,
    /^date[\s_-]?enrolled$/i,
    /^started[\s_-]?(on|at|date)$/i
  ],
  completion_date: [
    /^(completion|completed|finish(ed)?)[\s_-]?date$/i,
    /^date[\s_-]?completed$/i,
    /^finished[\s_-]?(on|at|date)$/i
  ],
  score: [
    /^(final[\s_-]?)?(score|grade|mark)$/i,
    /^(quiz|exam|test)[\s_-]?score$/i,
    /^points$/i,
    /^result$/i
  ],
  passing_score: [
    /^(passing|minimum|required)[\s_-]?(score|grade)$/i,
    /^pass[\s_-]?mark$/i,
    /^threshold$/i
  ],
  certification: [
    /^(certification|certificate|cert)[\s_-]?(name|earned|title)?$/i,
    /^credential$/i,
    /^badge[\s_-]?(name|earned)?$/i
  ],
  certification_expiry: [
    /^(certification|cert(ificate)?)[\s_-]?(expiry|expiration|expires)[\s_-]?(date)?$/i,
    /^valid[\s_-]?(until|through)$/i,
    /^expir(y|es|ation)[\s_-]?date$/i
  ]
};

// Status normalization mapping
const STATUS_NORMALIZATION: Record<string, TrainingStatus> = {
  // Completed variants
  'completed': 'completed',
  'complete': 'completed',
  'done': 'completed',
  'finished': 'completed',
  'passed': 'completed',
  'pass': 'completed',
  'certified': 'completed',
  '100%': 'completed',
  '1': 'completed',
  'true': 'completed',
  'yes': 'completed',

  // In progress variants
  'in progress': 'in_progress',
  'in-progress': 'in_progress',
  'in_progress': 'in_progress',
  'started': 'in_progress',
  'active': 'in_progress',
  'ongoing': 'in_progress',
  'enrolled': 'in_progress',
  'learning': 'in_progress',

  // Not started variants
  'not started': 'not_started',
  'not-started': 'not_started',
  'not_started': 'not_started',
  'pending': 'not_started',
  'new': 'not_started',
  'assigned': 'not_started',
  '0%': 'not_started',
  '0': 'not_started',

  // Failed variants
  'failed': 'failed',
  'fail': 'failed',
  'incomplete': 'failed',
  'did not pass': 'failed',

  // Expired variants
  'expired': 'expired',
  'lapsed': 'expired',
  'outdated': 'expired'
};

// Course type normalization
const COURSE_TYPE_NORMALIZATION: Record<string, CourseType> = {
  // Fundamentals
  'fundamentals': 'fundamentals',
  'fundamental': 'fundamentals',
  'basics': 'fundamentals',
  'basic': 'fundamentals',
  'intro': 'fundamentals',
  'introduction': 'fundamentals',
  'beginner': 'fundamentals',
  'getting started': 'fundamentals',
  'onboarding': 'fundamentals',

  // Admin
  'admin': 'admin',
  'administrator': 'admin',
  'administration': 'admin',
  'system admin': 'admin',
  'platform admin': 'admin',

  // Advanced
  'advanced': 'advanced',
  'expert': 'advanced',
  'pro': 'advanced',
  'professional': 'advanced',
  'power user': 'advanced',

  // API
  'api': 'api',
  'developer': 'api',
  'development': 'api',
  'integration developer': 'api',
  'technical': 'api',

  // Reporting
  'reporting': 'reporting',
  'reports': 'reporting',
  'analytics': 'reporting',
  'data': 'reporting',
  'business intelligence': 'reporting',
  'bi': 'reporting',

  // Integration
  'integration': 'integration',
  'integrations': 'integration',
  'connector': 'integration',
  'connect': 'integration'
};

class TrainingDataParserService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Parse training data from CSV content
   */
  async parseTrainingData(
    content: string | Buffer,
    options: {
      fileName: string;
      customerId?: string;
      columnMapping?: TrainingColumnMapping;
    }
  ): Promise<TrainingParseResult> {
    const errors: string[] = [];
    const fileId = `training-${Date.now()}`;

    try {
      // Parse CSV using existing parser
      const parsed = await csvParser.parseCSV(content);

      // Suggest or use provided column mapping
      const columnMapping = options.columnMapping ||
        this.createMappingFromSuggestions(
          this.suggestColumnMappings(parsed.headers)
        );

      // Validate required fields
      if (!columnMapping.user_email && !columnMapping.user_name) {
        errors.push('Missing required field: user_email or user_name');
      }
      if (!columnMapping.course_name && !columnMapping.course_id) {
        errors.push('Missing required field: course_name or course_id');
      }

      if (errors.length > 0 && !options.columnMapping) {
        // Return with suggested mapping for user to confirm
        return {
          success: false,
          file_id: fileId,
          file_name: options.fileName,
          total_records: parsed.rowCount,
          unique_users: 0,
          unique_courses: 0,
          customer_id: options.customerId,
          column_mapping: columnMapping,
          records: [],
          preview: [],
          errors
        };
      }

      // Transform rows to training records
      const records: TrainingRecord[] = [];
      const uniqueUsers = new Set<string>();
      const uniqueCourses = new Set<string>();

      for (let i = 0; i < parsed.rows.length; i++) {
        const row = parsed.rows[i];
        try {
          const record = this.transformRow(row, columnMapping, options.customerId || 'unknown');
          records.push(record);
          uniqueUsers.add(record.user_email || record.user_name);
          uniqueCourses.add(record.course_name || record.course_id);
        } catch (err) {
          errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Get customer name if ID provided
      let customerName: string | undefined;
      if (options.customerId && this.supabase) {
        const { data: customer } = await this.supabase
          .from('customers')
          .select('name')
          .eq('id', options.customerId)
          .single();
        customerName = customer?.name;
      }

      // Save to database if configured
      if (this.supabase && records.length > 0) {
        await this.saveTrainingRecords(records, fileId);
      }

      return {
        success: errors.length === 0 || errors.length < records.length * 0.1, // Allow up to 10% errors
        file_id: fileId,
        file_name: options.fileName,
        total_records: records.length,
        unique_users: uniqueUsers.size,
        unique_courses: uniqueCourses.size,
        customer_id: options.customerId,
        customer_name: customerName,
        column_mapping: columnMapping,
        records,
        preview: records.slice(0, 10),
        errors
      };
    } catch (err) {
      return {
        success: false,
        file_id: fileId,
        file_name: options.fileName,
        total_records: 0,
        unique_users: 0,
        unique_courses: 0,
        customer_id: options.customerId,
        column_mapping: {},
        records: [],
        preview: [],
        errors: [err instanceof Error ? err.message : 'Failed to parse training data']
      };
    }
  }

  /**
   * Transform a row to a training record
   */
  private transformRow(
    row: Record<string, any>,
    mapping: TrainingColumnMapping,
    customerId: string
  ): TrainingRecord {
    const getValue = (field: keyof TrainingColumnMapping): any => {
      const column = mapping[field];
      return column ? row[column] : undefined;
    };

    const userId = getValue('user_id') || getValue('user_email') || '';
    const userEmail = getValue('user_email') || '';
    const userName = getValue('user_name') || userEmail.split('@')[0] || '';
    const courseId = getValue('course_id') || getValue('course_name')?.toLowerCase().replace(/\s+/g, '-') || '';
    const courseName = getValue('course_name') || courseId;

    // Normalize status
    const rawStatus = String(getValue('status') || '').toLowerCase().trim();
    const status = STATUS_NORMALIZATION[rawStatus] || 'in_progress';

    // Normalize course type
    const rawType = String(getValue('course_type') || '').toLowerCase().trim();
    const courseType = COURSE_TYPE_NORMALIZATION[rawType] ||
      this.inferCourseType(courseName) || 'custom';

    // Parse dates
    const enrollmentDate = this.parseDate(getValue('enrollment_date')) || new Date().toISOString();
    const completionDate = this.parseDate(getValue('completion_date'));

    // Calculate time to complete
    let timeToCompleteDays: number | undefined;
    if (completionDate && enrollmentDate) {
      const start = new Date(enrollmentDate);
      const end = new Date(completionDate);
      timeToCompleteDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Parse scores
    const score = this.parseNumber(getValue('score'));
    const passingScore = this.parseNumber(getValue('passing_score')) || 70;
    const passed = status === 'completed' && (score === undefined || score >= passingScore);

    return {
      user_id: userId,
      user_email: userEmail,
      user_name: userName,
      user_role: getValue('user_role'),
      customer_id: customerId,
      course_id: courseId,
      course_name: courseName,
      course_type: courseType,
      status,
      enrollment_date: enrollmentDate,
      completion_date: completionDate,
      score,
      passing_score: passingScore,
      passed,
      certification_earned: getValue('certification'),
      certification_expires: this.parseDate(getValue('certification_expiry')),
      time_to_complete_days: timeToCompleteDays
    };
  }

  /**
   * Infer course type from course name
   */
  private inferCourseType(courseName: string): CourseType | null {
    const name = courseName.toLowerCase();

    if (/basic|fundamental|intro|beginner|getting.?started/i.test(name)) {
      return 'fundamentals';
    }
    if (/admin|administrator|administration/i.test(name)) {
      return 'admin';
    }
    if (/advanced|expert|pro|power.?user/i.test(name)) {
      return 'advanced';
    }
    if (/api|developer|development|technical/i.test(name)) {
      return 'api';
    }
    if (/report|analytics|data|bi|dashboard/i.test(name)) {
      return 'reporting';
    }
    if (/integration|connect|sync/i.test(name)) {
      return 'integration';
    }

    return null;
  }

  /**
   * Parse date string to ISO format
   */
  private parseDate(value: any): string | undefined {
    if (!value) return undefined;

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      // Try common date formats
      const formats = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
        /(\d{1,2})-(\w{3})-(\d{4})/ // DD-Mon-YYYY
      ];

      for (const format of formats) {
        const match = String(value).match(format);
        if (match) {
          const parsed = new Date(value);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
          }
        }
      }

      return undefined;
    }

    return date.toISOString();
  }

  /**
   * Parse number from value
   */
  private parseNumber(value: any): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;

    // Handle percentage strings
    if (typeof value === 'string' && value.includes('%')) {
      const num = parseFloat(value.replace('%', ''));
      return isNaN(num) ? undefined : num;
    }

    const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? undefined : num;
  }

  /**
   * Suggest column mappings based on headers
   */
  suggestColumnMappings(headers: string[]): SuggestedMapping[] {
    const suggestions: SuggestedMapping[] = [];

    for (const header of headers) {
      let bestMatch: { field: string; confidence: number } | null = null;

      for (const [field, patterns] of Object.entries(TRAINING_FIELD_PATTERNS)) {
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
   * Create mapping from suggestions
   */
  createMappingFromSuggestions(suggestions: SuggestedMapping[]): TrainingColumnMapping {
    const mapping: TrainingColumnMapping = {};

    for (const suggestion of suggestions) {
      if (suggestion.confidence >= 0.7) {
        mapping[suggestion.suggestedField] = suggestion.column;
      }
    }

    return mapping;
  }

  /**
   * Save training records to database
   */
  private async saveTrainingRecords(records: TrainingRecord[], fileId: string): Promise<void> {
    if (!this.supabase) return;

    const dbRecords = records.map(r => ({
      file_id: fileId,
      user_id: r.user_id,
      user_email: r.user_email,
      user_name: r.user_name,
      user_role: r.user_role,
      customer_id: r.customer_id,
      course_id: r.course_id,
      course_name: r.course_name,
      course_type: r.course_type,
      status: r.status,
      enrollment_date: r.enrollment_date,
      completion_date: r.completion_date,
      score: r.score,
      passing_score: r.passing_score,
      passed: r.passed,
      certification_earned: r.certification_earned,
      certification_expires: r.certification_expires,
      time_to_complete_days: r.time_to_complete_days,
      metadata: r.metadata
    }));

    // Batch insert in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < dbRecords.length; i += chunkSize) {
      const chunk = dbRecords.slice(i, i + chunkSize);
      const { error } = await this.supabase
        .from('training_records')
        .insert(chunk);

      if (error) {
        console.error('Failed to save training records:', error);
      }
    }
  }

  /**
   * Get training records for a customer
   */
  async getTrainingRecords(
    customerId: string,
    options?: { courseId?: string; status?: TrainingStatus }
  ): Promise<TrainingRecord[]> {
    if (!this.supabase) {
      // Return mock data when Supabase not configured
      return this.getMockTrainingRecords(customerId);
    }

    let query = this.supabase
      .from('training_records')
      .select('*')
      .eq('customer_id', customerId);

    if (options?.courseId) {
      query = query.eq('course_id', options.courseId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query.order('enrollment_date', { ascending: false });

    if (error) {
      console.error('Failed to fetch training records:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get mock training records for demo
   */
  private getMockTrainingRecords(customerId: string): TrainingRecord[] {
    const users = [
      { name: 'Tom Brown', email: 'tom.brown@acme.com', role: 'Admin' },
      { name: 'Rachel Green', email: 'rachel.green@acme.com', role: 'Admin' },
      { name: 'Chris Davis', email: 'chris.davis@acme.com', role: 'Developer' },
      { name: 'Emily White', email: 'emily.white@acme.com', role: 'Analyst' },
      { name: 'Sarah Chen', email: 'sarah.chen@acme.com', role: 'Admin' },
      { name: 'Mike Johnson', email: 'mike.johnson@acme.com', role: 'Power User' },
      { name: 'Amy Lee', email: 'amy.lee@acme.com', role: 'User' },
      { name: 'John Smith', email: 'john.smith@acme.com', role: 'User' },
    ];

    const courses = [
      { id: 'basic-fundamentals', name: 'Basic Fundamentals', type: 'fundamentals' as CourseType },
      { id: 'admin-certification', name: 'Admin Certification', type: 'admin' as CourseType },
      { id: 'advanced-features', name: 'Advanced Features', type: 'advanced' as CourseType },
      { id: 'api-integration', name: 'API Integration', type: 'api' as CourseType },
      { id: 'reporting-mastery', name: 'Reporting Mastery', type: 'reporting' as CourseType },
    ];

    const records: TrainingRecord[] = [];
    const now = new Date();

    users.forEach((user, ui) => {
      courses.forEach((course, ci) => {
        // Create varying completion patterns
        const shouldEnroll = Math.random() > 0.15; // 85% enrollment
        if (!shouldEnroll && course.id !== 'basic-fundamentals') return;

        const enrollDate = new Date(now.getTime() - (30 + Math.random() * 60) * 24 * 60 * 60 * 1000);
        const shouldComplete = Math.random() > 0.3; // 70% completion
        const completionDate = shouldComplete
          ? new Date(enrollDate.getTime() + (3 + Math.random() * 10) * 24 * 60 * 60 * 1000)
          : undefined;

        const score = shouldComplete ? Math.floor(70 + Math.random() * 30) : undefined;
        const passed = score !== undefined && score >= 70;

        records.push({
          user_id: user.email,
          user_email: user.email,
          user_name: user.name,
          user_role: user.role,
          customer_id: customerId,
          course_id: course.id,
          course_name: course.name,
          course_type: course.type,
          status: shouldComplete ? 'completed' : (enrollDate < new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) ? 'in_progress' : 'not_started'),
          enrollment_date: enrollDate.toISOString(),
          completion_date: completionDate?.toISOString(),
          score,
          passing_score: 70,
          passed,
          certification_earned: passed ? `${course.name} Certification` : undefined,
          certification_expires: passed
            ? new Date(now.getTime() + (30 + Math.random() * 335) * 24 * 60 * 60 * 1000).toISOString()
            : undefined,
          time_to_complete_days: completionDate
            ? Math.ceil((completionDate.getTime() - enrollDate.getTime()) / (1000 * 60 * 60 * 24))
            : undefined
        });
      });
    });

    return records;
  }
}

// Singleton instance
export const trainingDataParser = new TrainingDataParserService();
export default trainingDataParser;
