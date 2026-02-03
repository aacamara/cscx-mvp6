/**
 * PRD-220: Automated Data Enrichment Types
 *
 * Type definitions for the data enrichment system including
 * customer firmographics, stakeholder profiles, and enrichment pipeline.
 */

// ============================================
// ENRICHMENT REQUEST & RESULT
// ============================================

export type EntityType = 'customer' | 'stakeholder';
export type EnrichmentPriority = 'high' | 'normal' | 'low';
export type EnrichmentStatus = 'pending' | 'in_progress' | 'complete' | 'partial' | 'failed';

export interface EnrichmentRequest {
  entity_type: EntityType;
  entity_id: string;
  priority: EnrichmentPriority;
  requested_fields?: string[];
  source_hints?: {
    domain?: string;
    email?: string;
    linkedin_url?: string;
    company_name?: string;
  };
}

export interface EnrichmentResult {
  entity_id: string;
  entity_type: EntityType;
  status: EnrichmentStatus;
  fields_enriched: string[];
  data: Record<string, unknown>;
  confidence: Record<string, number>;
  sources: Record<string, string>;
  enriched_at: Date;
  changes_detected?: EnrichmentChange[];
}

export interface EnrichmentChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
  detected_at: Date;
}

// ============================================
// CUSTOMER ENRICHMENT FIELDS
// ============================================

export interface CustomerEnrichmentData {
  // Company basics
  company_name?: string;
  domain?: string;
  website_url?: string;
  logo_url?: string;

  // Size & structure
  employee_count?: number;
  employee_range?: string;
  founded_year?: number;

  // Classification
  industry?: string;
  industry_code?: string; // NAICS/SIC
  sub_industry?: string;
  company_type?: 'public' | 'private' | 'nonprofit' | 'government';

  // Location
  headquarters_city?: string;
  headquarters_state?: string;
  headquarters_country?: string;
  full_address?: string;

  // Social & web
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  crunchbase_url?: string;

  // Funding (for startups)
  funding_total?: number;
  funding_rounds?: FundingRound[];
  last_funding_date?: string;
  last_funding_amount?: number;
  last_funding_type?: string;
  investors?: string[];

  // News & activity
  recent_news?: NewsItem[];
  recent_press_releases?: NewsItem[];

  // Technology
  tech_stack?: string[];
  technologies_detected?: TechnologyInfo[];

  // Leadership
  key_executives?: ExecutiveInfo[];

  // Additional context
  description?: string;
  tags?: string[];
  annual_revenue?: number;
  revenue_range?: string;
}

export interface FundingRound {
  date: string;
  amount: number;
  type: string; // seed, series_a, etc.
  investors?: string[];
}

export interface NewsItem {
  title: string;
  source: string;
  url?: string;
  published_date: string;
  summary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface TechnologyInfo {
  name: string;
  category: string;
  confidence: number;
}

export interface ExecutiveInfo {
  name: string;
  title: string;
  linkedin_url?: string;
}

// ============================================
// STAKEHOLDER ENRICHMENT FIELDS
// ============================================

export interface StakeholderEnrichmentData {
  // Basic info
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  email_verified?: boolean;

  // Current position
  current_title?: string;
  current_company?: string;
  tenure_months?: number;
  start_date?: string;
  department?: string;
  seniority_level?: 'entry' | 'mid' | 'senior' | 'director' | 'vp' | 'c_level';

  // LinkedIn
  linkedin_url?: string;
  linkedin_headline?: string;
  linkedin_summary?: string;
  linkedin_connections?: number;
  profile_image_url?: string;

  // Career history
  previous_positions?: CareerPosition[];
  total_experience_years?: number;

  // Education
  education?: EducationEntry[];

  // Professional details
  skills?: string[];
  interests?: string[];
  certifications?: string[];
  languages?: string[];

  // Social presence
  twitter_url?: string;
  github_url?: string;
  personal_website?: string;

  // Activity
  recent_posts?: LinkedInPost[];
  recent_activity_summary?: string;

