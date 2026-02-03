/**
 * User Growth Service Types (PRD-111)
 * Internal types for the user growth detection service
 */

export type UserGrowthMetricType = 'active_users' | 'invited_users' | 'seat_utilization';

export type UserGrowthAlertType =
  | 'rapid_growth'
  | 'approaching_limit'
  | 'exceeds_limit';

export type UserGrowthSeverity = 'info' | 'medium' | 'high';

export interface DepartmentGrowth {
  department: string;
  previousCount: number;
  currentCount: number;
  newUsers: number;
  percentChange: number;
}

export interface UserGrowthAnalysis {
  customerId: string;
  customerName: string;
  currentUsers: number;
  previousUsers: number;
  contractedSeats: number;
  seatUtilization: number;
  growthRate: number;
  newUsersByDepartment: DepartmentGrowth[];
  analyzedAt: string;
}

export interface UserGrowthAlert {
  id: string;
  customerId: string;
  customerName: string;
  alertType: UserGrowthAlertType;
  severity: UserGrowthSeverity;
  currentUsers: number;
  previousUsers: number;
  growthCount: number;
  growthRate: number;
  contractedSeats: number;
  seatUtilization: number;
  overageCount?: number;
  departmentGrowth: DepartmentGrowth[];
  estimatedExpansionRevenue?: number;
  pricePerSeat?: number;
  comparisonPeriod: string;
  detectedAt: Date;
  cooldownExpiresAt: Date;
}

export interface DetectionConfig {
  growthThresholdPercent?: number;
  seatUtilizationWarning?: number;
  seatUtilizationCritical?: number;
  minimumUserBaseline?: number;
  cooldownDays?: number;
  comparisonDays?: number;
}

export interface DetectionResult {
  customerId: string;
  customerName: string;
  alerts: UserGrowthAlert[];
  analysis?: UserGrowthAnalysis;
  skipped: boolean;
  skipReason?: string;
}

export interface CustomerContext {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  contractedSeats: number;
  pricePerSeat?: number;
  csmId?: string;
  csmName?: string;
  csmEmail?: string;
  primaryContact?: {
    name: string;
    email: string;
    title?: string;
  };
}

export interface WorkflowStepResult {
  stepId: string;
  stepName: string;
  success: boolean;
  data?: unknown;
  error?: string;
  executedAt: Date;
}

export interface WorkflowResult {
  success: boolean;
  workflowId: string;
  steps: WorkflowStepResult[];
  error?: string;
}

export interface SlackAlertParams {
  customerId: string;
  customerName: string;
  alertType: UserGrowthAlertType;
  severity: UserGrowthSeverity;
  currentUsers: number;
  previousUsers: number;
  growthCount: number;
  growthRate: number;
  contractedSeats: number;
  seatUtilization: number;
  overageCount?: number;
  topDepartments: Array<{ name: string; newUsers: number }>;
  estimatedRevenue?: number;
  arr?: number;
  healthScore?: number;
  csmName?: string;
}

/**
 * Calculate severity based on alert type and values
 */
export function calculateSeverity(
  alertType: UserGrowthAlertType,
  growthRate?: number,
  seatUtilization?: number
): UserGrowthSeverity {
  if (alertType === 'exceeds_limit') {
    return 'high';
  }

  if (alertType === 'approaching_limit') {
    if (seatUtilization && seatUtilization >= 0.95) {
      return 'high';
    }
    return 'medium';
  }

  if (alertType === 'rapid_growth') {
    if (growthRate && growthRate >= 50) {
      return 'high';
    }
    if (growthRate && growthRate >= 30) {
      return 'medium';
    }
    return 'info';
  }

  return 'info';
}

/**
 * Calculate estimated expansion revenue
 */
export function calculateExpansionRevenue(
  overageCount: number,
  pricePerSeat: number = 100  // Default $100/seat/month
): number {
  // Annual revenue for the overage seats
  return overageCount * pricePerSeat * 12;
}

/**
 * Get alert icon for Slack
 */
export function getAlertEmoji(alertType: UserGrowthAlertType): string {
  switch (alertType) {
    case 'exceeds_limit':
      return ':rotating_light:';
    case 'approaching_limit':
      return ':warning:';
    case 'rapid_growth':
      return ':chart_with_upwards_trend:';
    default:
      return ':bell:';
  }
}

/**
 * Get severity emoji for Slack
 */
export function getSeverityEmoji(severity: UserGrowthSeverity): string {
  switch (severity) {
    case 'high':
      return ':red_circle:';
    case 'medium':
      return ':large_orange_circle:';
    case 'info':
      return ':large_blue_circle:';
    default:
      return ':white_circle:';
  }
}
