/**
 * Customer Segmentation Analysis Types
 * PRD-175: Customer Segmentation Analysis
 *
 * Features:
 * - Multi-dimensional segmentation
 * - Dynamic segments (auto-update)
 * - Segment profiles with KPIs
 * - Segment movement tracking
 */

// ============================================
// Segment Definition Types
// ============================================

export type SegmentOperator = 'equals' | 'greater' | 'less' | 'between' | 'in' | 'not_equals';

export interface SegmentCriteria {
  attribute: string;
  operator: SegmentOperator;
  value: string | number | string[] | number[] | { min: number; max: number };
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  criteria: SegmentCriteria[];
  customer_count: number;
  total_arr: number;
  is_dynamic: boolean;
  color?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Segment Profile Types
// ============================================

export interface SegmentDemographics {
  avg_arr: number;
  median_arr: number;
  avg_company_size: number;
  top_industries: Array<{ name: string; count: number; pct: number }>;
  avg_tenure_months: number;
  tenure_distribution: {
    under_6_months: number;
    six_to_12_months: number;
    one_to_2_years: number;
    over_2_years: number;
  };
}

export interface SegmentPerformance {
  avg_health_score: number;
  health_distribution: {
    healthy: number;
    warning: number;
    critical: number;
  };
  avg_adoption_score: number;
  nrr: number;
  gross_retention: number;
  churn_rate: number;
  expansion_rate: number;
}

export interface SegmentEngagement {
  avg_meetings_per_quarter: number;
  avg_email_response_rate: number;
  avg_time_to_respond_hours: number;
  support_ticket_rate: number;
  avg_nps_score: number | null;
  feature_adoption_rate: number;
}

export interface SegmentProfile {
  segment: Segment;
  demographics: SegmentDemographics;
  performance: SegmentPerformance;
  engagement: SegmentEngagement;
  recommendations: string[];
  characteristics: string[];
  top_customers: Array<{
    id: string;
    name: string;
    arr: number;
    health_score: number;
  }>;
}

// ============================================
// Segment Movement Types
// ============================================

export interface SegmentMovement {
  customer_id: string;
  customer_name: string;
  from_segment: string;
  to_segment: string;
  movement_type: 'upgrade' | 'downgrade' | 'lateral';
  arr: number;
  moved_at: string;
}

export interface SegmentMovementSummary {
  period: string;
  movements: SegmentMovement[];
  summary: {
    upgrades: number;
    downgrades: number;
    lateral: number;
    arr_upgraded: number;
    arr_downgraded: number;
  };
}

// ============================================
// Segment Comparison Types
// ============================================

export interface SegmentComparison {
  segments: Array<{
    segment_id: string;
    segment_name: string;
    customer_count: number;
    total_arr: number;
    avg_health_score: number;
    nrr: number;
    churn_rate: number;
    avg_tenure_months: number;
    risk_count: number;
  }>;
  metrics: Array<{
    name: string;
    unit: string;
    segments: Record<string, number>;
    best_performer: string;
    worst_performer: string;
  }>;
}

// ============================================
// Customer in Segment
// ============================================

export interface CustomerInSegment {
  id: string;
  name: string;
  arr: number;
  health_score: number;
  industry: string;
  tenure_months: number;
  renewal_date: string | null;
  days_to_renewal: number | null;
  stage: string;
  company_size: number | null;
  risk_level: 'low' | 'medium' | 'high';
}

// ============================================
// API Response Types
// ============================================

export interface SegmentOverview {
  total_customers: number;
  total_arr: number;
  segment_count: number;
  unassigned_customers: number;
  unassigned_arr: number;
}

export interface SegmentAnalysisResponse {
  overview: SegmentOverview;
  segments: Segment[];
  comparison: SegmentComparison;
  recent_movements: SegmentMovementSummary;
}

export interface SegmentProfileResponse {
  profile: SegmentProfile;
  customers: CustomerInSegment[];
}

export interface CreateSegmentRequest {
  name: string;
  description?: string;
  criteria: SegmentCriteria[];
  is_dynamic: boolean;
  color?: string;
}

// ============================================
// Filter Types
// ============================================

export interface SegmentAnalysisFilters {
  segment_id?: string;
  sort_by?: 'name' | 'arr' | 'count' | 'health' | 'nrr' | 'churn';
  sort_order?: 'asc' | 'desc';
  search?: string;
  movement_period?: '7d' | '30d' | '90d' | 'quarter';
}

// ============================================
// Predefined Segment Templates
// ============================================

export const PREDEFINED_SEGMENTS = {
  arr_tiers: [
    { name: 'Enterprise', criteria: [{ attribute: 'arr', operator: 'greater', value: 100000 }] },
    { name: 'Mid-Market', criteria: [{ attribute: 'arr', operator: 'between', value: { min: 25000, max: 100000 } }] },
    { name: 'SMB', criteria: [{ attribute: 'arr', operator: 'less', value: 25000 }] }
  ],
  health_segments: [
    { name: 'Healthy', criteria: [{ attribute: 'health_score', operator: 'greater', value: 70 }] },
    { name: 'At Risk', criteria: [{ attribute: 'health_score', operator: 'between', value: { min: 40, max: 70 } }] },
    { name: 'Critical', criteria: [{ attribute: 'health_score', operator: 'less', value: 40 }] }
  ],
  tenure_segments: [
    { name: 'New', criteria: [{ attribute: 'tenure_months', operator: 'less', value: 6 }] },
    { name: 'Established', criteria: [{ attribute: 'tenure_months', operator: 'between', value: { min: 6, max: 24 } }] },
    { name: 'Mature', criteria: [{ attribute: 'tenure_months', operator: 'greater', value: 24 }] }
  ]
} as const;

// Segment colors for UI
export const SEGMENT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
];
