/**
 * Feature Adoption Stalled Detection Types (PRD-090)
 *
 * Types for tracking feature adoption and detecting stalls.
 * When feature adoption stalls after initial onboarding, this system
 * triggers enablement workflows to help customers realize full value.
 */

// ============================================
// Adoption Stage Types
// ============================================

export type AdoptionStage =
  | 'not_started'  // Feature activated but never used
  | 'started'      // Some usage but minimal
  | 'engaged'      // Regular usage, not yet at full adoption
  | 'adopted'      // Full adoption achieved
  | 'churned';     // Was adopted, now declining

export type ResourceType = 'video' | 'documentation' | 'webinar' | 'guide' | 'tutorial';

export type InterventionType = 'email' | 'call' | 'training' | 'resource_share' | 'in_app_tip';

export type CustomerSegment = 'enterprise' | 'mid-market' | 'smb';

// ============================================
// Training Resource Types
// ============================================

export interface TrainingResource {
  type: ResourceType;
  title: string;
  url: string;
  durationMinutes?: number;
  level?: 'beginner' | 'intermediate' | 'advanced';
  nextSession?: string; // ISO date for webinars
}

// ============================================
// Feature Catalog Types
// ============================================

export interface FeatureCatalog {
  featureId: string;
  featureName: string;
  category: string;
  importanceScore: number; // 0-100
  expectedAdoptionDays: number;
  trainingResources: TrainingResource[];
  tips: string;
  keyBenefit?: string;
  createdAt: Date;
}

// ============================================
// Feature Adoption Types
// ============================================

