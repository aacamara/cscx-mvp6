/**
 * PRD-076: Account Sentiment Over Time
 * Comprehensive sentiment tracking types for longitudinal analysis
 */

// ============================================================================
// Core Sentiment Types
// ============================================================================

export type SentimentLabel = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
export type SentimentTrend = 'improving' | 'stable' | 'declining';
export type SentimentSource = 'email' | 'meeting' | 'support' | 'survey' | 'chat' | 'qbr';
export type SentimentEventType = 'positive' | 'negative';

export interface DateRange {
  start: string;
  end: string;
}

// ============================================================================
// Sentiment Data Points
// ============================================================================

export interface SentimentDataPoint {
  date: string;
  score: number;           // -100 to +100
  confidence: number;      // 0-100
  sources: SentimentSource[];
  eventMarker?: string;
  dataPointCount?: number;
}

export interface SentimentEvent {
  id: string;
  date: string;
  event: string;
  sentimentImpact: number;  // Change in sentiment
  type: SentimentEventType;
  recoveryDays?: number;    // Days until sentiment recovered (if applicable)
}

export interface SentimentCorrelation {
  factor: string;
  correlation: number;     // -1 to +1
  strength: 'strong' | 'moderate' | 'weak';
  description: string;
}

// ============================================================================
// Sentiment Breakdown Types
// ============================================================================

export interface SourceSentiment {
  source: SentimentSource;
  score: number | null;
  trend: SentimentTrend;
  dataPoints: number;
  lastAnalyzed: string | null;
}

export interface StakeholderSentiment {
  stakeholderId: string;
  stakeholderName: string;
  role: string;
  sentiment: number;
  trend: SentimentTrend;
  recentQuotes: string[];
  lastInteraction: string | null;
  engagementLevel: 'high' | 'medium' | 'low';
}

export interface TopicSentiment {
  topic: string;
  sentiment: number | null;
  frequency: 'high' | 'medium' | 'low';
  trend: SentimentTrend;
  recentMentions: TopicMention[];
}

export interface TopicMention {
  date: string;
  quote: string;
  sentiment: number;
  source: SentimentSource;
}

// ============================================================================
// Sentiment Drivers
// ============================================================================

export interface SentimentDriver {
  driver: string;
  contribution: number;    // Positive or negative impact
  type: 'positive' | 'negative';
  evidence: string;
  frequency: number;       // How often this driver appears
  trend: SentimentTrend;
}

// ============================================================================
// Sentiment Forecast
// ============================================================================

export interface SentimentForecast {
  timeframe: string;       // e.g., "30 days"
  predictedSentiment: number;
  confidence: number;      // 0-100
  riskLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Sentiment Alert Settings
// ============================================================================

export interface SentimentAlertSetting {
  id: string;
  condition: string;
  alertType: 'email' | 'slack' | 'in_app';
  status: 'active' | 'inactive' | 'triggered';
  triggeredAt?: string;
  thresholdValue?: number;
}

// ============================================================================
// Complete Sentiment Analysis Response
// ============================================================================

export interface SentimentAnalysis {
  customerId: string;
  customerName: string;
  period: DateRange;
  updatedAt: string;

  // Overall sentiment
  currentSentiment: number;  // -100 to +100
  sentimentLabel: SentimentLabel;
  trend: SentimentTrend;
  confidence: number;        // 0-100
  dataPointCount: number;

  // Time series
  sentimentHistory: SentimentDataPoint[];

  // Breakdowns
  bySource: SourceSentiment[];
  byStakeholder: StakeholderSentiment[];
  byTopic: TopicSentiment[];

  // Events & Correlations
  significantEvents: SentimentEvent[];
  correlations: SentimentCorrelation[];

  // Drivers
  positiveDrivers: SentimentDriver[];
  negativeDrivers: SentimentDriver[];

  // Summary insights
  concerns: string[];
  positives: string[];

  // Forecast
  forecast: SentimentForecast[];

  // Alert settings
  alertSettings: SentimentAlertSetting[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GetSentimentParams {
  customerId: string;
  period?: string;            // e.g., "12m", "6m", "3m", "30d"
  sources?: SentimentSource[];
  includeStakeholders?: boolean;
  includeTopics?: boolean;
  includeForecasts?: boolean;
}

export interface UpdateAlertSettingParams {
  customerId: string;
  settingId: string;
  status: 'active' | 'inactive';
  thresholdValue?: number;
}

// ============================================================================
// Sentiment Score Helpers
// ============================================================================

export const SENTIMENT_THRESHOLDS = {
  VERY_POSITIVE: { min: 75, max: 100 },
  POSITIVE: { min: 25, max: 74 },
  NEUTRAL: { min: -24, max: 24 },
  NEGATIVE: { min: -74, max: -25 },
  VERY_NEGATIVE: { min: -100, max: -75 },
} as const;

export function getSentimentLabel(score: number): SentimentLabel {
  if (score >= 75) return 'very_positive';
  if (score >= 25) return 'positive';
  if (score >= -24) return 'neutral';
  if (score >= -74) return 'negative';
  return 'very_negative';
}

export function getSentimentColor(score: number): string {
  if (score >= 75) return 'text-green-400';
  if (score >= 25) return 'text-green-300';
  if (score >= -24) return 'text-yellow-400';
  if (score >= -74) return 'text-orange-400';
  return 'text-red-400';
}

export function getSentimentBgColor(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 25) return 'bg-green-400';
  if (score >= -24) return 'bg-yellow-500';
  if (score >= -74) return 'bg-orange-500';
  return 'bg-red-500';
}

export function getTrendIcon(trend: SentimentTrend): string {
  switch (trend) {
    case 'improving': return '\u2191';
    case 'declining': return '\u2193';
    default: return '\u2192';
  }
}

export function getTrendColor(trend: SentimentTrend): string {
  switch (trend) {
    case 'improving': return 'text-green-400';
    case 'declining': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

export function getSourceIcon(source: SentimentSource): string {
  switch (source) {
    case 'email': return 'M';
    case 'meeting': return 'C';
    case 'support': return 'T';
    case 'survey': return 'S';
    case 'chat': return 'H';
    case 'qbr': return 'Q';
    default: return 'O';
  }
}

export function formatSentimentScore(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}
