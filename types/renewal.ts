/**
 * PRD-163: Renewal Forecast Report
 * TypeScript types for renewal tracking and forecasting
 */

// Renewal Stage enum
export type RenewalStage =
  | 'not_started'
  | 'prep'
  | 'value_review'
  | 'proposal_sent'
  | 'negotiation'
  | 'verbal_commit'
  | 'closed';

// Risk Level enum
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Renewal Outcome enum
export type RenewalOutcome = 'renewed' | 'churned' | 'downgraded' | 'expanded';

// Renewal checklist item
export interface RenewalChecklistItem {
  id: string;
  renewal_id: string;
  item_key: string;
  item_label: string;
  timing_days: number;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: string;
  sort_order: number;
}

// Core Renewal interface
export interface Renewal {
  id: string;
  customer_id: string;
  customer_name?: string;

  // Renewal details
  renewal_date: string;
  days_to_renewal?: number;
  current_arr: number;
  proposed_arr?: number;

  // Stage tracking
  stage: RenewalStage;
  probability: number;
  risk_level: RiskLevel;

  // Scores
  health_score?: number;
  engagement_score?: number;
  nps_score?: number;

  // Readiness
  readiness_score: number;
  checklist?: RenewalChecklistItem[];

  // Outcome (if complete)
  outcome?: RenewalOutcome;
  outcome_arr?: number;
  outcome_date?: string;

  // Ownership
  csm_id?: string;
  owner_name?: string;

  // Notes
  notes?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// Renewal with enriched customer data
export interface RenewalWithCustomer extends Renewal {
  customer: {
    id: string;
    name: string;
    industry?: string;
    segment?: string;
  };
}

// Renewal Forecast aggregate
export interface RenewalForecast {
  period: string;
  period_start: string;
  period_end: string;
  target?: number;

  pipeline: {
    total_renewals: number;
    total_arr: number;
    weighted_arr: number;
  };

  forecast: {
    commit: number;      // >90% probability
    likely: number;      // 70-90% probability
    at_risk: number;     // <70% probability
  };

  by_stage: {
    stage: RenewalStage;
    count: number;
    arr: number;
  }[];

  by_risk: {
    risk_level: RiskLevel;
    count: number;
    arr: number;
  }[];

  by_month: {
    month: string;
    count: number;
    arr: number;
    weighted_arr: number;
  }[];
}

// Renewal Calendar Entry
export interface RenewalCalendarEntry {
  date: string;
  count: number;
  total_arr: number;
  renewals: {
    id: string;
    customer_name: string;
    arr: number;
    risk_level: RiskLevel;
  }[];
}

// Renewal History record
export interface RenewalHistory {
  id: string;
  renewal_id: string;
  stage: RenewalStage;
  probability: number;
  risk_level: RiskLevel;
  proposed_arr?: number;
  changed_by?: string;
  change_reason?: string;
  created_at: string;
}

// Renewal Detail Response (for single renewal view)
export interface RenewalDetailResponse {
  renewal: RenewalWithCustomer;
  history: RenewalHistory[];
  checklist: RenewalChecklistItem[];
  recommendations: string[];
  risk_factors: {
    factor: string;
    status: 'good' | 'warning' | 'critical';
    value: string | number;
    description: string;
  }[];
}

// Renewal Forecast Response
export interface RenewalForecastResponse {
  forecast: RenewalForecast;
  renewals: RenewalWithCustomer[];
  calendar: RenewalCalendarEntry[];
  trends: {
    period: string;
    predicted_retention: number;
    actual_retention?: number;
  }[];
  generated_at: string;
}

// Renewal Update Request
export interface RenewalUpdateRequest {
  stage?: RenewalStage;
  probability?: number;
  proposed_arr?: number;
  notes?: string;
  outcome?: RenewalOutcome;
  outcome_arr?: number;
}

// Checklist Update Request
export interface ChecklistUpdateRequest {
  item_id: string;
  is_completed: boolean;
}

// Renewal Filter Options
export interface RenewalFilterOptions {
  period?: string;          // 'Q1', 'Q2', 'Q3', 'Q4', 'month', 'year'
  csm_id?: string;
  risk_level?: RiskLevel;
  stage?: RenewalStage;
  days_min?: number;
  days_max?: number;
  segment?: string;
}

// Stage Labels for UI
export const STAGE_LABELS: Record<RenewalStage, string> = {
  not_started: 'Not Started',
  prep: 'Prep',
  value_review: 'Value Review',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  verbal_commit: 'Verbal Commit',
  closed: 'Closed',
};

// Stage Colors for UI
export const STAGE_COLORS: Record<RenewalStage, string> = {
  not_started: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  prep: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  value_review: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  proposal_sent: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  negotiation: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  verbal_commit: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  closed: 'bg-green-500/20 text-green-400 border-green-500/30',
};

// Risk Level Labels
export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical',
};

// Risk Level Colors
export const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Helper to calculate days to renewal
export function calculateDaysToRenewal(renewalDate: string): number {
  const today = new Date();
  const renewal = new Date(renewalDate);
  const diffTime = renewal.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Helper to calculate weighted ARR
export function calculateWeightedArr(arr: number, probability: number): number {
  return arr * (probability / 100);
}
