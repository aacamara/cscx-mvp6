/**
 * Risk Score Types (PRD-113)
 * Composite risk score calculation with weighted signal aggregation
 */

// ============================================
// RISK SIGNAL TYPES
// ============================================

export type RiskSignalType =
  | 'usage_decline'
  | 'nps_detractor'
  | 'champion_departed'
  | 'support_escalation'
  | 'payment_issues'
  | 'competitive_mention'
  | 'engagement_silence'
  | 'health_score_drop';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskTrend = 'increasing' | 'stable' | 'decreasing';

// Signal weights for risk calculation (must sum to 1.0)
export const RISK_SIGNAL_WEIGHTS: Record<RiskSignalType, number> = {
  usage_decline: 0.20,
  nps_detractor: 0.15,
  champion_departed: 0.15,
  support_escalation: 0.10,
  payment_issues: 0.10,
  competitive_mention: 0.10,
  engagement_silence: 0.10,
  health_score_drop: 0.10
};

// Signal display names
export const RISK_SIGNAL_NAMES: Record<RiskSignalType, string> = {
  usage_decline: 'Usage Decline',
  nps_detractor: 'NPS Detractor',
  champion_departed: 'Champion Departed',
  support_escalation: 'Support Escalation',
  payment_issues: 'Payment Issues',
  competitive_mention: 'Competitive Mention',
  engagement_silence: 'Engagement Silence',
  health_score_drop: 'Health Score Drop'
};

// Risk level thresholds
export const RISK_THRESHOLDS = {
  critical: { min: 80, max: 100 },
  high: { min: 60, max: 79 },
  medium: { min: 40, max: 59 },
  low: { min: 0, max: 39 }
};

// Alert thresholds
export const ALERT_THRESHOLDS = {
  high_risk_score: 70,
  rapid_increase_points: 20,
  rapid_increase_days: 7
};

// ============================================
// INDIVIDUAL RISK SIGNAL
// ============================================

export interface RiskSignal {
  id: string;
  customer_id: string;
  signal_type: RiskSignalType;
  severity: RiskSeverity;
  value: number; // 0-1 normalized value
  raw_data: Record<string, unknown>;
  evidence: string[];
  detected_at: string;
  resolved_at: string | null;
  is_active: boolean;
  recency_days?: number; // Computed
}

export interface RiskSignalInput {
  type: RiskSignalType;
  value: number; // 0-1 normalized
  recencyDays: number;
  evidence?: string[];
  rawData?: Record<string, unknown>;
}

// ============================================
// SIGNAL BREAKDOWN
// ============================================

export interface SignalBreakdown {
  signal_type: RiskSignalType;
  name: string;
  weight: number;
  raw_value: number;
  recency_factor: number;
  adjusted_weight: number;
  contribution: number;
  severity: RiskSeverity;
  evidence: string[];
}

// ============================================
// RISK SCORE
// ============================================

export interface RiskScore {
  id: string;
  customer_id: string;
  score: number; // 0-100, higher = more risk
  previous_score: number | null;
  score_change: number | null;
  trend: RiskTrend;
  risk_level: RiskLevel;
  components: Record<RiskSignalType, number>;
  signal_breakdown: SignalBreakdown[];
  calculated_at: string;
  calculation_reason: string;
  created_at: string;
  updated_at: string;
}

export interface RiskScoreWithCustomer extends RiskScore {
  customer_name: string;
  arr: number;
  health_score: number;
  stage: string;
  renewal_date: string | null;
  days_to_renewal: number | null;
}

// ============================================
// RISK SCORE HISTORY
// ============================================

export interface RiskScoreHistoryEntry {
  date: string;
  score: number;
  risk_level: RiskLevel;
}

export interface RiskScoreHistory {
  customer_id: string;
  customer_name?: string;
  history: RiskScoreHistoryEntry[];
  period_days: number;
  trend: RiskTrend;
  change_7d: number;
  change_30d: number | null;
}

