/**
 * Multi-Account Pattern Types (PRD-105)
 *
 * Type definitions for parent-child customer relationships
 * and cross-account pattern detection.
 */

// ============================================
// Relationship Types
// ============================================

export type CustomerRelationshipType = 'subsidiary' | 'division' | 'region' | 'brand' | 'department';

export interface CustomerFamily {
  parentCustomerId: string;
  parentName: string;
  totalArr: number;
  aggregatedHealthScore: number;
  children: CustomerFamilyMember[];
  healthTrend: 'improving' | 'stable' | 'declining';
}

export interface CustomerFamilyMember {
  customerId: string;
  name: string;
  relationshipType: CustomerRelationshipType;
  arr: number;
  healthScore: number;
  healthTrend: 'up' | 'down' | 'stable';
  stage: string;
  csmName?: string;
  lastContactDays: number;
  riskSignals: string[];
}

// ============================================
// Pattern Types
// ============================================

export type PatternType =
  | 'risk_contagion'           // Risk spreading from one account to others
  | 'replication_opportunity'  // Successful playbook that could be replicated
  | 'synchronized_change'      // Multiple accounts changing in sync
  | 'cross_expansion';         // Expansion from one subsidiary to another

export type PatternSeverity = 'low' | 'medium' | 'high' | 'critical';

export type PatternStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

// ============================================
// Pattern Details (Discriminated Union)
// ============================================

export interface RiskContagionDetails {
  sourceCustomerId: string;
  sourceCustomerName: string;
  riskType: 'usage_drop' | 'health_decline' | 'support_escalation' | 'champion_loss';
  riskSeverity: PatternSeverity;
  spreadRisk: number; // 0-100 probability of spreading
  affectedAccounts: Array<{
    customerId: string;
    name: string;
    currentHealth: number;
    riskExposure: 'high' | 'medium' | 'low';
    sharedFactors: string[];
  }>;
  rootCause?: string;
  timeline: string;
}

export interface ReplicationOpportunityDetails {
  successfulCustomerId: string;
  successfulCustomerName: string;
  playbook: {
    id: string;
    name: string;
    completedAt: string;
  };
  improvements: {
    healthScoreDelta: number;
    usageDelta: number;
    adoptionDelta: number;
    specificMetrics: Record<string, { before: number; after: number }>;
  };
  candidateAccounts: Array<{
    customerId: string;
    name: string;
    currentHealth: number;
    fitScore: number; // 0-100 how well this playbook fits
    missingElements: string[];
    potentialGain: number;
  }>;
  successStory: string;
}

export interface SynchronizedChangeDetails {
  changeType: 'health_improvement' | 'health_decline' | 'usage_spike' | 'usage_drop';
  changeMagnitude: number; // Average percentage change
  accountsInvolved: Array<{
    customerId: string;
    name: string;
    changeValue: number;
    changePercent: number;
  }>;
  correlationStrength: number; // 0-100
  possibleCause?: string;
  timeframe: {
    start: string;
    end: string;
  };
}

export interface CrossExpansionDetails {
  sourceCustomerId: string;
  sourceCustomerName: string;
  expansionType: 'feature' | 'seats' | 'tier_upgrade' | 'new_product';
  expansionDetails: {
    feature?: string;
    seatsDelta?: number;
    newTier?: string;
    product?: string;
    value: number;
  };
  similarAccounts: Array<{
    customerId: string;
    name: string;
    currentUsage: Record<string, number>;
    expansionPotential: number;
    readinessIndicators: string[];
  }>;
}

export type PatternDetails =
  | { type: 'risk_contagion'; data: RiskContagionDetails }
  | { type: 'replication_opportunity'; data: ReplicationOpportunityDetails }
  | { type: 'synchronized_change'; data: SynchronizedChangeDetails }
  | { type: 'cross_expansion'; data: CrossExpansionDetails };

// ============================================
// Pattern Record
// ============================================

export interface MultiAccountPattern {
  id: string;
  parentCustomerId: string;
  parentCustomerName?: string;
  patternType: PatternType;
  affectedCustomers: string[];
  details: PatternDetails;
  severity: PatternSeverity;
  confidenceScore: number;
  recommendation: string;
  status: PatternStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  detectedAt: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Detection Configuration
// ============================================

export interface PatternDetectionConfig {
  // Risk contagion thresholds
  riskContagion: {
    healthDropThreshold: number; // Health points drop to trigger
    usageDropThreshold: number; // Percentage usage drop
    minSimilarityScore: number; // Min similarity for contagion risk
    lookbackDays: number;
  };

  // Replication opportunity thresholds
  replicationOpportunity: {
    minHealthImprovement: number; // Points
    minUsageImprovement: number; // Percentage
    minConfidenceScore: number;
    lookbackDays: number;
  };

  // Synchronized change thresholds
  synchronizedChange: {
    minCorrelation: number; // 0-1
    minAffectedAccounts: number;
    changeMagnitudeThreshold: number;
    windowDays: number;
  };

  // Cross-expansion thresholds
  crossExpansion: {
    minExpansionValue: number;
    minReadinessScore: number;
    lookbackDays: number;
  };
}

export const DEFAULT_DETECTION_CONFIG: PatternDetectionConfig = {
  riskContagion: {
    healthDropThreshold: 15,
    usageDropThreshold: 25,
    minSimilarityScore: 60,
    lookbackDays: 30,
  },
  replicationOpportunity: {
    minHealthImprovement: 15,
    minUsageImprovement: 30,
    minConfidenceScore: 70,
    lookbackDays: 90,
  },
  synchronizedChange: {
    minCorrelation: 0.7,
    minAffectedAccounts: 2,
    changeMagnitudeThreshold: 10,
    windowDays: 14,
  },
  crossExpansion: {
    minExpansionValue: 10000,
    minReadinessScore: 65,
    lookbackDays: 60,
  },
};

// ============================================
// API Response Types
// ============================================

export interface FamilyDashboardResponse {
  family: CustomerFamily;
  patterns: MultiAccountPattern[];
  healthHistory: Array<{
    date: string;
    aggregatedScore: number;
    childScores: Record<string, number>;
  }>;
  recommendations: string[];
}

export interface PatternAlertPayload {
  patternId: string;
  patternType: PatternType;
  parentCustomerName: string;
  severity: PatternSeverity;
  headline: string;
  details: PatternDetails;
  recommendation: string;
  affectedAccounts: Array<{
    name: string;
    healthScore: number;
    arrAtRisk?: number;
  }>;
  actions: Array<{
    label: string;
    action: string;
    url?: string;
  }>;
}

// ============================================
// Service Method Types
// ============================================

export interface DetectPatternsOptions {
  parentCustomerId?: string;
  patternTypes?: PatternType[];
  config?: Partial<PatternDetectionConfig>;
}

export interface GetPatternsOptions {
  parentCustomerId?: string;
  patternTypes?: PatternType[];
  status?: PatternStatus[];
  severity?: PatternSeverity[];
  limit?: number;
  offset?: number;
  sortBy?: 'detected_at' | 'severity' | 'confidence_score';
  sortOrder?: 'asc' | 'desc';
}
