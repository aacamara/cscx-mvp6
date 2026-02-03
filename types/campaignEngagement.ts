/**
 * PRD-141: Bulk Email Engagement Tracking Types
 * TypeScript interfaces for campaign email engagement tracking
 */

// ============================================
// Campaign Types
// ============================================

export type CampaignType = 'announcement' | 'newsletter' | 'marketing' | 'product_update' | 'company_communication';
export type EngagementEventType = 'delivered' | 'opened' | 'clicked' | 'replied' | 'forwarded' | 'unsubscribed' | 'bounced';
export type FollowUpPriority = 'high' | 'medium' | 'low' | 'none';
export type FollowUpStatus = 'pending' | 'scheduled' | 'completed' | 'skipped';

// ============================================
// Core Data Models
// ============================================

/**
 * Bulk email campaign record
 */
export interface BulkEmailCampaign {
  id: string;
  campaign_name: string;
  campaign_type: CampaignType;
  subject: string;
  sender_email: string;
  sender_name: string;
  sent_at: string;
  total_recipients: number;
  matched_customers: number;
  external_campaign_id?: string;
  source: string; // e.g., 'mailchimp', 'sendgrid', 'hubspot', 'manual'
  content_preview?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Individual customer engagement with a campaign
 */
export interface CustomerCampaignEngagement {
  id: string;
  campaign_id: string;
  customer_id: string;
  stakeholder_id?: string;
  email: string;
  stakeholder_name?: string;
  stakeholder_role?: string;
  engagement: CampaignEngagementDetails;
  follow_up: FollowUpDetails;
  created_at: string;
  updated_at: string;
}

/**
 * Detailed engagement tracking
 */
export interface CampaignEngagementDetails {
  delivered: boolean;
  delivered_at?: string;
  opened: boolean;
  opened_at?: string;
  open_count: number;
  clicked: boolean;
  clicked_at?: string;
  clicked_links: ClickedLink[];
  replied: boolean;
  replied_at?: string;
  forwarded: boolean;
  forwarded_at?: string;
  unsubscribed: boolean;
  unsubscribed_at?: string;
  bounced: boolean;
  bounced_at?: string;
  bounce_reason?: string;
}

/**
 * Clicked link tracking
 */
export interface ClickedLink {
  url: string;
  clicked_at: string;
  click_count: number;
}

/**
 * Follow-up recommendation and status
 */
export interface FollowUpDetails {
  recommended: boolean;
  priority: FollowUpPriority;
  reason?: string;
  suggested_action?: string;
  suggested_talking_points?: string[];
  best_time_to_reach?: string;
  status: FollowUpStatus;
  scheduled_at?: string;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
}

// ============================================
// Aggregated Analytics
// ============================================

/**
 * Campaign-level analytics
 */
export interface CampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  campaign_type: CampaignType;
  sent_at: string;
  metrics: CampaignMetrics;
  segment_breakdown: SegmentEngagement[];
  top_clicked_links: TopClickedLink[];
  follow_up_summary: FollowUpSummary;
}

/**
 * Aggregate metrics for a campaign
 */
export interface CampaignMetrics {
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  total_unsubscribed: number;
  total_bounced: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  unsubscribe_rate: number;
  bounce_rate: number;
  avg_opens_per_recipient: number;
}

/**
 * Engagement breakdown by customer segment
 */
export interface SegmentEngagement {
  segment: string;
  recipients: number;
  opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
}

/**
 * Top clicked link in a campaign
 */
export interface TopClickedLink {
  url: string;
  url_label?: string;
  click_count: number;
  unique_clickers: number;
}

/**
 * Follow-up summary for a campaign
 */
export interface FollowUpSummary {
  total_recommended: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  completed: number;
  pending: number;
}

// ============================================
// Customer-Level Views
// ============================================

/**
 * Customer's campaign engagement history
 */
export interface CustomerCampaignHistory {
  customer_id: string;
  customer_name: string;
  total_campaigns_received: number;
  engagement_summary: CustomerEngagementSummary;
  content_preferences: ContentPreference[];
  recent_engagements: RecentCampaignEngagement[];
  engagement_trend: EngagementTrendData;
}

/**
 * Summary of customer's campaign engagement
 */
export interface CustomerEngagementSummary {
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  avg_open_rate: number;
  avg_click_rate: number;
  last_engaged_campaign?: string;
  last_engaged_at?: string;
  days_since_last_engagement: number;
  engagement_score: number;
  engagement_category: 'highly_engaged' | 'engaged' | 'passive' | 'disengaged';
}

/**
 * Content type preferences based on engagement
 */
export interface ContentPreference {
  content_type: CampaignType;
  open_rate: number;
  click_rate: number;
  campaigns_received: number;
  preference_score: number;
}

/**
 * Recent campaign engagement for quick view
 */
export interface RecentCampaignEngagement {
  campaign_id: string;
  campaign_name: string;
  campaign_type: CampaignType;
  sent_at: string;
  opened: boolean;
  clicked: boolean;
  clicked_links: string[];
  follow_up_status: FollowUpStatus;
}