// ============================================
// RISK SCORE ALERTS
// ============================================

export type RiskAlertType = 'threshold_exceeded' | 'rapid_increase' | 'critical_signals';

export interface RiskScoreAlert {
  id: string;
  customer_id: string;
  customer_name?: string;
  alert_type: RiskAlertType;
  previous_score: number | null;
  current_score: number;
  score_change: number | null;
  previous_level: RiskLevel | null;
  current_level: RiskLevel;
  triggered_signals: SignalBreakdown[];
  triggered_at: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  action_taken: string | null;
}

// ============================================
// SAVE PLAY TYPES
// ============================================

export type SavePlayType =
  | 'executive_outreach'
  | 'value_reinforcement'
  | 'adoption_workshop'
  | 'pricing_review'
  | 'champion_rebuild'
  | 'support_escalation'
  | 'custom';

export type SavePlayStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type SavePlayOutcome = 'saved' | 'churned' | 'pending' | 'partial';

export interface SavePlay {
  id: string;
  customer_id: string;
  triggered_by_score_id: string | null;
  play_type: SavePlayType;
  status: SavePlayStatus;
  assigned_to: string | null;
  risk_score_at_start: number | null;
  risk_score_at_end: number | null;
  actions_taken: Array<{
    action: string;
    completed_at: string;
    by: string;
  }>;
  outcome: SavePlayOutcome;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
}

// ============================================
// PORTFOLIO SUMMARY
// ============================================

export interface RiskDistribution {
  low: { count: number; arr: number; pct: number };
  medium: { count: number; arr: number; pct: number };
  high: { count: number; arr: number; pct: number };
  critical: { count: number; arr: number; pct: number };
}

export interface RiskPortfolioSummary {
  total_customers: number;
  total_arr: number;
  avg_risk_score: number;
  score_change_wow: number;
  distribution: RiskDistribution;
  arr_at_risk: number;
  arr_at_risk_pct: number;
  top_signals: Array<{
    signal_type: RiskSignalType;
    name: string;
    customer_count: number;
    avg_contribution: number;
  }>;
  trending_worse: RiskScoreWithCustomer[];
  trending_better: RiskScoreWithCustomer[];
  unacknowledged_alerts: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface RiskScoreResponse {
  success: boolean;
  data: RiskScoreWithCustomer;
}

export interface RiskScoreListResponse {
  success: boolean;
  data: {
    customers: RiskScoreWithCustomer[];
    total: number;
    page: number;
    limit: number;
  };
}

export interface RiskPortfolioResponse {
  success: boolean;
  data: RiskPortfolioSummary;
}

export interface RiskHistoryResponse {
  success: boolean;
  data: RiskScoreHistory;
}

export interface RiskAlertsResponse {
  success: boolean;
  data: {
    alerts: RiskScoreAlert[];
    total: number;
  };
}

// ============================================
// FILTER TYPES
// ============================================

export interface RiskScoreFilters {
  risk_level?: RiskLevel | 'all';
  min_score?: number;
  max_score?: number;
  has_alerts?: boolean;
  segment?: string;
  csm_id?: string;
  search?: string;
  sort_by?: 'score' | 'arr' | 'change' | 'name' | 'renewal';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// ============================================
// CALCULATION INPUT
// ============================================

export interface RiskScoreCalculationInput {
  customer_id: string;
  force_refresh?: boolean;
  signals?: RiskSignalInput[];
  reason?: string;
}

// ============================================
// SLACK ALERT FORMAT
// ============================================

export interface RiskScoreSlackAlert {
  customer_id: string;
  customer_name: string;
  risk_score: number;
  risk_level: RiskLevel;
  score_change: number | null;
  arr: number;
  days_to_renewal: number | null;
  health_score: number;
  top_risk_factors: Array<{
    name: string;
    severity: RiskSeverity;
    contribution: number;
    evidence: string[];
  }>;
  recommended_action: string;
}
