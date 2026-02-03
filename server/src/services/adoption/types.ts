/**
 * PRD-090: Feature Adoption Stalled - Types
 *
 * Type definitions for feature adoption tracking and enablement workflows.
 */

// ============================================
// Feature Catalog Types
// ============================================

export interface TrainingResource {
  type: 'video' | 'documentation' | 'webinar' | 'guide' | 'tutorial';
  title: string;
  url: string;
  duration_minutes?: number;
  level?: 'beginner' | 'intermediate' | 'advanced';
  next_session?: string; // For webinars
}

export interface FeatureCatalog {
  feature_id: string;
  feature_name: string;
  category?: string;
  importance_score: number; // 0-100
  expected_adoption_days: number;
  training_resources: TrainingResource[];
  tips?: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// Adoption Stage Types
// ============================================

export type AdoptionStage = 'not_started' | 'started' | 'engaged' | 'adopted' | 'churned';

export interface FeatureAdoption {
  id: string;
  customer_id: string;
  feature_id: string;
  feature_name: string;
  activated_at?: Date;
  last_used_at?: Date;
  usage_count: number;
  usage_score: number; // 0-100
  stage: AdoptionStage;
  expected_adoption_days: number;
  stall_detected_at?: Date;
  intervention_sent_at?: Date;
  intervention_type?: InterventionType;
  adoption_after_intervention?: number;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// Intervention Types
// ============================================

export type InterventionType = 'email' | 'call' | 'training' | 'resource_share' | 'in_app_tip';

export interface EnablementIntervention {
  id: string;
  feature_adoption_id: string;
  customer_id: string;
  feature_id: string;
  intervention_type: InterventionType;
  details?: string;
  resources_shared: TrainingResource[];
  sent_by?: string;
  sent_at: Date;
  response_received: boolean;
  response_at?: Date;
  adoption_score_before?: number;
  adoption_score_after?: number;
  effectiveness_score?: number; // 0-100
  created_at: Date;
}

// ============================================
// Detection Types
// ============================================

export interface AdoptionStallAlert {
  id: string;
  customerId: string;
  customerName: string;
  featureId: string;
  featureName: string;
  currentStage: AdoptionStage;
  usageScore: number;
  expectedUsageScore: number;
  daysInCurrentStage: number;
  daysSinceActivation: number;
  expectedAdoptionDays: number;
  severity: 'medium' | 'high' | 'critical';
  featureImportance: number;
  detectedAt: Date;
  cooldownExpiresAt: Date;
  trainingResources?: TrainingResource[];
}

export interface AdoptionDetectionResult {
  customerId: string;
  customerName: string;
  alerts: AdoptionStallAlert[];
  skipped: boolean;
  skipReason?: string;
}

export interface DetectionConfig {
  stallThresholdDays?: number;      // Default: 14 - days of low usage to trigger stall
  usageThreshold?: number;          // Default: 20 - usage score below this is considered stalled
  cooldownDays?: number;            // Default: 30 - days between alerts for same feature
  minImportanceScore?: number;      // Default: 50 - only track features above this importance
  excludeFeatureIds?: string[];     // Features to exclude from detection
}

// ============================================
// API Response Types
// ============================================

export interface CustomerAdoptionStatus {
  overallAdoptionScore: number;
  features: Array<{
    featureId: string;
    featureName: string;
    stage: AdoptionStage;
    usageScore: number;
    lastUsedAt?: string;
    isStalled: boolean;
    daysInCurrentStage: number;
    trainingResourceCount: number;
  }>;
  stalledFeatures: FeatureAdoption[];
  recommendations: string[];
}

export interface EnablementResources {
  feature: FeatureCatalog;
  resources: TrainingResource[];
  suggestedOutreach: string;
}

// ============================================
// Event Types for Trigger Engine
// ============================================

export interface AdoptionStallEventData {
  featureId: string;
  featureName: string;
  currentStage: AdoptionStage;
  usageScore: number;
  daysSinceActivation: number;
  expectedAdoptionDays: number;
  daysInCurrentStage: number;
  severity: 'medium' | 'high' | 'critical';
  featureImportance: number;
  trainingResourcesAvailable: number;
}

// ============================================
// Workflow Types
// ============================================

export interface EnablementWorkflowContext {
  customerId: string;
  customerName: string;
  customerArr?: number;
  featureId: string;
  featureName: string;
  usageScore: number;
  stage: AdoptionStage;
  trainingResources: TrainingResource[];
  primaryContactEmail?: string;
  csmName?: string;
}
