/**
 * Executive Sponsor Types
 * PRD-246: Executive Sponsor Assignment
 *
 * Types for executive sponsor management, assignments, engagements, and impact metrics
 */

// ============================================
// EXECUTIVE SPONSOR TYPES
// ============================================

export interface ExecutiveSponsor {
  id: string;
  user_id: string;
  title: string;
  bio?: string;
  industries: string[];
  specialties: string[];
  max_accounts: number;
  current_accounts: number;
  active: boolean;
  created_at: Date;
  // Joined data
  user?: {
    id: string;
    email: string;
    name: string;
    avatar_url?: string;
  };
}

export interface CreateExecutiveSponsorRequest {
  user_id: string;
  title: string;
  bio?: string;
  industries?: string[];
  specialties?: string[];
  max_accounts?: number;
}

export interface UpdateExecutiveSponsorRequest {
  title?: string;
  bio?: string;
  industries?: string[];
  specialties?: string[];
  max_accounts?: number;
  active?: boolean;
}

// ============================================
// ASSIGNMENT TYPES
// ============================================

export type AssignmentStatus = 'proposed' | 'active' | 'ended';
export type EngagementCadence = 'monthly' | 'quarterly' | 'biannual';

export interface ExecutiveAssignment {
  id: string;
  customer_id: string;
  executive_sponsor_id: string;
  assigned_by_user_id?: string;
  status: AssignmentStatus;
  engagement_cadence: EngagementCadence;
  assignment_reason?: string;
  started_at: Date;
  ended_at?: Date;
  end_reason?: string;
  created_at: Date;
  // Joined data
  customer?: {
    id: string;
    name: string;
    arr: number;
    health_score?: number;
    industry?: string;
    segment?: string;
    renewal_date?: string;
  };
  executive_sponsor?: ExecutiveSponsor;
}

export interface CreateAssignmentRequest {
  customer_id: string;
  executive_sponsor_id: string;
  engagement_cadence?: EngagementCadence;
  assignment_reason?: string;
}

export interface UpdateAssignmentRequest {
  status?: AssignmentStatus;
  engagement_cadence?: EngagementCadence;
  end_reason?: string;
}

// ============================================
// ENGAGEMENT TYPES
// ============================================

export type EngagementType = 'meeting' | 'email' | 'ebr' | 'call' | 'event';
export type EngagementSource = 'manual' | 'calendar' | 'email';

export interface ExecutiveEngagement {
  id: string;
  assignment_id?: string;
  customer_id: string;
  executive_sponsor_id: string;
  engagement_type: EngagementType;
  title: string;
  description?: string;
  customer_attendees: string[];
  outcome?: string;
  next_steps?: string;
  engagement_date: Date;
  logged_by_user_id?: string;
  source: EngagementSource;
  external_id?: string;
  created_at: Date;
  // Joined data
  customer?: {
    id: string;
    name: string;
  };
  executive_sponsor?: ExecutiveSponsor;
}

export interface CreateEngagementRequest {
  assignment_id?: string;
  customer_id: string;
  executive_sponsor_id: string;
  engagement_type: EngagementType;
  title: string;
  description?: string;
  customer_attendees?: string[];
  outcome?: string;
  next_steps?: string;
  engagement_date: string | Date;
  source?: EngagementSource;
  external_id?: string;
}

export interface UpdateEngagementRequest {
  title?: string;
  description?: string;
  customer_attendees?: string[];
  outcome?: string;
  next_steps?: string;
}

// ============================================
// MATCHING ALGORITHM TYPES
// ============================================

export interface ExecutiveMatchFactors {
  industry_match: boolean;
  capacity_available: boolean;
  relationship_history: boolean;
  specialty_match: boolean;
}

export interface ExecutiveMatch {
  executive_sponsor_id: string;
  executive_sponsor: ExecutiveSponsor;
  match_score: number;
  factors: ExecutiveMatchFactors;
}

// ============================================
// CRITERIA TYPES
// ============================================

export interface SponsorCriteriaConditions {
  arr_min?: number;
  arr_max?: number;
  segment?: string;
  segments?: string[];
  industry?: string;
  industries?: string[];
  health_score_max?: number;
}

export interface ExecutiveSponsorCriteria {
  id: string;
  name: string;
  conditions: SponsorCriteriaConditions;
  auto_qualify: boolean;
  priority: number;
  active: boolean;
}

// ============================================
// PORTFOLIO & DASHBOARD TYPES
// ============================================

