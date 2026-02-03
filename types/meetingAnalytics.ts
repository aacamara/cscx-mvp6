/**
 * Meeting Analytics Types (PRD-166)
 *
 * Provides comprehensive meeting analytics including:
 * - Meeting volume and frequency tracking
 * - Sentiment analysis and trends
 * - Action item tracking and completion rates
 * - Participant and stakeholder engagement analysis
 * - Topic analysis and concern detection
 * - Meeting outcome correlation
 */

// ============================================
// Core Meeting Types
// ============================================

export type MeetingAnalyticsType = 'qbr' | 'check_in' | 'kickoff' | 'training' | 'escalation' | 'executive' | 'other';
export type MeetingAnalyticsSentiment = 'positive' | 'neutral' | 'negative' | 'mixed';
export type SentimentTrend = 'improving' | 'stable' | 'declining';
export type ActionItemAnalyticsStatus = 'pending' | 'completed' | 'overdue';

/**
 * Meeting record for analytics
 */
export interface MeetingRecord {
  id: string;
  customer_id: string;
  csm_id: string;

  // Meeting details
  title: string;
  meeting_type: MeetingAnalyticsType;
  scheduled_at: string;
  duration_minutes: number;
  occurred: boolean;

  // Participants
  internal_attendees: string[];
  external_attendees: string[];
  stakeholder_levels: string[];

  // Analysis (from transcript)
  sentiment: MeetingAnalyticsSentiment;
  sentiment_score: number; // 0-10 scale
  key_topics: string[];
  concerns_raised: string[];
  risk_signals: string[];
  expansion_signals: string[];

  // Outcomes
  action_items: MeetingActionItemRecord[];
  commitments: MeetingCommitment[];
  follow_up_scheduled: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Action item from meeting
 */
export interface MeetingActionItemRecord {
  id: string;
  description: string;
  owner: string;
  owner_type: 'internal' | 'customer';
  due_date: string;
  status: ActionItemAnalyticsStatus;
  completed_at?: string;
  meeting_id: string;
  meeting_date: string;
}

/**
 * Commitment made in meeting
 */
export interface MeetingCommitment {
  id: string;
  description: string;
  party: 'us' | 'customer' | 'mutual';
  deadline?: string;
  status: 'pending' | 'fulfilled' | 'broken';
}

// ============================================
// Volume Metrics
// ============================================

/**
 * Meeting volume statistics
 */
export interface MeetingVolumeMetrics {
  total_meetings: number;
  total_duration_minutes: number;
  avg_duration_minutes: number;
  by_type: Record<MeetingAnalyticsType, number>;
  occurred_count: number;
  no_show_count: number;
  cancellation_rate: number;
}

// ============================================
// Sentiment Metrics
// ============================================

/**
 * Meeting sentiment analysis
 */
export interface MeetingSentimentMetrics {
  avg_sentiment_score: number;
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  mixed_count: number;
  positive_pct: number;
  negative_pct: number;
  trend: SentimentTrend;
  trend_change: number;
}

// ============================================
// Action Item Metrics
// ============================================

/**
 * Action item tracking metrics
 */
export interface ActionItemMetrics {
  total_created: number;
  completed: number;
  pending: number;
  overdue: number;
  completion_rate: number;
  avg_completion_days: number;
  by_owner_type: {
    internal: { total: number; completed: number; rate: number };
    customer: { total: number; completed: number; rate: number };
  };
}

// ============================================
// Engagement Metrics
// ============================================

/**
 * Meeting engagement analysis
 */
export interface MeetingEngagementMetrics {
  unique_stakeholders: number;
  executive_meetings: number;
  executive_meeting_pct: number;
  avg_attendees: number;
  avg_internal_attendees: number;
  avg_external_attendees: number;
  multi_threaded_pct: number;
}

// ============================================
// Topic Analysis
// ============================================

/**
 * Topic frequency analysis
 */
export interface TopicAnalysis {
  topic: string;
  count: number;
  percentage: number;
  last_mentioned: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Concern tracking
 */
export interface ConcernAnalysis {
  concern: string;
  severity: 'low' | 'medium' | 'high';
  first_raised: string;
  last_mentioned: string;
  mention_count: number;
  resolved: boolean;
}

// ============================================
// Customer Meeting Analytics
// ============================================

/**
 * Full meeting analytics for a customer
 */
export interface CustomerMeetingAnalytics {
  customer_id: string;
  customer_name?: string;
  period: string;
  period_start: string;
  period_end: string;

  volume: MeetingVolumeMetrics;
  sentiment: MeetingSentimentMetrics;
  action_items: ActionItemMetrics;
  engagement: MeetingEngagementMetrics;

  top_topics: TopicAnalysis[];
  recent_concerns: ConcernAnalysis[];
  risk_signals: string[];
  expansion_signals: string[];

  // Comparison
  vs_portfolio_avg: {
    meetings: number;
    sentiment: number;
    action_completion: number;
  };

  // Recommendations
  cadence_recommendation?: string;
  next_meeting_suggestion?: string;
}

// ============================================
// Portfolio Summary
// ============================================

/**
 * Portfolio-wide meeting summary
 */
export interface PortfolioMeetingSummary {
  period: string;
  total_customers: number;
  customers_with_meetings: number;
  customers_without_recent_meeting: number;

  volume: MeetingVolumeMetrics;
  sentiment: MeetingSentimentMetrics;
  action_items: ActionItemMetrics;

  // Distribution
  meeting_distribution: {
    high: { count: number; pct: number }; // 5+ meetings
    healthy: { count: number; pct: number }; // 2-4 meetings
    low: { count: number; pct: number }; // 1 meeting
    none: { count: number; pct: number }; // 0 meetings
  };

