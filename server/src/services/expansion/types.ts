/**
 * Expansion Signal Detection Types
 * PRD-103: Expansion Signal Detected
 *
 * Types for detecting and processing expansion signals
 */

// ============================================
// Signal Types
// ============================================

export type ExpansionSignalType =
  | 'usage_limit_approaching'   // FR-1.1: Usage approaching tier limits
  | 'seat_overage'              // FR-1.2: New users beyond contracted seats
  | 'feature_interest'          // FR-1.3: Interest in higher-tier features
  | 'expansion_mention'         // FR-1.4: Expansion mentions in meetings/emails
  | 'new_team_onboarding'       // FR-1.5: New department/team onboarding
  | 'api_usage_growth'          // FR-1.6: API usage growth
  | 'competitor_displacement';  // FR-1.7: Competitor product displacement

export type ExpansionType =
  | 'upsell'             // Upgrade to higher tier
  | 'seat_expansion'     // Add more seats
  | 'feature_upsell'     // Add premium features
  | 'land_and_expand'    // New teams/departments
  | 'cross_sell';        // New product lines

// ============================================
// Signal Detection
// ============================================

export interface DetectedSignal {
  type: ExpansionSignalType;
  details: string;
  detected_at: Date;
  strength: number;     // 0-1 confidence score
  source?: string;      // meeting_transcript, usage_data, email, etc.
  quote?: string;       // Direct quote if from conversation
  metadata?: Record<string, unknown>;
}

export interface ExpansionSignalDetectionResult {
  customerId: string;
  customerName: string;
  signals: DetectedSignal[];
  compositeScore: number;         // Weighted aggregate of signal strengths
  estimatedExpansionArr: number;  // Estimated additional ARR
  suggestedProducts: string[];
  recommendedApproach: string;
  expansionType: ExpansionType;
  currentState: CustomerCurrentState;
}

export interface CustomerCurrentState {
  arr: number;
  plan: string;
  healthScore: number;
  contractEndDate?: Date;
  activeUsers: number;
  contractedSeats: number;
  tier?: string;
}

// ============================================
// Usage Metrics for Signal Detection
// ============================================

export interface CustomerUsageMetrics {
  customerId: string;
  apiCalls: number;
  apiCallLimit: number;
  activeUsers: number;
  contractedSeats: number;
  featureUsage: Record<string, number>;
  loginCount30d: number;
  newUsersLast30d: number;
  newDepartments: string[];
  usageTrend: 'growing' | 'stable' | 'declining';
}

// ============================================
// Meeting Signals
// ============================================

export interface MeetingExpansionSignal {
  meetingId: string;
  meetingDate: Date;
  mentionType: 'upsell' | 'cross_sell' | 'new_use_case' | 'additional_users' | 'new_department';
  description: string;
  quote?: string;
  strength: number;
  speakerName?: string;
}

// ============================================
// Expansion Opportunity (for DB)
// ============================================

export interface ExpansionOpportunity {
  id: string;
  customerId: string;
  customerName: string;
  opportunityType: ExpansionType;
  productLine?: string;
  estimatedValue: number;
  probability: number;           // 0-100
  stage: ExpansionStage;
  championId?: string;
  useCase?: string;
  competitiveThreat?: string;
  timeline: ExpansionTimeline;
  blockers: string[];
  nextSteps?: string;

  // Signal metadata
  signalData: {
    signals: DetectedSignal[];
    compositeScore: number;
    suggestedProducts: string[];
    recommendedApproach: string;
  };

  // Sales coordination
  salesRepId?: string;
  salesNotifiedAt?: Date;
  crmOpportunityId?: string;

  // Timestamps
  detectedAt: Date;
  qualifiedAt?: Date;
  closedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type ExpansionStage =
  | 'detected'        // Signal detected, not yet qualified
  | 'qualified'       // CSM has validated opportunity
  | 'proposed'        // Proposal sent
  | 'negotiating'     // In negotiation
  | 'closed_won'      // Successfully expanded
  | 'closed_lost';    // Opportunity lost

export type ExpansionTimeline =
  | 'immediate'       // Within 30 days
  | 'this_quarter'    // Current quarter
  | 'next_quarter'    // Next quarter
  | 'next_year';      // Next fiscal year

// ============================================
// Signal Detection Configuration
// ============================================

export interface SignalDetectorConfig {
  type: ExpansionSignalType;
  expansionType: ExpansionType;
  baseStrength: number;          // Default strength score
  minThreshold?: number;         // Minimum threshold to trigger
  arrMultiplier?: number;        // Multiplier for ARR estimation
  enabled: boolean;
}

export const EXPANSION_SIGNAL_CONFIGS: SignalDetectorConfig[] = [
  {
    type: 'usage_limit_approaching',
    expansionType: 'upsell',
    baseStrength: 0.8,
    minThreshold: 0.8,           // 80% of limit
    arrMultiplier: 0.5,          // 50% ARR increase estimate
    enabled: true,
  },
  {
    type: 'seat_overage',
    expansionType: 'seat_expansion',
    baseStrength: 0.9,
    arrMultiplier: 0.3,          // Price per seat * overage
    enabled: true,
  },
  {
    type: 'feature_interest',
    expansionType: 'feature_upsell',
    baseStrength: 0.7,
    arrMultiplier: 0.4,
    enabled: true,
  },
  {
    type: 'expansion_mention',
    expansionType: 'upsell',
    baseStrength: 0.75,
    arrMultiplier: 0.3,
    enabled: true,
  },
  {
    type: 'new_team_onboarding',
    expansionType: 'land_and_expand',
    baseStrength: 0.75,
    minThreshold: 5,             // At least 5 new users from different dept
    arrMultiplier: 0.6,
    enabled: true,
  },
  {
    type: 'api_usage_growth',
    expansionType: 'upsell',
    baseStrength: 0.65,
    minThreshold: 0.5,           // 50%+ growth
    arrMultiplier: 0.25,
    enabled: true,
  },
  {
    type: 'competitor_displacement',
    expansionType: 'cross_sell',
    baseStrength: 0.8,
    arrMultiplier: 0.4,
    enabled: true,
  },
];

// ============================================
// Slack Alert Types
// ============================================

export interface ExpansionAlertData {
  customerId: string;
  customerName: string;
  signalStrength: 'HIGH' | 'MEDIUM' | 'LOW';
  compositeScore: number;
  estimatedExpansionArr: number;
  signals: Array<{
    type: ExpansionSignalType;
    emoji: string;
    title: string;
    description: string;
  }>;
  currentState: {
    arr: number;
    plan: string;
    contractEnd: string;
  };
  recommendedExpansion: {
    products: string[];
    estimatedValue: number;
    approach: string;
  };
  opportunityId: string;
}
