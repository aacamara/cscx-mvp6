/**
 * Competitor Detection Types
 * PRD-094: Competitor Mentioned - Battle Card
 */

// ============================================
// Competitor Definitions
// ============================================

export interface Competitor {
  id: string;
  name: string;
  aliases: string[];
  website?: string;
  category: string;
  battleCardId?: string;
  logoUrl?: string;
  description?: string;
  strengths: string[];
  weaknesses: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetitorAlias {
  alias: string;
  competitorId: string;
  competitorName: string;
}

// ============================================
// Battle Card Types
// ============================================

export interface BattleCard {
  id: string;
  competitorId: string;
  competitorName: string;
  version: string;
  lastUpdated: Date;

  // Positioning
  overview: string;
  targetMarket: string;
  pricingModel?: string;

  // Key differentiators
  keyDifferentiators: Differentiator[];

  // Talk tracks
  talkTracks: TalkTrack[];

  // Objection handlers
  objectionHandlers: ObjectionHandler[];

  // Win/loss data
  winRate?: number;
  totalDeals?: number;
  wonDeals?: number;
  lostDeals?: number;

  // Feature comparison
  featureComparison?: FeatureComparison[];

  // Resources
  resources: BattleCardResource[];

  createdAt: Date;
  updatedAt: Date;
}

export interface Differentiator {
  id: string;
  title: string;
  description: string;
  category: 'product' | 'service' | 'pricing' | 'support' | 'integration' | 'other';
  importance: 'high' | 'medium' | 'low';
}

export interface TalkTrack {
  id: string;
  scenario: string;
  script: string;
  keyPoints: string[];
  tags: string[];
}

export interface ObjectionHandler {
  id: string;
  objection: string;
  response: string;
  supportingPoints: string[];
  relatedFeatures?: string[];
}

export interface FeatureComparison {
  feature: string;
  ourCapability: 'full' | 'partial' | 'none' | 'roadmap';
  theirCapability: 'full' | 'partial' | 'none' | 'unknown';
  notes?: string;
  advantage: 'us' | 'them' | 'tie';
}

export interface BattleCardResource {
  id: string;
  title: string;
  type: 'document' | 'video' | 'case_study' | 'presentation' | 'link';
  url: string;
  description?: string;
}

// ============================================
// Competitor Mention Types
// ============================================

export interface CompetitorMention {
  id: string;
  customerId: string;
  customerName?: string;
  competitorId: string;
  competitorName: string;
  sourceType: 'meeting' | 'email' | 'support_ticket' | 'chat' | 'document';
  sourceId: string;
  sourceTitle?: string;
  sourceUrl?: string;
  context: string;
  fullQuote?: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'comparison';
  intentSignal: 'evaluation' | 'comparison' | 'frustration' | 'praise' | 'question' | 'unknown';
  featuresMentioned: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  detectedBy: 'system' | 'manual';
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  followUpScheduled: boolean;
  notes?: string;
}

export interface CompetitorMentionAlert {
  id: string;
  mentionId: string;
  customerId: string;
  customerName: string;
  competitorId: string;
  competitorName: string;

  // Customer context
  customerStatus: 'active' | 'onboarding' | 'at_risk' | 'churned';
  customerArr: number;
  customerHealthScore: number;
  daysUntilRenewal?: number;

  // Mention details
  sourceType: string;
  sourceTitle?: string;
  context: string;
  sentiment: string;
  riskLevel: string;

  // Battle card summary
  battleCard?: {
    id: string;
    keyDifferentiators: Differentiator[];
    suggestedTalkTrack?: TalkTrack;
    suggestedResponse?: string;
  };

  // Actions
  suggestedActions: SuggestedAction[];

  createdAt: Date;
}

export interface SuggestedAction {
  type: 'schedule_meeting' | 'draft_email' | 'escalate' | 'research' | 'notify_sales';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown>;
}

// ============================================
// Detection Types
// ============================================

export interface DetectionResult {
  competitor: Competitor;
  matchedAlias: string;
  context: string;
  position: number;
  sentiment: CompetitorMention['sentiment'];
  intentSignal: CompetitorMention['intentSignal'];
  featuresMentioned: string[];
  confidence: number;
}

export interface DetectionOptions {
  text: string;
  sourceType: CompetitorMention['sourceType'];
  sourceId: string;
  sourceTitle?: string;
  sourceUrl?: string;
  customerId: string;
  customerName?: string;
  detectSentiment?: boolean;
  detectFeatures?: boolean;
  minConfidence?: number;
}

// ============================================
// Analytics Types
// ============================================

export interface CompetitorAnalytics {
  competitorId: string;
  competitorName: string;
  totalMentions: number;
  mentionsBySource: Record<string, number>;
  sentimentDistribution: Record<string, number>;
  intentDistribution: Record<string, number>;
  topFeaturesMentioned: Array<{ feature: string; count: number }>;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  periodStart: Date;
  periodEnd: Date;
}

export interface PortfolioCompetitorInsights {
  totalMentions: number;
  uniqueCustomers: number;
  topCompetitors: Array<{
    competitorId: string;
    competitorName: string;
    mentionCount: number;
    uniqueCustomers: number;
    avgRiskLevel: number;
  }>;
  atRiskCustomers: Array<{
    customerId: string;
    customerName: string;
    competitorMentions: number;
    lastMentionDate: Date;
    riskLevel: string;
  }>;
  recentMentions: CompetitorMention[];
  periodStart: Date;
  periodEnd: Date;
}
