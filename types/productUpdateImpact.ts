/**
 * Product Update Impact Types
 * PRD-126: Product Update Impact Assessment
 *
 * When product updates are released, CSMs need to understand which customers
 * are affected and how to communicate changes effectively.
 */

// ============================================
// Core Enums and Types
// ============================================

export type UpdateType = 'feature' | 'improvement' | 'fix' | 'deprecation' | 'breaking';

export type ImpactType = 'positive' | 'neutral' | 'action_required' | 'at_risk';

export type AdoptionStatus = 'not_started' | 'in_progress' | 'completed';

export type MigrationStatus = 'not_started' | 'planning' | 'in_progress' | 'completed' | 'blocked';

// ============================================
// Product Update Types
// ============================================

export interface ProductUpdate {
  id: string;
  name: string;
  version: string;
  updateType: UpdateType;
  description: string;
  releaseNotes: string;
  releasedAt: Date;
  effectiveDate: Date | null; // For deprecations/breaking changes
  deprecationDeadline: Date | null; // For deprecations
  affectedFeatures: string[];
  prerequisites: string[]; // Required entitlements/features
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductUpdateInput {
  name: string;
  version: string;
  updateType: UpdateType;
  description: string;
  releaseNotes: string;
  releasedAt?: Date;
  effectiveDate?: Date;
  deprecationDeadline?: Date;
  affectedFeatures: string[];
  prerequisites?: string[];
}

// ============================================
// Customer Impact Types
// ============================================

export interface CustomerImpact {
  id: string;
  updateId: string;
  customerId: string;
  customerName: string;
  impactType: ImpactType;
  relevanceScore: number; // 0-100
  reasons: ImpactReason[];
  recommendedAction: string;
  talkingPoints: string[];
  notifiedAt: Date | null;
  csmNotifiedAt: Date | null;
  adoptionStatus: AdoptionStatus;
  adoptionStartedAt: Date | null;
  adoptionCompletedAt: Date | null;
  feedback: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImpactReason {
  factor: ImpactFactor;
  score: number; // 0-100 contribution to relevance
  details: string;
}

export type ImpactFactor =
  | 'usage_pattern'       // Customer actively uses affected feature
  | 'entitlement'         // Customer has required entitlement
  | 'technical_compat'    // Customer's tech stack compatibility
  | 'workflow_disruption' // Change affects customer's workflow
  | 'tier_priority'       // Customer tier (enterprise, mid-market, SMB)
  | 'renewal_proximity'   // Renewal coming up
  | 'health_score';       // Current health score

// ============================================
// Communication Template Types
// ============================================

export interface CommunicationTemplate {
  id: string;
  updateId: string;
  templateType: TemplateType;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: TemplateVariable[];
  targetImpactTypes: ImpactType[];
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateType =
  | 'announcement'
  | 'faq'
  | 'training_invitation'
  | 'feature_guide'
  | 'migration_guide'
  | 'deprecation_notice';

export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue: string;
}

export interface PersonalizedCommunication {
  template: CommunicationTemplate;
  customerId: string;
  customerName: string;
  personalizedSubject: string;
  personalizedBody: string;
  variables: Record<string, string>;
}

// ============================================
// Adoption Tracking Types
// ============================================

export interface AdoptionMetric {
  id: string;
  updateId: string;
  customerId: string;
  customerName: string;
  featureEnabled: boolean;
  featureEnabledAt: Date | null;
  usageCount: number;
  usageTrend: 'increasing' | 'stable' | 'decreasing' | 'not_started';
  lastUsedAt: Date | null;
  adoptionBlockers: AdoptionBlocker[];
  feedbackReceived: boolean;
  feedbackSentiment: 'positive' | 'neutral' | 'negative' | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdoptionBlocker {
  type: BlockerType;
  description: string;
  reportedAt: Date;
  resolvedAt: Date | null;
}

export type BlockerType =
  | 'technical_issue'
  | 'training_needed'
  | 'resource_constraint'
  | 'integration_dependency'
  | 'change_resistance'
  | 'priority_conflict';

export interface AdoptionSummary {
  updateId: string;
  totalCustomers: number;
  adoptionRate: number; // percentage
  byStatus: {
    not_started: number;
    in_progress: number;
    completed: number;
  };
  avgDaysToAdoption: number | null;
  topBlockers: Array<{ type: BlockerType; count: number }>;
  feedbackSummary: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

// ============================================
// Deprecation Management Types
// ============================================

export interface DeprecationTracking {
  id: string;
  updateId: string;
  customerId: string;
  customerName: string;
  migrationStatus: MigrationStatus;
  migrationDeadline: Date;
  daysRemaining: number;
  migrationStartedAt: Date | null;
  migrationCompletedAt: Date | null;
  blockers: MigrationBlocker[];
  escalated: boolean;
  escalatedAt: Date | null;
  escalationReason: string | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}

export interface MigrationBlocker {
  type: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  reportedAt: Date;
  resolvedAt: Date | null;
}

export interface DeprecationSummary {
  updateId: string;
  deprecationDeadline: Date;
  totalAffectedCustomers: number;
  byStatus: Record<MigrationStatus, number>;
  atRiskCount: number; // Customers unlikely to meet deadline
  completedCount: number;
  avgDaysToMigration: number | null;
  escalations: number;
  arrAtRisk: number;
}

// ============================================
// CSM Notification Types
// ============================================

export interface CSMNotification {
  id: string;
  updateId: string;
  csmId: string;
  csmName: string;
  affectedCustomers: CustomerImpactSummary[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notifiedAt: Date | null;
  acknowledgedAt: Date | null;
  communicationsSent: number;
  communicationsPending: number;
}

export interface CustomerImpactSummary {
  customerId: string;
  customerName: string;
  arr: number;
  tier: string;
  impactType: ImpactType;
  relevanceScore: number;
  recommendedAction: string;
  daysToRenewal: number | null;
}

// ============================================
// API Request/Response Types
// ============================================

export interface ProductUpdateImpactFilters {
  updateType?: UpdateType;
  impactType?: ImpactType;
  adoptionStatus?: AdoptionStatus;
  search?: string;
  sortBy?: 'relevance' | 'arr' | 'name' | 'date' | 'adoption';
  sortOrder?: 'asc' | 'desc';
  customerId?: string;
}

export interface ProductUpdateListResponse {
  updates: ProductUpdate[];
  total: number;
  hasMore: boolean;
}

export interface ProductUpdateImpactResponse {
  update: ProductUpdate;
  impactSummary: {
    totalCustomers: number;
    byImpactType: Record<ImpactType, number>;
    totalARRImpacted: number;
    avgRelevanceScore: number;
  };
  customerImpacts: CustomerImpact[];
  adoptionMetrics: AdoptionSummary | null;
  deprecationStatus: DeprecationSummary | null;
  communicationTemplates: CommunicationTemplate[];
}

export interface CustomerUpdatesResponse {
  customerId: string;
  customerName: string;
  updates: Array<{
    update: ProductUpdate;
    impact: CustomerImpact;
    adoption: AdoptionMetric | null;
  }>;
}

export interface NotifyCSMsRequest {
  updateId: string;
  csmIds?: string[]; // If empty, notify all affected CSMs
  message?: string;
}

export interface NotifyCSMsResponse {
  notified: number;
  notifications: CSMNotification[];
}

// ============================================
// Product Update Impact Assessment Result
// ============================================

export interface ProductUpdateImpactAssessment {
  id: string;
  updateId: string;
  updateType: UpdateType;
  releasedAt: Date;
  customerImpacts: CustomerImpact[];
  communicationTemplates: CommunicationTemplate[];
  adoptionMetrics: AdoptionMetric[];
  assessedAt: Date;
  assessmentDuration: number; // milliseconds
}

// ============================================
// Update Detection Sources
// ============================================

export type DetectionSource =
  | 'release_notes'
  | 'feature_flag'
  | 'deployment'
  | 'manual';

export interface UpdateDetection {
  source: DetectionSource;
  detectedAt: Date;
  rawPayload: Record<string, unknown>;
}
