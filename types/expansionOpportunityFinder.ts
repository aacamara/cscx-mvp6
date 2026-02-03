/**
 * Expansion Opportunity Finder Types
 * PRD-060: Expansion Opportunity Finder
 *
 * Types for identifying and surfacing expansion opportunities across
 * the customer portfolio by analyzing usage patterns, feature adoption gaps,
 * stakeholder signals, and contract headroom.
 */

// ============================================
// Opportunity Types
// ============================================

export type OpportunityType = 'upsell' | 'cross_sell' | 'seat_expansion' | 'tier_upgrade';

export type OpportunityTimeline = 'immediate' | '30_days' | '60_days' | 'next_renewal';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ============================================
// Signal Types
// ============================================

export type ExpansionSignalCategory = 'usage' | 'contract' | 'stakeholder' | 'whitespace';

export interface ExpansionSignal {
  id: string;
  category: ExpansionSignalCategory;
  signalType: string;
  description: string;
  detectedAt: string;
  strength: number; // 0-100
  source: string;
  metadata?: Record<string, unknown>;
}

// Usage-Based Signals
export interface UsageSignal extends ExpansionSignal {
  category: 'usage';
  signalType:
    | 'seat_utilization_high'      // > 90% seat utilization
    | 'feature_ceiling_hit'        // Power feature at limit
    | 'usage_growth'               // > 30% MAU growth vs prior quarter
    | 'new_use_case'               // New feature cluster adopted
    | 'api_usage_surge';           // > 80% of API limit
  currentValue: number;
  threshold: number;
  percentOfLimit: number;
}

// Contract-Based Signals
export interface ContractSignal extends ExpansionSignal {
  category: 'contract';
  signalType:
    | 'entitlement_approaching'    // Usage > 80% of entitlement
    | 'multi_year_available'       // Single year, could convert
    | 'legacy_pricing'             // Not on current pricing
    | 'missing_products';          // Products not in contract
  currentEntitlement: string;
  potentialUpgrade: string;
}

// Stakeholder Signals
export interface StakeholderSignal extends ExpansionSignal {
  category: 'stakeholder';
  signalType:
    | 'new_department'             // New team mentioned
    | 'budget_discussion'          // Budget mentioned positively
    | 'comparison_shopping'        // Competitor features asked
    | 'exec_growth_goals';         // Growth mentioned in QBR
  stakeholderName?: string;
  quote?: string;
}

// ============================================
// Stakeholder / Champion
// ============================================

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  email?: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  lastContact?: string;
  isChampion: boolean;
}

// ============================================
// Expansion Opportunity
// ============================================

export interface ExpansionOpportunity {
  id: string;
  customerId: string;
  customerName: string;
  opportunityType: OpportunityType;
  estimatedValue: number;
  confidenceScore: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  signals: ExpansionSignal[];
  suggestedApproach: string;
  champion: Stakeholder | null;
  timeline: OpportunityTimeline;
  blockers: string[];

  // Additional context
  currentArr: number;
  healthScore: number;
  segment: string;
  renewalDate?: string;
  daysToRenewal?: number;

  // Metadata
  detectedAt: string;
  lastUpdated: string;
}

// ============================================
// Confidence Calculation
// ============================================

export interface ConfidenceFactors {
  signalStrength: number;        // 35% weight
  healthScore: number;           // 25% weight
  championEngagement: number;    // 20% weight
  historicalExpansion: number;   // 20% weight
}

export const CONFIDENCE_WEIGHTS = {
  signalStrength: 0.35,
  healthScore: 0.25,
  championEngagement: 0.20,
  historicalExpansion: 0.20
};

// Confidence level thresholds
export const CONFIDENCE_THRESHOLDS = {
  high: { min: 70, max: 100 },
  medium: { min: 40, max: 69 },
  low: { min: 0, max: 39 }
};

// ============================================
// Portfolio Summary
// ============================================

export interface OpportunitySummary {
  totalOpportunities: number;
  totalPotentialValue: number;
  highConfidence: {
    count: number;
    value: number;
  };
  mediumConfidence: {
    count: number;
    value: number;
  };
  lowConfidence: {
    count: number;
    value: number;
  };
  byTimeline: {
    immediate: { count: number; value: number };
    thirtyDays: { count: number; value: number };
    sixtyDays: { count: number; value: number };
    nextRenewal: { count: number; value: number };
  };
  byType: {
    upsell: { count: number; value: number; avgConfidence: number };
    crossSell: { count: number; value: number; avgConfidence: number };
    seatExpansion: { count: number; value: number; avgConfidence: number };
    tierUpgrade: { count: number; value: number; avgConfidence: number };
  };
}

// ============================================
// Quick Wins
// ============================================

export interface QuickWin {
  opportunity: ExpansionOpportunity;
  score: number; // Composite of high value + high confidence + immediate timeline
  reason: string;
}

// ============================================
// API Response Types
// ============================================

export interface ExpansionOpportunityResponse {
  summary: OpportunitySummary;
  opportunities: ExpansionOpportunity[];
  quickWins: QuickWin[];
  generatedAt: string;
}

// ============================================
// Filter Types
// ============================================

export interface ExpansionOpportunityFilters {
  csmId?: string;
  opportunityType?: OpportunityType | 'all';
  minValue?: number;
  confidenceFilter?: ConfidenceLevel | 'all';
  timeline?: OpportunityTimeline | 'all';
  search?: string;
  sortBy?: 'value' | 'confidence' | 'timeline' | 'customer';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ============================================
// Input for POST endpoint
// ============================================

export interface ExpansionOpportunityRequest {
  csmId?: string;
  opportunityTypes?: OpportunityType[];
  minConfidence?: number;
  includeSignalDetails?: boolean;
}

// ============================================
// Signal Detection Configuration
// ============================================

export interface SignalDetectionThresholds {
  seatUtilization: number;       // Default: 0.90 (90%)
  featureUsageLimit: number;     // Default: 0.95 (95%)
  usageGrowthRate: number;       // Default: 0.30 (30%)
  apiUsageThreshold: number;     // Default: 0.80 (80%)
  entitlementThreshold: number;  // Default: 0.80 (80%)
}

export const DEFAULT_THRESHOLDS: SignalDetectionThresholds = {
  seatUtilization: 0.90,
  featureUsageLimit: 0.95,
  usageGrowthRate: 0.30,
  apiUsageThreshold: 0.80,
  entitlementThreshold: 0.80
};

// ============================================
// Actions
// ============================================

export type OpportunityAction =
  | 'schedule_expansion_call'
  | 'send_proposal'
  | 'request_demo'
  | 'send_case_study'
  | 'escalate_to_sales'
  | 'create_crm_opportunity';

export interface OpportunityActionResult {
  opportunityId: string;
  action: OpportunityAction;
  status: 'initiated' | 'completed' | 'failed';
  message: string;
  nextSteps?: string[];
  data?: Record<string, unknown>;
}
