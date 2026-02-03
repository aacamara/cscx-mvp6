/**
 * Risk Assessment Types (PRD-229)
 * AI-powered deal and customer risk assessment
 */

// Risk categories
export type RiskCategory =
  | 'relationship'  // Champion departure, stakeholder misalignment
  | 'product'       // Low adoption, feature gaps, support issues
  | 'commercial'    // Budget constraints, price sensitivity, procurement
  | 'competitive'   // Active evaluation, competitor mentions
  | 'timing'        // Decision timeline, fiscal year misalignment
  | 'process';      // Missing milestones, stalled stages

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskStatus = 'new' | 'acknowledged' | 'mitigating' | 'resolved';
export type MitigationEffort = 'low' | 'medium' | 'high';

// Individual risk identified in assessment
export interface IdentifiedRisk {
  id: string;
  category: RiskCategory;
  name: string;
  description: string;
  severity: RiskSeverity;
  impact_score: number;  // Contribution to overall risk (0-100)
  evidence: string[];
  detected_at: string;
  status: RiskStatus;
}

// Recommended mitigation action
export interface Mitigation {
  risk_id: string;
  action: string;
  expected_impact: number;  // Risk reduction if executed (0-100)
  effort: MitigationEffort;
  timeline: string;
  owner?: string;
}

// Comparison to similar historical deals
export interface DealComparison {
  similar_deals_won: number;
  similar_deals_lost: number;
  win_rate: number;
  key_differentiator: string;
  your_deal_missing: string[];
}

// Risk trend over time
export interface RiskTrend {
  direction: 'increasing' | 'decreasing' | 'stable';
  change_7d: number;
  change_30d?: number;
  history: Array<{
    date: string;
    score: number;
  }>;
}

// Full risk assessment for a deal/customer
export interface RiskAssessment {
  id: string;
  customer_id: string;
  customer_name: string;
  deal_id?: string;
  deal_type?: 'renewal' | 'upsell' | 'cross_sell' | 'expansion';
  deal_value?: number;
  close_date?: string;
  overall_risk_score: number;  // 0-100, higher = more risky
  risk_level: RiskLevel;
  confidence: number;  // 0-1, how confident is the assessment
  risks: IdentifiedRisk[];
  mitigations: Mitigation[];
  comparison?: DealComparison;
  trend: RiskTrend;
  model_version: string;
  assessed_at: string;
  created_at: string;
  updated_at: string;
}

// Risk assessment history entry
export interface RiskHistoryEntry {
  id: string;
  customer_id: string;
  deal_id?: string;
  risk_score: number;
  risk_level: RiskLevel;
  recorded_at: string;
}

// Mitigation action tracking
export interface MitigationAction {
  id: string;
  customer_id: string;
  deal_id?: string;
  risk_id: string;
  action: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  outcome?: 'successful' | 'partially_successful' | 'unsuccessful';
  notes?: string;
  created_at: string;
  completed_at?: string;
}

// Portfolio-level risk summary
export interface PortfolioRiskSummary {
  total_customers: number;
  total_value: number;
  risk_distribution: {
    low: { count: number; value: number };
    medium: { count: number; value: number };
    high: { count: number; value: number };
    critical: { count: number; value: number };
  };
  top_risks_across_portfolio: Array<{
    risk: string;
    customer_count: number;
    category: RiskCategory;
  }>;
  forecast_impact: {
    original_forecast: number;
    risk_adjusted_forecast: number;
    at_risk_amount: number;
  };
  trending_worse: Array<{
    customer_id: string;
    customer_name: string;
    change: number;
    risk_score: number;
  }>;
  trending_better: Array<{
    customer_id: string;
    customer_name: string;
    change: number;
    risk_score: number;
  }>;
}

// Input for generating a risk assessment
export interface RiskAssessmentInput {
  customer_id: string;
  deal_id?: string;
  deal_type?: 'renewal' | 'upsell' | 'cross_sell' | 'expansion';
  deal_value?: number;
  close_date?: string;
  force_refresh?: boolean;  // Bypass cache and regenerate
}

// Customer context for risk analysis
export interface CustomerRiskContext {
  customer_id: string;
  customer_name: string;
  industry?: string;
  arr: number;
  health_score: number;
  days_to_renewal?: number;
  contract_term_months?: number;
  tenure_months?: number;

  // Usage metrics
  dau_trend_30d?: number;
  mau_trend_90d?: number;
  feature_adoption_breadth?: number;
  feature_adoption_trend?: number;
  login_frequency_change?: number;

  // Engagement metrics
  meetings_last_90d?: number;
  meeting_sentiment_trend?: 'improving' | 'stable' | 'declining';
  email_response_rate?: number;
  days_since_last_meeting?: number;
  days_since_last_email?: number;

  // Health metrics
  health_score_change_30d?: number;
  health_score_change_90d?: number;
  health_score_velocity?: number;

  // Support metrics
  ticket_volume_trend?: number;
  avg_ticket_severity?: number;
  unresolved_tickets?: number;
  support_sentiment?: number;

  // Relationship factors
  champion_departed?: boolean;
  champion_departure_date?: string;
  stakeholder_count?: number;
  exec_sponsor_engaged?: boolean;

  // Competitive signals
  competitor_mentioned?: boolean;
  competitor_mentions_90d?: number;
  active_rfp?: boolean;
  competitor_evidence?: string[];

  // Commercial factors
  payment_history_score?: number;
  late_payments_count?: number;

  // Historical
  previous_save_plays?: number;
  last_activity_date?: string;
}

// Alert for risk threshold crossing
export interface RiskAlert {
  id: string;
  customer_id: string;
  customer_name: string;
  alert_type: 'threshold_crossed' | 'rapid_increase' | 'new_critical_risk';
  previous_level?: RiskLevel;
  current_level: RiskLevel;
  previous_score?: number;
  current_score: number;
  triggered_at: string;
  acknowledged?: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
}
