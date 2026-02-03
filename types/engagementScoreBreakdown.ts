/**
 * Engagement Score Breakdown Types
 * PRD-070: Detailed engagement score breakdown with contributing factors
 */

// ============================================
// Core Engagement Types
// ============================================

export type EngagementStatus = 'healthy' | 'warning' | 'critical';
export type EngagementTrend = 'improving' | 'stable' | 'declining';
export type TrendDirection = 'up' | 'flat' | 'down';

// ============================================
// Engagement Factors
// ============================================

/**
 * Individual engagement factor with metrics
 */
export interface EngagementFactor {
  name: string;
  current: number;
  target: number;
  weight: number;
  contribution: number;
  status: EngagementStatus;
  trend: TrendDirection;
  healthyRange: {
    min: number;
    max?: number;
    unit: string;
  };
}

/**
 * Communication engagement component
 */
export interface CommunicationEngagement {
  score: number;
  weight: number;
  factors: {
    emailResponseRate: EngagementFactor;
    responseTime: EngagementFactor;
    meetingAttendance: EngagementFactor;
    proactiveOutreach: EngagementFactor;
  };
}

/**
 * Product engagement component
 */
export interface ProductEngagement {
  score: number;
  weight: number;
  factors: {
    loginFrequency: EngagementFactor;
    featureBreadth: EngagementFactor;
    sessionDuration: EngagementFactor;
    activeUserPercent: EngagementFactor;
  };
}

/**
 * Relationship engagement component
 */
export interface RelationshipEngagement {
  score: number;
  weight: number;
  factors: {
    stakeholderDepth: EngagementFactor;
    executiveAccess: EngagementFactor;
    championActivity: EngagementFactor;
  };
}

// ============================================
// Score Composition
// ============================================

/**
 * Component breakdown for score composition
 */
export interface ScoreComponent {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  status: EngagementStatus;
}

/**
 * Full engagement score breakdown
 */
export interface EngagementScoreBreakdown {
  overall: number;
  components: {
    communication: CommunicationEngagement;
    product: ProductEngagement;
    relationship: RelationshipEngagement;
  };
  trend: EngagementTrend;
  riskFactors: string[];
  recommendations: EngagementRecommendation[];
}

// ============================================
// Recommendations & Actions
// ============================================

/**
 * Engagement recommendation with priority
 */
export interface EngagementRecommendation {
  id: string;
  category: 'communication' | 'product' | 'relationship';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  actions: QuickAction[];
}

/**
 * Quick action for engagement improvement
 */
export interface QuickAction {
  id: string;
  label: string;
  type: 'schedule_meeting' | 'send_email' | 'create_campaign' | 'view_users' | 'export_data';
  data?: Record<string, unknown>;
}

// ============================================
// Historical Trends
// ============================================

/**
 * Historical engagement data point
 */
export interface EngagementHistoryPoint {
  date: string;
  month: string;
  communication: number;
  product: number;
  relationship: number;
  overall: number;
}

/**
 * Trend pattern analysis
 */
export interface TrendAnalysis {
  pattern: string;
  insight: string;
  recommendation?: string;
}

// ============================================
// Peer Comparison
// ============================================

/**
 * Peer comparison data
 */
export interface PeerComparison {
  overall: {
    customerScore: number;
    peerAvg: number;
    percentile: number;
  };
  communication: {
    customerScore: number;
    peerAvg: number;
    percentile: number;
  };
  product: {
    customerScore: number;
    peerAvg: number;
    percentile: number;
  };
  relationship: {
    customerScore: number;
    peerAvg: number;
    percentile: number;
  };
}

// ============================================
// Impact Analysis
// ============================================

/**
 * Impact projection based on score changes
 */
export interface ImpactProjection {
  targetScore: number;
  renewalProbabilityChange: number;
  expansionLikelihoodChange: number;
  referencePotential: 'high' | 'medium' | 'low';
  riskLevel?: 'high' | 'medium' | 'low';
  churnRiskChange?: number;
  healthScoreImpact?: number;
  recommendation?: string;
}

/**
 * Full impact analysis
 */
export interface ImpactAnalysis {
  improvement: ImpactProjection;
  decline: ImpactProjection;
}

// ============================================
// API Response Types
// ============================================

/**
 * Customer summary for engagement breakdown
 */
export interface EngagementCustomerSummary {
  id: string;
  name: string;
  arr: number;
  segment: string;
  industry?: string;
  renewalDate?: string;
  daysToRenewal?: number;
}

/**
 * Engagement highlights
 */
export interface EngagementHighlights {
  positive: string[];
  concerns: string[];
  rootCause?: string[];
}

/**
 * Component detail with highlights and actions
 */
export interface ComponentDetail {
  component: ScoreComponent;
  factors: EngagementFactor[];
  highlights: EngagementHighlights;
  actions: string[];
}

/**
 * Full engagement score response
 */
export interface EngagementScoreResponse {
  customer: EngagementCustomerSummary;
  score: EngagementScoreBreakdown;
  composition: ScoreComponent[];
  componentDetails: {
    communication: ComponentDetail;
    product: ComponentDetail;
    relationship: ComponentDetail;
  };
  history: EngagementHistoryPoint[];
  trendAnalysis: TrendAnalysis[];
  peerComparison: PeerComparison;
  impactAnalysis: ImpactAnalysis;
  updatedAt: string;
}

// ============================================
// Filter & Query Types
// ============================================

/**
 * Query parameters for engagement score
 */
export interface EngagementScoreQuery {
  customerId: string;
  period?: '7d' | '14d' | '30d' | '60d' | '90d';
  comparePeriod?: 'previous' | 'year_ago';
}

/**
 * Alert trigger conditions
 */
export interface EngagementAlert {
  type: 'score_drop' | 'component_critical' | 'overall_critical';
  severity: 'high' | 'medium' | 'critical';
  threshold: number;
  currentValue: number;
  message: string;
  triggeredAt: string;
}

// ============================================
// Constants
// ============================================

export const ENGAGEMENT_WEIGHTS = {
  communication: 0.50,
  product: 0.40,
  relationship: 0.10,
} as const;

export const COMMUNICATION_FACTOR_WEIGHTS = {
  emailResponseRate: 0.15,
  responseTime: 0.10,
  meetingAttendance: 0.15,
  proactiveOutreach: 0.10,
} as const;

export const PRODUCT_FACTOR_WEIGHTS = {
  loginFrequency: 0.15,
  featureBreadth: 0.10,
  sessionDuration: 0.05,
  activeUserPercent: 0.10,
} as const;

export const RELATIONSHIP_FACTOR_WEIGHTS = {
  stakeholderDepth: 0.05,
  executiveAccess: 0.03,
  championActivity: 0.02,
} as const;

export const ENGAGEMENT_THRESHOLDS = {
  healthy: { min: 70 },
  warning: { min: 50, max: 69 },
  critical: { min: 0, max: 49 },
} as const;
