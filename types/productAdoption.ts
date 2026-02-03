/**
 * Product Adoption Dashboard Types (PRD-064)
 *
 * TypeScript interfaces for the Product Adoption Dashboard feature.
 */

export interface UserMetrics {
  dau: number;
  wau: number;
  mau: number;
  licensedUsers: number;
  activatedUsers: number;
  userActivationRate: number;
  powerUsers: number;
  powerUserPercentage: number;
  dormantUsers: number;
  dormantUserPercentage: number;
  avgLoginFrequency: number;
  avgSessionDuration: number;
  userHealthBreakdown: {
    active: number;
    engaged: number;
    atRisk: number;
    dormant: number;
  };
  trends: {
    dauChange: number;
    wauChange: number;
    mauChange: number;
    activationChange: number;
  };
}

export interface FeatureAdoption {
  featureId: string;
  featureName: string;
  category: 'core' | 'advanced' | 'power';
  isAdopted: boolean;
  usagePercentage: number;
  usersCount: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  peerUsage: number;
  timeToAdoptDays: number | null;
  lastUsed: string | null;
}

export interface EngagementMetrics {
  actionsPerSession: number;
  apiUsage: {
    current: number;
    limit: number;
    utilizationPercentage: number;
  };
  integrationsUsed: number;
  integrationsAvailable: number;
  contentCreated: {
    reports: number;
    dashboards: number;
    automations: number;
    total: number;
    trend: 'growing' | 'stable' | 'declining';
  };
  collaborationRate: number;
}

export interface EntitlementUsage {
  name: string;
  used: number;
  entitled: number;
  utilizationPercentage: number;
  unit: string;
}

export interface PeerComparison {
  metric: string;
  customerValue: number;
  peerAverage: number;
  percentile: number;
  comparison: 'above' | 'average' | 'below';
}

export type RecommendationActionType =
  | 'schedule_training'
  | 'send_guide'
  | 'export_list'
  | 'share_link'
  | 'generate_report'
  | 'create_campaign';

export interface RecommendationAction {
  label: string;
  type: RecommendationActionType;
}

export interface Recommendation {
  id: string;
  type: 'immediate' | 'value_demonstration';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  metric: string;
  impact: string;
  actions: RecommendationAction[];
}

export interface UsagePattern {
  dayOfWeek: string;
  hour: number;
  intensity: number;
}

export interface AdoptionMilestone {
  date: string;
  milestone: string;
  description: string;
}

export interface TrendData {
  date: string;
  dau: number;
  wau: number;
  mau: number;
  adoptionScore: number;
}

export interface UnusedFeature {
  featureName: string;
  peerUsage: number;
  valueProp: string;
}

export interface FeatureAdoptionSummary {
  coreFeaturesAdopted: number;
  coreFeaturesTotal: number;
  advancedFeaturesAdopted: number;
  advancedFeaturesTotal: number;
  powerFeaturesAdopted: number;
  powerFeaturesTotal: number;
  overallBreadth: number;
  featureStickiness: number;
}

export interface ValueSummary {
  estimatedHoursSaved: number;
  topBenefit: string;
  topBenefitImpact: string;
}

export interface ProductAdoptionDashboard {
  customerId: string;
  customerName: string;
  generatedAt: string;
  period: string;
  adoptionScore: number;
  adoptionScoreTrend: number;
  adoptionCategory: 'excellent' | 'good' | 'fair' | 'poor';
  userMetrics: UserMetrics;
  featureAdoption: FeatureAdoption[];
  featureAdoptionSummary: FeatureAdoptionSummary;
  engagementMetrics: EngagementMetrics;
  entitlementUsage: EntitlementUsage[];
  peerComparison: PeerComparison[];
  usagePatterns: UsagePattern[];
  adoptionMilestones: AdoptionMilestone[];
  trends: TrendData[];
  recommendations: Recommendation[];
  unusedFeatures: UnusedFeature[];
  valueSummary: ValueSummary;
}

export type AdoptionPeriod = '7d' | '30d' | '90d' | 'all';
export type ComparisonType = 'peers' | 'segment' | 'all_customers';

export interface AdoptionDashboardApiResponse {
  success: boolean;
  data?: ProductAdoptionDashboard;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    generatedAt: string;
    responseTimeMs: number;
    period: string;
    adoptionScore: number;
  };
}
