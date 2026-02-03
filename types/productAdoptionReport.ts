/**
 * Product Adoption Report Types
 * PRD-159: Product adoption analytics and feature usage tracking (Portfolio Report)
 *
 * This is distinct from productAdoption.ts (PRD-064) which is for real-time dashboard.
 * PRD-159 focuses on portfolio-level reporting and analytics.
 */

// ============================================
// Feature Definition Types
// ============================================

export interface FeatureDefinition {
  id: string;
  name: string;
  category: FeatureCategory;
  tier_required: string;
  importance_weight: number; // 1-10
  activation_threshold: number; // uses to consider "active"
  description?: string;
}

export type FeatureCategory = 'Core' | 'Advanced' | 'Integration' | 'Optional';

// Category weights for scoring
export const CATEGORY_WEIGHTS: Record<FeatureCategory, number> = {
  Core: 10,
  Advanced: 7,
  Integration: 5,
  Optional: 3
};

// ============================================
// Feature Usage Types
// ============================================

export type FeatureStatus = 'not_started' | 'exploring' | 'active' | 'power_user';

export interface FeatureUsageMetrics {
  unique_users: number;
  total_uses: number;
  avg_uses_per_user: number;
  last_used: string | null;
}

export interface FeatureUsage {
  customer_id: string;
  feature_id: string;
  feature_name: string;
  feature_category: FeatureCategory;
  period: string;
  usage: FeatureUsageMetrics;
  status: FeatureStatus;
  first_used: string | null;
  days_to_adopt: number | null;
}

// Status score mapping for adoption calculation
export const STATUS_SCORES: Record<FeatureStatus, number> = {
  not_started: 0,
  exploring: 0.3,
  active: 0.7,
  power_user: 1.0
};

// ============================================
// Adoption Score Types
// ============================================

export type AdoptionTrend = 'improving' | 'stable' | 'declining';

export interface AdoptionScores {
  overall_score: number; // 0-100
  breadth_score: number; // % features used
  depth_score: number; // avg usage intensity
  trend: AdoptionTrend;
  change: number;
}

export interface AdoptionFeatureCounts {
  total_available: number;
  using: number;
  not_started: number;
  exploring: number;
  active: number;
  power_user: number;
}

export interface AdoptionHighlights {
  top_features: string[];
  unused_valuable: string[];
  recently_started: string[];
}

export interface AdoptionMetrics {
  customer_id: string;
  customer_name: string;
  period: string;
  scores: AdoptionScores;
  features: AdoptionFeatureCounts;
  highlights: AdoptionHighlights;
}

// ============================================
// Adoption Level Classification
// ============================================

export type AdoptionLevel = 'power' | 'active' | 'exploring' | 'low';

export const ADOPTION_THRESHOLDS = {
  power: { min: 80, max: 100 },
  active: { min: 60, max: 79 },
  exploring: { min: 40, max: 59 },
  low: { min: 0, max: 39 }
};

// ============================================
// Portfolio Overview Types
// ============================================

export interface AdoptionBucket {
  count: number;
  arr: number;
  pct: number;
}

export interface PortfolioAdoptionOverview {
  total_customers: number;
  total_arr: number;
  avg_adoption_score: number;
  score_change_mom: number; // month-over-month
  power: AdoptionBucket;
  active: AdoptionBucket;
  exploring: AdoptionBucket;
  low: AdoptionBucket;
  avg_features_used: number;
  avg_features_available: number;
}

// ============================================
// Feature Adoption Rates
// ============================================

export interface FeatureAdoptionRate {
  feature_id: string;
  feature_name: string;
  feature_category: FeatureCategory;
  adoption_rate: number; // % of customers using
  avg_usage_intensity: number; // 0-100
  customer_count: number;
  trend: AdoptionTrend;
}

// ============================================
// Customer Summary for Portfolio View
// ============================================

export interface CustomerAdoptionSummary {
  customer_id: string;
  customer_name: string;
  adoption_score: number;
  level: AdoptionLevel;
  trend: AdoptionTrend;
  score_change: number;
  arr: number;
  segment: string;
  features_using: number;
  features_available: number;
  top_gap: string | null;
  days_since_new_feature: number | null;
}

// ============================================
// Recommendations
// ============================================

export type RecommendationPriority = 'high' | 'medium' | 'low';

export interface FeatureRecommendation {
  feature_id: string;
  feature_name: string;
  feature_category: FeatureCategory;
  reason: string;
  priority: RecommendationPriority;
  potential_impact: string;
  suggested_action: string;
  training_resource?: string;
}

// ============================================
// Adoption Trend Data
// ============================================

export interface AdoptionTrendPoint {
  date: string;
  avg_score: number;
  features_adopted: number;
  new_activations: number;
}

// ============================================
// Correlation Analysis
// ============================================

export interface AdoptionCorrelation {
  outcome: 'health' | 'retention' | 'expansion';
  correlation_coefficient: number;
  insight: string;
  sample_size: number;
}

// ============================================
// API Response Types
// ============================================

// Portfolio overview response
export interface ProductAdoptionPortfolioResponse {
  overview: PortfolioAdoptionOverview;
  customers: CustomerAdoptionSummary[];
  feature_adoption_rates: FeatureAdoptionRate[];
  low_adopters: CustomerAdoptionSummary[];
}

// Customer detail response
export interface ProductAdoptionCustomerResponse {
  metrics: AdoptionMetrics;
  features: FeatureUsage[];
  trends: AdoptionTrendPoint[];
  recommendations: FeatureRecommendation[];
}

// Correlation response
export interface AdoptionCorrelationResponse {
  correlations: AdoptionCorrelation[];
  key_findings: string[];
}

// ============================================
// Filter Types
// ============================================

export interface ProductAdoptionFilters {
  level_filter?: 'all' | AdoptionLevel;
  segment?: string;
  csm_id?: string;
  search?: string;
  sort_by?: 'score' | 'arr' | 'features' | 'name' | 'change';
  sort_order?: 'asc' | 'desc';
  period?: string;
}
