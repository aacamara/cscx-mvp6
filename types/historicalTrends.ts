/**
 * Historical Data Upload Trend Analysis Types
 * PRD-022: Multi-year trend analysis with predictions
 *
 * Supports:
 * - Multi-year data analysis
 * - Seasonal pattern detection
 * - Growth trajectory modeling
 * - Predictive forecasting
 * - Cohort analysis over time
 */

// ============================================
// Data Point Types
// ============================================

export interface HistoricalDataPoint {
  date: string;           // ISO date
  customerId?: string;
  customerName?: string;
  arr?: number;
  healthScore?: number;
  nps?: number;
  usage?: number;         // Active users or usage metric
  engagementScore?: number;
  supportTickets?: number;
  featureAdoption?: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

// ============================================
// Upload & Validation Types
// ============================================

export interface HistoricalUploadResult {
  uploadId: string;
  fileName: string;
  timeRange: {
    start: string;
    end: string;
    periodYears: number;
    periodMonths: number;
  };
  customerCount: number;
  dataPointsPerCustomer: number;
  totalDataPoints: number;
  metrics: string[];
  validationWarnings: string[];
}

export interface HistoricalColumnMapping {
  date: string;
  customerId?: string;
  customerName?: string;
  arr?: string;
  healthScore?: string;
  nps?: string;
  usage?: string;
  engagementScore?: string;
  supportTickets?: string;
  featureAdoption?: string;
  [key: string]: string | undefined;
}

// ============================================
// Trend Analysis Types
// ============================================

export type TrendDirection = 'up' | 'down' | 'stable';
export type TrendStrength = 'strong' | 'moderate' | 'weak';

export interface TrendMetrics {
  cagr: number;                    // Compound Annual Growth Rate (%)
  direction: TrendDirection;
  strength: TrendStrength;
  velocity: number;                // Rate of change per period
  rSquared: number;                // Goodness of fit (0-1)
  startValue: number;
  endValue: number;
  change: number;                  // Absolute change
  changePercent: number;           // Percent change
}

export interface InflectionPoint {
  date: string;
  metric: string;
  previousValue: number;
  newValue: number;
  changePercent: number;
  direction: 'up' | 'down';
  significance: 'high' | 'medium' | 'low';
  possibleCause?: string;
}

export interface CustomerTrendAnalysis {
  customerId: string;
  customerName: string;
  segment: TrendSegment;
  metrics: {
    arr: TrendMetrics | null;
    healthScore: TrendMetrics | null;
    nps: TrendMetrics | null;
    usage: TrendMetrics | null;
  };
  inflectionPoints: InflectionPoint[];
  growthDriver?: string;
  declineDriver?: string;
  dataPoints: HistoricalDataPoint[];
}

// ============================================
// Trend Segmentation Types
// ============================================

export type TrendSegment =
  | 'high_growth'      // CAGR > 30%
  | 'steady_growth'    // CAGR 10-30%
  | 'stable'           // CAGR -10% to +10%
  | 'declining'        // CAGR -10% to -30%
  | 'at_risk';         // CAGR < -30% or accelerating decline

export interface SegmentSummary {
  segment: TrendSegment;
  label: string;
  customerCount: number;
  totalArr: number;
  arrPercent: number;
  avgCagr: number;
  characteristics: string[];
}

// ============================================
// Seasonal Pattern Types
// ============================================

export interface SeasonalPattern {
  metric: string;
  periodicity: 'quarterly' | 'annual' | 'monthly';
  peakPeriod: string;          // e.g., "Q2-Q3" or "Jun-Aug"
  troughPeriod: string;        // e.g., "Q4" or "Dec-Jan"
  amplitude: number;           // Strength of seasonal variation (0-100)
  seasonalityIndex: number[];  // Index values for each period
  confidence: number;          // 0-100
  insights: string[];
}

export interface QuarterlyPattern {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  avgValue: number;
  indexValue: number;          // 100 = average, >100 = above avg
  variance: number;
}

// ============================================
// Forecast Types
// ============================================

export type ForecastConfidence = 'high' | 'medium' | 'low';

export interface ForecastPeriod {
  period: string;              // Date or period label
  predictedValue: number;
  lowerBound: number;
  upperBound: number;
  confidence: ForecastConfidence;
}

export interface CustomerForecast {
  customerId: string;
  customerName: string;
  currentArr: number;
  forecastArr: number;
  currentHealth: number;
  forecastHealth: number;
  confidence: ForecastConfidence;
  trajectory: TrendDirection;
  recommendedAction?: 'expansion_play' | 'upsell_ready' | 'maintain' | 'save_play' | 'at_risk_intervention';
  riskFactors: string[];
}

export interface PortfolioForecast {
  metric: string;
  currentValue: number;
  periods: ForecastPeriod[];
  methodology: string;
  assumptions: string[];
}

// ============================================
// Cohort Analysis Types
// ============================================

export interface CohortTrendData {
  cohortName: string;
  cohortSize: number;
  totalArr: number;
  avgHealthScore: number;
  trend: TrendDirection;
  cagr: number;
  timeSeriesData: TimeSeriesPoint[];
}

export interface CohortAnalysis {
  dimension: 'segment' | 'industry' | 'tenure' | 'arr_band' | 'csm';
  cohorts: CohortTrendData[];
  insights: string[];
}

// ============================================
// Main Analysis Response Types
// ============================================

export interface PortfolioOverviewTrend {
  metric: string;
  startDate: string;
  startValue: number;
  endDate: string;
  endValue: number;
  cagr: number;
  trend: TrendDirection;
  trendLabel: string;     // e.g., "Strong" or "Moderate"
}

export interface HistoricalAnalysisResult {
  uploadId: string;
  analyzedAt: string;