/**
 * Engagement trend over time
 */
export interface EngagementTrendData {
  periods: EngagementTrendPeriod[];
  trend_direction: 'improving' | 'stable' | 'declining';
  trend_percentage: number;
}

/**
 * Single period in engagement trend
 */
export interface EngagementTrendPeriod {
  period: string;
  campaigns_received: number;
  open_rate: number;
  click_rate: number;
}

// ============================================
// Follow-Up Recommendations
// ============================================

/**
 * Follow-up recommendation with context
 */
export interface FollowUpRecommendation {
  customer_id: string;
  customer_name: string;
  stakeholder_name?: string;
  stakeholder_email: string;
  stakeholder_role?: string;
  campaign_id: string;
  campaign_name: string;
  priority: FollowUpPriority;
  reason: string;
  engagement_summary: {
    opened: boolean;
    open_count: number;
    clicked: boolean;
    clicked_content: string[];
  };
  suggested_action: string;
  talking_points: string[];
  best_time_to_reach?: string;
  topics_of_interest: string[];
  csm_id?: string;
  created_at: string;
}

/**
 * Grouped follow-up recommendations
 */
export interface GroupedFollowUpRecommendations {
  high_priority: FollowUpRecommendation[];
  medium_priority: FollowUpRecommendation[];
  low_priority: FollowUpRecommendation[];
  total_count: number;
  summary: {
    highly_engaged_to_contact: number;
    content_interest_followups: number;
    disengaged_check_ins: number;
    unsubscribe_risk_flags: number;
  };
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Request to record a campaign
 */
export interface RecordCampaignRequest {
  campaign_name: string;
  campaign_type: CampaignType;
  subject: string;
  sender_email: string;
  sender_name?: string;
  sent_at?: string;
  external_campaign_id?: string;
  source: string;
  content_preview?: string;
  tags?: string[];
  recipients: CampaignRecipient[];
}

/**
 * Recipient in a campaign
 */
export interface CampaignRecipient {
  email: string;
  customer_id?: string;
  stakeholder_id?: string;
  stakeholder_name?: string;
  stakeholder_role?: string;
}

/**
 * Request to record engagement event
 */
export interface RecordEngagementRequest {
  campaign_id: string;
  email: string;
  event_type: EngagementEventType;
  event_data?: {
    link_url?: string;
    bounce_reason?: string;
    forwarded_to?: string;
  };
  timestamp?: string;
}

/**
 * Webhook payload from email service
 */
export interface EngagementWebhookPayload {
  source: string;
  event_type: EngagementEventType;
  campaign_id?: string;
  external_campaign_id?: string;
  email: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

/**
 * Request to mark follow-up as completed
 */
export interface CompleteFollowUpRequest {
  engagement_id: string;
  notes?: string;
  outcome?: 'positive' | 'neutral' | 'negative';
}

/**
 * Query parameters for recommendations
 */
export interface RecommendationsQuery {
  csm_id?: string;
  priority?: FollowUpPriority;
  campaign_id?: string;
  campaign_type?: CampaignType;
  limit?: number;
  include_completed?: boolean;
}

/**
 * Query parameters for campaign list
 */
export interface CampaignListQuery {
  page?: number;
  limit?: number;
  campaign_type?: CampaignType;
  source?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

/**
 * Paginated campaign list response
 */
export interface CampaignListResponse {
  campaigns: BulkEmailCampaign[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

/**
 * Customer campaign engagement response
 */
export interface CustomerCampaignEngagementResponse {
  history: CustomerCampaignHistory;
  recommendations: FollowUpRecommendation[];
}

// ============================================
// Portfolio Analytics
// ============================================

/**
 * Portfolio-level campaign engagement summary
 */
export interface PortfolioCampaignSummary {
  period: string;
  total_campaigns: number;
  total_customers_reached: number;
  total_stakeholders_reached: number;
  overall_metrics: {
    avg_open_rate: number;
    avg_click_rate: number;
    avg_reply_rate: number;
    avg_unsubscribe_rate: number;
  };
  engagement_distribution: {
    highly_engaged: number;
    engaged: number;
    passive: number;
    disengaged: number;
  };
  top_performing_campaigns: TopPerformingCampaign[];
  content_type_performance: ContentTypePerformance[];
  optimal_send_times: OptimalSendTime[];
}

/**
 * Top performing campaign summary
 */
export interface TopPerformingCampaign {
  campaign_id: string;
  campaign_name: string;
  campaign_type: CampaignType;
  sent_at: string;
  open_rate: number;
  click_rate: number;
  engagement_score: number;
}

/**
 * Content type performance analysis
 */
export interface ContentTypePerformance {
  content_type: CampaignType;
  campaigns_sent: number;
  avg_open_rate: number;
  avg_click_rate: number;
  avg_reply_rate: number;
  performance_trend: 'improving' | 'stable' | 'declining';
}

/**
 * Optimal send time analysis
 */
export interface OptimalSendTime {
  day_of_week: string;
  hour: number;
  open_rate: number;
  click_rate: number;
  sample_size: number;
}
