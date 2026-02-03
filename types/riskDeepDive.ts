/**
 * Risk Deep Dive Types (PRD-083)
 * Types for comprehensive risk factor analysis
 */

export type RiskCategory = 'usage' | 'engagement' | 'financial' | 'relationship' | 'support';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskTrend = 'accelerating' | 'stable' | 'decelerating' | 'improving';

/**
 * Individual risk factor with detailed analysis
 */
export interface RiskFactor {
  id: string;
  category: RiskCategory;
  name: string;
  description: string;
  severity: RiskSeverity;
  weight: number; // Percentage contribution to overall risk (0-100)
  value: number | string;
  benchmark?: number | string;
  trend: RiskTrend;
  trendDetail: string;
  isEmerging: boolean; // New in last 30 days
  isChronic: boolean; // Present for 90+ days
  relatedFactors?: string[]; // IDs of correlated factors
  recommendation?: string;
  playbookId?: string;
  lastUpdated: string;
}

/**
 * Historical data point for trend analysis
 */
export interface RiskHistoryPoint {
  date: string;
  riskScore: number;
  healthScore: number;
  category?: RiskCategory;
  event?: string; // Notable event on this date
}

/**
 * Mitigation action recommendation
 */
export interface MitigationAction {
  id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  action: string;
  description: string;
  estimatedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  timelineRecommendation: string;
  category: RiskCategory;
  addressesFactors: string[]; // Risk factor IDs this addresses
  playbookId?: string;
  assignedTo?: string;
  dueDate?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

/**
 * Benchmark comparison data
 */
export interface RiskBenchmark {
  category: RiskCategory;
  customerValue: number;
  segmentAverage: number;
  portfolioAverage: number;
  topPerformerValue: number;
  percentile: number; // Where customer falls (0-100)
}

/**
 * Complete risk deep dive analysis
 */
export interface RiskDeepDive {
  customerId: string;
  customerName: string;
  arr: number;
  healthScore: number;
  riskScore: number; // 0-100, higher = more risk
  riskLevel: RiskSeverity;
  confidence: 'low' | 'medium' | 'high';

  // Factor analysis
  factors: RiskFactor[];
  factorsByCategory: Record<RiskCategory, RiskFactor[]>;
  primaryConcerns: RiskFactor[]; // Top 3 most impactful

  // Trend analysis
  riskTrend: RiskTrend;
  riskTrendDescription: string;
  history: RiskHistoryPoint[];

  // Recommendations
  mitigationActions: MitigationAction[];

  // Benchmarks
  benchmarks: RiskBenchmark[];

  // Context
  daysToRenewal?: number;
  lastContactDays: number;
  lastMeetingDays: number;

  // Metadata
  generatedAt: string;
  dataCompleteness: number; // Percentage of data available (0-100)
  dataGaps: string[]; // List of missing data points
}

/**
 * Risk trend analysis response
 */
export interface RiskTrendAnalysis {
  customerId: string;
  customerName: string;
  period: string; // e.g., "last 90 days"
  history: RiskHistoryPoint[];
  averageRiskScore: number;
  currentRiskScore: number;
  changeFromPeriodStart: number;
  volatility: 'low' | 'medium' | 'high';
  keyEvents: Array<{
    date: string;
    event: string;
    impactOnRisk: number;
  }>;
  projection?: {
    expectedScore30Days: number;
    confidence: number;
  };
}

/**
 * Mitigation plan generated from risk analysis
 */
export interface MitigationPlan {
  customerId: string;
  customerName: string;
  planId: string;
  createdAt: string;
  totalActions: number;
  urgentActions: number;
  estimatedTimeToComplete: string;
  expectedRiskReduction: number;
  actions: MitigationAction[];
  phases: Array<{
    phase: number;
    name: string;
    actions: MitigationAction[];
    targetDate: string;
  }>;
}

/**
 * Factor weight configuration
 */
export interface RiskFactorWeight {
  id: string;
  factorType: string;
  category: RiskCategory;
  weight: number; // Default weight (0-1)
  description: string;
  isActive: boolean;
  updatedAt: string;
}

/**
 * API response types
 */
export interface RiskDeepDiveResponse {
  success: boolean;
  data?: RiskDeepDive;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    generatedAt: string;
    responseTimeMs: number;
    dataCompleteness: number;
  };
}

export interface RiskTrendResponse {
  success: boolean;
  data?: RiskTrendAnalysis;
  error?: {
    code: string;
    message: string;
  };
}

export interface MitigationPlanResponse {
  success: boolean;
  data?: MitigationPlan;
  error?: {
    code: string;
    message: string;
  };
}