  // Data Overview
  dataOverview: {
    timeRange: {
      start: string;
      end: string;
      years: number;
      months: number;
    };
    customerCount: number;
    dataPointsPerCustomer: number;
    metricsAnalyzed: string[];
  };

  // Portfolio-level trends
  portfolioTrends: PortfolioOverviewTrend[];

  // Customer segmentation
  segmentation: SegmentSummary[];

  // Top performers and at-risk
  topPerformers: CustomerTrendAnalysis[];
  atRiskCustomers: CustomerTrendAnalysis[];

  // Seasonal patterns
  seasonalPatterns: SeasonalPattern[];

  // Key inflection points
  significantInflectionPoints: InflectionPoint[];

  // Forecasts
  portfolioForecast: PortfolioForecast[];
  customerForecasts: CustomerForecast[];

  // Strategic recommendations
  recommendations: StrategicRecommendation[];
}

// ============================================
// Recommendation Types
// ============================================

export type RecommendationType =
  | 'champion_succession'
  | 'seasonal_playbook'
  | 'growth_acceleration'
  | 'at_risk_intervention'
  | 'expansion_opportunity';

export interface StrategicRecommendation {
  type: RecommendationType;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  relatedCustomers?: string[];
  actionItems: string[];
  expectedImpact: string;
}

// ============================================
// Intervention Plan Types
// ============================================

export interface InterventionTask {
  week: string;
  title: string;
  tasks: string[];
}

export interface InterventionPlan {
  customerId: string;
  customerName: string;
  currentState: {
    arr: number;
    healthScore: number;
    trend: TrendDirection;
    cagr: number;
    forecastArr: number;
  };
  rootCause: string;
  interventionTasks: InterventionTask[];
  successMetrics: {
    metric: string;
    target: string;
    deadline: string;
  }[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface HistoricalUploadRequest {
  columnMapping: HistoricalColumnMapping;
}

export interface HistoricalAnalysisRequest {
  uploadId: string;
  options?: {
    forecastPeriods?: number;
    includeSeasonalAnalysis?: boolean;
    segmentBy?: 'arr' | 'industry' | 'tenure';
  };
}

export interface TrendAnalysisResponse {
  success: boolean;
  data?: HistoricalAnalysisResult;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    responseTimeMs: number;
    analysisVersion: string;
  };
}

// ============================================
// Chart Data Types
// ============================================

export interface TrendChartData {
  label: string;
  data: TimeSeriesPoint[];
  color: string;
  forecast?: TimeSeriesPoint[];
  forecastColor?: string;
}

export interface SeasonalChartData {
  quarters: QuarterlyPattern[];
  metric: string;
}
