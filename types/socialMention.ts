/**
 * Social Mention Types (PRD-019)
 *
 * Type definitions for social mention sentiment tracking.
 */

// ============================================================================
// Core Types
// ============================================================================

export type SocialPlatform = 'twitter' | 'linkedin' | 'g2' | 'facebook' | 'instagram' | 'reddit' | 'other';
export type MentionSentiment = 'positive' | 'neutral' | 'negative';
export type AlertLevel = 'info' | 'warning' | 'critical';
export type SentimentTrend = 'improving' | 'stable' | 'declining';

export interface SocialMention {
  id: string;
  platform: SocialPlatform;
  author: string;
  author_handle?: string;
  author_followers?: number;
  author_verified?: boolean;
  content: string;
  posted_at: string;
  engagement: MentionEngagement;
  sentiment: MentionSentiment;
  sentiment_score: number; // -100 to +100
  themes: string[];
  customer_id?: string;
  customer_name?: string;
  match_confidence?: number;
  requires_response: boolean;
  response_status: 'pending' | 'responded' | 'ignored';
  created_at: string;
  updated_at: string;
}

export interface MentionEngagement {
  likes: number;
  shares: number;
  comments: number;
  reach?: number;
}

export interface ParsedMentionRow {
  platform?: string;
  author?: string;
  author_handle?: string;
  followers?: number;
  verified?: boolean;
  content: string;
  date?: string;
  timestamp?: string;
  posted_at?: string;
  likes?: number;
  shares?: number;
  retweets?: number;
  comments?: number;
  engagement?: number;
  reach?: number;
  url?: string;
  [key: string]: unknown;
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface SentimentAnalysisResult {
  sentiment: MentionSentiment;
  score: number;
  confidence: number;
  themes: string[];
  emotional_indicators: string[];
  risk_indicators: string[];
}

export interface CustomerMatch {
  customer_id: string;
  customer_name: string;
  confidence: number;
  match_signals: string[];
}

export interface MentionTheme {
  name: string;
  count: number;
  sentiment: MentionSentiment;
  avg_score: number;
}

// ============================================================================
// Summary & Metrics Types
// ============================================================================

export interface SocialSentimentSummary {
  upload_id: string;
  total_mentions: number;
  date_range: {
    start: string;
    end: string;
  };
  platform_breakdown: PlatformBreakdown[];
  sentiment_breakdown: SentimentBreakdown;
  sentiment_score: number;
  sentiment_trend: SentimentTrend;
  trend_change: number;
  themes: MentionTheme[];
  top_positive: SocialMention[];
  negative_mentions: SocialMention[];
  advocate_opportunities: AdvocateOpportunity[];
  unmatched_high_impact: SocialMention[];
}

export interface PlatformBreakdown {
  platform: SocialPlatform;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  avg_engagement: number;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
}

export interface AdvocateOpportunity {
  customer_id: string;
  customer_name: string;
  advocate_name: string;
  advocate_handle?: string;
  platform: SocialPlatform;
  followers: number;
  mention_id: string;
  content_preview: string;
  opportunity_type: 'amplify' | 'case_study' | 'reference' | 'speaking';
}

// ============================================================================
// Upload & Response Types
// ============================================================================

export interface UploadResult {
  upload_id: string;
  total_rows: number;
  parsed_mentions: number;
  failed_rows: number;
  platforms: SocialPlatform[];
  date_range: {
    start: string;
    end: string;
  };
}

export interface ResponseDraft {
  mention_id: string;
  response_options: ResponseOption[];
  recommended: number;
}

export interface ResponseOption {
  type: 'empathetic' | 'direct' | 'escalation';
  text: string;
  tone: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface UploadMentionsRequest {
  file_content: string;
  file_name: string;
  source_tool?: 'sprout_social' | 'hootsuite' | 'brandwatch' | 'generic';
}

export interface UploadMentionsResponse {
  success: boolean;
  upload_id: string;
  result: UploadResult;
  summary: SocialSentimentSummary;
}

export interface GetMentionsRequest {
  customer_id?: string;
  platform?: SocialPlatform;
  sentiment?: MentionSentiment;
  requires_response?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface GetMentionsResponse {
  mentions: SocialMention[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface MatchAuthorRequest {
  mention_id: string;
  author_info?: {
    handle?: string;
    bio?: string;
    location?: string;
  };
}

export interface MatchAuthorResponse {
  mention_id: string;
  matches: CustomerMatch[];
  best_match?: CustomerMatch;
}

export interface DraftResponseRequest {
  mention_id: string;
  context?: string;
}

export interface DraftResponseResponse {
  mention_id: string;
  mention_content: string;
  draft: ResponseDraft;
}

export interface TrackResponseRequest {
  mention_id: string;
  response_sent: boolean;
  response_text?: string;
}

export interface TrackResponseResponse {
  success: boolean;
  mention_id: string;
  response_status: 'pending' | 'responded' | 'ignored';
}

// ============================================================================
// Portfolio Types
// ============================================================================

export interface PortfolioSocialMetrics {
  overall_sentiment_score: number;
  share_of_voice: number;
  total_mentions_30d: number;
  response_rate: number;
  avg_response_time_hours: number;
  sentiment_trend: SentimentTrend;
  trend_change_30d: number;
  platform_distribution: Record<SocialPlatform, number>;
  advocate_count: number;
  detractor_count: number;
}

// ============================================================================
// CSV Field Mappings
// ============================================================================

export interface CSVFieldMapping {
  platform: string[];
  author: string[];
  author_handle: string[];
  followers: string[];
  verified: string[];
  content: string[];
  date: string[];
  likes: string[];
  shares: string[];
  comments: string[];
  reach: string[];
  url: string[];
}

export const DEFAULT_CSV_FIELD_MAPPINGS: CSVFieldMapping = {
  platform: ['platform', 'network', 'source', 'channel', 'social_network'],
  author: ['author', 'user', 'name', 'author_name', 'user_name', 'from', 'sender'],
  author_handle: ['handle', 'username', 'screen_name', 'author_handle', 'user_handle', '@handle'],
  followers: ['followers', 'follower_count', 'followers_count', 'audience_size'],
  verified: ['verified', 'is_verified', 'blue_check', 'verified_account'],
  content: ['content', 'text', 'message', 'post', 'tweet', 'body', 'mention_text'],
  date: ['date', 'timestamp', 'posted_at', 'created_at', 'time', 'post_date', 'published'],
  likes: ['likes', 'like_count', 'favorites', 'reactions', 'love'],
  shares: ['shares', 'retweets', 'reposts', 'share_count', 'rt_count'],
  comments: ['comments', 'replies', 'reply_count', 'comment_count', 'responses'],
  reach: ['reach', 'impressions', 'views', 'potential_reach', 'exposure'],
  url: ['url', 'link', 'post_url', 'permalink', 'source_url'],
};
