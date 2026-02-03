/**
 * Gong Call Intelligence Types (PRD-193)
 *
 * Type definitions for Gong API integration including calls, transcripts,
 * insights, and sentiment analysis.
 */

// ============================================================================
// Core Gong Types
// ============================================================================

export interface GongCall {
  id: string;
  gongCallId: string;
  customerId?: string;
  meetingId?: string;
  title: string;
  durationSeconds: number;
  participants: GongParticipant[];
  gongUrl: string;
  summary?: string;
  sentimentScore?: number;
  sentimentLabel?: GongSentimentLabel;
  callDate: string;
  syncedAt: string;
}

export interface GongParticipant {
  id: string;
  name: string;
  email?: string;
  role: 'internal' | 'external';
  speakingDuration?: number;
  speakingPercentage?: number;
  sentiment?: number;
}

export type GongSentimentLabel = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';

export interface GongTranscript {
  id: string;
  gongCallId: string;
  transcriptText: string;
  speakers: GongSpeakerSegment[];
  wordCount: number;
  createdAt: string;
}

export interface GongSpeakerSegment {
  speakerId: string;
  speakerName: string;
  startTime: number;
  endTime: number;
  text: string;
}

// ============================================================================
// Insight Types
// ============================================================================

export type GongInsightType =
  | 'competitor_mention'
  | 'pricing_discussion'
  | 'risk_indicator'
  | 'action_item'
  | 'question'
  | 'objection'
  | 'next_step'
  | 'positive_feedback'
  | 'negative_feedback'
  | 'feature_request';

export interface GongInsight {
  id: string;
  gongCallId: string;
  insightType: GongInsightType;
  content: string;
  timestampSeconds: number;
  speaker?: string;
  confidence?: number;
  createdAt: string;
}

export interface GongTracker {
  id: string;
  name: string;
  count: number;
  occurrences: GongTrackerOccurrence[];
}

export interface GongTrackerOccurrence {
  timestampSeconds: number;
  speaker: string;
  phrase: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface GongCallsResponse {
  calls: GongCall[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

export interface GongCallDetailResponse {
  call: GongCall;
  transcript?: GongTranscript;
  insights: GongInsight[];
  trackers: GongTracker[];
}

export interface GongCustomerCallsResponse {
  customerId: string;
  customerName?: string;
  calls: GongCall[];
  totalCalls: number;
  sentimentTrend: GongSentimentTrend;
  recentInsights: GongInsight[];
}

export interface GongSentimentTrend {
  current: number;
  change7d: number;
  change30d: number;
  trend: 'improving' | 'stable' | 'declining';
  history: { date: string; score: number }[];
}

export interface GongInsightsResponse {
  customerId: string;
  insights: GongInsight[];
  aggregated: {
    competitorMentions: number;
    pricingDiscussions: number;
    riskIndicators: number;
    actionItems: number;
    questions: number;
  };
  topCompetitors: { name: string; mentions: number }[];
  riskSignals: GongRiskSignal[];
}

// ============================================================================
// Risk Signal Types
// ============================================================================

export interface GongRiskSignal {
  id: string;
  customerId: string;
  callId: string;
  signalType: GongRiskSignalType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string;
  callDate: string;
  acknowledged: boolean;
  createdAt: string;
}

export type GongRiskSignalType =
  | 'frustration'
  | 'competitor_evaluation'
  | 'budget_concerns'
  | 'contract_concerns'
  | 'support_escalation'
  | 'champion_departure'
  | 'negative_sentiment'
  | 'declining_engagement';

// ============================================================================
// Connection & Sync Types
// ============================================================================

export interface GongConnection {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  workspaceId?: string;
  workspaceName?: string;
  scopes: string[];
  connectedAt: string;
}

export interface GongSyncStatus {
  userId: string;
  lastSyncAt?: string;
  syncInProgress: boolean;
  callsSynced: number;
  lastError?: string;
  nextSyncAt?: string;
}

export interface GongWebhookEvent {
  eventType: 'call.completed' | 'call.analyzed' | 'tracker.matched';
  callId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ============================================================================
// Customer Matching Types
// ============================================================================

export interface GongCustomerMatch {
  gongAccountId: string;
  gongAccountName: string;
  cscxCustomerId?: string;
  cscxCustomerName?: string;
  matchType: 'email_domain' | 'company_name' | 'crm_id' | 'manual';
  confidence: number;
  matchedAt: string;
}

// ============================================================================
// Search Types
// ============================================================================

export interface GongTranscriptSearchParams {
  query: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  speakers?: string[];
  limit?: number;
  offset?: number;
}

export interface GongTranscriptSearchResult {
  callId: string;
  callTitle: string;
  callDate: string;
  customerId?: string;
  customerName?: string;
  matches: {
    text: string;
    speaker: string;
    timestampSeconds: number;
    highlight: string;
  }[];
  score: number;
}

export interface GongTranscriptSearchResponse {
  query: string;
  results: GongTranscriptSearchResult[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Health Score Integration Types
// ============================================================================

export interface GongHealthScoreContribution {
  customerId: string;
  sentimentScore: number;
  sentimentWeight: number;
  engagementScore: number;
  engagementWeight: number;
  riskScore: number;
  riskWeight: number;
  totalContribution: number;
  calculatedAt: string;
}

// ============================================================================
// UI Component Types
// ============================================================================

export interface GongCallListFilters {
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  sentimentFilter?: 'all' | 'positive' | 'negative' | 'neutral';
  hasInsights?: boolean;
  hasRiskSignals?: boolean;
  sortBy?: 'date' | 'duration' | 'sentiment';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface GongCallCardProps {
  call: GongCall;
  showInsights?: boolean;
  showSentiment?: boolean;
  onViewDetails?: (callId: string) => void;
  onViewInGong?: (gongUrl: string) => void;
}

export interface GongInsightsPanelProps {
  customerId: string;
  customerName?: string;
  compact?: boolean;
  showRiskSignals?: boolean;
}
