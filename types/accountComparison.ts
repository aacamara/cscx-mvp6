/**
 * Account Comparison Types (PRD-058)
 *
 * Type definitions for comparing 2-5 accounts side-by-side
 * across key metrics, behaviors, and outcomes.
 */

// ============================================
// Input Types
// ============================================

export type ComparisonFocus = 'health' | 'usage' | 'engagement' | 'financial' | 'all';
export type ComparisonTimePeriod = 'current' | 'last_quarter' | 'last_year';

export interface AccountComparisonRequest {
  accountIds: string[];
  focus?: ComparisonFocus;
  timePeriod?: ComparisonTimePeriod;
}

// ============================================
// Account Data Types
// ============================================

export interface ComparedAccount {
  id: string;
  name: string;
  arr: number;
  segment: string;
  industry: string;
  healthScore: number;
  stage: string;
  contractStart: string | null;
  contractEnd: string | null;
  csmName: string | null;
}

// ============================================
// Metric Comparison Types
// ============================================

export interface MetricComparison {
  metric: string;
  values: MetricValue[];
  delta: string | number;
  deltaType: 'percentage' | 'absolute' | 'points';
  winner: string | null; // Account name or null if tie/N/A
  importance: 'high' | 'medium' | 'low';
}

export interface MetricValue {
  accountId: string;
  accountName: string;
  value: number | string | boolean;
  displayValue: string;
  trend?: 'up' | 'down' | 'stable';
}

// ============================================
// Dimension Comparison Types
// ============================================

export interface FinancialComparison {
  arr: MetricComparison;
  contractLength: MetricComparison;
  expansionRevenue: MetricComparison;
  ltv: MetricComparison;
  revenueGrowth: MetricComparison;
}

export interface HealthComparison {
  healthScore: MetricComparison;
  usageScore: MetricComparison;
  engagementScore: MetricComparison;
  sentimentScore: MetricComparison;
  riskSignalCount: MetricComparison;
}

export interface EngagementComparison {
  stakeholderCount: MetricComparison;
  championStrength: MetricComparison;
  execSponsor: MetricComparison;
  meetingFrequency: MetricComparison;
  lastContact: MetricComparison;
  responseTime: MetricComparison;
}

export interface UsageComparison {
  dauMau: MetricComparison;
  featureAdoption: MetricComparison;
  apiUsage: MetricComparison;
  loginFrequency: MetricComparison;
  usageTrend: MetricComparison;
}

// ============================================
// AI Analysis Types
// ============================================

export interface KeyDifferentiator {
  factor: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  accounts: {
    accountId: string;
    accountName: string;
    performance: 'strong' | 'average' | 'weak';
    detail: string;
  }[];
}

export interface RecommendedAction {
  targetAccount: string;
  targetAccountId: string;
  action: string;
  priority: 'Immediate' | 'This Week' | 'This Month' | 'Ongoing';
  reason: string;
  expectedImpact: string;
}

export interface PatternToApply {
  pattern: string;
  sourceAccount: string;
  targetAccounts: string[];
  description: string;
}

export interface AIAnalysis {
  headline: string;
  keyDifferentiators: KeyDifferentiator[];
  recommendedActions: RecommendedAction[];
  patternsToApply: PatternToApply[];
}

// ============================================
// Visualization Types
// ============================================

export interface RadarChartData {
  dimensions: string[];
  datasets: {
    accountId: string;
    accountName: string;
    values: number[];
    color: string;
  }[];
}

export interface TrendLineData {
  metric: string;
  data: {
    date: string;
    values: { accountId: string; value: number }[];
  }[];
}

export interface ComparisonVisualization {
  radarChart: RadarChartData;
  trendLines: TrendLineData[];
  barComparison: {
    metrics: string[];
    values: { accountId: string; accountName: string; values: number[] }[];
  };
}

// ============================================
// Main Response Type
// ============================================

export interface AccountComparisonResult {
  comparisonId: string;
  generatedAt: string;
  accounts: ComparedAccount[];
  comparisons: {
    financial: FinancialComparison;
    health: HealthComparison;
    engagement: EngagementComparison;
    usage: UsageComparison;
  };
  analysis: AIAnalysis;
  visualization: ComparisonVisualization;
  warnings: string[];
  focus: ComparisonFocus;
  timePeriod: ComparisonTimePeriod;
}

// ============================================
// Error Types
// ============================================

export interface AccountComparisonError {
  code: 'MIN_ACCOUNTS' | 'MAX_ACCOUNTS' | 'ACCOUNT_NOT_FOUND' | 'INSUFFICIENT_DATA' | 'INTERNAL_ERROR';
  message: string;
  details?: Record<string, unknown>;
}