  // Alerts
  customers_needing_attention: CustomerMeetingAlert[];
}

/**
 * Customer meeting alert
 */
export interface CustomerMeetingAlert {
  customer_id: string;
  customer_name: string;
  alert_type: 'no_meeting' | 'low_sentiment' | 'overdue_actions' | 'declining_engagement';
  severity: 'low' | 'medium' | 'high';
  message: string;
  days_since_meeting?: number;
  sentiment_score?: number;
  overdue_count?: number;
}

// ============================================
// Trend Data
// ============================================

/**
 * Meeting trend data point
 */
export interface MeetingTrendPoint {
  period: string;
  meeting_count: number;
  avg_sentiment: number;
  action_completion_rate: number;
  unique_stakeholders: number;
}

/**
 * Meeting trends analysis
 */
export interface MeetingTrends {
  customer_id?: string;
  data_points: MeetingTrendPoint[];
  summary: {
    meeting_trend: 'increasing' | 'stable' | 'decreasing';
    sentiment_trend: SentimentTrend;
    engagement_trend: 'improving' | 'stable' | 'declining';
  };
}

// ============================================
// Insights
// ============================================

/**
 * Meeting insight
 */
export interface MeetingInsight {
  id: string;
  type: 'positive' | 'warning' | 'action_required';
  category: 'cadence' | 'sentiment' | 'action_items' | 'engagement' | 'topics';
  title: string;
  description: string;
  customer_id?: string;
  customer_name?: string;
  metric_value?: number;
  benchmark_value?: number;
  recommendation?: string;
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Meeting analytics query parameters
 */
export interface MeetingAnalyticsQuery {
  csm_id?: string;
  customer_id?: string;
  period?: 'month' | 'quarter' | 'year';
  meeting_type?: MeetingAnalyticsType;
  start_date?: string;
  end_date?: string;
}

/**
 * Portfolio meeting analytics response
 */
export interface PortfolioMeetingAnalyticsResponse {
  summary: PortfolioMeetingSummary;
  customers: CustomerMeetingStats[];
  trends: MeetingTrendPoint[];
  insights: MeetingInsight[];
  generated_at: string;
}

/**
 * Customer meeting stats (summary row)
 */
export interface CustomerMeetingStats {
  customer_id: string;
  customer_name: string;
  meeting_count: number;
  total_duration: number;
  avg_sentiment: number;
  sentiment_trend: SentimentTrend;
  action_completion_rate: number;
  last_meeting_date?: string;
  days_since_meeting: number;
  needs_attention: boolean;
  attention_reason?: string;
}

/**
 * Customer meeting detail response
 */
export interface CustomerMeetingDetailResponse {
  analytics: CustomerMeetingAnalytics;
  meetings: MeetingRecord[];
  action_items: MeetingActionItemRecord[];
  trends: MeetingTrendPoint[];
}

// ============================================
// Meeting Type Metadata
// ============================================

export const MEETING_TYPE_INFO: Record<MeetingAnalyticsType, {
  label: string;
  description: string;
  recommended_frequency: string;
  typical_duration: number;
}> = {
  qbr: {
    label: 'QBR',
    description: 'Quarterly Business Review',
    recommended_frequency: 'Quarterly',
    typical_duration: 90,
  },
  check_in: {
    label: 'Check-in',
    description: 'Regular touchpoint meeting',
    recommended_frequency: 'Monthly',
    typical_duration: 30,
  },
  kickoff: {
    label: 'Kickoff',
    description: 'Initial onboarding meeting',
    recommended_frequency: 'Once',
    typical_duration: 60,
  },
  training: {
    label: 'Training',
    description: 'Product training session',
    recommended_frequency: 'As needed',
    typical_duration: 60,
  },
  escalation: {
    label: 'Escalation',
    description: 'Issue resolution meeting',
    recommended_frequency: 'As needed',
    typical_duration: 45,
  },
  executive: {
    label: 'Executive',
    description: 'Executive-to-executive alignment',
    recommended_frequency: 'Quarterly',
    typical_duration: 60,
  },
  other: {
    label: 'Other',
    description: 'Other meeting type',
    recommended_frequency: 'Varies',
    typical_duration: 30,
  },
};

// ============================================
// Benchmarks
// ============================================

export interface MeetingBenchmarks {
  segment: string;
  meetings_per_quarter: { min: number; max: number; target: number };
  avg_sentiment_score: { healthy: number; warning: number };
  action_completion_rate: { target: number; minimum: number };
  executive_meeting_frequency: string;
  max_days_between_meetings: number;
}

export const DEFAULT_MEETING_BENCHMARKS: Record<string, MeetingBenchmarks> = {
  enterprise: {
    segment: 'enterprise',
    meetings_per_quarter: { min: 6, max: 12, target: 8 },
    avg_sentiment_score: { healthy: 7.0, warning: 5.0 },
    action_completion_rate: { target: 0.90, minimum: 0.75 },
    executive_meeting_frequency: 'Quarterly',
    max_days_between_meetings: 21,
  },
  mid_market: {
    segment: 'mid_market',
    meetings_per_quarter: { min: 3, max: 6, target: 4 },
    avg_sentiment_score: { healthy: 7.0, warning: 5.0 },
    action_completion_rate: { target: 0.85, minimum: 0.70 },
    executive_meeting_frequency: 'Bi-annually',
    max_days_between_meetings: 30,
  },
  smb: {
    segment: 'smb',
    meetings_per_quarter: { min: 1, max: 3, target: 2 },
    avg_sentiment_score: { healthy: 7.0, warning: 5.0 },
    action_completion_rate: { target: 0.80, minimum: 0.65 },
    executive_meeting_frequency: 'Annually',
    max_days_between_meetings: 45,
  },
};
