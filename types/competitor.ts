/**
 * Competitor Types (PRD-094)
 * Types for competitor detection and battle card functionality
 */

// ============================================
// Competitor Catalog
// ============================================

export interface Competitor {
  id: string;
  name: string;
  aliases: string[];
  website?: string;
  category: CompetitorCategory;
  battleCardId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CompetitorCategory =
  | 'cs_platform'       // Customer Success platforms (Gainsight, ChurnZero, Totango)
  | 'crm'               // CRM systems (Salesforce, HubSpot)
  | 'analytics'         // Analytics tools
  | 'engagement'        // Customer engagement tools
  | 'support'           // Support platforms
  | 'other';

// ============================================
// Competitor Mentions
// ============================================

export interface CompetitorMention {
  id: string;
  customerId: string;
  customerName?: string;
  competitorId: string;
  competitorName: string;
  sourceType: MentionSourceType;
  sourceId: string;
  sourceUrl?: string;
  context: string;
  sentiment: MentionSentiment;
  featuresMentioned: string[];
  detectedAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  notes?: string;
}

export type MentionSourceType =
  | 'meeting'
  | 'email'
  | 'support_ticket'
  | 'call_transcript'
  | 'chat'
  | 'document';

export type MentionSentiment =
  | 'positive'    // Customer spoke positively about competitor
  | 'negative'    // Customer criticized competitor
  | 'neutral'     // Neutral mention
  | 'evaluating'; // Customer is actively evaluating

// ============================================
// Battle Cards
// ============================================

export interface BattleCard {
  id: string;
  competitorId: string;
  competitorName: string;
  lastUpdated: Date;
  overview: string;
  keyDifferentiators: Differentiator[];
  talkTracks: TalkTrack[];
  objectionHandlers: ObjectionHandler[];
  featureComparison: FeatureComparison[];
  winLossStats: WinLossStats;
  pricingComparison?: PricingComparison;
  customerTestimonials?: Testimonial[];
  resources: BattleCardResource[];
}

export interface Differentiator {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: 'feature' | 'service' | 'price' | 'implementation' | 'support';
}

export interface TalkTrack {
  scenario: string;
  script: string;
  tips: string[];
}

export interface ObjectionHandler {
  objection: string;
  response: string;
  proofPoints: string[];
}

export interface FeatureComparison {
  feature: string;
  ours: 'full' | 'partial' | 'none' | 'better';
  theirs: 'full' | 'partial' | 'none' | 'better';
  notes: string;
}

export interface WinLossStats {
  totalDeals: number;
  wins: number;
  losses: number;
  winRate: number;
  avgDealSize: number;
  lastUpdated: Date;
}

export interface PricingComparison {
  ourPricing: string;
  theirPricing: string;
  valueProposition: string;
  discountGuidance: string;
}

export interface Testimonial {
  customerName: string;
  quote: string;
  context: string;
}

export interface BattleCardResource {
  title: string;
  type: 'document' | 'video' | 'case_study' | 'one_pager';
  url: string;
}

// ============================================
// Competitor Alert
// ============================================

export interface CompetitorAlert {
  id: string;
  mention: CompetitorMention;
  customer: CustomerContext;
  battleCard?: BattleCard;
  suggestedResponse?: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  status: 'new' | 'viewed' | 'actioned' | 'dismissed';
}

export interface CustomerContext {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  renewalDate?: string;
  daysUntilRenewal?: number;
  csmName?: string;
  stage: string;
}

// ============================================
// Detection Patterns
// ============================================

export interface CompetitorPattern {
  name: string;
  aliases: string[];
  category: CompetitorCategory;
}

// Default competitor patterns for detection
export const DEFAULT_COMPETITOR_PATTERNS: CompetitorPattern[] = [
  {
    name: 'Gainsight',
    aliases: ['gainsight', 'gain sight', 'GS'],
    category: 'cs_platform'
  },
  {
    name: 'ChurnZero',
    aliases: ['churnzero', 'churn zero', 'CZ', 'churn-zero'],
    category: 'cs_platform'
  },
  {
    name: 'Totango',
    aliases: ['totango'],
    category: 'cs_platform'
  },
  {
    name: 'Vitally',
    aliases: ['vitally', 'vitally.io'],
    category: 'cs_platform'
  },
  {
    name: 'Planhat',
    aliases: ['planhat', 'plan hat'],
    category: 'cs_platform'
  },
  {
    name: 'ClientSuccess',
    aliases: ['clientsuccess', 'client success', 'client-success'],
    category: 'cs_platform'
  },
  {
    name: 'Catalyst',
    aliases: ['catalyst', 'catalyst.io'],
    category: 'cs_platform'
  },
  {
    name: 'Custify',
    aliases: ['custify'],
    category: 'cs_platform'
  }
];

// ============================================
// API Response Types
// ============================================

export interface CompetitorMentionResponse {
  success: boolean;
  data?: CompetitorMention;
  error?: {
    code: string;
    message: string;
  };
}

export interface CompetitorAlertsResponse {
  success: boolean;
  data?: {
    alerts: CompetitorAlert[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface BattleCardResponse {
  success: boolean;
  data?: BattleCard;
  error?: {
    code: string;
    message: string;
  };
}

export interface DetectionResult {
  competitor: string;
  alias: string;
  context: string;
  sentiment: MentionSentiment;
  position: number;
}
