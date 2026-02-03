/**
 * Universal Search Types
 * PRD-219: AI-Powered Universal Search
 *
 * Types for universal search across all data sources including
 * customers, stakeholders, emails, meetings, documents, and more.
 */

// ============================================
// Search Document Types
// ============================================

export type SearchableType =
  | 'customer'
  | 'stakeholder'
  | 'email'
  | 'meeting'
  | 'document'
  | 'playbook'
  | 'task'
  | 'note'
  | 'activity';

export interface SearchDocument {
  id: string;
  type: SearchableType;
  title: string;
  content: string;
  embedding?: number[];
  metadata: SearchDocumentMetadata;
  access_control: {
    user_ids: string[];
    public: boolean;
  };
}

export interface SearchDocumentMetadata {
  customer_id?: string;
  customer_name?: string;
  created_at: string;
  updated_at: string;
  author?: string;
  tags?: string[];
  // Type-specific metadata
  email_from?: string;
  email_to?: string[];
  meeting_date?: string;
  meeting_attendees?: string[];
  document_type?: string;
  source_url?: string;
}

// ============================================
// Query Parsing Types
// ============================================

export interface DateRange {
  from: string | null;
  to: string | null;
}

export interface ParsedQuery {
  raw_query: string;
  keywords: string[];
  filters: QueryFilters;
  natural_language_intent?: string;
  entities: ExtractedEntities;
  search_type: 'semantic' | 'keyword' | 'hybrid';
}

export interface QueryFilters {
  type?: SearchableType[];
  customer_id?: string;
  date_range?: DateRange;
  author?: string;
  tags?: string[];
}

export interface ExtractedEntities {
  person_names?: string[];
  company_names?: string[];
  dates?: string[];
  emails?: string[];
}

// ============================================
// Search Result Types
// ============================================

export interface SearchResult {
  id: string;
  type: SearchableType;
  title: string;
  snippet: string;
  relevance_score: number;
  metadata: SearchResultMetadata;
  highlight?: SearchHighlight;
  actions: SearchResultAction[];
}

export interface SearchResultMetadata {
  customer_id?: string;
  customer_name?: string;
  date?: string;
  from?: string;
  to?: string[];
  attendees?: string[];
  source_type?: string;
  source_url?: string;
}

export interface SearchHighlight {
  title?: string;
  content?: string;
}

export type SearchResultAction =
  | 'view_customer'
  | 'view_stakeholder'
  | 'open_email'
  | 'view_meeting'
  | 'view_summary'
  | 'view_recording'
  | 'open_document'
  | 'view_playbook'
  | 'view_task'
  | 'view_note';

// ============================================
// Search Response Types
// ============================================

export interface SearchResponse {
  query: string;
  parsed: ParsedQuery;
  results: SearchResult[];
  total: number;
  suggestions: string[];
  filters_applied: Record<string, string | string[]>;
  search_time_ms: number;
}

// ============================================
// Suggestion Types
// ============================================

export type SuggestionType =
  | 'query'
  | 'customer'
  | 'stakeholder'
  | 'recent'
  | 'saved';

export interface SearchSuggestion {
  type: SuggestionType;
  text: string;
  id?: string;
  category: string;
  icon?: string;
  metadata?: {
    customer_name?: string;
    role?: string;
    company?: string;
  };
}

export interface SuggestResponse {
  suggestions: SearchSuggestion[];
}

// ============================================
// User Search History Types
// ============================================

export interface UserSearch {
  id: string;
  user_id: string;
  query: string;
  filters?: QueryFilters;
  is_saved: boolean;
  name?: string;
  last_used_at: string;
  use_count: number;
  created_at: string;
}

export interface SavedSearch extends UserSearch {
  is_saved: true;
  name: string;
}

// ============================================
// Search Index Types
// ============================================

export interface SearchIndexDocument {
  id: string;
  source_type: SearchableType;
  source_id: string;
  user_id: string;
  customer_id?: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  tsv?: string; // PostgreSQL tsvector representation
  created_at: string;
  updated_at: string;
}

export interface SearchEmbedding {
  id: string;
  search_index_id: string;
  embedding: number[];
  created_at: string;
}

// ============================================
// Search API Request Types
// ============================================

export interface SearchRequest {
  q: string;
  type?: SearchableType | SearchableType[];
  customer_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface SuggestRequest {
  q: string;
  limit?: number;
}

// ============================================
// Search Filter Options
// ============================================

export interface SearchFilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface SearchFilterOptions {
  types: SearchFilterOption[];
  customers: SearchFilterOption[];
  date_ranges: SearchFilterOption[];
}

// ============================================
// Search State Types (for UI)
// ============================================

export interface SearchState {
  query: string;
  isOpen: boolean;
  isLoading: boolean;
  results: SearchResult[];
  suggestions: SearchSuggestion[];
  recentSearches: UserSearch[];
  savedSearches: SavedSearch[];
  filters: QueryFilters;
  error: string | null;
  total: number;
  hasMore: boolean;
}

// ============================================
// Type Guards
// ============================================

export function isSearchableType(value: string): value is SearchableType {
  return [
    'customer',
    'stakeholder',
    'email',
    'meeting',
    'document',
    'playbook',
    'task',
    'note',
    'activity'
  ].includes(value);
}

// ============================================
// Constants
// ============================================

export const SEARCH_TYPE_LABELS: Record<SearchableType, string> = {
  customer: 'Customer',
  stakeholder: 'Contact',
  email: 'Email',
  meeting: 'Meeting',
  document: 'Document',
  playbook: 'Playbook',
  task: 'Task',
  note: 'Note',
  activity: 'Activity'
};

export const SEARCH_TYPE_ICONS: Record<SearchableType, string> = {
  customer: 'building',
  stakeholder: 'user',
  email: 'envelope',
  meeting: 'calendar',
  document: 'document',
  playbook: 'book',
  task: 'check-circle',
  note: 'pencil',
  activity: 'clock'
};

export const DEFAULT_SEARCH_LIMIT = 20;
export const DEFAULT_SUGGESTION_LIMIT = 8;
export const MAX_RECENT_SEARCHES = 10;
