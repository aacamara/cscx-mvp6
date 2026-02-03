/**
 * Health Prediction Types (PRD-231)
 */

export type DriverDirection = 'positive' | 'negative';
export type InterventionEffort = 'low' | 'medium' | 'high';

export interface PredictionPoint {
  daysAhead: number;
  predictedScore: number;
  confidenceInterval: { low: number; high: number };
  keyFactors: string[];
}

export interface Driver {
  factor: string;
  direction: DriverDirection;
  magnitude: number;
  description: string;
}

export interface InterventionImpact {
  intervention: string;
  description: string;
  expectedHealthImpact: number;
  confidence: number;
  timeToImpactDays: number;
  effort: InterventionEffort;
}

export interface AccuracyMetrics {
  accuracy30d: number | null;
  accuracy60d: number | null;
  accuracy90d: number | null;
  totalPredictions: number;
}

export interface HealthPrediction {
  id: string;
  customerId: string;
  customerName: string;
  currentHealth: number;
  predictions: PredictionPoint[];
  confidence: number;
  primaryDrivers: Driver[];
  interventions: InterventionImpact[];
  accuracyMetrics: AccuracyMetrics;
  predictedAt: string;
}

export interface PortfolioSummary {
  currentAvgHealth: number;
  predicted30dAvg: number;
  predicted60dAvg: number;
  predicted90dAvg: number;
}

export interface AtRiskForecast {
  currentBelow50: number;
  predicted30dBelow50: number;
  predicted60dBelow50: number;
  predicted90dBelow50: number;
}

export interface DecliningAccount {
  customerId: string;
  customerName: string;
  current: number;
  predicted90d: number;
  decline: number;
}

export interface PortfolioHealthForecast {
  portfolioSummary: PortfolioSummary;
  atRiskForecast: AtRiskForecast;
  accountsDeclining: DecliningAccount[];
  recommendedFocus: string[];
}

export interface SimulationResult {
  customerId: string;
  customerName: string;
  currentHealth: number;
  selectedInterventions: string[];
  totalExpectedImpact: number;
  adjustedPredictions: Array<{
    daysAhead: number;
    originalScore: number;
    adjustedScore: number;
    improvement: number;
  }>;
  confidence: number;
  simulatedAt: string;
}
