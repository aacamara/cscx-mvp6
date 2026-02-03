/**
 * Renewal Pipeline Forecast Types
 * PRD-059: Renewal Pipeline Forecast
 *
 * Provides intelligent renewal pipeline forecasts with predicted outcomes,
 * risk levels, and recommended actions.
 */

// ============================================
// Core Enums and Types
// ============================================

export type RenewalOutcome = 'renew' | 'churn' | 'downgrade' | 'expand';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Risk level styling and display
export const RISK_LEVEL_CONFIG: Record<RiskLevel, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  low: {
    label: 'Low Risk',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
  },
  medium: {
    label: 'Medium Risk',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
  },
  high: {
    label: 'High Risk',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
  },
};

export const OUTCOME_CONFIG: Record<RenewalOutcome, {
  label: string;
  color: string;
  icon: string;
}> = {
  renew: {
    label: 'Likely Renew',
    color: 'text-green-400',
    icon: '\u2713',
  },
  expand: {
    label: 'Expansion',
    color: 'text-blue-400',
    icon: '\u2191',
  },
  downgrade: {
    label: 'Downgrade',
    color: 'text-yellow-400',
    icon: '\u2193',
  },
  churn: {
    label: 'Churn Risk',
    color: 'text-red-400',
    icon: '\u2717',
  },
};

// ============================================
// Renewal Factor
// ============================================

export interface RenewalFactor {
  name: string;
  displayName: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  value: number;
  threshold: number;
  description: string;
}

// Factor display names and icons
export const FACTOR_DISPLAY: Record<string, { icon: string; description: string }> = {
  health_score: { icon: '\u2764', description: 'Overall account health' },
  usage_trend: { icon: '\u2197', description: 'Product usage patterns' },
  stakeholder_engagement: { icon: '\ud83e\udd1d', description: 'Contact frequency' },
  champion_status: { icon: '\u2b50', description: 'Active champion identified' },
  nps_score: { icon: '\ud83d\udcca', description: 'Net Promoter Score' },
  support_ticket_trend: { icon: '\ud83c\udfab', description: 'Support activity' },
  historical_renewal: { icon: '\ud83d\udd04', description: 'Prior renewal history' },
};

// ============================================
// Renewal Prediction
// ============================================

export interface RenewalPrediction {
  customerId: string;
  customerName: string;
  renewalDate: string;
  currentArr: number;
  predictedOutcome: RenewalOutcome;
  probability: number;
  riskLevel: RiskLevel;
  expectedArr: number;
  confidenceInterval: {
    low: number;
    high: number;
  };
  factors: RenewalFactor[];
  recommendedActions: string[];
  csmName: string | null;
  daysUntilRenewal: number;
  lastContactDate: string | null;
}

// ============================================
// Forecast Summary
// ============================================

export interface ForecastSummary {
  totalRenewals: number;
  totalArrUpForRenewal: number;
  predictedRetentionRate: number;
  expectedRenewedArr: number;
  atRiskArr: number;
  expansionOpportunity: number;
}

// ============================================
// Outcome Breakdown
// ============================================

export interface OutcomeBreakdown {
  outcome: string;
  accounts: number;
  arr: number;
  percentage: number;
}

// ============================================
// Monthly Breakdown
// ============================================

export interface MonthlyBreakdown {
  month: string;
  renewals: number;
  arr: number;
  predictedRetention: number;
}

// ============================================
// Critical Action
// ============================================

export interface CriticalAction {
  customerId: string;
  customerName: string;
  arr: number;
  daysUntilRenewal: number;
  actions: string[];
}

// ============================================
// Full Forecast Response
// ============================================

export interface RenewalPipelineForecast {
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  summary: ForecastSummary;
  byOutcome: OutcomeBreakdown[];
  predictions: RenewalPrediction[];
  monthlyBreakdown: MonthlyBreakdown[];
  criticalActions: CriticalAction[];
}

// ============================================
// Filter Types
// ============================================

export type TimeHorizon = '30d' | '60d' | '90d' | 'quarter' | 'year';
export type RiskFilter = 'all' | 'at-risk' | 'healthy';

export interface RenewalForecastFilters {
  horizon: TimeHorizon;
  csmId?: string;
  segment?: string;
  riskFilter: RiskFilter;
  search?: string;
  sortBy?: 'renewal' | 'arr' | 'probability' | 'risk' | 'name';
  sortOrder?: 'asc' | 'desc';
}

// Default filters
export const DEFAULT_FILTERS: RenewalForecastFilters = {
  horizon: '90d',
  riskFilter: 'all',
  sortBy: 'risk',
  sortOrder: 'asc',
};

// ============================================
// API Response
// ============================================

export interface RenewalForecastAPIResponse {
  success: boolean;
  data: RenewalPipelineForecast;
  meta: {
    generatedAt: string;
    responseTimeMs: number;
    renewalCount: number;
    period: {
      start: string;
      end: string;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface CustomerForecastAPIResponse {
  success: boolean;
  data: RenewalPrediction;
  meta: {
    generatedAt: string;
    responseTimeMs: number;
    riskLevel: RiskLevel;
    probability: number;
  };
  error?: {
    code: string;
    message: string;
  };
}