export interface SponsorPortfolioAccount {
  customer_id: string;
  customer_name: string;
  arr: number;
  health_score?: number;
  industry?: string;
  segment?: string;
  assignment_status: AssignmentStatus;
  engagement_cadence: EngagementCadence;
  last_engagement_date?: Date;
  days_since_engagement?: number;
  next_engagement_due?: Date;
  is_overdue: boolean;
  upcoming_renewal?: Date;
  total_engagements: number;
}

export interface SponsorPortfolio {
  executive_sponsor: ExecutiveSponsor;
  accounts: SponsorPortfolioAccount[];
  summary: {
    total_accounts: number;
    total_arr: number;
    avg_health_score: number;
    overdue_engagements: number;
    upcoming_renewals: number;
    engagements_this_quarter: number;
  };
}

export interface SponsorDashboard {
  executive_sponsor: ExecutiveSponsor;
  portfolio_summary: {
    total_accounts: number;
    total_arr: number;
    avg_health_score: number;
    health_distribution: {
      healthy: number;
      warning: number;
      critical: number;
    };
  };
  upcoming_commitments: Array<{
    type: 'engagement' | 'renewal' | 'meeting';
    customer_name: string;
    customer_id: string;
    date: Date;
    description: string;
  }>;
  overdue_touchpoints: Array<{
    customer_id: string;
    customer_name: string;
    days_overdue: number;
    expected_cadence: EngagementCadence;
    last_engagement?: Date;
  }>;
  recommended_actions: Array<{
    priority: 'high' | 'medium' | 'low';
    action_type: string;
    customer_id: string;
    customer_name: string;
    reason: string;
    suggested_action: string;
  }>;
  recent_engagements: ExecutiveEngagement[];
}

// ============================================
// IMPACT METRICS TYPES
// ============================================

export interface ImpactMetrics {
  period: {
    start: Date;
    end: Date;
  };
  sponsored_accounts: {
    count: number;
    total_arr: number;
    avg_health_score: number;
    renewal_rate: number;
    expansion_rate: number;
    avg_nps: number;
  };
  non_sponsored_accounts: {
    count: number;
    total_arr: number;
    avg_health_score: number;
    renewal_rate: number;
    expansion_rate: number;
    avg_nps: number;
  };
  lift: {
    health_score_lift: number;
    renewal_rate_lift: number;
    expansion_rate_lift: number;
    nps_lift: number;
  };
  executive_scorecard: Array<{
    executive_sponsor_id: string;
    executive_name: string;
    accounts: number;
    arr: number;
    avg_health_score: number;
    engagement_rate: number;
    renewal_rate: number;
    expansion_revenue: number;
  }>;
}

// ============================================
// QUALIFICATION TYPES
// ============================================

export interface QualifiedAccount {
  customer_id: string;
  customer_name: string;
  arr: number;
  segment?: string;
  industry?: string;
  health_score?: number;
  renewal_date?: string;
  matching_criteria: string[];
  has_sponsor: boolean;
  current_sponsor_id?: string;
}

export interface QualificationResult {
  qualified_accounts: QualifiedAccount[];
  total_qualified: number;
  total_assigned: number;
  total_unassigned: number;
  criteria_breakdown: Array<{
    criteria_name: string;
    accounts_matched: number;
  }>;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface PaginatedExecutiveSponsors {
  sponsors: ExecutiveSponsor[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginatedAssignments {
  assignments: ExecutiveAssignment[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginatedEngagements {
  engagements: ExecutiveEngagement[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// FILTER TYPES
// ============================================

export interface SponsorFilters {
  active?: boolean;
  has_capacity?: boolean;
  industry?: string;
  specialty?: string;
  search?: string;
}

export interface AssignmentFilters {
  customer_id?: string;
  executive_sponsor_id?: string;
  status?: AssignmentStatus;
  engagement_cadence?: EngagementCadence;
}

export interface EngagementFilters {
  customer_id?: string;
  executive_sponsor_id?: string;
  assignment_id?: string;
  engagement_type?: EngagementType;
  start_date?: Date;
  end_date?: Date;
}

// ============================================
// CONSTANTS
// ============================================

export const ENGAGEMENT_CADENCE_DAYS: Record<EngagementCadence, number> = {
  monthly: 30,
  quarterly: 90,
  biannual: 180
};

export const DEFAULT_ARR_THRESHOLD = 500000; // $500K ARR for executive sponsorship
export const DEFAULT_MAX_ACCOUNTS = 10;

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  meeting: 'Meeting',
  email: 'Email',
  ebr: 'Executive Business Review',
  call: 'Phone Call',
  event: 'Event'
};

export const CADENCE_LABELS: Record<EngagementCadence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  biannual: 'Bi-Annual'
};

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  proposed: 'Proposed',
  active: 'Active',
  ended: 'Ended'
};
