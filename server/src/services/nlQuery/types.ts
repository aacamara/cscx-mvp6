/**
 * Natural Language Query Types
 * PRD-211: Natural Language Account Query
 */

/**
 * Query intent types as defined in the PRD
 */
export type QueryIntent =
  | 'account_summary'      // General account information ("Tell me about X")
  | 'account_list'         // Filtered list of accounts ("Show me accounts with...")
  | 'metric_query'         // Specific metric values ("What's the health score for...")
  | 'stakeholder_query'    // Contact/relationship information ("Who are the contacts at...")
  | 'usage_query'          // Product usage data ("How is X using the product?")
  | 'timeline_query'       // Historical events ("What happened with X last month?")
  | 'comparison_query'     // Compare multiple accounts ("Compare X and Y")
  | 'aggregation_query'    // Portfolio-level metrics ("Total ARR at risk")
  | 'email_query'          // Email search/summary ("emails from X", "what did Y say", "recent emails about Z")
  | 'email_summary';       // Email summarization ("summarize emails from X")

/**
 * Extracted entities from the query
 */
export interface QueryEntities {
  account_names?: string[];
  account_ids?: string[];
  date_range?: {
    start: string;
    end: string;
    relative?: string; // "last month", "Q1 2026", etc.
  };
  filters?: {
    industry?: string[];
    segment?: string[];
    health_score_min?: number;
    health_score_max?: number;
    arr_min?: number;
    arr_max?: number;
    status?: string[];
  };
  metrics?: string[];
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  // Email-related entities
  email_sender?: string;      // "from X", sender email or name
  email_recipient?: string;   // "to X", recipient email or name
  email_subject?: string;     // "about X", subject keywords
  email_keywords?: string[];  // Keywords to search in body
  unread_only?: boolean;      // Filter to unread emails
  important_only?: boolean;   // Filter to important emails
}

/**
 * Query classification result from AI
 */
export interface QueryClassification {
  intent: QueryIntent;
  confidence: number;
  entities: QueryEntities;
  reasoning?: string;
}

/**
 * Customer summary data
 */
export interface CustomerSummary {
  id: string;
  name: string;
  arr: number;
  health_score: number;
  industry?: string;
  segment?: string;
  stage: string;
  renewal_date?: string;
  days_until_renewal?: number;
  csm_name?: string;
}

/**
 * Stakeholder data
 */
export interface StakeholderData {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
  sentiment?: string;
  linkedin_url?: string;
}

/**
 * Risk signal data
 */
export interface RiskSignalData {
  id: string;
  signal_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detected_at: string;
  resolved_at?: string;
}

/**
 * Usage data
 */
export interface UsageData {
  dau: number;
  wau: number;
  mau: number;
  adoption_score: number;
  usage_trend: 'growing' | 'stable' | 'declining';
  feature_adoption?: Record<string, boolean>;
  login_count?: number;
}

/**
 * Activity data
 */
export interface ActivityData {
  id: string;
  type: string;
  title: string;
  description?: string;
  date: string;
  user?: string;
}

/**
 * Query response data structure
 */
export interface QueryData {
  customer?: CustomerSummary;
  customers?: CustomerSummary[];
  stakeholders?: StakeholderData[];
  risk_signals?: RiskSignalData[];
  usage?: UsageData;
  recent_activity?: ActivityData[];
  metrics?: Record<string, number | string>;
  aggregations?: Record<string, number>;
  comparison?: {
    accounts: CustomerSummary[];
    metrics: Record<string, Record<string, number>>;
  };
  // Email-related data
  emails?: EmailData[];
  email_summary?: EmailSummaryData;
}

/**
 * Email data for query responses
 */
export interface EmailData {
  id: string;
  subject: string;
  from_email: string;
  from_name?: string;
  to_emails: string[];
  date: string;
  snippet?: string;
  is_read: boolean;
  is_important: boolean;
  customer_id?: string;
  customer_name?: string;
}

/**
 * Email summary data
 */
export interface EmailSummaryData {
  summary: string;
  key_points: string[];
  action_items: Array<{
    description: string;
    owner?: string;
    urgency: 'high' | 'medium' | 'low';
  }>;
  mentioned_customers: Array<{
    id?: string;
    name: string;
    mentions: number;
  }>;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  email_count: number;
}

/**
 * Visualization specification
 */
export interface VisualizationSpec {
  type: 'health_gauge' | 'sparkline' | 'bar_chart' | 'table' | 'card' | 'list';
  title: string;
  data: unknown;
  config?: Record<string, unknown>;
}

/**
 * Suggested follow-up action
 */
export interface SuggestedAction {
  label: string;
  query: string;
  icon?: string;
}

/**
 * Full query response as defined in PRD
 */
export interface QueryResponse {
  intent: QueryIntent;
  entities: QueryEntities;
  data: QueryData;
  summary: string;
  visualizations?: VisualizationSpec[];
  suggestions: SuggestedAction[];
  processing_time_ms: number;
  session_id?: string;
}

/**
 * Query request as defined in PRD
 */
export interface QueryRequest {
  query: string;
  session_id?: string;
  include_visualization?: boolean;
  user_id: string;
  context?: {
    previous_query?: string;
    previous_entities?: QueryEntities;
  };
}

/**
 * Query session for conversation context
 */
export interface QuerySession {
  id: string;
  user_id: string;
  queries: Array<{
    query: string;
    intent: QueryIntent;
    entities: QueryEntities;
    timestamp: Date;
  }>;
  created_at: Date;
  last_query_at: Date;
}

/**
 * Account match result for fuzzy matching
 */
export interface AccountMatch {
  id: string;
  name: string;
  score: number;
  matched_on: 'exact' | 'fuzzy' | 'alias';
}

/**
 * Error response
 */
export interface QueryError {
  code: string;
  message: string;
  suggestions?: string[];
  ambiguous_matches?: AccountMatch[];
}
