/**
 * Company News Types (PRD-096)
 *
 * Types for company news monitoring, alerts, and talking points.
 */

// ============================================
// News Categories
// ============================================

export type NewsCategory =
  | 'funding'
  | 'acquisition'
  | 'layoffs'
  | 'product'
  | 'earnings'
  | 'leadership'
  | 'partnership'
  | 'expansion'
  | 'regulatory'
  | 'other';

export type NewsSentiment = 'positive' | 'negative' | 'neutral';

export type NewsSource =
  | 'google_news'
  | 'crunchbase'
  | 'pr_newswire'
  | 'sec_filing'
  | 'company_blog'
  | 'linkedin'
  | 'twitter'
  | 'manual';

export type NewsAlertStatus =
  | 'pending'
  | 'alerted'
  | 'acknowledged'
  | 'action_taken'
  | 'dismissed';

// ============================================
// Core Data Models
// ============================================

/**
 * Company news article record
 */
export interface CompanyNews {
  id: string;
  customerId: string;
  headline: string;
  summary: string;
  source: NewsSource;
  sourceUrl: string;
  category: NewsCategory;
  sentiment: NewsSentiment;
  impactAssessment: NewsImpactAssessment;
  talkingPoints: string[];
  suggestedActions: NewsSuggestedAction[];
  publishedAt: Date;
  detectedAt: Date;
  alertStatus: NewsAlertStatus;
  alertedAt?: Date;
  acknowledgedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Impact assessment for company news
 */
export interface NewsImpactAssessment {
  impactLevel: 'high' | 'medium' | 'low';
  opportunities: string[];
  risks: string[];
  customerRelevance: string;
  urgency: 'immediate' | 'within_week' | 'within_month' | 'informational';
  expansionSignal: boolean;
  churnRisk: boolean;
}

/**
 * Suggested action based on news
 */
export interface NewsSuggestedAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  type: 'outreach' | 'meeting' | 'internal' | 'monitor';
  draftAvailable?: boolean;
}

/**
 * News monitoring configuration
 */
export interface NewsMonitoringConfig {
  id: string;
  customerId: string;
  enabled: boolean;
  categories: NewsCategory[];
  keywords?: string[];
  excludeKeywords?: string[];
  minRelevanceScore: number;
  alertPreferences: {
    realTime: boolean;
    dailyDigest: boolean;
    digestTime?: string; // HH:MM format
  };
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Create news input
 */
export interface CompanyNewsCreateInput {
  customerId: string;
  headline: string;
  summary: string;
  source: NewsSource;
  sourceUrl: string;
  category: NewsCategory;
  sentiment?: NewsSentiment;
  publishedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * News list filters
 */
export interface NewsListFilters {
  customerId?: string;
  category?: NewsCategory;
  sentiment?: NewsSentiment;
  alertStatus?: NewsAlertStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * News summary for a customer
 */
export interface CustomerNewsSummary {
  customerId: string;
  customerName: string;
  totalNews: number;
  unacknowledged: number;
  recentNews: CompanyNews[];
  categoryBreakdown: Record<NewsCategory, number>;
  sentimentBreakdown: Record<NewsSentiment, number>;
  lastNewsDate?: Date;
}

/**
 * Daily digest summary
 */
export interface NewsDailyDigest {
  date: string;
  totalCustomers: number;
  totalNews: number;
  highlights: Array<{
    customerId: string;
    customerName: string;
    news: CompanyNews;
  }>;
  categoryBreakdown: Record<NewsCategory, number>;
  sentimentBreakdown: Record<NewsSentiment, number>;
}

// ============================================
// Outreach Draft Types
// ============================================

/**
 * Outreach message draft based on news
 */
export interface NewsOutreachDraft {
  newsId: string;
  customerId: string;
  recipientName?: string;
  recipientEmail?: string;
  subject: string;
  body: string;
  tone: 'congratulatory' | 'supportive' | 'neutral' | 'concerned';
  suggestedFollowUpDate?: Date;
}

// ============================================
// Slack Alert Format
// ============================================

/**
 * Slack notification payload for company news
 */
export interface NewsSlackAlert {
  customerId: string;
  customerName: string;
  news: CompanyNews;
  blocks: any[];
}
