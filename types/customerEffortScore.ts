/**
 * Customer Effort Score Types
 * PRD-160: Customer Effort Score Report
 *
 * Measures and tracks how easy it is for customers to interact
 * with the product and support channels.
 */

// ============================================
// CES Scale Definition
// ============================================

export const CES_SCALE = {
  1: { label: 'Strongly Disagree', effort: 'Very High' },
  2: { label: 'Disagree', effort: 'High' },
  3: { label: 'Somewhat Disagree', effort: 'Moderate-High' },
  4: { label: 'Neutral', effort: 'Moderate' },
  5: { label: 'Somewhat Agree', effort: 'Moderate-Low' },
  6: { label: 'Agree', effort: 'Low' },
  7: { label: 'Strongly Agree', effort: 'Very Low' }
} as const;

export type CESScoreValue = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// CES thresholds for categorization
export const CES_THRESHOLDS = {
  low_effort: { min: 6, max: 7 },    // Good - customers find it easy
  neutral: { min: 4, max: 5 },       // Needs attention
  high_effort: { min: 1, max: 3 }    // Problem - customers find it hard
};

export type CESCategory = 'low_effort' | 'neutral' | 'high_effort';
export type CESTrend = 'improving' | 'stable' | 'worsening';

// ============================================
// Touchpoint Types
// ============================================

export type TouchpointType =
  | 'support_ticket'
  | 'feature_use'
  | 'onboarding'
  | 'billing'
  | 'api_integration'
  | 'training'
  | 'renewal'
  | 'other';

export const TOUCHPOINT_LABELS: Record<TouchpointType, string> = {
  support_ticket: 'Support Ticket',
  feature_use: 'Feature Use',
  onboarding: 'Onboarding',
  billing: 'Billing/Invoicing',
  api_integration: 'API Integration',
  training: 'Training',
  renewal: 'Renewal',
  other: 'Other'
};

export type SurveyChannel = 'in_app' | 'email' | 'slack';

// ============================================
// CES Survey Types
// ============================================

export interface CESSurvey {
  id: string;
  customer_id: string;
  customer_name?: string;
  user_id: string;
  user_name?: string;
  user_email?: string;

  // Context
  touchpoint: TouchpointType;
  interaction_id?: string;
  interaction_summary?: string;

  // Response
  score: CESScoreValue | null;
  feedback?: string;
  responded_at: string | null;

  // Metadata
  delivered_at: string;
  channel: SurveyChannel;
  survey_question: string;
}

// ============================================
// CES Metrics Types
// ============================================

export interface CESDistribution {
  low_effort: number;   // 6-7 (percentage)
  neutral: number;      // 4-5 (percentage)
  high_effort: number;  // 1-3 (percentage)
}

export interface CESByTouchpoint {
  touchpoint: TouchpointType;
  touchpoint_label: string;
  average: number;
  count: number;
  trend: CESTrend;
  trend_change: number;
}

export interface CESMetrics {
  customer_id: string;
  customer_name: string;
  period: string;

  scores: {
    average: number;
    count: number;
    response_rate: number;
    trend: CESTrend;
    trend_change: number;
  };

  distribution: CESDistribution;

  by_touchpoint: CESByTouchpoint[];
}

// ============================================
// Portfolio CES Types
// ============================================

export interface PortfolioCESOverview {
  average: number;
  total_responses: number;
  total_surveys_sent: number;
  response_rate: number;
  trend: CESTrend;
  trend_change: number;
}

export interface ProblemArea {
  touchpoint: TouchpointType;
  touchpoint_label: string;
  average: number;
  count: number;
  common_feedback: string[];
  affected_customers: number;
}

export interface TopPerformer {
  touchpoint: TouchpointType;
  touchpoint_label: string;
  average: number;
  count: number;
}

export interface FeedbackTheme {
  theme: string;
  count: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  example_feedback: string[];
}

export interface PortfolioCES {
  period: string;
  period_label: string;

  overall: PortfolioCESOverview;

  distribution: CESDistribution;

  by_touchpoint: CESByTouchpoint[];

  problem_areas: ProblemArea[];

  top_performers: TopPerformer[];

  feedback_themes: FeedbackTheme[];
}

// ============================================
// Trend Data Types
// ============================================

export interface CESTrendPoint {
  date: string;
  average: number;
  response_count: number;
  low_effort_pct: number;
  neutral_pct: number;
  high_effort_pct: number;
}

// ============================================
// Correlation Types
// ============================================

export interface CESCorrelation {
  metric: 'nps' | 'health_score' | 'churn_rate';
  metric_label: string;
  correlation_coefficient: number;
  correlation_strength: 'strong' | 'moderate' | 'weak';
  insight: string;
}

export interface CESChurnCorrelation {
  ces_range: string;
  churn_rate: number;
  customer_count: number;
}

// ============================================
// Customer Detail Types
// ============================================

export interface CustomerCESSurvey extends CESSurvey {
  days_ago: number;
}

export interface CustomerCESDetail {
  customer: {
    id: string;
    name: string;
    segment: string;
    arr: number;
    health_score: number;
  };

  current_ces: number;
  category: CESCategory;
  trend: CESTrend;
  trend_change: number;

  distribution: CESDistribution;

  by_touchpoint: CESByTouchpoint[];

  recent_surveys: CustomerCESSurvey[];

  feedback_themes: FeedbackTheme[];

  recommendations: string[];
}

// ============================================
// API Response Types
// ============================================

export interface CESReportResponse {
  summary: PortfolioCES;
  trends: CESTrendPoint[];
  correlations: CESCorrelation[];
  churn_correlation: CESChurnCorrelation[];
}

export interface CustomerCESResponse {
  metrics: CESMetrics;
  surveys: CustomerCESSurvey[];
  trends: CESTrendPoint[];
  recommendations: string[];
}

// ============================================
// Filter Types
// ============================================

export interface CESFilters {
  period?: 'week' | 'month' | 'quarter' | 'year';
  customer_id?: string;
  touchpoint?: TouchpointType;
  segment?: string;
  ces_filter?: 'all' | CESCategory;
  sort_by?: 'average' | 'count' | 'touchpoint' | 'trend';
  sort_order?: 'asc' | 'desc';
}

// ============================================
// Survey Submission Types
// ============================================

export interface CESSubmitRequest {
  survey_id: string;
  score: CESScoreValue;
  feedback?: string;
}

export interface CESSubmitResponse {
  success: boolean;
  message: string;
  survey_id: string;
}