  // Network
  mutual_connections?: MutualConnection[];
  mutual_connections_count?: number;
}

export interface CareerPosition {
  title: string;
  company: string;
  start_date?: string;
  end_date?: string;
  duration_months?: number;
  description?: string;
  location?: string;
}

export interface EducationEntry {
  school: string;
  degree?: string;
  field_of_study?: string;
  start_year?: number;
  end_year?: number;
}

export interface LinkedInPost {
  content_preview: string;
  engagement_count?: number;
  posted_date: string;
  type: 'post' | 'article' | 'share' | 'comment';
}

export interface MutualConnection {
  name: string;
  title?: string;
  company?: string;
  linkedin_url?: string;
}

// ============================================
// ENRICHMENT FIELD METADATA
// ============================================

export interface EnrichmentFieldInfo {
  field_name: string;
  value: unknown;
  confidence: number;
  source: string;
  source_url?: string;
  updated_at: Date;
  expires_at?: Date;
}

// ============================================
// ENRICHMENT STATUS & HISTORY
// ============================================

export interface EnrichmentStatusResponse {
  entity_id: string;
  entity_type: EntityType;
  status: EnrichmentStatus;
  last_enriched: Date | null;
  next_scheduled: Date | null;
  fields: Record<string, EnrichmentFieldInfo>;
  changes_detected: EnrichmentChange[];
  queue_position?: number;
}

export interface EnrichmentHistoryEntry {
  id: string;
  entity_id: string;
  entity_type: EntityType;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  change_type: 'added' | 'updated' | 'removed';
  detected_at: Date;
  source: string;
}

// ============================================
// DATA PROVIDERS
// ============================================

export type DataProvider =
  | 'clearbit'
  | 'crunchbase'
  | 'linkedin'
  | 'builtwith'
  | 'news_api'
  | 'web_scraping'
  | 'ai_inference'
  | 'manual';

export interface DataSourceResult {
  provider: DataProvider;
  data: Record<string, unknown>;
  confidence: Record<string, number>;
  fetched_at: Date;
  error?: string;
}

export interface ConsolidatedData {
  merged_data: Record<string, unknown>;
  confidence_scores: Record<string, number>;
  source_attribution: Record<string, DataProvider>;
  conflicts_resolved: ConflictResolution[];
}

export interface ConflictResolution {
  field: string;
  sources: Array<{ provider: DataProvider; value: unknown; confidence: number }>;
  selected_value: unknown;
  selected_source: DataProvider;
  reasoning: string;
}

// ============================================
// QUEUE MANAGEMENT
// ============================================

export interface EnrichmentQueueItem {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  priority: EnrichmentPriority;
  requested_fields?: string[];
  source_hints?: Record<string, string>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  last_attempt_at?: Date;
  error_message?: string;
  created_at: Date;
  completed_at?: Date;
}

// ============================================
// UI VIEW TYPES
// ============================================

export interface EnrichmentViewData {
  entity_id: string;
  entity_type: EntityType;
  entity_name: string;
  status: EnrichmentStatus;
  last_enriched: string | null;
  data_freshness: 'fresh' | 'stale' | 'outdated' | 'never';
  coverage_percentage: number;
  fields: EnrichmentFieldDisplay[];
  recent_changes: EnrichmentChange[];
  can_enrich: boolean;
}

export interface EnrichmentFieldDisplay {
  category: string;
  field_name: string;
  display_name: string;
  value: unknown;
  formatted_value: string;
  confidence: number;
  confidence_label: 'high' | 'medium' | 'low';
  source: string;
  source_icon?: string;
  last_updated: string;
  is_stale: boolean;
}

// ============================================
// CONFIGURATION
// ============================================

export interface EnrichmentConfig {
  auto_enrich_on_create: boolean;
  re_enrich_interval_days: number;
  high_priority_interval_days: number;
  stale_threshold_days: number;
  max_retries: number;
  enabled_providers: DataProvider[];
  customer_fields: string[];
  stakeholder_fields: string[];
}

export const DEFAULT_ENRICHMENT_CONFIG: EnrichmentConfig = {
  auto_enrich_on_create: true,
  re_enrich_interval_days: 30,
  high_priority_interval_days: 7,
  stale_threshold_days: 14,
  max_retries: 3,
  enabled_providers: ['clearbit', 'linkedin', 'crunchbase', 'news_api', 'ai_inference'],
  customer_fields: [
    'employee_count',
    'industry',
    'headquarters_city',
    'funding_total',
    'tech_stack',
    'recent_news',
    'key_executives'
  ],
  stakeholder_fields: [
    'linkedin_url',
    'current_title',
    'previous_positions',
    'education',
    'skills'
  ]
};

// ============================================
// FIELD DEFINITIONS
// ============================================

export const CUSTOMER_FIELD_CATEGORIES: Record<string, string[]> = {
  'Company Information': [
    'company_name',
    'domain',
    'website_url',
    'industry',
    'sub_industry',
    'employee_count',
    'founded_year',
    'company_type'
  ],
  'Location': [
    'headquarters_city',
    'headquarters_state',
    'headquarters_country',
    'full_address'
  ],
  'Funding History': [
    'funding_total',
    'last_funding_date',
    'last_funding_amount',
    'last_funding_type',
    'investors'
  ],
  'Recent News': ['recent_news'],
  'Technology Stack': ['tech_stack', 'technologies_detected'],
  'Social Profiles': ['linkedin_url', 'twitter_url', 'crunchbase_url'],
  'Leadership': ['key_executives']
};

export const STAKEHOLDER_FIELD_CATEGORIES: Record<string, string[]> = {
  'Professional Profile': [
    'current_title',
    'department',
    'seniority_level',
    'tenure_months',
    'linkedin_url',
    'linkedin_headline'
  ],
  'Career History': ['previous_positions', 'total_experience_years'],
  'Education': ['education'],
  'Skills & Interests': ['skills', 'interests', 'certifications'],
  'Connections': ['mutual_connections', 'mutual_connections_count'],
  'Recent Activity': ['recent_posts', 'recent_activity_summary']
};

// ============================================
// CONFIDENCE THRESHOLDS
// ============================================

export const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.6,
  low: 0
};

export function getConfidenceLabel(score: number): 'high' | 'medium' | 'low' {
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

export function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return 'Not available';

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    if (typeof value[0] === 'string') return value.slice(0, 5).join(', ');
    return `${value.length} items`;
  }

  // Handle numbers
  if (typeof value === 'number') {
    if (field.includes('funding') || field.includes('revenue')) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(value);
    }
    if (field.includes('count') || field.includes('employees')) {
      return new Intl.NumberFormat('en-US').format(value);
    }
    return value.toString();
  }

  // Handle dates
  if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
    try {
      return new Date(value as string).toLocaleDateString();
    } catch {
      return String(value);
    }
  }

  return String(value);
}
