/**
 * PRD-157: Engagement Metrics Report Types
 * TypeScript interfaces for engagement tracking and reporting
 */

// ============================================
// Activity Types
// ============================================

export type EngagementActivityType = 'email' | 'meeting' | 'call' | 'qbr' | 'message' | 'event';
export type ActivityDirection = 'inbound' | 'outbound';
export type StakeholderLevel = 'executive' | 'champion' | 'user';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface EngagementActivity {
  id: string;
  customer_id: string;
  user_id?: string;
  type: EngagementActivityType;
  direction: ActivityDirection;
  date: string;
  duration_minutes?: number;
  participants: string[];
  stakeholder_level?: StakeholderLevel;
  response_received?: boolean;
  response_time_hours?: number;
  sentiment?: Sentiment;
  source: string;
  external_id?: string;
  subject?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================
// Metrics & Scoring
// ============================================

export type EngagementCategory = 'high' | 'healthy' | 'low' | 'at_risk';
export type EngagementTrend = 'improving' | 'stable' | 'declining';

export interface EngagementActivities {
  emails_sent: number;
  emails_received: number;
  meetings_held: number;
  meeting_minutes: number;
  calls_made: number;
  qbrs_completed: number;
  messages_sent: number;
  events_attended: number;
}

export interface EngagementQuality {
  response_rate: number;
  avg_response_time_hours: number;
  stakeholders_engaged: number;
  executive_touchpoints: number;
}

export interface EngagementScore {
  engagement_score: number;
  category: EngagementCategory;
  trend: EngagementTrend;
  change_from_last_period: number;
}

export interface LastContact {
  date: string;
  type: EngagementActivityType;
  days_ago: number;
}

export interface EngagementMetrics {
  customer_id: string;
  customer_name: string;
  period: string;
  period_start: string;
  period_end: string;
  activities: EngagementActivities;
  quality: EngagementQuality;
  score: EngagementScore;
  last_contact: LastContact;
}

// ============================================
// Score Calculation
// ============================================

export interface EngagementScoreWeights {
  email_volume: number;
  email_response: number;
  meeting_frequency: number;
  meeting_quality: number;
  stakeholder_breadth: number;
  recency: number;
}

export const DEFAULT_ENGAGEMENT_WEIGHTS: EngagementScoreWeights = {
  email_volume: 0.15,
  email_response: 0.20,
  meeting_frequency: 0.25,
  meeting_quality: 0.15,
  stakeholder_breadth: 0.15,
  recency: 0.10,
};

// ============================================
// Alerts
// ============================================

export type EngagementAlertType =
  | 'low_engagement'
  | 'declining_engagement'
  | 'no_contact'
  | 'no_response'
  | 'executive_gap';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';

export interface EngagementAlert {
  id: string;
  customer_id: string;
  customer_name?: string;
  user_id?: string;
  alert_type: EngagementAlertType;
  severity: AlertSeverity;
  message: string;
  details?: Record<string, unknown>;
  status: AlertStatus;
  acknowledged_at?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Portfolio Summary
// ============================================

export interface EngagementDistribution {
  high: number;
  healthy: number;
  low: number;
  at_risk: number;
}

export interface PortfolioEngagementSummary {
  total_customers: number;
  avg_engagement_score: number;
  score_change: number;
  distribution: EngagementDistribution;
  distribution_percentages: EngagementDistribution;
  customers_needing_attention: Array<{
    customer_id: string;
    customer_name: string;
    engagement_score: number;
    days_since_contact: number;
    response_rate: number;
    issue: string;
  }>;
}

// ============================================
// Trend Analysis
// ============================================

export interface EngagementTrendPoint {
  period: string;
  engagement_score: number;
  activities_count: number;
  response_rate: number;
}

export interface EngagementTrends {
  customer_id: string;
  customer_name: string;
  periods: EngagementTrendPoint[];
  overall_trend: EngagementTrend;
  trend_slope: number;
}

// ============================================
// Correlation Analysis
// ============================================

export interface EngagementCorrelation {
  outcome: 'health' | 'renewal' | 'churn';
  correlation_coefficient: number;
  sample_size: number;
  insights: string[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface GetEngagementMetricsQuery {
  csm_id?: string;
  period?: 'week' | 'month' | 'quarter' | 'year';
  segment?: string;
  min_score?: number;
  max_score?: number;
  category?: EngagementCategory;
}

export interface GetEngagementMetricsResponse {
  portfolio_summary: PortfolioEngagementSummary;
  customers: EngagementMetrics[];
  generated_at: string;
}

export interface GetCustomerEngagementResponse {
  metrics: EngagementMetrics;
  recent_activities: EngagementActivity[];
  stakeholder_coverage: Array<{
    name: string;
    role: string;
    last_contact_date: string;
    engagement_level: 'high' | 'medium' | 'low';
    touchpoints_this_period: number;
  }>;
  alerts: EngagementAlert[];
}

export interface CreateActivityRequest {
  customer_id: string;
  type: EngagementActivityType;
  direction: ActivityDirection;
  date?: string;
  duration_minutes?: number;
  participants?: string[];
  stakeholder_level?: StakeholderLevel;
  response_received?: boolean;
  source?: string;
  subject?: string;
  notes?: string;
}
