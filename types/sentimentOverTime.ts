/**
 * PRD-076: Account Sentiment Over Time Types
 *
 * Types for longitudinal sentiment analysis, including historical trends,
 * stakeholder sentiment, event correlation, and forecasting.
 */

// ============================================================================
// Core Sentiment Types
// ============================================================================

export type SentimentLabel =
  | 'very_positive'
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'very_negative';

export type SentimentTrend = 'improving' | 'stable' | 'declining';

export type SentimentSource =
  | 'meeting'
  | 'email'
  | 'support'
  | 'nps'
  | 'csat'
  | 'chat'
  | 'qbr';

export type EventType = 'positive' | 'negative';

// ============================================================================
// Time Series Data
// ============================================================================

export interface SentimentDataPoint {
  date: string;
  score: number; // -100 to +100
  confidence: number; // 0-100
  sources: SentimentSource[];
  eventMarker?: string;
  dataPointCount: number;
}

export interface DateRange {
  start: string;
  end: string;
}

// ============================================================================
// Source Breakdown
// ============================================================================

export interface SourceSentiment {
  source: SentimentSource;
  score: number;
  trend: SentimentTrend;
  dataPoints: number;
  lastAnalyzed: string;
  label: string; // Display name
}

// ============================================================================
// Stakeholder Sentiment
// ============================================================================

export interface StakeholderSentiment {
  stakeholderId: string;
  name: string;
  role: string;
  email?: string;
  sentiment: number;
  trend: SentimentTrend;
  recentQuotes: string[];
  lastInteraction: string;
  interactionCount: number;
}

// ============================================================================
// Topic Sentiment
// ============================================================================

export interface TopicSentiment {
  topic: string;
  sentiment: number;
  frequency: 'high' | 'medium' | 'low';
  trend: SentimentTrend;
  recentMentions: TopicMention[];
}

export interface TopicMention {
  text: string;
  date: string;
  sentiment: number;
  source: SentimentSource;
}

// ============================================================================
// Events and Correlations
// ============================================================================

export interface SentimentEvent {
  id: string;
  date: string;
  event: string;
  sentimentImpact: number; // Change in sentiment score
  type: EventType;
  source?: SentimentSource;
  recoveryTime?: string; // e.g., "3 weeks", "Immediate", "Ongoing"
}

export interface SentimentCorrelation {
  factor: string;
  correlation: number; // -1 to +1
  description: string;
  strength: 'strong' | 'moderate' | 'weak';
}

// ============================================================================
// Drivers Analysis
// ============================================================================

export interface SentimentDriver {
  driver: string;
  contribution: number; // Impact on overall sentiment
  evidence: string;
  type: 'positive' | 'negative';
}

// ============================================================================
// Forecasting
// ============================================================================

export interface SentimentForecast {
  timeframe: string; // e.g., "30 days", "60 days", "90 days"
  predictedScore: number;
  confidence: number; // 0-100
  trend: SentimentTrend;
  riskLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Alert Configuration
// ============================================================================

export interface SentimentAlertConfig {
  id: string;
  customerId: string;
  condition: string;
  threshold?: number;
  alertType: 'email' | 'slack' | 'in_app';
  enabled: boolean;
  triggered: boolean;
  lastTriggered?: string;
}

export interface SentimentAlertSetting {
  scoreDropBelow: number;
  scoreDrop30Days: number;
  stakeholderNegative: boolean;
}

// ============================================================================
// Main Analysis Response
// ============================================================================

export interface SentimentAnalysis {
  customerId: string;
  customerName: string;
  period: DateRange;
  generatedAt: string;

  // Overall sentiment
  currentSentiment: number; // -100 to +100
  sentimentLabel: SentimentLabel;
  trend: SentimentTrend;
  confidence: number;

  // Time series
  sentimentHistory: SentimentDataPoint[];

  // Breakdowns
  bySource: SourceSentiment[];
  byStakeholder: StakeholderSentiment[];
  byTopic: TopicSentiment[];

  // Events
  significantEvents: SentimentEvent[];
  correlations: SentimentCorrelation[];

  // Analysis
  drivers: SentimentDriver[];
  concerns: string[];
  positives: string[];

  // Forecast
  forecast: SentimentForecast[];

  // Alert settings
  alertSettings: SentimentAlertSetting;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface SentimentOverTimeRequest {
  customerId: string;
  period?: string; // e.g., "12m", "6m", "3m"
  sources?: SentimentSource[];
}

export interface SentimentOverTimeResponse {
  success: boolean;
  data: SentimentAnalysis;
  meta: {
    responseTimeMs: number;
    dataPointCount: number;
    sourcesAnalyzed: SentimentSource[];
  };
}

// ============================================================================
// Component Props
// ============================================================================

export interface SentimentOverTimePanelProps {
  customerId: string;
  customerName?: string;
  initialPeriod?: string;
  compact?: boolean;
  onViewDetails?: () => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getSentimentLabel(score: number): SentimentLabel {
  if (score >= 75) return 'very_positive';
  if (score >= 25) return 'positive';
  if (score >= -24) return 'neutral';
  if (score >= -74) return 'negative';
  return 'very_negative';
}

export function getSentimentColor(score: number): string {
  if (score >= 50) return 'text-green-400';
  if (score >= 20) return 'text-green-300';
  if (score >= 0) return 'text-yellow-400';
  if (score >= -30) return 'text-orange-400';
  return 'text-red-400';
}

export function getSentimentBgColor(score: number): string {
  if (score >= 50) return 'bg-green-500';
  if (score >= 20) return 'bg-green-400';
  if (score >= 0) return 'bg-yellow-500';
  if (score >= -30) return 'bg-orange-500';
  return 'bg-red-500';
}

export function getTrendColor(trend: SentimentTrend): string {
  switch (trend) {
    case 'improving':
      return 'text-green-400';
    case 'declining':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

export function getSourceDisplayName(source: SentimentSource): string {
  const names: Record<SentimentSource, string> = {
    meeting: 'Meeting Transcripts',
    email: 'Email Communication',
    support: 'Support Tickets',
    nps: 'NPS Survey',
    csat: 'CSAT Responses',
    chat: 'Chat Messages',
    qbr: 'QBR Feedback',
  };
  return names[source] || source;
}

export function getCorrelationStrength(
  correlation: number
): 'strong' | 'moderate' | 'weak' {
  const abs = Math.abs(correlation);
  if (abs >= 0.7) return 'strong';
  if (abs >= 0.4) return 'moderate';
  return 'weak';
}