export interface FeatureAdoption {
  id: string;
  customerId: string;
  featureId: string;
  featureName: string;
  activatedAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  usageScore: number; // 0-100
  stage: AdoptionStage;
  expectedAdoptionDays: number;
  stallDetectedAt: Date | null;
  interventionSentAt: Date | null;
  interventionType: InterventionType | null;
  adoptionAfterIntervention: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Usage Event Types
// ============================================

export interface UsageEvent {
  id: string;
  customerId: string;
  featureId: string;
  userId: string;
  eventType: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============================================
// Stall Detection Types
// ============================================

export interface FeatureAdoptionCheck {
  customerId: string;
  customerName: string;
  featureId: string;
  featureName: string;
  activatedAt: Date;
  expectedAdoptionDays: number;
  usageEvents: UsageEvent[];
  currentUsageScore: number;
  lastUsedAt: Date | null;
  importanceScore: number;
  arr: number;
  segment: CustomerSegment;
  category: string;
}

export type StallSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface StallIssue {
  type: 'low_usage' | 'no_recent_activity' | 'declining_usage' | 'feature_never_used';
  severity: StallSeverity;
  details: string;
  daysStalled: number;
  usageScore: number;
}

export interface FeatureStallResult {
  isStalled: boolean;
  customerId: string;
  customerName: string;
  featureId: string;
  featureName: string;
  category: string;
  stage: AdoptionStage;
  usageScore: number;
  expectedScore: number;
  issues: StallIssue[];
  highestSeverity: StallSeverity;
  daysSinceActivation: number;
  daysInCurrentStage: number;
  lastUsedAt: Date | null;
  suggestedInterventions: string[];
  trainingResources: TrainingResource[];
  importanceScore: number;
  arr: number;
  segment: CustomerSegment;
  whyItMatters: string;
}

// ============================================
// Aggregated Stall Alert Types
// ============================================

export interface AggregatedStallAlert {
  customerId: string;
  customerName: string;
  arr: number;
  segment: CustomerSegment;
  overallAdoptionScore: number;
  stalledFeatures: FeatureStallResult[];
  highestSeverity: StallSeverity;
  totalFeaturesStalled: number;
  arrAtRisk: number;
  primaryRecommendation: string;
  createdAt: Date;
}

// ============================================
// Intervention Types
// ============================================

export interface EnablementIntervention {
  customerId: string;
  customerName: string;
  featureId: string;
  featureName: string;
  interventionType: InterventionType;
  details: string;
  resourcesShared: string[];
  executedAt: Date;
  executedBy?: string;
}

export interface InterventionResult {
  customerId: string;
  customerName: string;
  featureId: string;
  interventionType: InterventionType;
  actions: Array<{
    type: string;
    title: string;
    description: string;
    data?: Record<string, unknown>;
  }>;
  notificationsSent: {
    slack: boolean;
    email: boolean;
    inApp: boolean;
  };
  emailDraftId?: string;
  taskCreated?: string;
  executedAt: Date;
}

// ============================================
// Dashboard Types
// ============================================

export interface FeatureAdoptionCard {
  customerId: string;
  customerName: string;
  featureId: string;
  featureName: string;
  category: string;
  stage: AdoptionStage;
  usageScore: number;
  daysInCurrentStage: number;
  lastUsedAt: Date | null;
  isStalled: boolean;
  highestSeverity: StallSeverity | null;
  availableResourcesCount: number;
  suggestedAction: string;
  arr: number;
}

export interface CustomerAdoptionSummary {
  customerId: string;
  customerName: string;
  overallAdoptionScore: number;
  totalFeatures: number;
  adoptedCount: number;
  stalledCount: number;
  notStartedCount: number;
  features: FeatureAdoptionCard[];
  stalledFeatures: FeatureStallResult[];
  recommendations: string[];
  healthImpact: 'positive' | 'neutral' | 'negative';
}

export interface FeatureAdoptionDashboard {
  totalCustomersWithStalls: number;
  totalStalledFeatures: number;
  totalArrAtRisk: number;
  averageAdoptionScore: number;
  stallsBySeverity: Record<StallSeverity, number>;
  stallsByFeature: Record<string, number>;
  stallsBySegment: Record<CustomerSegment, number>;
  topStalledFeatures: Array<{
    featureId: string;
    featureName: string;
    stallCount: number;
    arrAtRisk: number;
  }>;
  customerAlerts: AggregatedStallAlert[];
}

// ============================================
// API Response Types
// ============================================

export interface FeatureAdoptionResponse {
  overallAdoptionScore: number;
  features: Array<{
    featureId: string;
    featureName: string;
    stage: AdoptionStage;
    usageScore: number;
    lastUsedAt: string | null;
    isStalled: boolean;
    daysInCurrentStage: number;
  }>;
  stalledFeatures: FeatureStallResult[];
  recommendations: string[];
}

export interface FeatureResourcesResponse {
  feature: FeatureCatalog;
  resources: TrainingResource[];
  suggestedOutreach: string;
}

// ============================================
// Stall Detection Configuration
// ============================================

export interface StallDetectionConfig {
  // Minimum usage score to avoid stall (0-100)
  minUsageThreshold: number;
  // Days after activation before checking for stall
  gracePeriodDays: number;
  // Days of low usage before triggering stall
  stallThresholdDays: number;
  // Cooldown period between alerts (days)
  alertCooldownDays: number;
  // Segment-specific thresholds
  segmentThresholds: Record<CustomerSegment, {
    minUsage: number;
    gracePeriod: number;
    stallThreshold: number;
  }>;
}

export const DEFAULT_STALL_CONFIG: StallDetectionConfig = {
  minUsageThreshold: 20,
  gracePeriodDays: 7,
  stallThresholdDays: 14,
  alertCooldownDays: 30,
  segmentThresholds: {
    enterprise: {
      minUsage: 20,
      gracePeriod: 10,
      stallThreshold: 21,
    },
    'mid-market': {
      minUsage: 25,
      gracePeriod: 7,
      stallThreshold: 14,
    },
    smb: {
      minUsage: 30,
      gracePeriod: 5,
      stallThreshold: 10,
    },
  },
};

// ============================================
// Severity Thresholds
// ============================================

export const SEVERITY_THRESHOLDS = {
  low: { daysStalled: 0, usageBelow: 30 },
  medium: { daysStalled: 7, usageBelow: 20 },
  high: { daysStalled: 14, usageBelow: 10 },
  critical: { daysStalled: 21, usageBelow: 5 },
};
